import React from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import md5 from 'md5'
import { useTranslation } from 'react-i18next'

import { localeLang } from '~/i18next/utils'
import logger from '~/utils/logger'

const SettingsContext = React.createContext()
const SetSettingsContext = React.createContext()

export const useSettings = () => React.useContext(SettingsContext)
export const useSetSettings = () => React.useContext(SetSettingsContext)

export const SettingsProvider = ({ children }) => {
	const [settings, setSettings] = React.useState(defaultSettings)
	const { i18n } = useTranslation()

	// Mirrored onto `global` for the player/download code that runs outside React (the
	// headless service, the download engine). These used to live in updateGlobalSettings(),
	// a plain async function calling seven useEffects during render — it only worked
	// because the call order happened to be stable, and it was invisible to the hooks lint.
	const { streamFormat, maxBitRate, parallelDownloads, saveQueue: saveQueueEnabled, repeatQueue } = settings
	React.useEffect(() => { global.streamFormat = streamFormat }, [streamFormat])
	React.useEffect(() => { global.maxBitRate = maxBitRate }, [maxBitRate])
	React.useEffect(() => { global.parallelDownloads = parallelDownloads }, [parallelDownloads])
	React.useEffect(() => { global.saveQueue = saveQueueEnabled }, [saveQueueEnabled])
	React.useEffect(() => { global.repeatQueue = repeatQueue }, [repeatQueue])

	React.useEffect(() => {
		getSettings().then((data) => setSettings(data))
	}, [])

	const saveSettings = React.useCallback((newSettings) => {
		setSettings(newSettings)
		AsyncStorage.setItem('settings', JSON.stringify(newSettings))
			.catch((error) => {
				logger.error('Save settings', error)
			})
	}, [setSettings])

	React.useEffect(() => {
		const sysLang = localeLang()

		logger.info('i18n', `System language: ${sysLang || 'Not found'}, App language: ${settings.language || 'Not set'}`)
		i18n.changeLanguage(settings.language || sysLang || 'en')
			.catch(err => logger.error('i18n', err))
	}, [settings.language])

	return (
		<SetSettingsContext.Provider value={saveSettings}>
			<SettingsContext.Provider value={settings}>
				{children}
			</SettingsContext.Provider>
		</SetSettingsContext.Provider>
	)
}

export const demoServers = [
	{
		name: 'Demo LMS',
		type: 'lms',
		url: 'https://lms-demo.poupon.dev',
		username: 'demo',
		query: `u=${encodeURI('demo')}&p=${encodeURI('7e5da62f-e4a2-f946-a790-9872352f82ae')}&v=1.16.1&c=castafiore`
	},
	{
		name: 'Demo Ampache',
		type: 'ampache',
		url: 'https://demo.ampache.dev',
		username: 'demo',
		query: `u=${encodeURI('demo')}&t=${md5('demodemo' + 'aaaaaa')}&s=${'aaaaaa'}&v=1.16.1&c=castafiore`
	}
]

export const defaultSettings = {
	isDesktop: false,
	networks: [],
	servers: [
		{
			name: 'Demo',
			type: 'navidrome',
			url: 'https://demo.navidrome.org',
			username: 'demo',
			query: `u=${encodeURI('demo')}&t=${md5('demo' + 'aaaaaa')}&s=${'aaaaaa'}&v=1.16.1&c=castafiore`
		},
	],
	// Home Settings
	homeOrderV2: [
		{ id: 'week-activity', enable: false },
		{ id: 'last-queue', enable: false },
		{ id: 'mood-daily', enable: false },
		{ id: 'mood-weekly', enable: false },
		{ id: 'favorited-artist', enable: true },
		{ id: 'genre', enable: false },
		{ id: 'radio', enable: false },
		{ id: 'pin-playlist', enable: false },
		{ id: 'favorited-album-star', enable: true },
		{ id: 'recently-added', enable: true },
		{ id: 'most-played', enable: true },
		{ id: 'recently-played', enable: true },
		{ id: 'random-album', enable: false },
		{ id: 'highest-album', enable: false },
	],
	listenBrainzUser: '',
	sizeOfList: 15,
	scrollHelper: false,
	// Theme settings
	theme: 'castafiore',
	themePlayer: 'default',
	// Download settings
	parallelDownloads: 3,
	// Player settings
	saveQueue: false,
	streamFormat: 'raw',
	maxBitRate: 0,
	playSeedFirst: false,
	// Full-screen player appearance (spec 2026-10-18): animated fBM background colored
	// from the cover, on by default; reduce transparency swaps the translucent panels
	// for opaque surfaces (accessibility fallback).
	playerBackground: true,
	reduceTransparency: false,
	// Mini player ("pill") animated background (spec 2026-10-19): same fBM field as the
	// full-screen player, opt-in — the pill is visible on every screen, so the cost is
	// permanent. FPS is user-chosen (10 is the battery floor, 30 matches the player).
	miniPlayerBackground: false,
	miniPlayerFps: 15,
	// Repeat the whole queue when it runs out. Off by default: a queue that silently
	// wrapped forever was indistinguishable from "the playlist loops" (endless-radio
	// sessions set song.radioMode and keep sampling instead).
	repeatQueue: false,
	settingsVersion: 2,
	// View settings
	gridView: false,
	// Playlist settings
	reversePlaylist: false,
	sortPlaylist: null,
	orderPlaylist: 'title',
	previewFavorited: 3,
	swipeRightAction: 'queue',
	swipeLeftAction: 'next',
	language: null,
	// UI restyling "Soft Glass" (Fase 0+): flag a livello di token. Default off.
	newUI: false,
	reduceMotionOverride: false,
	hapticsEnabled: false,
}

export const homeSections = [
	{
		icon: 'bar-chart',
		id: 'week-activity',
		title: 'Week Activity',
		type: 'listenbrainz',
		isShowAll: false,
		path: '',
		query: '',
		getInfo: () => { },
	},
	{
		icon: 'list',
		id: 'last-queue',
		title: 'Last queue',
		type: 'queue',
		isShowAll: false,
		path: 'getPlayQueue',
		query: '',
		getInfo: (json, setList) => setList(json?.playQueue),
	},
	{
		icon: 'sun-o',
		id: 'mood-daily',
		title: 'Daily Mixes',
		type: 'mood',
		period: 'daily',
		isShowAll: false,
		path: '',
		query: '',
		getInfo: () => { },
	},
	{
		icon: 'calendar',
		id: 'mood-weekly',
		title: 'Weekly Mixes',
		type: 'mood',
		period: 'weekly',
		isShowAll: false,
		path: '',
		query: '',
		getInfo: () => { },
	},
	{
		icon: 'user',
		id: 'favorited-artist',
		title: 'Favorited Artist',
		type: 'artist',
		isShowAll: true,
		path: 'getStarred2',
		query: '',
		getInfo: (json, setList) => setList(json?.starred2?.artist),
	},
	{
		icon: 'flask',
		id: 'genre',
		title: 'Genre',
		type: 'genre',
		isShowAll: false,
		path: 'getGenres',
		query: '',
		getInfo: (json, setList) => setList(json?.genres?.genre),
	},
	{
		icon: 'feed',
		id: 'radio',
		title: 'Radio',
		type: 'radio',
		isShowAll: false,
		path: 'getInternetRadioStations',
		query: '',
		getInfo: (json, setList) => setList(json?.internetRadioStations?.internetRadioStation),
	},
	{
		icon: 'book',
		id: 'pin-playlist',
		title: 'Pin Playlist',
		type: 'playlist',
		isShowAll: false,
		path: 'getPlaylists',
		query: '',
		getInfo: (json, setList) => setList(json?.playlists?.playlist?.filter((playlist) => playlist.comment?.includes(`#${global.config.username}-pin`))),
	},
	{
		icon: 'heart',
		id: 'favorited-album-star',
		title: 'Favorited',
		type: 'song',
		isShowAll: true,
		path: 'getStarred2',
		query: '',
		getInfo: (json, setList) => setList(json?.starred2?.song),
	},
	{
		id: 'recently-added',
		icon: 'plus',
		title: 'Recently Added',
		type: 'album',
		isShowAll: true,
		path: 'getAlbumList2',
		query: 'type=newest',
		getInfo: (json, setList) => setList(json?.albumList2?.album),
	},
	{
		id: 'most-played',
		icon: 'trophy',
		title: 'Most Played',
		type: 'album',
		isShowAll: true,
		path: 'getAlbumList2',
		query: 'type=frequent',
		getInfo: (json, setList) => setList(json?.albumList2?.album),
	},
	{
		id: 'recently-played',
		icon: 'play',
		title: 'Recently Played',
		type: 'album',
		isShowAll: true,
		path: 'getAlbumList2',
		query: 'type=recent',
		getInfo: (json, setList) => setList(json?.albumList2?.album),
	},
	{
		id: 'random-album',
		icon: 'random',
		title: 'Random',
		type: 'album',
		isShowAll: false,
		path: 'getAlbumList2',
		query: 'type=random',
		getInfo: (json, setList) => setList(json?.albumList2?.album),
	},
	{
		id: 'highest-album',
		icon: 'arrow-up',
		title: 'Highest',
		type: 'album',
		isShowAll: true,
		path: 'getAlbumList2',
		query: 'type=highest',
		getInfo: (json, setList) => setList(json?.albumList2?.album),
	},
]

// Bumped whenever a stored default needs correcting on existing installs. Stored settings
// win over defaults (`{...defaultSettings, ...data}`), so changing a default alone only ever
// affects fresh installs.
const SETTINGS_VERSION = 2

const getSettings = async () => {
	const rawSettings = await AsyncStorage.getItem('settings')
	if (rawSettings === null) return { ...defaultSettings, settingsVersion: SETTINGS_VERSION }
	try {
		const data = JSON.parse(rawSettings)
		if (data.homeOrderV2 && data?.homeOrderV2?.length !== defaultSettings.homeOrderV2.length) {
			defaultSettings.homeOrderV2.forEach((section) => {
				if (!data.homeOrderV2.some((s) => s.id === section.id)) {
					data.homeOrderV2.push({ ...section, enable: false })
				}
			})
		}
		// v2: repeatQueue used to default to true, and saveSettings persists the whole merged
		// object — so every existing install has `repeatQueue: true` written out explicitly
		// and cannot be told apart from a user who deliberately enabled it. Force it once: a
		// queue that silently wrapped (and turned a failed radio top-up into "the same 50
		// tracks, in order, forever") is what the new default exists to prevent. Anyone who
		// wants repeat back flips it in Settings → Player or the player options.
		if (!data.settingsVersion || data.settingsVersion < 2) {
			data.repeatQueue = defaultSettings.repeatQueue
			data.settingsVersion = SETTINGS_VERSION
		}
		return {
			...defaultSettings,
			...data,
			homeOrder: undefined,
		}
	} catch {
		return { ...defaultSettings, settingsVersion: SETTINGS_VERSION }
	}
}