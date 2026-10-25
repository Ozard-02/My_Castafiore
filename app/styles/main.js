import { StyleSheet } from "react-native"
import size from "~/styles/size"
import { FONT } from "~/styles/tokens"

export default StyleSheet.create({
	mainContainer: (theme) => ({
		flex: 1,
		backgroundColor: theme.primaryBack,
	}),
	contentMainContainer: (insets, statusBar = true) => ({
		paddingTop: statusBar ? insets.top : 0,
		paddingBottom: 170,
		paddingStart: insets.left,
		paddingEnd: insets.right,
	}),
	mainTitle: theme => ({
		color: theme.primaryText,
		fontSize: size.title.medium,
		fontWeight: 'bold',
		fontFamily: FONT.bold,
		margin: 20,
		marginTop: 30
	}),
	subTitle: theme => ({
		color: theme.primaryText,
		fontSize: size.title.small,
		fontWeight: 'bold',
		fontFamily: FONT.bold,
	}),
	titleSection: theme => ({
		color: theme.primaryText,
		fontSize: size.title.small,
		fontWeight: 'bold',
		fontFamily: FONT.bold,
		marginHorizontal: 20,
		marginTop: 25,
		marginBottom: 12
	}),
	stdVerticalMargin: {
		marginHorizontal: 20,
	},
	button: {
		flex: 1,
		height: 50,
		alignItems: "center",
		justifyContent: "center",
	},
	coverSmall: theme => ({
		height: size.image.small,
		width: size.image.small,
		borderRadius: size.radius.standard,
		backgroundColor: theme.secondaryBack,
	}),
	icon: {
		width: size.image.small,
		height: size.image.small,
		borderRadius: 10,
		marginEnd: 10
	},
	opacity: ({ pressed, enable = true }) => ({
		opacity: (pressed && enable) ? 0.5 : 1,
	}),
	smallText: color => ({
		color: color,
		fontSize: size.text.small,
		fontFamily: FONT.regular,
		textAlign: 'left',
	}),
	mediumText: color => ({
		color: color,
		fontSize: size.text.medium,
		fontFamily: FONT.regular,
		textAlign: 'left',
	}),
	largeText: color => ({
		color: color,
		fontSize: size.text.large,
		fontFamily: FONT.regular,
		textAlign: 'left',
	}),
	hairline: {
		borderWidth: 0.5,
		borderColor: 'rgba(255,255,255,0.10)',
	},
	hairlineLight: {
		borderWidth: 0.5,
		borderColor: 'rgba(0,0,0,0.15)',
	},
})
