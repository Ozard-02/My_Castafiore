import React from 'react'
import { Pressable, StyleSheet, Animated } from 'react-native'
import Icon from 'react-native-vector-icons/FontAwesome'

import { useTheme } from '~/contexts/theme'
import { useSettings } from '~/contexts/settings'

import { nativeDriver, springs } from '~/styles/motion'
import { hapticLight } from '~/utils/haptics'

const IconButton = ({ icon, size = 23, color = undefined, style = {}, styleIcon = {}, pressEffect = true, onPress, onLongPress = null, delayLongPress = 200 }) => {
  const theme = useTheme()
  const { settings } = useSettings()
  const scale = React.useRef(new Animated.Value(1)).current
  const opacity = React.useRef(new Animated.Value(1)).current

  const animateIn = () => {
    if (!pressEffect) return
    Animated.parallel([
      Animated.spring(scale, { toValue: 0.96, stiffness: springs.snappy.stiffness, damping: springs.snappy.damping, useNativeDriver: nativeDriver }),
      Animated.timing(opacity, { toValue: 0.85, duration: 100, useNativeDriver: nativeDriver }),
    ]).start()
  }
  const animateOut = () => {
    if (!pressEffect) return
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, stiffness: springs.snappy.stiffness, damping: springs.snappy.damping, useNativeDriver: nativeDriver }),
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: nativeDriver }),
    ]).start()
  }

  const handlePress = (e) => {
    hapticLight(settings?.hapticsEnabled)
    if (onPress) onPress(e)
  }

  return (
    <Pressable
      style={() => ([{ justifyContent: 'center' }, StyleSheet.flatten(style)])}
      onPressIn={animateIn}
      onPressOut={animateOut}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      onPress={handlePress}
      onContextMenu={(ev) => {
        ev.stopPropagation()
        ev.preventDefault()
        if (onLongPress) onLongPress()
      }}
    >
      <Animated.View style={{ transform: [{ scale }], opacity }}>
        <Icon name={icon} size={size} color={color ? color : theme.primaryTouch} style={styleIcon} />
      </Animated.View>
    </Pressable>
  )
}

export default IconButton