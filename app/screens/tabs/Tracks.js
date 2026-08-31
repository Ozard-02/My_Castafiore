import React from 'react'
import { View, Text, TextInput, Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import Icon from 'react-native-vector-icons/FontAwesome'

import { useTheme } from '~/contexts/theme'
import { useSettings, useSetSettings } from '~/contexts/settings'
import mainStyles from '~/styles/main'
import Selector from '~/components/Selector'
import IconButton from '~/components/button/IconButton'
import SongExplorer from '~/screens/Explorer/SongExplorer'
import AlbumExplorer from '~/screens/Explorer/AlbumExplorer'
import ArtistExplorer from '~/screens/Explorer/ArtistExplorer'
import SearchResults from '~/components/search/SearchResults'
import size from '~/styles/size'

const VIEWS = ['tracks', 'albums', 'artists']

const Tracks = () => {
	const { t } = useTranslation()
	const insets = useSafeAreaInsets()
	const theme = useTheme()
	const settings = useSettings()
	const setSettings = useSetSettings()
	const [view, setView] = React.useState('tracks')
	const [layout, setLayout] = React.useState(settings.gridView ? 'grid' : 'list')
	const [query, setQuery] = React.useState('')

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
				{query.length === 0 && <Selector current={view} items={VIEWS} setData={setView} />}
			</View>
			{query.length > 0
				? <SearchResults query={query} setQuery={setQuery} />
				: <>
					{view === 'tracks' && <SongExplorer layout={layout} showHeader={false} />}
					{view === 'albums' && <AlbumExplorer layout={layout} showHeader={false} />}
					{view === 'artists' && <ArtistExplorer layout={layout} showHeader={false} />}
				</>}
		</View>
	)
}

export default Tracks