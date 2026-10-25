import React from 'react'
import { useTranslation } from 'react-i18next'

import { useConfig } from '~/contexts/config'
import { refreshApi } from '~/utils/api'
import { useOffline } from '~/utils/offline'
import { useDownloads, enqueueCollection, syncCollection } from '~/utils/downloadManager'
import OptionsPopup from '~/components/popup/OptionsPopup'

const OptionsFavorited = ({ favorited, isOpen, onClose }) => {
	const { t } = useTranslation()
	const config = useConfig()
	const offline = useOffline()
	const downloads = useDownloads()
	const refOption = React.useRef()

	if (!favorited) return null
	// A fresh getStarred2 is fetched before syncing: the screen's list is cache-first, and
	// syncing from a stale cache would delete songs that are still favourited.
	const hasCollection = !!downloads.collections?.[`favorited:${config.url}`]
	const syncOption = (hasCollection && !offline) ? [{
		name: t('Sync download'),
		icon: 'refresh',
		onPress: async () => {
			refOption.current.close()
			const json = await refreshApi(config, 'getStarred2').catch(() => null)
			const songs = json?.starred2?.song
			if (!songs) return
			await syncCollection({
				type: 'favorited',
				id: config.url,
				name: t('Favorites'),
				songs,
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