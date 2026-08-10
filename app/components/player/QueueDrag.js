import React from 'react'
import { Animated, PanResponder, View } from 'react-native'
import Icon from 'react-native-vector-icons/FontAwesome'

import { useTheme } from '~/contexts/theme'
import size from '~/styles/size'

const EDGE = 40
const STEP = 24

const DragContext = React.createContext(null)

// ponytail: cross-section DnD — one manager for the whole queue view. Both lists are direct children of
// one container; their onLayout `boxY`/`boxH` (container-relative) plus the finger's `dy` give the drop
// target without any window-coordinate measurement (unreliable inside a Modal).
const QueueDragProvider = ({ lists, rowHeight, onMove, children }) => {
	const rows = React.useRef(new Map())
	const drag = React.useRef({ active: false, fromKey: null, fromList: null, fromIndex: -1, startOffset: 0, targetList: null, targetIndex: -1 })

	const register = React.useCallback((key, row) => {
		rows.current.set(key, row)
		return () => rows.current.delete(key)
	}, [])

	const startDrag = React.useCallback((key, list, index) => {
		const s = drag.current
		s.active = true
		s.fromKey = key
		s.fromList = list
		s.fromIndex = index
		s.startOffset = lists[list].offsetRef.current
		s.targetList = list
		s.targetIndex = index
		rows.current.forEach((row) => { row.setDrag(0) })
	}, [lists])

	const onDragMove = React.useCallback((key, dy) => {
		const s = drag.current
		if (!s.active || key !== s.fromKey) return
		const fromMeta = lists[s.fromList]
		const row = rows.current.get(key)
		const fingerY = fromMeta.boxY.current + s.fromIndex * rowHeight - s.startOffset + rowHeight / 2 + dy
		const upMeta = lists.up
		const upBottom = upMeta.boxY.current + upMeta.boxH.current
		let targetList = s.targetList ?? s.fromList
		if (upMeta.len > 0 && upBottom > 0) {
			if (targetList === 'up') {
				if (fingerY > upBottom + rowHeight / 2) targetList = 'queue'
			} else if (fingerY < upBottom - rowHeight / 2) {
				targetList = 'up'
			}
		} else {
			targetList = 'queue'
		}
		const meta = lists[targetList]
		let targetIndex = s.fromIndex
		if (meta.len > 0) {
			const bottomPad = meta.bottomAligned ? Math.max(0, meta.boxH.current - meta.len * rowHeight) : 0
			targetIndex = Math.max(0, Math.min(meta.len - 1, Math.floor((fingerY - meta.boxY.current - bottomPad + meta.offsetRef.current) / rowHeight)))
		}
		const localY = fingerY - meta.boxY.current
		let scroll = 0
		if (meta.viewportRef.current && localY < EDGE) scroll = -Math.min(STEP, (EDGE - localY) / 2)
		else if (meta.viewportRef.current && localY > meta.viewportRef.current - EDGE) scroll = Math.min(STEP, (localY - (meta.viewportRef.current - EDGE)) / 2)
		if (scroll) {
			meta.ref.current?.scrollToOffset({ offset: Math.max(0, meta.offsetRef.current + scroll), animated: false })
		}
		if (row) row.setDrag(dy)
		s.targetList = targetList
		s.targetIndex = targetIndex
		rows.current.forEach((r) => {
			let shift = 0
			if (r.list === targetList && r !== row) {
				if (targetList !== s.fromList) {
					shift = r.index >= targetIndex ? rowHeight : 0
				} else if (s.fromIndex < targetIndex) {
					shift = r.index > s.fromIndex && r.index <= targetIndex ? -rowHeight : 0
				} else if (s.fromIndex > targetIndex) {
					shift = r.index >= targetIndex && r.index < s.fromIndex ? rowHeight : 0
				}
			}
			r.setShift(shift)
		})
	}, [lists, rowHeight])

	const endDrag = React.useCallback((cancel) => {
		const s = drag.current
		if (!s.active) return
		if (!cancel && (s.targetList !== s.fromList || s.targetIndex !== s.fromIndex)) {
			onMove({ fromList: s.fromList, from: s.fromIndex, toList: s.targetList, to: s.targetIndex })
		}
		rows.current.forEach((r) => { r.setShift(0); r.setDrag(0) })
		s.active = false
	}, [onMove])

	const value = React.useMemo(() => ({ register, startDrag, onDragMove, endDrag }), [register, startDrag, onDragMove, endDrag])
	return (
		<DragContext.Provider value={value}>
			{children}
		</DragContext.Provider>
	)
}

const QueueDragRow = ({ children, list, index }) => {
	const theme = useTheme()
	const ctx = React.useContext(DragContext)
	const data = React.useRef({ list, index })
	data.current = { list, index }
	const key = `${list}-${index}`
	const dragY = React.useRef(new Animated.Value(0)).current
	const shiftY = React.useRef(new Animated.Value(0)).current
	const lastShift = React.useRef(0)
	const [lifted, setLifted] = React.useState(false)

	const setDrag = React.useCallback((v) => dragY.setValue(v), [dragY])
	const setShift = React.useCallback((v) => {
		if (v === lastShift.current) return
		lastShift.current = v
		Animated.spring(shiftY, { toValue: v, useNativeDriver: false, friction: 10, tension: 140, overshootClamping: true }).start()
	}, [shiftY])

	React.useEffect(() => ctx.register(key, { list, index, setDrag, setShift }), [ctx, key, list, index, setDrag, setShift])

	const pan = React.useRef(PanResponder.create({
		onStartShouldSetPanResponder: () => true,
		onPanResponderGrant: () => {
			const d = data.current
			setLifted(true)
			ctx.startDrag(key, d.list, d.index)
		},
		onPanResponderMove: (_evt, g) => {
			ctx.onDragMove(key, g.dy)
		},
		onPanResponderRelease: () => {
			setLifted(false)
			ctx.endDrag(false)
		},
		onPanResponderTerminate: () => {
			setLifted(false)
			ctx.endDrag(true)
		},
	})).current

	const handle = (
		<View
			{...pan.panHandlers}
			style={{ width: 32, alignItems: 'center', justifyContent: 'center', paddingStart: 6 }}
		>
			<Icon name="reorder" size={size.icon.small} color={theme.secondaryText} />
		</View>
	)

	return (
		<Animated.View
			style={[{
				transform: [{ translateY: dragY }, { translateY: shiftY }],
			}, lifted && { backgroundColor: theme.secondaryBack }]}
		>
			{React.cloneElement(children, { handle })}
		</Animated.View>
	)
}

export { QueueDragProvider }
export default QueueDragRow
