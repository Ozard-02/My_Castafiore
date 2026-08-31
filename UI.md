# UI/UX — Castafiore vs BitChord (style comparison)

Style-only comparison between **Castafiore** (this repo, React Native / Expo Subsonic
client) and **BitChord** (github.com/kushagrasinghx/BitChord, native Android, an Apple
Music-inspired YouTube Music client). None of this is about features — it is about
how each app *looks and feels*.

> Path legend:
> - `CF:` = this repo — `app/...` is relative to the repo root.
> - `BC:` = BitChord — paths abbreviated from `app/src/main/java/com/music/bitchord/`,
>   so `BC ui/theme/Theme.kt` means `app/src/main/java/com/music/bitchord/ui/theme/Theme.kt`.

---

## TL;DR

| Style axis | Castafiore (current) | BitChord (target vibe) |
|---|---|---|
| **Typography** | System font, `fontWeight: 'bold'` on everything, no letter-spacing | SF Pro Display, a weight-based scale (W400–W800), *negative* tracking on big titles |
| **Color** | Flat 2-tone theme (`#121212` / `#1e1e1e`), accent reserved for buttons | Near-black palette + one carefully-spent accent; pages **tinted from the artwork** |
| **Surfaces** | Fully flat: zero shadows, zero elevation, zero blur, zero gradients | Frosted glass bars, 0.5dp hairline borders, subtle backdrop whoosh |
| **Corners** | Inconsistent: 0 / 4 / 5 / 7 / 10 / 20 / 999 all over | One consistent 8dp thumbnail corner, pill = 50% for bars |
| **Nav & mini player** | Flat strips pinned to the screen edge (solid `secondaryBack`) | Floating frosted pills, max-width 440dp, centered, hairline ring |
| **Full-screen player** | Flat bg, one static cover, bold 25px title | Animated artwork, mesh-gradient glue, glow, word-synced lyrics, thin slider |
| **Detail / library pages** | Sharp 300px full-bleed cover, no bleed, no scrim | Artwork-washed pages, peeked shelf cards, skeleton loaders, in-title headers |
| **Motion** | `Animated.timing` 100–160ms, opacity-only press, no springs, no haptics | Springs (damping 0.72 / stiffness 320), 260ms palette crossfades, haptics on skip/select/swipe |
| **Icons** | FontAwesome (outline style, varying weights per size) | One consistent rounded Material icon set |

---

## Differences in detail

### 1. Typography — the biggest single gap

- **CF:** no custom font, no `fontFamily` anywhere. Titles/section headers are the
  system font with `fontWeight: 'bold'` and fixed sizes (25 / 30 for titles, 14 / 16 /
  20 for text) — `CF app/styles/size.js:9`, `CF app/styles/main.js:15`. There is no
  type scale, no weight nuance (a section title and a page title are both just
  *bold*), and **zero letter-spacing** anywhere in the app.
- **BC:** bundles SF Pro Display (`ui/theme/Theme.kt:53`) and defines a real type
  scale where *weight does the hierarchy*, not size alone: display W800/34sp,
  headline W800/30sp, title W700/20sp, body W400/16sp, labels W600/11–12sp
  (`ui/theme/Theme.kt:62`). Display-level strings use **negative letter-spacing**
  (`-0.8sp → -0.2sp`) — a screen-wide −0.8sp reads as Apple Music instantly, and it
  is what makes "50px of bold" feel cheap in comparison.
- Why it matters: BitChord looks "Apple" primarily *because of the type*, not the
  colors. `fontWeight: 'bold'` every title is the fastest way to make a UI read as
  amateur.

### 2. Color & theming

- **CF:** a small set of flat hex themes (`CF app/contexts/theme.js:40`), plus a
  player-accent override (`CF app/contexts/theme.js:235`). Default `castafiore` is
  `#121212` bg / `#1e1e1e` surface / near-ivory text / red `#cd1921` accent. The
  accent color is used almost exclusively on buttons. Backgrounds never change per
  page.
- **BC:** a near-black Material scheme with **one** accent — Apple's `#FA2D48`
  (`ui/theme/Theme.kt:22`) — spent grudgingly (`ui/theme/Theme.kt:24`). Far more
  importantly, pages are **tinted from their artwork**: `rememberArtworkPalette`
  quantises the sleeve into `{background, wash, elevated, accent, on, onVariant,
  divider}` and *every page element pulls from that palette* (`ui/theme/ArtworkPalette.kt:47`).
  A dark-mode sleeve becomes a near-black wash with a hint of its hue; light mode
  gets a pale wash of the same hue (`ui/theme/ArtworkPalette.kt:238`). Detail pages,
  the library grid, even the track list adapt their greys and divider to it
  (`ui/screens/DetailScreen.kt:206`).
- Why it matters: flat monochrome reads as "app"; artwork-tinted reads as "records
  on a shelf". Also note BC's secondary-text rule: on a *colored* wash, white at
  `0.80` alpha instead of the dim grey tuned for black
  (`ui/theme/ArtworkPalette.kt:262`) — a real legibility trap CF avoids only
  because CF never tints.

### 3. Surfaces, depth & texture

- **CF:** fully flat. No `shadow*`, no `elevation`, no gradients anywhere
  (confirmed by grep). The only transparency in the whole app is three rgba
  overlays (playing-song scrim, popup backdrop, row hover). No `expo-blur` in
  `package.json`; the only blur that exists is `blurRadius` on two player cover
  images. Borders (where they exist) are 1px solid.
- **BC:** layered depth everywhere —
  - Frosted glass on the tab bar and mini player via the Haze library,
    `HazeMaterials.thin/regular` (`ui/components/FloatingBottomBar.kt:201`,
    `ui/components/MiniPlayer.kt:136`), with a **"Reduce dynamic blur"** fallback
    to solid (`CF`-equivalent to a settings toggle CF doesn't have).
  - A **top fade-blur** bar that ramps from full blur at the status bar to nothing,
    so the bar has no bottom edge against the scrolling content
    (`ui/components/FrostedTopBar.kt:97`, `ui/components/TopFadeBlur.kt`).
  - **Hairline borders:** 0.5dp `White.copy(alpha=0.10f)` rings on every pill and
    thumbnail (`ui/components/Common.kt:72`, `MiniPlayer.kt:139`). This is the
    single cheapest trick that separates "buttons floating" from "buttons pasted".
  - The full-screen player runs an **animated artwork "canvas"** (`ui/player/CanvasArtworkPlayer.kt`)
    plus a **mesh gradient** backdrop and colour glow blurs
    (`ui/player/MeshGradient.kt:168`, `NowPlayingScreen.kt:2332`).
- Why it matters: depth is what makes the same layout feel premium. Flat is not a
  style choice CF made — it is the absence of any layering vocabulary.

### 4. Corner consistency

- **CF:** corners are ad-hoc literals per component: grid tiles = **0** (sharp
  squares) and artist tiles = 999 (`CF app/components/item/AllItem.js:42`), list art
  = 4 (`CF app/styles/main.js:44`), popup thumbs = 5, mini-player art = 4
  (`CF app/components/player/BoxPlayer.js:160`), fullscreen cover = 10
  (`CF app/components/player/FullScreenPlayer.js:57`), sheets = 20, pills = 999.
- **BC:** one answered question — *everything* that is artwork is `RoundedCornerShape(8.dp)`
  (`ui/components/Common.kt:385`, `MiniPlayer.kt:106`), and everything that is a
  bar/pill is `percent = 50` (`ui/components/FloatingBottomBar.kt:137`). Cards 16dp.
- Why it matters: mixed radii whisper "assembled by many hands"; one radius reads as
  one designer. 4px list art looks nicked next to 8px.

### 5. Navigation & bars

- **CF:** the tab bar is a solid strip pinned to the bottom edge
  (`CF app/components/bar/BottomBar.js:49`) with a tiny icon + label, no selection
  indicator beyond the icon color, and the mini player is a flat 10px-radius
  rectangle floating above it (`CF app/components/player/BoxPlayer.js:118`). No blur,
  no ring, no max-width (a tablet gets a bar that spans the whole width).
- **BC:** a **floating frosted pill** tab bar, `PAGE_GUTTER=10dp` from the edges,
  capped at `FLOATING_BAR_MAX_WIDTH=440dp` and centered on wide screens
  (`ui/components/Common.kt:107`). The selected tab is marked by a **liquid
  indicator** that springs between tabs, stretching 16% as it travels and squashing
  half that back (`ui/components/FloatingBottomBar.kt:115,169`). Dragging the pill
  horizontally switches tabs with per-tab haptics (`ui/components/FloatingBottomBar.kt:234`).
  The mini player is the same family: a 56dp pill, frosted, hairlined, its title in
  the type scale, next/prev/pause visible (`ui/components/MiniPlayer.kt:127`).
- Why it matters: pinned solid bars make the content feel like it is sliding behind
  metal; floating glass makes the app feel assembled from *layers*.

### 6. Full-screen player

- **CF:** full-bleed flat `primaryBack` modal, one centered square cover (radius 10),
  a 25px bold title, one 5-button transport row, a thin seek bar with pill ends
  (`CF app/components/player/FullScreenPlayer.js:57,259`; seek bar `SlideBar.js`).
- **BC:** the showpiece — the album art is not a static square, the whole background
  is an animated canvas: the artwork drives an animated mesh-gradient wash with glow
  (`ui/player/CanvasArtworkPlayer.kt`, `ui/player/MeshGradient.kt`), the palette
  warsms in over 260ms (`ui/theme/ArtworkPalette.kt:172`), lyrics are word-synced and
  fill the screen, and the slider is a hairline-thin custom `ThinSlider`
  (`ui/player/ThinSlider.kt`) instead of a transport-fat one.
- Why it matters: this is the maximum-impact screen to polish; it is also the most
  expensive to translate (CF would need `expo-linear-gradient` + `expo-blur` and a
  custom cover pane — see #9).

### 7. Detail & library pages

- **CF:** `PresHeader` is a **300px full-bleed sharp-edged cover** with no scrim, no
  gradient, no bleed of the image color into the page (`CF app/components/PresHeader.js`,
  `CF app/styles/pres.js:6`). Below it: a 30px bold title and then flat 16px rows.
  Home shelves are fixed-width 160px square tiles, sharp corners
  (`CF app/components/lists/HorizontalAlbums.js:61`).
- **BC:** detail pages *are* the artwork — the header art blurs into an edge-matched
  wash under it (`ui/theme/ArtworkPalette.kt:56`), the title rides in the list and a
  small centered title fades in over the glass on scroll
  (`ui/components/FrostedTopBar.kt:105`), track numbers replace repeated cover art on
  an album's own listing (`ui/components/Common.kt:369`), shelves peek the next card
  edge (`ui/components/Common.kt:116,136`), and lists get skeleton placeholders
  instead of spinner-flash (`ui/components/Skeletons.kt`).
- Why it matters: CF's hard cover→page handoff is the second biggest visual tell.

### 8. Motion & haptic feedback

- **CF:** all animation is `Animated.timing` (popup slide 100ms, mini-player
  slide-in 160ms), often with `useNativeDriver: false`. Press feedback = opacity to
  0.5. **No haptics at all** (no `expo-haptics`, no `Vibration`).
- **BC:** deliberate motion vocabulary —
  - springs on navigation (`GlassSpring = spring(damping 0.72, stiffness 320)`,
    `ui/components/FloatingBottomBar.kt:99`),
  - 260ms eased palette crossfades that respect "reduce animation"
    (`ui/theme/ArtworkPalette.kt:139`),
  - a pull-to-refresh **line under the frosted bar** instead of a spinning puck the
    glass would swallow (`ui/components/Common.kt:474`, `FrostedTopBar.kt:286`),
  - haptics on skip next, select, swipe-arm (`ui/haptics/Haptics.kt`, used across
    `MiniPlayer.kt:191`, `FloatingBottomBar.kt:269`, `Common.kt:248`).
- Why it matters: springs + haptics are what make a UI feel *responding* rather than
  *transitioning*. The opacity-0.5 press with no haptic is the cheapest-missing part.

### 9. Iconography

- **CF:** `react-native-vector-icons/FontAwesome` everywhere
  (`CF app/components/button/IconButton.js`), outline glyphs at mixed sizes/weights.
- **BC:** one consistent rounded Material icon set, sized/tinted through the theme
  (`ui/icons/BitChordIcons.kt`, e.g. `Icons.Rounded.*` in `MiniPlayer.kt`, `Common.kt`).
- Why it matters: mixed icon styles read as clutter; one family + consistent
  hairlines reads as a brand.

---

## How to improve Castafiore — ranked

Rules of thumb for every item: **keep CF's theming architecture** (themes + player
themes are already a fine idea), and **don't add a dependency when a few lines of
style will do**. Each item names a constraint so you can size the effort.

### Layer 1 — quick wins (no new deps, ~a day)

1. **Add a type scale + negative tracking.** Extend `CF app/styles/size.js` with a
   `type` token set (weight + size + letterSpacing), then apply: titles W700 tight
   (`-0.4`), section titles W600, labels W600 12px, body W400. Replace the ad-hoc
   `fontWeight: 'bold'` inline styles. Note: RN Android ships negative letter-spacing
   fine (recent RN); on web it's a no-op risk — acceptable. System font is fine at
   this layer (see 2 for the premium step).
2. **Bundled font (optional premium step).** Add a `fontFamily` token — e.g. the
   Roboto/Inter/PublicSans variable font you already have a legal path to — and set
   it in `size.js` once. This single token is what makes the whole app feel
   "designed".
3. **Unify corner radii.** Standard rule: *art = 8, chips/pills = 999, cards = 16,
   sheets = 20*. Sweep the literals: `CF app/styles/main.js:44` (4→8),
   `AllItem.js:42` (keep artists 999, give album tiles 8), `BoxPlayer.js:160` (4→8),
   `HorizontalPlaylists.js` rows, `RadioList.js` (3/7→8), `FullScreenPlayer.js:57`.
   Centralize in `size.radius` so it can't drift again.
4. **Hairline borders.** Add one shareable style — `borderWidth: 0.5,
   rgba(255,255,255,0.10)` in dark / `rgba(0,0,0,0.15)` in light — applied to mini
   player, tab bar, cover thumbnails. It is 3 lines in `CF app/styles/main.js` and
   the cheapest "premium" win on the list.
5. **Bottom padding under the app for the floating bars.** CF's bars are flush at the
   screen edge; give the content `paddingBottom` matching a floating bar's footprint
   so content never hides *under* them.

### Layer 2 — medium (small deps, ~2–3 days)

6. **expo-blur + a translucent pill.** Add `expo-blur` and turn the tab bar
   (`CF app/components/bar/BottomBar.js`) and mini player
   (`CF app/components/player/BoxPlayer.js`) into floating frosted pills: 12px
   horizontal gutter, `borderRadius` on the *outer* bar so it looks mounted on the
   content, hsl-rgba `secondaryBack` at ~80% alpha + blur. No Haze equivalent on RN
   web, so gate on `Platform.OS === 'web'` → solid fallback (mirrors BC's
   "reduce dynamic blur").
7. **Max-width the wide-screen chrome.** Reuse CF's existing `isDesktop`
   (`CF app/contexts/settings.js`) to cap the SideBar and BoxDesktopPlayer at ~440px
   and center them, so tablets don't get mile-wide bars.
8. **Artwork-wash detail headers.** Cheapest tint: on Pres screens
   (`CF app/components/PresHeader.js`, `CF app/styles/pres.js`), compute the cover's
   dominant color (CF already pulls covers via `urlCover`;
   `expo-image`/`expo-blur` can read pixels, or precompute server-side), then:
   - paint the header's bottom 100px with the same color blurred (continue the art,
     don't paste a seam),
   - tint that page's `secondaryText`/dividers toward the color at 0.80 alpha
     (BC's legibility trick, `ui/theme/ArtworkPalette.kt:262`).
9. **Skeleton loaders.** Replace spinner flashes in lists with a `Skeletons`-style
   shimmer (`CF app/components/lists/CustomFlat.js` is the choke point). Pure JS
   `Animated` opacity loop — no dep.
10. **Track numbers on album detail.** In `CF app/screens/Pres/Album.js`, show the
    track number instead of repeating the album cover on every row (BC does this,
    `ui/components/Common.kt:369`).

### Layer 3 — big / stretch

11. **Full artwork palette on Now-Playing** (the highest-perception-impact screen,
    hardest to build): `expo-linear-gradient` + blurred cover to replace the flat
    `FullScreenPlayer` background, cover with shadow+elevation, thin-slider seek bar,
    board-approved accent from the art. CF's `themesPlayer` already gives you an
    escape hatch for a per-screen accent — derive it from the art instead of the
    preset when available.
12. **Haptics.** `expo-haptics` (`selectionAsync` on press, `notificationAsync` on
    skip/queue) wired into `IconButton.js` — one call site covers every button.
13. **Springs for nav + popup.** Swap `Animated.timing` in
    `CF app/components/popup/OptionsPopup.js` and the tab indicator for
    `Animated.spring(damping: 22, stiffness: 320)` equivalents.
14. **Pull-to-refresh line.** CF uses LegendList + custom headers; a refresh line
    under the search bar / home header instead of the default spinner is a
    nicer-grained port of BC's `FrostedTopBar.kt:286`.

---

### Suggested order of attack

1. **Type scale + tracking + bundled font** (changes the whole app in one commit)
2. **Radius + hairline sweep** (one commit, instant "pixel-polish")
3. **Frosted floating tab bar + mini player pill**
4. **Artwork-wash Pres headers**
5. Then anything from Layer 3 once 1–4 settle.

Rule of thumb borrowed from BC's own code comments: use *whitespace, weight and
subtle hairlines* before you reach for *color, shadow and blur* — but once you use
color, derive it from the music, not the theme.