import React from 'react'

import { useSetUpdateApi } from '~/contexts/updateApi'
import { useConfig } from '~/contexts/config'
import { useSongDispatch } from '~/contexts/song'
import { useTheme } from '~/contexts/theme'
import { getApi, refreshApi } from '~/utils/api'
import IconButton from '~/components/button/IconButton'
import RatingPopup from '~/components/popup/RatingPopup'
import logger from '~/utils/logger'

const FavoritedButton = ({ id, isFavorited = false, rating: initialRating = undefined, style = {}, size = 23 }) => {
	const [favorited, setFavorited] = React.useState(isFavorited)
	const [rating, setRating] = React.useState(initialRating ?? 0)
	const [isRatingOpen, setIsRatingOpen] = React.useState(false)
	const theme = useTheme()
	const config = useConfig()
	const songDispatch = useSongDispatch()
	const setUpdateApi = useSetUpdateApi()

	React.useEffect(() => {
		setFavorited(isFavorited)
		setRating(initialRating ?? 0)
	}, [id, isFavorited, initialRating])

	const onPressFavorited = () => {
		getApi(config, favorited ? 'unstar' : 'star', { id, albumId: id, artistId: id })
			.then(() => {
				const starred = !favorited
				setFavorited(starred)
				// keep the persisted queue/up-next copy in step: SongItem reads
				// track.starred, and only the player views override it with a live set
				songDispatch({ type: 'setRating', id, rating: initialRating ?? 0, starred })
				// fire-and-forget: publish even if the refresh fails, so subscribers at
				// least re-read the (possibly stale) cache instead of never being told
				refreshApi(config, 'getStarred2', null)
					.finally(() => setUpdateApi({ path: 'getStarred2', query: null, uid: 1 }))
			})
			.catch((e) => logger.error('FavoritedButton', e.message))
	}

	const onSaveRating = () => {
		getApi(config, 'setRating', { id, rating })
			.then(() => {
				songDispatch({ type: 'setRating', id, rating })
				setIsRatingOpen(false)
			})
			.catch((e) => logger.error('FavoritedButton', e.message))
	}

	return (
		<>
			<IconButton
				style={[{ padding: 20 }, style]}
				onPress={onPressFavorited}
				onLongPress={() => initialRating !== undefined ? setIsRatingOpen(true) : null}
				size={size}
				icon={favorited ? "heart" : "heart-o"}
				color={theme.primaryTouch}
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

export default FavoritedButton