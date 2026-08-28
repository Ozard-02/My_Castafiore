import { getApiNetworkFirst } from '~/utils/api'
import { filterExcluded } from '~/utils/exclusions'
import { saveQueue } from '~/utils/tools'

// Song navigation + queue mutations shared by every player backend.
// createSongControls takes the only platform-specific piece: loadSong.

// ponytail: uniform top-up — library-wide randoms regardless of where the shuffle
// started. Context-aware refills (genre/artist) would need serializable fetchers.
const extendRadio = async (config, song, songDispatch) => {
	try {
		const json = await getApiNetworkFirst(config, 'getRandomSongs', 'size=50')
		const known = new Set(song.queue.map(track => track.id))
		const fresh = (json.randomSongs?.song || []).filter(track => !known.has(track.id))
		const songs = await filterExcluded(config, fresh)
		songs.forEach(track => songDispatch({ type: 'addToQueue', track }))
		return songs.length > 0
	} catch {
		return false
	}
}

export const createSongControls = ({ loadSong }) => {
	// ponytail: dedupe in-flight loads of the same track — a second skip (auto-advance
	// during a stale load window, Bluetooth double event, fast double-tap) must sync
	// state instead of issuing a second load that restarts the song. Per-queue if a
	// load ever becomes queue-scoped.
	let loadingKey = null

	const setIndex = async (config, songDispatch, queue, index) => {
		if (!queue || index < 0 || index >= queue.length) return
		const key = queue[index]?.id
		if (loadingKey === key) {
			songDispatch({ type: 'setIndex', index })
			return
		}
		loadingKey = key
		try {
			await loadSong(config, queue, index)
		} finally {
			if (loadingKey === key) loadingKey = null
		}
		songDispatch({ type: 'setIndex', index })
	}

	const playSong = async (config, songDispatch, queue, index) => {
		await loadSong(config, queue, index)
		songDispatch({ type: 'setQueue', queue, index })
		songDispatch({ type: 'setActionEndOfSong', action: 'next' })
		saveQueue(config, queue, index)
	}

	const nextSong = async (config, song, songDispatch) => {
		if (song.upNext?.length) {
			const track = song.upNext[0]
			songDispatch({ type: 'nextUpNext' })
			await loadSong(config, [track], 0)
			return
		}
		if (song.queue) {
			if (song.index === song.queue.length - 1) {
				// radio session: top the queue up instead of stopping/wrapping — even
				// with repeatQueue ON, radio must keep pulling new songs; read global.song —
				// the closure copy is stale once addToQueue dispatches land
				if (song.radioMode) {
					if (!(await extendRadio(config, song, songDispatch))) return
					return setIndex(config, songDispatch, global.song.queue, global.song.index + 1)
				}
				if (!global.repeatQueue) return
			}
			await setIndex(config, songDispatch, song.queue, (song.index + 1) % song.queue.length)
			if (song.actionEndOfSong === 'repeat') await setRepeat(songDispatch, 'next')
		}
	}

	const previousSong = async (config, song, songDispatch) => {
		if (song.queue) {
			if (!global.repeatQueue && song.index === 0) return
			await setIndex(config, songDispatch, song.queue, (song.queue.length + song.index - 1) % song.queue.length)
			if (song.actionEndOfSong === 'repeat') await setRepeat(songDispatch, 'next')
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
