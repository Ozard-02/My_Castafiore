import React from 'react'
import { Pressable, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useConfig } from '~/contexts/config'
import { useSong } from '~/contexts/song'
import { useTheme } from '~/contexts/theme'
import { urlCover } from '~/utils/url'
import ImageError from '~/components/ImageError'
import mainStyles from '~/styles/main'

const BoxPlayerBubble = ({ onPress }) => {
	const song = useSong()
	const config = useConfig()
	const insets = useSafeAreaInsets()
	const theme = useTheme()

	return (
		<Pressable
			onPress={onPress}
			style={({ pressed }) => ([mainStyles.opacity({ pressed }), styles.container(insets)])}
		>
			<ImageError
				source={{ uri: urlCover(config, song?.songInfo, 100) }}
				style={styles.bubble(theme)}
			/>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	container: (insets) => ({
		position: 'absolute',
		bottom: (insets.bottom ? insets.bottom : 10) + 59,
		left: 0,
		right: 0,
		alignItems: 'center',
	}),
	bubble: (theme) => ({
		width: 46,
		height: 46,
		borderRadius: 23,
		borderWidth: 2,
		borderColor: theme.playerBackground,
		backgroundColor: theme.secondaryBack,
	}),
})

export default BoxPlayerBubble
