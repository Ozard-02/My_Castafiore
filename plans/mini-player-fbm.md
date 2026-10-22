# Feature — Animated fBM background on the mini player ("pill")

Status: implemented 2026-10-19; release build green; user verified it on the phone during
their own session (pill animation, player open/close, track change). The GL context logs
confirmed the pill surface (1024x158). Remaining, only if #43 resumes: measure the idle CPU
delta with the pill on vs off.

## Goal (user request, 2026-10-19)

Same fBM field as the full-screen player, rendered behind the mini player (`BoxPlayer`).
Configurable. User decisions:

- setting lives in **Settings → Theme** (`screens/Settings/Theme.js`), not Settings → Player;
- **off by default** — the pill is visible on every screen, so the cost is permanent;
- **frame rate chosen by the user**: 10 / 15 / 20 / 30, default **15**;
- animation **keeps running while the music is paused**.

## Repo research

- expo-gl's Android `GLView` extends **`TextureView`**
  (`node_modules/expo-gl/android/src/main/java/expo/modules/gl/GLView.kt:18`), so it composites
  like a normal view: parent `borderRadius` + `overflow: hidden` clip correctly and translate
  animations (the pill's swipe / slide-in) are safe. (A `SurfaceView` would have broken both.)
- `PlayerBackground` already provides: cover palette, `dim`, Reduce Motion freeze, AppState
  pause, self-measuring + GLView remount (the surface-size fix, see
  `plans/fbm-player-background.md`).
- `BoxPlayer` card: `Pressable` with `backgroundColor: theme.playerBackground`, radius 10,
  border 0.5, padding/margin 10. Content sits in an `Animated.View` (translateX on track
  change); the whole card is translated by translateY during the swipe; `display: none` when
  dismissed / keyboard open — **the component stays mounted**, so the loop must be paused
  explicitly.
- Palette: `usePlayerPalette(config, songInfo, enabled)` (cached per cover) + `themedPalette`
  fallback — same as `FullScreenPlayer`.
- Settings pattern: defaults in `contexts/settings.js`; the Theme screen uses `SelectItem`
  lists + `settingStyles`; switches use `ButtonSwitch`; i18n = en + it (fallback en).

## Implementation

- `contexts/settings.js`: `miniPlayerBackground: false`, `miniPlayerFps: 15` (new keys are
  merged over defaults at load; no settingsVersion bump needed).
- `PlayerBackground.native.js`: new props `fps` (default 30), `paused` (external pause),
  `noiseScale` (`u_scale`; default 1 keeps the full-screen shader byte-identical). Frame gate
  is `1000 / fps`; AppState listener and `onContextCreate` honour `paused`.
- `BoxPlayer.js`: when `miniPlayerBackground && !reduceTransparency`:
  transparent card background + `overflow: 'hidden'`, `PlayerBackground` (dim 0.25, chosen
  fps, noiseScale 1.6) + a theme-tinted scrim (opacity 0.18, `pointerEvents="none"`), content
  above; `paused={isDismissed || isKeyboardOpen}`. Otherwise the solid theme background as
  before.
- `Theme.js`: "Mini player" section — switch + description; when on, a "Frames per second"
  list (10/15/20/30).
- i18n: `settings.theme.Mini player`, `.Animated background`,
  `.Animated background Description`, `.Frames per second` (en + it).

## Gotchas

- The pill is mounted on every tab: never leave the rAF loop running behind `display: none`
  (hence `paused`).
- Do not unmount the GLView during gestures: `TextureView` follows translate transforms; a GL
  context recreate per gesture would be expensive.
- Contrast: the palette is already luminance-clamped for white text (feature 3); the pill adds
  `dim` + a theme scrim on top. Verify ≥ 4.5:1 on bright covers.
- Battery: 10 fps is the deliberate floor; measure the idle CPU delta pill-on vs pill-off.

## Pending

- On-device visual check: user tested it directly on the phone — OK (no USB needed: the
  install had already happened before the cable dropped again).
- CPU delta pill on/off: only worth it if the idle-burn work (#43) resumes.
