import React from 'react'

import { useConfig } from '~/contexts/config'
import { useSongDispatch } from '~/contexts/song'
import { useTheme } from '~/contexts/theme'
import { getApi } from '~/utils/api'
import IconButton from '~/components/button/IconButton'
import RatingPopup from '~/components/popup/RatingPopup'
import PlaylistSelectPopup from '~/components/popup/PlaylistSelectPopup'
import logger from '~/utils/logger'

// Song rows and players: the old heart starred the song on tap. The tap now opens the
// add-to-playlist sheet, where "Favourited" is a pseudo-playlist — starring stays one tap
// away but the primary action is playlist membership. The circle reads the song's starred
// state (its Favourited membership), so empty/full needs no per-row membership API.
const PlaylistButton = ({ id, isFavorited = false, rating: initialRating = undefined, style = {}, size = 23 }) => {
	const [favorited, setFavorited] = React.useState(isFavorited)
	const [rating, setRating] = React.useState(initialRating ?? 0)
	const [isRatingOpen, setIsRatingOpen] = React.useState(false)
	const [isPlaylistOpen, setIsPlaylistOpen] = React.useState(false)
	const config = useConfig()
	const songDispatch = useSongDispatch()
	const theme = useTheme()

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

	return (
		<>
			<IconButton
				style={[{ padding: 20 }, style]}
				onPress={() => { if (id) setIsPlaylistOpen(true) }}
				onLongPress={() => initialRating !== undefined ? setIsRatingOpen(true) : null}
				size={size}
				icon={favorited ? 'check-circle' : 'circle-o'}
				color={theme.primaryTouch}
			/>
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

export default PlaylistButton
