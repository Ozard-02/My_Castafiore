import React from 'react'
import { Text, View, Modal, StyleSheet, useWindowDimensions, Pressable, Platform, Animated, PanResponder } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'

import { useConfig } from '~/contexts/config'
import { useSong, useSongDispatch } from '~/contexts/song'
import { useTheme } from '~/contexts/theme'
import { useCachedFirst } from '~/utils/api'
import { urlCover } from '~/utils/url'
import PlaylistButton from '~/components/button/PlaylistButton'
import IconButton from '~/components/button/IconButton'
import Icon from 'react-native-vector-icons/FontAwesome'
import ImageError from '~/components/ImageError'
import Lyric from '~/components/player/Lyric'
import mainStyles from '~/styles/main'
import OptionsMultiArtists from '~/components/options/OptionsMultiArtists'
import OptionsPlayer from '~/components/options/OptionsPlayer'
import QueueSheet from '~/components/player/QueueSheet'
import PlayButton from '~/components/button/PlayButton'
import Player from '~/utils/player'
import size from '~/styles/size'
import SlideBar from '~/components/button/SlideBar'
import SlideControl from '~/components/button/SlideControl'

const preview = {
	COVER: 0,
	QUEUE: 1,
	LYRICS: 2
}

const CoverItem = ({ isPreview, song, onToggleLyrics }) => {
	const config = useConfig()
	const theme = useTheme()
	const { width, height } = useWindowDimensions()

	const albumImage = React.useMemo(() => {
		const size = Math.min(width - 50, 450, Math.max(110, height - 420))
		return {
			maxWidth: size,
			width: size,
			maxHeight: size,
			height: size,
			minwidth: size,
			minHeight: size,
			aspectRatio: 1,
			borderRadius: 10,
		}
	}, [width, height])

	if (isPreview === preview.COVER) return (
		<SlideControl style={albumImage} onTap={onToggleLyrics}>
			<ImageError
				source={{ uri: urlCover(config, song?.songInfo) }}
				style={[albumImage, { backgroundColor: theme.secondaryBack }]}
			/>
		</SlideControl>
	)
	if (isPreview === preview.LYRICS) return (
		<Lyric song={song} style={albumImage} />
	)
}

const TimeBar = () => {
	const [duration, setDuration] = React.useState(0)
	const [fakeTime, setFakeTime] = React.useState(-1)
	const song = useSong()
	const theme = useTheme()
	const time = Player.updateTime()

	React.useEffect(() => {
		// deps had to include the track: two songs with the same native duration (or a radio
		// station) kept the previous track's total, so the bar and the ∞:∞ label disagreed
		if (song.songInfo?.isLiveStream) {
			setDuration(Infinity)
		} else if ((time.duration === 0 || time.duration === Infinity) && song.songInfo?.duration) {
			setDuration(song.songInfo.duration || 0)
		} else {
			setDuration(time.duration)
		}
	}, [time.duration, song.songInfo?.id, song.songInfo?.isLiveStream, song.songInfo?.duration])

	return (
		<>
			<SlideBar
				disable={time.duration === 0 || duration === Infinity}
				progress={fakeTime < 0 ? time.position / duration : fakeTime}
				onStart={(progress) => Player.pauseSong() && setFakeTime(progress)}
				onChange={(progress) => setFakeTime(progress)}
				onComplete={(progress) => Player.setPosition(progress * duration) && Player.resumeSong() && setTimeout(() => setFakeTime(-1), 500)}
				stylePress={{ width: '100%', height: 24, paddingVertical: 10, marginTop: 17 }}
				styleBar={{ width: '100%', height: '100%', borderRadius: size.radius.circle, overflow: 'hidden' }}
				isBitogno={song.songInfo?.isLiveStream ? false : true}
			/>

			<View style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between' }}>
				<Text style={{ color: theme.primaryText, fontSize: size.text.small }}>{Player.secondToTime(fakeTime < 0 ? time.position : fakeTime * duration)}</Text>
				<Text style={{ color: theme.primaryText, fontSize: size.text.small }}>{Player.secondToTime(duration)}</Text>
			</View>
		</>
	)
}

const FullScreenPlayer = ({ setFullScreen }) => {
	const { t } = useTranslation()
	const songDispatch = useSongDispatch()
	const config = useConfig()
	const theme = useTheme()
	const song = useSong()
	const insets = useSafeAreaInsets()
	const navigation = useNavigation()
	const { width, height } = useWindowDimensions()
	const compact = width < 420 || height < 700
	const [isPreview, setIsPreview] = React.useState(preview.COVER)
	const [isOptArtists, setIsOptArtists] = React.useState(false)
	const [isOpt, setIsOpt] = React.useState(false)
	// queue is an overlay now, not a third `preview` value: it slides over the whole window
	const [isQueueOpen, setIsQueueOpen] = React.useState(false)
	const closeFull = React.useCallback(() => setFullScreen(false), [setFullScreen])
	// Android collapses a prop-less <View> out of the native view hierarchy. A touch that
	// lands on such a view never enters the JS responder system, so it produces no MOVE
	// events and the swipe-up could only ever start on a button or the title — every other
	// pixel was dead. Declaring this hook (which always declines) keeps the view present and
	// hit-testable without it ever consuming a touch.
	const neverTake = React.useCallback(() => false, [])
	const queueY = React.useRef(new Animated.Value(height)).current
	const queueOpenRef = React.useRef(false)
	queueOpenRef.current = isQueueOpen
	const isPreviewRef = React.useRef(isPreview)
	isPreviewRef.current = isPreview
	// Bottom edge of the cover/lyrics pane, in the coordinate space the gesture reports in (the
	// window: the responder is attached to the modal's root view, not to playerContainer).
	// Only used to keep an upward drag on the LYRICS pane from opening the queue.
	const paneTop = React.useRef(0)
	const onPaneLayout = React.useCallback((e) => {
		paneTop.current = e.nativeEvent.layout.y + e.nativeEvent.layout.height
	}, [])

	// 1:1 finger tracking. Closed: the sheet sits one window-height below the viewport and
	// rises by exactly the drag distance. Open: the header drags it back down the same way.
	const settleQueue = React.useCallback((toValue) => {
		Animated.spring(queueY, {
			toValue,
			useNativeDriver: Platform.OS !== 'web',
			bounciness: 4,
			speed: 14,
		}).start(() => { if (toValue >= height) setIsQueueOpen(false) })
	}, [queueY, height])

	// Shared by the strip and the window-level responder so the two feel identical.
	const settleStrip = React.useCallback((g) => {
		// 12% of the window instead of 28%: the sheet tracks the finger 1:1, so a short flick
		// is visibly intentional. A gentle upward fling counts too.
		const travelled = height - Math.max(0, height + g.dy)
		if (travelled > height * 0.12 || g.vy < -0.3) {
			setIsQueueOpen(true)
			settleQueue(0)
		} else {
			settleQueue(height)
		}
	}, [height, settleQueue])

	// Open: an upward drag anywhere in the window. Close: a downward drag on the sheet header.
	//
	// Capture, not onMoveShouldSetPanResponder. A pressable under the finger (the transport
	// buttons, the title, the bottom padding) wins the responder on touch-START, so the parent
	// was never asked again and the swipe did nothing at all. Capture gets asked first; taps
	// still fall through, because it only fires once a real vertical move happens.
	// The empty band under the transport row. It claims the touch on DOWN rather than waiting
	// for a move: nothing interactive lies underneath it, and on Android a View carrying no
	// props is collapsed out of the native hierarchy, so a touch landing on plain empty space
	// never enters the responder system and no MOVE events are ever delivered — the swipe-up
	// simply could not start there. Claiming on DOWN is what makes the strip work.
	const stripPan = React.useRef(PanResponder.create({
		onStartShouldSetPanResponder: () => true,
		onMoveShouldSetPanResponder: (_, g) => g.dy < -4 && Math.abs(g.dy) > Math.abs(g.dx) * 1.1,
		onPanResponderGrant: () => queueY.setValue(height),
		onPanResponderMove: (_, g) => queueY.setValue(Math.max(0, height + g.dy)),
		onPanResponderRelease: (_, g) => settleStrip(g),
	})).current

	const openPan = React.useRef(PanResponder.create({
		// moveY, not y0: PanResponder only fills in x0/y0 at GRANT time (PanResponder.js:471)
		// and leaves them 0 until then, so testing g.y0 here was always `0 > <bottom>`. Since
		// moveY only shrinks while dragging up, "currently below the cover" is equivalent to
		// "started below the cover", and it cannot swallow the cover's horizontal next/prev nor
		// the lyrics' own downward scroll. Anything off the cover square — the margin around it
		// and the empty strip under the controls — opens the queue.
		onStartShouldSetPanResponderCapture: () => false,
		// The eligible area is the WHOLE window. Restricting the start zone is what made this
		// feel broken: the gesture only ever fired from the transport buttons and the title.
		//
		// Two things stop that from swallowing real interactions:
		//  - the axis check. The cover's horizontal next/prev never satisfies |dy| > |dx|, so
		//    it survives an upward drag that starts on the cover itself.
		//  - the lyrics exception. The lyrics pane is a scrollable list, and scrolling DOWN
		//    through it is a vertical drag upward, which would otherwise open the queue.
		onMoveShouldSetPanResponderCapture: (_, g) => {
			if (queueOpenRef.current) return false
			if (isPreviewRef.current === preview.LYRICS && g.moveY <= paneTop.current + 6) return false
			return g.dy < -4 && Math.abs(g.dy) > Math.abs(g.dx) * 1.1
		},
		onPanResponderGrant: () => queueY.setValue(height),
		onPanResponderMove: (_, g) => queueY.setValue(Math.max(0, height + g.dy)),
		onPanResponderRelease: (_, g) => settleStrip(g),
	})).current

	const closePan = React.useRef(PanResponder.create({
		onMoveShouldSetPanResponderCapture: (_, g) => queueOpenRef.current && g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx) * 1.1,
		onPanResponderGrant: () => queueY.setValue(0),
		onPanResponderMove: (_, g) => queueY.setValue(Math.min(height, Math.max(0, g.dy))),
		onPanResponderRelease: (_, g) => {
			if (g.dy > height * 0.1 || g.vy > 0.3) settleQueue(height)
			else settleQueue(0)
		},
	})).current

	const toggleLyrics = React.useCallback(() => {
		setIsPreview((prev) => prev === preview.LYRICS ? preview.COVER : preview.LYRICS)
	}, [])

	const [stars] = useCachedFirst([], 'getStarred2', null, (json, setData) => {
		setData(json?.starred2?.song || [])
	}, [song.songInfo?.id])

	return (
		<Modal
			statusBarTranslucent={true}
			navigationBarTranslucent={Platform.OS === 'android' && parseInt(Platform.Version, 10) > 34 ? false : true}
			onRequestClose={() => {
				// Back must dismiss the topmost layer, not the whole player. This is not only the
				// back button: on Android a downward swipe starting near the screen edge IS the
				// system back gesture, and the platform consumes it before any PanResponder here
				// can see it. Dispatching by layer order is what makes "swipe down to close the
				// queue" close the queue from anywhere, including the corners.
				if (isQueueOpen) settleQueue(height)
				else if (isPreview === preview.LYRICS) setIsPreview(preview.COVER)
				else closeFull()
			}}
		>
			<View
				style={[mainStyles.contentMainContainer(insets), styles.mainContainer(insets, theme)]}
				{...openPan.panHandlers}
			>
				<View style={{ width: '100%', flexDirection: 'row' }}>
					<OptionsPlayer
						song={song.songInfo}
						isOpen={isOpt}
						setIsOpen={setIsOpt}
						closePlayer={() => closeFull()}
					/>
					<IconButton
						style={{
							paddingVertical: compact ? 12 : 20,
							paddingHorizontal: compact ? 15 : 25,
							flex: 1,
						}}
						icon="chevron-down"
						color={theme.primaryText}
						onPress={() => closeFull()}
					/>
					{/* the cover tap toggles lyrics on, but the lyrics pane is a FlatList whose rows
					    seek on tap — so the tap target is taken and there is nothing left to tap to
					    come back. This is the way out, and it only exists while the lyrics show. */}
					{isPreview === preview.LYRICS && (
						<IconButton
							style={{
								paddingVertical: compact ? 12 : 20,
								paddingHorizontal: compact ? 15 : 25,
							}}
							icon="picture-o"
							color={theme.primaryTouch}
							onPress={() => setIsPreview(preview.COVER)}
						/>
					)}
					<IconButton
						style={{
							paddingVertical: compact ? 12 : 20,
							paddingHorizontal: compact ? 15 : 25,
						}}
						icon="ellipsis-h"
						color={theme.primaryText}
						onPress={() => setIsOpt(true)}
					/>
				</View>
				<View
					style={styles.playerContainer}
					onStartShouldSetResponder={neverTake}
				>
					{/* the cover takes all the slack and centres in it. Previously playerContainer
					    used justifyContent: 'space-between', which smeared the leftover into
					    four equal gaps — so tightening the controls below just pushed the cluster
					    further from the cover instead of freeing space. Cover size is unchanged. */}
					<View
						style={styles.coverSlot}
						onLayout={onPaneLayout}
						onStartShouldSetResponder={neverTake}
					>
						<CoverItem isPreview={isPreview} song={song} onToggleLyrics={toggleLyrics} />
					</View>
					<View onStartShouldSetResponder={neverTake} style={{ flexDirection: 'row', marginTop: 26, width: '100%', alignItems: 'center', justifyContent: 'space-between' }}>
						<View style={{ flex: 1 }}>
							<Pressable
								style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
								onPress={() => {
									navigation.navigate('Album', { id: song.songInfo.albumId, name: song.songInfo.album, artist: song.songInfo.artist, artistId: song.songInfo.artistId })
									closeFull()
								}}
							>
								<Text numberOfLines={1} style={{ color: theme.primaryText, fontSize: size.title.small, textAlign: 'left', fontWeight: '700', letterSpacing: -0.5 }}>{song.songInfo.title}</Text>
							</Pressable>
							<Pressable
								style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
								onPress={() => {
									if (song.songInfo.artists?.length > 1) {
										setIsOptArtists(true)
									} else {
										navigation.navigate('Artist', { id: song.songInfo.artistId, name: song.songInfo.artist })
										closeFull()
									}
								}}
							>
								<Text numberOfLines={1} style={mainStyles.largeText(theme.secondaryText)}>{song.songInfo.artist}</Text>
							</Pressable>
							<OptionsMultiArtists
								albumArtists={song.songInfo.albumArtists || []}
								artists={song.songInfo.artists || []}
								close={() => setIsOptArtists(false)}
								visible={isOptArtists}
								setFullScreen={setFullScreen}
							/>
						</View>
						<PlaylistButton
							id={song.songInfo.id}
							isFavorited={stars.some(s => s.id === song.songInfo.id)}
							rating={song.songInfo?.userRating ?? song.songInfo?.rating ?? 0}
							style={{ padding: compact ? 12 : 20, paddingEnd: 0 }}
						/>
					</View>
					<TimeBar />
					<View onStartShouldSetResponder={neverTake} style={{ flexDirection: 'row', width: '100%', marginVertical: compact ? 21 : 27, alignItems: 'center', justifyContent: 'space-between' }}>
						<View style={{ flexDirection: 'row', alignItems: 'center' }}>
							<IconButton
								icon="random"
								size={compact ? 18 : 20}
								color={song.actionEndOfSong == 'random' ? theme.primaryTouch : theme.secondaryText}
								style={{ padding: 10 }}
								onPress={() => Player.setRepeat(songDispatch, song.actionEndOfSong === 'random' ? 'next' : 'random')}
							/>
						</View>
						<IconButton
							icon="step-backward"
							size={compact ? 22 : size.icon.large}
							color={theme.primaryText}
							style={{ padding: 10 }}
							onPress={() => Player.previousSong(config, song, songDispatch)}
						/>
						<PlayButton
							size={compact ? 36 : 54}
							color={theme.primaryText}
							style={{
								paddingHorizontal: 10,
								minWidth: compact ? 48 : 70,
								minHeight: compact ? 48 : 66,
								justifyContent: 'center',
								alignItems: 'center',
							}}
						/>
						<IconButton
							icon="step-forward"
							size={compact ? 22 : size.icon.large}
							color={theme.primaryText}
							style={{ padding: 10 }}
							onPress={() => Player.nextSong(config, song, songDispatch)}
						/>
						<IconButton
							icon="repeat"
							size={compact ? 18 : 20}
							color={song.actionEndOfSong == 'repeat' ? theme.primaryTouch : theme.secondaryText}
							style={{ padding: 10 }}
							onPress={() => Player.setRepeat(songDispatch, song.actionEndOfSong === 'repeat' ? 'next' : 'repeat')}
						/>
					</View>
					<Animated.View {...stripPan.panHandlers} style={styles.queueDragStrip} />
				</View>
				{/* queue: a sheet that slides over the WHOLE window, controls included. translateY
				    starts one window-height below the viewport and tracks the finger 1:1. */}
				<Animated.View
					pointerEvents={isQueueOpen ? 'auto' : 'none'}
					style={[styles.queueOverlay, { backgroundColor: theme.primaryBack, transform: [{ translateY: queueY }] }]}
				>
					<View style={[styles.queueHeader, { paddingTop: insets.top + 10 }]} {...closePan.panHandlers}>
						<Icon name="angle-double-down" size={20} color={theme.secondaryText} style={{ marginEnd: 10 }} />
						<Text style={[mainStyles.mediumText(theme.primaryText), { flex: 1 }]}>{t('Queue')}</Text>
						<IconButton icon="close" size={size.icon.tiny} color={theme.secondaryText} onPress={() => settleQueue(height)} />
					</View>
					<View style={{ flex: 1, paddingHorizontal: 20, paddingBottom: insets.bottom > 15 ? insets.bottom : 15 }}>
						<QueueSheet song={song} stars={stars} setFullScreen={setFullScreen} />
					</View>
				</Animated.View>
			</View>
		</Modal>
	)
}

const styles = StyleSheet.create({
	mainContainer: (insets, theme) => ({
		width: '100%',
		height: '100%',
		paddingBottom: insets.bottom,
		backgroundColor: theme.primaryBack,
		alignItems: 'center',
	}),
	playerContainer: {
		paddingHorizontal: 25,
		maxWidth: 500,
		width: '100%',
		height: '100%',
		alignItems: 'center',
		flexDirection: 'column',
		flex: 1,
		// the removed lyrics/cast/queue row occupied marginTop 21 + ~29px of icons. Padding
		// absorbs exactly that, so the title/seek/transport cluster stays put where the three
		// measured passes in TODO #35 put it, and the freed height goes to the cover instead.
		paddingBottom: 82,
	},
	// takes every pixel the controls do not need, so the bottom cluster can stay compact.
	// Centred: flex-end jammed the cover against the title and pushed it 233px down the
	// screen. Growing the cluster below instead shrinks this slot, which pulls the
	// cover back up AND closes the gap to the title (the gap is (slot - cover) / 2).
	coverSlot: {
		flex: 1,
		width: '100%',
		alignItems: 'center',
		justifyContent: 'center',
	},
	// covers the whole window (the controls included), driven by translateY
	queueOverlay: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
	},
	// The empty band under the transport row (playerContainer's paddingBottom). Absolute, so it
	// overlays only that padding and never the controls.
	queueDragStrip: {
		position: 'absolute',
		left: 0,
		right: 0,
		bottom: 0,
		height: 82,
	},
	queueHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 20,
		paddingBottom: 12,
	},
})

export default FullScreenPlayer