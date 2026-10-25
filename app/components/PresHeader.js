import React from 'react'
import { Text, View, Pressable, Image, StyleSheet } from 'react-native'
import { useTheme } from '~/contexts/theme'
import { useSafeAreaInsets } from 'react-native-safe-area-context'


import BackButton from '~/components/button/BackButton'
import mainStyles from '~/styles/main'
import presStyles from '~/styles/pres'
import ImageError from '~/components/ImageError'
import IconButton from '~/components/button/IconButton'
import Scrim from '~/components/Scrim'

const PresHeader = ({ title, subTitle, imgSrc, onPressTitle = null, onPressOption = null, children = null }) => {
	const theme = useTheme()
	const insets = useSafeAreaInsets()

	return (
		<>
			<BackButton />
			{
				onPressOption ?
					<IconButton
						icon="ellipsis-h"
						onPress={onPressOption}
						color={'white'}
						style={{
							position: 'absolute',
							padding: 20,
							top: insets.top,
							right: insets.left,
							zIndex: 1
						}}
					/> : null
			}
			{/* artwork-wash: blurred cover behind, fading into the page bg */}
			<View style={styles.bgWrap} pointerEvents="none">
				<Image
					source={{ uri: imgSrc }}
					style={styles.bgImage}
					blurRadius={18}
					resizeMode="cover"
				/>
				<Scrim colors={['rgba(0,0,0,0)', theme.primaryBack]} direction="down" style={styles.scrim} />
			</View>
			<ImageError
				style={[presStyles.cover, { backgroundColor: theme.secondaryBack }]}
				source={{ uri: imgSrc }}
			/>
			<View style={presStyles.headerContainer}>
				<View style={{ flex: 1 }}>
					<Text style={presStyles.title(theme)} numberOfLines={2}>{title}</Text>
					<Pressable
						style={mainStyles.opacity}
						onPress={onPressTitle}
						disabled={!onPressTitle}
					>
						<Text style={presStyles.subTitle(theme)}>{subTitle}</Text>
					</Pressable>
				</View>
				{children}
			</View>
		</>
	)
}

const styles = StyleSheet.create({
	bgWrap: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		height: 300,
		overflow: 'hidden',
		zIndex: 0,
	},
	bgImage: {
		width: '100%',
		height: '100%',
		opacity: 0.35,
	},
	scrim: {
		...StyleSheet.absoluteFillObject,
	},
})

export default PresHeader