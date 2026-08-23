import React from 'react'
import { View, TextInput, StyleSheet } from 'react-native'
import { LegendList } from "@legendapp/list"
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import Icon from 'react-native-vector-icons/FontAwesome'

import { useConfig } from '~/contexts/config'
import { useCachedAndApi, getApi } from '~/utils/api'
import { urlCover } from '~/utils/url'
import { useSettings, useSetSettings } from '~/contexts/settings'
import { useTheme } from '~/contexts/theme'
import PresHeader from '~/components/PresHeader'
import mainStyles from '~/styles/main'
import OptionsSongsList from '~/components/options/OptionsSongsList'
import presStyles from '~/styles/pres'
import RandomButton from '~/components/button/RandomButton'
import DownloadButton from '~/components/button/DownloadButton'
import SongItem from '~/components/item/SongItem'
import PlaylistSwipeRow from '~/components/item/PlaylistSwipeRow'
import OptionsPlaylist from '~/components/options/OptionsPlaylist'
import OptionsPopup from '~/components/popup/OptionsPopup'
import size from '~/styles/size'
import { useSong, useSongDispatch } from '~/contexts/song'
import { playSong, addToQueue, addToUpNext } from '~/utils/player'

const sortOptions = [
	{ key: null, labelKey: 'Default' },
	{ key: 'title', labelKey: 'Sort by title' },
	{ key: 'artist', labelKey: 'Sort by artist' },
	{ key: 'album', labelKey: 'Sort by album' },
	{ key: 'duration', labelKey: 'Sort by duration' },
	{ key: 'track', labelKey: 'Sort by track' },
]

const Playlist = ({ route: { params } }) => {
	const { t } = useTranslation()
	const insets = useSafeAreaInsets()
	const config = useConfig()
	const theme = useTheme()
	const navigation = useNavigation()
	const settings = useSettings()
	const setSettings = useSetSettings()
	const [info, setInfo] = React.useState(null)
	const [indexOptions, setIndexOptions] = React.useState(-1)
	const [isOption, setIsOption] = React.useState(false)
	const [searchQuery, setSearchQuery] = React.useState('')
	const [sortOption, setSortOption] = React.useState(settings.sortPlaylist || null)
	const [isSortOpen, setIsSortOpen] = React.useState(false)
	const [openSongId, setOpenSongId] = React.useState(null)
	const song = useSong()
	const songDispatch = useSongDispatch()

	const [songs, refresh] = useCachedAndApi([], 'getPlaylist', `id=${params.playlist.id}`, (json, setData) => {
		setInfo(json?.playlist)
		if (settings.reversePlaylist) setData(json?.playlist?.entry?.map((item, index) => ({ ...item, index })).reverse() || [])
		else setData(json?.playlist?.entry?.map((item, index) => ({ ...item, index })) || [])
	}, [params.playlist.id, settings.reversePlaylist])

	const filteredSortedSongs = React.useMemo(() => {
		let result = songs

		if (searchQuery) {
			const query = searchQuery.toLowerCase()
			result = result.filter(item =>
				(item.title || '').toLowerCase().includes(query) ||
				(item.artist || '').toLowerCase().includes(query)
			)
		}

		if (sortOption && result.length > 0) {
			result = [...result].sort((a, b) => {
				if (sortOption === 'title') return (a.title || '').localeCompare(b.title || '')
				if (sortOption === 'artist') return (a.artist || '').localeCompare(b.artist || '')
				if (sortOption === 'album') return (a.album || '').localeCompare(b.album || '')
				if (sortOption === 'duration') return (b.duration || 0) - (a.duration || 0)
				if (sortOption === 'track') return (a.track || 0) - (b.track || 0)
				return 0
			})
		}

		return result
	}, [songs, searchQuery, sortOption])

	const saveSort = (key) => {
		setSortOption(key)
		setSettings({ ...settings, sortPlaylist: key })
	}

	const addQueue = React.useCallback((track) => {
		if (song.queue) addToQueue(songDispatch, track)
		else playSong(config, songDispatch, [track], 0)
	}, [song.queue, songDispatch, config])

	const playNext = React.useCallback((track) => {
		if (song.queue) addToUpNext(songDispatch, track, true)
		else playSong(config, songDispatch, [track], 0)
	}, [song.queue, songDispatch, config])

	const removeFromPlaylist = React.useCallback((track) => {
		getApi(config, 'updatePlaylist', { playlistId: params.playlist.id, songIndexToRemove: track.index })
			.then(() => {
				setOpenSongId(null)
				refresh()
			})
			.catch(() => setOpenSongId(null))
	}, [config, params.playlist.id, refresh])

	const sortRef = React.useRef()

	const renderItem = React.useCallback(({ item, index }) => (
		<PlaylistSwipeRow
			open={openSongId === item.id}
			onOpen={() => setOpenSongId(item.id)}
			onClose={() => setOpenSongId(null)}
			onQueue={() => addQueue(item)}
			onNext={() => playNext(item)}
			onRemove={() => removeFromPlaylist(item)}
		>
			<SongItem
				song={item}
				queue={filteredSortedSongs}
				index={index}
				setIndexOptions={setIndexOptions}
				style={{
					paddingHorizontal: 20,
				}}
			/>
		</PlaylistSwipeRow>
	), [filteredSortedSongs, openSongId, addQueue, playNext, removeFromPlaylist])

	return (
		<>
			<LegendList
				data={filteredSortedSongs}
				keyExtractor={(item, index) => index}
				style={mainStyles.mainContainer(theme)}
				contentContainerStyle={[mainStyles.contentMainContainer(insets, false)]}
				recycleItems={true}
				waitForInitialLayout={false}
				estimatedItemSize={60}
				ListHeaderComponent={
					<>
						<PresHeader
							title={info?.name || params.playlist.name}
							subTitle={`${((info?.duration || params?.playlist?.duration) / 60) | 1} ${t('minutes')} · ${info?.songCount || params?.playlist?.songCount} ${t('songs')}`}
							imgSrc={urlCover(config, params.playlist)}
							onPressOption={() => {
								setIsOption(true)
							}}
						>
							<RandomButton songList={songs} style={presStyles.button} />
							<DownloadButton
								type="playlist"
								id={info?.id || params.playlist.id}
								name={info?.name || params.playlist.name}
								cover={urlCover(config, params.playlist)}
								songs={songs}
								style={presStyles.button}
							/>
						</PresHeader>
						<OptionsPlaylist
							playlist={info}
							open={isOption}
							onClose={() => setIsOption(false)}
							onRefresh={refresh}
							onDelete={() => navigation.goBack()}
						/>
						<OptionsPopup
							ref={sortRef}
							visible={isSortOpen}
							close={() => setIsSortOpen(false)}
							options={sortOptions.map((opt) => ({
								name: t(opt.labelKey),
								icon: sortOption === opt.key ? 'check' : undefined,
								onPress: () => {
									saveSort(opt.key)
									sortRef.current?.close()
								},
							}))}
						/>
					</>
				}
				renderItem={renderItem}
			/>
			<View style={[styles.searchContainer, { top: insets.top + 55 }]}>
				<Icon name="search" size={size.icon.small} color="rgba(255,255,255,0.7)" style={styles.searchIcon} />
				<TextInput
					style={styles.searchInput}
					placeholder={t('Search in playlist')}
					placeholderTextColor="rgba(255,255,255,0.6)"
					value={searchQuery}
					onChangeText={setSearchQuery}
				/>
				<Icon
					name={sortOption ? 'sort-amount-asc' : 'sort-alpha-asc'}
					size={size.icon.small}
					color={sortOption ? theme.primaryTouch : 'rgba(255,255,255,0.7)'}
					style={styles.sortIcon}
					onPress={() => setIsSortOpen(true)}
				/>
			</View>
			<OptionsSongsList
				songs={filteredSortedSongs}
				onUpdate={refresh}
				indexOptions={indexOptions}
				setIndexOptions={setIndexOptions}
				idPlaylist={params.playlist.id}
			/>
		</>
	)
}

const styles = StyleSheet.create({
	searchContainer: {
		position: 'absolute',
		left: 20,
		right: 20,
		zIndex: 3,
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 12,
		borderRadius: 10,
		backgroundColor: 'rgba(0,0,0,0.45)',
	},
	searchInput: {
		flex: 1,
		color: '#fff',
		fontSize: size.text.large,
		textAlign: 'left',
		padding: 8,
		paddingStart: 10,
		outline: 'none',
	},
	searchIcon: {
		marginEnd: 10,
	},
	sortIcon: {
		padding: 5,
		marginLeft: 10,
	},
})

export default Playlist