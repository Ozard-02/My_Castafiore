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

	const isCurrentInQueue = song.songInfo && song.queue?.some((item) => item.id === song.songInfo.id)
	// Display the queue rotated: the current song is pinned above, so the list starts at the
	// next song and the songs before it wrap to the bottom (real queue stays the source of truth).
	const queueItems = React.useMemo(() => {
		if (!song.queue) return []
		if (!isCurrentInQueue) return song.queue
		return [...song.queue.slice(song.index + 1), ...song.queue.slice(0, song.index)]
	}, [isCurrentInQueue, song.queue, song.index])
	const rowHeight = size.image.small + 10

	const queueRealIndex = React.useCallback((i) => {
		if (!isCurrentInQueue) return i
		return (song.index + 1 + i) % song.queue.length
	}, [isCurrentInQueue, song.index, song.queue?.length])
	const displayToReal = React.useCallback((list, i) => (list === 'queue' ? queueRealIndex(i) : i), [queueRealIndex])

	const lists = React.useMemo(() => ({
		up: { ref: upNextScroll, boxY: upNextBoxY, boxH: upNextBoxH, offsetRef: upNextOffset, viewportRef: upNextViewport, len: song.upNext?.length || 0 },
		queue: { ref: scroll, boxY: queueBoxY, boxH: queueBoxH, offsetRef: queueOffset, viewportRef: queueViewport, len: queueItems.length, bottomAligned },
	}), [song.upNext?.length, queueItems.length, bottomAligned])

	const handleMove = React.useCallback((m) => {
		Player.moveTrack(songDispatch, { fromList: m.fromList, from: displayToReal(m.fromList, m.from), toList: m.toList, to: displayToReal(m.toList, m.to) })
	}, [songDispatch, displayToReal])

	React.useEffect(() => {
		if (isCurrentInQueue && queueItems.length > 0) scroll.current?.scrollToIndex({ index: 0, animated: scrollAnimated, viewOffset: 0, viewPosition: 0 })
	}, [song.index, queueItems.length, isCurrentInQueue, scrollAnimated])

	return { scroll, upNextScroll, queueOffset, queueViewport, upNextOffset, upNextViewport, queueBoxY, queueBoxH, upNextBoxY, upNextBoxH, rowHeight, isCurrentInQueue, queueItems, queueRealIndex, lists, handleMove }
}

export default useQueueDnD
