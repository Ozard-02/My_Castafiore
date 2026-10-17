# Feature 2 — Automatic offline mode (downloaded content only)

Status: implemented 2026-10-17 — eslint clean, release APK built and installed on
tablet R52Y80837NY (needs on-device verify).

## User request

> once no connection is present, allow a offline-mode, to see only downloaded
> album/tracks/playlists and so on.

Decisions (asked 2026-10-17):
- **Automatic only** — no manual toggle; driven by the connection state.
- Browse screens show **only downloaded content** when offline.
- **Search stays enabled** but scoped to downloaded content.
- Wiring: `@react-native-community/netinfo` is already installed (WiFi/server
  auto-switch), and playback already prefers cached files
  (`playerLocal.convertToTrack` checks `isSongCached` before `urlStream`), so an
  offline browse + play path needs no player changes.

## Connectivity detection

`app/utils/offline.native.js` (and `offline.web.js`):

- module store + `useSyncExternalStore`, same pattern as `downloadManager`.
- Native: `NetInfo.addEventListener`; **offline = `isConnected === false`**
  (airplane mode / no wifi / no data). A connected-but-unreachable server is NOT
  offline: the server can live on the local network (LAN Navidrome), so
  cache-first screens keep working and API errors surface as before.
- Web: `navigator.onLine` + online/offline events; the PWA service worker owns
  offline playback there.
- Exports: `useOffline()` (React) and `getIsOffline()` (imperative).

## Offline data helpers — `app/utils/offlineContent.js`

Pure selectors over the persisted download state (`useDownloads()`):
`index` (`songId → { meta, size, date, sources }`) and `collections`
(`{ type, id, name, artist, cover, songIds }`).

- `offlineSongs(downloads)` → song-shaped objects, newest first.
- `offlineCollections(downloads, type)` → collections with ≥1 completed song,
  `songCount` recomputed from the index, newest first. Types: `album`,
  `playlist` (`favorited` collections stay out of the browse lists).
- `offlineCollectionSongs(downloads, type, id)` → songs whose `sources` include
  the collection (used when a Pres screen has no API cache for it).
- `isSongDownloaded(downloads, id)`.

`downloadManager.buildMeta` gains `duration`, `albumId`, `artistId`, `coverArt`
and `track` so offline rows show real metadata (older entries degrade to
title/artist/album only).

## UI

- `app/components/offline/OfflineSongs.js` — virtualized list/grid of downloaded
  songs (SongItem + PlaylistSwipeRow + OptionsSongsList; grid = AllItem) for the
  Tracks tab.
- `app/components/offline/OfflineCollections.js` — virtualized list/grid of
  downloaded albums or playlists; tapping opens the Pres screen; exports
  `OfflineCollectionRow` for reuse.
- `app/components/offline/OfflineSearch.js` — local filter over downloaded
  songs/albums/playlists, rendered as sections (replaces server search results
  while offline).
- `app/components/banner/OfflineBanner.js` — thin "you are offline" strip in the
  TabBar (mobile; desktop sidebar left alone for now).

### Screens

- **Tracks** (`tabs/Tracks.js`): offline view set is `tracks` + `albums` (no
  online artists view); search box switches to `OfflineSearch`.
- **Playlists** (`tabs/Playlists.js`): downloaded playlists; the Favorited
  section is filtered to downloaded songs; refresh + create hidden offline.
- **Home** (`tabs/Home.js`): downloaded albums (horizontal) + downloaded songs;
  Random Song shuffles downloaded songs; server buttons (refresh, scan, connect,
  ListenBrainz) hidden.
- **Album / Playlist / Favorited** Pres screens: when the API cache has nothing
  (album downloaded from a long-press, cache evicted), songs fall back to
  `offlineCollectionSongs`; Favorited filters to downloaded songs.

## Playback

Downloaded songs always resolve to their cached file (`convertToTrack`), so the
queue works with no network. Songs that are *not* cached keep the old behaviour
(stream attempt fails) — the offline lists only offer downloaded songs, but
cached Pres screens can still taste stale entries; documented, not blocked.

## Cover cache (shipped same day)

- Every enqueued song queues its getCoverArt image — deduped per cover id, ≤4
  concurrent, HTTP-200-only, stored at `cache/covers/<id>.jpg`; collection covers
  too. Hooked in `moveToQueue` so silent auto-caching also warms covers.
- `initDownloads` scans the folder and backfills missing covers for songs
  downloaded before the cache existed (online only, restartable).
- `urlCover` asks `getLocalCoverUri` first while offline → rows, album/playlist
  headers and players show real art with no network; a miss falls through to the
  server URL (placeholder as before).
- Old index entries derive `coverArt` from their baked cover URL so the lookup
  matches the file name.
- Known limits: covers are stored full-size (no `size` param) — one file per
  album, shared by every row; removing a single song keeps its album cover
  (shared, tiny), `clearAllDownloads` wipes the folder.

## Deferred / known limits
- `PlaylistButton` (song circle) hides offline: playlist membership needs the
  API, and star/unstar would fail.
- Album header heart / artist screens: kept as-is; their writes fail silently if
  used offline.
- Web build: detection only; the PWA's service worker already handles offline.
- Desktop sidebar has no offline banner yet.
