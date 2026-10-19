import React from 'react'
import { Text, View, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'

import { useSettings, useSetSettings } from '~/contexts/settings'
import { useTheme } from '~/contexts/theme'
import { themes, themesPlayer } from '~/contexts/theme'
import Header from '~/components/Header'
import mainStyles from '~/styles/main'
import settingStyles from '~/styles/settings'
import SelectItem from '~/components/settings/SelectItem'
import ButtonSwitch from '~/components/settings/ButtonSwitch'

const MINI_PLAYER_FPS = [10, 15, 20, 30]

const Theme = () => {
	const { t } = useTranslation()
	const insets = useSafeAreaInsets()
	const settings = useSettings()
	const setSettings = useSetSettings()
	const theme = useTheme()

	return (
		<ScrollView
			style={mainStyles.mainContainer(theme)}
			contentContainerStyle={mainStyles.contentMainContainer(insets)}
		>
			<Header title={t("Theme")} />
			<View style={settingStyles.contentMainContainer}>
				<Text style={settingStyles.titleContainer(theme)}>{t('Theme')}</Text>
				<View style={settingStyles.optionsContainer(theme)}>
					{
						Object.keys(themes).map((themeName, index) => (
							<SelectItem
								key={index}
								text={themeName}
								icon="tint"
								colorIcon={themes[themeName].primaryTouch}
								isSelect={themeName == settings.theme}
								onPress={() => {
									setSettings({ ...settings, theme: themeName })
								}}
							/>
						))
					}
				</View>
				<Text style={settingStyles.titleContainer(theme)}>{t('settings.theme.Player Theme')}</Text>
				<View style={settingStyles.optionsContainer(theme)}>
					{
						Object.keys(themesPlayer).map((themeName, index) => (
							<SelectItem
								key={index}
								text={themeName}
								icon="tint"
								colorIcon={themesPlayer[themeName].playerBackground}
								isSelect={themeName == settings.themePlayer}
								onPress={() => {
									setSettings({ ...settings, themePlayer: themeName })
								}}
							/>
						))
					}
				</View>
				<Text style={settingStyles.titleContainer(theme)}>{t('settings.theme.Mini player')}</Text>
				<View style={[settingStyles.optionsContainer(theme), { marginBottom: 5 }]}>
					<ButtonSwitch
						title={t('settings.theme.Animated background')}
						value={settings.miniPlayerBackground === true}
						onPress={() => setSettings({ ...settings, miniPlayerBackground: settings.miniPlayerBackground !== true })}
						isLast
					/>
				</View>
				<Text style={settingStyles.description(theme)}>{t('settings.theme.Animated background Description')}</Text>
				{
					settings.miniPlayerBackground === true &&
					<>
						<Text style={settingStyles.titleContainer(theme)}>{t('settings.theme.Frames per second')}</Text>
						<View style={[settingStyles.optionsContainer(theme), { marginBottom: 5 }]}>
							{
								MINI_PLAYER_FPS.map((value) => (
									<SelectItem
										key={value}
										text={`${value}`}
										icon="tachometer"
										isSelect={(settings.miniPlayerFps || 15) === value}
										onPress={() => setSettings({ ...settings, miniPlayerFps: value })}
									/>
								))
							}
						</View>
					</>
				}
			</View>
		</ScrollView>
	)
}

export default Theme