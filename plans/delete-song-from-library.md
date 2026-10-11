# Delete song from library (parked — waiting on Navidrome)

## Research findings
- Stock Navidrome is read-only by design: Subsonic `rest/*` has `deletePlaylist`,
  `deleteBookmark`, `deleteShare`, `deleteInternetRadioStation` — no delete-media endpoint.
- Native API `DELETE /api/song/:id` is GET-only (`rx(r, "/song", ..., false)` in
  `server/nativeapi/native_api.go`).
- The only delete is `DELETE /api/missing` (DB cleanup for files already gone from disk).
- Plugin HTTP endpoints (`/ext/{pluginID}/*` + `/rest/ext/{pluginID}/*`, subsonic/native/none
  auth) would unlock this, but PR navidrome#5045 is still **Draft, unmerged** on branch
  `plugins-endpoints`. Server on v0.64.2 has no `endpoints` manifest capability.
- DB-only delete won't stick: the next `startScan` re-imports the file from disk.

## Steps (once upstream merges #5045 and releases it)
1. Confirm server version supports `endpoints` in the plugin manifest; update Navidrome.
2. Write small `.ndp` plugin (Go PDK):
   - `HTTPEndpoint` capability, manifest `endpoints { auth: subsonic }` + `users` allow-list
     + `library` with `AllowWriteAccess=true`.
   - Endpoint e.g. `DELETE /rest/ext/deletesong/delete?id=<songId>`: resolve id→file via
     Library host service, delete the file, trigger rescan.
3. Castafiore:
   - `app/utils/api.js`: new `deleteLibrarySong(config, songId)`.
   - `app/components/options/OptionsSongsList.js`: "Delete from server" entry with
     `confirmAlert` (destructive, admin-only semantics).
   - After delete: existing `startScan` flow (`app/screens/tabs/Home.js`) + `refreshApi`.
   - i18n strings for menu + confirm.
4. Docs: min Navidrome version, plugin install + grant steps.
5. Verify: file gone after rescan, no re-import, unauthorized user denied, rate limit OK.

## Decisions
- 2026-10-11 (user): wait for upstream; no sidecar microservice.
- No code changes until unblocked.

## Open questions
- Exact min Navidrome version (whichever release first includes #5045).
- Whether the Library host service exposes delete directly or needs path + OS remove.
- Admin-only vs per-user allow-list.

## Status
- Parked. Re-check upstream PR status before starting.
