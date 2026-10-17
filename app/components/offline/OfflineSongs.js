import React from 'react'
import { Text, View, StyleSheet } from 'react-native'
import { LegendList } from '@legendapp/list'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'

import { useConfig } from '~/contexts/config'
import { useSong, useSongDispatch } from '~/contexts/song'
import { useTheme } from '~/contexts/theme'
import { playSong, addToQueue, addToUpNext } from '~/utils/player'
import { useDownloads } from '~/utils/downloadManager'
import { offlineSongs } from '~/utils/offlineContent'
import SongItem from '~/components/item/SongItem'
import AllItem from '~/components/item/AllItem'
import PlaylistSwipeRow from '~/components/item/PlaylistSwipeRow'
import OptionsSongsList from '~/components/options/OptionsSongsList'
import mainStyles from '~/styles/main'
import size from '~/styles/size'

// Tracks tab while offline: the songs in the download index, nothing else. Every row
// plays from the cached file (playerLocal checks the cache before streaming), so the
// whole view works with no network.
const OfflineSongs = ({ layout = 'list' }) => {
	const { t } = useTranslation()
	const insets = useSafeAreaInsets()
	const theme = useTheme()
	const config = useConfig()
	const song = useSong()
	const songDispatch = useSongDispatch()
	const downloads = useDownloads()
	const [indexOptions, setIndexOptions] = React.useState(-1)
	const songs = React.useMemo(() => offlineSongs(downloads), [downloads])

	const addQueue = React.useCallback((track) => {
		if (song.queue) addToQueue(songDispatch, track)
		else playSong(config, songDispatch, [track], 0)
	}, [song.queue, songDispatch, config])

	const playNext = React.useCallback((track) => {
		if (song.queue) addToUpNext(songDispatch, track, true)
		else playSong(config, songDispatch, [track], 0)
	}, [song.queue, songDispatch, config])

	const renderItem = React.useCallback(({ item, index }) => (
		<PlaylistSwipeRow
			onQueue={() => addQueue(item)}
			onNext={() => playNext(item)}
		>
			<SongItem
				song={item}
				queue={songs}
				index={index}
				setIndexOptions={setIndexOptions}
				style={{ paddingHorizontal: 20 }}
			/>
		</PlaylistSwipeRow>
	), [songs, addQueue, playNext])

	const empty = (
		<View style={styles.emptyContainer}>
			<Text style={{ color: theme.secondaryText, fontSize: size.text.medium }}>{t('No downloaded content')}</Text>
		</View>
	)

	if (layout === 'grid') return (
		<>
			<LegendList
				data={songs}
				numColumns={2}
				keyExtractor={(item) => item.id}
				style={mainStyles.mainContainer(theme)}
				contentContainerStyle={[mainStyles.contentMainContainer(insets, false), { minHeight: Math.ceil(songs.length / 2) * 230 + 100 }]}
				waitForInitialLayout={false}
				recycleItems={true}
				estimatedItemSize={230}
				ListEmptyComponent={empty}
				renderItem={({ item, index }) => (
					<AllItem item={item} type="song" onPress={() => playSong(config, songDispatch, songs, index)} onLongPress={() => setIndexOptions(index)} />
				)}
			/>
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
				keyExtractor={(item) => item.id}
				style={mainStyles.mainContainer(theme)}
				contentContainerStyle={[mainStyles.contentMainContainer(insets, false), { minHeight: 60 * songs.length + 100 }]}
				waitForInitialLayout={false}
				recycleItems={true}
				estimatedItemSize={80}
				ListEmptyComponent={empty}
				renderItem={renderItem}
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
	emptyContainer: {
		paddingVertical: 30,
		alignItems: 'center',
		justifyContent: 'center',
	},
})

export default OfflineSongs
