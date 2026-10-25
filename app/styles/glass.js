// Token per le superfici "glass" del restyling "Soft Glass".
// iOS fuori scope: niente blur reale. Il "vetro" e' solo estetica di superficie:
// fill semitrasparente + hairline luminoso + tinta accent/artwork + ombra morbida.
// Fase 0: solo definizioni.

export const glassTokens = {
  fillAlpha: { dark: 0.72, light: 0.78 },
  tintOpacity: { accent: 0.06, artwork: 0.08 },
  borderAlpha: { dark: 0.12, light: 0.06, topHighlight: 0.20 },
  radius: { floating: 28, card: 16, thumb: 10 },
};

// Luminanza relativa WCAG (0..1) da hex. Usata per derivare isLight dal background
// del tema, cosi' i temi futuri funzionano senza ritocchi.
export function relativeLuminance(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  if (!m) return 0;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => {
    const c = parseInt(h, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function isLightTheme(bgHex) {
  return relativeLuminance(bgHex) > 0.4;
}

export function fillAlphaFor(bgHex) {
  return isLightTheme(bgHex) ? glassTokens.fillAlpha.light : glassTokens.fillAlpha.dark;
}

export function hairlineColorFor(bgHex) {
  const a = isLightTheme(bgHex) ? glassTokens.borderAlpha.light : glassTokens.borderAlpha.dark;
  return isLightTheme(bgHex) ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`;
}

// Lato superiore del hairline leggermente piu' chiaro (riflesso speculare).
// Per ora usato come alpha target; l'implementazione gradient del bordo e' rimandata.
export function hairlineTopAlphaFor(bgHex) {
  return glassTokens.borderAlpha.topHighlight;
}
