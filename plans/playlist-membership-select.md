# Playlist membership select (multi-select "Add to playlist")

Replaces the flat single-select playlist list with a real multi-select sheet that is a
**membership editor**, not just an "add" list.

## Requirement

1. Per-playlist selection circle: **empty circle** = not selected, **filled circle with a
   check** = selected.
2. Circles reflect real membership — a playlist that already contains the song(s) starts filled.
3. **Deselecting a filled playlist removes the song(s) from it.** The model is bidirectional.
4. Partially-containing playlists show an **empty circle** (user decision, 2026-09-28). Tapping
   one adds only the missing songs; leaving it alone does not remove the ones already there.
5. A **Done** button pinned at the bottom. Always enabled — with nothing changed it just closes.
   Pressing it closes the sheet and returns to the screen the user came from.
6. Failure handling: apply sequentially, report partial success as a count, **no rollback**
   (user decision). Rollback would be a second destructive operation nobody asked for.
7. Active server only.
8. All five existing entry points.

## Entry points (all of them)

| File | Scope | Existing call |
|---|---|---|
| `OptionsPlayer.js:76` | current song | `addSongToPlaylist` |
| `OptionsSongsList.js:115` | one song | `addSongToPlaylist` |
| `OptionsQueue.js:73` | one queue song | `addSongToPlaylist` |
| `OptionsAlbum.js:44` | whole album | `addSongsToPlaylist` |
| `OptionsAlbums.js:47` | multi-selected albums | `addSongsToPlaylist` |

`OptionsFavorited.js` / `OptionsArtists.js` have no add-to-playlist today, so they are untouched.

## The trap: Subsonic removes by INDEX

`updatePlaylist` takes `songIndexToRemove` (0-based index into the current playlist), not a
song id. Removing index 3 shifts every later entry down by one, so **removals must be applied
highest-index-first**. Ascending order deletes the wrong songs — silent data loss, no error.
`Playlist.js` already relies on this (single removal, so it never hit the bug).

The helper therefore re-fetches the playlist immediately before applying, so indices are fresh,
and sorts removals descending.

## Diff model

`initial` = playlists where **all** target song ids are present (starts filled).
`selected` starts as a copy of `initial`.

- `selected \ initial` → add the missing song ids
- `initial \ selected` → remove those song ids
- anything else → untouched, so a partially-containing playlist left unselected is never damaged

## Decisions taken without asking

- **Removal gets a confirmation** (`confirmAlert`) listing what is affected; adds do not. The
  model is newly destructive — one tap on a 27-song album can now delete 27 entries — and answer
  6 explicitly rules out rollback, so the guard belongs before the write, not after. Reversible
  by deleting the sheet's check.
- Membership is resolved by fetching each playlist's entries with a concurrency cap of 5 and a
  loading state, since `getPlaylists` does not include entries.
- i18n follows the repo convention: static strings, no `{{interpolation}}` (no existing key
  uses it). Counts are composed in JSX like the existing `{count} {t('songs')}` pattern.
- `Playlist.js`'s existing single-song removal is left alone — refactoring it onto the new helper
  is unrelated scope.

## Steps

1. `app/utils/api.js` — add `updatePlaylistEntries(config, playlist, { addIds, removeIds })`:
   re-GET, diff against `existing`, add missing, remove descending, return counts.
2. `app/components/popup/PlaylistSelectPopup.js` — the shared sheet: circles, loading, Done,
   removal confirmation, partial-success alert.
3. Rewire the five call sites to resolve ids then open the sheet (and close their own options
   popup so the sheet is the only thing on screen).
4. i18n keys in `app/i18next/en.json`.
5. `npm run eslint`, `assembleRelease`, install on the connected device.

## Verify

- Single song already in 2 playlists → sheet opens with 2 filled; deselecting one removes it.
- Album where a playlist holds 9 of 27 → empty circle; tapping adds the other 18, deselecting it
  later removes all 27 (descending indices).
- Done with nothing changed → closes, no API writes.
- Simulated server failure on the 2nd of 3 playlists → 1st stays applied, count reported.
