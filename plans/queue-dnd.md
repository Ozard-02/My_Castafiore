# Plan: Queue view polish — pinned now playing + cross-section drag (TODO #1 follow-up)

Status: DONE
Related: TODO #1 (Different Queue Management), `plans/queue-management.md`

## Goal (user request)
1. Pressing the queue button shows the **currently playing song pinned on top**, above both the
   "Up next" and the "Queue" sections.
2. Drag-and-drop **reacts dynamically** (a live gap opens where the finger points; siblings shift;
   the lifted row is elevated) instead of the current static translate.
3. Drag-and-drop works **across** the Up next and Queue sections.

## Decisions (user confirmed)
- **Keep two stacked lists** (Up next capped at 3 rows + main queue list below); do NOT unify.
  Cross-section = resolve the drop target from the absolute finger position vs each list's bounds.
- **Block** dragging the currently-playing row into Up next (`moveQueueToUpNext` ignores
  `from === song.index`; the drag manager also clamps the current row's target to the queue list).
- Pinned current song row is non-draggable and sits above both sections.

## Steps
1. Reducer (`app/contexts/song/provider.js`): new cases
   - `moveUpNextToQueue {from(upNext idx), to(queue idx)}` — splice into queue at `to`,
     `newIndex = to <= index ? index+1 : index`; persist, clear randomIndex.
   - `moveQueueToUpNext {from(queue idx), to(upNext idx)}` — ignore `from === index`;
     `newIndex = from < index ? index-1 : index`; persist, clear randomIndex.
2. Utils: `moveTrack(songDispatch, {fromList:'up'|'queue', from, toList, to})` in BOTH
   `player.native.js` and `player.web.js` (same-list → moveUpNext/moveInQueue, cross → new cases).
3. `QueueDragRow.js` becomes a list-scoped drag system in one file:
   - `QueueDragProvider` (context): holds a registry of rows `{list, index, setShift, crossBlock}`,
     the active drag state, and list metadata (`listRef/offsetRef/viewportRef/len/rowHeight` for
     both lists, `onMove`, `songIndex`, `rowHeight`).
     - `startDrag`: measure both lists via `measureInWindow` (fallback: relative math), mark active.
     - `onDragMove`: finger pageY picks the active list; target index = clamp(floor((pageY - listTop
       + listOffset) / rowHeight), 0, len-1); edge-autoscroll the active list (existing EDGE/STEP);
       dragged translate = dy − cumulative scrollDelta; spring siblings in the active list to
       ±rowHeight (only setValue when a row's shift actually changed); clamp current-row target to queue.
     - `endDrag`: snap all rows back, call `onMove(fromList, from, toList, to)`.
   - `QueueDragRow` (thin): registers on mount, renders the `reorder` handle, forwards
     PanResponder events to the provider.
4. `FullScreenPlayer.js` (mobile QUEUE branch): pinned "Now playing" `SongItem` on top (non-draggable);
   wrap the two sections in `QueueDragProvider`; rows use `QueueDragRow`.
5. `FullScreenHorizontalPlayer.js` (desktop QUEUE branch): same pinned row (right-aligned custom row
   with playing overlay); provider wrap; add the `reorder` handle into the raw `Pressable` rows.
6. Verify: eslint; rebuild APK; install on R5CY71GYKWF; smoke — pinned on top, live gap in both lists,
   cross-section drops land correctly, current song can't cross, desktop handle works. — DONE (eslint clean,
   APK built 45s + installed, launch verified; interactive drag smoke left to the user).
7. Docs: `.log`, `TODO.md` (#1 note), `STRUCTURE.md`, this plan → DONE.

## Follow-up fixes (after device smoke test)
- Crash on drag: `measureInWindow` was called on the FlatList ref (doesn't expose it) → TypeError.
  Lists are now wrapped in `View`s (`queueBox`/`upNextBox`); the provider measures those (`?.`-guarded).
- Current song removed from the queue list (it's the pinned "Now playing"): queue FlatList renders
  `queue minus song.index`; display→real index mapping for `moveTrack`/`setIndex`/options; scroll targets
  the first upcoming song. `crossBlock` clamp dropped (reducer guard stays).
- Drag behaving wrong on device ("songs go nowhere") + lifted row disappearing → rewrite
  (`QueueDrag.js`): window-coordinate measurement is unreliable inside a `Modal`, so drop targets are now
  resolved purely from each list's `onLayout` `boxY`/`boxH` (container-relative) + the gesture `dy`;
  region detection uses "Up next" only when that box exists; cross-section gap shifts trailing rows
  (`index >= targetIndex`) by `rowHeight`; desktop's bottom-aligned queue gets a `bottomPad` correction.
  Lifted row dropped `elevation`/`zIndex` (clipped-FlatList glitch hid it) — now just `backgroundColor`;
  spring uses `useNativeDriver: false`.

## Refactor (cleanup pass)
- `app/utils/useQueueDnD.js` (NEW): owns all queue-DnD state shared by both players — refs, `lists` memo,
  `handleMove` + display→real mapping (`queueRealIndex`), scroll-to-current effect. Options: `bottomAligned`,
  `scrollAnimated`. Both players call it; per-player differences stay local.
- Deleted dead `queueBox`/`upNextBox` refs (leftovers from `measureInWindow`).
- `QueueDragRow.js` → `QueueDrag.js` (file holds `QueueDragProvider` + `QueueDragRow`); provider no longer
  stores a redundant `key` on registered rows (uses row identity); up-region helper inlined.

## Skipped / deferred
- Full single-list unification (user chose two stacked lists).
- Dragging the pinned now-playing row (display only).
