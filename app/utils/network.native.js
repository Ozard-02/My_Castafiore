import { PermissionsAndroid } from 'react-native'
import NetInfo from '@react-native-community/netinfo'

import logger from '~/utils/logger'

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

export const getCurrentNetwork = async () => {
	try {
		const state = await NetInfo.fetch('wifi')
		let ssid = state?.details?.ssid
		if (!ssid) return null
		ssid = ssid.replace(/^"|"$/g, '')
		if (!ssid || ssid.startsWith('<')) return null
		return ssid
	} catch (error) {
		logger.info('Network', `SSID not available: ${error.message}`)
		return null
	}
}
