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

// Song Cache
export const isSongCached = async (_config, songId, streamFormat, _maxBitrate) => {
	return global.listCacheSong?.includes(`${songId}.${streamFormat}`) ? true : false
}

export const getSongCachedInfo = async (_config, songId, streamFormat, _maxBitrate) => {
	const pathSong = getPathSong(songId, streamFormat)

	return await FileSystem.getInfoAsync(pathSong)
		.then(info => {
			return [
				{ title: 'File', value: `${songId}.${streamFormat}` },
				{ title: 'Is cached', value: info.exists ? 'Yes' : 'No' },
				{ title: 'Size', value: `${(info.size / (1024 * 1024)).toFixed(2)} MB` },
				{ title: 'Modified', value: new Date(info.modificationTime).toLocaleString() },
			]
		})
		.catch(() => null)
}

export const deleteSongCache = async (_config, songId, streamFormat, _maxBitrate) => {
	const pathSong = getPathSong(songId, streamFormat)
	return await FileSystem.deleteAsync(pathSong)
		.then(() => {
			global.listCacheSong = global.listCacheSong.filter(file => file !== `${songId}.${streamFormat}`)
		})
		.catch(() => { })
}

export const getListCacheSong = async () => {
	return await FileSystem.readDirectoryAsync(getPathDir())
		.catch(() => [])
}

export const getPathSong = (songId, streamFormat) => {
	return `${getPathDir()}${songId}.${streamFormat}`
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
