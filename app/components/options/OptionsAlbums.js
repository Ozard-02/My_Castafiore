import React from 'react'
import { Platform, Share } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'

import { getApi } from '~/utils/api'
import { getApiNetworkFirst, getApiCacheFirst, addSongsToPlaylist } from '~/utils/api'
import { useConfig } from '~/contexts/config'
import { urlCover } from '~/utils/url'
import { enqueueCollection } from '~/utils/downloadManager'
import OptionsPopup from '~/components/popup/OptionsPopup'
import { playSong, addToQueue, addToUpNext } from '~/utils/player'
import { useSong, useSongDispatch } from '~/contexts/song'

const OptionsAlbums = ({ albums, indexOptions, setIndexOptions }) => {
	const { t } = useTranslation()
	const song = useSong()
	const navigation = useNavigation()
	const config = useConfig()
	const refOption = React.useRef()
	const songDispatch = useSongDispatch()

	const playSimilarSongs = () => {
		getApiNetworkFirst(config, 'getSimilarSongs', { id: albums[indexOptions].id, count: 50 })
			.then((json) => {
				if (json.similarSongs?.song) playSong(config, songDispatch, json.similarSongs.song, 0)
			})
			.catch(() => { })
		refOption.current.close()
	}

	const openAddToPlaylist = () => {
		getApi(config, 'getPlaylists')
			.then((json) => {
				if (!json.playlists?.playlist) return
				getApiCacheFirst(config, 'getAlbum', { id: albums[indexOptions].id })
					.then((albumJson) => {
						if (!albumJson.album?.song?.length) return
						refOption.current.setVirtualOptions([
							{
								name: t('Add to playlist'),
							},
							...json.playlists.playlist.map((playlist) => ({
								name: playlist.name,
								image: urlCover(config, playlist, 100),
								onPress: () => {
									addSongsToPlaylist(config, playlist, albumJson.album.song.map((s) => s.id))
										.catch(() => { })
									refOption.current.close()
								}
							}))
						]
						)
					})
					.catch(() => { })
			})
			.catch(() => { })
	}

	const downloadAlbum = () => {
		refOption.current.close()
		getApiCacheFirst(config, 'getAlbum', { id: albums[indexOptions].id })
			.then((json) => {
				if (!json.album?.song?.length) return
				enqueueCollection({
					type: 'album',
					id: albums[indexOptions].id,
					name: albums[indexOptions].name || albums[indexOptions].album || albums[indexOptions].title,
					artist: albums[indexOptions].artist,
					cover: urlCover(config, albums[indexOptions]),
					songs: json.album.song,
				})
			})
			.catch(() => { })
	}

	return (
		<OptionsPopup
			ref={refOption}
			visible={indexOptions >= 0}
			close={() => { setIndexOptions(-1) }}
			item={indexOptions >= 0 ? albums[indexOptions] : null}
			options={[
				{
					name: t('Play similar songs'),
					icon: 'play',
					onPress: playSimilarSongs
				},
				{
					name: t('Play next'),
					icon: 'play-circle',
					onPress: () => {
						refOption.current.close()
						getApiCacheFirst(config, 'getAlbum', { id: albums[indexOptions].id })
							.then((json) => {
								if (json.album?.song?.length) {
									addToUpNext(songDispatch, json.album.song, true)
								}
							})
							.catch(() => { })
					},
					hidden: !song.queue?.length
				},
				{
					name: t('Add to queue'),
					icon: 'list-ul',
					onPress: () => {
						refOption.current.close()
						getApiCacheFirst(config, 'getAlbum', { id: albums[indexOptions].id })
							.then((json) => {
								if (json.album?.song?.length) {
									for (const song of json.album.song) {
										addToQueue(songDispatch, song)
									}
								}
							})
							.catch(() => { })
					},
					hidden: !song.queue?.length
				},
				{
					name: t('Add to playlist'),
					icon: 'plus',
					onPress: openAddToPlaylist
				},
				{
					name: t('Go to artist'),
					icon: 'user',
					onPress: () => {
						refOption.current.close()
						navigation.navigate('Artist', { id: albums[indexOptions].artistId, name: albums[indexOptions].artist })
					}
				},
				{
					name: t('Download'),
					icon: 'cloud-download',
					onPress: downloadAlbum
				},
				{
					name: t('Share'),
					icon: 'share',
					onPress: () => {
						getApi(config, 'createShare', { id: albums[indexOptions].id })
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
						refOption.current.close()
						refOption.current.showInfo(albums[indexOptions])
					}
				}
			]}
		/>
	)
}

export default OptionsAlbums