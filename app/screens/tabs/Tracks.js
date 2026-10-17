import React from 'react'
import { View, Text, TextInput, Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import Icon from 'react-native-vector-icons/FontAwesome'

import { useTheme } from '~/contexts/theme'
import { useSettings, useSetSettings } from '~/contexts/settings'
import { useOffline } from '~/utils/offline'
import mainStyles from '~/styles/main'
import Selector from '~/components/Selector'
import IconButton from '~/components/button/IconButton'
import SongExplorer from '~/screens/Explorer/SongExplorer'
import AlbumExplorer from '~/screens/Explorer/AlbumExplorer'
import ArtistExplorer from '~/screens/Explorer/ArtistExplorer'
import SearchResults from '~/components/search/SearchResults'
import OfflineSongs from '~/components/offline/OfflineSongs'
import OfflineCollections from '~/components/offline/OfflineCollections'
import OfflineSearch from '~/components/offline/OfflineSearch'
import size from '~/styles/size'

const VIEWS = ['tracks', 'albums', 'artists']
// offline there is no artists catalog to list (artists are derived server-side), so the
// artist view would be empty; tracks + albums cover what is actually downloaded
const OFFLINE_VIEWS = ['tracks', 'albums']

const Tracks = () => {
	const { t } = useTranslation()
	const insets = useSafeAreaInsets()
	const theme = useTheme()
	const settings = useSettings()
	const setSettings = useSetSettings()
	const offline = useOffline()
	const [view, setView] = React.useState('tracks')
	const [layout, setLayout] = React.useState(settings.gridView ? 'grid' : 'list')
	const [query, setQuery] = React.useState('')
	const shownView = offline && view === 'artists' ? 'tracks' : view

	return (
		<View style={[mainStyles.mainContainer(theme)]}>
			<View style={{ paddingTop: insets.top }}>
				<View style={{ flexDirection: 'row', alignItems: 'center' }}>
					<Text style={[mainStyles.mainTitle(theme), { flex: 1 }]}>{t('Music')}</Text>
					<IconButton
						icon={layout === 'grid' ? 'list' : 'th-large'}
						size={22}
						color={theme.primaryText}
						style={{ paddingHorizontal: 20 }}
						onPress={() => {
							const next = layout === 'list' ? 'grid' : 'list'
							setLayout(next)
							setSettings({ ...settings, gridView: next === 'grid' })
						}}
					/>
				</View>
				<View style={{ marginHorizontal: 20, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
					<TextInput
						style={{
							flex: 1,
							color: theme.primaryText,
							fontSize: size.text.large,
							textAlign: 'left',
							padding: 8,
							paddingStart: 42,
							borderRadius: size.radius.standard,
							backgroundColor: theme.secondaryBack,
							outline: 'none',
						}}
						placeholder={t('Search')}
						placeholderTextColor={theme.secondaryText}
						value={query}
						autoCapitalize='none'
						onChangeText={setQuery}
					/>
					{
						query.length ?
							<Pressable
								onPress={() => { setQuery('') }}
								style={({ pressed }) => ([mainStyles.opacity({ pressed }), { justifyContent: 'center' }])}>
								<Text size={size.icon.tiny} style={{ color: theme.primaryTouch }}>{t('Clear')}</Text>
							</Pressable> : null
					}
					<Icon name="search" size={size.icon.tiny} color={theme.secondaryText} style={{ position: 'absolute', left: 0, lineHeight: 20, paddingVertical: 11.5, paddingHorizontal: 12 }} />
				</View>
				{query.length === 0 && <Selector current={shownView} items={offline ? OFFLINE_VIEWS : VIEWS} setData={setView} />}
			</View>
			{query.length > 0
				? (offline ? <OfflineSearch query={query} /> : <SearchResults query={query} setQuery={setQuery} />)
				: <>
					{shownView === 'tracks' && (offline
						? <OfflineSongs layout={layout} />
						: <SongExplorer layout={layout} showHeader={false} />)}
					{shownView === 'albums' && (offline
						? <OfflineCollections type="album" layout={layout} />
						: <AlbumExplorer layout={layout} showHeader={false} />)}
					{shownView === 'artists' && !offline && <ArtistExplorer layout={layout} showHeader={false} />}
				</>}
		</View>
	)
}

export default Tracks