# Feature 3 — Animated fBM background + translucent pill UI (player)

Status: implemented 2026-10-18; first release build crashed at load (stray backticks in
the shader template, fixed); on-device verification in progress.

## Goal (user spec, 2026-10-18)

Full-bleed animated fractal-Brownian-motion background for the full-screen player,
colored from the current album cover. No gloss/bloom. UI grouped into flat translucent
containers: one **pill** (title/artist/progress/transport) and one **large-radius rounded
rect** (cover/lyrics). Queue view: no containers, content at reduced opacity over the
background. Legibility via adaptive alpha/global dim; honor Reduce Motion; cap FPS.

Acceptance criteria are listed in the user spec — see §6 there. Key ones:
two rectangles on the player, none in the queue; radii per rule; contrast ≥ 4.5:1;
60 FPS mid-range; pause when backgrounded; reduce-motion/transparency honored.

## Repo research (2026-10-18)

- **Stack**: Expo SDK 53, RN 0.79.6, React 19, **old architecture** (`newArchEnabled:
  false` for track-player), bare workflow (android/ dir, local gradle release builds).
- **No rendering/pixel deps today**: no expo-gl, no Skia, no reanimated, no
  image-manipulator, no image colors. `expo-blur` is in package.json but unused in app
  code (only RN `blurRadius` props exist).
- **Mobile player** `app/components/player/FullScreenPlayer.js` (462 lines): Modal;
  flat `theme.primaryBack`; swipe-up queue overlay (`queueY` translate) covering the
  whole window with solid bg; PanResponders on the window (queue open) and sheet
  (close); lyric/cover toggle; top icon row (close, options, picture-o).
  Constraints: touch handling on Android old-arch vanilla views is delicate (see
  comments there — `neverTake` hooks, capture pan responders). A full-bleed GLView must
  not swallow touches: `pointerEvents="none"` and keep it BELOW the pan handlers.
- **Queue** `QueueSheet.js`: Now playing + Up next + Queue lists of `SongItem` rows
  (50px covers), DnD via `useQueueDnD`; wrapped in the overlay with solid bg.
- **Desktop/web player** `FullScreenHorizontalPlayer.js`: already a blurred cover
  (`blurRadius={5}`) + `rgba(0,0,0,0.6)` scrim; separate layout with inline queue.
- **Themes**: `contexts/theme.js` flat 2-tone + `themesPlayer` manual accents
  (blue/red/green/...). No artwork-derived colors anywhere yet.
- **UI.md** (§ "How to improve", item 11) already names this direction as the big win:
  derive the player accent from the art instead of presets.
- **Settings** pattern exists (`screens/Settings/Player.js`: `ButtonSwitch`, `SelectItem`,
  description texts); i18n = en + it (+ en fallback).
- Palette/pixel access: none today; cover URLs come from `urlCover()` (`utils/url.js`),
  local cover files exist offline (`cache/covers/<id>.jpg`, feature 2 follow-up).

## Proposed approach (pending answers to Q1–Q4)

### Components
- `app/components/player/PlayerBackground.js` — absolute-fill, `pointerEvents="none"`.
  Native/web shader behind everything inside the player Modal.
- `app/utils/playerPalette.js` — extract 3–6 colors from the cover (async, cached per
  album/song in memory + AsyncStorage), sorted by luminance; fallback palette (theme
  accent + neutrals) when extraction fails. Cover source: local file offline first,
  else `urlCover(config, song, 100)` (small).
- Layout work in `FullScreenPlayer.js`: keep gestures; wrap clusters in the two
  translucent containers per spec §3.2; bare top icon row.
- Queue restyle: overlay bg → transparent/scrim; rows wrapped at ~0.88 opacity +
  subtle text shadow; keep DnD + scroll intact.

### Shader (spec §5.1)
- GLSL fBM: 4–5 octaves, lacunarity 2.0, gain 0.5, base freq ~2.0, `z = time*speed`.
- Palette uniforms (`vec3 palette[6]`, size) + `u_resolution`, `u_dim`, `u_dimAlpha`.
- Flat output only (no specular/bloom). Optional global dim (black 0.15–0.35).
- Fullscreen quad via `gl_FragCoord`; start full-res, drop to half-res FBO → blit if
  frame time on the tablet says so.

### Behavior / perf
- 30 FPS cap by default (slow fBM doesn't read 60; battery-friendly), rAF loop,
  paused when modal hidden / app backgrounded (AppState), frozen under
  `AccessibilityInfo.isReduceMotionEnabled()`.
- No bass reactivity in v1 (spec: optional). No backdrop blur (spec: disabled by
  default) — flat alpha fills only.
- Tuning constants collected in one module (`app/styles/playerBackground.js`?) for the
  spec's "open parameters".

### Settings / i18n
- Honor Reduce Motion automatically (no toggle needed).
- "Reduce transparency" toggle (opaque surfaces) + possibly "Animated background"
  on/off, in Settings → Player; en+it strings.

### Risks
- GLView (SurfaceView) z-order/overlays inside a Modal on Android old arch — test early.
- Web: shader context + palette CORS (`canvas` taint) — fallback paths.
- Queue legibility over bright covers — scrim alpha budget.
- Battery: full-screen animated shader; keep FPS cap + pause paths honest.

## Decisions (user, 2026-10-18)

1. Rendering: **`expo-gl` + GLSL fragment shader** (spec §5.1).
2. Palette: **`react-native-image-colors`** (AndroidX Palette on Android, node-vibrant on
   web) + theme-derived fallback palette.
3. Scope now: **Android mobile player (`FullScreenPlayer`) + its queue sheet**. Desktop
   (`FullScreenHorizontalPlayer`) and web keep today's look; web gets no GLView at all
   (platform-split component returns null).
4. Default: **on by default**; add Settings → Player toggles: "Animated background",
   "Reduce transparency"; system *Reduce Motion* honored automatically.

Legibility strategy (decided): instead of per-frame contrast math, palette colors are
luminance-clamped for background duty (max rel. luminance ≈ 0.24), containers are flat
`rgba(0,0,0,0.35)`, shader applies a 0.15 black dim → white text stays ≥ 4.5:1 under
the worst-case band. Reduce-transparency ON ⇒ containers become opaque `primaryBack`.

## Open questions (resolved)

~~1. Rendering dep~~ → expo-gl. ~~2. Palette dep~~ → image-colors. ~~3. Scope~~ →
Android mobile only. ~~4. Default~~ → on + settings.


## Progress (2026-10-18)

1. [x] Deps added: `expo-gl@~15.1.7`, `react-native-image-colors@^2.6.0` (installed with
   npm — package-lock.json is the maintained lockfile; pnpm-lock is stale Docker-era).
2. [x] `utils/playerPalette.js` — extraction, AsyncStorage cache (`playerPalette:<id>`),
   `themedPalette` fallback, luminance clamping; pure helpers smoke-tested in node
   (clamp ≤ 0.30, near-black lift, hex parsing incl. AndroidX `#aarrggbb`).
3. [x] Shader + `PlayerBackground.native.js` / `.web.js` stub; 30 fps cap, 450 ms palette
   crossfade, Reduce Motion freeze, AppState pause. Tuning constants at the top.
4. [x] Player layout: cover/lyrics pane + control pill (spec §3.2); gestures untouched.
5. [x] Queue restyle (spec §3.3): 0.35 scrim over the same background, rows at 0.9
   opacity, `SongItem overlay` text shadows.
6. [x] Settings → Player "Appearance" (Animated background, Reduce transparency) + en/it.
7. [x] On-device pass (phone R5CY71GYKWF, release APK + Oreo Buildx build 2026-10-18):
   GLView-in-Modal renders correctly (z-order fine, no TextureView flicker), palette from the
   local cover matches the art, animation drifts smoothly (verified by frame-diff), queue +
   controls all correct. Half-res FBO fallback not needed. User verdict: "tutto perfetto".
   Tuning kept as-is (30 fps cap, Z_SPEED etc. unchanged).
8. [x] eslint clean; release build + install; first launch crashed →
   root cause: backticks inside the FRAGMENT_SHADER template literal (JS then parsed the
   remainder as a *tagged template* call on the number 0.5). Fixed, shader source
   re-verified by evaluating the transformed template of the real bundle.
9. [x] After the rebuild: two *more* release-only crashes surfaced and were fixed with
   ProGuard keep rules (see gotchas 2 and 3) — the constructor one at first render, the
   `flush` one on the first frame. Then installed, launched, logcat clean, player verified.
10. [x] Post-verdict feedback changes (2026-10-18): control pill corners were "too round" →
    radius 999 → 24 (same as the cover pane, `PANE_RADIUS`); queue must show only the fBM
    background → the top bar + player content fade out as the queue sheet rises
    (`playerOpacity`, a `queueY` interpolation). Both re-verified on device.
11. [x] Follow-ups (2026-10-18): R8 keep rules made prebuild-proof (`plugins/proguardRules.js`
    + `app.config.js`); "gold artifact" (frozen top strip) diagnosed as expo-gl's single-shot
    surface sizing → self-measuring remount logic in `PlayerBackground.native.js`. Verified on
    device: 3/3 mounts `context 1080x2520 (view 1080x2520)`, top strip animates in frame-diff
    (was 0.0), player screenshot clean. The GLView now mounts only after the first `onLayout`,
    so the surface is created at the settled size (remount is the fallback).

## Release-only gotcha (2026-10-18)

The shader comment ``plain `* 0.5 + 0.5` leaves the tails...`` sat *inside* the
FRAGMENT_SHADER template literal. A backtick closes a template literal, so the text after
it was parsed as JavaScript: `` ` ... ` * 0.5 + 0.5 `` + the closing backtick of the
comment started a **tagged template**, i.e. a call with the number `0.5` as the tag
function → `TypeError: 0.5 is not a function` at module init, before
`AppRegistry.registerComponent`, so the app died on launch. Debug builds/bundlers that
happen to swallow it are not a signal: it fails deterministically in the release bundle.

Two rules for the shader strings: no backticks and no `${`-looking text inside the
template, and verify the *transformed* string (see the recipe in `.log`) rather than the
source file. `glslFloat()` stayed as cheap insurance against a different hazard
(minifier-emitted `.5.toFixed(1)`, which Hermes mis-lexes), not as this fix.

## Release-only gotcha 2: R8 strips expo-gl's GLView (2026-10-18)

After the template fix the app boots, but crash-loops the moment the GLView is actually
rendered: `Didn't find a correct constructor for class I6.d` from expo's reflective view
factory. `I6.d` = `expo.modules.gl.GLView` (R8 mapping file). expo-gl's view extends
`TextureView` directly and ships no ProGuard consumer rules, so expo-modules-core's
"keep ExpoView constructors" rule does not cover it and R8 strips the
`(Context, AppContext)` constructor. Fix: a single keep rule in
`android/app/proguard-rules.pro` (with a comment). Rule of thumb: any new expo module
whose native view is rendered in a minified release build needs a constructor keep rule
unless it extends `ExpoView`.

## Release-only gotcha 3: R8 renames GLContext.flush, JNI aborts (2026-10-18)

With the view kept, the first GL frame aborted natively (`mid == null` in
`EXGLContextPrepare`) because expo-gl's C++ resolves `GLContext.flush` by **name**
(`EXGLJniApi.cpp:29`, `GetMethodID(..., "flush", "()V")`). Fix: `-keepclassmembers` for
`flush` (see gotcha 2's file). Since `android/` is gitignored, both rules are re-applied
after prebuild by `plugins/proguardRules.js` (wired in `app.config.js`).

## Gold artifact → star. top strip: expo-gl surface sizing (2026-10-18)

Frame-diff showed the top strip frozen (0.0 over 1.4 s) — the GL surface was created at
the wrong size at mount (`1313x2028` vs a `1080x2520` view) and expo-gl ignores later
resizes, so that strip was never repainted. `PlayerBackground.native.js` now self-heals:
`onLayout` measures the view, the loop compares `gl.drawingBuffer*` with the measured px
size and remounts the `GLView` (≤5 times, ≥500 ms apart, logged). Verified on device: the
GLView now mounts after the first `onLayout`, so the surface is created at the settled size
(3/3 mounts correct, top strip animates — see item 11).

## What shipped (summary)

- New: `app/components/player/PlayerBackground.{native,web}.js`, `app/utils/playerPalette.js`,
  `plugins/proguardRules.js`.
- Changed: `FullScreenPlayer.js` (two containers, background mount, scrim queue overlay,
  queue fade of the player content), `QueueSheet.js`, `SongItem.js` (`overlay` prop),
  `contexts/settings.js` defaults, `screens/Settings/Player.js`, `utils/url.js`
  (`coverIdOf` export), `PlayerBackground.native.js` (self-healing surface sizing),
  `app.config.js` (proguard plugin), i18n en/it.
- Deferred: desktop player (`FullScreenHorizontalPlayer`) + web background (decision 3),
  bass reactivity (optional in the spec), per-frame contrast math (replaced by the static
  luminance clamp).
