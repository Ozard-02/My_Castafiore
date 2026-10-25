# Offline content unification — remove auto-cache, one download index

Status: implementing (2026-10-25)
See `/home/espo/.opencode/plan/offline-unification.md` for the full research/analysis.

## Decisions

1. Full unification: `downloadManager` is the only owner of local files.
2. Remove auto-caching entirely (`isSongCaching`, `cacheNextSong`, `showCache`,
   `downloadNextSong`). A song is on disk only if the user downloaded it.
3. Web hides download/offline UI (no `DownloadButton`, no Downloads row, no offline
   content swap).
4. Existing auto-cached files are **deleted once** on upgrade; only files referenced
   by the download index (and in-flight/paused `.part`) survive.

## Phases

1. `utils/songFiles.js`: `songCacheKey`, `getSongsDir`, `getPathSong`,
   `parseSongFileName`, `isSongFileName`. `utils/coverId.js`: shared `coverIdFromUrl`.
2. `downloadManager`: derived `songIdsBySource`, `isSongLocal`, `getLocalSongUri`,
   `getLocalSongs`, `getLocalCollections`, `getLocalCollectionSongs`, `getLocalStats`;
   index entries store `file` (the cached filename) so a format change does not orphan
   a download.
3. One-time purge in `initDownloads`: consolidate old per-server folders, delete files
   not referenced by the index/queue, guarded by a successful state load + flag
   `localFilesMigration`.
4. Remove auto-cache from `cache.*`, all four player backends, `servicePlayback`,
   settings, SongItem/Info/OptionsSongsList, and i18n.
5. `offlineContent` O(N + C); `useLocalLibrary` hooks; screens use them; offline-aware
   API reads cache-only.
6. Web gating + dead export cleanup.

## Notes

- Pre-existing bug: `removeSong`/`removeSource` filtered `listCacheSong` with
  `${id}.${format}` while `songCacheKey` can append `-<bitrate>`. The whole
  `listCacheSong` mechanism is removed, so the bug cannot survive.
- Pre-existing bug: `initCacheSong` pruned every `.part`, breaking paused
  `DownloadResumable` across restarts. The new purge keeps `.part` for active items.
- Accepted regression: server-switch cache shortcut now only applies to downloaded
  tracks (auto-cached streamed tracks are gone).
