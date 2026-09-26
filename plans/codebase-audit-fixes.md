# Bug-fix pass (codebase audit, Tier 1 + Tier 2 + hearts)

Date: 2026-08-29. Status: shipped (code), phone installed, tablet install pending.

## Context
Follow-up to the sweep that produced a Tier 1/Tier 2/Tier 3 report. The user approved "all".
This plan only covers the code-level fixes; nothing here needs device-side research beyond a
sanity install.

## Done

Tier 1 (real bugs) — all shipped:
- `app/utils/playerCore.js`
  - Empty queue (`[]` is truthy) -> `% 0` is NaN -> loadSong crashes next/prev with
    repeatQueue on. Both paths gated on `song.queue?.length`.
  - Radio dead-stop: getRandomSongs returning only known/excluded songs made `extendRadio`
    return false -> hard stop mid-session. Now: retry `size=200` if a 50-sizing yields
    nothing new, then fall through to the wrap/stop branch instead of returning early.
  - Per-top-up `refreshExcludedSongIds(config)`: exclusions memory cache stays stale for radio
    started from Genre/Artist (only Home's explicit random press refreshed it).
- `app/utils/api.js`
  - Cache-write race: late getCachedAndApi fetch could overwrite fresh cache written by a star
    toggle. `cacheVersions` map; refreshApi bumps after write; writer skips when stale.
  - Unhandled rejections: setJsonCache failures now caught (resolve, log).
- `app/contexts/song/provider.js` — `covertArt` -> `coverArt`.
- `app/components/button/FavoritedButton.js` — setUpdateApi moves to `.finally`.
- `app/components/lists/HorizontalPlaylists.js` — real FavoritedButton props; Math.floor on
  minutes. `app/screens/Pres/Playlist.js` — Math.floor on minutes.
- `app/utils/network.web.js` — requestLocationPermission export.
- `app/screens/ShowAll.native.js` — effect deps aligned to web.
- `maxBitrate` -> `maxBitRate` in SongItem.js, OptionsSongsList.js (×2).

Tier 2 — all shipped:
- `OptionsMultiArtists.js` — findIndex `!== -1`.
- `OptionsFavorited.js` — id `config.url`.
- `updateApi.js` — isUpdatable JSON.stringify for object queries.
- `OptionsSongsList.js` — render guard.
- `ArtistExplorer.js` — optional-chained name.
- `Settings/Downloads.js`, `Settings/Home.js` — Number.isNaN guards.
- `ImageError.js` — removed stale memo.

Hearts:
- New `app/utils/starred.js` `useStarredIds()`; used by BoxPlayer (stale snapshot fix) and
  ShowAll.native song grids.

## Deferred (logged in .log)
- FavoritedButton albumId/artistId spray — risk > reward.
- FullScreen* / BoxDesktop hearts stay inline (correct today).
- settings.js snapshot writes; downloadManager native.
- useKeyboardIsOpen iOS — skip.

## Verify
- eslint clean.
- Gradle release build clean (JDK 17); installed phone (default target).
- Tablet SM-X730 (R52Y80837NY): pending — device was offline; a Z Flip was connected.
- On-device sanity to recommend: radio + next/prev at queue end (repeat on/off), star a song
  in the player, check heart consistency across Favorited grid / show-all.