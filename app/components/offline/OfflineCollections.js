import React from 'react'
import { Text, View, Pressable } from 'react-native'
import { LegendList } from '@legendapp/list'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'

import { useConfig } from '~/contexts/config'
import { useTheme } from '~/contexts/theme'
import { urlCover } from '~/utils/url'
import { useDownloads } from '~/utils/downloadManager'
import { offlineCollections } from '~/utils/offlineContent'
import ImageError from '~/components/ImageError'
import AllItem from '~/components/item/AllItem'
import mainStyles from '~/styles/main'
import size from '~/styles/size'

// One downloaded album/playlist row; also used by OfflineSearch.
export const OfflineCollectionRow = ({ collection, type }) => {
	const { t } = useTranslation()
	const config = useConfig()
	const theme = useTheme()
	const navigation = useNavigation()

	return (
		<Pressable
			style={({ pressed }) => ([mainStyles.opacity({ pressed }), {
				flexDirection: 'row',
				alignItems: 'center',
				gap: 12,
				paddingHorizontal: 20,
				paddingVertical: 6,
			}])}
			onPress={() => {
				if (type === 'album') navigation.navigate('Album', collection)
				else navigation.navigate('Playlist', { playlist: collection })
			}}
		>
			<ImageError
				style={{ width: 60, height: 60, borderRadius: size.radius.standard, backgroundColor: theme.secondaryBack }}
				source={{ uri: urlCover(config, collection, 100) }}
				iconError="music"
			/>
			<View style={{ flex: 1 }}>
				<Text style={mainStyles.mediumText(theme.primaryText)} numberOfLines={1}>{collection.name}</Text>
				<Text style={mainStyles.smallText(theme.secondaryText)} numberOfLines={1}>
					{collection.artist || `${collection.songCount} ${t('songs')}`}
				</Text>
			</View>
		</Pressable>
	)
}

// Grid/list of downloaded albums or playlists (Tracks "albums" view, Playlists tab):
// straight from the download collections, tapping opens the Pres screen, whose offline
// fallback fills the songs from the download index when nothing is cached.
const OfflineCollections = ({ type = 'album', layout = 'list', ListHeaderComponent = null, ListFooterComponent = null }) => {
	const { t } = useTranslation()
	const insets = useSafeAreaInsets()
	const theme = useTheme()
	const navigation = useNavigation()
	const downloads = useDownloads()
	const collections = React.useMemo(() => offlineCollections(downloads, type), [downloads, type])

	const empty = (
		<View style={{ paddingVertical: 30, alignItems: 'center' }}>
			<Text style={{ color: theme.secondaryText, fontSize: size.text.medium }}>{t('No downloaded content')}</Text>
		</View>
	)

	const renderItem = React.useCallback(({ item }) => {
		if (layout === 'grid') return <AllItem item={item} type={type} onPress={() => navigation.navigate(type === 'album' ? 'Album' : 'Playlist', type === 'album' ? item : { playlist: item })} />
		return <OfflineCollectionRow collection={item} type={type} />
	}, [layout, type, navigation])

	return (
		<LegendList
			data={collections}
			numColumns={layout === 'grid' ? 2 : 1}
			keyExtractor={(item) => `${type}:${item.id}`}
			style={mainStyles.mainContainer(theme)}
			contentContainerStyle={[mainStyles.contentMainContainer(insets, false), { paddingTop: 0, minHeight: layout === 'grid' ? Math.ceil(collections.length / 2) * 230 + 100 : undefined }]}
			waitForInitialLayout={false}
			recycleItems={true}
			estimatedItemSize={layout === 'grid' ? 230 : 70}
			ListHeaderComponent={ListHeaderComponent}
			ListFooterComponent={ListFooterComponent}
			ListEmptyComponent={empty}
			renderItem={renderItem}
		/>
	)
}

export default OfflineCollections
