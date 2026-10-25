import React from 'react'
import { Text, View, Pressable, useWindowDimensions, Animated } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import Icon from 'react-native-vector-icons/FontAwesome'

import { useConfig } from '~/contexts/config'
import { useTheme } from '~/contexts/theme'
import { useTabItem } from '~/utils/useTabItem'
import useKeyboardIsOpen from '~/utils/useKeyboardIsOpen'
import mainStyles from '~/styles/main'
import size from '~/styles/size'
import { glassTokens, isLightTheme } from '~/styles/glass'
import GlassSurface from '~/components/GlassSurface'
import { nativeDriver, springs } from '~/styles/motion'

const TabItem = ({ route, index, state, descriptors, navigation, compact, isActive }) => {
  const { t } = useTranslation()
  const { options, color, onPress, onLongPress, disabled } = useTabItem(route, index, state, descriptors, navigation)
  const scale = React.useRef(new Animated.Value(isActive ? 1.1 : 1)).current

  React.useEffect(() => {
    Animated.spring(scale, {
      toValue: isActive ? 1.1 : 1,
      stiffness: springs.snappy.stiffness,
      damping: springs.snappy.damping,
      useNativeDriver: nativeDriver,
    }).start()
  }, [isActive])

  return (
    <Pressable
      key={index}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      style={({ pressed }) => ([mainStyles.opacity({ pressed }), {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: compact ? 6 : 8,
      }])}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Icon name={options.icon} size={compact ? 17 : size.icon.tiny} color={color} style={{ marginBottom: 2 }} />
      </Animated.View>
      <Text numberOfLines={1} style={{ color, textAlign: 'center', fontSize: compact ? 11 : 14, marginTop: 2 }}>
        {t(`tabs.${options.title}`)}
      </Text>
    </Pressable>
  )
}

const BottomBar = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets()
  const config = useConfig()
  const theme = useTheme()
  const keyboardIsOpen = useKeyboardIsOpen()
  const { width } = useWindowDimensions()
  const compact = width < 380
  const isLight = isLightTheme(theme.primaryBack)

  const barWidth = Math.min(width - 24, 520)
  const numTabs = state.routes.length || 1
  const tabW = barWidth / numTabs

  const indicatorX = React.useRef(new Animated.Value(state.index * tabW)).current
  React.useEffect(() => {
    Animated.spring(indicatorX, {
      toValue: state.index * tabW,
      stiffness: springs.bouncy.stiffness,
      damping: springs.bouncy.damping,
      useNativeDriver: nativeDriver,
    }).start()
  }, [state.index, tabW])

  if (!config.url) return null
  if (keyboardIsOpen) return null

  return (
    <View
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: insets.bottom > 0 ? insets.bottom : 10,
        alignItems: 'center',
      }}
      pointerEvents="box-none"
    >
      <GlassSurface
        radius={glassTokens.radius.floating}
        isLight={isLight}
        fillColor={theme.secondaryBack}
        fillAlpha={isLight ? 0.85 : 0.78}
        bordered
        elevated
        style={{ width: barWidth, overflow: 'hidden' }}
      >
        {/* indicatore pillola di vetro sotto la tab attiva */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 6,
            bottom: 6,
            width: tabW - 8,
            borderRadius: glassTokens.radius.pill,
            backgroundColor: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)',
            transform: [{ translateX: Animated.add(indicatorX, new Animated.Value(4)) }],
          }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
          {state.routes.map((route, index) => (
            <TabItem
              key={route.key}
              route={route}
              index={index}
              state={state}
              descriptors={descriptors}
              navigation={navigation}
              compact={compact}
              tabWidth={tabW}
              isActive={index === state.index}
            />
          ))}
        </View>
      </GlassSurface>
    </View>
  )
}

export default BottomBar
