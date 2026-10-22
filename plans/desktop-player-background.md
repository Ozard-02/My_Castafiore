# Plan — Desktop full-screen player: fBM background + cerchio parity

Status: done (2026-10-22).

## Goal
Port the mobile full-screen player graphical features to the desktop
`FullScreenHorizontalPlayer.js`:
- animated fBM background (`PlayerBackground`) + cover-derived palette, replacing
  the static `blurRadius={5}` cover + `rgba(0,0,0,0.6)` scrim;
- translucent panels honouring `reduceTransparency`;
- keep the queue inline on the right (no overlay tendina);
- verify the `PlaylistButton` circle (ex heart) opens the add-to-playlist sheet.

Scope: **fullscreen only** (no mini `BoxDesktopPlayer`). Web keeps the flat
fallback (PlayerBackground.web is a stub).

## Steps
1. Imports: `useSettings`, `PlayerBackground`, `usePlayerPalette`, `themedPalette`,
   `Animated`.
2. Compute `background`, `palette`, `paletteColors`, `opaquePanels`, `panelFill`.
3. Replace the static cover+scrim with a conditional: `PlayerBackground` when on,
   else the existing blurred cover + scrim.
4. Apply `panelFill` to the queue column and the control row for legibility.
5. Verify `PlaylistButton` wiring (size 26, popup, starred state).
6. Update docs (STRUCTURE.md, TODO.md, .log).

## Risks
- GLView sizing in the horizontal Modal on larger screens (self-healing remount).
- Legibility of white text over fBM bands (dim + luminance clamp already handled).
- Web fallback must remain (stub returns null).

## Done criteria
- Release build boots; player shows animated bg when setting on; off → old look.
- Circle opens the membership sheet; offline hides it.
- eslint clean.