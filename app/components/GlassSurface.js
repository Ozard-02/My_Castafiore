// GlassSurface — primitiva unica per le superfici "glass" del restyling Soft Glass.
// iOS/web fuori scope: niente blur reale. "Glass" = fill semitrasparente + hairline +
// tinta accent/artwork + ombra morbida. Solid su Android.
//
// Props:
//   radius     number   (default glassTokens.radius.floating)
//   bordered   bool     (hairline luminoso)
//   elevated   bool     (ombra morbida)
//   tint       color    (tinta accent/artwork, overlay)
//   tintOpacity number  (0..1, default glassTokens.tintOpacity.accent)
//   isLight    bool     (deriva fill alpha / hairline da light/dark)
//   fillColor  string   (base fill hex; default derivato da isLight)
//   fillAlpha  number   (override alpha)
//   style      ViewStyle

import React from 'react'
import { View, StyleSheet, Platform } from 'react-native'
import {
  glassTokens,
  hairlineColorFor,
  hexToRgba,
} from '~/styles/glass'

export default function GlassSurface({
  children,
  radius = glassTokens.radius.floating,
  bordered = true,
  elevated = true,
  tint = null,
  tintOpacity = glassTokens.tintOpacity.accent,
  isLight = false,
  fillColor = null,
  fillAlpha = null,
  style,
  ...rest
}) {
  const alpha = fillAlpha != null ? fillAlpha : (isLight ? glassTokens.fillAlpha.light : glassTokens.fillAlpha.dark)
  const base = fillColor || (isLight ? '#ffffff' : '#1e1e1e')
  const fill = hexToRgba(base, alpha)

  const shadow = elevated
    ? Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.18,
          shadowRadius: 12,
        },
        android: { elevation: 4 },
        default: {},
      })
    : {}

  const hairline = bordered ? hairlineColorFor(isLight ? '#ffffff' : '#121212') : 'transparent'

  return (
    <View
      style={[
        styles.base,
        { borderRadius: radius, backgroundColor: fill },
        bordered && {
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: hairline,
          // riflesso speculare sul lato superiore: simulato con borderTopColor piu' chiaro
          borderTopColor: isLight
            ? `rgba(0,0,0,${glassTokens.borderAlpha.topHighlight})`
            : `rgba(255,255,255,${glassTokens.borderAlpha.topHighlight})`,
        },
        shadow,
        style,
      ]}
      {...rest}
    >
      {tint ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            { borderRadius: radius, backgroundColor: tint, opacity: tintOpacity },
          ]}
        />
      ) : null}
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
})
