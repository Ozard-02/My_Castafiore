import React from 'react'
import { ActivityIndicator, Pressable, Text, View, StyleSheet } from 'react-native'
import Icon from 'react-native-vector-icons/FontAwesome'

import { useTheme } from '~/contexts/theme'
import { useTranslation } from 'react-i18next'
import { confirmAlert } from '~/utils/alert'
import { useDownloads, getCollectionState, enqueueCollection, cancelCollection, resumeCollection, removeSource } from '~/utils/downloadManager'

const Ring = ({ size, strokeWidth, progress, color, trackColor, children }) => {
	const deg = Math.max(0, Math.min(1, progress)) * 360
	const half1 = Math.min(deg, 180)
	const half2 = deg > 180 ? deg - 180 : 0

	const halfStyle = (side) => ({
		position: 'absolute',
		top: 0,
		width: size / 2,
		height: size,
		overflow: 'hidden',
		[side === 'left' ? 'left' : 'right']: 0,
	})

	const circleStyle = (side, rotate) => ({
		position: 'absolute',
		top: 0,
		width: size,
		height: size,
		borderRadius: size / 2,
		borderWidth: strokeWidth,
		borderColor: color,
		borderBottomColor: 'transparent',
		borderLeftColor: 'transparent',
		transform: [{ rotate: `${rotate}deg` }],
		[side === 'left' ? 'left' : 'right']: 0,
	})

	return (
		<View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
			<View style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: strokeWidth, borderColor: trackColor }} />
			<View style={halfStyle('right')}>
				<View style={circleStyle('right', half1)} />
			</View>
			{deg > 180 && (
				<View style={halfStyle('left')}>
					<View style={circleStyle('left', half2)} />
				</View>
			)}
			{children}
		</View>
	)
}

const DownloadedIcon = ({ size, circleColor, arrowColor }) => (
	<View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: circleColor, justifyContent: 'center', alignItems: 'center' }}>
		<Icon name="arrow-down" size={size * 0.55} color={arrowColor} />
	</View>
)

const DownloadButton = ({ type, id, name, artist = '', cover = null, songs = [], size = 24, style = {} }) => {
	const { t } = useTranslation()
	const theme = useTheme()
	useDownloads()
	if (!id) return null
	const source = { type, id, name }
	const { status, progress } = getCollectionState(source)

	const onPress = () => {
		if (status === 'done') {
			confirmAlert(
				t('settings.downloads.Remove download'),
				t('settings.downloads.Remove download alert', { name }),
				async () => {
					await removeSource(source)
				}
			)
		} else if (status === 'downloading' || status === 'queued') {
			cancelCollection(source)
		} else if (status === 'paused' || status === 'error') {
			resumeCollection(source)
		} else {
			enqueueCollection({ type, id, name, artist, cover, songs })
		}
	}

	const renderContent = () => {
		if (status === 'downloading') {
			return (
				<Ring size={size * 0.9} strokeWidth={2.5} progress={progress} color={theme.primaryTouch} trackColor={theme.secondaryText}>
					<Text style={{ color: theme.primaryText, fontSize: size * 0.35, fontWeight: '600' }}>{Math.round(progress * 100)}</Text>
				</Ring>
			)
		}
		if (status === 'queued') return <ActivityIndicator size={size} color={theme.primaryTouch} />
		if (status === 'paused') return <Icon name="pause-circle" size={size} color={theme.primaryTouch} />
		if (status === 'error') return <Icon name="exclamation-circle" size={size} color="#e33" />
		if (status === 'done') return <DownloadedIcon size={size} circleColor={theme.primaryTouch} arrowColor="#fff" />
		if (status === 'partial') return <DownloadedIcon size={size} circleColor={theme.secondaryText} arrowColor="#fff" />
		return <Icon name="cloud-download" size={size} color={theme.primaryText} />
	}

	return (
		<Pressable
			style={({ pressed }) => [styles.button, style, { justifyContent: 'center', alignItems: 'center' }, pressed && styles.pressed]}
			onPress={onPress}
			hitSlop={8}
		>
			{renderContent()}
		</Pressable>
	)
}

const styles = StyleSheet.create({
	button: {
		padding: 4,
		justifyContent: 'center',
		alignItems: 'center',
	},
	pressed: {
		opacity: 0.6,
	},
})

export default DownloadButton
