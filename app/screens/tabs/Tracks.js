import React from 'react'
import { View, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'

import { useTheme } from '~/contexts/theme'
import mainStyles from '~/styles/main'
import Selector from '~/components/Selector'
import IconButton from '~/components/button/IconButton'
import SongExplorer from '~/screens/Explorer/SongExplorer'
import AlbumExplorer from '~/screens/Explorer/AlbumExplorer'
import ArtistExplorer from '~/screens/Explorer/ArtistExplorer'

const VIEWS = ['songs', 'albums', 'artists']

const Tracks = () => {
	const { t } = useTranslation()
	const insets = useSafeAreaInsets()
	const theme = useTheme()
	const [view, setView] = React.useState('songs')
	const [layout, setLayout] = React.useState('list')

	return (
		<View style={[mainStyles.mainContainer(theme)]}>
			<View style={{ paddingTop: insets.top }}>
				<View style={{ flexDirection: 'row', alignItems: 'center' }}>
					<Text style={[mainStyles.mainTitle(theme), { flex: 1 }]}>{t('Tracks')}</Text>
					<IconButton
						icon={layout === 'grid' ? 'list' : 'th-large'}
						size={22}
						color={theme.primaryText}
						style={{ paddingHorizontal: 20 }}
						onPress={() => setLayout(layout === 'list' ? 'grid' : 'list')}
					/>
				</View>
				<Selector current={view} items={VIEWS} setData={setView} />
			</View>
			{view === 'songs' && <SongExplorer layout={layout} showHeader={false} />}
			{view === 'albums' && <AlbumExplorer layout={layout} showHeader={false} />}
			{view === 'artists' && <ArtistExplorer layout={layout} showHeader={false} />}
		</View>
	)
}

export default Tracks