import React from 'react'
import { Linking } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'

import { useConfig } from '~/contexts/config'
import { useSong, useSongDispatch } from '~/contexts/song'
import { urlCover } from '~/utils/url'
import { removeFromQueue, moveInQueue } from '~/utils/player'
import size from '~/styles/size'
import OptionsPopup from '~/components/popup/OptionsPopup'
import PlaylistSelectPopup from '~/components/popup/PlaylistSelectPopup'

const OptionsQueue = ({ queue, indexOptions, setIndexOptions, closePlayer }) => {
	const { t } = useTranslation()
	const navigation = useNavigation()
	const song = useSong()
	const songDispatch = useSongDispatch()
	const config = useConfig()
	const refOption = React.useRef()
	const [playlistVisible, setPlaylistVisible] = React.useState(false)

	const goToArtist = () => {
		if (queue[indexOptions].artists?.length > 1) {
			refOption.current.setVirtualOptions([
				{
					name: t('Go to artist'),
				},
				...queue[indexOptions].artists.map((artist) => ({
					name: artist.name,
					image: urlCover(config, artist, 100),
					borderRadius: size.radius.circle,
					onPress: () => {
						navigation.navigate('Artist', { id: artist.id, name: artist.name })
						refOption.current.close()
						closePlayer()
					}
				}))
			])
		} else {
			navigation.navigate('Artist', { id: queue[indexOptions].artistId, name: queue[indexOptions].artist })
			refOption.current.close()
			closePlayer()
		}
	}

	const goToAlbum = () => {
		navigation.navigate('Album', { id: queue[indexOptions].albumId, name: queue[indexOptions].album, artist: queue[indexOptions].artist, artistId: queue[indexOptions].artistId })
		refOption.current.close()
		closePlayer()
	}

	const openPlaylistSelect = () => {
		refOption.current.close()
		setPlaylistVisible(true)
	}

	const removeFromQueueOpt = () => {
		removeFromQueue(songDispatch, indexOptions)
		refOption.current.close()
	}

	return (
		<>
		<OptionsPopup
			ref={refOption}
			visible={indexOptions >= 0}
			close={() => {
				refOption.current.clearVirtualOptions()
				setIndexOptions(-1)
			}}
			item={indexOptions >= 0 ? queue[indexOptions] : null}
			options={[
				{
					name: t('Go to artist'),
					icon: 'user',
					onPress: goToArtist,
					hidden: indexOptions >= 0 && queue[indexOptions].isLiveStream
				},
				{
					name: t('Go to album'),
					icon: 'folder-open',
					onPress: goToAlbum,
					hidden: indexOptions >= 0 && queue[indexOptions].isLiveStream
				},
				{
					name: t('Add to playlist'),
					icon: 'plus',
					onPress: openPlaylistSelect,
					hidden: indexOptions >= 0 && queue[indexOptions].isLiveStream
				},
				{
					name: t('Open home page'),
					icon: 'home',
					onPress: () => {
						refOption.current.close()
						Linking.openURL(queue[indexOptions].homePageUrl)
					},
					hidden: indexOptions >= 0 && !queue[indexOptions].homePageUrl
				},
				{
					name: t('Move to top'),
					icon: 'angle-double-up',
					onPress: () => {
						moveInQueue(songDispatch, indexOptions, 0)
						refOption.current.close()
					},
					hidden: song.index === indexOptions || indexOptions === 0
				},
				{
					name: t('Move up'),
					icon: 'angle-up',
					onPress: () => {
						moveInQueue(songDispatch, indexOptions, indexOptions - 1)
						refOption.current.close()
					},
					hidden: song.index === indexOptions || indexOptions === 0
				},
				{
					name: t('Move down'),
					icon: 'angle-down',
					onPress: () => {
						moveInQueue(songDispatch, indexOptions, indexOptions + 1)
						refOption.current.close()
					},
					hidden: song.index === indexOptions || indexOptions === queue.length - 1
				},
				{
					name: t('Move to bottom'),
					icon: 'angle-double-down',
					onPress: () => {
						moveInQueue(songDispatch, indexOptions, queue.length - 1)
						refOption.current.close()
					},
					hidden: song.index === indexOptions || indexOptions === queue.length - 1
				},
				{
					name: t('Remove from queue'),
					icon: 'trash',
					onPress: removeFromQueueOpt,
					hidden: song.index === indexOptions
				}
			]} />
		<PlaylistSelectPopup
			visible={playlistVisible}
			songs={indexOptions >= 0 && queue[indexOptions]?.id ? [queue[indexOptions]] : []}
			close={() => setPlaylistVisible(false)}
		/>
		</>
	)
}

export default OptionsQueue