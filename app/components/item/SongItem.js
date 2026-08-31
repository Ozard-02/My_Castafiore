import React from 'react'
import { Text, View, StyleSheet, Pressable } from 'react-native'
import Icon from 'react-native-vector-icons/FontAwesome'

import { useConfig } from '~/contexts/config'
import { isSongCached } from '~/utils/cache'
import { playSong } from '~/utils/player'
import { useSettings } from '~/contexts/settings'
import { useSongDispatch } from '~/contexts/song'
import { useTheme } from '~/contexts/theme'
import { urlCover } from '~/utils/url'
import { useDownloads, getSongState } from '~/utils/downloadManager'
import FavoritedButton from '~/components/button/FavoritedButton'
import ImageError from '~/components/ImageError'
import mainStyles from '~/styles/main'
import size from '~/styles/size'

const Cached = ({ song }) => {
	const [isCached, setIsCached] = React.useState(false)
	const theme = useTheme()
	const settings = useSettings()
	const config = useConfig()
	useDownloads()
	const { status, progress } = getSongState(song.id)

	React.useEffect(() => {
		if (!settings.showCache) return
		isSongCached(config, song.id, settings.streamFormat, settings.maxBitRate)
			.then((res) => {
				setIsCached(res)
			})
	}, [song.id, settings.showCache])

	if (status === 'downloading') return (
		<Text style={[mainStyles.smallText(theme.secondaryText), { paddingHorizontal: 5 }]}>
			{Math.round(progress * 100)}%
		</Text>
	)
	if (status === 'queued' || status === 'paused') return (
		<Icon
			name={status === 'queued' ? 'clock-o' : 'pause'}
			size={14}
			color={theme.secondaryText}
			style={{ paddingHorizontal: 5 }}
		/>
	)
	if (status === 'error') return (
		<Icon
			name="exclamation-circle"
			size={14}
			color="red"
			style={{ paddingHorizontal: 5 }}
		/>
	)
	if ((status === 'done' || isCached) && settings.showCache) return (
		<Icon
			name="cloud-download"
			size={14}
			color={theme.secondaryText}
			style={{ paddingHorizontal: 5 }}
		/>
	)
	return null
}

const SongItem = ({ song, queue, index, isIndex = false, isPlaying = false, setIndexOptions = () => { }, onPress = () => true, style = {}, handle = null }) => {
	const songDispatch = useSongDispatch()
	const theme = useTheme()
	const config = useConfig()
	const settings = useSettings()
	const [isHover, setIsHover] = React.useState(false)

	return (
		<Pressable
			style={({ pressed }) => ([mainStyles.opacity({ pressed }), styles.song, style, { backgroundColor: isHover ? theme.secondaryBack : 'transparent' }])}
			onHoverIn={() => { settings.isDesktop && setIsHover(true) }}
			onHoverOut={() => { settings.isDesktop && setIsHover(false) }}
			onPress={() => {
				if (onPress(song, queue, index)) playSong(config, songDispatch, queue, index)
			}}
			delayLongPress={200}
			onLongPress={() => setIndexOptions(index)}
			onContextMenu={(ev) => {
				ev.preventDefault()
				return setIndexOptions(index)
			}}
		>
			<View style={[mainStyles.coverSmall(theme), { overflow: 'hidden', marginRight: 10, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.10)' }]}>
				{isPlaying && (
					<View style={{
						position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1,
						backgroundColor: 'rgba(0, 0, 0, 0.3)',
						justifyContent: 'center', alignItems: 'center'
					}}
					>
						<Icon name="align-center" size={19} color={'white'} style={{ height: 19, transform: [{ rotate: '90deg' }] }} />
					</View>
				)}
				<ImageError
					style={[mainStyles.coverSmall(theme)]}
					source={{ uri: urlCover(config, song, 100) }}
				/>
			</View>
			<View style={{ flex: 1, flexDirection: 'column' }}>
				<Text numberOfLines={1} style={[mainStyles.mediumText(isPlaying ? theme.primaryTouch : theme.primaryText), { marginBottom: 2 }]}>
					{(isIndex && song.track !== undefined) ? `${song.track}. ` : null}{song.title}
				</Text>
				<Text numberOfLines={1} style={mainStyles.smallText(theme.secondaryText)}>
					{song.artist}
				</Text>
			</View>
			{
				settings.isDesktop ? (
					<Text style={[mainStyles.smallText(theme.secondaryText), { marginHorizontal: 10 }]}>
						{song.duration ? `${Math.floor(song.duration / 60)}:${(song.duration % 60).toString().padStart(2, '0')}` : '0:00'}
					</Text>
				) : null}
			<Cached song={song} />
			<FavoritedButton
				id={song.id}
				isFavorited={song?.starred}
				rating={song?.userRating ?? song?.rating ?? 0}
				style={{ padding: 5, paddingStart: 10 }}
			/>
			{handle}
		</Pressable>
	)
}

const styles = StyleSheet.create({
	song: {
		flexDirection: 'row',
		alignItems: 'center',
		height: size.image.small,
		marginBottom: 10,
		borderRadius: size.radius.standard,
	},
})

export default SongItem
