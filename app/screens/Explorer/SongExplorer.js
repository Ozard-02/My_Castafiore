import React from 'react'
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native'
import { LegendList } from '@legendapp/list'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'

import { useTheme } from '~/contexts/theme'
import { useSongDispatch } from '~/contexts/song'
import { getApiNetworkFirst } from '~/utils/api'
import { useConfig } from '~/contexts/config'
import { playSong } from '~/utils/player'
import SongItem from '~/components/item/SongItem'
import AllItem from '~/components/item/AllItem'
import OptionsSongsList from '~/components/options/OptionsSongsList'
import mainStyles from '~/styles/main'
import PresHeaderIcon from '~/components/PresHeaderIcon'
import size from '~/styles/size'
import logger from '~/utils/logger'

const PAGE_SIZE = 100

const SongExplorer = ({ layout = 'list', showHeader = true, title = null }) => {
	const { t } = useTranslation()
	const insets = useSafeAreaInsets()
	const theme = useTheme()
	const config = useConfig()
	const songDispatch = useSongDispatch()
	const [songs, setSongs] = React.useState([])
	const [offset, setOffset] = React.useState(0)
	const [isLoading, setIsLoading] = React.useState(false)
	const [indexOptions, setIndexOptions] = React.useState(-1)

	React.useEffect(() => {
		setIsLoading(true)
		getApiNetworkFirst(config, 'search3', {
			query: '',
			size: PAGE_SIZE,
			songOffset: offset,
			songCount: PAGE_SIZE,
			albumOffset: 0,
			albumCount: 0,
			artistOffset: 0,
			artistCount: 0,
		})
			.then(json => {
				setIsLoading(false)
				const newSongs = json?.searchResult3?.song || []
				if (newSongs.length === 0) return
				setSongs(prev => [...prev, ...newSongs])
			})
			.catch(error => {
				logger.error('SongExplorer', 'Error fetching songs:', error)
				setIsLoading(false)
			})
	}, [offset])

	const handleEndReached = () => {
		if (songs.length > 0 && songs.length % PAGE_SIZE === 0) {
			setOffset(songs.length)
		}
	}

	const renderItem = React.useCallback(({ item, index }) => (
		<SongItem
			song={item}
			queue={songs}
			index={index}
			isFavorited={item.starred}
			setIndexOptions={setIndexOptions}
			style={{
				paddingHorizontal: 20,
			}}
		/>
	), [songs])


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
		if (!songs.length || songs.length % PAGE_SIZE !== 0) return null
		if (!isLoading) return null

		return (
			<View style={styles.loadingContainer}>
				<ActivityIndicator size="small" color={theme.primaryTouch} />
			</View>
		)
	}

	if (layout === 'grid') return (
		<>
			<ScrollView
				style={mainStyles.mainContainer(theme)}
				contentContainerStyle={[mainStyles.contentMainContainer(insets, false), { minHeight: '100%' }]}
				onScroll={({ nativeEvent }) => {
					if (nativeEvent.contentOffset.y + nativeEvent.layoutMeasurement.height >= nativeEvent.contentSize.height - 100) handleEndReached()
				}}
				scrollEventThrottle={16}
			>
				{showHeader && <PresHeaderIcon title={title || t("Songs")} subTitle={t("Explore")} icon="music" />}
				<View style={styles.gridContainer}>
					{songs.map((item, index) => (
						<AllItem key={index} item={item} type="song" onPress={() => playSong(config, songDispatch, songs, index)} onLongPress={() => setIndexOptions(index)} />
					))}
				</View>
				{renderFooter()}
			</ScrollView>
			<OptionsSongsList
				songs={songs}
				indexOptions={indexOptions}
				setIndexOptions={setIndexOptions}
			/>
		</>
	)

	return (
		<>
			<LegendList
				data={songs}
				keyExtractor={(_, index) => index}
				style={mainStyles.mainContainer(theme)}
				contentContainerStyle={[mainStyles.contentMainContainer(insets, false), { minHeight: 60 * songs.length + 410 }]}
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
					showHeader ? <PresHeaderIcon title={title || t("Songs")} subTitle={t("Explore")} icon="music" /> : null
				}
				ListFooterComponent={renderFooter}
				renderItem={renderItem}
				ListEmptyComponent={renderActivityIndicator}
			/>
			<OptionsSongsList
				songs={songs}
				indexOptions={indexOptions}
				setIndexOptions={setIndexOptions}
			/>
		</>
	)
}

const styles = StyleSheet.create({
	gridContainer: {
		display: 'flex',
		flexDirection: 'row',
		flexWrap: 'wrap',
		paddingStart: 20,
		paddingEnd: 20,
	},
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

export default SongExplorer