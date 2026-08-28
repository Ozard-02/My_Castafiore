# Endless shuffle + exclusion refresh

## Problem
1. Home random button played songs from exclusive (`#<user>-exclusive`) playlists. Root cause:
   NOT parsing — `comment.includes(tag)` matches `Auto-imported from 'BL34J1.m3u8'#esplor02-exclusive`
   fine. The excluded-id cache (`exclusions.js`) only refreshed on manual in-app toggle
   (`OptionsPlaylist`), so m3u8 re-syncs / server-side edits leaked through.
2. Random sessions stop when the fetched list ends. User wants them to top up with new randoms.

## Decisions (agreed)
- Exclusions: **refresh on each Home random click** (await `refreshExcludedSongIds` before filter).
- Radio scope: **all shuffle/random buttons** (Home, RandomButton [Favorited/Album/Playlist],
  Genre, Artist), not just Home.
- Top-up is uniform: always library-wide `getRandomSongs size=50`, filtered by exclusions,
  deduped against current queue ids. No context-aware refills (would need serializable fetchers).
- Player shuffle toggle (`actionEndOfSong='random'`) untouched — separate concept.
- "Similar songs" seeds (OptionsSongsList/Album/Artist) stay finite.

## Steps
- [x] provider: `radioMode` in state — `setRadioMode` case, cleared by `setQueue`,
      persisted via `restore`/defaultSong (rides the normal AsyncStorage 'song' snapshot)
- [x] playerCore: `extendRadio` helper + `nextSong` branch at last-index-no-upNext;
      after append must read fresh `global.song.queue` (closure copy is stale)
- [x] servicePlayback: stop branch skips stopping when `global.song.radioMode` (falls into nextSong)
- [x] Entry points set flag AFTER `playSong` resolves (playSong dispatches setQueue which clears it):
      Home.js, RandomButton.js, Genre.js, Artist.js
- [x] Home.js clickRandomSong awaits `refreshExcludedSongIds(config)` first
- [x] eslint clean

## Notes
- Native UI sync works because reducer mutates `global.song` synchronously and
  `playerLocal.useEvent` syncs React state on PlaybackActiveTrackChanged (existing pattern for
  RemoteNext/QueueEnded paths). Web passes real dispatch everywhere.
- Web `ended` handler already routes through nextSong — no change needed there.
- repeatQueue ON keeps looping instead of extending; extension only fires when queue+upNext drained.

## Shipped
All of the above, in one pass. Skipped: context-aware refill genre/artist radio, any UI indicator
for radio mode (queue visibly grows anyway), TTL option for exclusions (per-click refresh chosen).
