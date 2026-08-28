# Fix: next/previous icons & Bluetooth controls loop on the same song

## Symptom
Pressing next/prev (full-screen transport, notification, Bluetooth) sometimes plays the
same song from the start 3-5 times before actually advancing. Swipe gestures never do.

## Root cause
`playerCore.setIndex` disptaches `setIndex` only AFTER `await loadSong(...)` completes
(regression from the KISS refactor `d8ffc98`, which changed native from fire-and-forget
load + immediate dispatch to awaited load + deferred dispatch). During the load window
`global.song.index`/`songInfo` are stale, so any re-trigger of the skip loads the same
track again → the song restarts repeatedly until the deferred dispatch lands.

Three triggers, same root defect:
1. Natural-end collision: skip lands near a song end → `PlaybackQueueEnded` auto-advance
   (`servicePlayback.js`) reads stale state → same-target load.
2. Double-invocation: rapid double-tap / Bluetooth double event while React hasn't
   re-rendered → same target index computed twice → two racing `load()`s of one track.
   (Pre-refactor, immediate dispatch turned this into a two-song skip instead.)
3. Repeat-ON edge: `setPosition(0)+resumeSong()` can run during the load window before
   `setRepeat('next')` dispatches. Cosmetic; left as-is.

"Not swipe": swipe happens mid-song (no `ENDED` during load, single invocation);
icons/Bluetooth happen at/near song end or double-fire.

## Fix (shipped)
Dedupe concurrent loads of the same track in `playerCore.setIndex`: a second request for
an already-loading track id only syncs state, never reloads. `loadingKey` cleared via
try/finally. Covers icons, Bluetooth, natural auto-advance, cast/UPnP `TRACK_ENDED`,
web `ended` — all funnel through this one `setIndex`.

## Steps
- [x] Audit every `loadSong` caller (playerCore x3 = the only skip loads; rest unrelated).
- [x] Implement dedupe in `app/utils/playerCore.js:setIndex`.
- [x] eslint clean.
- [ ] On-device verify: play a queue, skip next/prev at song end and via Bluetooth ~20x
      → no more restarts; mid-song skip + natural auto-advance still clean; fast double-tap
      → single advance.

## Skipped / caveats
- Different-index rapid double-skip still brief-races the engine (two distinct loads);
  not a loop, pre-existing `load()` semantics.
- Repeat-ON transient restart (trigger 3) not guarded — rare and benign.
- UpNext playback path unaffected (`nextSong` upNext branch loads directly, dispatches
  before load, and runs exclusively).