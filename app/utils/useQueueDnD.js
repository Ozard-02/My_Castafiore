import React from 'react'
import Player from '~/utils/player'
import size from '~/styles/size'

const useQueueDnD = (song, songDispatch, { bottomAligned = false, scrollAnimated = false } = {}) => {
	const scroll = React.useRef(null)
	const upNextScroll = React.useRef(null)
	const queueOffset = React.useRef(0)
	const queueViewport = React.useRef(0)
	const upNextOffset = React.useRef(0)
	const upNextViewport = React.useRef(0)
	const queueBoxY = React.useRef(0)
	const queueBoxH = React.useRef(0)
	const upNextBoxY = React.useRef(0)
	const upNextBoxH = React.useRef(0)

	// Anchor the rotation on where songInfo actually sits in the queue, not on song.index.
	// nextUpNext (Up next playback) shifts songInfo without moving index, so index was a
	// stale slot and the queue pane rotated around the wrong song. Falls back to song.index
	// when songInfo is not in the queue at all (a radio/Up-next-only track).
	const anchor = song.queue?.findIndex((item) => item.id === song.songInfo?.id) ?? -1
	const currentIndex = anchor === -1 ? song.index : anchor
	const isCurrentInQueue = anchor !== -1
	// Display the queue rotated: the current song is pinned above, so the list starts at the
	// next song and the songs before it wrap to the bottom (real queue stays the source of truth).
	const queueItems = React.useMemo(() => {
		if (!song.queue) return []
		if (!isCurrentInQueue) return song.queue
		return [...song.queue.slice(currentIndex + 1), ...song.queue.slice(0, currentIndex)]
	}, [isCurrentInQueue, song.queue, currentIndex])
	const rowHeight = size.image.small + 10

	const queueRealIndex = React.useCallback((i) => {
		if (!isCurrentInQueue) return i
		return (currentIndex + 1 + i) % song.queue.length
	}, [isCurrentInQueue, currentIndex, song.queue?.length])
	const displayToReal = React.useCallback((list, i) => (list === 'queue' ? queueRealIndex(i) : i), [queueRealIndex])

	// Row keys that survive rotation, reorder and duplicate tracks. Plain ids collide when
	// the same song is queued twice (React warns and recycles the wrong row); plain indices
	// keep the previous occupant's per-row state (SongItem's download/cloud icon) after the
	// list rotates. id + occurrence number is stable and unique.
	const withOccurrence = React.useCallback((list) => {
		const seen = {}
		return (list || []).map((item, index) => {
			const id = item?.id ?? index
			const n = seen[id] ?? 0
			seen[id] = n + 1
			return `${id}-${n}`
		})
	}, [])
	const queueKeys = React.useMemo(() => withOccurrence(queueItems), [withOccurrence, queueItems])
	const upNextKeys = React.useMemo(() => withOccurrence(song.upNext), [withOccurrence, song.upNext])

	const lists = React.useMemo(() => ({
		up: { ref: upNextScroll, boxY: upNextBoxY, boxH: upNextBoxH, offsetRef: upNextOffset, viewportRef: upNextViewport, len: song.upNext?.length || 0 },
		queue: { ref: scroll, boxY: queueBoxY, boxH: queueBoxH, offsetRef: queueOffset, viewportRef: queueViewport, len: queueItems.length, bottomAligned },
	}), [song.upNext?.length, queueItems.length, bottomAligned])

	const handleMove = React.useCallback((m) => {
		Player.moveTrack(songDispatch, { fromList: m.fromList, from: displayToReal(m.fromList, m.from), toList: m.toList, to: displayToReal(m.toList, m.to) })
	}, [songDispatch, displayToReal])

	React.useEffect(() => {
		if (isCurrentInQueue && queueItems.length > 0) scroll.current?.scrollToIndex({ index: 0, animated: scrollAnimated, viewOffset: 0, viewPosition: 0 })
	}, [currentIndex, queueItems.length, isCurrentInQueue, scrollAnimated])

	return { scroll, upNextScroll, queueOffset, queueViewport, upNextOffset, upNextViewport, queueBoxY, queueBoxH, upNextBoxY, upNextBoxH, rowHeight, isCurrentInQueue, queueItems, queueKeys, upNextKeys, queueRealIndex, lists, handleMove }
}

export default useQueueDnD
