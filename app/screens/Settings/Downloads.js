import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { LegendList } from '@legendapp/list'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import Icon from 'react-native-vector-icons/FontAwesome'
import { useIsFocused } from '@react-navigation/native'

import { useTheme } from '~/contexts/theme'
import { useDownloads, getDownloadSpeed, formatSpeed, formatBytes, pauseDownload, resumeDownload, cancelDownload, retryDownload, removeSong, removeSource, clearAllDownloads, getDownloadedSongs } from '~/utils/downloadManager'
import { clearCache, getStatCache } from '~/utils/cache'
import { useSettings, useSetSettings } from '~/contexts/settings'
import { confirmAlert } from '~/utils/alert'
import Header from '~/components/Header'
import IconButton from '~/components/button/IconButton'
import ImageError from '~/components/ImageError'
import ButtonSwitch from '~/components/settings/ButtonSwitch'
import ButtonMenu from '~/components/settings/ButtonMenu'
import OptionInput from '~/components/settings/OptionInput'
import ListMap from '~/components/lists/ListMap'
import TableItem from '~/components/settings/TableItem'
import mainStyles from '~/styles/main'
import settingStyles from '~/styles/settings'
import size from '~/styles/size'

const STATUS_ORDER = { downloading: 0, queued: 1, paused: 2, error: 3 }

const Downloads = () => {
	const { t } = useTranslation()
	const insets = useSafeAreaInsets()
	const theme = useTheme()
	const isFocused = useIsFocused()
	const settings = useSettings()
	const setSettings = useSetSettings()
	const { queue, index, collections } = useDownloads()
	const [speed, setSpeed] = React.useState(0)
	const [cacheNextSong, setCacheNextSong] = React.useState(settings.cacheNextSong.toString())
	const [statCache, setStatCache] = React.useState([
		{ name: 'Loading...', count: '' },
	])

	const getStat = () => {
		getStatCache()
			.then((res) => {
				setStatCache(res)
			})
	}

	React.useEffect(() => {
		if (!isFocused) return
		getStat()
	}, [isFocused])

	React.useEffect(() => {
		setCacheNextSong(settings.cacheNextSong.toString())
	}, [settings.cacheNextSong])

	React.useEffect(() => {
		if (cacheNextSong === '') return
		const number = parseInt(cacheNextSong)
		if (number === settings.cacheNextSong) return
		setSettings({ ...settings, cacheNextSong: number })
	}, [cacheNextSong])

	React.useEffect(() => {
		if (!isFocused) return
		const update = () => setSpeed(getDownloadSpeed())
		update()
		const id = setInterval(update, 1000)
		return () => clearInterval(id)
	}, [isFocused])

	const activeItems = queue
		.filter((q) => ['downloading', 'queued', 'paused', 'error'].includes(q.status))
		.sort((a, b) => (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) || (a.createdAt - b.createdAt))
	const activeCount = queue.filter((q) => q.status === 'downloading').length
	const queuedCount = queue.filter((q) => ['queued', 'paused'].includes(q.status)).length

	const collectionsList = Object.values(collections).map((collection) => {
		let completedSongs = 0
		let totalSize = 0
		for (const entry of Object.values(index)) {
			if (entry.sources.some((s) => s.type === collection.type && s.id === collection.id)) {
				completedSongs++
				totalSize += entry.size
			}
		}
		return { ...collection, completedSongs, totalSize }
	})

	const collectionKeys = new Set(collectionsList.map((c) => `${c.type}:${c.id}`))
	const individualSongs = getDownloadedSongs().filter((song) =>
		song.sources.length === 0 || song.sources.every((s) => !collectionKeys.has(`${s.type}:${s.id}`))
	)

	const totalSize = Object.values(index).reduce((sum, entry) => sum + entry.size, 0)
	const isEmpty = activeItems.length === 0 && collectionsList.length === 0 && individualSongs.length === 0

	const renderActiveItem = ({ item }) => {
		const isDownloading = item.status === 'downloading'
		const isPaused = item.status === 'paused'
		const isError = item.status === 'error'
		const progress = isDownloading ? Math.round((item.progress || 0) * 100) : 0

		return (
			<View style={[styles.activeCard, { backgroundColor: theme.secondaryBack }]}>
				<View style={styles.row}>
					<ImageError style={styles.thumb} source={{ uri: item.meta.cover }} iconError="music" />
					<View style={styles.rowContent}>
						<Text style={[styles.rowTitle, { color: theme.primaryText }]} numberOfLines={1}>{item.meta.title}</Text>
						<Text style={[styles.rowSubtitle, { color: theme.secondaryText }]} numberOfLines={1}>
							{item.meta.artist}{item.source ? ` · ${item.source.name}` : ''}
						</Text>
						{isDownloading && (
							<View style={[styles.progressTrack, { backgroundColor: theme.primaryBack }]}>
								<View style={[styles.progressFill, { backgroundColor: theme.primaryTouch, width: `${progress}%` }]} />
							</View>
						)}
						{isDownloading && (
							<Text style={[styles.progressText, { color: theme.secondaryText }]}>
								{formatBytes(item.writtenBytes)} / {formatBytes(item.totalBytes || item.writtenBytes)} · {progress}%
							</Text>
						)}
						{isPaused && <Text style={[styles.statusText, { color: theme.secondaryText }]}>{t('settings.downloads.Paused')}</Text>}
						{isError && <Text style={[styles.statusText, { color: '#e33' }]} numberOfLines={1}>{item.error || t('settings.downloads.Failed')}</Text>}
						{item.status === 'queued' && <Text style={[styles.statusText, { color: theme.secondaryText }]}>{t('settings.downloads.Queued')}</Text>}
					</View>
					<View style={styles.rowActions}>
						{isDownloading && <IconButton icon="pause" size={size.icon.small} color={theme.primaryText} style={styles.actionButton} onPress={() => pauseDownload(item.songId)} />}
						{isPaused && <IconButton icon="play" size={size.icon.small} color={theme.primaryText} style={styles.actionButton} onPress={() => resumeDownload(item.songId)} />}
						{isError && <IconButton icon="refresh" size={size.icon.small} color={theme.primaryText} style={styles.actionButton} onPress={() => retryDownload(item.songId)} />}
						<IconButton
							icon="times"
							size={size.icon.small}
							color={theme.secondaryText}
							style={styles.actionButton}
							onPress={() => {
								if (isDownloading) {
									confirmAlert(t('settings.downloads.Cancel download'), t('settings.downloads.Cancel download alert', { name: item.meta.title }), async () => cancelDownload(item.songId))
								} else {
									cancelDownload(item.songId)
								}
							}}
						/>
					</View>
				</View>
			</View>
		)
	}

	const header = (
		<>
			<Header title={t('Downloads')} />
			<View style={settingStyles.contentMainContainer}>
				<Text style={settingStyles.titleContainer(theme)}>{t('settings.cache.Song caching')}</Text>
				<View style={[settingStyles.optionsContainer(theme), { marginBottom: 5 }]}>
					<ButtonSwitch
						title={t("settings.cache.Enable song caching")}
						value={settings.isSongCaching}
						onPress={() => setSettings({ ...settings, isSongCaching: !settings.isSongCaching })}
					/>
					<ButtonSwitch
						title={t("settings.cache.Show cached songs")}
						value={settings.showCache}
						onPress={() => setSettings({ ...settings, showCache: !settings.showCache })}
					/>
					<OptionInput
						title={t("settings.cache.Cache next song")}
						value={cacheNextSong}
						onChangeText={(text) => setCacheNextSong(text.replace(/[^0-9]/g, ''))}
						inputMode="numeric"
						isLast
					/>
				</View>
				<Text style={settingStyles.description(theme)}>{t('settings.cache.Cache next song description')}</Text>
				{isEmpty && (
					<View style={[styles.empty, { backgroundColor: theme.secondaryBack }]}>
						<Icon name="cloud-download" size={40} color={theme.secondaryText} />
						<Text style={{ color: theme.secondaryText, marginTop: 10 }}>{t('settings.downloads.No downloads')}</Text>
					</View>
				)}

				{!isEmpty && (
					<View style={[styles.statsCard, { backgroundColor: theme.secondaryBack }]}>
						<View style={styles.statsBlock}>
							<Text style={[styles.statValue, { color: theme.primaryText }]}>{formatSpeed(speed)}</Text>
							<Text style={[styles.statLabel, { color: theme.secondaryText }]}>{t('settings.downloads.Speed')}</Text>
						</View>
						<View style={[styles.statDivider, { backgroundColor: theme.primaryBack }]} />
						<View style={styles.statsBlock}>
							<Text style={[styles.statValue, { color: theme.primaryText }]}>{activeCount}</Text>
							<Text style={[styles.statLabel, { color: theme.secondaryText }]}>{t('settings.downloads.Active')}</Text>
						</View>
						<View style={[styles.statDivider, { backgroundColor: theme.primaryBack }]} />
						<View style={styles.statsBlock}>
							<Text style={[styles.statValue, { color: theme.primaryText }]}>{queuedCount}</Text>
							<Text style={[styles.statLabel, { color: theme.secondaryText }]}>{t('settings.downloads.In queue')}</Text>
						</View>
					</View>
				)}

				{activeItems.length > 0 && (
					<Text style={settingStyles.titleContainer(theme)}>{t('settings.downloads.Active downloads')}</Text>
				)}
			</View>
		</>
	)

	const footer = (
		<View style={settingStyles.contentMainContainer}>
			{collectionsList.length > 0 && (
				<>
					<Text style={settingStyles.titleContainer(theme)}>{t('settings.downloads.Downloaded')}</Text>
					<View style={settingStyles.optionsContainer(theme)}>
						{collectionsList.map((collection) => (
							<View key={`${collection.type}:${collection.id}`} style={[styles.row, { backgroundColor: theme.secondaryBack }]}>
								<ImageError style={styles.thumb} source={{ uri: collection.cover }} iconError="music" />
								<View style={styles.rowContent}>
									<Text style={[styles.rowTitle, { color: theme.primaryText }]} numberOfLines={1}>{collection.name}</Text>
									<Text style={[styles.rowSubtitle, { color: theme.secondaryText }]} numberOfLines={1}>
										{collection.completedSongs} {t('songs')} · {formatBytes(collection.totalSize)}
									</Text>
								</View>
								<IconButton
									icon="trash"
									size={size.icon.small}
									color={theme.secondaryText}
									style={styles.actionButton}
									onPress={() => {
										confirmAlert(t('settings.downloads.Remove download'), t('settings.downloads.Remove download alert', { name: collection.name }), async () => removeSource({ type: collection.type, id: collection.id, name: collection.name }))
									}}
								/>
							</View>
						))}
					</View>
				</>
			)}

			{individualSongs.length > 0 && (
				<>
					<Text style={settingStyles.titleContainer(theme)}>{t('settings.downloads.Individual songs')}</Text>
					<View style={settingStyles.optionsContainer(theme)}>
						{individualSongs.map((song) => (
							<View key={song.songId} style={[styles.row, { backgroundColor: theme.secondaryBack }]}>
								<ImageError style={styles.thumb} source={{ uri: song.meta.cover }} iconError="music" />
								<View style={styles.rowContent}>
									<Text style={[styles.rowTitle, { color: theme.primaryText }]} numberOfLines={1}>{song.meta.title}</Text>
									<Text style={[styles.rowSubtitle, { color: theme.secondaryText }]} numberOfLines={1}>{song.meta.artist} · {formatBytes(song.size)}</Text>
								</View>
								<IconButton icon="trash" size={size.icon.small} color={theme.secondaryText} style={styles.actionButton} onPress={() => removeSong(song.songId)} />
							</View>
						))}
					</View>
				</>
			)}

			{!isEmpty && (
				<View style={[settingStyles.optionsContainer(theme), styles.clearAllRow, { marginTop: 20 }]}>
					<IconButton
						icon="trash"
						size={size.icon.small}
						color={theme.secondaryText}
						style={styles.actionButton}
						onPress={() => confirmAlert(t('settings.downloads.Clear all'), t('settings.downloads.Clear all alert'), async () => clearAllDownloads())}
					/>
					<Text
						style={[styles.clearAllText, { color: theme.primaryText }]}
						onPress={() => confirmAlert(t('settings.downloads.Clear all'), t('settings.downloads.Clear all alert'), async () => clearAllDownloads())}
					>{t('settings.downloads.Clear all')} · {formatBytes(totalSize)}</Text>
				</View>
			)}
			<View style={settingStyles.optionsContainer(theme)}>
				<ButtonMenu
					title={t("settings.cache.Clear API cache")}
					icon="trash"
					onPress={() => confirmAlert(
						t('settings.cache.Clear API cache'),
						t('settings.cache.Clear API cache alert message'),
						async () => {
							await clearCache()
							getStat()
						}
					)}
					isLast
				/>
			</View>
			<Text style={settingStyles.titleContainer(theme)}>{t('settings.cache.Cache stats')}</Text>
			<View style={settingStyles.optionsContainer(theme)}>
				<ListMap
					data={statCache}
					renderItem={(item, index) => (
						<TableItem
							key={index}
							title={item.name}
							value={item.count}
							isLast={index === statCache.length - 1}
						/>
					)}
				/>
			</View>
		</View>
	)

	return (
		<LegendList
			style={mainStyles.mainContainer(theme)}
			contentContainerStyle={mainStyles.contentMainContainer(insets)}
			ListHeaderComponent={header}
			ListFooterComponent={footer}
			data={activeItems}
			keyExtractor={(item) => item.songId}
			renderItem={renderActiveItem}
			estimatedItemSize={80}
			recycleItems={true}
		/>
	)
}

const styles = StyleSheet.create({
	activeCard: {
		paddingHorizontal: 17,
		borderRadius: 10,
		marginBottom: 20,
		overflow: 'hidden',
	},
	statsCard: {
		borderRadius: 12,
		paddingVertical: 14,
		paddingHorizontal: 8,
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 20,
	},
	statsBlock: {
		flex: 1,
		alignItems: 'center',
	},
	statValue: {
		fontSize: 18,
		fontWeight: '700',
	},
	statLabel: {
		fontSize: 11,
		marginTop: 3,
	},
	statDivider: {
		width: StyleSheet.hairlineWidth,
		height: 34,
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		padding: 12,
		gap: 12,
	},
	thumb: {
		width: 52,
		height: 52,
		borderRadius: 4,
	},
	rowContent: {
		flex: 1,
	},
	rowTitle: {
		fontSize: size.text.medium,
		fontWeight: '600',
	},
	rowSubtitle: {
		fontSize: size.text.small,
		marginTop: 2,
	},
	progressTrack: {
		height: 5,
		borderRadius: 3,
		marginTop: 8,
		overflow: 'hidden',
	},
	progressFill: {
		height: '100%',
	},
	progressText: {
		fontSize: 11,
		marginTop: 3,
	},
	statusText: {
		fontSize: 12,
		marginTop: 3,
	},
	rowActions: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	actionButton: {
		padding: 8,
	},
	empty: {
		borderRadius: 12,
		paddingVertical: 40,
		alignItems: 'center',
		justifyContent: 'center',
	},
	clearAllRow: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 8,
	},
	clearAllText: {
		flex: 1,
		textAlign: 'right',
		fontSize: size.text.medium,
		fontWeight: '600',
	},
})

export default Downloads
