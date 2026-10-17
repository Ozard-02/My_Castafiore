import React from 'react'
import { Text, View, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'

import { useTheme } from '~/contexts/theme'
import { useDownloads } from '~/utils/downloadManager'
import { offlineSongs, offlineCollections } from '~/utils/offlineContent'
import { OfflineCollectionRow } from '~/components/offline/OfflineCollections'
import SectionTitle from '~/components/SectionTitle'
import SongsList from '~/components/lists/SongsList'
import mainStyles from '~/styles/main'
import size from '~/styles/size'

// Search while offline: a plain case-insensitive filter over the downloaded songs,
// albums and playlists. No debounce and no network — it is all local.
const OfflineSearch = ({ query }) => {
	const { t } = useTranslation()
	const insets = useSafeAreaInsets()
	const theme = useTheme()
	const downloads = useDownloads()
	const songs = React.useMemo(() => offlineSongs(downloads), [downloads])
	const albums = React.useMemo(() => offlineCollections(downloads, 'album'), [downloads])
	const playlists = React.useMemo(() => offlineCollections(downloads, 'playlist'), [downloads])

	const q = query.trim().toLowerCase()
	const match = (...fields) => fields.some((field) => (field || '').toLowerCase().includes(q))
	const songHits = songs.filter((item) => match(item.title, item.artist, item.album))
	const albumHits = albums.filter((item) => match(item.name, item.artist))
	const playlistHits = playlists.filter((item) => match(item.name, item.artist))
	const isEmpty = !songHits.length && !albumHits.length && !playlistHits.length

	return (
		<ScrollView
			style={mainStyles.mainContainer(theme)}
			contentContainerStyle={[mainStyles.contentMainContainer(insets, false), { paddingTop: 0 }]}>
			{isEmpty && (
				<View style={{ paddingVertical: 30, alignItems: 'center' }}>
					<Text style={{ color: theme.secondaryText, fontSize: size.text.medium }}>{t('No results')}</Text>
				</View>
			)}
			{albumHits.length > 0 && <SectionTitle title={t('Albums')} />}
			{albumHits.map((item) => <OfflineCollectionRow key={`album:${item.id}`} collection={item} type="album" />)}
			{playlistHits.length > 0 && <SectionTitle title={t('Playlists')} />}
			{playlistHits.map((item) => <OfflineCollectionRow key={`playlist:${item.id}`} collection={item} type="playlist" />)}
			{songHits.length > 0 && <SectionTitle title={t('Songs')} />}
			<SongsList songs={songHits} isMargin={false} />
		</ScrollView>
	)
}

export default OfflineSearch
