import React from 'react'
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native'
import Icon from 'react-native-vector-icons/FontAwesome'
import { useTranslation } from 'react-i18next'

import { useTheme } from '~/contexts/theme'
import size from '~/styles/size'

const ACTION_WIDTH = 160
const SWIPE_THRESHOLD = 60

const PlaylistSwipeRow = ({ open, onOpen, onClose, onEnqueue, onPlayNext, onRemove, children }) => {
	const { t } = useTranslation()
	const theme = useTheme()
	const translateX = React.useRef(new Animated.Value(0)).current

	const stateRef = React.useRef({ open, onOpen, onClose, onEnqueue, onPlayNext, onRemove })
	stateRef.current = { open, onOpen, onClose, onEnqueue, onPlayNext, onRemove }

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
		onMoveShouldSetPanResponder: (_evt, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
		onPanResponderGrant: () => translateX.stopAnimation(),
		onPanResponderMove: (_evt, g) => {
			const st = stateRef.current
			translateX.setValue((st.open ? -ACTION_WIDTH : 0) + g.dx)
		},
		onPanResponderRelease: (_evt, g) => {
			const st = stateRef.current
			const total = (st.open ? -ACTION_WIDTH : 0) + g.dx
			if (total > SWIPE_THRESHOLD) {
				st.onClose()
				st.onEnqueue()
				animateTo(0)
			} else if (total < -ACTION_WIDTH / 2) {
				st.onOpen()
				animateTo(-ACTION_WIDTH)
			} else {
				st.onClose()
				animateTo(st.open ? -ACTION_WIDTH : 0)
			}
		},
		onPanResponderTerminate: () => {
			const st = stateRef.current
			st.onClose()
			animateTo(st.open ? -ACTION_WIDTH : 0)
		},
	})).current

	return (
		<View style={{ position: 'relative' }}>
			{open && (
				<View style={[styles.actions, { width: ACTION_WIDTH, backgroundColor: theme.secondaryBack }]}>
					<Pressable style={[styles.action, { backgroundColor: 'red' }]} onPress={() => { onRemove() }}>
						<Icon name="trash-o" size={size.icon.small} color="#fff" />
						<Text style={styles.actionText}>{t('Remove from playlist')}</Text>
					</Pressable>
					<Pressable style={[styles.action, { backgroundColor: theme.primaryTouch }]} onPress={() => { onPlayNext() }}>
						<Icon name="indent" size={size.icon.small} color="#fff" />
						<Text style={styles.actionText}>{t('Play next')}</Text>
					</Pressable>
				</View>
			)}
			<Animated.View {...pan.panHandlers} style={{ transform: [{ translateX }] }}>
				{children}
				{open && <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />}
			</Animated.View>
		</View>
	)
}

const styles = StyleSheet.create({
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
