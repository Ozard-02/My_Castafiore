import AsyncStorage from '@react-native-async-storage/async-storage'
import { getApi } from '~/utils/api'
import logger from '~/utils/logger'

// ponytail: set refreshes only when a playlist is toggled — server-side edits
// won't propagate until then. Add a TTL/background sync if that ever matters.

const exclusiveTag = (username) => `#${username}-exclusive`
const storageKey = (config) => `excludedSongs:${config.folderCache}`

const memory = {}

const fetchExcludedIds = async (config) => {
	const ids = new Set()
	if (!config?.username) return ids
	try {
		const tag = exclusiveTag(config.username)
		const json = await getApi(config, 'getPlaylists')
		const playlists = (json?.playlists?.playlist || []).filter((playlist) => playlist.comment?.includes(tag))
		await Promise.all(playlists.map(async (playlist) => {
			try {
				const pj = await getApi(config, 'getPlaylist', { id: playlist.id })
				const entries = pj?.playlist?.entry || []
				entries.forEach((song) => ids.add(song.id))
			} catch (error) {
				logger.error('exclusions', 'Error fetching playlist songs:', error)
			}
		}))
	} catch (error) {
		logger.error('exclusions', 'Error fetching excluded playlists:', error)
	}
	return ids
}

export const getExcludedSongIds = async (config) => {
	if (!config?.folderCache) return new Set()
	if (memory[config.folderCache]) return memory[config.folderCache]
	let ids = new Set()
	try {
		const raw = await AsyncStorage.getItem(storageKey(config))
		if (raw) ids = new Set(JSON.parse(raw))
	} catch (error) {
		logger.error('exclusions', 'Error reading exclusions:', error)
	}
	memory[config.folderCache] = ids
	return ids
}

export const refreshExcludedSongIds = async (config) => {
	if (!config?.folderCache) return new Set()
	const ids = await fetchExcludedIds(config)
	memory[config.folderCache] = ids
	try {
		await AsyncStorage.setItem(storageKey(config), JSON.stringify([...ids]))
	} catch (error) {
		logger.error('exclusions', 'Error saving exclusions:', error)
	}
	return ids
}

export const invalidateExclusions = (config) => {
	delete memory[config?.folderCache]
}

export const isPlaylistExclusive = (config, playlist) => {
	return !!playlist?.comment?.includes(exclusiveTag(config?.username))
}

export const filterExcluded = async (config, songs) => {
	if (!songs?.length) return []
	const excluded = await getExcludedSongIds(config)
	if (!excluded.size) return songs
	return songs.filter((song) => !excluded.has(song.id))
}
