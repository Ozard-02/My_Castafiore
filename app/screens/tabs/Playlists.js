import React from 'react'
import { ScrollView, Text, TextInput, View, StyleSheet, Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { LegendList } from '@legendapp/list'
import Icon from 'react-native-vector-icons/FontAwesome'

import { useConfig } from '~/contexts/config'
import { useCachedAndApi, getApi } from '~/utils/api'
import { useSettings, useSetSettings } from '~/contexts/settings'
import { useTheme } from '~/contexts/theme'
import RotateIconButton from '~/components/button/RotateIconButton'
import IconButton from '~/components/button/IconButton'
import mainStyles from '~/styles/main'
import SongsList from '~/components/lists/SongsList'
import VerticalPlaylist from '~/components/lists/VerticalPlaylist'
import AllItem from '~/components/item/AllItem'
import size from '~/styles/size'

const Playlists = ({ navigation }) => {
	const { t } = useTranslation()
	const config = useConfig()
	const insets = useSafeAreaInsets()
	const settings = useSettings()
	const setSettings = useSetSettings()
	const [layout, setLayout] = React.useState(settings.gridView ? 'grid' : 'list')
	const theme = useTheme()
	const [newPlaylist, setNewPlaylist] = React.useState(null)

	const [favorited, refreshFavorited] = useCachedAndApi([], 'getStarred2', null, (json, setData) => {
		setData(json?.starred2?.song)
	}, [])

	const [playlists, refreshPlaylists, setPlaylists] = useCachedAndApi([], 'getPlaylists', null, (json, setData) => {
		setData([...(json?.playlists?.playlist || [])].sort(sortPlaylist))
	}, [])

	React.useEffect(() => {
		setPlaylists([...playlists].sort(sortPlaylist))
	}, [settings.orderPlaylist])

	const onRefresh = (rotate) => {
		rotate()
		refreshFavorited()
		refreshPlaylists()
	}

	const isPin = (item) => {
		return item.comment?.includes(`#${config.username}-pin`)
	}

	const sortPlaylist = (a, b) => {
		if (isPin(a) && !isPin(b)) {
			return -1
		} else if (!isPin(a) && isPin(b)) {
			return 1
		} else if (settings.orderPlaylist === 'title') {
			return a.name.localeCompare(b.name)
		} else if (settings.orderPlaylist === 'changed') {
			return b.changed.localeCompare(a.changed)
		} else if (settings.orderPlaylist === 'newest') {
			return b.created.localeCompare(a.created)
		} else if (settings.orderPlaylist === 'oldest') {
			return a.created.localeCompare(b.created)
		}
	}

	const addPlaylist = () => {
		if (!newPlaylist?.length) return
		getApi(config, 'createPlaylist', { name: newPlaylist })
			.then(() => {
				setNewPlaylist(null)
				refreshPlaylists()
			})
	}

	const header = (
		<>
			<View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginEnd: 20, marginTop: 30, marginBottom: 20 }}>
				<Text style={[mainStyles.mainTitle(theme), { marginBottom: 0, marginTop: 0 }]}>{t('Your Playlists')}</Text>
				<View style={{ flexDirection: 'row', alignItems: 'center' }}>
					<IconButton
						icon={layout === 'grid' ? 'list' : 'th-large'}
						size={size.icon.small}
						color={theme.primaryText}
						style={{ padding: 10 }}
						onPress={() => {
							const next = layout === 'list' ? 'grid' : 'list'
							setLayout(next)
							setSettings({ ...settings, gridView: next === 'grid' })
						}}
					/>
					<RotateIconButton
						icon="refresh"
						size={size.icon.large}
						color={theme.primaryText}
						style={{ paddingHorizontal: 10 }}
						onPress={onRefresh}
					/>
				</View>
			</View>
			<View style={[styles.subTitleParent, { marginTop: 10 }]}>
				{
					newPlaylist !== null ?
						<>
							<TextInput
								style={{
									height: 40,
									borderColor: 'gray',
									borderWidth: 1,
									borderRadius: 6,
									color: theme.primaryText,
									flex: 1,
									paddingHorizontal: 10,
									outline: 'none',
								}}
								onSubmitEditing={() => addPlaylist()}
								autoFocus={true}
								onChangeText={text => setNewPlaylist(text)}
								value={newPlaylist}
							/>
							<IconButton
								icon={newPlaylist?.length > 0 ? 'plus' : 'times'}
								size={size.icon.tiny}
								color={theme.secondaryText}
								style={{ padding: 10, paddingStart: 20 }}
								onPress={() => newPlaylist?.length > 0 ? addPlaylist() : setNewPlaylist(null)} />
						</> :
						<>
							<Icon name="heart" size={size.icon.small} color={theme.primaryTouch} style={{ marginEnd: 10 }} />
							<Text style={[mainStyles.subTitle(theme), { flex: 1 }]}>{t('Playlists')}</Text>
							<IconButton
								icon="plus"
								size={size.icon.tiny}
								color={theme.secondaryText}
								style={{ padding: 10 }}
								onPress={() => newPlaylist?.length > 0 ? addPlaylist() : setNewPlaylist('')} />
						</>
				}
			</View>
		</>
	)

	const favoritedSection = (
		<>
			<Pressable
				style={({ pressed }) => ([mainStyles.opacity({ pressed }), styles.subTitleParent, { marginTop: 20 }])}
				onPress={() => navigation.navigate('Favorited')}
			>
				<Icon name="heart" size={size.icon.small} color={theme.primaryTouch} style={{ marginEnd: 10 }} />
				<Text style={[mainStyles.subTitle(theme), { flex: 1 }]}>{t('Favorited')}</Text>
				<Text style={{ color: theme.secondaryText, fontWeight: 'bold', fontSize: 15 }}>
					{favorited?.length} <Icon name="chevron-right" size={15} color={theme.secondaryText} />
				</Text>
			</Pressable>
			<SongsList songs={favorited?.slice(0, settings.previewFavorited)} listToPlay={favorited} />
		</>
	)

	if (layout === 'grid') return (
		<View style={{ flex: 1 }}>
			<View style={{ height: insets.top, backgroundColor: theme.primaryBack }} />
			<LegendList
				data={playlists}
				numColumns={2}
				keyExtractor={(item) => item.id}
				style={mainStyles.mainContainer(theme)}
				contentContainerStyle={[mainStyles.contentMainContainer(insets), { paddingTop: 0, minHeight: Math.ceil(playlists.length / 2) * 230 + 100 }]}
				waitForInitialLayout={false}
				recycleItems={true}
				estimatedItemSize={230}
				ListHeaderComponent={header}
				ListFooterComponent={favoritedSection}
				renderItem={({ item }) => (
					<AllItem item={item} type="playlist" onPress={() => navigation.navigate('Playlist', { playlist: item })} />
				)}
			/>
		</View>
	)

	return (
		<View style={{ flex: 1 }}>
			<View style={{ height: insets.top, backgroundColor: theme.primaryBack }} />
			<ScrollView
				vertical={true}
				style={mainStyles.mainContainer(theme)}
				contentContainerStyle={[mainStyles.contentMainContainer(insets), { paddingTop: 0 }]}
			>
			{header}
			<VerticalPlaylist playlists={playlists} onRefresh={refreshPlaylists} />
			{favoritedSection}
		</ScrollView>
		</View>
	)
}

const styles = StyleSheet.create({
	subTitleParent: {
		flexDirection: 'row',
		alignItems: 'center',
		marginTop: 10,
		marginBottom: 17,
		...mainStyles.stdVerticalMargin
	},
})

export default Playlists