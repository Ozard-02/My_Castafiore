import React from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform, AppState } from 'react-native'

import Player from '~/utils/player'
import logger from '~/utils/logger'
import State from '~/utils/playerState'
import { shuffle } from '~/utils/tools'
import { SongContext, SongDispatchContext } from '~/contexts/song/context'

export const SongProvider = ({ children }) => {
	const [song, dispatch] = React.useReducer(songReducer, defaultSong)

	React.useEffect(() => {
		if (!song.isInit) {
			// Android may boot the playback service headless (from the notification) before
			// any Activity exists, which makes TrackPlayer.setupPlayer fail with
			// android_cannot_setup_player_in_background. Retry on every foreground until it
			// succeeds — the old code removed the listener after a single attempt, so one
			// early failure left the player un-setup for the whole session.
			const tryInit = () => {
				if (AppState.currentState === 'active' || Platform.OS !== 'android') {
					Player.initPlayer(dispatch)
				}
			}
			tryInit()
			if (Platform.OS !== 'android') return
			const subscription = AppState.addEventListener('change', (appState) => {
				if (appState === 'active') tryInit()
			})
			return () => {
				subscription.remove()
			}
		}
	}, [song.isInit, dispatch])

	// Background auto-advance + lock-screen skips run in the headless service and only
	// mutate global.song; re-sync React state against the native player when resuming,
	// so the UI doesn't lag the actual playback until a manual skip.
	React.useEffect(() => {
		if (!song.isInit) return
		const subscription = AppState.addEventListener('change', (appState) => {
			if (appState === 'active') {
				Player.reconcileState?.(dispatch)
			}
		})
		return () => {
			subscription.remove()
		}
	}, [song.isInit, dispatch])

	return (
		<SongDispatchContext.Provider value={dispatch}>
			<SongContext.Provider value={song}>
				{children}
			</SongContext.Provider>
		</SongDispatchContext.Provider>
	)
}

// Convert track Object to save cache space
const convertTrack = (track) => {
	return {
		id: track.id,
		title: track.title,
		artist: track.artist,
		artists: track.artists,
		artistId: track.artistId,
		album: track.album,
		albumId: track.albumId,
		duration: track.duration,
		coverArt: track.coverArt,
		track: track.track,
		starred: track.starred,
		userRating: track.userRating ?? track.rating ?? 0,
		size: track.size,
		index: track.index,
		mediaType: track.mediaType,
		// radio: convertToTrack derives isLiveStream from track.type, but the stored queue
		// track is what the downloader / TimeBar / OptionsQueue actually read — dropping
		// it here made the downloader try to cache live streams and showed a finite
		// duration for them.
		isLiveStream: track.isLiveStream ?? track.type === 'radio',
		albumArtists: track.albumArtists,
		discNumber: track.discNumber,
		// radio
		homePageUrl: track.homePageUrl,
		name: track.name,
		streamUrl: track.streamUrl,
	}
}

const newSong = (state, action, isCache = false) => {
	const song = {
		...state,
		...action,
	}
	global.song = song
	if (isCache) {
		AsyncStorage.setItem('song', JSON.stringify(song))
			.catch((error) => logger.error('newSong', 'Error saving song to AsyncStorage:', error))
	}
	return song
}

export const songReducer = (state, action) => {
	// Canonical base: background advances (headless service via fakeSongDispatch,
	// lock-screen skips) mutate global.song but never React's snapshot. Computing from
	// the stale snapshot lets an ordinary React dispatch (PlaybackState -> setState)
	// merge off the old index and revert global.song to a previous song — the "same song
	// restarts on skip" bug. Always transition from global.song.
	state = global.song ?? state
	switch (action.type) {
		case 'init':
			return newSong(state, {
				isInit: true,
			})
		case 'restore':
			return newSong(state, {
				queue: action.song.queue || null,
				upNext: action.song.upNext || [],
				songInfo: action.song.songInfo || null,
				index: action.song.index || 0,
				actionEndOfSong: action.song.actionEndOfSong || 'next',
				originalQueue: action.song.originalQueue || (action.song.actionEndOfSong === 'random' ? action.song.queue : null),
				radioMode: !!action.song.radioMode,
				queueEnded: !!action.song.queueEnded,
				isSongLoad: action.isSongLoad || false,
			})
		case 'setQueue': {
			const newQueue = action.queue.map((track) => convertTrack(track))
			return newSong(state, {
				songInfo: newQueue[action.index],
				index: action.index,
				queue: newQueue,
				// keepUpNext: a radio session restarting on a fresh pool must not silently
				// discard tracks the user queued for next
				upNext: action.keepUpNext ? (state.upNext || []) : [],
				originalQueue: null,
				radioMode: false,
				queueEnded: false,
				isSongLoad: true,
			}, true)
		}
		case 'setIndex':
			if (!state.queue || state.queue?.length <= action.index) return state
			// upNext/radioMode are only dropped on an explicit user jump (clearUpNext /
			// clearRadio from the queue view). Wiping them on every setIndex meant a plain
			// next/previous, a drag, or a resume-reconcile silently deleted the whole
			// "Up next" list and dropped the user out of a radio session.
			return newSong(state, {
				index: action.index,
				songInfo: state.queue[action.index],
				queueEnded: false,
				...(action.clearUpNext ? { upNext: [] } : {}),
				...(action.clearRadio ? { radioMode: false } : {}),
			}, true)
		case 'setState': {
			if (action.state === state.state || !action.state) return state
			return newSong(state, {
				state: action.state,
			})
		}
		case 'addToQueue': {
			if (!state.songInfo || !state.queue) return state
			const newQueue = [...state.queue]
			// A non-numeric index means "append". Guarding on `=== null` only used to let
			// `splice(undefined, 0, track)` through, and splice coerces undefined to 0 — so
			// extendRadio's 50-track top-up was prepended at the front in reverse order
			// instead of appended, leaving index pointing at a different track.
			if (typeof action.index !== 'number' || action.index < 0 || action.index >= newQueue.length) {
				newQueue.push(convertTrack(action.track))
			} else {
				newQueue.splice(action.index, 0, convertTrack(action.track))
			}

			return newSong(state, {
				queue: newQueue,
				index: (typeof action.index === 'number' && state.index >= action.index) ? state.index + 1 : state.index,
				originalQueue: state.originalQueue ? [...state.originalQueue, convertTrack(action.track)] : null,
			}, true)
		}
		case 'setRating': {
			if (!state.queue?.length) return state
			const newQueue = state.queue.map((track) => {
				if (track.id !== action.id) return track
				return {
					...track,
					...(action.rating === undefined ? {} : { userRating: action.rating, rating: action.rating }),
					...(action.starred === undefined ? {} : { starred: action.starred }),
				}
			})
			const songInfo = state.songInfo?.id === action.id ? {
				...state.songInfo,
				...(action.rating === undefined ? {} : { userRating: action.rating, rating: action.rating }),
				...(action.starred === undefined ? {} : { starred: action.starred }),
			} : state.songInfo
			return newSong(state, {
				queue: newQueue,
				songInfo,
			}, true)
		}
		case 'removeFromQueue': {
			if (!state.queue || state.queue.length <= action.index) return state
			const newQueue = [...state.queue]
			let newIndex = state.index
			const removed = newQueue[action.index]

			newQueue.splice(action.index, 1)
			if (newIndex >= action.index) newIndex--
			if (newIndex < 0) newIndex = 0
			return newSong(state, {
				queue: newQueue,
				index: newIndex,
				songInfo: newQueue[newIndex] || null,
				originalQueue: state.originalQueue ? state.originalQueue.filter((item) => item.id !== removed.id) : null,
			}, true)
		}
		case 'addToUpNext': {
			if (!state.songInfo || !state.queue) return state
			const tracks = (Array.isArray(action.track) ? action.track : [action.track]).map(convertTrack)
			const upNext = [...(state.upNext || [])]
			if (action.atStart) upNext.unshift(...tracks)
			else upNext.push(...tracks)
			return newSong(state, {
				upNext,
			}, true)
		}
		case 'nextUpNext': {
			if (!state.upNext?.length) return state
			const upNext = [...state.upNext]
			const songInfo = upNext.shift()
			return newSong(state, {
				songInfo,
				upNext,
			}, true)
		}
		case 'removeFromUpNext': {
			if (!state.upNext?.length || action.index < 0 || action.index >= state.upNext.length) return state
			const upNext = [...state.upNext]
			upNext.splice(action.index, 1)
			return newSong(state, {
				upNext,
			}, true)
		}
		case 'moveUpNext': {
			if (!state.upNext?.length) return state
			const from = action.from, to = action.to
			if (from === to || from < 0 || to < 0 || from >= state.upNext.length || to >= state.upNext.length) return state
			const upNext = [...state.upNext]
			const [moved] = upNext.splice(from, 1)
			upNext.splice(to, 0, moved)
			return newSong(state, {
				upNext,
			}, true)
		}
		case 'moveInQueue': {
			if (!state.queue?.length) return state
			const from = action.from, to = action.to
			if (from === to || from < 0 || to < 0 || from >= state.queue.length || to >= state.queue.length) return state
			const newQueue = [...state.queue]
			const [moved] = newQueue.splice(from, 1)
			newQueue.splice(to, 0, moved)
			let newIndex = state.index
			if (from === state.index) newIndex = to
			else if (from < state.index && to >= state.index) newIndex--
			else if (from > state.index && to <= state.index) newIndex++
			return newSong(state, {
				queue: newQueue,
				index: newIndex,
			}, true)
		}
		case 'moveUpNextToQueue': {
			if (!state.upNext?.length || !state.queue?.length) return state
			const from = action.from, to = action.to
			if (from < 0 || from >= state.upNext.length || to < 0 || to > state.queue.length) return state
			const upNext = [...state.upNext]
			const [moved] = upNext.splice(from, 1)
			const newQueue = [...state.queue]
			newQueue.splice(to, 0, moved)
			return newSong(state, {
				queue: newQueue,
				upNext,
				index: to <= state.index ? state.index + 1 : state.index,
				originalQueue: state.originalQueue ? [...state.originalQueue, moved] : null,
			}, true)
		}
		case 'moveQueueToUpNext': {
			if (!state.queue?.length) return state
			const from = action.from, to = action.to
			if (from === state.index || from < 0 || from >= state.queue.length || to < 0 || to > (state.upNext?.length || 0)) return state
			const newQueue = [...state.queue]
			const [moved] = newQueue.splice(from, 1)
			const upNext = [...(state.upNext || [])]
			upNext.splice(to, 0, moved)
			return newSong(state, {
				queue: newQueue,
				upNext,
				index: from < state.index ? state.index - 1 : state.index,
				originalQueue: state.originalQueue ? state.originalQueue.filter((item) => item.id !== moved.id) : null,
			}, true)
		}
		case 'syncGlobal':
			return newSong(state, {
				queue: action.song.queue,
				upNext: action.song.upNext || [],
				songInfo: action.song.songInfo,
				index: action.song.index,
				actionEndOfSong: action.song.actionEndOfSong,
				originalQueue: action.song.originalQueue || null,
			}, true)
		case 'setActionEndOfSong':
			if (['next', 'repeat', 'random'].indexOf(action.action) === -1) return state
			if (action.action === 'random') {
				if (state.queue?.length) {
					// first shuffle: preserve original; re-press: re-shuffle from the preserved original
					const baseQueue = state.actionEndOfSong === 'random' && state.originalQueue?.length
						? state.originalQueue
						: state.queue
					const shuffled = shuffle(baseQueue)
					const newIndex = shuffled.findIndex((track) => track.id === state.songInfo?.id)
					return newSong(state, {
						actionEndOfSong: action.action,
						queue: shuffled,
						index: newIndex === -1 ? 0 : newIndex,
						originalQueue: state.actionEndOfSong === 'random' && state.originalQueue?.length ? state.originalQueue : state.queue,
					}, true)
				}
			}
			if (state.actionEndOfSong === 'random' && state.originalQueue?.length) {
				const newIndex = state.originalQueue.findIndex((track) => track.id === state.songInfo?.id)
				return newSong(state, {
					actionEndOfSong: action.action,
					queue: state.originalQueue,
					index: newIndex === -1 ? 0 : newIndex,
					originalQueue: null,
				}, true)
			}
			return newSong(state, {
				actionEndOfSong: action.action,
			}, true)
		case 'setRadioMode':
			return newSong(state, { radioMode: !!action.value }, true)
		case 'setQueueEnded':
			return newSong(state, { queueEnded: !!action.value }, true)
		case 'reset':
			return newSong(state, {
				...defaultSong,
				isInit: true,
				isSongLoad: false,
			}, true)
		default:
			logger.error('songReducer', 'Unknown action', action)
			return state
	}
}

export const defaultSong = {
	isInit: false,
	songInfo: null,
	queue: null,
	upNext: [],
	index: 0,
	actionEndOfSong: 'next',
	originalQueue: null,
	radioMode: false,
	queueEnded: false,
	state: State.Stopped,
}
