// Token system per il restyling "Soft Glass".
// Fase 0: solo definizioni, nessun componente le usa ancora (zero impatto visivo).
// Il flag `settings.newUI` decide a LIVELLO DI TOKEN (non di componente) se usare
// i valori nuovi o quelli legacy. Verra' rimosso a fine Fase 5.

// --- Legacy: approssima lo stato attuale (radii/typography ad-hoc) ---
export const legacyTokens = {
  typography: {
    display:  { size: 30, weight: '700', letterSpacing: 0 },
    headline: { size: 25, weight: '700', letterSpacing: 0 },
    title:    { size: 20, weight: '700', letterSpacing: 0 },
    body:     { size: 16, weight: '400', letterSpacing: 0 },
    label:    { size: 14, weight: '700', letterSpacing: 0 },
  },
  radius: { art: 4, card: 8, sheet: 20, pill: 999, thumb: 4, floating: 10 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
}

// --- New: "Soft Glass" ---
export const FONT = {
  regular: 'RobotoMono_400Regular',
  medium: 'RobotoMono_500Medium',
  semibold: 'RobotoMono_600SemiBold',
  bold: 'RobotoMono_700Bold',
}

export const newTokens = {
  typography: {
    display:  { size: 34, weight: '800', letterSpacing: -0.8, fontFamily: FONT.bold },
    headline: { size: 30, weight: '800', letterSpacing: -0.6, fontFamily: FONT.bold },
    title:    { size: 20, weight: '700', letterSpacing: -0.4, fontFamily: FONT.bold },
    body:     { size: 16, weight: '400', letterSpacing: 0, fontFamily: FONT.regular },
    label:    { size: 12, weight: '600', letterSpacing: 0.1, fontFamily: FONT.semibold },
  },
  radius: { art: 8, card: 16, sheet: 28, pill: 999, thumb: 10, floating: 28 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
}

export function useTokens() {
  // Flag newUI rimosso: il restyling e' ora l'unico look. legacyTokens resta esportato
  // per compatibilita' ma non e' piu' selezionabile.
  return newTokens
}

// Raggio interno = raggio esterno - padding (concentricita').
export function innerRadius(outer, padding) {
  return Math.max(0, outer - padding)
}
