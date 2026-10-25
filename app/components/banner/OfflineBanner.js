import React from 'react'
import { Text, View, StyleSheet } from 'react-native'
import Icon from 'react-native-vector-icons/FontAwesome'
import { useTranslation } from 'react-i18next'

import { useTheme } from '~/contexts/theme'
import { hairlineColorFor } from '~/styles/glass'
import { useOffline } from '~/utils/offline'

// Thin strip above the bottom bar: the app silently swaps to downloaded content when the
// connection drops, and this is the only signal that the smaller catalog is not a bug.
const OfflineBanner = () => {
	const { t } = useTranslation()
	const theme = useTheme()
	const offline = useOffline()

	if (!offline) return null

	return (
		<View style={{
			flexDirection: 'row',
			alignItems: 'center',
			backgroundColor: theme.secondaryBack,
			paddingHorizontal: 12,
			height: 36,
			marginHorizontal: 12,
			marginBottom: 4,
			borderRadius: 16,
			borderWidth: StyleSheet.hairlineWidth,
			borderColor: hairlineColorFor(theme.primaryBack),
			elevation: 4,
			shadowColor: '#000',
			shadowOffset: { width: 0, height: 2 },
			shadowOpacity: 0.15,
			shadowRadius: 6,
			overflow: 'hidden',
		}}>
			<Icon name="plane" size={14} color={theme.secondaryText} style={{ marginRight: 8 }} />
			<Text style={{ color: theme.primaryText, fontSize: 12, fontWeight: '600', flex: 1 }} numberOfLines={1}>{t('Offline notice')}</Text>
		</View>
	)
}

export default OfflineBanner
