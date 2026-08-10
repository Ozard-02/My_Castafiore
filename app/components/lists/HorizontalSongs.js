import React from 'react'
import { Text, StyleSheet, Pressable } from 'react-native'

import { useConfig } from '~/contexts/config'
import { useTheme } from '~/contexts/theme'
import { urlCover } from '~/utils/url'
import { playSong } from '~/utils/player'
import { useSongDispatch } from '~/contexts/song'
import CustomFlat from '~/components/lists/CustomFlat'
import ImageError from '~/components/ImageError'
import mainStyles from '~/styles/main'
import OptionsSongsList from '~/components/options/OptionsSongsList'
import size from '~/styles/size'

const HorizontalSongs = ({ songs, onPress = () => { } }) => {
	const theme = useTheme()
	const config = useConfig()
	const songDispatch = useSongDispatch()
	const [indexOptions, setIndexOptions] = React.useState(-1)

	const renderItem = React.useCallback(({ item, index }) => (
		<Pressable
			style={({ pressed }) => ([mainStyles.opacity({ pressed }), styles.song])}
			onPress={() => {
				onPress(item)
				playSong(config, songDispatch, songs, index)
			}}
			delayLongPress={200}
			onLongPress={() => setIndexOptions(index)}
			onContextMenu={(ev) => {
				ev.preventDefault()
				setIndexOptions(index)
			}}
		>
			<ImageError
				style={[styles.songCover, { backgroundColor: theme.secondaryBack }]}
				source={{ uri: urlCover(config, item) }}
				iconError="music"
			/>
			<Text numberOfLines={1} style={styles.titleSong(theme)}>{item.title}</Text>
			<Text numberOfLines={1} style={styles.artist(theme)}>{item.artist}</Text>
		</Pressable>
	), [theme, config, songs, songDispatch, onPress])

	return (
		<>
			<CustomFlat data={songs} renderItem={renderItem} widthItem={size.image.small + 10} />
			<OptionsSongsList
				songs={songs}
				indexOptions={indexOptions}
				setIndexOptions={setIndexOptions}
			/>
		</>
	)
}

const styles = StyleSheet.create({
	song: {
		width: size.image.small,
		alignItems: 'center',
	},
	songCover: {
		width: size.image.small,
		height: size.image.small,
		marginBottom: 6,
	},
	titleSong: (theme) => ({
		color: theme.primaryText,
		fontSize: size.text.small,
		textAlign: 'left',
		width: size.image.small,
		marginBottom: 3,
		marginTop: 3,
	}),
	artist: theme => ({
		color: theme.secondaryText,
		fontSize: size.text.small,
		width: size.image.small,
		textAlign: 'left',
	}),
})

export default HorizontalSongs
