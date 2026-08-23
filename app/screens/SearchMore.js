import React from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { LegendList } from '@legendapp/list'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'

import { useTheme } from '~/contexts/theme'
import { getApiNetworkFirst } from '~/utils/api'
import { useConfig } from '~/contexts/config'
import { playSong, addToQueue, addToUpNext } from '~/utils/player'
import { addAlbumToQueue } from '~/utils/albumActions'
import { useSong, useSongDispatch } from '~/contexts/song'
import mainStyles from '~/styles/main'
import size from '~/styles/size'
import ExplorerItem from '~/components/item/ExplorerItem'
import AllItem from '~/components/item/AllItem'
import PlaylistSwipeRow from '~/components/item/PlaylistSwipeRow'
import IconButton from '~/components/button/IconButton'
import logger from '~/utils/logger'
import Header from '~/components/Header'

const PAGE_SIZE = 20

const SearchMore = ({ route: { params: { query, results, type } } }) => {
	const { t } = useTranslation()
	const insets = useSafeAreaInsets()
	const theme = useTheme()
	const navigation = useNavigation()
	const config = useConfig()
	const song = useSong()
	const songDispatch = useSongDispatch()
	const [items, setItems] = React.useState(results || [])
	const [offset, setOffset] = React.useState(results?.length || 0)
	const [isLoading, setIsLoading] = React.useState(false)
	const [view, setView] = React.useState('list')

	const viewButton = (
		<IconButton
			icon={view === 'grid' ? 'list' : 'th-large'}
			size={22}
			color={theme.primaryText}
			onPress={() => setView(view === 'grid' ? 'list' : 'grid')}
		/>
	)

	const getParams = (type) => {
		if (type === 'album') return { query, artistCount: 0, songCount: 0, albumCount: PAGE_SIZE, albumOffset: offset }
		if (type === 'artist') return { query, artistCount: PAGE_SIZE, songCount: 0, albumCount: 0, artistOffset: offset }
		if (type === 'song') return { query, artistCount: 0, songCount: PAGE_SIZE, albumCount: 0, songOffset: offset }
	}

	React.useEffect(() => {
		setIsLoading(true)
		getApiNetworkFirst(config, 'search3', getParams(type))
			.then(json => {
				setIsLoading(false)
				if (type === 'album') {
					setItems(prev => [...prev, ...(json?.searchResult3?.album || [])])
				} else if (type === 'artist') {
					setItems(prev => [...prev, ...(json?.searchResult3?.artist || [])])
				} else if (type === 'song') {
					setItems(prev => [...prev, ...(json?.searchResult3?.song || [])])
				}
			})
			.catch(error => {
				logger.error('SearchMore', 'Error fetching items:', error)
				setIsLoading(false)
			})
	}, [offset])

	const handleEndReached = () => {
		if (items.length > 0 && items.length % PAGE_SIZE === 0) {
			setOffset(items.length)
		}
	}

	const goTo = (item, index) => {
		if (type === 'album') navigation.navigate('Album', item)
		if (type === 'artist') navigation.navigate('Artist', item)
		if (type === 'song') playSong(config, songDispatch, items, index)
	}

	const addQueue = React.useCallback((track) => {
		if (song.queue) addToQueue(songDispatch, track)
		else playSong(config, songDispatch, [track], 0)
	}, [song.queue, songDispatch, config])

	const playNext = React.useCallback((track) => {
		if (song.queue) addToUpNext(songDispatch, track, true)
		else playSong(config, songDispatch, [track], 0)
	}, [song.queue, songDispatch, config])

	const renderItem = React.useCallback(({ item, index }) => {
		const content = (
			<ExplorerItem
				item={item}
				title={item.name || item.title}
				subTitle={type !== 'artist' ? item.artist : ''}
				onPress={() => goTo(item, index)}
				isFavorited={item.starred}
				borderRadius={type === 'artist' ? size.radius.circle : undefined}
			/>
		)
		if (type === 'song') return <PlaylistSwipeRow onQueue={() => addQueue(item)} onNext={() => playNext(item)}>{content}</PlaylistSwipeRow>
		if (type === 'album') return (
			<PlaylistSwipeRow
				onQueue={() => addAlbumToQueue(config, songDispatch, item.id)}
				onNext={() => addAlbumToQueue(config, songDispatch, item.id, true)}
			>{content}</PlaylistSwipeRow>
		)
		return content
	}, [items, config, type, songDispatch, addQueue, playNext])


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
		if (!items.length || items.length % PAGE_SIZE !== 0) return null
		if (!isLoading) return null

		return (
			<View style={styles.loadingContainer}>
				<ActivityIndicator size="small" color={theme.primaryTouch} />
			</View>
		)
	}

	return (
		<View style={[mainStyles.mainContainer(theme), { flex: 1 }]}>
			{view === 'grid' ? (
				<LegendList
					data={items}
					numColumns={2}
					keyExtractor={(_, index) => index}
					style={mainStyles.mainContainer(theme)}
					contentContainerStyle={[mainStyles.contentMainContainer(insets, false), { minHeight: Math.ceil(items.length / 2) * 230 + 100 + 80 }]}
					waitForInitialLayout={false}
					recycleItems={true}
					estimatedItemSize={230}
					onEndReached={handleEndReached}
					onEndReachedThreshold={0.1}
					ListHeaderComponent={
						<Header title={t("Search")} right={viewButton} />
					}
					ListFooterComponent={renderFooter}
					ListEmptyComponent={renderActivityIndicator}
					renderItem={({ item, index }) => (
						<AllItem item={item} type={type} onPress={(i) => goTo(i, index)} />
					)}
				/>
			) : (
				<LegendList
					data={items}
					keyExtractor={(_, index) => index}
					style={mainStyles.mainContainer(theme)}
					contentContainerStyle={[mainStyles.contentMainContainer(insets, false), { minHeight: 80 * items.length + 100 + 80 }]}
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
						<Header title={t("Search")} right={viewButton} />
					}
					ListFooterComponent={renderFooter}
					renderItem={renderItem}
					ListEmptyComponent={renderActivityIndicator}
				/>
			)}
		</View>
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

export default SearchMore