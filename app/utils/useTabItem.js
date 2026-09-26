import React from 'react'

import { useConfig } from '~/contexts/config'
import { useTheme } from '~/contexts/theme'

// Shared tab-button logic for the SideBar and BottomBar navigator bars
// (single/bottom nav rows). Both bars had an identical inline copy of the
// color/focus logic and the tabPress/tabLongPress emit flow.
export const useTabItem = (route, index, state, descriptors, navigation) => {
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

	return { options, isFocused, color, onPress, onLongPress, disabled: !config.query && route.name !== 'Settings' }
}