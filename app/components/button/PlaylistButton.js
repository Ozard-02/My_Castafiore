import React from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Icon from 'react-native-vector-icons/FontAwesome'

import { useConfig } from '~/contexts/config'
import { useSongDispatch } from '~/contexts/song'
import { useTheme } from '~/contexts/theme'
import { getApi } from '~/utils/api'
import { useOffline } from '~/utils/offline'
import RatingPopup from '~/components/popup/RatingPopup'
import PlaylistSelectPopup from '~/components/popup/PlaylistSelectPopup'
import mainStyles from '~/styles/main'
import logger from '~/utils/logger'

// Song rows and players: the old heart starred the song on tap. The tap now opens the
// add-to-playlist sheet, where "Favourited" is a pseudo-playlist — starring stays one tap
// away but the primary action is playlist membership. The circle reads the song's starred
// state (its Favourited membership), so empty/full needs no per-row membership API.
//
// Drawn, not a FontAwesome glyph: the sheet's SelectCircle look (2px ring, check when
// filled) with `size` as the diameter. An outline glyph reads much smaller than the solid
// heart it replaced at the same font size.
const PlaylistButton = ({ id, isFavorited = false, rating: initialRating = undefined, style = {}, size = 26 }) => {
	const [favorited, setFavorited] = React.useState(isFavorited)
	const [rating, setRating] = React.useState(initialRating ?? 0)
	const [isRatingOpen, setIsRatingOpen] = React.useState(false)
	const [isPlaylistOpen, setIsPlaylistOpen] = React.useState(false)
	const config = useConfig()
	const songDispatch = useSongDispatch()
	const theme = useTheme()
	const offline = useOffline()

	React.useEffect(() => {
		setFavorited(isFavorited)
		setRating(initialRating ?? 0)
	}, [id, isFavorited, initialRating])

	// same contract as FavoritedButton: long-press opens the rating popup
	const onSaveRating = () => {
		getApi(config, 'setRating', { id, rating })
			.then(() => {
				songDispatch({ type: 'setRating', id, rating })
				setIsRatingOpen(false)
			})
			.catch((e) => logger.error('PlaylistButton', e.message))
	}

	// offline, membership/star writes are impossible, so the button becomes read-only: it
	// still shows the locally stored favourite state, but tapping does nothing.
	return (
		<>
			<Pressable
				style={({ pressed }) => ([mainStyles.opacity({ pressed }), styles.button, StyleSheet.flatten(style)])}
				onPress={() => { if (!offline && id) setIsPlaylistOpen(true) }}
				onLongPress={() => { if (!offline && initialRating !== undefined) setIsRatingOpen(true) }}
				delayLongPress={200}
				onContextMenu={(ev) => {
					ev.stopPropagation()
					ev.preventDefault()
					if (!offline && initialRating !== undefined) setIsRatingOpen(true)
				}}
			>
				<View style={{
					width: size,
					height: size,
					borderRadius: size / 2,
					borderWidth: 2,
					borderColor: theme.primaryTouch,
					backgroundColor: favorited ? theme.primaryTouch : 'transparent',
					alignItems: 'center',
					justifyContent: 'center',
				}}>
					{favorited && <Icon name="check" size={Math.round(size * 0.58)} color={theme.primaryBack} />}
				</View>
			</Pressable>
			<PlaylistSelectPopup
				visible={isPlaylistOpen}
				songs={id ? [{ id, starred: favorited }] : []}
				close={() => setIsPlaylistOpen(false)}
				// the sheet reports the resulting Favourited state: the star may have been
				// toggled there, and list rows don't re-fetch their source on close
				onDone={(ok, total, extras) => {
					if (extras?.starred === true || extras?.starred === false) setFavorited(extras.starred)
				}}
			/>
			<RatingPopup
				visible={isRatingOpen}
				rating={rating}
				onSelectRating={setRating}
				onSave={onSaveRating}
				onClose={() => setIsRatingOpen(false)}
			/>
		</>
	)
}

const styles = StyleSheet.create({
	button: {
		justifyContent: 'center',
	},
})

export default PlaylistButton
