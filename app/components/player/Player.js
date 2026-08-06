import React from 'react'
import { useWindowDimensions } from 'react-native'

import { useSettings } from '~/contexts/settings'
import { useSong } from '~/contexts/song'
import BoxDesktopPlayer from '~/components/player/BoxDesktopPlayer'
import BoxPlayer from '~/components/player/BoxPlayer'
import BoxPlayerBubble from '~/components/player/BoxPlayerBubble'
import FullScreenHorizontalPlayer from '~/components/player/FullScreenHorizontalPlayer'
import FullScreenPlayer from '~/components/player/FullScreenPlayer'

const Player = ({ state }) => {
	const song = useSong()
	const settings = useSettings()
	const { height, width } = useWindowDimensions()
	const [fullScreen, setFullScreen] = React.useState(false)
	const [isHidden, setIsHidden] = React.useState(false)

	React.useEffect(() => {
		setFullScreen(false)
		setIsHidden(false)
	}, [state.index])

	React.useEffect(() => {
		setIsHidden(false)
	}, [song?.songInfo?.id])

	if (!song?.songInfo) return null
	else if (fullScreen) {
		if (width <= height) return <FullScreenPlayer setFullScreen={setFullScreen} />
		else return <FullScreenHorizontalPlayer setFullScreen={setFullScreen} />
	}
	else if (settings.isDesktop) return <BoxDesktopPlayer setFullScreen={setFullScreen} />
	else if (isHidden) return <BoxPlayerBubble onPress={() => setIsHidden(false)} />
	return <BoxPlayer setFullScreen={setFullScreen} onDismiss={() => setIsHidden(true)} />
}

export default Player
