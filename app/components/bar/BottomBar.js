import React from 'react'
import { Text, View, Pressable, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import Icon from 'react-native-vector-icons/FontAwesome'

import { useConfig } from '~/contexts/config'
import { useTheme } from '~/contexts/theme'
import { useTabItem } from '~/utils/useTabItem'
import mainStyles from '~/styles/main'
import size from '~/styles/size'
import useKeyboardIsOpen from '~/utils/useKeyboardIsOpen'

const TabItem = ({ route, index, state, descriptors, navigation, compact }) => {
	const { t } = useTranslation()
	const { options, color, onPress, onLongPress, disabled } = useTabItem(route, index, state, descriptors, navigation)

	return (
		<Pressable
			key={index}
			onPress={onPress}
			onLongPress={onLongPress}
			style={({ pressed }) => ([mainStyles.opacity({ pressed }), {
				flex: 1,
				paddingBottom: compact ? 2 : 2,
				paddingTop: compact ? 5 : 9,
			}])}
			disabled={disabled}
		>
			<Icon name={options.icon} size={compact ? 17 : size.icon.tiny} color={color} style={{ alignSelf: 'center', marginBottom: 2, height: compact ? 19 : 23 }} />
			<Text numberOfLines={1} style={{ color: color, textAlign: 'center', height: compact ? 15 : 18, fontSize: compact ? 11 : 14 }}>
				{t(`tabs.${options.title}`)}
			</Text>
		</Pressable>
	)
}

const BottomBar = ({ state, descriptors, navigation }) => {
	const insets = useSafeAreaInsets()
	const config = useConfig()
	const theme = useTheme()
	const keyboardIsOpen = useKeyboardIsOpen()
	const { width } = useWindowDimensions()
	// Z Flip cover (~360dp) compact; main screens (~411dp+) keep the regular bar
	const compact = width < 380

	if (!config.url) return null
	return (
		<View style={{
			flexDirection: 'row',
			backgroundColor: theme.secondaryBack,
			paddingTop: compact ? 5 : 7,
			paddingLeft: insets.left,
			paddingRight: insets.right,
			paddingBottom: insets.bottom ? insets.bottom : 10,
			display: keyboardIsOpen ? 'none' : undefined,
		}}
		>
			{state.routes.map((route, index) => (
				<TabItem
					key={index}
					route={route}
					state={state}
					index={index}
					descriptors={descriptors}
					navigation={navigation}
					compact={compact}
				/>
			))}
		</View>
	)
}

export default BottomBar