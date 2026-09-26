import React from 'react'
import { Platform, Share } from 'react-native'
import { useTranslation } from 'react-i18next'

import { useConfig } from '~/contexts/config'
import { getApi, getApiNetworkFirst } from '~/utils/api'
import { playSong } from '~/utils/player'
import { useSongDispatch } from '~/contexts/song'
import OptionsPopup from '~/components/popup/OptionsPopup'

const OptionsArtists = ({ artists, indexOptions, setIndexOptions }) => {
	const songDispatch = useSongDispatch()
	const config = useConfig()
	const { t } = useTranslation()
	const refOption = React.useRef()

	const playSimilarSongs = () => {
		getApiNetworkFirst(config, 'getSimilarSongs', { id: artists[indexOptions].id, count: 50 })
			.then((json) => {
				if (json.similarSongs?.song) {
					playSong(config, songDispatch, json.similarSongs.song, 0)
				}
			})
			.catch(() => { })
		refOption.current.close()
	}

	const shareArtist = () => {
		getApi(config, 'createShare', { id: artists[indexOptions].id })
			.then((json) => {
				if (json.shares.share.length > 0) {
					if (Platform.OS === 'web') navigator.clipboard.writeText(json.shares.share[0].url)
					else Share.share({ message: json.shares.share[0].url })
				}
			})
			.catch(() => { })
		refOption.current.close()
	}

	return (
		<OptionsPopup
			ref={refOption}
			visible={indexOptions >= 0}
			close={() => { setIndexOptions(-1) }}
			item={indexOptions >= 0 ? artists[indexOptions] : null}
			options={[
				{
					name: t('Play similar songs'),
					icon: 'play',
					onPress: playSimilarSongs
				},
				{
					name: t('Share'),
					icon: 'share',
					onPress: shareArtist
				},
				{
					name: t('Info'),
					icon: 'info',
					onPress: () => {
						refOption.current.showInfo(artists[indexOptions])
						refOption.current.close()
					}
				}
			]}
		/>
	)
}

export default OptionsArtists