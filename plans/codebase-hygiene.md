# Codebase hygiene pass (audit leftovers)

## Context
The `.log` audit listed: Explorer `usePagedList` (~350), Options factories (~250),
SideBar/BottomBar duplication (~85), plus "needs on-device verify" TODO items.

## Findings (audit, read-only first)
- **`usePagedList` no longer exists** — the virtualized-grid/LegendList refactor already
  removed it. Song/Album/Artist explorers are self-contained (138-203 lines). Pagination
  logic duplicated twice (~35 lines) but small; left as-is (YAGNI, extraction would be
  net-neutral indirection).
- **Options "factories"** — the repeated "Go to artist"/"Add to playlist" virtual-option
  blocks across Options*.js are ~15-20 presentational lines each; a shared helper adds
  abstraction for no real win. Left as-is. Removed one dead commented-out block in
  `OptionsSongsList.js`.
- **SideBar/BottomBar duplication** — REAL. Identical color/focus memos + tabPress emit
  logic in both bars, plus a hooks-inside-`.map()` anti-pattern in SideBar.

## Shipped
- New `app/utils/useTabItem.js`: shared tab-button hook (options/isFocused/color/onPress/
  onLongPress/disabled) used by both bars.
- `BottomBar.js`: TabItem now consumes the hook (was inlined + duplicated).
- `SideBar.js`: inline map body extracted to `SideBarItem` component using the hook —
  fixes the hooks-in-map anti-pattern.
- Dead code: removed commented `albumArtists` filter in OptionsSongsList; unused
  `titleSelector` style in SongExplorer.
- eslint clean. Net ~50 lines removed. Build pending.

## Skipped
- Explorer pagination/extraction, Options factory abstraction (YAGNI).
- The 9 "needs on-device verify" TODO items are a manual verification pass, not code.