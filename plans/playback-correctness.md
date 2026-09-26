# Playback correctness + inconsistency sweep

Deep audit of the playback path (queue reducer, `playerCore`, the 4 player backends, the
headless service, and the player components) after the user reported: background problems,
songs looping, wrong cover updates, and playlists that loop.

Baseline commit: `ba8b982` (checkpoint of the uncommitted reconcile/Tier-3 work).

## Root causes found (ordered by how well they explain the reports)

| # | Defect | Symptom |
|---|---|---|
| R1 | Queue-row `onPress` returns a **Promise** (truthy) → `SongItem` also calls `playSong`. Two `load()`s + `setQueue` wipes `upNext`/`originalQueue`/`radioMode` and resets `actionEndOfSong` to `next`. | same song restarts; shuffle/repeat silently off; up-next lost |
| R2 | `extendRadio` dispatches `addToQueue` with `index: undefined`; the reducer's `index === null` test misses it, so `splice(undefined)` **prepends at 0**. Every top-up rebuilds the queue at the top and leaves `index` pointing at a different track. | radio queue rebuilt every top-up, "now playing" wrong, repeated songs |
| R3 | Up-next playback (`nextUpNext`) never updates `index`; `reconcileState` then can't map the active track into the queue (`findIndex === -1`) and returns without syncing. | **wrong cover/title after resume**; queue pane un-anchors |
| R4 | `setIndex` wipes `upNext` on *every* navigation (auto-advance, previous, reconcile) — only a user tap was meant to clear it. | up-next list silently disappears |
| R5 | `repeatQueue` defaults to `true` and `radioMode` never stops the queue; a failed `extendRadio` returns `false` and falls through to `(index+1) % len`. | **playlist loops forever** |
| R6 | Repeat-one is cleared *after* `await setIndex(...)`; a `PlaybackQueueEnded` in that window seeks the freshly loaded track back to 0. | repeat-mode restarts / re-entrant loop |
| R7 | `initPlayer` returns early on `android_cannot_setup_player_in_background` **before** `dispatch({type:'init'})`, and the AppState listener already `remove()`d → `isInit` false forever → no reconcile, no retry. | no resume re-sync for the whole session |
| R8 | `alwaysPauseOnInterruption: true` makes the `RemoteDuck` handler dead code → a transient audio-focus loss pauses permanently. | playback dies on a notification |
| R9 | `progressUpdateEventInterval: -1` disables `PlaybackProgressUpdated`. | Android notification scrubber frozen |

## Inconsistency sweep — 5 divergent copies of the end-of-track decision

`servicePlayback.js:80`, `playerCast.native.js:49`, `playerUpnp.native.js:21`,
`player.web.js:75` and `playerCore.js:62` each decide "repeat / stop / next" separately:

- repeat: local + web seek **and** play; cast + upnp **seek only** (song stops instead of looping)
- stop: **missing entirely on web**
- stop predicate: 3 identical copies vs a partial one in `playerCore` (no `radioMode`/`upNext`)
- scrobble: before the branch in 3 places, after in web (and skipped on web's `duration < 1` path)

Plus: `convertState` exists 3× and is **not equivalent** — `playerLocal` has no
`State.Loading`/`Connecting` branch (falls through to `Stopped`), and `playerCast` uses
`playerState`'s `State.Stopped` (`'stopped'`) as a GoogleCast lookup key, which is not a key →
`undefined` → the error/warning icon can never show on Chromecast.
`setPosition` clamping differs 4×; `downloadNextSong` arity differs (2 args native vs 3 web);
`restoreState` plays before seeking on 3 of 4 backends; `playerUpnp.disconnect(device)` shadows
the module-level `device`.

## Plan (one commit per group) — all shipped 2026-09-26

1. **R1** queue-row press contract — explicit `playsOnPress` prop on `SongItem` (the truthiness
   contract let a Promise from `onPress` trigger a second `playSong`). ✅
2. **R2** `addToQueue` treats a non-numeric index as append; intra-batch dedupe in `extendRadio`. ✅
3. **R3/R4** `reconcileState` falls back to `syncGlobal`; `useQueueDnD` anchors the rotation on the
   real position of `songInfo`; `setIndex` only clears `upNext` when asked (`clearUpNext`). ✅
4. **R5** `repeatQueue: false` default; `setIndex` clears `radioMode`; a failed `extendRadio` stops
   instead of looping. ✅ — surfaced a **dead play button** at the end of a queue, fixed with the
   new `song.queueEnded` flag (play restarts from the top).
5. **R6/R7/R8/R9** repeat cleared before the load; `initPlayer` retryable; drop
   `alwaysPauseOnInterruption`; real `progressUpdateEventInterval`. **Kill behaviour stays
   `StopPlaybackAndRemoveNotification`** (user: closing the app must stop playback). ✅
6. **Consolidation** one `endOfTrackAction()` decision in `playerCore`, used by all 4 backends +
   the service; added the missing web stop branch and cast/upnp resume; fixed `convertState`
   (`State.Loading`/`Connecting`/`Ended`, cast fallback key). ✅ — `setPosition` clamping left
   per-backend (identical modulo web's extra duration clamp; unifying it buys nothing).
7. **Reducer/UI consistency** `convertTrack` in `addToQueue`/`addToUpNext` (mixed shapes +
   AsyncStorage bloat), `isLiveStream` kept, `setRating` also writes `starred`,
   `updateGlobalSettings` hooks moved into the provider, occurrence-aware `keyExtractor`s in the
   reorderable/filterable lists, `Lyric` dep on `song.songInfo?.id` + cancellation. ✅

Extra fixes found while implementing: unguarded `global.song.queue` in the service's
`PlaybackActiveTrackChanged` (threw on a cold headless start, taking the scrobble with it),
`TimeBar` effect deps, `ImageError` nullish `source`, `saveQueue` URL length cap,
`RemoteProvider` null-queue TypeError + stale snapshot, `playerUpnp.disconnect` shadowing,
`PlayButton.onPress` missing `else`.

Verification: `npm run eslint` clean; `assembleRelease` succeeds (Metro bundle resolves every
import). On-device behaviour checks still owed — see the list at the end of the `.log` entry.

## Decisions

- `repeatQueue` default → **false** (user). Playback now stops at the end of a queue unless the
  user turns repeat on; `radioMode` sessions still extend.
- App swipe-away → **stops playback** and removes the notification (user). Unchanged behaviour,
  but it must be an explicit, commented choice rather than an accident.
- No `Player.updateTime()` "only call the active backend" change: the three backends each call
  hooks, so switching the set by device type would change the hook count per component and break
  React's rules. Deferred as a perf note.
- No `eslint-plugin-react-hooks` install in this pass (it would flag ~20 pre-existing call sites);
  the `updateGlobalSettings` violation is fixed by hand instead.
- No test framework exists; verification is `npm run eslint` + a release build + on-device test.
