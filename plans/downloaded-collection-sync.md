# Downloaded collection sync + favourite metadata

Status: implemented (2026-10-25)
Full research/options: `/home/espo/.opencode/plan/downloaded-collection-sync.md`

## What shipped

- `utils/collectionDiff.js` — set diff between the fresh server list and the stored
  `collection.songIds` (order-only changes do not trigger a sync).
- `downloadManager.syncCollection({ type, id, name, artist, cover, songs })`:
  enqueues missing songs, cancels queued items owned by this collection, detaches
  removed songs (file deleted only when no source remains), and rewrites the stored
  order/metadata.
- `getCollectionState(source, expectedIds)` — exposes `changed`, uses the
  `songIdsBySource` map (O(1)) and ignores an empty expected list (still loading).
- `DownloadButton` — shows a `cloud-upload` icon when the collection is stale and
  syncs on tap; requires `fresh` (the list came from a successful API fetch) and
  online, so syncing from the API cache or the offline fallback can never delete
  songs. `useCachedAndApi` now passes the `mode` ('cache' | 'api') to `setFunc`;
  Album/Playlist track `fresh` from it.
- Favourite metadata: `buildMeta` stores `starred`/`userRating`, `entryToSong`
  projects them, `syncLocalStarred(starredIds)` refreshes downloaded entries from the
  `getStarred2` cache (called from `useStarredIds`).
- `PlaylistButton` is now read-only offline (shows the stored favourite state)
  instead of hidden.
- `OptionsFavorited` — "Sync download" entry when the Favorited collection is stale
  (online only).
- Offline playlist order now follows `collection.songIds` (filtered to songs still
  attached to that source), falling back to index order for old records.

## Verification

- Node harness: diff (add/remove/unchanged/reorder/empty), offline order + fallback.
- `eslint` clean; release build (JDK 17) + install on R5CY71GYKWF.
- Device: edit a downloaded playlist (add/remove), reopen → sync icon → tap → only
  the delta downloads and the removed song is detached; star a downloaded song →
  offline circle updates; Favorited sync entry appears when the starred set changed.

## Notes / defaults

- Manual sync only (no background diffing).
- Removed songs are deleted locally unless another downloaded collection still
  references them.
- Offline favourite circle is read-only.
