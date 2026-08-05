import React from 'react'
import { useTranslation } from 'react-i18next'

import { useConfig } from '~/contexts/config'
import { enqueueCollection } from '~/utils/downloadManager'
import OptionsPopup from '~/components/popup/OptionsPopup'

const OptionsFavorited = ({ favorited, isOpen, onClose }) => {
	const { t } = useTranslation()
	const config = useConfig()
	const refOption = React.useRef()

	if (!favorited) return null
	return (
		<OptionsPopup
			ref={refOption}
			visible={isOpen}
			close={() => {
				onClose()
				refOption.current.clearVirtualOptions()
			}}
			options={[
				{
					name: t('Download'),
					icon: 'cloud-download',
					onPress: async () => {
						refOption.current.close()
						enqueueCollection({
							type: 'favorited',
							id: config.favorite,
							name: t('Favorites'),
							cover: null,
							songs: favorited || [],
						})
					}
				},
			]}
		/>
	)
}

export default OptionsFavorited