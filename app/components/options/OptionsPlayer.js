import React from 'react'
import { Linking, Platform, Share } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'

import { getApi } from '~/utils/api'
import { urlCover } from '~/utils/url'
import { useConfig } from '~/contexts/config'
import { useSettings, useSetSettings } from '~/contexts/settings'
import { useSong, useSongDispatch } from '~/contexts/song'
import OptionsPopup from '~/components/popup/OptionsPopup'
import PlaylistSelectPopup from '~/components/popup/PlaylistSelectPopup'
import Player from '~/utils/player'
import size from '~/styles/size'

const OptionsPlayer = ({ song, isOpen, setIsOpen, closePlayer }) => {
	const { t } = useTranslation()
	const settings = useSettings()
	const setSettings = useSetSettings()
	const navigation = useNavigation()
	const config = useConfig()
	const songDispatch = useSongDispatch()
	const songRadioMode = useSong().radioMode
	const refOption = React.useRef()
	const [playlistVisible, setPlaylistVisible] = React.useState(false)

	const goToArtist = () => {
		if (song.artists?.length > 1) {
			refOption.current.setVirtualOptions([
				{
					name: t('Go to artist'),
				},
				...song.artists.map((artist) => ({
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
			navigation.navigate('Artist', { id: song.artistId, name: song.artist })
			refOption.current.close()
			closePlayer()
		}
	}

	const goToAlbum = () => {
		navigation.navigate('Album', { id: song.albumId, name: song.album, artist: song.artist, artistId: song.artistId })
		refOption.current.close()
		closePlayer()
	}

	const openPlaylistSelect = () => {
		if (!song?.id) return
		// close this sheet first so the playlist sheet is the only thing on screen; Done
		// then returns the user to the page they opened the player from
		refOption.current.clearVirtualOptions()
		refOption.current.close()
		setPlaylistVisible(true)
	}

	return (
		<>
		{song && isOpen && (
		<OptionsPopup
			ref={refOption}
			visible={isOpen}
			close={() => {
				refOption.current.clearVirtualOptions()
				setIsOpen(false)
			}}
			item={isOpen ? song : null}
			options={[
				{
					name: t('Go to artist'),
					icon: 'user',
					onPress: goToArtist,
					hidden: song.isLiveStream
				},
				{
					name: t('Go to album'),
					icon: 'folder-open',
					onPress: goToAlbum,
					hidden: song.isLiveStream
				},
				{
					name: t('Add to playlist'),
					icon: 'plus',
					onPress: openPlaylistSelect,
					hidden: song.isLiveStream
				},
				{
					name: t('Open home page'),
					icon: 'home',
					onPress: () => {
						refOption.current.close()
						Linking.openURL(song.homePageUrl)
					},
					hidden: !song.homePageUrl
				},
				{
					name: t(settings.repeatQueue ? 'Disable repeat queue' : 'Enable repeat queue'),
					icon: 'repeat',
					onPress: () => {
						setSettings({ ...settings, repeatQueue: !settings.repeatQueue })
						refOption.current.close()
					}
				},
				{
					name: t('End radio'),
					icon: 'times-circle',
					onPress: () => {
						// a radio session has no natural end, so give it an explicit one
						songDispatch({ type: 'setRadioMode', value: false })
						refOption.current.close()
					},
					hidden: !songRadioMode
				},
				{
					name: t('Clear queue'),
					icon: 'trash',
					onPress: () => {
						Player.resetAudio(songDispatch)
						refOption.current.close()
						closePlayer()
					}
				},
				{
					name: t('Share'),
					icon: 'share',
					onPress: () => {
						getApi(config, 'createShare', { id: song.id })
							.then((json) => {
								if (json.shares.share.length > 0) {
									if (Platform.OS === 'web') navigator.clipboard.writeText(json.shares.share[0].url)
									else Share.share({ message: json.shares.share[0].url })
								}
							})
							.catch(() => { })
						refOption.current.close()
					}
				},
				{
					name: t('Info'),
					icon: 'info',
					onPress: () => {
						navigation.navigate('Info', { info: song })
						refOption.current.close()
						closePlayer()
					},
				}
			]} />
		)}
		<PlaylistSelectPopup
			visible={playlistVisible}
			songIds={song?.id ? [song.id] : []}
			close={() => setPlaylistVisible(false)}
		/>
		</>
	)
}

export default OptionsPlayer