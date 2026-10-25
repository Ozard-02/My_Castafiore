// Dev-only showcase for GlassSurface (Fase 1). Not for production navigation.
import React from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useTheme } from '~/contexts/theme'
import { useTokens } from '~/styles/tokens'
import { glassTokens, isLightTheme } from '~/styles/glass'
import GlassSurface from '~/components/GlassSurface'
import Header from '~/components/Header'

export default function DevGlass() {
  const theme = useTheme()
  const tokens = useTokens()
  const isLight = isLightTheme(theme.primaryBack)

  const variants = [
    { label: 'Floating (default)', radius: glassTokens.radius.floating, bordered: true, elevated: true },
    { label: 'Card', radius: glassTokens.radius.card, bordered: true, elevated: true },
    { label: 'Thumb', radius: glassTokens.radius.thumb, bordered: true, elevated: false },
    { label: 'No border', radius: glassTokens.radius.floating, bordered: false, elevated: true },
    { label: 'No shadow', radius: glassTokens.radius.floating, bordered: true, elevated: false },
  ]

  return (
    <View style={[styles.root, { backgroundColor: theme.primaryBack }]}>
      <Header title="Dev: Glass showcase" />
      <ScrollView contentContainerStyle={{ padding: tokens.spacing.lg }}>
        <Text style={[styles.section, { color: theme.primaryText }]}>Theme: {isLight ? 'light' : 'dark'}</Text>
        {variants.map((v) => (
          <View key={v.label} style={{ marginBottom: tokens.spacing.lg }}>
            <Text style={[styles.label, { color: theme.secondaryText }]}>{v.label}</Text>
            <GlassSurface
              radius={v.radius}
              bordered={v.bordered}
              elevated={v.elevated}
              isLight={isLight}
              tint={theme.primaryTouch}
              tintOpacity={glassTokens.tintOpacity.accent}
              style={{ padding: tokens.spacing.lg, marginTop: tokens.spacing.sm }}
            >
              <Text style={{ color: theme.primaryText }}>GlassSurface content</Text>
            </GlassSurface>
          </View>
        ))}

        <Text style={[styles.section, { color: theme.primaryText, marginTop: tokens.spacing.lg }]}>Tint artwork</Text>
        <GlassSurface
          radius={glassTokens.radius.card}
          isLight={isLight}
          tint="#ff8800"
          tintOpacity={glassTokens.tintOpacity.artwork}
          style={{ padding: tokens.spacing.lg, marginTop: tokens.spacing.sm }}
        >
          <Text style={{ color: theme.primaryText }}>Artwork tint overlay</Text>
        </GlassSurface>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  section: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  label: { fontSize: 12, fontWeight: '600' },
})
