import React from 'react'
import { Pressable, Text, StyleSheet } from 'react-native'

import { useConfig } from '~/contexts/config'
import { useTheme } from '~/contexts/theme'
import { urlCover } from '~/utils/url'
import ImageError from '~/components/ImageError'
import mainStyles from '~/styles/main'
import size from '~/styles/size'

const AllItem = ({ item, type, onPress, onLongPress = () => { } }) => {
	const config = useConfig()
	const theme = useTheme()

	return (
		<Pressable
			style={({ pressed }) => ([mainStyles.opacity({ pressed }), styles.item])}
			onPress={() => onPress(item)}
			delayLongPress={200}
			onLongPress={() => onLongPress(item)}>
			<ImageError
				style={styles.cover(type)}
				source={{ uri: urlCover(config, item) }}
				iconError={['artist', 'artist_all'].includes(type) ? 'user' : 'music'}
			/>
			<Text numberOfLines={1} style={styles.title(theme, type)}>{item.name || item.album || item.title}</Text>
			<Text numberOfLines={1} style={styles.subTitle(theme)}>{item.artist}</Text>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	item: {
		width: "50%",
		paddingHorizontal: 5,
		marginBottom: 10,
	},
	cover: (type) => ({
		width: "100%",
		aspectRatio: 1,
		marginBottom: 6,
		borderRadius: ['artist', 'artist_all'].includes(type) ? size.radius.circle : 0,
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