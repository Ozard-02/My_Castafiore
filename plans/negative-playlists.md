# Negative playlists ("exclusive" playlists)

## Requirement
Playlists marked "negative": their songs are available ONLY through that playlist —
excluded from the Home random-shuffle button. Playing the negative playlist itself stays
untouched. A song in both a negative and a normal playlist: excluded from random, playable
from both. Scope agreed with user: ONLY the Home random button (not browse/search, not
album home sections, not Genre.js random).

## Design decisions
- **Flag = playlist comment tag** `#<username>-exclusive`, same mechanism as the existing pin
  tag `#<username>-pin` (see `OptionsPlaylists.js`, `settings.js` homeSections 'pin-playlist').
  Subsonic-standard `updatePlaylist?comment=` → Navidrome-compatible.
- **Excluded ID set computed client-side**: `getPlaylists` → filter by tag → `getPlaylist` per hit
  → collect entry ids. Few negative playlists expected → N+1 is fine.
- **Per-server storage**: AsyncStorage key `excludedSongs:<config.folderCache>` (song ids differ
  across servers). Memory cache in module for instant reads.
- **Refresh points**: toggle action in `OptionsPlaylist` (invalidate + refetch). Known ceiling:
  server-side playlist edits won't propagate until next toggle — acceptable (ponytail).
- **Filter point**: `Home.js clickRandomSong` only.

## Steps
- [x] `app/utils/exclusions.js`: getExcludedSongIds / refreshExcludedSongIds / invalidateExclusions / filterExcluded
- [x] Toggle "Exclude from shuffle" ↔ "Include in shuffle" in `OptionsPlaylist.js`
      (append/strip tag from comment via updatePlaylist, then refresh set)
- [x] Filter in `Home.js clickRandomSong`
- [x] i18n en/it/de (other locales fall back to en)

## Edge cases noted
- `EditPlaylist.js` overwrites the whole comment field on save → manual edit wipes the tag
  (same pre-existing behavior as pins; not fixed here).
- All songs filtered out → random button does nothing (no toast; KISS).
