import React from 'react'
import { View, Text, Modal, ScrollView, ActivityIndicator, Pressable, Alert } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import Icon from 'react-native-vector-icons/FontAwesome'

import { useConfig } from '~/contexts/config'
import { useSetUpdateApi } from '~/contexts/updateApi'
import { useSongDispatch } from '~/contexts/song'
import { useTheme } from '~/contexts/theme'
import { getApi, getApiCacheFirst, refreshApi, updatePlaylistEntries } from '~/utils/api'
import { urlCover } from '~/utils/url'
import { confirmAlert } from '~/utils/alert'
import ImageError from '~/components/ImageError'
import mainStyles from '~/styles/main'
import size from '~/styles/size'
import logger from '~/utils/logger'

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
// "Favourited" is a pseudo-playlist at the top backed by the Subsonic star API, so the
// favouriting action the old hearts performed lives on inside this one sheet.
const PlaylistSelectPopup = ({ visible, close, songs = [], onDone = () => { } }) => {
	const { t } = useTranslation()
	const theme = useTheme()
	const config = useConfig()
	const songDispatch = useSongDispatch()
	const setUpdateApi = useSetUpdateApi()
	const insets = useSafeAreaInsets()
	const [playlists, setPlaylists] = React.useState([])
	const [initial, setInitial] = React.useState(new Set())
	const [selected, setSelected] = React.useState(new Set())
	const [favorited, setFavorited] = React.useState(false)
	const [initialFavorited, setInitialFavorited] = React.useState(false)
	const [starCount, setStarCount] = React.useState(null)
	const [loading, setLoading] = React.useState(false)
	const [saving, setSaving] = React.useState(false)
	const alive = React.useRef(true)

	const idsKey = (songs || []).map((song) => song?.id).filter(Boolean).join(',')

	React.useEffect(() => {
		if (!visible) return
		alive.current = true
		setLoading(true)
		setPlaylists([])
		load()
		return () => { alive.current = false }
	}, [visible, idsKey])

	const load = async () => {
		const wanted = (songs || []).filter((song) => song?.id)
		if (!wanted.length) {
			if (alive.current) {
				setLoading(false)
				setInitialFavorited(false)
				setFavorited(false)
				setStarCount(null)
			}
			return
		}
		// count for the Favourited row subtitle: cache-first, absent is fine
		setStarCount(null)
		getApiCacheFirst(config, 'getStarred2', null)
			.then((json) => {
				if (alive.current) setStarCount((json?.starred2?.song || []).length)
			})
			.catch(() => { })

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
		const wantedIds = new Set(wanted.map((song) => song.id))
		const allStarred = wanted.every((song) => song.starred === true)
		const full = new Set()
		const rows = list.map((playlist, index) => {
			const ids = new Set((entries[index] || []).map((song) => song.id))
			const isFull = [...wantedIds].every((id) => ids.has(id))
			const readonly = playlist.readonly === true
			if (isFull && !readonly) full.add(playlist.id)
			return { ...playlist, songCount: (entries[index] || []).length, isFull, readonly }
		})
		setPlaylists(rows)
		setInitial(new Set(full))
		setSelected(new Set(full))
		setInitialFavorited(allStarred)
		setFavorited(allStarred)
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
		const wanted = (songs || []).filter((song) => song?.id)
		// Favourited deltas: turning it on stars only the missing songs; turning it off
		// unstars every target (the row is only filled when all of them were starred).
		const starIds = favorited === initialFavorited
			? []
			: wanted.filter((song) => favorited ? song.starred !== true : song.starred === true).map((song) => song.id)
		const wantedIds = wanted.map((song) => song.id)
		const toAdd = playlists.filter((p) => !p.readonly && selected.has(p.id) && !initial.has(p.id))
		const toRemove = playlists.filter((p) => !p.readonly && !selected.has(p.id) && initial.has(p.id))
		// nothing changed -> just close, no API traffic
		if (!toAdd.length && !toRemove.length && !starIds.length) return close()

		const run = async () => {
			setSaving(true)
			const targets = [
				...toAdd.map((playlist) => ({ playlist, addIds: wantedIds, removeIds: [] })),
				...toRemove.map((playlist) => ({ playlist, addIds: [], removeIds: wantedIds })),
			]
			let ok = 0
			for (const target of targets) {
				const res = await updatePlaylistEntries(config, target.playlist, target)
					.catch(() => null)
				if (res?.ok) ok++
			}
			// star/unstar, then keep the queue copy and the getStarred2 listeners in sync
			// exactly like the old FavoritedButton heart did
			let starOk = 0
			if (starIds.length) {
				const method = favorited ? 'star' : 'unstar'
				for (const songId of starIds) {
					const done = await getApi(config, method, { id: songId })
						.then(() => true)
						.catch((e) => {
							logger.error('PlaylistSelectPopup', `${method} ${songId}: ${e.message}`)
							return false
						})
					if (done) {
						starOk++
						songDispatch({ type: 'setRating', id: songId, starred: favorited })
					}
				}
				refreshApi(config, 'getStarred2', null)
					.finally(() => setUpdateApi({ path: 'getStarred2', query: null, uid: 1 }))
			}
			setSaving(false)
			close()
			// extras.starred: the resulting Favourited state when every star call landed
			// (null when untouched or partially failed — the row keeps its previous state)
			onDone(ok, targets.length, { starred: starIds.length ? (starOk === starIds.length ? favorited : null) : null })
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
							<Pressable
								onPress={() => setFavorited((prev) => !prev)}
								style={({ pressed }) => [mainStyles.opacity({ pressed }), {
									flexDirection: 'row',
									alignItems: 'center',
									gap: 12,
									paddingHorizontal: 20,
									paddingVertical: 10,
								}]}
							>
								<View
									style={{
										width: 40,
										height: 40,
										borderRadius: size.radius.standard,
										alignItems: 'center',
										justifyContent: 'center',
										backgroundColor: theme.primaryBack,
									}}
								>
									<Icon name="heart" size={18} color={theme.primaryTouch} />
								</View>
								<View style={{ flex: 1 }}>
									<Text style={mainStyles.mediumText(theme.primaryText)} numberOfLines={1}>{t('Favorited')}</Text>
									{starCount !== null && (
										<Text style={mainStyles.smallText(theme.secondaryText)} numberOfLines={1}>
											{starCount} {t('songs')}
										</Text>
									)}
								</View>
								<SelectCircle selected={favorited} theme={theme} />
							</Pressable>

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
												{playlist.songCount} {t('songs')}
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
