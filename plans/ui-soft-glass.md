# Plan: UI restyling "Soft Glass"

## Status
✅ Done (Fase 0-5). iOS and web out of scope. Android only. Deferred items: skeleton loaders,
Play/pause crossfade, enter/exit banner animation (LayoutAnimation only), scrim gradient
(expo-linear-gradient not installed — Scrim uses View fallback), parallax on PresHeader.

## Context
Castafiore UI is flat, monochrome dark, system font bold everywhere, inconsistent radii,
no depth (zero shadows/blur/gradients), pinned solid bars. Goal: "Soft Glass" — glass only
for floating chrome, never for content. See `UI.md` for the BitChord comparison and
`STRUCTURE.md` for component map.

## Decisions (locked)
- iOS out of scope → no expo-blur, no blur at all. "Glass" = fill semitrasparente + hairline +
  tinta + ombra.
- Web out of scope → no backdrop-filter, no .web.js stubs for this restyling.
- Android: blur always solid (no real blur). Elevation minima per ombra.
- native-stack: try `animation: 'fade_from_bottom'` on Android, fallback `fade`. No web transitions.
- Shared element mini→full: semplificata (fade+scale cover, scrim 0→0.4), no shared element.
- expo-haptics in Fase 3 (add `VIBRATE` to `app.config.js` permissions — explicit list overrides
  auto-inferred).
- expo-linear-gradient in Fase 4.
- Palette: cache key = cover id only; extract from 64-100px; LRU AsyncStorage cap ~300; separate
  enabled flag player vs detail; crossfade 300ms only async arrival; initial tint = theme accent;
  two layers + opacity (never animated backgroundColor).
- Inset hook layout-aware via `settings.isDesktop`; always safe area bottom; sum banner+miniplayer
  only when visible.
- `settings.newUI` flag at TOKEN level (not component), removed at end of Fase 5.
- Reduce Motion: system wins always; override can only disable.
- isLight derived from luminance of theme bg (no per-theme calibration).

## Files created (Fase 0)
- `app/styles/tokens.js` — typography, radius, spacing, useTokens(settings.newUI), innerRadius helper.
- `app/styles/glass.js` — fillAlpha, tintOpacity, borderAlpha, radius, relativeLuminance,
  isLightTheme, fillAlphaFor, hairlineColorFor, hairlineTopAlphaFor.
- `app/styles/motion.js` — durations, easing, springs, nativeDriver helper, paletteCrossfadeMs,
  useReduceMotion hook.

## Phases
### Fase 0 — Token ✅ done
Zero visual impact. No new deps.

### Fase 1 — Glass primitive (2-3 gg)
- Create `GlassSurface` (native only) with props intensity/tint/radius/bordered/elevated.
  Solid fill + hairline + tinta + ombra. No blur. No .web.js needed.
- Scrim helper (fallback 3-4 View; expo-linear-gradient arrives in Fase 4).
- Dev-only screen to test surfaces.
- Derive isLight from theme bg luminance.

### Fase 2 — Chrome (2-3 gg)
- `useBottomInset` hook (layout-aware, safe area, visible-only sums).
- Floating pill tab bar + glass indicator (sliding).
- Mini player: solid (no blur for fBM), hairline + ombra + tinta.
- Offline/Download banners: solid + enter/exit animation.

### Fase 3 — Motion core (2 gg)
- Global press feedback (IconButton + tiles): scale + opacity, spring snappy, haptic light (opt-in).
- Tab indicator spring bouncy.
- Banner animation translateY.
- useReduceMotion respected.
- Dep: expo-haptics (add VIBRATE to app.config.js permissions).

### Fase 4 — Detail pages (2 gg)
- PresHeader artwork-wash + parallax cover + sticky glass header (opacity 0→1, scroll 0-120).
- Track numbers on album detail.
- Skeleton loaders (CustomFlat choke point).
- Palette from artwork with fallback accent + 300ms crossfade (async only); LRU cache.
- Cover blur background via Image blurRadius (one-shot, not in blur budget).
- Dep: expo-linear-gradient.

### Fase 5 — Player motion (3-4 gg, riskiest)
- Mini→full simplified (fade+scale cover, scrim 0→0.4), no shared element.
- Drag-to-dismiss via PanResponder: measure jank with fBM active on release build.
- Track change crossfade (tinta 400-500ms two layers, cover fade+scale, title translateY 6px).
- Play/pause icon crossfade+scale.
- Sheets/popups solid (evaluate glass on iOS in polish — N/A, iOS out of scope).
- Remove `newUI` flag at end.

## Risks
- Android performance: blur off by default (solid), so low. Drag-to-dismiss jank with fBM must be
  measured on release build (2-3 GB RAM, entry SoC). Dev builds are misleading.
- Palette extraction async on detail pages for never-played albums: fallback accent + crossfade.
- native-stack `fade_from_bottom` availability (v7.3.13) — verify at implementation.
- VIBRATE permission: explicit list in app.config.js overrides auto-infer → add manually.

## Testing checklist
- Mobile/tablet/desktop layouts (isDesktop).
- Dark themes (all in themes map) — isLight derivation.
- Offline + download active states.
- Mini/full player transitions with download active and offline active.
- Reduce Motion on/off.
- Release build only for jank measurement.

## Open questions
- native-stack `fade_from_bottom` exists in 7.3.13? (verify in Fase 5)
- expo-haptics VIBRATE auto-added or manual? (verify in Fase 3)
- playerPalette refactor scope (cover id key, 64-100px, LRU) — Fase 4.
EOF
echo "created"