import React from 'react'
import { Animated, PanResponder, View } from 'react-native'
import Icon from 'react-native-vector-icons/FontAwesome'

import { useTheme } from '~/contexts/theme'
import size from '~/styles/size'

const EDGE = 40
const STEP = 24

// ponytail: row dragged by a grab handle; list scrolls near edges (scroll-compensated translate)
const QueueDragRow = ({ children, dataIndex, rowHeight, listRef, offsetRef, viewportRef, blockStart, blockEnd, onMove }) => {
	const theme = useTheme()
	const translateY = React.useRef(new Animated.Value(0)).current
	const state = React.useRef({ active: false, startOffset: 0, scrollDelta: 0, target: dataIndex })

	const pan = React.useRef(PanResponder.create({
		onStartShouldSetPanResponder: () => true,
		onPanResponderGrant: () => {
			state.current.active = true
			state.current.startOffset = offsetRef.current
			state.current.scrollDelta = 0
			state.current.target = dataIndex
		},
		onPanResponderMove: (_evt, g) => {
			const s = state.current
			if (!s.active) return
			const viewport = viewportRef.current
			const relY = dataIndex * rowHeight - s.startOffset + g.dy
			let scroll = 0
			if (viewport && relY < EDGE) scroll = Math.min(STEP, (EDGE - relY) / 2)
			else if (viewport && relY > viewport - EDGE) scroll = -Math.min(STEP, (relY - (viewport - EDGE)) / 2)
			if (scroll) {
				s.scrollDelta += scroll
				listRef.current?.scrollToOffset({ offset: Math.max(0, offsetRef.current + scroll), animated: false })
			}
			translateY.setValue(g.dy - s.scrollDelta)
			s.target = Math.max(blockStart, Math.min(blockEnd, dataIndex + Math.round(g.dy / rowHeight)))
		},
		onPanResponderRelease: () => {
			const s = state.current
			if (!s.active) return
			s.active = false
			translateY.setValue(0)
			if (s.target !== dataIndex) onMove(dataIndex, s.target)
		},
		onPanResponderTerminate: () => {
			state.current.active = false
			translateY.setValue(0)
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
		<Animated.View style={{ transform: [{ translateY }] }}>
			{React.cloneElement(children, { handle })}
		</Animated.View>
	)
}

export default QueueDragRow
