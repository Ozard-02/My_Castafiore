# Player UI overhaul (Spotify-inspired, screenshots in ~/Pictures/castafiore/)

## Requirements (user, 2026-08-23)
1. Pill (BoxPlayer): remove next-track button. Right-to-left: play/pause, favourite, cast.
2. Full-screen player: better space organization (Spotify ref 184541), NO share button.
3. Lyrics: big button/card instead of scroll-down section; fills available space.

## Decisions
- Pill: `ConnectButton` (cast) + `FavoritedButton` + `PlayButton`, each width 35,
  `size.icon.small`. Favorite guarded on `song.songInfo.id`; starred state from
  `songInfo.starred` (no extra getStarred2 fetch in the pill — syncs on song change
  via FavoritedButton's internal state).
- Lyrics card: `Pressable` between transport and bottom icon row, `flex:1`
  (minHeight 44/60, maxHeight 160) → absorbs all free vertical space. Toggles
  `isPreview` COVER↔LYRICS (reuses existing Lyric rendering). Label switches
  Lyrics ↔ Hide lyrics. Hidden in QUEUE preview (queue needs the space).
- Removed the small `comment-o` lyrics icon from the bottom row (card replaces it);
  bottom row is now repeat / cast / random / queue.
- Play button bumped 50→54 icon, box 63/60→70/66 (non-compact). Transport margins 30→20.
- No share button added (explicit user request).

## Steps
- [x] BoxPlayer: imports + button row swap
- [x] FullScreenPlayer: lyrics card + remove comment-o + transport sizing
- [x] i18n `Lyrics` / `Hide lyrics` (en/de, under `translation`)
- [x] eslint clean
- [ ] on-device verify (both layouts + compact/Z Flip + queue/lyrics toggles)

## Skipped (ponytail)
- Scroll-with-resistance lyrics reveal: the card button covers the need; add a
  PanResponder-driven peek only if the button feels wrong on device.
- Horizontal/desktop player: untouched (phone screenshots only).
