import AsyncStorage from '@react-native-async-storage/async-storage'
import * as FileSystem from 'expo-file-system'
import logger from '~/utils/logger'

// API Cache
export const getJsonCache = async (_cacheName, key) => {
	const json = await AsyncStorage.getItem(key)
	return json ? JSON.parse(json) : null
}

export const setJsonCache = async (_cacheName, key, json) => {
	if (!json) return
	await AsyncStorage.setItem(key, JSON.stringify(json))
}

// Identity of a cached song file.
//
// The bitrate belongs here because the bytes depend on it — but ONLY for an explicit stream
// format. `urlStream` returns a plain `stream?id=X` for 'raw', letting the server pick, so the
// bitrate setting changes nothing about the file. Keying on it anyway would re-download the
// entire library, byte for byte, every time the slider moved. 'raw' is the default, so the
// common case keeps today's exact filenames and needs no migration.
//
// The server is deliberately NOT part of the key: the two configured servers are the same
// library behind two addresses, so the bytes are interchangeable and re-fetching on every
// WiFi/cellular change would be a data-usage disaster.
export const songCacheKey = (songId, streamFormat, maxBitRate = 0) => {
	if (streamFormat !== 'raw' && maxBitRate > 0) return `${songId}.${streamFormat}-${maxBitRate}`
	return `${songId}.${streamFormat}`
}

// A cached file is one we could have written: `<id>.<format>` or `<id>.<format>-<bitrate>`,
// ignoring the in-progress `.part` siblings. Anything else is an orphan from an older layout
// and can be pruned.
const isCacheKey = (file) => /^[A-Za-z0-9._-]+\.[a-z0-9]+(-\d+)?$/i.test(file) && !file.endsWith('.part')

// Song Cache
export const isSongCached = async (_config, songId, streamFormat, maxBitRate = 0) => {
	return global.listCacheSong?.includes(songCacheKey(songId, streamFormat, maxBitRate)) ? true : false
}

export const getSongCachedInfo = async (_config, songId, streamFormat, maxBitRate = 0) => {
	const key = songCacheKey(songId, streamFormat, maxBitRate)
	const pathSong = getPathSong(songId, streamFormat, maxBitRate)

	return await FileSystem.getInfoAsync(pathSong)
		.then(info => {
			return [
				{ title: 'File', value: key },
				{ title: 'Is cached', value: info.exists ? 'Yes' : 'No' },
				{ title: 'Size', value: `${(info.size / (1024 * 1024)).toFixed(2)} MB` },
				{ title: 'Modified', value: new Date(info.modificationTime).toLocaleString() },
			]
		})
		.catch(() => null)
}

export const deleteSongCache = async (_config, songId, streamFormat, maxBitRate = 0) => {
	const key = songCacheKey(songId, streamFormat, maxBitRate)
	const pathSong = getPathSong(songId, streamFormat, maxBitRate)
	return await FileSystem.deleteAsync(pathSong)
		.then(() => {
			global.listCacheSong = global.listCacheSong.filter(file => file !== key)
		})
		.catch(() => { })
}

export const getListCacheSong = async () => {
	return await FileSystem.readDirectoryAsync(getPathDir())
		.catch(() => [])
}

export const getPathSong = (songId, streamFormat, maxBitRate = 0) => {
	return `${getPathDir()}${songCacheKey(songId, streamFormat, maxBitRate)}`
}


const getPathDir = () => {
	return `${FileSystem.documentDirectory}/cache/songs/`
}

export const initCacheSong = async () => {
	// Old versions kept one cache folder per server (and one accidental 'undefined' folder).
	// Songs are now shared across servers (same library → same ids), so consolidate them.
	const cacheRoot = `${FileSystem.documentDirectory}/cache/`
	const sharedDir = getPathDir()
	await FileSystem.makeDirectoryAsync(sharedDir, { intermediates: true })
		.catch(error => {
			logger.error('initCacheSong', error)
		})
	const folders = await FileSystem.readDirectoryAsync(cacheRoot)
		.catch(() => [])
	for (const folder of folders) {
		if (folder === 'songs') continue
		const oldSongs = `${cacheRoot}${folder}/songs/`
		const info = await FileSystem.getInfoAsync(oldSongs)
		if (!info.exists || !info.isDirectory) continue
		const files = await FileSystem.readDirectoryAsync(oldSongs)
			.catch(() => [])
		for (const file of files) {
			await FileSystem.moveAsync({ from: `${oldSongs}${file}`, to: `${sharedDir}${file}` })
				.catch((error) => logger.error('initCacheSong', error))
		}
	}

	// Drop leftovers we can no longer attribute: .part files from an interrupted download
	// and names from the pre-bitrate layout. Anything not matching the songCacheKey shape is
	// dead weight — the bitrate suffix is only reachable through songCacheKey.
	const files = await getListCacheSong()
	for (const file of files) {
		if (isCacheKey(file)) continue
		await FileSystem.deleteAsync(`${sharedDir}${file}`, { idempotent: true })
			.catch((error) => logger.error('initCacheSong', `prune ${file}:`, error))
	}

	global.listCacheSong = await getListCacheSong() || []
}

// Cache Settings
export const clearCache = async () => {
	await AsyncStorage.multiRemove(
		await AsyncStorage.getAllKeys()
			.then(keys => keys.filter(key => key.startsWith('http')))
			.catch(() => [])
	)
}

export const getStatCache = async () => {
	return [
		{
			name: 'Cache Api',
			count: await AsyncStorage.getAllKeys()
				.then(keys => keys.filter(key => key.startsWith('http')).length)
				.catch(() => 0)
		},
		{
			name: 'Cache Songs',
			count: await getListCacheSong()
				.then(files => files.length)
				.catch(() => 0)
		},
		{
			name: 'Cache Songs Size',
			count: await FileSystem.getInfoAsync(getPathDir())
				.then(info => `${(info.size / (1024 * 1024)) | 0 || 0} MB`)
				.catch(() => '0.00')
		},
	]
}
