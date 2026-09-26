import React from 'react'
import { ActivityIndicator } from 'react-native'

import { useSong, useSongDispatch } from '~/contexts/song'
import { useConfig } from '~/contexts/config'
import Player from '~/utils/player'
import IconButton from '~/components/button/IconButton'

const PlayButton = ({ style = {}, size, color }) => {
	const song = useSong()
	const songDispatch = useSongDispatch()
	const config = useConfig()
	const [icon, setIcon] = React.useState('pause')
	const timeout = React.useRef(null)

	React.useEffect(() => {
		clearTimeout(timeout.current)

		switch (song.state) {
			case Player.State.Playing:
				setIcon('pause')
				break
			case Player.State.Paused:
				setIcon('play')
				break
			case Player.State.Stopped:
				setIcon('play')
				break
			case Player.State.Error:
				setIcon('warning')
				break
			case Player.State.Loading:
				timeout.current = setTimeout(() => {
					setIcon('loading')
				}, 500)
				break
			default:
				break
		}
	}, [song.state])

	const onPress = () => {
		// the queue ran out and stopped: play means "start it over", not resume (resuming an
		// already-ENDED track does nothing, which left this button dead at the end of a queue)
		if (song.queueEnded && song.queue?.length) {
			Player.playSong(config, songDispatch, song.queue, 0).catch(() => { })
			return
		}
		if (!song.isSongLoad) {
			// was `else if` + a stray `if`: playSong ran and then resumeSong ran too
			Player.playSong(config, songDispatch, song.queue, song.index).catch(() => { })
			return
		}
		if (song.state === Player.State.Error) return Player.reload()
		if (song.state === Player.State.Playing) Player.pauseSong()
		else Player.resumeSong()
	}

	if (icon === 'loading') {
		return <ActivityIndicator size={'small'} color={color} style={style} />
	}
	return (
		<IconButton
			style={[style]}
			onPress={onPress}
			size={size}
			icon={icon}
			color={color}
		/>
	)
}

export default PlayButton