import React from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as serviceWorkerRegistration from '~/services/serviceWorkerRegistration'

import { getApi } from '~/utils/api'
import { endOfTrackAction, scrobbleTrack, stopAtQueueEnd } from './playerCore'
import { urlStream, urlCover } from './url'
import State from '~/utils/playerState'
import logger from '~/utils/logger'

import * as core from './playerCore'

export {
	addToQueue,
	addToUpNext,
	endOfTrackAction,
	moveInQueue,
	moveTrack,
	moveUpNext,
	removeFromQueue,
	removeFromUpNext,
	scrobbleTrack,
	setRepeat,
	stopAtQueueEnd,
	secondToTime,
} from './playerCore'

const audio = () => {
	return document.getElementById('audio')
}

export const initService = async () => {
	serviceWorkerRegistration.register()
}

export const initPlayer = async (songDispatch) => {
	const song = await AsyncStorage.getItem('song')
		.then((song) => song ? JSON.parse(song) : null)
	const sound = audio()
	global.isVolumeSupported = false
	songDispatch({ type: 'init' })
	if (song) songDispatch({ type: 'restore', song, isSongLoad: false })

	sound.addEventListener('error', () => {
		songDispatch({ type: 'setState', state: State.Error })
	})
	sound.addEventListener('loadstart', () => {
		songDispatch({ type: 'setState', state: State.Loading })
	})
	sound.addEventListener('waiting', () => {
		songDispatch({ type: 'setState', state: State.Loading })
	})
	sound.addEventListener('canplay', () => {
		audio().play()
	})
	sound.addEventListener('loadedmetadata', () => {
		audio().play()
	})
	sound.addEventListener('loadeddata', () => {
		audio().play()
	})
	sound.addEventListener('playing', () => {
		navigator.mediaSession.playbackState = 'playing'
		songDispatch({ type: 'setState', state: State.Playing })
	})
	sound.addEventListener('play', () => {
		navigator.mediaSession.playbackState = 'playing'
		songDispatch({ type: 'setState', state: State.Playing })
	})
	sound.addEventListener('pause', () => {
		navigator.mediaSession.playbackState = 'paused'
		songDispatch({ type: 'setState', state: State.Paused })
	})
	sound.addEventListener('volumechange', () => {
		global.isVolumeSupported = true
	})
	sound.volume = 0.99
	sound.volume = 1
	sound.addEventListener('ended', () => {
		const song = global.song
		const action = endOfTrackAction(song)
		if (action === 'none') return
		// a zero/absent duration means the media never really played (failed load):
		// reload without scrobbling it, same as before this was centralised
		if (action === 'repeat' && audio().duration < 1) {
			reload()
			return
		}
		scrobbleTrack(global.config, song, true)
		if (action === 'repeat') {
			setPosition(0)
			resumeSong()
		} else if (action === 'reset') {
			resetAudio(songDispatch)
		} else if (action === 'stop') {
			// the web player had no end-of-queue stop at all — the last track just sat
			// there ended with song.state still reading Playing
			stopAtQueueEnd(songDispatch, stopSong)
		} else {
			nextSong(global.config, song, songDispatch)
		}
	})
	navigator.mediaSession.setActionHandler("pause", () => {
		pauseSong()
	})
	navigator.mediaSession.setActionHandler("play", () => {
		resumeSong()
	})
	navigator.mediaSession.setActionHandler("seekto", (details) => {
		setPosition(details.seekTime)
	})
	navigator.mediaSession.setActionHandler("previoustrack", () => {
		previousSong(global.config, global.song, songDispatch)
	})
	navigator.mediaSession.setActionHandler("nexttrack", () => {
		nextSong(global.config, global.song, songDispatch)
	})
	navigator.mediaSession.setActionHandler("seekbackward", () => {
		previousSong(global.config, global.song, songDispatch)
	})
	navigator.mediaSession.setActionHandler("seekforward", () => {
		nextSong(global.config, global.song, songDispatch)
	})

	addEventListener('keydown', (e) => {
		if (e.key === ' ') {
			if (global.song.state === State.Playing) pauseSong()
			else resumeSong()
			e.preventDefault()
		} else if (e.key === 'ArrowRight') {
			nextSong(global.config, global.song, songDispatch)
			e.preventDefault()
		}
		else if (e.key === 'ArrowLeft') {
			previousSong(global.config, global.song, songDispatch)
			e.preventDefault()
		}
		else if (e.key === 'ArrowUp') {
			setVolume(getVolume() + 0.1)
			e.preventDefault()
		}
		else if (e.key === 'ArrowDown') {
			setVolume(getVolume() - 0.1)
			e.preventDefault()
		} else if (e.key === 'm') {
			setVolume(getVolume() ? 0 : 1)
			e.preventDefault()
		}
	})
}

export const useEvent = (_song, _songDispatch) => { }

export const updateTime = () => {
	const [time, setTime] = React.useState({
		position: audio().currentTime,
		duration: audio().duration,
	})

	React.useEffect(() => {
		const sound = audio()
		const timeUpdateHandler = () => {
			setTime({
				position: audio().currentTime,
				duration: audio().duration,
			})
		}

		sound.addEventListener('timeupdate', timeUpdateHandler)
		sound.addEventListener('durationchange', timeUpdateHandler)
		return () => {
			sound.removeEventListener('timeupdate', timeUpdateHandler)
			sound.removeEventListener('durationchange', timeUpdateHandler)
		}
	}, [])

	return time
}

const loadSong = async (config, queue, index) => {
	const song = queue[index]
	const sound = audio()

	sound.src = urlStream(config, song.id, global.streamFormat, global.maxBitRate)
	sound.play()
		.then(() => {
			getApi(config, 'scrobble', { id: song.id, submission: false })
				.catch(() => { })
		})
		.catch((error) => {
			logger.error('loadSong', error)
		})
	navigator.mediaSession.metadata = new MediaMetadata({
		title: song.title,
		artist: song.artist,
		album: song.album,
		artwork: [{ src: urlCover(config, song) }],
	})
}

// lazy arrow: stopSong is declared further down, so it must not be read at module-eval time
export const { playSong, nextSong, previousSong, setIndex } = core.createSongControls({
	loadSong,
	stopSong: () => stopSong(),
})

export const reload = async () => {
	audio().load()
}

export const pauseSong = async () => {
	audio().pause()
}

export const resumeSong = async () => {
	audio().play()
}

export const stopSong = async () => {
	audio().pause()
}

export const setPosition = async (position) => {
	if (position === Infinity) return
	const sound = audio()

	if (position < 0) position = 0
	if (position > sound.duration) position = sound.duration
	if (!sound.duration || position < 0) position = 0
	sound.currentTime = position
}

export const setVolume = async (volume) => {
	if (volume > 1) volume = 1
	if (volume < 0) volume = 0
	audio().volume = volume
}

export const getVolume = () => {
	return audio().volume
}

export const updateVolume = () => {
	const [volume, setVol] = React.useState(getVolume())

	React.useEffect(() => {
		const sound = audio()
		const volumeChangeHandler = () => {
			setVol(sound.volume)
		}

		sound.addEventListener('volumechange', volumeChangeHandler)
		return () => {
			sound.removeEventListener('volumechange', volumeChangeHandler)
		}
	}, [])

	return volume
}

export const tuktuktuk = (_songDispatch) => {
	const sound = new Audio()
	sound.src = 'https://sawyerf.github.io/tuktuktuk.mp3'
	sound.addEventListener('loadedmetadata', () => {
		sound.play()
	})
	sound.addEventListener('ended', () => {
		sound.src = ''
	})
}

export const isVolumeSupported = () => {
	return global.isVolumeSupported
}

export const resetAudio = (songDispatch) => {
	songDispatch({ type: 'reset' })
	const sound = audio()
	sound.src = ''
	sound.load()
	sound.pause()
	sound.currentTime = 0
}

const switchServer = async (config) => {
	const song = global.song
	if (!song?.songInfo || !song.queue?.length) return
	const sound = audio()
	const position = sound.currentTime || 0
	const isPlaying = !sound.paused
	await loadSong(config, song.queue, song.index)
	if (position > 0) await setPosition(position)
	if (isPlaying) await resumeSong()
	else await pauseSong()
}

export default {
	initService,
	initPlayer,
	useEvent,
	updateTime,
	playSong,
	nextSong,
	previousSong,
	setIndex,
	pauseSong,
	resumeSong,
	stopSong,
	setPosition,
	setVolume,
	getVolume,
	isVolumeSupported,
	updateVolume,
	tuktuktuk,
	reload,
	resetAudio,
	switchServer,
	loadSong,
	State,
	...core,
}