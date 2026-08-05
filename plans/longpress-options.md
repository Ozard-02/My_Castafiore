# Plan: Long-press options gaps — "Play next" from Home albums + Music tab long-press

Status: COMPLETED
Related TODO: none (bug-fix follow-ups) / feeds TODO #2 (whole-album play next surface area)

## Problem (user report)
1. Home → long-press an album → the popup has **no "Play next"**.
2. Music tab → long-press on albums **or** tracks **does nothing**.

## Research findings (verified in code)
- **Home albums**: `HorizontalAlbums.js` long-press → `OptionsAlbums` (multi-album popup).
  Its options: Play similar songs, Add to queue, Go to artist, Share, Info — **no "Play next"**.
  (The single-album `OptionsAlbum.js` used on the Album screen already has "Play next":
  fetches nothing, iterates `album.song` in reverse with `addToQueue(songDispatch, song, song.index + 1)`.)
- **Music tab / Tracks view** (`Explorer/SongExplorer.js`):
  - list mode renders `SongItem` WITHOUT `setIndexOptions` → `SongItem.onLongPress` falls back to the
    default no-op → nothing happens.
  - grid mode renders `AllItem`, which has **no `onLongPress` at all**.
  - No `OptionsSongsList` mounted anywhere in the explorer.
- **Music tab / Albums view** (`Explorer/AlbumExplorer.js`):
  - list mode `ExplorerItem` is rendered WITHOUT `onLongPress` → `Pressable.onLongPress` undefined.
  - grid mode `AllItem` — no long-press.
- **Music tab / Artists view** (`Explorer/ArtistExplorer.js`): same as Albums (ExplorerItem without
  `onLongPress`, AllItem without long-press).
- `ExplorerItem` already supports `onLongPress` + `onContextMenu` (calls it), so callers just need to pass it.
- `AllItem` is a plain `Pressable` with only `onPress` — needs `onLongPress`/`delayLongPress` added.
- `OptionsSongsList` already has "Play next" (per-song). `OptionsAlbums`/`OptionsArtists` are the
  multi-item popups used by the horizontal home lists.

## Root cause
Not wired: the Explorer screens never mount options popups nor pass long-press callbacks; the Home
album popup (`OptionsAlbums`) simply never implemented "Play next".

## Steps
1. `app/components/item/AllItem.js`: add optional `onLongPress` (+ `delayLongPress={200}`, like
   `HorizontalAlbums`) to the `Pressable`; default no-op.
2. `app/screens/Explorer/SongExplorer.js`:
   - add `indexOptions` / `setIndexOptions` state;
   - pass `setIndexOptions` to `SongItem` (list mode) and `onLongPress` to `AllItem` (grid mode,
     index == songs index);
   - mount `<OptionsSongsList songs={songs} indexOptions setIndexOptions />` once.
3. `app/screens/Explorer/AlbumExplorer.js`: same pattern → mount `<OptionsAlbums albums indexOptions setIndexOptions />`;
   pass `onLongPress` to `ExplorerItem` (list) + `AllItem` (grid).
4. `app/screens/Explorer/ArtistExplorer.js`: same → `<OptionsArtists artists indexOptions setIndexOptions />`.
   Note: `artists` array contains string header items; pass the flat index (headers can't be long-pressed).
5. `app/components/options/OptionsAlbums.js`: add **"Play next"** option (mirrors `OptionsAlbum`):
   fetch `getAlbum` for the pressed album, then reverse-loop `addToQueue(songDispatch, song, song.index + 1)`;
   `hidden: !song.queue?.length`. (`useSong`/`useSongDispatch` already imported there.)
6. i18n: "Play next" key already exists — no new keys.
7. Verify: eslint, rebuild APK, install on device; test Home album long-press + Music tab long-press on
   tracks/albums/artists (list + grid) in both embedded (Music tab) and standalone (SearchMore → Explorer) usage.

## Decisions
- Reuse the existing multi-item popups (`OptionsAlbums`/`OptionsSongsList`/`OptionsArtists`); do NOT create
  a single-item variant.
- Home artist/playlist long-press popups keep their current options (not in scope).

## Open questions
- Should grid-mode songs get the full song popup (Play next, queue, go-to-artist, download, …)? Default yes.
- Home playlists/genres long-press: leave as-is unless requested.

## Shipped
- Steps 1–6 done as planned. eslint clean, APK rebuilt, installed + launched on R5CY71GYKWF.
- Note: `ArtistExplorer` grid maps grid item back to the flat `artists` index via `artists.indexOf(item)`
  (string headers are filtered out of the grid, so the pressed item is found in the full array).
- Grid-mode songs get the full song popup (`OptionsSongsList`), per the open-question default.

## Skipped
- Nothing in scope. Home playlists/genres long-press left as-is (out of scope).
