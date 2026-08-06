import { PermissionsAndroid } from 'react-native'
import NetInfo from '@react-native-community/netinfo'

import logger from '~/utils/logger'

export const CELLULAR_NETWORK = '__cellular__'

export const requestLocationPermission = async () => {
	try {
		const granted = await PermissionsAndroid.request(
			PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
		)
		return granted === PermissionsAndroid.RESULTS.GRANTED
	} catch (error) {
		logger.info('Network', `Location permission error: ${error.message}`)
		return false
	}
}

export const getNetworkInfo = async () => {
	try {
		const state = await NetInfo.fetch()
		if (state.type === 'wifi') {
			let ssid = state?.details?.ssid?.replace(/^"|"$/g, '')
			if (!ssid || ssid.startsWith('<')) return { type: 'wifi', ssid: null }
			return { type: 'wifi', ssid }
		}
		if (state.type === 'cellular') return { type: 'cellular' }
		return { type: 'none' }
	} catch (error) {
		logger.info('Network', `Network info unavailable: ${error.message}`)
		return { type: 'none' }
	}
}

export const getCurrentNetwork = async () => {
	const info = await getNetworkInfo()
	return info.type === 'wifi' ? info.ssid : null
}
