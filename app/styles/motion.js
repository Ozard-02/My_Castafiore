// Token e regole di motion per il restyling "Soft Glass".
// Fase 0: solo definizioni + hook. Nessun componente li usa ancora.

import { Platform, AccessibilityInfo } from 'react-native';
import { useEffect, useState } from 'react';
import { useSettings } from '../contexts/settings';

export const durations = { instant: 100, fast: 160, base: 240, slow: 360, emphasized: 500 };
export const easing = {
  standard: [0.2, 0, 0, 1],
  enter: [0, 0, 0, 1],
  exit: [0.3, 0, 1, 1],
};
export const springs = {
  snappy: { stiffness: 320, damping: 28 },
  smooth: { stiffness: 220, damping: 26 },
  bouncy: { stiffness: 260, damping: 18 },
};

// Su web useNativeDriver non e' supportato e genera warning.
export const nativeDriver = Platform.OS !== 'web';

// Crossfade palette (detail/player): 300ms su arrivo asincrono, 0ms se in cache.
export const paletteCrossfadeMs = 300;

// Reduce Motion: il sistema vince sempre; l'override puo' solo spegnere, mai accendere.
export function useReduceMotion() {
  const { settings } = useSettings();
  const [systemReduce, setSystemReduce] = useState(false);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const v = await AccessibilityInfo.isReduceMotionEnabled();
        if (mounted) setSystemReduce(!!v);
      } catch (e) { /* unsupported -> false */ }
    };
    check();
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v) => {
      if (mounted) setSystemReduce(!!v);
    });
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      setSystemReduce(mq.matches);
      const handler = (e) => setSystemReduce(e.matches);
      mq.addEventListener?.('change', handler);
    }
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  return systemReduce || !!settings?.reduceMotionOverride;
}
