# Player gestures + move cast to Home (deferred)

Written 2026-09-28 as a punt list, at the user's request. Nothing implemented yet — the
current player still has the lyrics / cast / queue button row.

Four related changes. They share one piece of work (the whole bottom row disappears), so
they should ship together.

---

## 1. Remove the lyrics button — tap the album cover instead

**Now:** a `comment-o` `IconButton` in the bottom row toggles `preview.LYRICS` ↔ `preview.COVER`.
The cover itself is wrapped in `SlideControl` (`FullScreenPlayer.js:62-68`), whose
PanResponder claims the touch on `onStartShouldSetPanResponder: () => true` and already
consumes taps:

- horizontal drag > 50px → next / previous track
- `position._value === 0` (i.e. a tap) → **double-tap within 300ms toggles play/pause**
  (`SlideControl.js` `previousTap` ref)

So a single tap on the cover is currently swallowed and does nothing. This is the whole
design problem: **the arbitration between "tap = lyrics" and "double-tap = play/pause" has
to be decided, and `SlideControl` has to be changed to forward the tap** rather than only
acting on the double-tap branch.

Options:
- (a) single tap → toggle lyrics, keep double-tap → play/pause. Both live in the same
  PanResponder, so the 300ms window has to suppress the lyrics toggle when a second tap
  arrives. Feels responsive but risks a stray lyrics flash on a slow double-tap.
- (b) single tap → toggle lyrics, **drop the double-tap play/pause** (play/pause is already
  on the transport row, and on the mini player). Simplest, no timing race. Loses the
  double-tap-cover-to-pause affordance.
- (c) keep double-tap as-is and put lyrics on a *long* press or a double-tap-with-cover-
  highlight. Least discoverable.

Recommendation: (b). One gesture per intent, no 300ms arbitration, and it removes a
duplicate control rather than adding a hidden one.

**Also:** when lyrics are showing, tapping the cover must bring the cover back
(`preview.LYRICS` → `preview.COVER`). Straightforward, but note the lyrics view is rendered
with `style={albumImage}` (a fixed square) — check it still looks right with the cover gone.

## 2. Remove the queue button — swipe up from the bottom instead

**Now:** a `bars` `IconButton` toggles `preview.QUEUE` ↔ `preview.COVER`. The queue renders
inside `coverSlot` (which has the `coverSlotTop` top-aligned variant so the list fills from
the top — added in #35).

Wanted: a swipe from the bottom of the player upward opens the queue, and it should feel
fluid.

Design points to settle:
- **Where the gesture lives.** It must not fight the `MiniPlayer` pan responder, which already
  uses vertical swipe-up to expand the mini player into the full screen. Inside the full
  screen the gesture can be its own `PanResponder` on the lower region, or added to the
  existing one.
- **Threshold + direction.** Only upward, from the bottom ~25% of the screen. Decide the
  trigger distance and whether it needs velocity as well as distance (velocity feels better;
  distance alone is more forgiving).
- **It has to animate.** The requirement is "fluid and pleasant", so the queue should slide
  up into `coverSlot` rather than snap. The cover can scale/fade out as the queue comes in
  (the cover is a fixed square, so a scale-down is available for free). Use the same
  `Animated.timing` idiom the rest of the app uses, or a `Spring` for the overshoot.
- **Dismissal.** Swipe down to close, or tap outside? The queue is inside a `Modal` whose
  scrim is already pressable in other sheets, so this may be free — but the full-screen player
  is itself a `Modal` with no scrim, so a dismiss gesture has to be built.
- `preview` is a single 3-value enum. Two independent gestures writing the same field is
  workable, but consider whether it should become explicit state (`showLyrics`, `showQueue`)
  so a gesture can't produce a contradictory combination.

## 3. Remove the cast button from the player

`ConnectButton` is the middle of the bottom row. Removing it is trivial once #1 and #2 land,
since the whole row goes away.

Check nothing else depends on it: `OptionsPlayer` has its own entries, and `RemoteProvider`
drives the actual connection, so this is display-only.

## 4. Move cast to Home, top-right, left of the refresh button

`Home.js:87-113` top-right is a row containing, in order:

1. the ListenBrainz `bell-o` button — **only when `settings.listenBrainzUser` is set**
2. either a `N°` scan-status text (`statusRefresh`) **or** the `refresh` `RotateIconButton`
   (`onPress: forceRefresh`, `onLongPress: refreshServer`)

So the cast button goes between the bell and the status/refresh item. Two things to handle:

- **The refresh button is conditional.** When a scan is running, the text replaces the button,
  so the cast button has to sit outside that ternary (as its own sibling) or it will jump
  around as scans start and stop.
- `ConnectButton` is platform-split (`.native.js` / a `.web.js` no-op) and both variants
  export the same component, so importing it into `Home.js` — a shared, non-platform file —
  is fine.

Decision needed: should the cast button appear on **every tab** or just Home? The request says
Home, so: Home only. Worth confirming, because a user in the Music tab has no visible way to
reach the cast picker.

---

## Bonus: this gives back vertical space

The bottom row is `marginTop: 21` plus ~45px of row height. Deleting it returns roughly 66px
(~2.6% of a 2520px screen) to the cluster — which is the opposite direction from the three
passes in TODO #35, where the cluster was grown from 452px to 562px to fill the space. After
these changes the cover will have noticeably more room again, so the spacing values tuned in
#35 (title `marginTop: 26`, seek bar `17`, transport `compact ? 21 : 27`, `paddingBottom: 30`)
should be re-measured rather than assumed. Same screenshot row-analysis method as #35.

## Notes / risks

- `Player.js` closes the full-screen player on `state.index` change, but that `state` is the
  **navigation tab** state, not the song index, so queue/lyrics gestures don't trip it.
- The cover is width-capped at `width - 50` (361dp on a 411x960dp screen), so it occupies only
  ~37% of the height. With the bottom row gone that imbalance gets worse; a scale animation
  for the queue partly hides it, but a larger cover cap may be worth revisiting.
- Gestures replacing visible controls reduces discoverability. If a control comes back later,
  the gestures should stay as shortcuts rather than being reverted.

## Verify

- Single tap on the cover toggles lyrics on and off; no stray double-tap play/pause.
- Horizontal cover drag still skips tracks.
- Swipe up from the bottom opens the queue with animation; swipe down / tap outside dismisses.
- Mini player swipe-up still expands to the full screen (no gesture conflict).
- Cast reachable from Home top-right, left of refresh, in both the normal and scan-running
  states; the button does not jump when a scan starts.
- Re-measure the cluster/cover split by screenshot after the row is gone.

---

## Shipped 2026-09-29 — commit `beccb47`

Decisions taken, all confirmed on device (`R5CY71GYKWF`, 411x960dp):

| Question | Answer | Why |
|---|---|---|
| Lyrics gesture | single tap on the cover | one gesture per intent, no 300ms arbitration; play/pause already on the transport row and the mini player |
| Way back from lyrics | `picture-o` in the top bar, shown only while lyrics are up | the lyrics pane is a FlatList whose rows seek on tap, so it cannot also be the tap target — a `Pressable` wrapper loses to the deeper row |
| Queue animation | 1:1 finger tracking, whole-window overlay | `translateY` starts one window-height below the viewport; no cover scale/fade, since the cover is no longer swapped out |
| Queue dismissal | header drag-down 1:1, plus X, plus back | the full-screen player is a Modal with no scrim, so there is nothing to tap outside of |
| Where the swipe starts | anywhere in the window; the empty band under the buttons is a real strip | see the platform findings below |
| Cast placement | Home only, sibling of the refresh control | as asked; one place beats four copies. Accepted: no cast picker from the Music tab |
| Deleted row's height | into `playerContainer`'s `paddingBottom` (30 → 82) | keeps the cluster exactly where #35 measured it; the freed space goes to the cover |

### Platform findings (cost the most time — do not rediscover)

1. **`PanResponder` fills `x0`/`y0` only at grant time** (`PanResponder.js:471`); they are
   initialised to `0` at line 299 and stay `0` through the whole should-set phase. A move-phase
   handler testing `g.y0` is really testing `0 > something`. Use `g.moveY`.
2. **`onMoveShouldSetResponder` on an ancestor loses.** The pressable under the finger wins the
   responder at touch-START, so the parent is never consulted again and the gesture silently does
   nothing. `onMoveShouldSetResponderCapture` is asked first; taps still fall through because it
   only fires once a real move happens.
3. **A prop-less `View` is collapsed out of the native hierarchy on Android.** A touch landing on
   plain empty space therefore never enters the responder system and delivers **no MOVE events at
   all** — verified by logging touch coordinates: swipes at y≈600 and y≈898 produced a DOWN and
   nothing more, while swipes on buttons and the title worked. This is the single reason the
   gesture felt like it needed "button precision". Fixed with a `neverTake`
   `onStartShouldSetResponder` on the containers, plus a dedicated drag strip in the empty band
   under the transport row that claims on DOWN (safe: nothing interactive is beneath it).
4. **Android's bottom-edge back gesture is consumed by the platform** before any PanResponder
   sees it. It arrived as `Modal.onRequestClose` (confirmed with a stack trace) and closed the
   entire player. `onRequestClose` now dismisses by layer order: queue → lyrics → player.
5. The `SlideControl` conflict anticipated above did not materialise — the queue is a sibling
   overlay, not a view inside the cover slot, so the two no longer share a responder.

### Not done / deferred

- The deferred plan items this file was originally written for (see the top of the file) remain
  open.
- No visual affordance for the drag strip: it is invisible. A grabber bar would help discovery
  and is a small follow-up.
- The queue sheet's close drag is header-only. Dragging down on the list body scrolls the list
  instead; a scroll-aware hand-off (close when the list is at scroll top) is the standard
  bottom-sheet behaviour and is not implemented.
