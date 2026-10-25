import React from 'react'

import CustomFlat from '~/components/lists/CustomFlat'
import MoodMixItem from '~/components/item/MoodMixItem'
import size from '~/styles/size'

const HorizontalMoodMixes = ({ mixes }) => {
	const renderItem = React.useCallback(({ item }) => <MoodMixItem mix={item} />, [])

	return (
		<CustomFlat
			data={mixes}
			renderItem={renderItem}
			widthItem={size.image.large + 10}
		/>
	)
}

export default HorizontalMoodMixes
