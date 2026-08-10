# Plan: Seamless server switching — keep playback alive across a server change

Status: DONE (shipped; built + installed on R5CY71GYKWF)
Related TODO: #14

## Requirement (user report)
"During a switch of a server, like going out of reach of wifi, it should not stop the reproduction;
since we already switch server, it continues to reproduce the same playlist/song/album seamlessly."

The auto-switch already exists (#5, `networkAutoSwitch.js`). The problem is purely that the switch
currently kills playback.

## Current behavior (root cause of the stop)
- `NetworkAutoSwitch.switchTo()` (app/contexts/networkAutoSwitch.js:21-26):
  ```
  await AsyncStorage.setItem('config', JSON.stringify(server))
  setConfig(server)
  Player.resetAudio(songDispatch)
  ```
- `Player.resetAudio` (app/utils/player/playerLocal.native.js:193-196):
  - `songDispatch({ type: 'reset' })` → `songReducer 'reset'` clears `queue`, `songInfo`, `index`,
    `upNext`, `actionEndOfSong`, `randomIndex` → `defaultSong` (app/contexts/song/provider.js:282-287).
  - `TrackPlayer.reset()` stops the local audio engine.
- So any server switch (auto or manual) = music stops + queue emptied. That's the whole bug.
- Also: stream/cover URLs are resolved against `global.config` **at load time**
  (`convertToTrack`, app/utils/player/playerLocal.native.js:120-139 → `urlStream(config, track.id, ...)`,
  `urlCover(config, track)`). Subsonic `id`s are server-specific, so a queue built from server A
  can't be streamed from server B by id alone.

## Design (implemented)
1. **Don't reset on switch.** `Player.switchServer(config)` added to all players
   (local/cast/upnp/web): saves state (position + isPlaying), reloads the **current** song via
   `loadSong(newConfig, song.queue, song.index)` (URLs re-derived against the new server), restores
   position, resumes if it was playing. `switchTo`/`upConfig` now call `Player.switchServer(server)`
   instead of `Player.resetAudio(songDispatch)` — queue is NOT wiped, TrackPlayer is NOT reset.
   Since the servers share the same library, Navidrome derives song IDs from file paths → the stored
   queue's IDs resolve on the new server too. `convertToTrack` reads `config` at call time, and the
   next auto-advance (`nextSong`) uses `global.config` (already swapped), so playback continues.
2. Queue-source tracking + title/artist re-resolution: **SKIPPED** (YAGNI). Same library → IDs match,
   so reload-by-id is enough. If servers ever diverge in content, re-add resolution then.

## Decisions (confirmed with user)
- **Servers share the same library** — same songs/titles/artists on every server; only URLs/ids differ.
  Re-resolving by title/artist will always find the song. No cross-server id mapping needed (YAGNI).
- Not-found case: still undecided (only relevant if servers drift out of sync) — default to "keep
  playing current track, re-resolve on next manual skip".

## Steps
1. Confirm library-sync assumption with user (see open questions) — DONE (same library)
2. `Player.switchServer` per platform (local/cast/upnp/web) — DONE
3. Wire into `NetworkAutoSwitch.switchTo` + manual `Connect`/`AddServer` `upConfig` — DONE
4. Queue-source tracking / re-resolution — SKIPPED (YAGNI, same library)
5. eslint (clean) + `:app:assembleRelease` (success) + install on R5CY71GYKWF — DONE

## Follow-up: reuse the song cache for instant resume (shipped)
Problem (user): after a switch, if the *new* server is slow there's still a pause — playback restarts the
track at the saved position by streaming from the new server, and the buffer waits on it.
Fix: the whole song is already cached on the device while it plays (`downloadNextSong` caches it).
But the song cache was per-server (`cache/<sanitizedUrl>/songs/`) — after a switch `isSongCached()`
returned false, so the cached copy wasn't used.
- `app/utils/cache.native.js`: song cache is now a single shared `cache/songs/` folder
  (`getPathDir()`), and `initCacheSong()` consolidates old per-server folders (and the legacy
  `undefined` one) into it via `FileSystem.moveAsync`. Servers share the same library → same song ids
  → the cached file resolves on the new server. `convertToTrack` already prefers the local file over
  `urlStream`, so no player change was needed.
- `app/utils/downloadManager.native.js`: download queue/index/collections AsyncStorage keys are still
  namespaced by `folderCache` (kept as-is — see Deferred below).
- Bug found in field test: `initCacheSong` moved files before creating the destination dir →
  moved the `makeDirectoryAsync(sharedDir)` call before the loop; first install then migrated cleanly.
- eslint clean; release APK built with `JAVA_HOME=/usr/lib/jvm/java-17-openjdk` (system Java 26 breaks
  Gradle 8.13's embedded Kotlin — unrelated to this change) + installed on R5CY71GYKWF.

## Follow-up 2: kill the remaining switch pause (shipped)
User: "it still stops for a second, i want something really seamless."
Root causes found in `playerLocal.switchServer`:
1. It called `loadSong` (= `TrackPlayer.load` + **play**) and only *then* `setPosition`. So on a switch
   the track audibly restarted from 0 and jumped to the saved position — the perceived "1s stop".
2. It reloaded even when the current track was already playing from a server-independent cached file.
Fix (`app/utils/player/playerLocal.native.js` `switchServer`):
- If `isSongCached` and the active track's URL already equals the local `getPathSong` path → return
  early, player untouched, zero gap.
- Otherwise load from the (shared) cache if available, then **seek BEFORE play**, then play/pause.
Constraint (honest): TrackPlayer is a single audio engine — `load()` tears down and rebuilds it, so a
real mid-song source swap can't be gapless. Best case now: 0 gap (already on cache), worst ~0.2-0.3s
(local file, no restart-from-0 artifact). A zero-gap swap would require a preemptive "swap to cache as
soon as the current song finishes downloading" (one small hiccup ~15-30s into each streamed song) — not
shipped, offer if still audible.

## Deferred
- **Unifying downloadManager keys across servers** (they're namespaced by `folderCache`): not needed
  for the playback fix, and would orphan existing per-server `downloadIndex:<url>` data on upgrade.
  Revisit if the Downloads screen losing its list on a switch ever becomes a problem.

## Shipped / skipped
- Shipped: `switchServer` on all four players; `switchTo`/`upConfig` use it; `resetAudio` still used by
  "Clear queue" (OptionsPlayer) and tuktuktuk end (servicePlayback), which is correct.
- Shipped: shared song cache (`cache/songs/`) + consolidation migration.
- Skipped: queue-source tracking + title/artist re-resolution. Add when servers diverge in content
  (then re-fetch the source collection on the new server and match by title/artist).
- Skipped: re-resolving a paused/in-flight download's URL after a switch (queue stores the enqueue-time
  `url`). Edge case; resume still works while the old server is reachable.
