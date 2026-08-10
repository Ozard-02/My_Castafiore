import React from 'react'
import { Pressable, Text, View, StyleSheet, LayoutAnimation } from 'react-native'
import Icon from 'react-native-vector-icons/FontAwesome'
import { useTranslation } from 'react-i18next'

import { useTheme } from '~/contexts/theme'
import { useDownloads, formatBytes } from '~/utils/downloadManager'

const DownloadBanner = ({ navigation }) => {
	const { t } = useTranslation()
	const theme = useTheme()
	const { queue } = useDownloads()

	const activeItems = queue.filter((q) => !q.silent && ['downloading', 'queued', 'paused', 'error'].includes(q.status))
	const visible = activeItems.length > 0
	const active = activeItems.find((q) => q.status === 'downloading')

	React.useEffect(() => {
		if (visible) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
	}, [visible])

	if (!visible) return null

	const label = active ? active.meta.title : t('settings.downloads.Items queued', { count: activeItems.length })
	const sub = active ? `${formatBytes(active.writtenBytes)} / ${formatBytes(active.totalBytes || active.writtenBytes)}` : ''
	const progress = active?.progress || 0

	return (
		<Pressable
			onPress={() => navigation.navigate('SettingsStack', { screen: 'Settings/Downloads' })}
			style={({ pressed }) => [styles.container, { backgroundColor: theme.secondaryBack }, pressed && styles.pressed]}
		>
			<View style={[styles.progressTrack, { backgroundColor: theme.primaryBack }]}>
				<View style={[styles.progressFill, { backgroundColor: theme.primaryTouch, width: `${Math.round(progress * 100)}%` }]} />
			</View>
			<View style={styles.content}>
				<Icon name="cloud-download" size={18} color={theme.primaryTouch} style={{ marginRight: 8 }} />
				<Text style={[styles.label, { color: theme.primaryText }]} numberOfLines={1}>{label}</Text>
				{sub ? <Text style={[styles.sub, { color: theme.secondaryText }]} numberOfLines={1}>{sub}</Text> : null}
				<Icon name="chevron-right" size={14} color={theme.secondaryText} style={{ marginLeft: 6 }} />
			</View>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	container: {
		overflow: 'hidden',
	},
	content: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 12,
		height: 36,
	},
	label: {
		flex: 1,
		fontSize: 12,
		fontWeight: '600',
	},
	sub: {
		fontSize: 12,
		marginRight: 4,
	},
	progressTrack: {
		height: 2,
	},
	progressFill: {
		height: '100%',
	},
	pressed: {
		opacity: 0.6,
	},
})

export default DownloadBanner
