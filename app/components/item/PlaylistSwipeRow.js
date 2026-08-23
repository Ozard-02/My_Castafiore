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

	const handlers = { queue: onQueue, next: onNext, remove: onRemove }
	const resolveAction = (name) => {
		if (name === 'menu') return onRemove || onNext ? { menu: true } : null
		if (SWIPE_ACTIONS[name] && handlers[name]) return SWIPE_ACTIONS[name]
		return null
	}
	const rightAction = resolveAction(settings.swipeRightAction)
	const leftResolved = resolveAction(settings.swipeLeftAction)
	const leftIsMenu = !!leftResolved?.menu
	const leftHint = leftIsMenu ? null : leftResolved
	const swipeEnabled = !!(rightAction || leftResolved)

	const stateRef = React.useRef({ open, onOpen, onClose })
	stateRef.current = { open, onOpen, onClose }

	const fire = (name) => handlers[name]?.()

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
		onMoveShouldSetPanResponder: swipeEnabled
			? (_evt, g) => Math.abs(g.dx) > 5 && Math.abs(g.dx) > Math.abs(g.dy)
			: undefined,
		onPanResponderGrant: () => translateX.stopAnimation(),
		onPanResponderMove: (_evt, g) => {
			const start = stateRef.current.open ? -ACTION_WIDTH : 0
			translateX.setValue(Math.min(120, Math.max(leftIsMenu ? -ACTION_WIDTH : -120, start + g.dx)))
		},
		onPanResponderRelease: (_evt, g) => {
			const start = stateRef.current.open ? -ACTION_WIDTH : 0
			const total = start + g.dx
			if (total > SWIPE_THRESHOLD) {
				if (rightAction) fire(settings.swipeRightAction)
				stateRef.current.onClose()
				animateTo(0)
			} else if (total < -(leftIsMenu ? ACTION_WIDTH / 2 : SWIPE_THRESHOLD)) {
				if (leftIsMenu) {
					stateRef.current.onOpen()
					animateTo(-ACTION_WIDTH)
				} else {
					if (leftHint) fire(settings.swipeLeftAction)
					stateRef.current.onClose()
					animateTo(0)
				}
			} else {
				stateRef.current.onClose()
				animateTo(stateRef.current.open ? -ACTION_WIDTH : 0)
			}
		},
		onPanResponderTerminate: () => {
			stateRef.current.onClose()
			animateTo(stateRef.current.open ? -ACTION_WIDTH : 0)
		},
	})).current

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
