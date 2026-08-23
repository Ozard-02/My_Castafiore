import { getApiCacheFirst } from '~/utils/api'
import { addToUpNext, playSong } from '~/utils/player'
import logger from '~/utils/logger'

// Swipe/menu helper for album rows: queue the whole album (or play it when no queue is active)
export const addAlbumToQueue = async (config, songDispatch, albumId, asNext = false) => {
	try {
		const json = await getApiCacheFirst(config, 'getAlbum', { id: albumId })
		const songs = json?.album?.song
		if (!songs?.length) return
		if (asNext && global.song?.queue?.length) addToUpNext(songDispatch, songs, true)
		else playSong(config, songDispatch, songs, 0)
	} catch (error) {
		logger.error('albumActions', 'Error queueing album:', error)
	}
}
