# Feature 1 — Song "heart" → "Add to playlist" (circle, filled = Favourited)

Status: implementing (2026-10-17).

## User request

> replace add to favourite (heart) icon in song, with an empty/full icon same used in
> playlist, and replace behaviour, instead of adding to favourite open add to playlist
> menu, and add Favourited "as a playlist" to choose.

Decisions (asked 2026-10-17):
- Scope: **song rows + player** (full-screen + mini, mobile + desktop). Album/artist/
  playlist hearts keep favouriting.
- Icon: **circle, filled = Favourited** (song starred). Empty = not starred.
  Filled uses the sheet's filled+check idiom (`check-circle`), empty `circle-o`.
- **Keep long-press → rating popup** in song rows.
- Tapping opens the existing multi-select membership sheet (`PlaylistSelectPopup`)
  with **Favourited as a pseudo-playlist** at the top.

## Design

### New button — `app/components/button/PlaylistButton.js`
Same props contract as `FavoritedButton` (`id`, `isFavorited`, `rating`, `style`, `size`):
- tap → open `PlaylistSelectPopup` with `songs=[{ id, starred }]`
- long-press → `RatingPopup` (same logic as FavoritedButton: `setRating` + `songDispatch`)
- local `favorited` state synced from prop + from the sheet's `onDone` extras, so the
  circle flips immediately after the sheet stars/unstars (list sources don't re-fetch).
- `circle-o` / `check-circle`, colour `theme.primaryTouch` (match old heart accent).

### `PlaylistSelectPopup` — Favourited pseudo-row
- Prop change: `songIds` → `songs` (array of `{ id, starred }`; only these fields read).
  All 5 existing callers updated (they all have full song objects or can map one).
- Row at the **top** of the list: heart icon cover, name `t('Favorited')`,
  subtitle = starred song count from `getApiCacheFirst('getStarred2')` when available.
- Selection model mirrors the playlist circles:
  - filled when **all** target songs are starred; partial → empty; tap adds only the
    missing stars; deselect (filled → empty) unstars all target songs.
  - `readonly` concept doesn't apply; never dimmed.
- Apply pass: star/unstar changed songs via `getApi('star'|'unstar', { id })` per song,
  then `songDispatch({ type: 'setRating', id, starred })` per song, then
  `refreshApi('getStarred2')` + `setUpdateApi` (same sync FavoritedButton does, so
  player circles and queue rows update).
- Star failures: logged, not rolled back (consistent with the playlist partial-failure
  policy); `onDone(ok, total, { starred })` gains an `extras` third argument carrying
  the new all-starred state (or `null` when untouched) for the button to sync. Existing
  callers use the first two args only → unchanged behaviour.
- The Favourited toggle is additive/removable like playlists, but there is **no
  confirm dialog** for unstar (the old heart never confirmed either).

### Call-site swaps (FavoritedButton → PlaylistButton)
- `app/components/item/SongItem.js` (song rows incl. queue sheet)
- `app/components/player/BoxPlayer.js` (mobile mini)
- `app/components/player/FullScreenPlayer.js` (mobile full)
- `app/components/player/BoxDesktopPlayer.js` (desktop mini)
- `app/components/player/FullScreenHorizontalPlayer.js` (desktop full)

Untouched: `ExplorerItem` (album/artist rows), `HorizontalPlaylists` (playlist rows),
`Pres/Album.js`, `Pres/Artist.js` headers.

### Options menu callers (updated for the `songs` prop)
`OptionsSongsList`, `OptionsQueue`, `OptionsPlayer`, `OptionsAlbum`, `OptionsAlbums` —
each maps its current `songIds` to `{ id, starred }` objects.

## Open items
- Offline: the sheet's `getPlaylists` is a live call; offline behaviour is deferred to
  feature 2 (offline mode). The button will be hidden/disabled offline there if needed.
- Multi-select favouriting from option menus changes stars for songs whose row buttons
  are in other lists → those rows re-sync on next fetch (same staleness the hearts
  always had; queue rows update live via `songDispatch`).
