import React from 'react'
import { Pressable, Text, StyleSheet, Animated } from 'react-native'
import { nativeDriver, springs } from '~/styles/motion'

import { useConfig } from '~/contexts/config'
import { useTheme } from '~/contexts/theme'
import { urlCover } from '~/utils/url'
import ImageError from '~/components/ImageError'
import mainStyles from '~/styles/main'
import size from '~/styles/size'

const AllItem = ({ item, type, onPress, onLongPress = () => { } }) => {
	const config = useConfig()
	const theme = useTheme()
	const scale = React.useRef(new Animated.Value(1)).current
	const animateIn = () => Animated.spring(scale, { toValue: 0.97, stiffness: springs.snappy.stiffness, damping: springs.snappy.damping, useNativeDriver: nativeDriver }).start()
	const animateOut = () => Animated.spring(scale, { toValue: 1, stiffness: springs.snappy.stiffness, damping: springs.snappy.damping, useNativeDriver: nativeDriver }).start()

	return (
		<Animated.View style={{ transform: [{ scale }] }}>
		<Pressable
			style={({ pressed }) => ([mainStyles.opacity({ pressed }), styles.item])}
			onPressIn={animateIn}
			onPressOut={animateOut}
			onPress={() => onPress(item)}
			delayLongPress={200}
			onLongPress={() => onLongPress(item)}>
			<ImageError
				style={styles.cover(type)}
				source={{ uri: urlCover(config, item) }}
				iconError={['artist', 'artist_all'].includes(type) ? 'user' : 'music'}
			/>
			<Text numberOfLines={1} style={styles.title(theme, type)}>{item.title || item.name}</Text>
			<Text numberOfLines={1} style={styles.subTitle(theme)}>{item.artist}</Text>
		</Pressable>
		</Animated.View>
	)
}

const styles = StyleSheet.create({
	item: {
		width: "100%",
		paddingHorizontal: 10,
		marginBottom: 10,
	},
	cover: (type) => ({
		width: "100%",
		aspectRatio: 1,
		marginBottom: 6,
		borderRadius: ['artist', 'artist_all'].includes(type) ? size.radius.circle : size.radius.standard,
	}),
	title: (theme, type) => ({
		textAlign: ['artist', 'artist_all'].includes(type) ? 'center' : 'left',
		color: theme.primaryText,
		fontSize: size.text.small,
		width: '100%',
		marginBottom: 3,
		marginTop: 3,
	}),
	subTitle: theme => ({
		color: theme.secondaryText,
		fontSize: size.text.small,
		width: '100%',
		textAlign: 'left',
	}),
})

export default AllItem