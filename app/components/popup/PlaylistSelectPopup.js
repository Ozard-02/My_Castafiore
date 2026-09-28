import React from 'react'
import { View, Text, Modal, ScrollView, ActivityIndicator, Pressable, Alert } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import Icon from 'react-native-vector-icons/FontAwesome'

import { useConfig } from '~/contexts/config'
import { useTheme } from '~/contexts/theme'
import { getApi, getApiCacheFirst, updatePlaylistEntries } from '~/utils/api'
import { urlCover } from '~/utils/url'
import { confirmAlert } from '~/utils/alert'
import ImageError from '~/components/ImageError'
import mainStyles from '~/styles/main'
import size from '~/styles/size'

// getPlaylists does not include entries, so membership costs one getPlaylist per playlist.
// Cap the fan-out so a library with hundreds of playlists does not open 300 sockets at once.
const MEMBERSHIP_CONCURRENCY = 5

const mapWithLimit = async (items, limit, fn) => {
	const results = new Array(items.length)
	let cursor = 0
	const worker = async () => {
		while (cursor < items.length) {
			const index = cursor++
			results[index] = await fn(items[index], index)
		}
	}
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
	return results
}

const SelectCircle = ({ selected, theme }) => (
	<View
		style={{
			width: 22,
			height: 22,
			borderRadius: 11,
			borderWidth: 2,
			alignItems: 'center',
			justifyContent: 'center',
			borderColor: selected ? theme.primaryTouch : theme.secondaryText,
			backgroundColor: selected ? theme.primaryTouch : 'transparent',
		}}
	>
		{selected && <Icon name="check" size={13} color={theme.primaryBack} />}
	</View>
)

// Multi-select "Add to playlist" sheet. Really a membership editor: playlists that already
// contain the song(s) start filled, and deselecting one REMOVES them from it.
const PlaylistSelectPopup = ({ visible, close, songIds, onDone = () => { } }) => {
	const { t } = useTranslation()
	const theme = useTheme()
	const config = useConfig()
	const insets = useSafeAreaInsets()
	const [playlists, setPlaylists] = React.useState([])
	const [initial, setInitial] = React.useState(new Set())
	const [selected, setSelected] = React.useState(new Set())
	const [loading, setLoading] = React.useState(false)
	const [saving, setSaving] = React.useState(false)
	const alive = React.useRef(true)

	const idsKey = (songIds || []).join(',')

	React.useEffect(() => {
		if (!visible) return
		alive.current = true
		setLoading(true)
		setPlaylists([])
		load()
		return () => { alive.current = false }
	}, [visible, idsKey])

	const load = async () => {
		const wanted = new Set((songIds || []).filter(Boolean))
		if (!wanted.size) {
			if (alive.current) setLoading(false)
			return
		}
		const json = await getApi(config, 'getPlaylists').catch(() => null)
		const list = json?.playlists?.playlist || []
		const entries = await mapWithLimit(list, MEMBERSHIP_CONCURRENCY, (playlist) =>
			getApiCacheFirst(config, 'getPlaylist', { id: playlist.id })
				.then((res) => res?.playlist?.entry || [])
				.catch(() => [])
		)
		if (!alive.current) return

		// a playlist counts as selected only when it holds EVERY target song; a partial
		// match shows an empty circle and is left untouched unless the user taps it.
		// `readonly` is an OpenSubsonic field: Navidrome sets it on playlists synced from a
		// .m3u/.nsp on disk, where the file is the source of truth and API writes are
		// refused (Subsonic error 50) no matter who owns it. Without this the only way to
		// discover it was to attempt a write and swallow the failure.
		const full = new Set()
		const rows = list.map((playlist, index) => {
			const ids = new Set((entries[index] || []).map((song) => song.id))
			const isFull = [...wanted].every((id) => ids.has(id))
			const readonly = playlist.readonly === true
			if (isFull && !readonly) full.add(playlist.id)
			return {
				...playlist,
				songCount: (entries[index] || []).length,
				isFull,
				readonly,
				autoImport: /auto-imported/i.test(playlist.comment || '') ? playlist.comment : null,
			}
		})
		setPlaylists(rows)
		setInitial(new Set(full))
		setSelected(new Set(full))
		setLoading(false)
	}

	const toggle = (id) => {
		setSelected((prev) => {
			const next = new Set(prev)
			if (next.has(id)) next.delete(id)
			else next.add(id)
			return next
		})
	}

	const apply = async () => {
		const toAdd = playlists.filter((p) => !p.readonly && selected.has(p.id) && !initial.has(p.id))
		const toRemove = playlists.filter((p) => !p.readonly && !selected.has(p.id) && initial.has(p.id))
		// nothing changed -> just close, no API traffic
		if (!toAdd.length && !toRemove.length) return close()

		const run = async () => {
			setSaving(true)
			const targets = [
				...toAdd.map((playlist) => ({ playlist, addIds: songIds, removeIds: [] })),
				...toRemove.map((playlist) => ({ playlist, addIds: [], removeIds: songIds })),
			]
			let ok = 0
			for (const target of targets) {
				const res = await updatePlaylistEntries(config, target.playlist, target)
					.catch(() => null)
				if (res?.ok) ok++
			}
			setSaving(false)
			close()
			onDone(ok, targets.length)
			// partial failure: report it rather than rolling back (a rollback would be a
			// second destructive pass the user never asked for)
			if (ok < targets.length) {
				Alert.alert(t('Playlist updated'), t('Playlist updated partial', { done: ok, total: targets.length }))
			}
		}

		// adds are additive and safe; removals delete library data, so they get a confirm
		if (toRemove.length) {
			const names = toRemove.map((p) => p.name).join(', ')
			confirmAlert(t('Remove from playlist'), t('Remove from playlist alert', { names }), run)
		} else {
			run()
		}
	}

	return (
		<Modal
			transparent={true}
			visible={visible}
			onRequestClose={close}
			statusBarTranslucent={true}
		>
			<View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
				<Pressable style={{ flex: 1 }} onPress={close} />
				<View
					style={{
						width: '100%',
						maxWidth: 600,
						alignSelf: 'center',
						backgroundColor: theme.secondaryBack,
						borderTopLeftRadius: 20,
						borderTopRightRadius: 20,
						paddingBottom: insets.bottom > 15 ? insets.bottom : 15,
						maxHeight: '80%',
					}}
				>
					<View style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
						<Text style={[mainStyles.mediumText(theme.primaryText), { flex: 1 }]}>{t('Add to playlist')}</Text>
						<Pressable onPress={close} hitSlop={12} style={{ padding: 4 }}>
							<Icon name="close" size={size.icon.tiny} color={theme.secondaryText} />
						</Pressable>
					</View>

					{loading ? (
						<View style={{ paddingVertical: 50, alignItems: 'center' }}>
							<ActivityIndicator color={theme.primaryTouch} />
						</View>
					) : (
						<ScrollView style={{ maxHeight: '100%' }} keyboardShouldPersistTaps="handled">
							{playlists.length === 0 ? (
								<View style={{ paddingVertical: 40, alignItems: 'center' }}>
									<Text style={mainStyles.smallText(theme.secondaryText)}>{t('No playlists found')}</Text>
								</View>
							) : playlists.map((playlist) => {
								const isSelected = selected.has(playlist.id)
								return (
									<Pressable
										key={playlist.id}
										onPress={() => !playlist.readonly && toggle(playlist.id)}
										style={({ pressed }) => [mainStyles.opacity({ pressed }), {
											flexDirection: 'row',
											alignItems: 'center',
											gap: 12,
											paddingHorizontal: 20,
											paddingVertical: 10,
											opacity: playlist.readonly ? 0.5 : 1,
										}]}
									>
										<ImageError
											style={{ width: 40, height: 40, borderRadius: size.radius.standard }}
											source={{ uri: urlCover(config, playlist, 100) }}
										/>
										<View style={{ flex: 1 }}>
											<Text style={mainStyles.mediumText(theme.primaryText)} numberOfLines={1}>{playlist.name}</Text>
											<Text style={mainStyles.smallText(theme.secondaryText)} numberOfLines={1}>
												{playlist.autoImport || `${playlist.songCount} ${t('songs')}`}
											</Text>
										</View>
										{playlist.readonly
											? <Icon name="lock" size={16} color={theme.secondaryText} />
											: <SelectCircle selected={isSelected} theme={theme} />}
									</Pressable>
								)
							})}
						</ScrollView>
					)}

					<Pressable
						onPress={apply}
						disabled={saving}
						style={({ pressed }) => [mainStyles.opacity({ pressed }), {
							marginHorizontal: 20,
							marginTop: 12,
							paddingVertical: 14,
							borderRadius: size.radius.card,
							alignItems: 'center',
							flexDirection: 'row',
							justifyContent: 'center',
							gap: 8,
							backgroundColor: theme.primaryTouch,
						}]}
					>
						{saving && <ActivityIndicator size="small" color={theme.primaryBack} />}
						<Text style={{ color: theme.primaryBack, fontSize: size.text.large, fontWeight: '700' }}>{t('Done')}</Text>
					</Pressable>
				</View>
			</View>
		</Modal>
	)
}

export default PlaylistSelectPopup
