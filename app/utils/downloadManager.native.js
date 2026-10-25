import AsyncStorage from '@react-native-async-storage/async-storage'
import * as FileSystem from 'expo-file-system'
import { useSyncExternalStore } from 'react'

import { urlStream, urlCover } from '~/utils/url'
import { coverIdFromUrl } from '~/utils/coverId'
import { getPathSong, getSongsDir, parseSongFileName, songCacheKey } from '~/utils/songFiles'
import { offlineCollections, offlineCollectionSongs, offlineSongs } from '~/utils/offlineContent'
import { collectionDiff } from '~/utils/collectionDiff'
import { getIsOffline } from '~/utils/offline'
import logger from '~/utils/logger'

const WINDOW_MS = 10_000

const listeners = new Set()
let state = { queue: [], index: {}, collections: {} }
let queueById = new Map()
let songIdsBySource = new Map()
let activeDownloads = 0

const maxConcurrent = () => Math.max(1, global.parallelDownloads || 3)

const getKeys = () => ({
	queue: 'downloadQueue',
	index: 'downloadIndex',
	collections: 'downloadCollections',
})

const notify = () => {
	listeners.forEach((listener) => listener())
}

const rebuildDerived = () => {
	queueById = new Map(state.queue.map((q) => [q.songId, q]))
	songIdsBySource = new Map()
	for (const [songId, entry] of Object.entries(state.index)) {
		for (const source of entry.sources || []) {
			const key = `${source.type}:${source.id}`
			if (!songIdsBySource.has(key)) songIdsBySource.set(key, new Set())
			songIdsBySource.get(key).add(songId)
		}
	}
}

const setState = (next) => {
	state = next
	rebuildDerived()
	notify()
}

const getSnapshot = () => state

const subscribe = (listener) => {
	listeners.add(listener)
	return () => listeners.delete(listener)
}

export const useDownloads = () => useSyncExternalStore(subscribe, getSnapshot)

// ---------------------------------------------------------------------------
// Speed tracker (rolling window of byte deltas)
// ---------------------------------------------------------------------------
const speedSamples = []
const lastBytes = new Map()
const speedIds = new Set()

const pruneSamples = () => {
	const cutoff = Date.now() - WINDOW_MS
	while (speedSamples.length > 0 && speedSamples[0].time < cutoff) {
		speedSamples.shift()
	}
}

const trackBytes = (songId, bytesWritten) => {
	const prev = lastBytes.get(songId) ?? 0
	lastBytes.set(songId, bytesWritten)
	const delta = bytesWritten - prev
	if (delta > 0) {
		speedSamples.push({ time: Date.now(), bytes: delta })
		pruneSamples()
	}
}

export const getDownloadSpeed = () => {
	pruneSamples()
	if (speedSamples.length < 2) return 0
	const totalBytes = speedSamples.reduce((sum, s) => sum + s.bytes, 0)
	const elapsed = (Date.now() - speedSamples[0].time) / 1000
	if (elapsed <= 0) return 0
	return totalBytes / elapsed
}

export const getActiveDownloadCount = () => speedIds.size

export const formatSpeed = (bytesPerSecond) => {
	if (bytesPerSecond >= 1024 * 1024) return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`
	if (bytesPerSecond >= 1024) return `${(bytesPerSecond / 1024).toFixed(0)} KB/s`
	return `${bytesPerSecond} B/s`
}

export const formatBytes = (bytes) => {
	if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
	if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
	if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
	return `${bytes} B`
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------
export const saveDownloads = async () => {
	const keys = getKeys()
	try {
		await AsyncStorage.multiSet([
			[keys.queue, JSON.stringify(state.queue)],
			[keys.index, JSON.stringify(state.index)],
			[keys.collections, JSON.stringify(state.collections)],
		])
	} catch (error) {
		logger.error('downloadManager', 'Error saving downloads', error)
	}
}

const migrateDownloadKeys = async () => {
	const all = await AsyncStorage.getAllKeys()
	const legacy = all.filter((key) => (
		(key.startsWith('downloadQueue:') || key.startsWith('downloadIndex:') || key.startsWith('downloadCollections:')) &&
		!['downloadQueue', 'downloadIndex', 'downloadCollections'].includes(key)
	))
	if (legacy.length === 0) return
	const stored = await AsyncStorage.multiGet(legacy)
	let queue = []
	let index = {}
	let collections = {}
	for (const [key, value] of stored) {
		if (!value) continue
		const data = JSON.parse(value)
		if (key.startsWith('downloadQueue:') && Array.isArray(data)) {
			for (const item of data) {
				if (!queue.some((q) => q.songId === item.songId)) queue.push(item)
			}
		} else if (key.startsWith('downloadIndex:')) {
			index = { ...index, ...data }
		} else if (key.startsWith('downloadCollections:')) {
			collections = { ...collections, ...data }
		}
	}
	await AsyncStorage.multiSet([
		['downloadQueue', JSON.stringify(queue)],
		['downloadIndex', JSON.stringify(index)],
		['downloadCollections', JSON.stringify(collections)],
	])
	await AsyncStorage.multiRemove(legacy)
}

// songUrl bakes global.config at enqueue time, so a WiFi/cellular switch left queued items
// pointing at the old address. Re-point anything not already downloading. In-flight items
// keep their URL: the two servers are the same library, so those bytes are still valid, and
// cancelling them would throw away a partial download for nothing.
const repointQueued = () => {
	const server = global.config?.url
	if (!server) return
	let changed = false
	const queue = state.queue.map((item) => {
		if (item.status === 'downloading') return item
		const url = songUrl({ id: item.songId })
		if (url === item.url) return item
		changed = true
		return { ...item, url, meta: { ...item.meta, server } }
	})
	if (changed) {
		logger.info('downloadManager', `re-pointed queued downloads to ${server}`)
		setState({ ...state, queue })
	}
}

// ---------------------------------------------------------------------------
// Local file migration (auto-cache removal)
// ---------------------------------------------------------------------------
// Old versions auto-cached streamed songs in the same folder as downloads. Auto-caching
// is gone: only files referenced by the download index (and the .part of an in-flight or
// paused download) may stay. Runs once; guarded so a failed state load is never mistaken
// for "an empty library" and never wipes every song.
const MIGRATION_KEY = 'localFilesMigration'

const consolidateLegacyFolders = async (songsDir) => {
	// Old versions kept one folder per server (and one accidental 'undefined' folder).
	const cacheRoot = `${FileSystem.documentDirectory}/cache/`
	const folders = await FileSystem.readDirectoryAsync(cacheRoot).catch(() => [])
	for (const folder of folders) {
		if (folder === 'songs' || folder === 'covers') continue
		const oldSongs = `${cacheRoot}${folder}/songs/`
		const info = await FileSystem.getInfoAsync(oldSongs)
		if (!info.exists || !info.isDirectory) continue
		const files = await FileSystem.readDirectoryAsync(oldSongs).catch(() => [])
		for (const file of files) {
			await FileSystem.moveAsync({ from: `${oldSongs}${file}`, to: `${songsDir}${file}` })
				.catch((error) => logger.error('downloadManager', `migrate ${file}:`, error))
		}
		const remaining = await FileSystem.readDirectoryAsync(oldSongs).catch(() => [])
		if (remaining.length === 0) await FileSystem.deleteAsync(oldSongs, { idempotent: true }).catch(() => { })
	}
}

const purgeLegacyCache = async () => {
	try {
		if (await AsyncStorage.getItem(MIGRATION_KEY)) return
		const songsDir = getSongsDir()
		await FileSystem.makeDirectoryAsync(songsDir, { intermediates: true }).catch(() => { })
		await consolidateLegacyFolders(songsDir)

		const keepIds = new Set(Object.keys(state.index))
		const activeIds = new Set(
			state.queue
				.filter((item) => ['queued', 'paused', 'downloading'].includes(item.status))
				.map((item) => item.songId)
		)

		const files = await FileSystem.readDirectoryAsync(songsDir).catch(() => [])

		// Backfill the file key on old index entries (written before entries carried it).
		// Prefer the current format/bitrate when several variants of the same id exist.
		const currentKey = (songId) => songCacheKey(songId, global.streamFormat, global.maxBitRate)
		const fileById = new Map()
		for (const file of files) {
			if (file.endsWith('.part')) continue
			const parsed = parseSongFileName(file)
			if (!parsed) continue
			if (!fileById.has(parsed.id) || file === currentKey(parsed.id)) fileById.set(parsed.id, file)
		}
		let indexChanged = false
		const nextIndex = { ...state.index }
		for (const [songId, entry] of Object.entries(nextIndex)) {
			if (!entry.file && fileById.has(songId)) {
				nextIndex[songId] = { ...entry, file: fileById.get(songId) }
				indexChanged = true
			}
		}
		if (indexChanged) {
			setState({ ...state, index: nextIndex })
			await saveDownloads()
		}

		let deleted = 0
		for (const file of files) {
			const isPart = file.endsWith('.part')
			const parsed = parseSongFileName(isPart ? file.slice(0, -5) : file)
			const keep = parsed ? (isPart ? activeIds.has(parsed.id) : keepIds.has(parsed.id)) : false
			if (keep) continue
			await FileSystem.deleteAsync(`${songsDir}${file}`, { idempotent: true }).catch(() => { })
			deleted++
		}

		await AsyncStorage.setItem(MIGRATION_KEY, '1')
		if (deleted) logger.info('downloadManager', `local files migration: removed ${deleted} legacy cache file(s)`)
	} catch (error) {
		logger.error('downloadManager', 'local files migration failed', error)
	}
}

export const initDownloads = async () => {
	await migrateDownloadKeys()
	const keys = getKeys()
	let loaded = false
	try {
		const stored = await AsyncStorage.multiGet([keys.queue, keys.index, keys.collections])
		const queue = stored[0][1] ? JSON.parse(stored[0][1]) : []
		const index = stored[1][1] ? JSON.parse(stored[1][1]) : {}
		const collections = stored[2][1] ? JSON.parse(stored[2][1]) : {}
		queue.forEach((item) => {
			if (item.status === 'downloading') item.status = item.resumeData ? 'paused' : 'queued'
			item.progress = 0
			item.resumable = null
		})
		state = { queue, index, collections }
		rebuildDerived()
		notify()
		loaded = true
		repointQueued()
	} catch (error) {
		logger.error('downloadManager', 'Error loading downloads', error)
	}
	if (!loaded) return
	await purgeLegacyCache()
	await initCovers()
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const songUrl = (song) => urlStream(global.config, song.id, global.streamFormat, global.maxBitRate)

const isCached = (songId) => {
	const song = state.index[songId]
	return song && song.size > 0
}

const sourceKey = (source) => (source ? `${source.type}:${source.id}` : null)

const buildMeta = (song) => ({
	title: song.title || song.name,
	artist: song.artist || '',
	album: song.album || '',
	cover: urlCover(global.config, song),
	// offline browsing: these let a downloaded song be listed (and played) with its real
	// metadata when the server is unreachable. Entries downloaded before this fall back
	// to title/artist/album only.
	duration: song.duration,
	albumId: song.albumId,
	artistId: song.artistId,
	coverArt: song.coverArt,
	track: song.track,
	// favourite state is local metadata too, so offline rows/players can render the circle
	starred: !!song.starred,
	userRating: song.userRating ?? song.rating ?? 0,
	// provenance: which address the bytes came from. Both addresses are the same library, so
	// this never invalidates the cache — it exists so a mismatch is visible instead of silent,
	// and so meta.cover can be re-pointed at the active server (see coverForCurrentServer).
	server: global.config?.url || null,
})

// meta.cover is a full URL baked at enqueue time. After an automatic WiFi/cellular server
// switch it points at the LAN address, which is unreachable off the house wifi — the cover
// silently falls back to the placeholder icon. Re-point the host instead of re-downloading.
export const coverForCurrentServer = (meta, config) => {
	if (!meta?.cover || !meta?.server || !config?.url) return meta?.cover
	if (meta.server === config.url) return meta.cover
	return meta.cover.startsWith(meta.server) ? `${config.url}${meta.cover.slice(meta.server.length)}` : meta.cover
}

// ---------------------------------------------------------------------------
// Cover cache (offline artwork)
// ---------------------------------------------------------------------------
// Cover files are named after the `id` in the getCoverArt URL (the album id for songs on
// Navidrome, coverArt elsewhere): one file answers every song, album and playlist that
// references it. Downloaded alongside the songs with a small concurrency cap — a full
// playlist enqueue must not fire one request per song at once. Not pruned when a single
// song goes: covers are shared per album and tiny; clearAllDownloads wipes the folder.
const COVERS_DIR = `${FileSystem.documentDirectory}cache/covers/`
const MAX_COVER_DOWNLOADS = 4
const localCovers = new Set()
const coversInFlight = new Set()
const coverQueue = []
let activeCovers = 0

export const getLocalCoverUri = (coverId) => (coverId && localCovers.has(coverId) ? `${COVERS_DIR}${coverId}.jpg` : null)

const pumpCovers = () => {
	while (activeCovers < MAX_COVER_DOWNLOADS && coverQueue.length > 0) {
		const { id, url } = coverQueue.shift()
		if (localCovers.has(id) || coversInFlight.has(id)) continue
		coversInFlight.add(id)
		activeCovers++
		FileSystem.makeDirectoryAsync(COVERS_DIR, { intermediates: true })
			.catch(() => { })
			.then(() => FileSystem.downloadAsync(url, `${COVERS_DIR}${id}.jpg`))
			.then((res) => {
				if (res?.status === 200) {
					localCovers.add(id)
					return
				}
				// downloadAsync resolves on HTTP errors and writes the body to disk: drop it
				return FileSystem.deleteAsync(res?.uri || `${COVERS_DIR}${id}.jpg`, { idempotent: true }).catch(() => { })
			})
			.catch((error) => logger.error('downloadManager', `cover ${id}: ${error?.message || error}`))
			.finally(() => {
				coversInFlight.delete(id)
				activeCovers = Math.max(0, activeCovers - 1)
				pumpCovers()
			})
	}
}

const queueCover = (url) => {
	const id = coverIdFromUrl(url)
	if (!id || localCovers.has(id) || coversInFlight.has(id) || coverQueue.some((c) => c.id === id)) return
	coverQueue.push({ id, url })
	pumpCovers()
}

const initCovers = async () => {
	try {
		await FileSystem.makeDirectoryAsync(COVERS_DIR, { intermediates: true }).catch(() => { })
		const files = await FileSystem.readDirectoryAsync(COVERS_DIR)
		files.forEach((file) => {
			if (file.endsWith('.jpg')) localCovers.add(file.slice(0, -4))
		})
	} catch (error) {
		logger.error('downloadManager', 'Error loading covers', error)
	}

	// Backfill: songs (and collections) downloaded before the cover cache existed have no
	// artwork on disk. Restartable by design — only the missing ids are queued — and skipped
	// while offline so a plane-mode start doesn't spin against an unreachable server.
	if (getIsOffline()) return
	const indexEntries = Object.values(state.index)
	const missing = indexEntries.filter((entry) => {
		const id = coverIdFromUrl(coverForCurrentServer(entry.meta, global.config))
		return id && !localCovers.has(id)
	})
	if (missing.length > 0) logger.info('downloadManager', `cover cache: backfilling ${missing.length} entrie(s)`)
	for (const entry of indexEntries) {
		queueCover(coverForCurrentServer(entry.meta, global.config))
	}
	for (const collection of Object.values(state.collections)) {
		queueCover(collection.cover)
	}
}

// ---------------------------------------------------------------------------
// Queue engine
// ---------------------------------------------------------------------------
const progressTimestamps = new Map()
const PROGRESS_INTERVAL_MS = 200

const onProgress = (songId) => (progress) => {
	const item = queueById.get(songId)
	if (!item || item.status !== 'downloading') return
	trackBytes(songId, progress.totalBytesWritten)
	const last = progressTimestamps.get(songId) || 0
	if (Date.now() - last < PROGRESS_INTERVAL_MS) return
	progressTimestamps.set(songId, Date.now())
	setState({
		...state,
		queue: state.queue.map((q) => q.songId === songId
			? { ...q, totalBytes: progress.totalBytesExpectedToWrite || q.totalBytes, writtenBytes: progress.totalBytesWritten, progress: progress.totalBytesExpectedToWrite ? progress.totalBytesWritten / progress.totalBytesExpectedToWrite : 0 }
			: q),
	})
}

const moveToQueue = (song, source, silent = false) => {
	if (isCached(song.id)) return null
	if (queueById.has(song.id)) return null
	const item = {
		songId: song.id,
		url: songUrl(song),
		meta: buildMeta(song),
		source,
		silent,
		status: 'queued',
		progress: 0,
		totalBytes: 0,
		writtenBytes: 0,
		resumeData: null,
		error: null,
		createdAt: Date.now(),
	}
	queueCover(item.meta.cover)
	return item
}

export const enqueueSong = async (song, source = null, silent = false) => {
	const item = moveToQueue(song, source, silent)
	if (!item) return
	setState({ ...state, queue: [...state.queue, item] })
	await saveDownloads()
	startNext()
}

export const enqueueCollection = async ({ type, id, name, artist = '', cover, songs }) => {
	const key = `${type}:${id}`
	const existing = state.collections[key]
	const collection = existing || { type, id, name, artist, cover, songIds: [], createdAt: Date.now() }
	collection.songIds = [...new Set([...collection.songIds, ...songs.map((s) => s.id)])]
	collection.name = collection.name || name
	collection.artist = collection.artist || artist
	collection.cover = collection.cover || cover
	queueCover(collection.cover)

	const source = { type, id, name: collection.name }
	const newItems = songs.map((song) => moveToQueue(song, source)).filter(Boolean)

	// Attach the collection source to songs that are already downloaded individually,
	// so they belong to this collection instead of showing as loose individual songs.
	const index = { ...state.index }
	for (const song of songs) {
		const entry = index[song.id]
		if (entry && !entry.sources.some((s) => s.type === source.type && s.id === source.id)) {
			index[song.id] = { ...entry, sources: [...entry.sources, source] }
		}
	}

	setState({
		...state,
		queue: [...state.queue, ...newItems],
		index,
		collections: { ...state.collections, [key]: collection },
	})
	await saveDownloads()
	startNext()
}

const validate = (res) => {
	const getHeader = (key) => {
		const header = Object.keys(res?.headers || {}).find((h) => h.toLowerCase() === key.toLowerCase())
		return header ? res.headers[header] : null
	}
	const contentType = getHeader('content-type')
	if (res?.status !== 200) return `Status ${res?.status}`
	if (!contentType?.includes('audio')) return `Not audio (${contentType})`
	return null
}

const runDownload = async (item) => {
	// Derived here, not at enqueue: the stream format / bitrate can change while the item sat
	// in the queue, and a baked partUri left an orphan .part plus a moveAsync to a stale name.
	// The same key is stored on the index entry, so a later setting change cannot orphan a
	// completed download.
	const fileKey = songCacheKey(item.songId, global.streamFormat, global.maxBitRate)
	const fileUri = `${getSongsDir()}${fileKey}`
	const partUri = `${fileUri}.part`
	// A resume token belongs to the old file name; replaying it against a new one is invalid.
	if (item.fileKey && item.fileKey !== fileKey) item.resumeData = null
	const resumable = FileSystem.createDownloadResumable(
		item.url,
		partUri,
		{},
		onProgress(item.songId),
		item.resumeData || undefined,
	)
	item.partUri = partUri
	item.fileKey = fileKey
	item.resumable = resumable
	speedIds.add(item.songId)
	lastBytes.set(item.songId, item.writtenBytes || 0)
	setState({
		...state,
		queue: state.queue.map((q) => q.songId === item.songId ? { ...q, status: 'downloading', error: null } : q),
	})

	try {
		const res = item.resumeData ? await resumable.resumeAsync() : await resumable.downloadAsync()
		const error = validate(res)
		if (error) {
			logger.error('downloadManager', `Download failed (${error})`)
			await finishError(item.songId, `Download failed (${error})`)
			return
		}
		const realSize = await FileSystem.getInfoAsync(item.partUri).then((info) => info.size)
		if (realSize === 0) {
			await finishError(item.songId, 'Download failed (empty file)')
			return
		}
		await FileSystem.moveAsync({ from: item.partUri, to: fileUri })
		finishSuccess(item.songId, realSize)
	} catch (error) {
		if (error?.code !== 'ERR_CANCELED') logger.error('downloadManager', error)
		await finishError(item.songId, error?.message || 'Download failed')
	}
}

const finishSuccess = async (songId, size) => {
	const item = state.queue.find((q) => q.songId === songId)
	if (!item) return
	speedIds.delete(songId)
	lastBytes.delete(songId)

	const indexEntry = state.index[songId]
	const sources = [...(indexEntry?.sources || [])]
	if (item.source && !sources.some((s) => s.type === item.source.type && s.id === item.source.id)) {
		sources.push(item.source)
	}

	setState({
		...state,
		queue: state.queue.filter((q) => q.songId !== songId),
		index: {
			...state.index,
			[songId]: { meta: item.meta, size, date: Date.now(), sources, file: item.fileKey },
		},
	})
	await saveDownloads()
	activeDownloads = Math.max(0, activeDownloads - 1)
	startNext()
}

const finishError = async (songId, error) => {
	speedIds.delete(songId)
	lastBytes.delete(songId)
	setState({
		...state,
		queue: state.queue.map((q) => q.songId === songId ? { ...q, status: 'error', error, resumable: null } : q),
	})
	await saveDownloads()
	activeDownloads = Math.max(0, activeDownloads - 1)
	startNext()
}

const startNext = () => {
	const max = maxConcurrent()
	while (activeDownloads < max) {
		const item = state.queue.find((q) => q.status === 'queued')
		if (!item) break
		activeDownloads++
		runDownload(item)
	}
}

// ---------------------------------------------------------------------------
// Queue controls
// ---------------------------------------------------------------------------
export const pauseDownload = async (songId) => {
	const item = state.queue.find((q) => q.songId === songId)
	if (!item || !item.resumable) return
	try {
		const pauseState = await item.resumable.pauseAsync()
		setState({
			...state,
			queue: state.queue.map((q) => q.songId === songId ? { ...q, status: 'paused', resumeData: pauseState?.resumeData || null, resumable: null } : q),
		})
		speedIds.delete(songId)
		await saveDownloads()
		activeDownloads = Math.max(0, activeDownloads - 1)
		startNext()
	} catch (error) {
		logger.error('downloadManager', 'Pause failed', error)
	}
}

export const resumeDownload = async (songId) => {
	setState({
		...state,
		queue: state.queue.map((q) => q.songId === songId ? { ...q, status: 'queued' } : q),
	})
	await saveDownloads()
	startNext()
}

export const retryDownload = async (songId) => {
	await resumeDownload(songId)
}

export const cancelDownload = async (songId) => {
	const item = state.queue.find((q) => q.songId === songId)
	const wasActive = !!item?.resumable
	if (item?.resumable) {
		await item.resumable.cancelAsync().catch(() => { })
	}
	if (item) await FileSystem.deleteAsync(item.partUri).catch(() => { })
	speedIds.delete(songId)
	lastBytes.delete(songId)
	setState({ ...state, queue: state.queue.filter((q) => q.songId !== songId) })
	await saveDownloads()
	if (wasActive) activeDownloads = Math.max(0, activeDownloads - 1)
	startNext()
}

export const cancelCollection = async (source) => {
	const songs = state.queue
		.filter((q) => q.source && q.source.type === source.type && q.source.id === source.id)
		.map((q) => q.songId)
	for (const songId of songs) {
		await cancelDownload(songId)
	}
}

export const resumeCollection = async (source) => {
	state.queue
		.filter((q) => q.source && q.source.type === source.type && q.source.id === source.id && (q.status === 'paused' || q.status === 'error'))
		.forEach((q) => resumeDownload(q.songId))
}

// ---------------------------------------------------------------------------
// Removal
// ---------------------------------------------------------------------------
// Resolve the actual file of an index entry. New entries carry the key they were written
// with, so changing the format/bitrate later cannot orphan them; old entries fall back to
// today's key.
const entryFileUri = (songId, entry) => entry?.file
	? `${getSongsDir()}${entry.file}`
	: getPathSong(songId, global.streamFormat, global.maxBitRate)

export const removeSong = async (songId) => {
	if (state.queue.some((q) => q.songId === songId)) await cancelDownload(songId)
	await FileSystem.deleteAsync(entryFileUri(songId, state.index[songId]), { idempotent: true }).catch(() => { })
	const rest = { ...state.index }
	delete rest[songId]
	setState({ ...state, index: rest })
	await saveDownloads()
}

// Detach one source from a set of songs. The file is deleted only when no source is left,
// so a song shared by two downloaded collections survives the removal of one of them.
const buildDetachedIndex = async (source, songIds) => {
	const ids = songIds instanceof Set ? songIds : new Set(songIds)
	const nextIndex = { ...state.index }
	let changed = false
	for (const songId of ids) {
		const entry = nextIndex[songId]
		if (!entry) continue
		const sources = (entry.sources || []).filter((s) => !(s.type === source.type && s.id === source.id))
		if (sources.length === (entry.sources || []).length) continue
		changed = true
		if (sources.length === 0) {
			await FileSystem.deleteAsync(entryFileUri(songId, entry), { idempotent: true }).catch(() => { })
			delete nextIndex[songId]
		} else {
			nextIndex[songId] = { ...entry, sources }
		}
	}
	return { index: nextIndex, changed }
}

export const removeSource = async (source) => {
	await cancelCollection(source)
	const ids = Object.entries(state.index)
		.filter(([, entry]) => (entry.sources || []).some((s) => s.type === source.type && s.id === source.id))
		.map(([songId]) => songId)
	const { index } = await buildDetachedIndex(source, ids)
	const restCollections = { ...state.collections }
	delete restCollections[sourceKey(source)]
	setState({ ...state, index, collections: restCollections })
	await saveDownloads()
}

// Bring a downloaded collection in line with its current server list: add missing songs,
// detach removed ones (files survive while another source references them), and rewrite
// the stored order/metadata. Manual only; never called from a background loop.
export const syncCollection = async ({ type, id, name, artist = '', cover = null, songs = [] }) => {
	const key = `${type}:${id}`
	const existing = state.collections[key]
	if (!existing) {
		await enqueueCollection({ type, id, name, artist, cover, songs })
		return
	}

	const { toAdd, toRemove, ids } = collectionDiff(songs, existing)
	if (toAdd.length > 0) await enqueueCollection({ type, id, name, artist, cover, songs: toAdd })

	// A removed song may still be waiting in the download queue; cancel it only when this
	// collection owns the queue item (a shared queue item belongs to another source).
	for (const songId of toRemove) {
		const item = queueById.get(songId)
		if (item?.source?.type === type && item.source.id === id) await cancelDownload(songId)
	}

	const index = toRemove.length > 0
		? (await buildDetachedIndex({ type, id, name }, toRemove)).index
		: state.index

	const collections = { ...state.collections }
	const current = collections[key] || existing
	if (ids.length === 0) {
		delete collections[key]
	} else {
		collections[key] = {
			...current,
			songIds: ids,
			name: name || current.name,
			artist: artist || current.artist,
			cover: cover || current.cover,
		}
	}
	setState({ ...state, index, collections })
	await saveDownloads()
}

export const clearAllDownloads = async () => {
	for (const item of state.queue) {
		if (item.resumable) await item.resumable.cancelAsync().catch(() => { })
		if (item.partUri) await FileSystem.deleteAsync(item.partUri).catch(() => { })
	}
	// Wipe the whole songs folder: after the auto-cache purge it only contains downloads,
	// and this also clears any orphan left behind by a failed removal.
	await FileSystem.deleteAsync(getSongsDir(), { idempotent: true }).catch(() => { })
	coverQueue.length = 0
	localCovers.clear()
	await FileSystem.deleteAsync(COVERS_DIR, { idempotent: true }).catch(() => { })
	speedIds.clear()
	lastBytes.clear()
	setState({ queue: [], index: {}, collections: {} })
	await saveDownloads()
	activeDownloads = 0
}

// ---------------------------------------------------------------------------
// Derived state
// ---------------------------------------------------------------------------
// expectedIds (optional) is the fresh server list: when it differs from the stored
// snapshot the caller can offer a sync. `changed` is false without it (offline fallback).
export const getCollectionState = (source, expectedIds = null) => {
	if (!source) return { status: 'none', progress: 0, completedSongs: 0, totalSongs: 0, changed: false }
	const key = `${source.type}:${source.id}`
	const queueItems = state.queue.filter((q) => q.source && q.source.type === source.type && q.source.id === source.id)
	const collection = state.collections[key]
	const totalSongs = collection?.songIds?.length || queueItems.length
	const completedSongs = songIdsBySource.get(key)?.size || 0

	// An empty expected list is indistinguishable from "still loading" (screens start with
	// []), so it never triggers a sync — syncing on it would detach every song.
	let changed = false
	if (expectedIds?.length && collection) {
		const expected = new Set(expectedIds)
		const stored = new Set(collection.songIds || [])
		changed = expected.size !== stored.size || [...expected].some((id) => !stored.has(id))
	}

	const base = { progress: 0, completedSongs, totalSongs, changed }
	if (queueItems.some((q) => q.status === 'downloading')) return { ...base, status: 'downloading', progress: queueItems.reduce((a, q) => a + q.progress, 0) / (queueItems.length || 1) }
	if (queueItems.some((q) => q.status === 'paused')) return { ...base, status: 'paused' }
	if (queueItems.some((q) => q.status === 'queued')) return { ...base, status: 'queued' }
	if (queueItems.some((q) => q.status === 'error')) return { ...base, status: 'error' }
	if (completedSongs > 0 && totalSongs > 0 && completedSongs < totalSongs) return { ...base, status: 'partial', progress: completedSongs / totalSongs }
	if (completedSongs > 0) return { ...base, status: 'done', progress: 1 }
	return { ...base, status: 'none', progress: 0, completedSongs: 0, totalSongs }
}

export const getDownloadedSongs = () => {
	const list = Object.entries(state.index).map(([songId, entry]) => ({
		songId,
		meta: entry.meta,
		size: entry.size,
		date: entry.date,
		sources: entry.sources,
	}))
	return list.sort((a, b) => b.date - a.date)
}

export const getSongState = (songId) => {
	const queueItem = queueById.get(songId)
	if (queueItem) {
		if (queueItem.silent) return state.index[songId] ? { status: 'done', progress: 1 } : { status: 'none', progress: 0 }
		if (queueItem.status === 'downloading') return { status: 'downloading', progress: queueItem.progress }
		return { status: queueItem.status, progress: 0 }
	}
	if (state.index[songId]?.size > 0) return { status: 'done', progress: 1 }
	return { status: 'none', progress: 0 }
}

// ---------------------------------------------------------------------------
// Offline library selectors (single source of truth for "on this device")
// ---------------------------------------------------------------------------
// Keep downloaded songs' favourite flag in step with the getStarred2 cache. Only entries
// whose value actually changed are rewritten.
export const syncLocalStarred = (starredIds) => {
	const starred = starredIds instanceof Set ? starredIds : new Set(starredIds || [])
	const index = { ...state.index }
	let changed = false
	for (const [songId, entry] of Object.entries(index)) {
		const next = starred.has(songId)
		if (!!entry.meta?.starred !== next) {
			index[songId] = { ...entry, meta: { ...entry.meta, starred: next } }
			changed = true
		}
	}
	if (!changed) return
	setState({ ...state, index })
	return saveDownloads()
}

export const isSongLocal = (songId) => !!(state.index[songId]?.size > 0)

export const getLocalSongUri = (songId) => {
	const entry = state.index[songId]
	return entry?.size > 0 ? entryFileUri(songId, entry) : null
}

export const getLocalSongs = () => offlineSongs(state)

export const getLocalCollections = (type) => offlineCollections(state, type)

export const getLocalCollectionSongs = (type, id) => offlineCollectionSongs(state, type, id)

export const getLocalStats = () => {
	const entries = Object.values(state.index)
	return {
		count: entries.length,
		size: entries.reduce((total, entry) => total + (entry.size || 0), 0),
	}
}
