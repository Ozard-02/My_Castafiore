# Shuffle: physically reorder the queue (TODO #13)

## Goal
Today shuffle (`actionEndOfSong = 'random'`) uses a hidden `randomIndex` permutation —
playback jumps randomly but the visible queue stays in original order.

Desired:
1. Shuffle OFF → queue plays in original order
2. Shuffle ON → queue array is randomly reordered (visual + playback follow shuffle)
3. Shuffle OFF again → queue restores to original order
4. Re-press while ON → new random reorder (from the preserved original order)

## Approach
Physical reorder. On activation, preserve `originalQueue` in state, `shuffle()` the queue
array, remap the current song's index by id. On deactivate, restore `originalQueue`.
On re-press (already random), re-shuffle from the preserved `originalQueue`.

## Changes
- `app/contexts/song/provider.js`
  - Add `originalQueue: null` to `defaultSong`; drop `randomIndex`.
  - `setActionEndOfSong`: 'random' → preserve original + shuffle (id-based index remap);
    leaving 'random' → restore original order. Both persist.
  - `addToQueue` / `moveUpNextToQueue` mirror append to `originalQueue`;
    `removeFromQueue` / `moveQueueToUpNext` mirror remove by id (so added/removed songs
    survive the shuffle toggle). Moves within a list only affect the shuffled queue
    (shuffle-off restores the natural order — the whole point of #3).
  - `restore` / `syncGlobal`: carry `originalQueue`. Legacy data with shuffle ON but no
    `originalQueue` falls back to the current queue (old data never reordered it).
- `app/utils/tools.js`: delete `currentRandomIndex`/`nextRandomIndex`/`prevRandomIndex`.
- `app/utils/player.native.js` + `app/utils/player.web.js`:
  `nextSong`/`previousSong` drop the random branch; in random mode the queue is already
  shuffled so it advances sequentially and always wraps (preserves "shuffle never stops").
- Docs: TODO #13, STRUCTURE.md, .log.

## Verification
- Jest-less (RN app): manual — toggle shuffle, check queue view order + playback follow it;
  toggle off, order restored; re-press, new order. Track add/remove while shuffled survives.

## Skipped
- Smart shuffle (artist-aware, no consecutive same-artist) — future, listed in TODO.
