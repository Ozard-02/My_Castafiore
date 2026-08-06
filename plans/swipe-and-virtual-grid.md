# Plan: Swipe When Minimized (TODO #2) + Virtualized grid

Status: DONE
Related TODO: #2 (Swipe When Minimized), #9 (Virtualized grid)

## A. Swipe When Minimized
User wants gestures on the mini player: dismiss or expand, swipe left/right to change songs.

Research findings:
- Mini player = `app/components/player/BoxPlayer.js` (mobile) / `BoxDesktopPlayer.js` (desktop), rendered by
  `app/components/player/Player.js` which owns the local `fullScreen` state. Mini player tap → fullscreen.
- No gesture-handler/reanimated installed; codebase idiom = RN core `PanResponder` + `Animated`
  (see `SlideControl.js`). Follow that.
- Android track-player shows a media notification, so "dismiss" (hiding the mini player) is recoverable.

Decisions:
- BoxPlayer: PanResponder that only claims the responder ON MOVE (threshold ~6px) so taps still reach the
  inner Pressable (expand) and IconButton/PlayButton. On release: horizontal |dx|>|dy| → dx<-60 next /
  dx>60 previous; vertical dy<-60 → expand (setFullScreen(true)).
  Bar translates vertically while dragging (Animated, translateY clamped ±90).
- **Late change (user request)**: the swipe-down dismiss + `BoxPlayerBubble` restore were REMOVED.
  Vertical swipe now only expands; horizontal swipe = next/prev.
- **Late fix**: the responder must read `song`/`config` from refs (`songRef`/`configRef`) updated each
  render, not from the initial render's closure — otherwise the first gesture advances the index but the
  stale closure sets the same index again ("stuck on the same song"). The responder is created once via
  `useRef`, so closures are captured at mount.
- Desktop `BoxDesktopPlayer` SKIPPED for swipe: full-width bar with seek/volume SlideBars whose
  PanResponders conflict with a wrapping horizontal swipe (YAGNI; easy to add later).

## B. Virtualized grid (LegendList numColumns={2})
Replace the 6 non-virtualized `ScrollView + flexWrap` grids (all `AllItem`):
SongExplorer, AlbumExplorer, ArtistExplorer, SearchMore (native grids) + Playlists.js grid + ShowAll.web.js.

Research findings:
- `@legendapp/list` already installed and used for all list modes. Supports `numColumns`.
- LegendList numColumns cells are **absolutely positioned** with `width: 1/numColumns%` — so `AllItem`'s
  hardcoded `width: '50%'` must become `width: '100%'` (fill the cell). `mainStyles.contentMainContainer`
  has NO horizontal padding, so the tile inset comes from item padding (`paddingHorizontal: 10` → 10px
  edge inset, 20px between columns).
- `AllItem` is used ONLY in these 6 grids (verified) — safe to change its root width.
- Grid pagination (Explorers + SearchMore) switches from the ScrollView `onScroll` handler to
  `LegendList onEndReached` (already the pattern in list mode). ArtistExplorer has no pagination.
- Mirror list-mode conventions: `waitForInitialLayout={false}`, `recycleItems={true}`,
  `estimatedItemSize≈230` (square cover = (width/2)-20 ≈ 180 + text ≈ 230), and a `minHeight`
  `Math.ceil(n/2)*230 + headerH` content-container hack.
- `ShowAll.web.js`: convert to LegendList too (its native twin already uses LegendList). The old
  "FlatList glitched" comment applies to RN FlatList, not LegendList.

## Steps
1. AllItem root `width: '50%'` → `width: '100%'`, `paddingHorizontal: 10`. — DONE
2. BoxPlayer swipe (PanResponder + Animated translateY). — DONE
3. ~~BoxPlayerBubble.js (new) + Player.js `isHidden`/bubble/onDismiss wiring.~~ REMOVED (user request).
   Bubble deleted, dismiss branch dropped; vertical swipe now only expands.
4. SongExplorer grid → LegendList numColumns=2. — DONE
5. AlbumExplorer grid → LegendList numColumns=2. — DONE
6. ArtistExplorer grid → LegendList numColumns=2. — DONE
7. SearchMore grid → LegendList numColumns=2. — DONE
8. Playlists grid → LegendList numColumns=2 (header as ListHeaderComponent). — DONE
9. ShowAll.web grid → LegendList numColumns=2. — DONE
10. eslint + rebuild + install on R5CY71GYKWF. — DONE
11. Docs (.log, TODO #2/#9, plans). — DONE
12. Commit + push. — TODO

## Skipped
- Desktop mini-player swipe (conflicts with seek/volume slide bars).
- Horizontal swipe on the fullscreen cover (already exists via SlideControl).
