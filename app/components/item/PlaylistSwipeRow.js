import React from 'react'
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native'
import Icon from 'react-native-vector-icons/FontAwesome'
import { useTranslation } from 'react-i18next'

import { useSettings } from '~/contexts/settings'
import { useTheme } from '~/contexts/theme'
import size from '~/styles/size'

const HINT_WIDTH = 80
const SWIPE_THRESHOLD = 60

// both directions are direct actions revealed as a hint during the drag
const SWIPE_ACTIONS = {
	queue: { icon: 'plus', labelKey: 'Queue' },
	next: { icon: 'play-circle', labelKey: 'Play next' },
	remove: { icon: 'trash-o', labelKey: 'Remove' },
}

const PlaylistSwipeRow = ({ onQueue, onNext, onRemove, children }) => {
	const { t } = useTranslation()
	const theme = useTheme()
	const settings = useSettings()
	const translateX = React.useRef(new Animated.Value(0)).current

	// everything the gesture handlers need lives in a ref: rows are recycled by
	// LegendList, so closures captured at PanResponder creation would go stale
	const stateRef = React.useRef({})
	stateRef.current = { onQueue, onNext, onRemove, swipeRight: settings.swipeRightAction, swipeLeft: settings.swipeLeftAction }

	const resolveAction = (name, st) => {
		if (name === 'menu') name = 'next' // legacy value from the removed action panel
		if (name === 'queue' && st.onQueue) return SWIPE_ACTIONS.queue
		if (name === 'next' && st.onNext) return SWIPE_ACTIONS.next
		if (name === 'remove' && st.onRemove) return SWIPE_ACTIONS.remove
		return null
	}

	const fire = (name, st) => {
		if (name === 'queue') st.onQueue?.()
		else if (name === 'next') st.onNext?.()
		else if (name === 'remove') st.onRemove?.()
	}

	const snapBack = () => {
		Animated.spring(translateX, {
			toValue: 0,
			useNativeDriver: false,
			friction: 10,
			tension: 140,
			overshootClamping: true,
		}).start()
	}

	const pan = React.useRef(PanResponder.create({
		onStartShouldSetPanResponder: () => false,
		onMoveShouldSetPanResponder: (_evt, g) => {
			const st = stateRef.current
			if (!(resolveAction(st.swipeRight, st) || resolveAction(st.swipeLeft, st))) return false
			return Math.abs(g.dx) > 5 && Math.abs(g.dx) > Math.abs(g.dy)
		},
		onPanResponderGrant: () => translateX.stopAnimation(),
		onPanResponderMove: (_evt, g) => {
			translateX.setValue(Math.min(120, Math.max(-120, g.dx)))
		},
		onPanResponderRelease: (_evt, g) => {
			const st = stateRef.current
			if (g.dx > SWIPE_THRESHOLD) {
				if (resolveAction(st.swipeRight, st)) fire(st.swipeRight, st)
			} else if (g.dx < -SWIPE_THRESHOLD) {
				if (resolveAction(st.swipeLeft, st)) fire(st.swipeLeft, st)
			}
			snapBack()
		},
		onPanResponderTerminate: () => snapBack(),
	})).current

	const rightAction = resolveAction(settings.swipeRightAction, stateRef.current)
	const leftAction = resolveAction(settings.swipeLeftAction, stateRef.current)

	const renderHint = (action, style) => (
		<View style={[styles.hint, style, { backgroundColor: theme.secondaryBack }]}>
			<Icon name={action.icon} size={size.icon.small} color={theme.primaryTouch} />
			<Text style={[styles.actionText, { color: theme.primaryText }]}>{t(action.labelKey)}</Text>
		</View>
	)

	return (
		<View style={{ position: 'relative' }}>
			{rightAction && renderHint(rightAction, styles.hintLeft)}
			{leftAction && renderHint(leftAction, styles.hintRight)}
			<Animated.View {...pan.panHandlers} style={{ transform: [{ translateX }], backgroundColor: theme.primaryBack }}>
				{children}
			</Animated.View>
		</View>
	)
}

const styles = StyleSheet.create({
	hint: {
		position: 'absolute',
		top: 0,
		bottom: 0,
		width: HINT_WIDTH,
		justifyContent: 'center',
		alignItems: 'center',
		gap: 4,
		borderRadius: 4,
	},
	hintLeft: {
		left: 0,
	},
	hintRight: {
		right: 0,
	},
	actionText: {
		color: '#fff',
		fontSize: 11,
		textAlign: 'center',
	},
})

export default PlaylistSwipeRow
