import React from 'react'
import { View, Text, FlatList, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'

import { useConfig } from '~/contexts/config'
import { useSongDispatch } from '~/contexts/song'
import { useTheme } from '~/contexts/theme'
import Player from '~/utils/player'
import useQueueDnD from '~/utils/useQueueDnD'
import SongItem from '~/components/item/SongItem'
import OptionsQueue from '~/components/options/OptionsQueue'
import OptionsUpNext from '~/components/options/OptionsUpNext'
import QueueDragRow, { QueueDragProvider } from '~/components/player/QueueDrag'
import size from '~/styles/size'

// Queue contents, lifted out of FullScreenPlayer's CoverItem when the queue became a
// swipe-up overlay: these hooks (useQueueDnD, the two option-popup indexes) used to run on
// every player render even while the cover was showing.
const QueueSheet = ({ song, stars, setFullScreen }) => {
	const { t } = useTranslation()
	const theme = useTheme()
	const config = useConfig()
	const songDispatch = useSongDispatch()
	const [indexOptions, setIndexOptions] = React.useState(-1)
	const [upNextOptions, setUpNextOptions] = React.useState(-1)
	const { scroll, upNextScroll, queueOffset, queueViewport, upNextOffset, upNextViewport, queueBoxY, queueBoxH, upNextBoxY, upNextBoxH, rowHeight, isCurrentInQueue, queueItems, queueKeys, upNextKeys, queueRealIndex, lists, handleMove } = useQueueDnD(song, songDispatch, { scrollAnimated: true })

	return (
		<>
			<View style={{ width: '100%', flex: 1 }}>
				<QueueDragProvider lists={lists} rowHeight={rowHeight} onMove={handleMove}>
					<Text style={[styles.label, { color: theme.secondaryText, fontSize: size.text.small, textTransform: 'uppercase', marginBottom: 5 }]}>{t('Now playing')}</Text>
					{song.songInfo && (
						<View style={[styles.row, { marginBottom: 10 }]}>
							<SongItem
								song={{ ...song.songInfo, starred: stars.some(s => s.id === song.songInfo.id) }}
								queue={song.queue}
								index={song.index}
								setIndexOptions={() => { }}
								onPress={() => { }}
								playsOnPress={false}
								isPlaying
								overlay
							/>
						</View>
					)}
					{song.upNext?.length > 0 && (
						<>
							<Text style={[styles.label, { color: theme.secondaryText, fontSize: size.text.small, textTransform: 'uppercase', marginBottom: 5 }]}>{t('Up next')}</Text>
							<View onLayout={(e) => { upNextBoxY.current = e.nativeEvent.layout.y; upNextBoxH.current = e.nativeEvent.layout.height }} style={{ maxHeight: Math.min(song.upNext.length, 3) * rowHeight }}>
								<FlatList
									ref={upNextScroll}
									data={song.upNext}
									keyExtractor={(_, index) => upNextKeys[index] ?? index}
									showsVerticalScrollIndicator={false}
									getItemLayout={(_, index) => ({ length: rowHeight, offset: rowHeight * index, index })}
									onScroll={(e) => { upNextOffset.current = e.nativeEvent.contentOffset.y }}
									scrollEventThrottle={16}
									onLayout={(e) => { upNextViewport.current = e.nativeEvent.layout.height }}
									renderItem={({ item, index }) => (
										<QueueDragRow list="up" index={index}>
											<View style={styles.row}>
												<SongItem
													song={{ ...item, starred: stars.some(s => s.id === item.id) }}
													queue={song.upNext}
													index={index}
													setIndexOptions={setUpNextOptions}
													onPress={() => { }}
													playsOnPress={false}
													isPlaying={false}
													overlay
												/>
											</View>
										</QueueDragRow>
									)}
								/>
							</View>
						</>
					)}
					<Text style={[styles.label, { color: theme.secondaryText, fontSize: size.text.small, textTransform: 'uppercase', marginVertical: 5 }]}>{t('Queue')}</Text>
					<View onLayout={(e) => { queueBoxY.current = e.nativeEvent.layout.y; queueBoxH.current = e.nativeEvent.layout.height }} style={{ flex: 1 }}>
						<FlatList
							ref={scroll}
							style={{ flex: 1 }}
							contentContainerStyle={{ width: '100%' }}
							data={queueItems}
							keyExtractor={(_, index) => queueKeys[index] ?? index}
							showsVerticalScrollIndicator={false}
							onLayout={(e) => { queueViewport.current = e.nativeEvent.layout.height; if (isCurrentInQueue && queueItems.length > 0) scroll.current?.scrollToIndex({ index: 0, animated: false, viewOffset: 0, viewPosition: 0 }) }}
							getItemLayout={(_, index) => ({ length: rowHeight, offset: rowHeight * index, index })}
							onScroll={(e) => { queueOffset.current = e.nativeEvent.contentOffset.y }}
							scrollEventThrottle={16}
							onScrollToIndexFailed={() => { }}
							renderItem={({ item, index }) => {
								const realIndex = queueRealIndex(index)
								return (
									<QueueDragRow list="queue" index={index}>
										<View style={styles.row}>
											<SongItem
												song={{ ...item, starred: stars.some(s => s.id === item.id) }}
												queue={song.queue}
												index={realIndex}
												setIndexOptions={setIndexOptions}
												onPress={(_track, queue, index) => {
													// explicit user jump: drop up next + radio, like starting a new queue
													Player.setIndex(config, songDispatch, queue, index, { clearUpNext: true, clearRadio: true }).catch(() => { })
												}}
												playsOnPress={false}
												isPlaying={false}
												overlay
											/>
										</View>
									</QueueDragRow>
								)
							}}
						/>
					</View>
				</QueueDragProvider>
			</View>
			<OptionsQueue queue={song.queue} indexOptions={indexOptions} setIndexOptions={setIndexOptions} closePlayer={() => setFullScreen(false)} />
			<OptionsUpNext upNext={song.upNext} indexOptions={upNextOptions} setIndexOptions={setUpNextOptions} />
		</>
	)
}

// Queue over the animated background (spec §3.3): no containers of its own, rows sit
// directly on the background at reduced opacity with a subtle black text shadow.
const styles = StyleSheet.create({
	row: { opacity: 0.9 },
	label: {
		textShadowColor: 'rgba(0, 0, 0, 0.35)',
		textShadowOffset: { width: 0, height: 1 },
		textShadowRadius: 2,
	},
})

export default QueueSheet
