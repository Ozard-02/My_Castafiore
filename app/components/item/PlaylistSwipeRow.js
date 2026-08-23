import React from 'react'
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native'
import Icon from 'react-native-vector-icons/FontAwesome'
import { useTranslation } from 'react-i18next'

import { useSettings } from '~/contexts/settings'
import { useTheme } from '~/contexts/theme'
import size from '~/styles/size'

const ACTION_WIDTH = 160
const HINT_WIDTH = 80
const SWIPE_THRESHOLD = 60

// direct swipe actions; 'menu' (left only) opens the action panel, 'none' disables
const SWIPE_ACTIONS = {
	queue: { icon: 'plus', labelKey: 'Queue' },
	next: { icon: 'play-circle', labelKey: 'Play next' },
	remove: { icon: 'trash-o', labelKey: 'Remove' },
}

const PlaylistSwipeRow = ({ open, onOpen, onClose, onQueue, onNext, onRemove, children }) => {
	const { t } = useTranslation()
	const theme = useTheme()
	const settings = useSettings()
	const translateX = React.useRef(new Animated.Value(0)).current

	// everything the gesture handlers need lives in a ref: rows are recycled by
	// LegendList, so closures captured at PanResponder creation would go stale
	const stateRef = React.useRef({})
	stateRef.current = { open, onOpen, onClose, onQueue, onNext, onRemove, swipeRight: settings.swipeRightAction, swipeLeft: settings.swipeLeftAction }

	// 'menu' needs a parent-managed open state (onOpen); without it the direction is disabled
	const resolveAction = (name, st) => {
		if (name === 'menu') return (st.onRemove || st.onNext) && st.onOpen ? { menu: true } : null
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

	const animateTo = React.useCallback((value) => {
		Animated.spring(translateX, {
			toValue: value,
			useNativeDriver: false,
			friction: 10,
			tension: 140,
			overshootClamping: true,
		}).start()
	}, [translateX])

	React.useEffect(() => {
		animateTo(open ? -ACTION_WIDTH : 0)
	}, [open, animateTo])

	const pan = React.useRef(PanResponder.create({
		onStartShouldSetPanResponder: () => false,
		onMoveShouldSetPanResponder: (_evt, g) => {
			const st = stateRef.current
			if (!(resolveAction(st.swipeRight, st) || resolveAction(st.swipeLeft, st))) return false
			return Math.abs(g.dx) > 5 && Math.abs(g.dx) > Math.abs(g.dy)
		},
		onPanResponderGrant: () => translateX.stopAnimation(),
		onPanResponderMove: (_evt, g) => {
			const st = stateRef.current
			const leftIsMenu = !!resolveAction(st.swipeLeft, st)?.menu
			const start = st.open ? -ACTION_WIDTH : 0
			translateX.setValue(Math.min(120, Math.max(leftIsMenu ? -ACTION_WIDTH : -120, start + g.dx)))
		},
		onPanResponderRelease: (_evt, g) => {
			const st = stateRef.current
			const rightAction = resolveAction(st.swipeRight, st)
			const leftResolved = resolveAction(st.swipeLeft, st)
			const leftIsMenu = !!leftResolved?.menu
			const start = st.open ? -ACTION_WIDTH : 0
			const total = start + g.dx
			if (total > SWIPE_THRESHOLD) {
				if (rightAction) fire(st.swipeRight, st)
				st.onClose?.()
				animateTo(0)
			} else if (total < -(leftIsMenu ? ACTION_WIDTH / 2 : SWIPE_THRESHOLD)) {
				if (leftIsMenu) {
					st.onOpen?.()
					animateTo(-ACTION_WIDTH)
				} else {
					if (leftResolved) fire(st.swipeLeft, st)
					st.onClose?.()
					animateTo(0)
				}
			} else {
				st.onClose?.()
				animateTo(st.open ? -ACTION_WIDTH : 0)
			}
		},
		onPanResponderTerminate: () => {
			const st = stateRef.current
			st.onClose?.()
			animateTo(st.open ? -ACTION_WIDTH : 0)
		},
	})).current

	// static layers resolve at render time (settings/props changes re-render anyway)
	const rightAction = resolveAction(settings.swipeRightAction, stateRef.current)
	const leftResolved = resolveAction(settings.swipeLeftAction, stateRef.current)
	const leftIsMenu = !!leftResolved?.menu
	const leftHint = leftIsMenu ? null : leftResolved

	const renderHint = (action, style) => (
		<View style={[styles.hint, style, { backgroundColor: theme.secondaryBack }]}>
			<Icon name={action.icon} size={size.icon.small} color={theme.primaryTouch} />
			<Text style={[styles.actionText, { color: theme.primaryText }]}>{t(action.labelKey)}</Text>
		</View>
	)

	return (
		<View style={{ position: 'relative' }}>
			{rightAction && renderHint(rightAction, styles.hintLeft)}
			{leftIsMenu ? (
				<View style={[styles.actions, { width: ACTION_WIDTH, backgroundColor: theme.secondaryBack }]}>
					{onRemove && (
						<Pressable style={[styles.action, { backgroundColor: '#b3261e' }]} onPress={() => { onClose(); onRemove() }}>
							<Icon name="trash-o" size={size.icon.small} color="#fff" />
							<Text style={styles.actionText}>{t('Remove')}</Text>
						</Pressable>
					)}
					{onNext && (
						<Pressable style={[styles.action, { backgroundColor: theme.primaryTouch }]} onPress={() => { onClose(); onNext() }}>
							<Icon name="play-circle" size={size.icon.small} color="#fff" />
							<Text style={styles.actionText}>{t('Play next')}</Text>
						</Pressable>
					)}
				</View>
			) : leftHint ? renderHint(leftHint, styles.hintRight) : null}
			<Animated.View {...pan.panHandlers} style={{ transform: [{ translateX }], backgroundColor: theme.primaryBack }}>
				{children}
				{open && <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />}
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
	actions: {
		position: 'absolute',
		top: 0,
		bottom: 0,
		right: 0,
		flexDirection: 'row',
		borderRadius: 4,
		overflow: 'hidden',
	},
	action: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		paddingHorizontal: 4,
		gap: 4,
	},
	actionText: {
		color: '#fff',
		fontSize: 11,
		textAlign: 'center',
	},
})

export default PlaylistSwipeRow
