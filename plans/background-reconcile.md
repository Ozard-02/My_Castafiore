# Resume-state reconcile (screen-off desync fix)

Date: 2026-08-29. Status: shipped, installed on connected device (tablet pending).

## Symptom
Screen off -> playback keeps advancing; unlock -> title/artwork/queue highlight lag the
actual audio until a manual next/prev "catches" it.

## Root cause
Auto-advance runs ONLY in the headless service (`servicePlayback.js`) via
`fakeSongDispatch = (action) => songReducer(global.song, action)`, which mutates `global.song`
but never React state. Lock-screen skip buttons (`RemoteNext`/`RemotePrevious`) do the same.
The only React catch-up was `useEvent`'s `PlaybackActiveTrackChanged` drift-compare
(`playerLocal.native.js`), unreliable while backgrounded -> React state stays stuck.

## Fix
- `playerLocal.native.js`: `reconcileState(songDispatch)` — `getActiveTrack()`; if it matches
  `global.song.songInfo.id` -> dispatch `syncGlobal` (restores queue/index/songInfo/upNext);
  else map the active id into `global.song.queue` -> `setIndex`. try/catch for pre-setup.
- `player.native.js`: export `reconcileState` routing via `getPlayer().reconcileState?.()` —
  optional-call makes cast/upnp/web no-ops.
- `contexts/song/provider.js`: AppState listener, on `active`, when `song.isInit`,
  `Player.reconcileState?.(dispatch)`.

## Decision
Notification skips keep `fakeSongDispatch` for now. Upgrade path if lock-screen liveness is
ever required: use `global.songDispatch` (real React dispatch from `initPlayer`) in the
service when the app is alive, falling back to fake in cold headless start.

## Verify
- eslint clean, gradle release build OK, installed on connected device.
- TODO on-device: play queue, screen off, advance a few songs, unlock -> UI must match audio
  without manual skip.