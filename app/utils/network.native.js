import * as Network from 'expo-network'

import logger from '~/utils/logger'

export const getCurrentNetwork = async () => {
	try {
		const ssid = await Network.getWifiSsid()
		if (!ssid) return null
		return ssid.replace(/^"|"$/g, '')
	} catch (error) {
		logger.info('Network', `SSID not available: ${error.message}`)
		return null
	}
}
