# Plan: Playlist row swipe actions

Status: DONE (built + installed on R5CY71GYKWF; manual test pending)
Related TODO: #10 (deferred item) — "swipe to remove from playlist" now specified

## Requirement (user)
On the Playlist screen song rows:
- swipe **right** → enqueue (add to queue)
- swipe **left** → reveal 2 buttons: "Remove from playlist" and "Play next"

## Design
- No new dependency — PanResponder + Animated (repo idiom: QueueDrag.js, BoxPlayer, useQueueDnD.js).
- New `app/components/item/PlaylistSwipeRow.js` — dumb gesture wrapper around `SongItem`:
  - horizontal swipe only (`onMoveShouldSetPanResponder` claims when |dx|>8 and dx dominates dy → vertical scroll/taps unaffected).
  - swipe right past threshold → `onEnqueue` + snap back.
  - swipe left past threshold → reveal actions (translateX → -ACTION_WIDTH), two buttons behind the row.
  - tap on an open row closes it (overlay).
  - parent-driven open state (`openSongId` in Playlist.js) so LegendList `recycleItems` can't leave a stale-open row.
- `Playlist.js`: local `addQueue` / `playNext` / `removeFromPlaylist` handlers mirroring `OptionsSongsList`
  (addToQueue/addToUpNext if `song.queue` exists else playSong; remove via `updatePlaylist songIndexToRemove`).
- i18n: add missing `Remove from playlist` key to en/de (already used by OptionsSongsList, fell back to raw string).

## Steps
1. Create `PlaylistSwipeRow.js` — DONE
2. Wire into `Playlist.js` renderItem + handlers — DONE
3. i18n keys — DONE
4. eslint + build + install on R5CY71GYKWF — pending
5. Manual test: swipe right enqueues, swipe left shows buttons, remove + play next work, scroll/tap unaffected — pending

## Skipped / notes
- Only Playlist screen gets swipes (SongItem is shared; keep it untouched).
- Reveal actions are icons+text on tinted backgrounds (remove=red, play next=primaryTouch).
