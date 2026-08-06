import React from 'react'
import { AppState } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import NetInfo from '@react-native-community/netinfo'

import { useConfig, useSetConfig } from '~/contexts/config'
import { useSettings } from '~/contexts/settings'
import { useSongDispatch } from '~/contexts/song'
import { getNetworkInfo, CELLULAR_NETWORK } from '~/utils/network'
import Player from '~/utils/player'
import logger from '~/utils/logger'

const FALLBACK_KEY = 'lastFallback'

const NetworkAutoSwitch = () => {
	const config = useConfig()
	const setConfig = useSetConfig()
	const settings = useSettings()
	const songDispatch = useSongDispatch()

	const switchTo = async (server) => {
		await AsyncStorage.setItem('config', JSON.stringify(server))
		setConfig(server)
		Player.resetAudio(songDispatch)
		logger.info('NetworkAutoSwitch', `Switched to server '${server.name}'`)
	}

	const decide = React.useCallback(async () => {
		const info = await getNetworkInfo()
		if (!info || info.type === 'none' || info.type === 'unknown') return
		const ssid = info.type === 'wifi' && info.ssid ? info.ssid.toLowerCase() : null
		if (info.type === 'wifi' && !ssid) return
		const active = config?.url ? config : null
		const isActive = (s) => s.url === config?.url && s.username === config?.username

		const onCellular = info.type === 'cellular'
		const bound = onCellular
			? settings.servers?.find((s) => s.network === CELLULAR_NETWORK)
			: settings.servers?.find((s) => s.network && s.network !== CELLULAR_NETWORK && s.network.toLowerCase() === ssid)

		if (bound && !isActive(bound)) {
			if (active && !active.network) {
				await AsyncStorage.setItem(FALLBACK_KEY, JSON.stringify(active)).catch(() => { })
			}
			switchTo(bound)
			return
		}

		const activeBound = active?.network
		if (activeBound) {
			const stillOnBound = activeBound === CELLULAR_NETWORK
				? onCellular
				: !!ssid && activeBound.toLowerCase() === ssid
			if (!stillOnBound) {
				let fallback = null
				try {
					fallback = JSON.parse(await AsyncStorage.getItem(FALLBACK_KEY))
				} catch { /* corrupted/absent fallback is fine */ }
				if (fallback && !settings.servers?.some((s) => s.url === fallback.url && s.username === fallback.username)) fallback = null
				if (!fallback) fallback = settings.servers?.find((s) => !s.network)
				if (fallback && !isActive(fallback)) switchTo(fallback)
			}
		}
	}, [config, settings.servers, setConfig, songDispatch])

	React.useEffect(() => {
		decide()
		const unsub = NetInfo.addEventListener(() => decide())
		const sub = AppState.addEventListener('change', (state) => {
			if (state === 'active') decide()
		})
		return () => {
			unsub()
			sub.remove()
		}
	}, [decide])

	return null
}

export default NetworkAutoSwitch
