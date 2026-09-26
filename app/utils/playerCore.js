import { getApi, getApiNetworkFirst } from '~/utils/api'
import { filterExcluded, refreshExcludedSongIds } from '~/utils/exclusions'
import { saveQueue, shuffle } from '~/utils/tools'
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
	// a radio session never wraps, whatever repeatQueue says — wrapping is what replayed the
	// same batch in the same order. It advances through nextSong, which tops the stream up.
	if (song.radioMode) return 'next'
	if (!global.repeatQueue && song.index >= song.queue.length - 1 && !song.upNext?.length) return 'stop'
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

// Radio is a continuous stream, not a series of 50-track batches.
//
// It used to fetch 50 tracks and only top up once the last one ENDED, so the fetch happened
// in the gap between batches — an audible dead pause that made the selection sound chunked —
// and a failed top-up fell through to (index+1) % length, replaying the same 50 in the same
// order forever. Now the queue is topped up while tracks are still playing, and a radio
// session never wraps.
const RADIO_LOW_WATER = 10   // start refilling once fewer than this many tracks are unplayed
const RADIO_BATCH = 20       // refill cadence; never perceived as a unit
const RADIO_BATCH_MAX = 100  // fallback page size when a small library returns little
const RADIO_MAX_QUEUE = 200  // past this the session restarts instead of growing forever

let radioPending = null

const fetchRandoms = async (config, size) => {
	const json = await getApiNetworkFirst(config, 'getRandomSongs', `size=${size}`)
	return json.randomSongs?.song || []
}

// Returns the next tracks to sample. `#<user>-exclusive` playlists are filtered out of EVERY
// path here — the unseen pool and the repeat fallback alike — so an excluded track can never
// reach a shuffle session. Repeats are fine for a sampler; hearing the same 50 in the same
// order is not.
const radioPool = async (config, song, size) => {
	// the memory set is stale for sessions not started from Home (only the Home button
	// refreshes it on press), so refresh per top-up
	await refreshExcludedSongIds(config)
	const known = new Set(song.queue.map(track => track.id))
	const page = await fetchRandoms(config, size)
	const allowed = await filterExcluded(config, page)

	const unseen = []
	allowed.forEach(track => {
		if (known.has(track.id)) return
		// getRandomSongs can repeat an id inside one page; those played back-to-back
		known.add(track.id)
		unseen.push(track)
	})
	if (unseen.length) return unseen

	// Nothing new left (small library, or mostly excluded). Sample again from the whole
	// allowed set, reshuffled — a continuous sampler repeats, it doesn't replay a batch.
	return shuffle(allowed).slice(0, RADIO_BATCH_MAX)
}

// Shared by the low-water kick-off and the end-of-queue safety net: if a refill is already in
// flight both await the same promise, so the stream never stops just because a fetch started
// a few seconds earlier.
const refillRadio = (config, song, songDispatch) => {
	if (radioPending) return radioPending
	radioPending = (async () => {
		try {
			const added = await radioPool(config, song, RADIO_BATCH)
			if (!added.length) return false
			if (song.queue.length + added.length > RADIO_MAX_QUEUE) {
				// Restart the session on a fresh pool instead of growing without bound. Much
				// cheaper than trimming played tracks off the head, which would mean
				// re-deriving song.index, the queue rotation and every drag-and-drop index.
				logger.info('Song', `radio restarting (queue was ${song.queue.length})`)
				songDispatch({ type: 'setQueue', queue: added, index: 0, keepUpNext: true })
				songDispatch({ type: 'setRadioMode', value: true })
			} else {
				added.forEach(track => songDispatch({ type: 'addToQueue', track }))
			}
			return true
		} catch (error) {
			logger.error('radio', 'refill failed:', error?.message)
			return false
		} finally {
			radioPending = null
		}
	})()
	return radioPending
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
		// Top the stream up while tracks are still playing, not in the gap after the last
		// one — that gap is what made the selection sound like discrete batches. Not awaited:
		// the current track is still playing, and refillRadio de-dupes concurrent calls.
		if (song.radioMode && song.queue?.length - 1 - song.index < RADIO_LOW_WATER) {
			refillRadio(config, song, songDispatch)
		}
		if (song.upNext?.length) {
			const track = song.upNext[0]
			songDispatch({ type: 'nextUpNext' })
			await loadSong(config, [track], 0)
			return
		}
		if (song.queue?.length) {
			if (song.index >= song.queue.length - 1) {
				if (song.radioMode) {
					// Await the in-flight refill (a low-water kick-off may already be running).
					// If there is genuinely nothing to add, STOP. Falling through to
					// (index+1) % length is what replayed the same 50 tracks in the same order
					// whenever a top-up came back empty.
					if (await refillRadio(config, song, songDispatch)) {
						logger.info('Song', 'nextSong radio topped up')
						return setIndex(config, songDispatch, global.song.queue, global.song.index + 1)
					}
					logger.info('Song', 'nextSong -> radio pool exhausted, stop')
					return stopAtQueueEnd(songDispatch, stopSong)
				}
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
