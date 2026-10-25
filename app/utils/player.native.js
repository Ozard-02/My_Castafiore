import CastPlayer from '~/utils/player/playerCast'
import LocalPlayer from '~/utils/player/playerLocal'
import State from '~/utils/playerState'
import UpnpPlayer from '~/utils/player/playerUpnp'
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

let type = 'local'

const getPlayer = (forceType = null) => {
	const deviceType = forceType || type
	if (deviceType === 'local') return LocalPlayer
	else if (deviceType === 'chromecast') return CastPlayer
	else if (deviceType === 'upnp') return UpnpPlayer
	return null
}

// getPlayer() is null for an unknown type; every routed call goes through this so a bad
// device type fails soft instead of throwing a TypeError inside a player event handler.
const withPlayer = (fn, fallback) => async (...args) => {
	const player = getPlayer()
	if (!player) {
		logger.error('Player', `No player for type '${type}'`)
		return fallback
	}
	return fn(player, ...args)
}

export const { playSong, nextSong, previousSong, setIndex } = core.createSongControls({
	loadSong: withPlayer((player, config, queue, index) => player.loadSong(config, queue, index)),
	stopSong: withPlayer((player) => player.stopSong()),
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

export const reload = async () => withPlayer((player) => player.reload())()
export const pauseSong = async () => withPlayer((player) => player.pauseSong())()
export const resumeSong = async () => withPlayer((player) => player.resumeSong())()
export const stopSong = async () => withPlayer((player) => player.stopSong())()

export const restoreState = async (state) => {
	if (!state) return

	if (state.position > 0) {
		await setPosition(state.position)
	}

	if (state.isPlaying) {
		await resumeSong()
	}
}

export const setPosition = async (position) => withPlayer((player) => player.setPosition(position))()
export const setVolume = async (volume) => withPlayer((player) => player.setVolume(volume))()
export const reconcileState = async (songDispatch) => withPlayer((player) => player.reconcileState?.(songDispatch))()
export const getVolume = () => getPlayer()?.getVolume()
export const loadSong = async (config, queue, index) => withPlayer((player) => player.loadSong(config, queue, index))()
export const tuktuktuk = async (songDispatch) => withPlayer((player) => player.tuktuktuk(songDispatch))()

export const updateVolume = () => { }
export const updateTime = () => {
	// all three backends are called unconditionally on purpose: each one runs hooks
	// (useProgress / useStreamPosition / useState+listener), so skipping one by device type
	// would change the hook count per component and break React's rules of hooks.
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

export const resetAudio = (songDispatch) => withPlayer((player) => player.resetAudio(songDispatch))()
export const switchServer = async (config) => withPlayer((player) => player.switchServer(config))()

export const connect = async (device, newType) => {
	await getPlayer(newType)?.connect(device)
}

export const disconnect = async (device) => {
	return getPlayer()?.disconnect(device)
}

export const switchPlayer = async (newType) => {
	type = newType
}

export const saveState = async () => {
	return withPlayer((player) => player.saveState(), { position: 0, isPlaying: false })()
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
	reconcileState,
	connect,
	disconnect,
	switchPlayer,
	loadSong,
	State,
	...core,
}
