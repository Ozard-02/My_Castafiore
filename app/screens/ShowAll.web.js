import React from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { LegendList } from '@legendapp/list'

import { useConfig } from '~/contexts/config'
import { getCachedAndApi } from '~/utils/api'
import { useTheme } from '~/contexts/theme'
import Header from '~/components/Header'
import mainStyles from '~/styles/main'
import AllItem from '~/components/item/AllItem'

const ShowAll = ({ navigation, route: { params: { section } } }) => {
	const { t } = useTranslation()
	const insets = useSafeAreaInsets()
	const config = useConfig()
	const theme = useTheme()
	const [list, setList] = React.useState([])

	React.useEffect(() => {
		getList()
	}, [section.path, section.query])

	const getList = async () => {
		let nquery = section.query || ''

		if (section.type == 'album') nquery += '&size=' + 100
		getCachedAndApi(config, section.path, nquery, (json) => section.getInfo(json, setList))
	}

	const onPress = (item) => {
		if (section.type === 'album') return navigation.navigate('Album', item)
		if (section.type === 'album_star') return navigation.navigate('Album', item)
		if (section.type === 'artist') return navigation.navigate('Artist', { id: item.id, name: item.name })
		if (section.type === 'artist_all') return navigation.navigate('Artist', { id: item.id, name: item.name })
	}

	return (
		<LegendList
			vertical={true}
			numColumns={2}
			style={mainStyles.mainContainer(theme)}
			contentContainerStyle={[mainStyles.contentMainContainer(insets, true), { minHeight: Math.ceil(list.length / 2) * 230 + 100 + 80 }]}
			ListHeaderComponent={() => <Header title={t(`homeSection.${section.title}`)} />}
			data={list}
			keyExtractor={(item, index) => index}
			estimatedItemSize={230}
			renderItem={({ item }) => (
				<AllItem
					item={item}
					type={section.type}
					onPress={onPress}
				/>
			)}
		/>
	)
}

export default ShowAll
