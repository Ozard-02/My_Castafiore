// Scrim — fallback per gradienti (expo-linear-gradient arriva in Fase 4).
// Simula un gradiente verticale con 3-4 View sovrapposte a opacita' decrescente.
// Props: colors (array di stringhe, dall'alto verso il basso), height (number, opzionale),
//        direction ('down'|'up'), style.

import React from 'react'
import { View, StyleSheet } from 'react-native'

export default function Scrim({ colors = ['rgba(0,0,0,0.6)', 'rgba(0,0,0,0)'], direction = 'down', style, height }) {
  const ordered = direction === 'up' ? [...colors].reverse() : colors
  const step = 1 / (ordered.length - 1 || 1)
  return (
    <View style={[styles.container, height ? { height } : null, style]} pointerEvents="none">
      {ordered.map((c, i) => (
        <View
          key={i}
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: c,
              // ogni layer copre una fetta; opacita' gestita dal colore stesso
              top: `${i * step * 100}%`,
              height: `${step * 100}%`,
            },
          ]}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
})
