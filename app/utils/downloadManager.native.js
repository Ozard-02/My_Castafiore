import AsyncStorage from '@react-native-async-storage/async-storage'
import * as FileSystem from 'expo-file-system'
import { useSyncExternalStore } from 'react'

import { urlStream, urlCover } from '~/utils/url'
import { getPathSong } from '~/utils/cache'
import logger from '~/utils/logger'

const WINDOW_MS = 10_000

const listeners = new Set()
let state = { queue: [], index: {}, collections: {} }
let queueById = new Map()
let isProcessing = false

const getKeys = () => {
	const folder = global.config?.folderCache || 'default'
	return {
		queue: `downloadQueue:${folder}`,
		index: `downloadIndex:${folder}`,
		collections: `downloadCollections:${folder}`,
	}
}

const notify = () => {
	listeners.forEach((listener) => listener())
}

const setState = (next) => {
	state = next
	queueById = new Map(next.queue.map((q) => [q.songId, q]))
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

export const initDownloads = async () => {
	const keys = getKeys()
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
		queueById = new Map(queue.map((q) => [q.songId, q]))
		notify()
	} catch (error) {
		logger.error('downloadManager', 'Error loading downloads', error)
	}
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
})

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
	return {
		songId: song.id,
		url: songUrl(song),
		partUri: `${getPathSong(song.id, global.streamFormat)}.part`,
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
	const resumable = FileSystem.createDownloadResumable(
		item.url,
		item.partUri,
		{},
		onProgress(item.songId),
		item.resumeData || undefined,
	)
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
		await FileSystem.moveAsync({ from: item.partUri, to: getPathSong(item.songId, global.streamFormat) })
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
			[songId]: { meta: item.meta, size, date: Date.now(), sources },
		},
	})
	if (global.listCacheSong && !global.listCacheSong.includes(`${songId}.${global.streamFormat}`)) {
		global.listCacheSong.push(`${songId}.${global.streamFormat}`)
	}
	await saveDownloads()
	isProcessing = false
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
	isProcessing = false
	startNext()
}

const startNext = () => {
	if (isProcessing) return
	const item = state.queue.find((q) => q.status === 'queued')
	if (!item) return
	isProcessing = true
	runDownload(item)
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
		isProcessing = false
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
	if (item?.resumable) {
		await item.resumable.cancelAsync().catch(() => { })
	}
	if (item) await FileSystem.deleteAsync(item.partUri).catch(() => { })
	speedIds.delete(songId)
	lastBytes.delete(songId)
	setState({ ...state, queue: state.queue.filter((q) => q.songId !== songId) })
	await saveDownloads()
	isProcessing = false
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
export const removeSong = async (songId) => {
	if (state.queue.some((q) => q.songId === songId)) await cancelDownload(songId)
	await FileSystem.deleteAsync(getPathSong(songId, global.streamFormat)).catch(() => { })
	const rest = { ...state.index }
	delete rest[songId]
	setState({ ...state, index: rest })
	if (global.listCacheSong) {
		global.listCacheSong = global.listCacheSong.filter((file) => file !== `${songId}.${global.streamFormat}`)
	}
	await saveDownloads()
}

export const removeSource = async (source) => {
	await cancelCollection(source)
	const index = {}
	for (const [songId, entry] of Object.entries(state.index)) {
		const sources = entry.sources.filter((s) => !(s.type === source.type && s.id === source.id))
		if (sources.length > 0) {
			index[songId] = { ...entry, sources }
		} else {
			await FileSystem.deleteAsync(getPathSong(songId, global.streamFormat)).catch(() => { })
			if (global.listCacheSong) {
				global.listCacheSong = global.listCacheSong.filter((file) => file !== `${songId}.${global.streamFormat}`)
			}
		}
	}
	const restCollections = { ...state.collections }
	delete restCollections[sourceKey(source)]
	setState({ ...state, index, collections: restCollections })
	await saveDownloads()
}

export const clearAllDownloads = async () => {
	for (const item of state.queue) {
		if (item.resumable) await item.resumable.cancelAsync().catch(() => { })
		if (item.partUri) await FileSystem.deleteAsync(item.partUri).catch(() => { })
	}
	for (const songId of Object.keys(state.index)) {
		await FileSystem.deleteAsync(getPathSong(songId, global.streamFormat)).catch(() => { })
	}
	speedIds.clear()
	lastBytes.clear()
	if (global.listCacheSong) global.listCacheSong = []
	setState({ queue: [], index: {}, collections: {} })
	await saveDownloads()
	isProcessing = false
}

// ---------------------------------------------------------------------------
// Derived state
// ---------------------------------------------------------------------------
export const getCollectionState = (source) => {
	if (!source) return { status: 'none', progress: 0, completedSongs: 0, totalSongs: 0 }
	const queueItems = state.queue.filter((q) => q.source && q.source.type === source.type && q.source.id === source.id)
	const totalSongs = state.collections[`${source.type}:${source.id}`]?.songIds?.length || queueItems.length
	let completedSongs = 0
	for (const entry of Object.values(state.index)) {
		if (entry.sources.some((s) => s.type === source.type && s.id === source.id)) completedSongs++
	}
	if (queueItems.some((q) => q.status === 'downloading')) return { status: 'downloading', progress: queueItems.reduce((a, q) => a + q.progress, 0) / (queueItems.length || 1), completedSongs, totalSongs }
	if (queueItems.some((q) => q.status === 'paused')) return { status: 'paused', progress: 0, completedSongs, totalSongs }
	if (queueItems.some((q) => q.status === 'queued')) return { status: 'queued', progress: 0, completedSongs, totalSongs }
	if (queueItems.some((q) => q.status === 'error')) return { status: 'error', progress: 0, completedSongs, totalSongs }
	if (completedSongs > 0 && totalSongs > 0 && completedSongs < totalSongs) return { status: 'partial', progress: completedSongs / totalSongs, completedSongs, totalSongs }
	if (completedSongs > 0) return { status: 'done', progress: 1, completedSongs, totalSongs }
	return { status: 'none', progress: 0, completedSongs: 0, totalSongs }
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
	if (state.index[songId]) return { status: 'done', progress: 1 }
	return { status: 'none', progress: 0 }
}
