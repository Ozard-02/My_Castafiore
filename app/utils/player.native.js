import CastPlayer from '~/utils/player/playerCast'
import LocalPlayer from '~/utils/player/playerLocal'
import State from '~/utils/playerState'
import UpnpPlayer from '~/utils/player/playerUpnp'
import logger from '~/utils/logger'

import * as core from './playerCore'

export {
	addToQueue,
	addToUpNext,
	moveInQueue,
	moveTrack,
	moveUpNext,
	removeFromQueue,
	removeFromUpNext,
	setRepeat,
	secondToTime,
} from './playerCore'

let type = 'local'

const getPlayer = (forceType = null) => {
	const deviceType = forceType || type
	if (deviceType === 'local') return LocalPlayer
	else if (deviceType === 'chromecast') return CastPlayer
	else if (deviceType === 'upnp') return UpnpPlayer
	return null
}

export const { playSong, nextSong, previousSong, setIndex } = core.createSongControls({
	loadSong: (config, queue, index) => getPlayer().loadSong(config, queue, index),
})

export const initService = LocalPlayer.initService

export const initPlayer = async (songDispatch) => {
	await LocalPlayer.initPlayer(songDispatch)
	await UpnpPlayer.initPlayer(songDispatch)
	await CastPlayer.initPlayer(songDispatch)
}

export const useEvent = (song, songDispatch) => {
	LocalPlayer.useEvent(song, songDispatch, nextSong)
	CastPlayer.useEvent(song, songDispatch, nextSong)
	UpnpPlayer.useEvent(song, songDispatch, nextSong)
}

export const reload = async () => {
	return getPlayer().reload()
}

export const pauseSong = async () => {
	return getPlayer().pauseSong()
}

export const resumeSong = async () => {
	return getPlayer().resumeSong()
}

export const stopSong = async () => {
	return getPlayer().stopSong()
}

export const downloadSong = async (song, source = null) => {
	return getPlayer().downloadSong(song, source)
}

export const downloadNextSong = async (queue, currentIndex) => {
	return getPlayer().downloadNextSong(queue, currentIndex)
}

export const restoreState = async (state) => {
	if (!state) return

	if (state.position > 0) {
		await setPosition(state.position)
	}

	if (state.isPlaying) {
		await resumeSong()
	}
}

export const setPosition = async (position) => {
	return getPlayer().setPosition(position)
}

export const setVolume = async (volume) => {
	return getPlayer().setVolume(volume)
}

export const getVolume = () => {
	return getPlayer().getVolume()
}

export const loadSong = async (config, queue, index) => {
	return getPlayer().loadSong(config, queue, index)
}

export const tuktuktuk = async (songDispatch) => {
	return getPlayer().tuktuktuk(songDispatch)
}

export const updateVolume = () => { }
export const updateTime = () => {
	const localTime = LocalPlayer.updateTime()
	const upnpTime = UpnpPlayer.updateTime()
	const chromecastTime = CastPlayer.updateTime()

	if (type === 'chromecast') return chromecastTime
	else if (type === 'upnp') return upnpTime
	return localTime
}

export const isVolumeSupported = () => {
	return false
}

export const resetAudio = (songDispatch) => {
	return getPlayer().resetAudio(songDispatch)
}

export const switchServer = async (config) => {
	return getPlayer().switchServer(config)
}

export const connect = async (device, newType) => {
	await getPlayer(newType).connect(device)
}

export const disconnect = async (device) => {
	return getPlayer().disconnect(device)
}

export const switchPlayer = async (newType) => {
	type = newType
}

export const saveState = async () => {
	return getPlayer().saveState()
		.catch((error) => {
			logger.error('Player', 'Error saving state:', error)
			return {
				position: 0,
				isPlaying: false
			}
		})
}

export default {
	initPlayer,
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
	tuktuktuk,
	updateVolume,
	updateTime,
	isVolumeSupported,
	reload,
	useEvent,
	resetAudio,
	switchServer,
	restoreState,
	saveState,
	connect,
	disconnect,
	switchPlayer,
	State,
	...core,
}
