import React from 'react'
import { Platform } from 'react-native'
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context'
import { useFonts, RobotoMono_400Regular, RobotoMono_500Medium, RobotoMono_600SemiBold, RobotoMono_700Bold } from '@expo-google-fonts/roboto-mono'

import '~/i18next/i18next'
import { version } from '~/../package.json'
import AppProvider from '~/contexts'
import logger from '~/utils/logger'
import Navigation from '~/components/Navigation'

const App = () => {
	const [fontsLoaded, fontError] = useFonts({
		RobotoMono_400Regular,
		RobotoMono_500Medium,
		RobotoMono_600SemiBold,
		RobotoMono_700Bold,
	})

	React.useEffect(() => {
		logger.info('App', `App started (version: ${version}, platform: ${Platform.OS} ${Platform.Version})`)
	}, [])

	if (!fontsLoaded && !fontError) return null

	return (
		<AppProvider>
			<SafeAreaProvider initialMetrics={initialWindowMetrics}>
				<Navigation />
			</SafeAreaProvider>
		</AppProvider>
	)
}

export default App