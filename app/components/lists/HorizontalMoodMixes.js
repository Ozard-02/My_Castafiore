import React from 'react'
import { Text, StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'

import { useTheme } from '~/contexts/theme'
import HorizontalSongs from '~/components/lists/HorizontalSongs'
import size from '~/styles/size'

// Five generated mixes per Home section. Each mix is a normal horizontal song list; the
// title is the theme chosen for this period, not a server playlist name.
const HorizontalMoodMixes = ({ mixes }) => {
	const { t } = useTranslation()
	const theme = useTheme()

	return (
		<>
			{mixes.map((mix) => (
				<View key={mix.id}>
					<Text numberOfLines={1} style={styles.title(theme)}>
						{t(`moodTheme.${mix.themeId}`)}
					</Text>
					<HorizontalSongs songs={mix.songs} />
				</View>
			))}
		</>
	)
}

const styles = StyleSheet.create({
	title: (theme) => ({
		color: theme.primaryText,
		fontSize: size.text.large,
		fontWeight: '700',
		marginHorizontal: 20,
		marginTop: 18,
		marginBottom: 8,
	}),
})

export default HorizontalMoodMixes
