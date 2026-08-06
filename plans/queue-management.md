# Plan: Queue Management (TODO #1)

Status: DONE
Related TODO: #1 (Different Queue Management)

## Goal (from TODO)
1. Queue reordering via drag-and-drop
2. Queue as a modal/list with move-to-top, move-to-bottom, remove options
3. Separate "up next" queue from the full playback queue
4. Shuffle should act only on the actual queue, not "up next"

## Current state (what already exists — plan reflects this)
- Single `song.queue` array in the song reducer (`app/contexts/song/provider.js`). Persisted to
  AsyncStorage (`song` key). `song.index` = playing position, `song.randomIndex` = shuffled order.
- Queue UI = `FlatList` of `SongItem` inside the FullScreenPlayer QUEUE preview tab
  (`app/components/player/FullScreenPlayer.js` `CoverItem`, and the desktop twin
  `FullScreenHorizontalPlayer.js`). Tapping a row calls `Player.setIndex`; long-press opens
  `OptionsQueue`.
- `app/components/options/OptionsQueue.js` popup already offers: Go to artist, Go to album,
  Add to playlist, Open home page, Remove from queue (`removeFromQueue`).
- "Play next" ALREADY exists and inserts at `song.index + 1` into the SAME queue
  (`OptionsSongsList`, `OptionsAlbums`, `OptionsAlbum`). There is no separate "up next" list.
- `addToQueue(songDispatch, track, index)` + `removeFromQueue(songDispatch, index)` live in
  `app/utils/player.native.js`. Shuffle = `setActionEndOfSong('random')` builds `randomIndex`.
- Auto-advance on track end (local) happens in `app/services/servicePlayback.js`
  (`PlaybackQueueEnded` → `nextSong`); cast/upnp do the same in their `useEvent`. Local player
  `useEvent` (`PlaybackActiveTrackChanged`) syncs the app reducer from `global.song` via `setIndex`.
- Repo idiom for gestures: RN core `PanResponder` + `Animated` (no reanimated / gesture-handler).

## Decisions / scope (user confirmed: full scope = items 1+2+3+4)
- **New `upNext` array** in the reducer (persisted, like queue). "Play next" actions insert at its
  front (`addToUpNext(..., atStart=true)`); `nextSong` drains it first — so shuffle/random/repeat
  never touch "up next" (item 4 satisfied by construction). Tapping a main-queue song (`setIndex`)
  and starting a new queue (`setQueue`) clear `upNext`.
- **Drain path**: `nextSong` plays `upNext[0]` via a new `nextUpNext` reducer case (shifts it out,
  sets songInfo, main `index` untouched → resumes the main queue where it left off). The local
  player's `PlaybackActiveTrackChanged` handler syncs the app via a new `syncGlobal` reducer case
  (service runs the reducer on `global.song`; the app catches up on track change). End-of-queue
  "stop" checks in servicePlayback/cast/upnp now skip stopping while `upNext` is non-empty.
- **Move options (item 2)**: one `moveInQueue` reducer action (+ `moveUpNext` for up next) reused
  by Move to top / up / down / bottom entries added to `OptionsQueue` and a new `OptionsUpNext`.
- **True drag-and-drop (item 1)**: a `QueueDragRow` component — PanResponder on a `reorder` handle
  (icon rendered via a new optional `handle` prop on `SongItem`), Animated translateY follows the
  finger with scroll-compensation, autoscroll near list edges, drop → `moveInQueue`/`moveUpNext`.
  Moves the current song: blocked (current song's row hides the move options and the current-row
  handle is still draggable but target clamped — actually hide handles? keep simple: current row
  still draggable, index-shift math handles it).
- QUEUE view splits into an "Up next" section (maxHeight ≈3 rows) + the main queue list; headers
  are plain `<Text>` above each FlatList (keeps `getItemLayout` uniform, so `scrollToIndex` stays exact).

## Steps
1. Reducer: `upNext` in defaultSong/restore/setQueue; clear on setIndex/setQueue; new cases
   `addToUpNext`, `nextUpNext`, `removeFromUpNext`, `moveUpNext`, `moveInQueue`, `syncGlobal`. — DONE
2. `player.native.js`: `nextSong` drains upNext; add/export `addToUpNext`, `removeFromUpNext`,
   `moveUpNext`, `moveInQueue`. Same in `player.web.js`. — DONE
3. Auto-advance: `servicePlayback.js` + cast/upnp stop-check respect upNext; local
   `PlaybackActiveTrackChanged` dispatches `syncGlobal`. — DONE
4. Callsites: OptionsSongsList / OptionsAlbums / OptionsAlbum "Play next" → `addToUpNext(atStart)`. — DONE
5. Options: `OptionsQueue` + new `OptionsUpNext` with move/remove entries. — DONE
6. UI: `SongItem` `handle` prop; `QueueDragRow` component; FullScreenPlayer + FullScreenHorizontalPlayer
   QUEUE view = up-next section + DnD rows. — DONE
7. i18n en/de: Up next, Queue, Move to top/up/down/bottom, Remove from up next. — DONE
8. eslint + rebuild + install + smoke-test. — DONE
9. Docs (.log, TODO #1, STRUCTURE.md). — DONE
10. Commit + push. — TODO

## Skipped / deferred
- Reordering across sections (up next ↔ main queue) — KISS, move within each block only.
- Dragging the currently-playing row disabled via hidden move options; the handle stays active.
- Desktop full parity included (QueueDragRow reused); web builds use the same JS.
