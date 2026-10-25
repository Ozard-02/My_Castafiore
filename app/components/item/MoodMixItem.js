import React from 'react'
import { Text, View, StyleSheet, Pressable } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'

import { useConfig } from '~/contexts/config'
import { useTheme } from '~/contexts/theme'
import { urlCover } from '~/utils/url'
import ImageError from '~/components/ImageError'
import mainStyles from '~/styles/main'
import size from '~/styles/size'

const half = size.image.large / 2

// One generated mood mix, shaped like the genre squares: a square card in the horizontal
// Home list. Tapping it opens the normal song list screen with the 50 local tracks.
const MoodMixItem = ({ mix }) => {
	const { t } = useTranslation()
	const config = useConfig()
	const theme = useTheme()
	const navigation = useNavigation()

	const group = mix.id?.startsWith('weekly') ? 'weekly' : 'daily'
	const title = t(`moodTheme.${mix.themeId}`)
	const groupTitle = t(group === 'weekly' ? 'homeSection.Weekly Mixes' : 'homeSection.Daily Mixes')

	const covers = React.useMemo(() => {
		const songs = (mix.songs || []).filter(Boolean)
		const picks = songs.slice(0, 4)
		while (picks.length < 4 && songs.length) picks.push(songs[picks.length % songs.length])
		return picks
	}, [mix.songs])

	return (
		<Pressable
			style={({ pressed }) => ([mainStyles.opacity({ pressed }), styles.mix, { backgroundColor: theme.secondaryBack }])}
			onPress={() => navigation.navigate('Songs', {
				songs: mix.songs || [],
				title: `${groupTitle} · ${title}`,
			})}
		>
			<View style={styles.coverGrid}>
				{covers.map((song, index) => (
					<ImageError
						key={`${song.id}-${index}`}
						source={{ uri: urlCover(config, song, 100) }}
						style={styles.coverCell}
					/>
				))}
			</View>
			<View style={styles.overlay}>
				<Text numberOfLines={1} style={styles.title}>{title}</Text>
				<Text numberOfLines={1} style={styles.subtitle}>
					{mix.songs?.length || 0} {t('songs')}
				</Text>
			</View>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	mix: {
		width: size.image.large,
		height: size.image.large,
		borderRadius: size.radius.standard,
		borderWidth: 0.5,
		borderColor: 'rgba(255,255,255,0.10)',
		overflow: 'hidden',
	},
	coverGrid: {
		flex: 1,
		flexDirection: 'row',
		flexWrap: 'wrap',
	},
	coverCell: {
		width: half,
		height: half,
	},
	overlay: {
		position: 'absolute',
		left: 0,
		right: 0,
		bottom: 0,
		paddingHorizontal: 10,
		paddingTop: 22,
		paddingBottom: 9,
		backgroundColor: 'rgba(0,0,0,0.55)',
	},
	title: {
		color: '#fff',
		fontSize: size.text.large,
		fontWeight: '700',
	},
	subtitle: {
		color: 'rgba(255,255,255,0.8)',
		fontSize: size.text.small,
		marginTop: 2,
	},
})

export default MoodMixItem
