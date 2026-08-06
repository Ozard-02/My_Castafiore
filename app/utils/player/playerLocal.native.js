import TrackPlayer, { AppKilledPlaybackBehavior, Capability, RepeatMode, State, useProgress, Event, useTrackPlayerEvents } from 'react-native-track-player'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { urlCover, urlStream } from '~/utils/url'
import { isSongCached, getPathSong } from '~/utils/cache'
import { enqueueSong } from '~/utils/downloadManager'
import MyState from '~/utils/playerState'

let isConnected = true

const initService = async () => {
	TrackPlayer.registerPlaybackService(() => require('~/services/servicePlayback'))
}

const convertState = (state) => {
	if (state === State.Playing) return MyState.Playing
	else if (state === State.Paused) return MyState.Paused
	else if (state === State.Stopped || state === State.None) return MyState.Stopped
	else if (state === State.Buffering) return MyState.Loading
	else if (state === State.Ready) return MyState.Paused
	else if (state === State.Error) return MyState.Error
	else return MyState.Stopped
}

const initPlayer = async (songDispatch) => {
	global.songDispatch = songDispatch
	const song = await AsyncStorage.getItem('song')
		.then((song) => song ? JSON.parse(song) : null)
	try {
		await TrackPlayer.setupPlayer()
	} catch (error) {
		if (error?.code === 'android_cannot_setup_player_in_background') return
	}
	songDispatch({ type: 'init' })
	await TrackPlayer.updateOptions({
		android: {
			appKilledPlaybackBehavior: AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
			alwaysPauseOnInterruption: true,
		},
		capabilities: [
			Capability.Play,
			Capability.Pause,
			Capability.SkipToNext,
			Capability.SkipToPrevious,
			Capability.SeekTo
		],
		notificationCapabilities: [
			Capability.Play,
			Capability.Pause,
			Capability.SkipToNext,
			Capability.SkipToPrevious,
			Capability.SeekTo
		],
		progressUpdateEventInterval: -1,
		icon: require('~/../assets/icon.png')
	})
	// Set the player to the current song
	const activeTrack = await TrackPlayer.getActiveTrack()
	if (song) songDispatch({ type: 'restore', song: song, isSongLoad: activeTrack != null })
	TrackPlayer.setRepeatMode(RepeatMode.Off)
	const state = (await TrackPlayer.getPlaybackState()).state
	songDispatch({ type: 'setState', state: convertState(state) })
}

const useEvent = (song, songDispatch, _nextSong) => {
	// Catch player events
	useTrackPlayerEvents(
		[
			Event.PlaybackState,
			Event.PlaybackActiveTrackChanged,
		],
		async (event) => {
			if (!isConnected) return
			if (event.type === Event.PlaybackState) {
				songDispatch({ type: 'setState', state: convertState(event.state) })
			} else if (event.type === Event.PlaybackActiveTrackChanged) {
				const current = global.song
				if (current?.songInfo && (song.songInfo?.id !== current.songInfo.id || (song.upNext?.length || 0) !== (current.upNext?.length || 0))) {
					songDispatch({ type: 'syncGlobal', song: current })
				} else if (global.song.index != undefined && song.index != global.song.index) {
					songDispatch({ type: 'setIndex', index: global.song.index })
				}
			}
		})
}

const reload = async () => {
	await TrackPlayer.retry()
}

const pauseSong = async () => {
	await TrackPlayer.pause()
}

const resumeSong = async () => {
	await TrackPlayer.play()
}

const stopSong = async () => {
	await TrackPlayer.stop()
}

const downloadSong = async (song, source = null) => {
	await enqueueSong(song, source)
}

const downloadNextSong = async (queue, currentIndex) => {
	if (!global.isSongCaching) return
	const maxIndex = Math.min(global.cacheNextSong, queue.length)

	for (let i = -1; i < maxIndex; i++) {
		const index = (currentIndex + queue.length + i) % queue.length
		const track = queue[index]
		if (track && !track.isLiveStream && track.id.match(/^[a-zA-Z0-9-]*$/)) {
			await enqueueSong(track, null)
		}
	}
}

const convertToTrack = async (track, config) => {
	return {
		...track,
		id: track.id,
		url: (await isSongCached(null, track.id, global.streamFormat, global.maxBitRate)) ?
			getPathSong(track.id, global.streamFormat) :
			urlStream(config, track.id, global.streamFormat, global.maxBitRate),
		artwork: urlCover(config, track),
		artist: track.artist,
		title: track.title,
		album: track.album,
		description: '',
		date: '',
		genre: '',
		rating: false,
		duration: track.duration,
		type: 'default',
		isLiveStream: track.type === 'radio',
	}
}

const loadSong = async (config, queue, index) => {
	await TrackPlayer.load(await convertToTrack(queue[index], config))
	await TrackPlayer.play()
}

const setPosition = async (position) => {
	if (position < 0 || !position) position = 0
	if (position === Infinity) return

	await TrackPlayer.seekTo(position)
}

const setVolume = async (volume) => {
	if (volume > 1) volume = 1
	if (volume < 0) volume = 0
	await TrackPlayer.setVolume(volume)
}

const getVolume = () => {
	return TrackPlayer.getVolume()
}

const unloadSong = async () => { }
const tuktuktuk = async (songDispatch) => {
	const urlTuk = 'https://sawyerf.github.io/tuktuktuk.mp3'
	const playingState = await TrackPlayer.getPlaybackState()

	if ([State.Paused, State.Ended, State.Stopped, State.None, State.Error].indexOf(playingState.state) > -1) {
		const queue = [{
			id: 'tuktuktuk',
			albumId: 'tuktuktuk',
			url: urlTuk,
			title: 'Tuk Tuk Tuk',
			album: 'Tuk Tuk Tuk',
			artist: 'Sawyerf',
			artwork: require('~/../assets/icon.png')
		}]
		songDispatch({ type: 'setQueue', queue, index: 0 })
		songDispatch({ type: 'setActionEndOfSong', action: 'next' })
		await loadSong(global.config, queue, 0)
	}
}

const updateVolume = () => { }
const updateTime = () => {
	return useProgress(500)
}

const isVolumeSupported = () => {
	return false
}

const resetAudio = (songDispatch) => {
	songDispatch({ type: 'reset' })
	TrackPlayer.reset()
}

const saveState = async () => {
	const progress = await TrackPlayer.getProgress()
	const state = await TrackPlayer.getPlaybackState()
	return {
		position: progress.position || 0,
		isPlaying: state.state === State.Playing
	}
}

const connect = async (_device) => {
	isConnected = true
}

const disconnect = async (_device) => {
	await stopSong()
	isConnected = false
}

export default {
	initService,
	initPlayer,
	pauseSong,
	resumeSong,
	stopSong,
	setPosition,
	setVolume,
	getVolume,
	unloadSong,
	loadSong,
	tuktuktuk,
	updateVolume,
	updateTime,
	isVolumeSupported,
	reload,
	useEvent,
	resetAudio,
	saveState,
	downloadNextSong,
	downloadSong,
	connect,
	disconnect,
}