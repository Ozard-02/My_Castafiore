import TrackPlayer, { Event, State } from "react-native-track-player"

import Player from "~/utils/player"
import { endOfTrackAction, scrobbleTrack, stopAtQueueEnd } from "~/utils/playerCore"
import { songReducer } from "~/contexts/song"
import logger from "~/utils/logger"

let lastScrobble = {
	id: null,
	time: 0,
}
let shouldPlay = false
let pauseTimer = null

const fakeSongDispatch = (action) => {
	songReducer(global.song, action)
}

// Prefer the live React dispatch so background advances reach the UI immediately;
// fall back to the fake (global-only) dispatch in cold headless starts where React is
// not mounted yet.
const getSongDispatch = () => global.songDispatch || fakeSongDispatch

module.exports = async () => {
	TrackPlayer.addEventListener(Event.RemotePlay, () => {
		logger.info('Playback', 'RemotePlay')
		return Player.resumeSong()
	})
	TrackPlayer.addEventListener(Event.RemotePause, () => {
		logger.info('Playback', 'RemotePause')
		return Player.pauseSong()
	})
	TrackPlayer.addEventListener(Event.RemoteNext, () => {
		logger.info('Playback', 'RemoteNext')
		return Player.nextSong(global.config, global.song, getSongDispatch())
			.then(() => logger.info('Playback', 'RemoteNext done'))
			.catch(e => logger.error('Playback', 'RemoteNext error', e?.message))
	})
	TrackPlayer.addEventListener(Event.RemotePrevious, () => {
		logger.info('Playback', 'RemotePrevious')
		return Player.previousSong(global.config, global.song, getSongDispatch())
			.then(() => logger.info('Playback', 'RemotePrevious done'))
			.catch(e => logger.error('Playback', 'RemotePrevious error', e?.message))
	})
	TrackPlayer.addEventListener(Event.RemoteSeek, (event) => {
		logger.info('Playback', `RemoteSeek ${event.position}`)
		return Player.setPosition(event.position)
	})
	TrackPlayer.addEventListener(Event.PlaybackState, (event) => {
		logger.info('Playback', `State=${event.state}`)
	})
	// This handles the interruptions like calls or notifications
	TrackPlayer.addEventListener(Event.RemoteDuck, (event) => {
		clearTimeout(pauseTimer)
		TrackPlayer.getPlaybackState()
			.then(({ state }) => {
				if (event.paused) {
					if (state === State.Playing) {
						if (event.permanent) {
							Player.stopSong()
							shouldPlay = false
						} else {
							TrackPlayer.setVolume(0.5)
							shouldPlay = true
							pauseTimer = setTimeout(async () => {
								Player.pauseSong()
							}, 5000)
						}
					}
				}
				else if (shouldPlay) {
					TrackPlayer.setVolume(1)
					Player.resumeSong()
					shouldPlay = false
				}
			})
	})
	TrackPlayer.addEventListener(Event.PlaybackQueueEnded, (_event) => {
		const song = global.song
		const action = endOfTrackAction(song)
		logger.info('Playback', `QueueEnded track=${song?.songInfo?.id} idx=${song?.index}/${song?.queue?.length} action=${song?.actionEndOfSong} radio=${!!song?.radioMode} repeatQ=${!!global.repeatQueue} upNext=${song?.upNext?.length} -> ${action}`)
		if (action === 'none') return
		if (action === 'reset') return Player.resetAudio(getSongDispatch())
		scrobbleTrack(global.config, song, true)
		if (action === 'repeat') {
			Player.setPosition(0)
			Player.resumeSong()
		} else if (action === 'stop') {
			logger.info('Playback', 'QueueEnded -> stop (end of queue)')
			stopAtQueueEnd(getSongDispatch(), () => Player.stopSong())
		} else {
			logger.info('Playback', 'QueueEnded -> nextSong')
			Player.nextSong(global.config, song, getSongDispatch())
				.then(() => logger.info('Playback', 'QueueEnded nextSong done'))
				.catch(e => logger.error('Playback', 'QueueEnded nextSong error', e?.message))
		}
	})
	TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, async (event) => {
		logger.info('Playback', `ActiveTrackChanged track=${event.track?.id} globalIdx=${global.song?.index} globalSong=${global.song?.songInfo?.id}`)
		if (event.track) {
			const now = Date.now()
			if (lastScrobble.id !== event.track.id || now - lastScrobble.time > 10 * 1000) {
				scrobbleTrack(global.config, { songInfo: event.track }, false)
				lastScrobble = {
					id: event.track.id,
					time: now,
				}
			}
		}
	})
	TrackPlayer.addEventListener(Event.PlaybackError, (error) => {
		logger.error('PlaybackError', error.code, error.message)
	})
}
