import React from 'react'
import { View, Image } from 'react-native'
import Icon from 'react-native-vector-icons/FontAwesome'

import size from '~/styles/size'
import { useTheme } from '~/contexts/theme'

const ImageError = ({ source, style = {}, children = null, iconError = null, blurRadius = undefined }) => {
	const [isImage, setIsImage] = React.useState(false)
	const [lastSource, setLastSource] = React.useState({ uri: null })
	const theme = useTheme()

	React.useEffect(() => {
		// normalise first: storing a nullish `source` left lastSource undefined and the next
		// run threw on `lastSource.uri`
		const uri = source?.uri ?? null
		if (lastSource.uri === uri) return
		setLastSource({ uri })
		setIsImage(!!uri)
	}, [source, source?.uri])

	if (isImage) return <Image source={lastSource} onError={() => setIsImage(false)} style={style} blurRadius={blurRadius} />
	if (children) return children
	if (iconError) return (
		<View style={[{ justifyContent: 'center', alignItems: 'center' }, style]}>
			<Icon name={iconError} size={size.icon.large} color={theme.primaryText} />
		</View>
	)
	return (
		<Image
			source={require('~/../assets/foreground-icon.png')}
			style={style}
		/>
	)
}

export default ImageError