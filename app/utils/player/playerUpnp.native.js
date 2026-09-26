import React from 'react'

import { getApi } from '~/utils/api'
import { endOfTrackAction, scrobbleTrack, stopAtQueueEnd } from '~/utils/playerCore'
import { urlCover, urlStream } from '~/utils/url'
import UPNP from '~/utils/remote/upnp'
import UpnpEvent, { Events } from '~/utils/remote/upnpEvents'
import State from '~/utils/playerState'

let device = null

const initPlayer = async (_songDispatch) => { }

const useEvent = (song, songDispatch, nextSong) => {
	React.useEffect(() => {
		let events = []

		events.push(UpnpEvent.addListener(Events.STATE_CHANGED, ({ state }) => {
			songDispatch({ type: 'setState', state })
		}))

		events.push(UpnpEvent.addListener(Events.TRACK_ENDED, async () => {
			const song = global.song
			const action = endOfTrackAction(song)
			if (action === 'none') return
			scrobbleTrack(global.config, song, true)
			if (action === 'repeat') {
				// seek alone leaves the renderer stopped — repeat-one has to resume too
				// (this branch used to only seek, so the track silently stopped)
				await UPNP.seek(device, 0)
				return UPNP.resume(device)
			}
			if (action === 'stop') return stopAtQueueEnd(songDispatch, () => UPNP.stop(device))
			if (action === 'reset') return UPNP.stop(device)
			nextSong(global.config, song, songDispatch)
		}))

		return () => events.forEach(unsub => unsub())
	}, [songDispatch])
}

const reload = async () => {
	// await TrackPlayer.retry()
}

const pauseSong = async () => {
	await UPNP.pause(device)
}

const resumeSong = async () => {
	await UPNP.resume(device)
}

const stopSong = async () => {
	await UPNP.stop(device)
}

const downloadSong = async (_song, _source = null) => { }

const downloadNextSong = async (_queue, _currentIndex) => { }

const loadSong = async (config, queue, index) => {
	const track = queue[index]

	getApi(config, 'scrobble', { id: track.id, submission: false })
		.catch(() => { })
	await UPNP.load(device,
		urlStream(config, track.id, global.streamFormat, global.maxBitRate),
		{
			title: track.title,
			artist: track.artist,
			album: track.album,
			coverUrl: track.coverArt ? urlCover(config, track) : '',
		}
	)
	await UPNP.resume(device)
}

const setPosition = async (position) => {
	if (position < 0 || !position) position = 0
	if (position === Infinity) return

	await UPNP.seek(device, position)
}

const setVolume = async (volume) => {
	if (volume > 1) volume = 1
	if (volume < 0) volume = 0
	await UPNP.setVolume(device, volume * 100)
}

const getVolume = async () => {
	const status = await UPNP.getDeviceStatus(device)
	return status ? status.volume / 100 : 1.0
}

const unloadSong = async () => { }
const tuktuktuk = async (_songDispatch) => { }

const updateVolume = () => { }
const updateTime = () => {
	const [progress, setProgress] = React.useState({
		position: 0,
		duration: 0
	})

	React.useEffect(() => {
		const unsubscribe = UpnpEvent.addListener(Events.PROGRESS_CHANGED, ({ position, duration }) => {
			setProgress({ position, duration })
		})

		return unsubscribe
	}, [])

	return progress
}

const isVolumeSupported = () => {
	return false
}

const resetAudio = (songDispatch) => {
	songDispatch({ type: 'reset' })
	UPNP.stop(device) // TODO: delete track
}

const switchServer = async (config) => {
	const song = global.song
	if (!song?.songInfo || !song.queue?.length) return
	const state = await saveState()
	await loadSong(config, song.queue, song.index)
	if (state.position > 0) await setPosition(state.position)
	if (state.isPlaying) await resumeSong()
	else await pauseSong()
}

const saveState = async () => {
	const progress = await UPNP.getPosition(device)
	const state = await UPNP.getState(device)
	return {
		position: progress.position || 0,
		isPlaying: state.state === State.Playing,
	}
}

const connect = async (newDevice) => {
	device = newDevice
	UPNP.connect(device)
}

const disconnect = async (disconnectedDevice) => {
	await UPNP.stop(disconnectedDevice)
	UPNP.disconnect(disconnectedDevice)
	if (device === disconnectedDevice) device = null
}

export default {
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
	switchServer,
	saveState,
	downloadNextSong,
	downloadSong,
	connect,
	disconnect,
}
