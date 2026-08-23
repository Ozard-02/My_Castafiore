import { saveQueue } from '~/utils/tools'

// Song navigation + queue mutations shared by every player backend.
// createSongControls takes the only platform-specific piece: loadSong.
export const createSongControls = ({ loadSong }) => {
	const setIndex = async (config, songDispatch, queue, index) => {
		if (queue && index >= 0 && index < queue.length) {
			await loadSong(config, queue, index)
			songDispatch({ type: 'setIndex', index })
		}
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
			if (!global.repeatQueue && song.index === song.queue.length - 1) return
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
