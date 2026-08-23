import React from 'react'
import { Text, View } from 'react-native'
import Icon from 'react-native-vector-icons/FontAwesome'

import { useConfig } from '~/contexts/config'
import { useTheme } from '~/contexts/theme'
import { useSong, useSongDispatch } from '~/contexts/song'
import { playSong, addToQueue, addToUpNext } from '~/utils/player'
import SongItem from '~/components/item/SongItem'
import PlaylistSwipeRow from '~/components/item/PlaylistSwipeRow'
import size from '~/styles/size'
import OptionsSongsList from '~/components/options/OptionsSongsList'

const SongsList = ({ songs, isIndex = false, listToPlay = null, isMargin = true, indexPlaying = null, idPlaylist = null, onUpdate = () => { }, onPress = () => true }) => {
	const theme = useTheme()
	const config = useConfig()
	const song = useSong()
	const songDispatch = useSongDispatch()
	const [indexOptions, setIndexOptions] = React.useState(-1)
	const [openSongIndex, setOpenSongIndex] = React.useState(null)
	const isMultiCD = React.useMemo(() => songs?.some(item => item.discNumber !== songs[0].discNumber), [songs])

	const addQueue = React.useCallback((track) => {
		if (song.queue) addToQueue(songDispatch, track)
		else playSong(config, songDispatch, [track], 0)
	}, [song.queue, songDispatch, config])

	const playNext = React.useCallback((track) => {
		if (song.queue) addToUpNext(songDispatch, track, true)
		else playSong(config, songDispatch, [track], 0)
	}, [song.queue, songDispatch, config])

	return (
		<View style={{
			flexDirection: 'column',
			paddingHorizontal: isMargin ? 20 : 0,
		}}>
			{songs?.map((item, index) => {
				return (
					<View key={index}>
						{
							isIndex && isMultiCD && (index === 0 || songs[index - 1].discNumber !== item.discNumber) &&
							<View style={{ flexDirection: 'row', alignItems: 'center', marginStart: 5, marginBottom: 15, marginTop: 10, color: theme.primaryText }}>
								<Icon name="circle-o" size={size.icon.small} color={theme.secondaryText} />
								<Text style={{ color: theme.secondaryText, fontSize: size.text.large, marginBottom: 2, marginStart: 10 }}>Disc {item.discNumber}</Text>
							</View>
						}
						<PlaylistSwipeRow
							open={openSongIndex === index}
							onOpen={() => setOpenSongIndex(index)}
							onClose={() => setOpenSongIndex(null)}
							onQueue={() => addQueue(item)}
							onNext={() => playNext(item)}
						>
							<SongItem
								song={item}
								queue={listToPlay ? listToPlay : songs}
								index={index}
								isIndex={isIndex}
								isPlaying={indexPlaying === index}
								setIndexOptions={setIndexOptions}
								onPress={onPress}
							/>
						</PlaylistSwipeRow>
					</View>
				)
			})}
			<OptionsSongsList
				songs={songs}
				indexOptions={indexOptions}
				setIndexOptions={setIndexOptions}
				onUpdate={onUpdate}
				idPlaylist={idPlaylist}
			/>
		</View>
	)
}

export default SongsList
