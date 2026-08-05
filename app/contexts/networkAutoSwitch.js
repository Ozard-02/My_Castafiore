import React from 'react'
import { AppState } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { useConfig, useSetConfig } from '~/contexts/config'
import { useSettings } from '~/contexts/settings'
import { useSongDispatch } from '~/contexts/song'
import { getCurrentNetwork } from '~/utils/network'
import Player from '~/utils/player'
import logger from '~/utils/logger'

const NetworkAutoSwitch = () => {
	const config = useConfig()
	const setConfig = useSetConfig()
	const settings = useSettings()
	const songDispatch = useSongDispatch()

	const switchForNetwork = React.useCallback(async () => {
		const ssid = await getCurrentNetwork()
		if (!ssid) return
		const server = settings.servers?.find((s) =>
			s.network && s.network.toLowerCase() === ssid.toLowerCase() &&
			!(s.url === config?.url && s.username === config?.username)
		)
		if (!server) return
		await AsyncStorage.setItem('config', JSON.stringify(server))
		setConfig(server)
		Player.resetAudio(songDispatch)
		logger.info('NetworkAutoSwitch', `Switched to server '${server.name}' on network '${ssid}'`)
	}, [settings.servers, config, setConfig, songDispatch])

	React.useEffect(() => {
		switchForNetwork()
		const sub = AppState.addEventListener('change', (state) => {
			if (state === 'active') switchForNetwork()
		})
		return () => sub.remove()
	}, [switchForNetwork])

	return null
}

export default NetworkAutoSwitch
