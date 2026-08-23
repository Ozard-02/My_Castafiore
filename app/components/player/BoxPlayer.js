import React from 'react'
import { Text, View, Pressable, StyleSheet, Animated, PanResponder, Platform, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Icon from 'react-native-vector-icons/FontAwesome'

import { useSong, useSongDispatch } from '~/contexts/song'
import { useConfig } from '~/contexts/config'
import { useTheme } from '~/contexts/theme'
import { urlCover } from '~/utils/url'
import PlayButton from '~/components/button/PlayButton'
import Player from '~/utils/player'
import IconButton from '~/components/button/IconButton'
import ImageError from '~/components/ImageError'
import size from '~/styles/size'
import useKeyboardIsOpen from '~/utils/useKeyboardIsOpen'

const BoxPlayer = ({ setFullScreen }) => {
	const song = useSong()
	const songDispatch = useSongDispatch()
	const config = useConfig()
	const insets = useSafeAreaInsets()
	const theme = useTheme()
	const isKeyboardOpen = useKeyboardIsOpen()
	const { width } = useWindowDimensions()
	// keep in sync with BottomBar's compact threshold: shorter bar -> smaller offset
	const compactBar = width < 380
	const [isDismissed, setIsDismissed] = React.useState(false)
	const translateY = React.useRef(new Animated.Value(0)).current
	const translateX = React.useRef(new Animated.Value(0)).current

	// dismissed by a downward swipe: comes back when a new song/queue starts
	React.useEffect(() => {
		setIsDismissed(false)
	}, [song?.songInfo?.id, song?.queue])
	const axisRef = React.useRef(null)
	const prevSongRef = React.useRef({ id: null, index: -1 })

	const songRef = React.useRef(song)
	songRef.current = song
	const configRef = React.useRef(config)
	configRef.current = config

	// directional slide-in when the song changes: next enters from the right, previous from the left
	React.useEffect(() => {
		const info = song?.songInfo
		if (!info?.id) return
		if (prevSongRef.current.id === info.id) return
		let direction = 'next'
		const queue = song.queue
		if (queue?.length && prevSongRef.current.id) {
			const oldIndex = prevSongRef.current.index
			const newIndex = song.index
			if (newIndex === oldIndex - 1 || (oldIndex === 0 && newIndex === queue.length - 1)) direction = 'prev'
		}
		prevSongRef.current = { id: info.id, index: song.index }
		translateX.setValue(direction === 'next' ? 80 : -80)
		Animated.timing(translateX, {
			toValue: 0,
			duration: 160,
			useNativeDriver: Platform.OS !== 'web',
		}).start()
	}, [song?.songInfo?.id])

	const panResponder = React.useRef(PanResponder.create({
		onStartShouldSetPanResponder: () => false,
		onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 6 || Math.abs(gestureState.dy) > 6,
		onPanResponderGrant: () => {
			axisRef.current = null
			translateY.stopAnimation()
		},
		onPanResponderMove: (_, gestureState) => {
			// axis lock: the first 10px decide horizontal vs vertical, the other axis stays untouched
			if (!axisRef.current && (Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10)) {
				axisRef.current = Math.abs(gestureState.dx) > Math.abs(gestureState.dy) ? 'x' : 'y'
			}
			if (axisRef.current === 'y') {
				translateY.setValue(Math.min(90, Math.max(-90, gestureState.dy)))
			}
		},
		onPanResponderRelease: (_, gestureState) => {
			Animated.timing(translateY, {
				toValue: 0,
				duration: 120,
				useNativeDriver: Platform.OS !== 'web',
			}).start()
			const { dx, dy } = gestureState
			if (Math.abs(dx) > Math.abs(dy)) {
				if (dx < -60) Player.nextSong(configRef.current, songRef.current, songDispatch)
				else if (dx > 60) Player.previousSong(configRef.current, songRef.current, songDispatch)
			} else if (dy < -60) {
				setFullScreen(true)
			} else if (dy > 60) {
				setIsDismissed(true)
			}
		},
	})).current

	return (
		<Animated.View
			style={{
				position: 'absolute',
				bottom: (insets.bottom ? insets.bottom : 10) + (compactBar ? 45 : 59),
				left: insets.left,
				right: insets.right,

				transform: [{ translateY }],
				display: isDismissed || isKeyboardOpen ? 'none' : undefined,
			}}
			touchAction="none"
			{...panResponder.panHandlers}
		>
			<Pressable
				onPress={() => setFullScreen(true)}
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					backgroundColor: theme.playerBackground,
					padding: 10,
					margin: 10,
					borderRadius: 10,
				}}>
				<Animated.View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', transform: [{ translateX }] }}>
					<ImageError
						source={{ uri: urlCover(config, song?.songInfo, 100) }}
						style={styles.boxPlayerImage}
					>
						<View style={styles.boxPlayerImage}>
							<Icon name="music" size={size.icon.small} color={theme.playerPrimaryText} />
						</View>
					</ImageError>
					<View style={{ flex: 1 }}>
						<Text style={{ color: theme.playerPrimaryText, textAlign: 'left', flex: 1, fontWeight: 'bold' }} numberOfLines={1}>{song?.songInfo?.track ? `${song?.songInfo?.track}. ` : null}{song?.songInfo?.title ? song.songInfo.title : 'Song title'}</Text>
						<Text style={{ color: theme.playerSecondaryText, textAlign: 'left', flex: 1 }} numberOfLines={1}>{song?.songInfo?.artist ? song.songInfo.artist : 'Artist'}</Text>
					</View>
				</Animated.View>
				<IconButton
					icon="step-forward"
					size={size.icon.small}
					color={theme.playerButton}
					style={{ width: 35, alignItems: 'center' }}
					onPress={() => Player.nextSong(config, song, songDispatch)}
				/>
				<PlayButton
					size={size.icon.small}
					color={theme.playerButton}
					style={{ width: 35, alignItems: 'center' }}
				/>
			</Pressable>
		</Animated.View>
	)
}

const styles = StyleSheet.create({
	boxPlayerImage: {
		height: size.image.player,
		width: size.image.player,
		marginRight: 10,
		borderRadius: 4,
		alignItems: 'center',
		justifyContent: 'center',
	},
})

export default BoxPlayer
