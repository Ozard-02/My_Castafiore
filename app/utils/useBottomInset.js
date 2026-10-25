// useBottomInset — altezza totale occupata dal chrome flottante in basso
// (tab bar + mini player + banner download/offline) + safe area.
// Usato come paddingBottom dei container scrollabili, cosi' l'ultimo elemento
// non resta nascosto sotto le barre flottanti.
//
// Layout-aware via settings.isDesktop (unica fonte di verita'): su desktop il
// mini player e' nella sidebar e i banner sono mobile-only, quindi il bottom
// inset e' solo la safe area.
//
// Le altezze sono stime delle pill flottanti (Fase 2). Tararle su device se
// l'ultimo elemento resta coperto o c'e' troppo spazio.

import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSettings } from '~/contexts/settings'
import { useSong } from '~/contexts/song'

// Altezze stimate delle pill flottanti (px).
export const INSET = {
  tabBar: 62,
  miniPlayer: 64,
  banner: 36,
  gap: 8,
}

export function useBottomInset(visible = {}) {
  const insets = useSafeAreaInsets()
  const { settings } = useSettings()
  const song = useSong()

  const isDesktop = !!settings?.isDesktop

  if (isDesktop) {
    return insets.bottom
  }

  let h = insets.bottom + INSET.gap
  // tab bar sempre presente (se c'e' config; assumiamo sempre visibile in app connessa)
  h += INSET.tabBar + INSET.gap
  // mini player: visibile se c'e' una canzone caricata
  const miniVisible = visible.miniPlayer !== false && !!song?.songInfo?.id
  if (miniVisible) h += INSET.miniPlayer + INSET.gap
  // banner download/offline: solo se visibili (passati dal chiamante)
  if (visible.banner) h += INSET.banner + INSET.gap

  return h
}
