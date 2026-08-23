import React from 'react'
import { Text, View, Pressable, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import Icon from 'react-native-vector-icons/FontAwesome'

import { useConfig } from '~/contexts/config'
import { useTheme } from '~/contexts/theme'
import mainStyles from '~/styles/main'
import size from '~/styles/size'
import useKeyboardIsOpen from '~/utils/useKeyboardIsOpen'

const TabItem = ({ route, index, state, descriptors, navigation, compact }) => {
	const { t } = useTranslation()
	const config = useConfig()
	const theme = useTheme()

	const options = React.useMemo(() => descriptors[route.key].options, [])
	const isFocused = React.useMemo(() => state.index === index, [state.index, index])
	const color = React.useMemo(() => {
		if (isFocused) return theme.primaryTouch
		if (!config.query && route.name !== 'Settings') return theme.secondaryText
		return theme.primaryText
	}, [isFocused, config.query, route.name, theme])

	const onPress = () => {
		const event = navigation.emit({
			type: 'tabPress',
			target: route.key,
			canPreventDefault: true,
		})

		if (!isFocused && !event.defaultPrevented) {
			navigation.navigate(route.name, route.params)
		}
	}

	const onLongPress = () => {
		navigation.emit({
			type: 'tabLongPress',
			target: route.key,
		})
	}

	return (
		<Pressable
			key={index}
			onPress={onPress}
			onLongPress={onLongPress}
			style={({ pressed }) => ([mainStyles.opacity({ pressed }), {
				flex: 1,
				paddingBottom: compact ? 2 : 3,
				paddingTop: compact ? 6 : 11,
			}])}
			disabled={(!config.query && route.name !== 'Settings')}
		>
			<Icon name={options.icon} size={compact ? 17 : size.icon.tiny} color={color} style={{ alignSelf: 'center', marginBottom: 2, height: compact ? 20 : 24 }} />
			<Text numberOfLines={1} style={{ color: color, textAlign: 'center', height: compact ? 15 : 19, fontSize: compact ? 11 : 14 }}>
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
	const compact = width < 420

	if (!config.url) return null
	return (
		<View style={{
			flexDirection: 'row',
			backgroundColor: theme.secondaryBack,
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