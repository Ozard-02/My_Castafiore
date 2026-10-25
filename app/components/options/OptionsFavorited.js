import React from 'react'
import { useTranslation } from 'react-i18next'

import { useConfig } from '~/contexts/config'
import { useOffline } from '~/utils/offline'
import { useDownloads, enqueueCollection, syncCollection, getCollectionState } from '~/utils/downloadManager'
import OptionsPopup from '~/components/popup/OptionsPopup'

const OptionsFavorited = ({ favorited, isOpen, onClose }) => {
	const { t } = useTranslation()
	const config = useConfig()
	const offline = useOffline()
	useDownloads()
	const refOption = React.useRef()

	if (!favorited) return null
	const source = { type: 'favorited', id: config.url }
	const { changed } = getCollectionState(source, favorited.map((song) => song.id).filter(Boolean))
	const canSync = changed && !offline
	const syncOption = canSync ? [{
		name: t('Sync download'),
		icon: 'refresh',
		onPress: async () => {
			refOption.current.close()
			await syncCollection({
				type: 'favorited',
				id: config.url,
				name: t('Favorites'),
				songs: favorited,
			})
		},
	}] : []

	return (
		<OptionsPopup
			ref={refOption}
			visible={isOpen}
			close={() => {
				onClose()
				refOption.current.clearVirtualOptions()
			}}
			options={[
				...syncOption,
				{
					name: t('Download'),
					icon: 'cloud-download',
					onPress: async () => {
						refOption.current.close()
						enqueueCollection({
							type: 'favorited',
							id: config.url,
							name: t('Favorites'),
							cover: null,
							songs: favorited || [],
						})
					}
				},
				{
					name: t('Info'),
					icon: 'info',
					onPress: () => {
						refOption.current.showInfo(favorited)
						refOption.current.close()
					}
				},
			]}
		/>
	)
}

export default OptionsFavorited