import React from 'react'

import { useDownloads } from '~/utils/downloadManager'
import { offlineCollectionSongs, offlineCollections, offlineSongs } from '~/utils/offlineContent'

// Offline screens all ask the same three questions. Keeping the subscription + memo here
// stops every screen from re-deriving them (and from drifting on what "offline" means).

export const useLocalSongs = () => {
	const downloads = useDownloads()
	return React.useMemo(() => offlineSongs(downloads), [downloads])
}

export const useLocalCollections = (type) => {
	const downloads = useDownloads()
	return React.useMemo(() => offlineCollections(downloads, type), [downloads, type])
}

export const useLocalCollectionSongs = (type, id) => {
	const downloads = useDownloads()
	return React.useMemo(() => offlineCollectionSongs(downloads, type, id), [downloads, type, id])
}

// A Pres screen's songs: the fetched list when there is one, otherwise the download index.
export const useCollectionSongs = (type, id, apiSongs, offline) => {
	const downloads = useDownloads()
	return React.useMemo(() => {
		if (apiSongs.length || !offline) return apiSongs
		return offlineCollectionSongs(downloads, type, id)
	}, [apiSongs, offline, downloads, type, id])
}
