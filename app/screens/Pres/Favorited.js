import React from 'react'
import { Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LegendList } from "@legendapp/list"
import { useTranslation } from 'react-i18next'
import Icon from 'react-native-vector-icons/FontAwesome'

import { useTheme } from '~/contexts/theme'
import { useCachedFirst } from '~/utils/api'
import { useOffline } from '~/utils/offline'
import { useDownloads } from '~/utils/downloadManager'
import { isSongDownloaded } from '~/utils/offlineContent'
import mainStyles from '~/styles/main'
import OptionsFavorited from '~/components/options/OptionsFavorited'
import OptionsSongsList from '~/components/options/OptionsSongsList'
import PresHeaderIcon from '~/components/PresHeaderIcon'
import RandomButton from '~/components/button/RandomButton'
import size from '~/styles/size'
import SongItem from '~/components/item/SongItem'

const Favorited = () => {
	const insets = useSafeAreaInsets()
	const theme = useTheme()
	const [indexOptions, setIndexOptions] = React.useState(-1)
	const { t } = useTranslation()
	const [isOption, setIsOption] = React.useState(false)

	const [favorited] = useCachedFirst([], 'getStarred2', null, (json, setData) => {
		setData(json?.starred2?.song || [])
	}, [])
	const offline = useOffline() && Platform.OS !== 'web'
	const downloads = useDownloads()

	// offline only the starred songs that are actually downloaded can play, so the whole
	// screen narrows to those
	const list = React.useMemo(() => {
		if (!offline) return favorited
		return favorited.filter((item) => isSongDownloaded(downloads, item?.id))
	}, [offline, favorited, downloads])

	const renderItem = React.useCallback(({ item, index }) => (
		<SongItem
			song={item}
			queue={list}
			index={index}
			setIndexOptions={setIndexOptions}
			style={{
				paddingHorizontal: 20,
			}}
		/>
	), [list])

	return (
		<>
			<OptionsFavorited
				favorited={list}
				isOpen={isOption}
				onClose={() => setIsOption(false)}
			/>
			<LegendList
				data={list}
				keyExtractor={(item, index) => item?.id ?? index}
				style={mainStyles.mainContainer(theme)}
				contentContainerStyle={mainStyles.contentMainContainer(insets, false)}
				waitForInitialLayout={false}
				recycleItems={true}
				estimatedItemSize={60}
				ListHeaderComponent={
					<PresHeaderIcon
						title={<><Icon name="heart" size={size.icon.small} color={theme.primaryTouch} /> {t('Favorited')}</>}
						subTitle={`${list?.length || 0} ${t('songs')}`}
						icon="heart"
						onPressOption={() => setIsOption(true)}
					>
						<RandomButton songList={list} />
					</PresHeaderIcon>
				}
				renderItem={renderItem}
			/>
			<OptionsSongsList
				songs={list}
				indexOptions={indexOptions}
				setIndexOptions={setIndexOptions}
			/>
		</>
	)
}

export default Favorited