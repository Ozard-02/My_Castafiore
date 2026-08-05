import React from 'react'
import { Text, View, ScrollView, Pressable, ActivityIndicator } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { useConfig } from '~/contexts/config'
import { getApiNetworkFirst } from '~/utils/api'
import { useTheme } from '~/contexts/theme'
import HorizontalAlbums from '~/components/lists/HorizontalAlbums'
import HorizontalArtists from '~/components/lists/HorizontalArtists'
import mainStyles from '~/styles/main'
import SongsList from '~/components/lists/SongsList'
import HistoryItem from '~/components/item/HistoryItem'
import size from '~/styles/size'
import SectionTitle from '~/components/SectionTitle'

const STATES = {
	INIT: 'init',
	LOADING: 'loading',
	LOADED: 'loaded',
	API_ERROR: 'api_error',
	NETWORK_ERROR: 'network_error',
}

const SearchResult = ({ state, query, results, history, setHistory, setQuery, addHistory }) => {
	const { t } = useTranslation()
	const theme = useTheme()
	const navigation = useNavigation()

	const delItemHistory = async (index) => {
		const hist = [...history]
		hist.splice(index, 1)
		setHistory(hist)
		await AsyncStorage.setItem('search.history', JSON.stringify(hist))
	}

	if (query.length === 0 || state === STATES.INIT) return (
		<>
			<View style={{
				display: 'flex',
				marginHorizontal: 20,
				flexDirection: 'row',
				alignItems: 'center',
				gap: 10,
			}}>
				<Pressable
					style={styles.explorer(theme)}
					onPress={() => {
						navigation.navigate('ArtistExplorer')
					}}>
					<Text numberOfLines={1} style={{
						color: theme.primaryText,
						fontSize: size.text.large,
						fontWeight: 'bold',
					}}>{t('Artists')}</Text>
				</Pressable>
				<Pressable
					style={styles.explorer(theme)}
					onPress={() => {
						navigation.navigate('AlbumExplorer')
					}}>
					<Text numberOfLines={1} style={{
						color: theme.primaryText,
						fontSize: size.text.large,
						fontWeight: 'bold',
					}}>{t('Albums')}</Text>
				</Pressable>
				<Pressable
					style={styles.explorer(theme)}
					onPress={() => {
						navigation.navigate('SongExplorer')
					}}>
					<Text numberOfLines={1} style={{
						color: theme.primaryText,
						fontSize: size.text.large,
						fontWeight: 'bold',
					}}>{t('Songs')}</Text>
				</Pressable>
			</View>
			{
				history.length === 0 ? null : (
					<>
						<Text style={[mainStyles.titleSection(theme), { fontSize: size.text.large, marginTop: 10, marginBottom: 3 }]}>{t('History')}</Text>
						{
							history.map((item, index) => (
								<HistoryItem key={index} itemHist={item} index={index} setQuery={setQuery} delItemHistory={delItemHistory} />
							))
						}
					</>
				)}
		</>
	)
	else if (state === STATES.LOADING) {
		return (
			<ActivityIndicator size={'large'} color={theme.primaryTouch} />
		)
	}
	else if (state === STATES.LOADED) {
		if (results && !results.artist && !results.album && !results.song) return (
			<Text style={{
				margin: 20,
				color: theme.secondaryText,
				fontSize: size.text.large,
				textAlign: 'center',
			}}>{t('No results')}</Text>
		)
		else if (results) return (
			<>
				{
					results.artist &&
					<>
						<SectionTitle
							title={t('Artists')}
							onPress={() => navigation.navigate('SearchMore', { type: 'artist', query, items: results.artist })}
							button={results.artist.length === 20}
						/>
						<HorizontalArtists artists={results.artist} onPress={(item) => addHistory({ ...item, mediaType: 'artist' })} />
					</>
				}
				{
					results.album &&
					<>
						<SectionTitle
							title={t('Albums')}
							onPress={() => navigation.navigate('SearchMore', { type: 'album', query, items: results.album })}
							button={results.album.length === 20}
						/>
						<HorizontalAlbums albums={results.album} onPress={(item) => addHistory({ ...item, mediaType: 'album' })} />
					</>
				}
				{
					results.song &&
					<>
						<SectionTitle
							title={t('Songs')}
							onPress={() => navigation.navigate('SearchMore', { type: 'song', query, items: results.song })}
							button={results.song.length === 20}
						/>
						<SongsList songs={results.song} onPress={(item) => {
							addHistory({ ...item, mediaType: 'song' })
							return true
						}} />
					</>
				}
			</>)
	} else if (state === STATES.API_ERROR) return (
		<Text style={{
			margin: 20,
			color: theme.secondaryText,
			fontSize: size.text.large,
			textAlign: 'center',
		}}>{t('API Error')}</Text>
	)
	else if (state === STATES.NETWORK_ERROR) return (
		<Text style={{
			margin: 20,
			color: theme.secondaryText,
			fontSize: size.text.large,
			textAlign: 'center',
		}}>{t('Network Error')}</Text>
	)
	return null
}

const SearchResults = ({ query, setQuery }) => {
	const config = useConfig()
	const [history, setHistory] = React.useState([])
	const [results, setResults] = React.useState()
	const [state, setState] = React.useState(STATES.INIT)
	const timeout = React.useRef(null)

	React.useEffect(() => {
		if (history.length) return
		AsyncStorage.getItem('search.history')
			.then((hist) => {
				if (hist) setHistory(JSON.parse(hist))
			})
	}, [])

	React.useEffect(() => {
		if (query.length === 0) {
			setState(STATES.INIT)
		} else if (query.length > 1) {
			clearTimeout(timeout.current)
			timeout.current = setTimeout(() => {
				getSearch()
			}, 500)
		}
	}, [query])

	const addHistory = async (query) => {
		let hist = []
		if (typeof query === 'string') {
			if (!query || !query.length || history.includes(query)) return
		} else if (typeof query === 'object') {
			if (!query || history.includes(query)) return
		} else return
		hist = [query, ...history]
		setHistory(hist)
		await AsyncStorage.setItem('search.history', JSON.stringify(hist))
	}

	const getSearch = () => {
		setState(STATES.LOADING)
		getApiNetworkFirst(config, 'search3', { query })
			.then((json) => {
				setState(STATES.LOADED)
				setResults(json?.searchResult3 || undefined)
			})
			.catch((err) => {
				if (err.isApiError) setState(STATES.API_ERROR)
				else setState(STATES.NETWORK_ERROR)
				setResults(undefined)
			})
	}

	return (
		<ScrollView vertical={true} style={{ flex: 1 }} contentContainerStyle={{ flexDirection: 'column', paddingBottom: 80, gap: 10 }}>
			<SearchResult
				state={state}
				query={query}
				results={results}
				history={history}
				setHistory={setHistory}
				setQuery={setQuery}
				addHistory={addHistory}
			/>
		</ScrollView>
	)
}

const styles = {
	explorer: theme => ({
		flex: 1,
		paddingHorizontal: 10,
		paddingVertical: 15,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: 10,
		backgroundColor: theme.secondaryBack,
		maxWidth: 400,
	}),
}

export default SearchResults
