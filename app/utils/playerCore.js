import { getApi, getApiNetworkFirst } from '~/utils/api'
import { filterExcluded, refreshExcludedSongIds } from '~/utils/exclusions'
import { saveQueue } from '~/utils/tools'
import logger from '~/utils/logger'

// Song navigation + queue mutations shared by every player backend.
// createSongControls takes the only platform-specific pieces: loadSong, stopSong.

// Single source of truth for "the track just ended". This decision used to be written out
// five times (servicePlayback, playerCast, playerUpnp, player.web, playerCore) and the copies
// had drifted: cast + upnp seeked to 0 without resuming (repeat-one stalled dead), web had no
// stop branch at all, and the end-of-queue predicate was duplicated with and without the
// radio/up-next guards. Only the decision lives here; the mechanics stay per-backend.
export const endOfTrackAction = (song) => {
	if (!song?.queue?.length) return 'none'
	if (song.songInfo?.id === 'tuktuktuk') return 'reset'
	if (song.actionEndOfSong === 'repeat') return 'repeat'
	if (!global.repeatQueue && !song.radioMode && song.index >= song.queue.length - 1 && !song.upNext?.length) return 'stop'
	return 'next'
}

// scrobble for a real end of playback; failures are swallowed (offline / server down).
export const scrobbleTrack = (config, song, submission) => {
	const id = song?.songInfo?.id
	if (!id) return Promise.resolve()
	return getApi(config, 'scrobble', { id, submission }).catch(() => { })
}

// Stop at the end of a queue, and remember that we did. Without the flag the play button
// was a dead end: isSongLoad stayed true, so pressing play called resumeSong() on an
// already-ENDED track and nothing happened.
export const stopAtQueueEnd = (songDispatch, stop) => {
	songDispatch({ type: 'setQueueEnded', value: true })
	return stop()
}

// ponytail: uniform top-up — library-wide randoms regardless of where the shuffle
// started. Context-aware refills (genre/artist) would need serializable fetchers.
const extendRadio = async (config, song, songDispatch) => {
	try {
		// ponytail: refresh exclusions per top-up — the memory set stays stale for
		// radio started from Genre/Artist (only Home random refreshes on press).
		await refreshExcludedSongIds(config)
		const known = new Set(song.queue.map(track => track.id))
		let fresh = []
		for (const size of [50, 200]) {
			const json = await getApiNetworkFirst(config, 'getRandomSongs', `size=${size}`)
			// getRandomSongs can return the same id twice in one page, and nothing else
			// filters it — those duplicates played back-to-back and read as "looping".
			fresh = (json.randomSongs?.song || []).filter(track => !known.has(track.id))
			if (fresh.length) break
		}
		const songs = await filterExcluded(config, fresh)
		const added = []
		songs.forEach(track => {
			if (known.has(track.id)) return
			known.add(track.id)
			added.push(track)
		})
		added.forEach(track => songDispatch({ type: 'addToQueue', track }))
		return added.length > 0
	} catch {
		return false
	}
}

export const createSongControls = ({ loadSong, stopSong = async () => { } }) => {
	// ponytail: dedupe in-flight loads of the same track — a second skip (auto-advance
	// during a stale load window, Bluetooth double event, fast double-tap) must sync
	// state instead of issuing a second load that restarts the song. Per-queue if a
	// load ever becomes queue-scoped.
	let loadingKey = null

	const setIndex = async (config, songDispatch, queue, index, options = {}) => {
		if (!queue || index < 0 || index >= queue.length) return
		const key = queue[index]?.id
		logger.info('Song', `setIndex ${index} (${key})${loadingKey === key ? ' DEDUPE-skips-load' : ''}`)
		if (loadingKey === key) {
			songDispatch({ type: 'setIndex', index, clearUpNext: options.clearUpNext, clearRadio: options.clearRadio })
			return
		}
		loadingKey = key
		try {
			await loadSong(config, queue, index)
		} finally {
			if (loadingKey === key) loadingKey = null
		}
		songDispatch({ type: 'setIndex', index, clearUpNext: options.clearUpNext, clearRadio: options.clearRadio })
	}

	const playSong = async (config, songDispatch, queue, index) => {
		await loadSong(config, queue, index)
		songDispatch({ type: 'setQueue', queue, index })
		songDispatch({ type: 'setActionEndOfSong', action: 'next' })
		saveQueue(config, queue, index)
	}

	// repeat-one is a per-track mode: clear it BEFORE awaiting the load. Clearing it
	// afterwards left a window where a natural PlaybackQueueEnded still saw
	// actionEndOfSong === 'repeat' and seeked the freshly loaded track back to 0.
	const clearRepeatOne = async (song, songDispatch) => {
		if (song.actionEndOfSong === 'repeat') await setRepeat(songDispatch, 'next')
	}

	const nextSong = async (config, song, songDispatch) => {
		logger.info('Song', `nextSong from idx=${song.index}/${song.queue?.length} upNext=${song.upNext?.length} action=${song.actionEndOfSong} radio=${!!song.radioMode}`)
		await clearRepeatOne(song, songDispatch)
		if (song.upNext?.length) {
			const track = song.upNext[0]
			songDispatch({ type: 'nextUpNext' })
			await loadSong(config, [track], 0)
			return
		}
		if (song.queue?.length) {
			if (song.index >= song.queue.length - 1) {
				// radio session: top the queue up instead of stopping/wrapping — even
				// with repeatQueue ON, radio must keep pulling new songs; read global.song —
				// the closure copy is stale once addToQueue dispatches land
				if (song.radioMode && await extendRadio(config, song, songDispatch)) {
					logger.info('Song', 'nextSong radio topped up')
					return setIndex(config, songDispatch, global.song.queue, global.song.index + 1)
				}
				// A failed top-up must NOT silently wrap. With repeatQueue off that replayed
				// the same N songs forever, which is what "the playlist loops" looked like.
				if (!global.repeatQueue) {
					logger.info('Song', 'nextSong -> end of queue, stop')
					return stopAtQueueEnd(songDispatch, stopSong)
				}
			}
			await setIndex(config, songDispatch, song.queue, (song.index + 1) % song.queue.length)
		}
	}

	const previousSong = async (config, song, songDispatch) => {
		await clearRepeatOne(song, songDispatch)
		if (song.queue?.length) {
			if (!global.repeatQueue && song.index === 0) return
			await setIndex(config, songDispatch, song.queue, (song.queue.length + song.index - 1) % song.queue.length)
		}
	}

	return { setIndex, playSong, nextSong, previousSong }
}

export const setRepeat = (songDispatch, action) => {
	songDispatch({ type: 'setActionEndOfSong', action })
}

export const secondToTime = (second) => {
	if (!second) return '00:00'
	if (second === Infinity) return '∞:∞'
	return `${String((second - second % 60) / 60).padStart(2, '0')}:${String((second - second % 1) % 60).padStart(2, '0')}`
}

export const removeFromQueue = (songDispatch, index) => {
	songDispatch({ type: 'removeFromQueue', index })
}

// when index is null, add to the end of the queue
export const addToQueue = (songDispatch, track, index = null) => {
	songDispatch({ type: 'addToQueue', track, index })
}

// atStart: insert at the front of the "up next" list (play next), else append (add to queue)
export const addToUpNext = (songDispatch, track, atStart = false) => {
	songDispatch({ type: 'addToUpNext', track, atStart })
}

export const removeFromUpNext = (songDispatch, index) => {
	songDispatch({ type: 'removeFromUpNext', index })
}

export const moveUpNext = (songDispatch, from, to) => {
	songDispatch({ type: 'moveUpNext', from, to })
}

export const moveInQueue = (songDispatch, from, to) => {
	songDispatch({ type: 'moveInQueue', from, to })
}

// fromList/toList: 'up' (up next) or 'queue' (main queue)
export const moveTrack = (songDispatch, { fromList, from, toList, to }) => {
	if (fromList === toList) {
		if (fromList === 'up') songDispatch({ type: 'moveUpNext', from, to })
		else songDispatch({ type: 'moveInQueue', from, to })
	} else if (fromList === 'up') {
		songDispatch({ type: 'moveUpNextToQueue', from, to })
	} else {
		songDispatch({ type: 'moveQueueToUpNext', from, to })
	}
}
