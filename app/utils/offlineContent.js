// Offline browsing is built on the persisted download data:
//   index[songId] = { meta, size, date, sources: [{ type, id, name }] }
//   collections   = { 'type:id': { type, id, name, artist, cover, songIds, createdAt } }
// These helpers turn that into song/collection shaped objects the normal item components
// can render. Purely local, no API involved.

const isDownloaded = (entry) => !!entry && entry.size > 0

const entryToSong = (songId, entry) => ({
	id: songId,
	title: entry?.meta?.title || '',
	artist: entry?.meta?.artist || '',
	album: entry?.meta?.album || '',
	duration: entry?.meta?.duration,
	albumId: entry?.meta?.albumId,
	artistId: entry?.meta?.artistId,
	coverArt: entry?.meta?.coverArt,
	track: entry?.meta?.track,
	mediaType: 'song',
})

const collectionSongs = (index, type, id) => Object.entries(index)
	.filter(([, entry]) => isDownloaded(entry) && (entry.sources || []).some((source) => source.type === type && source.id === id))
	.map(([songId]) => songId)

export const offlineSongs = (downloads) => {
	const index = downloads?.index || {}
	return Object.entries(index)
		.filter(([, entry]) => isDownloaded(entry))
		.sort((a, b) => (b[1].date || 0) - (a[1].date || 0))
		.map(([songId, entry]) => entryToSong(songId, entry))
}

// Collections with at least one completed song, newest first. songCount is recomputed from
// the index so a partially downloaded collection shows what it can actually play.
export const offlineCollections = (downloads, type) => {
	const index = downloads?.index || {}
	const collections = downloads?.collections || {}
	return Object.values(collections)
		.filter((collection) => collection.type === type)
		.map((collection) => ({ ...collection, songCount: collectionSongs(index, type, collection.id).length }))
		.filter((collection) => collection.songCount > 0)
		.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
}

// Song list for one collection without any API/cache: used by the Album/Playlist screens
// when offline and the fetched cache has nothing for them.
export const offlineCollectionSongs = (downloads, type, id) => {
	const index = downloads?.index || {}
	return collectionSongs(index, type, id).map((songId) => entryToSong(songId, index[songId]))
}

export const isSongDownloaded = (downloads, songId) => isDownloaded(downloads?.index?.[songId])
