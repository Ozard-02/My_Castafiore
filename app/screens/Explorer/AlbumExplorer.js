import React from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { LegendList } from '@legendapp/list'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'

import { useTheme } from '~/contexts/theme'
import { useSongDispatch } from '~/contexts/song'
import { getApiNetworkFirst } from '~/utils/api'
import { useConfig } from '~/contexts/config'
import { addAlbumToQueue } from '~/utils/albumActions'
import PlaylistSwipeRow from '~/components/item/PlaylistSwipeRow'
import mainStyles from '~/styles/main'
import PresHeaderIcon from '~/components/PresHeaderIcon'
import Selector from '~/components/Selector'
import size from '~/styles/size'
import ExplorerItem from '~/components/item/ExplorerItem'
import AllItem from '~/components/item/AllItem'
import OptionsAlbums from '~/components/options/OptionsAlbums'
import logger from '~/utils/logger'

const TYPES = ['newest', 'highest', 'frequent', 'recent', 'starred', 'random', 'alphabeticalByName', 'alphabeticalByArtist']
const PAGE_SIZE = 100

const AlbumExplorer = ({ layout = 'list', showHeader = true, title = null }) => {
	const { t } = useTranslation()
	const insets = useSafeAreaInsets()
	const theme = useTheme()
	const navigation = useNavigation()
	const config = useConfig()
	const songDispatch = useSongDispatch()
	const [albums, setAlbums] = React.useState([])
	const [type, setType] = React.useState('newest')
	const [offset, setOffset] = React.useState(0)
	const [isLoading, setIsLoading] = React.useState(false)
	const [indexOptions, setIndexOptions] = React.useState(-1)

	React.useEffect(() => {
		setIsLoading(true)
		getApiNetworkFirst(config, 'getAlbumList2', { type, size: PAGE_SIZE, offset })
			.then(json => {
				setIsLoading(false)
				const newAlbums = json?.albumList2?.album || []
				if (newAlbums.length === 0) return
				setAlbums(prev => [...prev, ...newAlbums])
			})
			.catch(error => {
				logger.error('AlbumExplorer', 'Error fetching albums:', error)
				setIsLoading(false)
			})
	}, [type, offset])

	// Reset albums when type changes
	React.useEffect(() => {
		setAlbums([])
		setOffset(0)
	}, [type])

	const handleEndReached = () => {
		if (albums.length > 0 && albums.length % PAGE_SIZE === 0) {
			setOffset(albums.length)
		}
	}

	const renderItem = React.useCallback(({ item, index }) => (
		<PlaylistSwipeRow
			onQueue={() => addAlbumToQueue(config, songDispatch, item.id)}
			onNext={() => addAlbumToQueue(config, songDispatch, item.id, true)}
		>
			<ExplorerItem
				item={item}
				title={item.name || item.album || item.title}
				subTitle={`${item.artist || 'Unknown Artist'} · ${item.year || ''}`}
				onPress={() => navigation.navigate('Album', item)}
				onLongPress={() => setIndexOptions(index)}
				isFavorited={item.starred}
			/>
		</PlaylistSwipeRow>
	), [config, songDispatch, navigation])


	const renderActivityIndicator = () => {
		if (!isLoading) {
			return (
				<View style={styles.loadingContainer}>
					<Text style={{ color: theme.primaryText, fontSize: size.text.medium }}>{t('No results')}</Text>
				</View>
			)
		}
		return (
			<View style={styles.loadingContainer}>
				<ActivityIndicator size="small" color={theme.primaryTouch} />
			</View>
		)
	}

	const renderFooter = () => {
		if (!albums.length || albums.length % PAGE_SIZE !== 0) return null
		if (!isLoading) return null

		return (
			<View style={styles.loadingContainer}>
				<ActivityIndicator size="small" color={theme.primaryTouch} />
			</View>
		)
	}

	if (layout === 'grid') return (
		<>
			<LegendList
				data={albums}
				numColumns={2}
				keyExtractor={(_, index) => index}
				style={mainStyles.mainContainer(theme)}
				contentContainerStyle={[mainStyles.contentMainContainer(insets, false), { minHeight: Math.ceil(albums.length / 2) * 230 + 410 }]}
				waitForInitialLayout={false}
				recycleItems={true}
				estimatedItemSize={230}
				onEndReached={handleEndReached}
				onEndReachedThreshold={0.1}
				ListHeaderComponent={
					<View style={{ flex: 1 }}>
						{showHeader && <PresHeaderIcon
							title={title || t("Albums")}
							subTitle={t("Explore")}
							icon="book"
						/>}
						<Text style={styles.titleSelector(theme)}>Type</Text>
						<Selector current={type} items={TYPES} setData={setType} />
					</View>
				}
				ListFooterComponent={renderFooter}
				ListEmptyComponent={renderActivityIndicator}
				renderItem={({ item, index }) => (
					<AllItem item={item} type="album" onPress={() => navigation.navigate('Album', item)} onLongPress={() => setIndexOptions(index)} />
				)}
			/>
			<OptionsAlbums
				albums={albums}
				indexOptions={indexOptions}
				setIndexOptions={setIndexOptions}
			/>
		</>
	)

	return (
		<>
			<LegendList
				data={albums}
				keyExtractor={(_, index) => index}
				style={mainStyles.mainContainer(theme)}
				contentContainerStyle={[mainStyles.contentMainContainer(insets, false), { minHeight: 80 * albums.length + 410 }]}
				waitForInitialLayout={false}
				recycleItems={true}
				estimatedItemSize={80}
				maintainVisibleContentPosition={{
					minIndexForVisible: 0,
					itemVisiblePercentThreshold: 50,
				}}
				onEndReached={handleEndReached}
				onEndReachedThreshold={0.1}
				ListHeaderComponent={
					<View style={{ flex: 1 }}>
						{showHeader && <PresHeaderIcon
							title={title || t("Albums")}
							subTitle={t("Explore")}
							icon="book"
						/>}

						<Text style={styles.titleSelector(theme)}>Type</Text>
						<Selector current={type} items={TYPES} setData={setType} />
					</View>
				}
				ListFooterComponent={renderFooter}
				renderItem={renderItem}
				ListEmptyComponent={renderActivityIndicator}
			/>
			<OptionsAlbums
				albums={albums}
				indexOptions={indexOptions}
				setIndexOptions={setIndexOptions}
			/>
		</>
	)
}

const styles = StyleSheet.create({
	titleSelector: (theme) => ({
		color: theme.primaryText,
		fontSize: size.text.medium,
		fontWeight: 'bold',
		marginHorizontal: 20,
		marginBottom: 10,
	}),
	loadingContainer: {
		paddingVertical: 20,
		alignItems: 'center',
		justifyContent: 'center',
	},
})

export default AlbumExplorer