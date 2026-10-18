import { getLocalCoverUri } from '~/utils/downloadManager'
import { getIsOffline } from '~/utils/offline'

const getUrl = (config, path, query = '') => {
	const encodedQuery = Object.keys(query).map((key) => `${key}=${encodeURIComponent(query[key])}`).join('&')
	return `${config.url}/rest/${path}?${encodedQuery}&${config.query}`
}

const realCover = (config, id, size = null) => {
	if (!id) return null
	if (!size) {
		return getUrl(config, 'getCoverArt', { id })
	}
	return getUrl(config, 'getCoverArt', { id, size })
}

// The `id` carried by a getCoverArt URL. The download manager names cached cover files after
// it, so an offline lookup can find the artwork without re-deriving the id from the item.
export const coverIdFromUrl = (url) => {
	if (typeof url !== 'string') return null
	const match = /[?&]id=([^&]+)/.exec(url)
	return match ? decodeURIComponent(match[1]) : null
}

// Offline there is no server to ask: prefer the cover file downloaded alongside the songs
// (named after its getCoverArt id). A miss falls through to the server URL, which fails to
// load and lets ImageError show the placeholder — same as before the cache existed.
const offlineCover = (coverId) => (coverId && getIsOffline() ? getLocalCoverUri(coverId) : null)

// Why the id choice matters (navidrome vs generic Subsonic servers): kept in one place
// because the offline cover cache names its files after exactly this id, and the palette
// extractor looks up those files — a drift here would silently break offline artwork.
export const coverIdOf = (config, item) => {
	if (!item) return null
	const navidromeLike = ['navidrome', 'ampache'].includes(config?.type) || !config?.type
	if (['artist', 'album', 'playlist'].includes(item.mediaType)) {
		return navidromeLike ? item.id || item.coverArt : item.coverArt || item.id
	}
	if (item.mediaType === 'song') {
		return navidromeLike ? item.albumId || item.coverArt : item.coverArt || item.albumId || item.id
	}
	return navidromeLike ? item.albumId || item.id || item.coverArt : item.coverArt || item.albumId || item.id
}

export const urlCover = (config, id, size = null) => {
	if (!id) return null
	if (!config?.url || !config?.query) return null
	if (typeof id === 'object') {
		const item = id

		if (item.id === 'tuktuktuk') return 'https://github.com/sawyerf/Castafiore/blob/main/assets/icon.png?raw=true'
		if (item.homePageUrl && item.homePageUrl.startsWith('http')) {
			return item.homePageUrl + '/favicon.ico'
		}
		const coverId = coverIdOf(config, item)
		return offlineCover(coverId) || realCover(config, coverId, size)
	} else {
		if (id.startsWith('http://') || id.startsWith('https://')) return id
		return offlineCover(id) || realCover(config, id, size)
	}
}

export const urlStream = (config, id, format = 'raw', maxBitRate = 0) => {
	if (id === 'tuktuktuk') return 'https://sawyerf.github.io/tuktuktuk.mp3' 
	if (!id.match(/^[a-zA-Z0-9-]*$/)) return id
	if (format === 'raw') return getUrl(config, 'stream', { id })
	return getUrl(config, 'stream', { id, format, maxBitRate })
}
