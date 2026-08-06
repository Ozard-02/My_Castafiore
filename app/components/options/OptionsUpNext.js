import React from 'react'
import { useTranslation } from 'react-i18next'

import { useSongDispatch } from '~/contexts/song'
import { moveUpNext, removeFromUpNext } from '~/utils/player'
import OptionsPopup from '~/components/popup/OptionsPopup'

const OptionsUpNext = ({ upNext, indexOptions, setIndexOptions }) => {
	const { t } = useTranslation()
	const songDispatch = useSongDispatch()
	const refOption = React.useRef()
	const length = upNext?.length || 0

	return (
		<OptionsPopup
			ref={refOption}
			visible={indexOptions >= 0}
			close={() => setIndexOptions(-1)}
			item={indexOptions >= 0 ? upNext[indexOptions] : null}
			options={[
				{
					name: t('Move to top'),
					icon: 'angle-double-up',
					onPress: () => {
						moveUpNext(songDispatch, indexOptions, 0)
						refOption.current.close()
					},
					hidden: indexOptions === 0
				},
				{
					name: t('Move up'),
					icon: 'angle-up',
					onPress: () => {
						moveUpNext(songDispatch, indexOptions, indexOptions - 1)
						refOption.current.close()
					},
					hidden: indexOptions === 0
				},
				{
					name: t('Move down'),
					icon: 'angle-down',
					onPress: () => {
						moveUpNext(songDispatch, indexOptions, indexOptions + 1)
						refOption.current.close()
					},
					hidden: indexOptions === length - 1
				},
				{
					name: t('Move to bottom'),
					icon: 'angle-double-down',
					onPress: () => {
						moveUpNext(songDispatch, indexOptions, length - 1)
						refOption.current.close()
					},
					hidden: indexOptions === length - 1
				},
				{
					name: t('Remove from up next'),
					icon: 'trash',
					onPress: () => {
						removeFromUpNext(songDispatch, indexOptions)
						refOption.current.close()
					}
				}
			]} />
	)
}

export default OptionsUpNext
