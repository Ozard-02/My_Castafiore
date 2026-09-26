import React from 'react'
import { Text, FlatList, Pressable } from 'react-native'
import { useTranslation } from 'react-i18next'

import { useTheme } from '~/contexts/theme'
import { useConfig } from '~/contexts/config'
import { getApi } from '~/utils/api'
import { parseLrc } from '~/utils/lrc'
import Player from '~/utils/player'
import AsyncStorage from '@react-native-async-storage/async-storage'

const Lyric = ({ song, style, color = null, sizeText = 23 }) => {
	const { t } = useTranslation()
	const [indexCurrent, setIndex] = React.useState(0)
	const [lyrics, setLyrics] = React.useState([])
	const [isLayout, setIsLayout] = React.useState(false)
	const config = useConfig()
	const refScroll = React.useRef(null)
	const theme = useTheme()
	const time = Player.updateTime()
	const songId = song.songInfo?.id

	// Guards every async lyric lookup. Without it a response for a track you already skipped
	// resolved last and painted the wrong song's lyrics; the "Loading lyrics..." state also
	// came back on every unrelated dispatch because the dep was the songInfo *object*, which
	// setRating/syncGlobal/setIndex all replace with a new identity.
	const cancelledRef = React.useRef(false)
	React.useEffect(() => {
		cancelledRef.current = false
		return () => { cancelledRef.current = true }
	}, [songId])

	React.useEffect(() => {
		if (!songId) return
		setIndex(0)
		setLyrics([{ time: 0, text: t('Loading lyrics...') }])
		getLyrics(songId)
	}, [songId, config, t])

	const getLyrics = (id) => {
		AsyncStorage.getItem(`lyrics/${id}`)
			.then(res => {
				if (cancelledRef.current) return
				if (res) {
					const ly = JSON.parse(res)
					setIsLayout(true)
					setLyrics(ly)
				} else {
					getNavidromeLyrics(id)
				}
			})
			.catch(() => { })
	}

	React.useEffect(() => {
		if (lyrics.length == 0) return
		let index = lyrics.findIndex(ly => ly.time > time.position) - 1
		if (index === -1) index = 0
		if (index === -2) index = lyrics.length - 1
		if (index < 0) return
		if (index !== indexCurrent) {
			setIndex(index)
		}
	}, [time.position, lyrics])

	React.useEffect(() => {
		if (!isLayout) return
		refScroll.current?.scrollToIndex({ index: indexCurrent, animated: true, viewOffset: 0, viewPosition: 0.5 })
	}, [indexCurrent, isLayout])

	const getNavidromeLyrics = (id) => {
		getApi(config, 'getLyricsBySongId', { id })
			.then(res => {
				if (cancelledRef.current) return
				const ly = res?.lyricsList?.structuredLyrics?.[0]?.line?.map(line => ({ time: line.start / 1000, text: line.value.length ? line.value : '...' }))
				if (!ly?.length) return getLrcLibLyrics(id) // If not found
				ly.sort((a, b) => a.time - b.time)
				setLyrics(ly)
				AsyncStorage.setItem(`lyrics/${id}`, JSON.stringify(ly))
			})
			.catch(() => { // If not found
				if (cancelledRef.current) return
				getLrcLibLyrics(id)
			})
	}

	const getLrcLibLyrics = (id) => {
		const info = song.songInfo
		const params = {
			track_name: info.title,
			artist_name: info.artist,
			album_name: info.album,
			duration: info.duration
		}
		fetch('https://lrclib.net/api/get?' + Object.keys(params).map((key) => `${key}=${encodeURIComponent(params[key])}`).join('&'), {
			headers: { 'Lrclib-Client': 'Castafiore' }
		})
			.then(res => res.json())
			.then(res => {
				if (cancelledRef.current) return
				const ly = parseLrc(res.syncedLyrics)
				// parseLrc returns [] for a well-formed but empty syncedLyrics: that used to
				// render a blank pane with no "No lyrics found" message at all
				if (!ly.length) {
					setLyrics([{ time: 0, text: t('No lyrics found') }])
					return
				}
				setLyrics(ly)
				AsyncStorage.setItem(`lyrics/${id}`, JSON.stringify(ly))
			})
			.catch(() => {
				if (cancelledRef.current) return
				setLyrics([{ time: 0, text: t('No lyrics found') }])
			})
	}

	return (
		<FlatList
			ref={refScroll}
			style={[style, { borderRadius: null }]}
			contentContainerStyle={{ gap: 30 }}
			showsVerticalScrollIndicator={false}
			onScrollToIndexFailed={() => { }}
			initialNumToRender={lyrics.length}
			data={lyrics}
			onLayout={() => setIsLayout(true)}
			keyExtractor={(item, index) => `${index}-${item.time}`}
			renderItem={({ item, index }) => {
				return (
					<Pressable
						onPress={() => {
							Player.setPosition(item.time)
						}}
					>
						<Text
							style={{
								color: index === indexCurrent ? color?.active || theme.primaryText : color?.inactive || theme.secondaryText,
								fontSize: sizeText,
								textAlign: 'center',
							}}>
							{item.text.length ? item.text : '...'}
						</Text>
					</Pressable>
				)
			}}
		/>
	)
}

export default Lyric