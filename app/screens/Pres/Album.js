import React from 'react'
import { ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useConfig } from '~/contexts/config'
import { useCachedAndApi } from '~/utils/api'
import { useTheme } from '~/contexts/theme'
import { urlCover } from '~/utils/url'
import { useOffline } from '~/utils/offline'
import { useDownloads } from '~/utils/downloadManager'
import { offlineCollectionSongs } from '~/utils/offlineContent'
import FavoritedButton from '~/components/button/FavoritedButton'
import mainStyles from '~/styles/main'
import presStyles from '~/styles/pres'
import RandomButton from '~/components/button/RandomButton'
import DownloadButton from '~/components/button/DownloadButton'
import SongsList from '~/components/lists/SongsList'
import size from '~/styles/size'
import PresHeader from '~/components/PresHeader'
import OptionsMultiArtists from '~/components/options/OptionsMultiArtists'
import OptionsAlbum from '~/components/options/OptionsAlbum'

const Album = ({ navigation, route: { params } }) => {
	const insets = useSafeAreaInsets()
	const config = useConfig()
	const theme = useTheme()
	const [isStarred, setStarred] = React.useState(params.starred || false)
	const [album, setAlbum] = React.useState(null)
	const [isOptArtists, setIsOptArtists] = React.useState(false)
	const [isOptAlbum, setIsOptAlbum] = React.useState(false)
	const offline = useOffline()
	const downloads = useDownloads()

	const [songs] = useCachedAndApi([], 'getAlbum', { id: params.id }, (json, setData) => {
		setStarred(json?.album?.starred)
		setAlbum(json?.album)
		setData(json?.album?.song.sort((a, b) => {
			// sort by discNumber and track
			if (a.discNumber < b.discNumber) return -1
			if (a.discNumber > b.discNumber) return 1
			if (a.track < b.track) return -1
			if (a.track > b.track) return 1
			return 0
		}))
	}, [params.id])

	// offline, a downloaded album that was never fetched (long-press download, cache
	// evicted) would open empty: rebuild its songs from the download index instead
	const list = React.useMemo(() => {
		if (songs.length || !offline) return songs
		return offlineCollectionSongs(downloads, 'album', params.id)
	}, [songs, offline, downloads, params.id])

	return (
		<ScrollView
			vertical={true}
			style={mainStyles.mainContainer(theme)}
			contentContainerStyle={mainStyles.contentMainContainer(insets, false)}>
			<PresHeader
				title={album?.name || album?.album || album?.title || params.name || params.album || params.title}
				subTitle={album?.artist || params.artist || '-'}
				imgSrc={urlCover(config, params)}
				onPressOption={() => setIsOptAlbum(true)}
				onPressTitle={() => {
					if (album?.artists?.length > 1) setIsOptArtists(true)
					else if (album?.artistId && album?.artist) navigation.navigate('Artist', { id: album?.artistId, name: album?.artist })
					else if (params.artistId && params.artist) navigation.navigate('Artist', { id: params.artistId, name: params.artist })
				}}
			>
				<FavoritedButton id={params.id} isFavorited={isStarred} style={[presStyles.button, { paddingEnd: 0 }]} size={size.icon.medium} />
				<RandomButton songList={list} size={size.icon.medium} />
				<DownloadButton
					type="album"
					id={album?.id || params.id}
					name={album?.name || album?.album || album?.title || params.name || params.album || params.title}
					artist={album?.artist || params.artist || '-'}
					cover={urlCover(config, album || params)}
					songs={list}
					size={size.icon.medium}
					style={presStyles.button}
				/>
			</PresHeader>
			<OptionsAlbum
				album={album || params}
				isOpen={isOptAlbum}
				onClose={() => setIsOptAlbum(false)}
			/>
			<OptionsMultiArtists
				artists={album?.artists || params.artists}
				close={() => setIsOptArtists(false)}
				visible={isOptArtists}
			/>
			<SongsList songs={list} isIndex={true} />
		</ScrollView>
	)
}

export default Album