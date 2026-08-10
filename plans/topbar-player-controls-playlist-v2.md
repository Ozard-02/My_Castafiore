# Plan: Status Bar Background, Player Controls Position, Playlist Improvements v2

Status: TODO → IN PROGRESS
Related TODO: #11, #12, #10

## Overview
Three related UI improvements:
1. Status bar background (constant top bar)
2. Mobile player controls position (shift down from center)
3. Playlist improvements (searchbar, sort, remove, delete — NO swipe yet)

## TODO #11: Status Bar Background

### Current state
- `Navigation.js:25` uses `<SystemBars style={theme.barStyle} />` from `react-native-edge-to-edge`
- `SystemBars` only supports `style` and `hidden` props (no `backgroundColor`)
- Status bar background is transparent (edge-to-edge mode)
- Screens with `contentMainContainer(insets, false)` have `paddingTop: 0` → content scrolls behind status bar icons

### Implementation
- Add `useSafeAreaInsets` import to `Navigation.js`
- Add a fixed `View` with `height: insets.top`, `backgroundColor: theme.primaryBack`, `width: '100%'`, `position: 'absolute'`, `top: 0` in `Navigation.js`
- This provides a constant background behind status bar icons for ALL screens
- No need to touch individual screens

## TODO #12: Player Controls Position

### Current state
- `FullScreenPlayer.js:366` `playerContainer` style: `justifyContent: 'center'`, `height: '100%'`, `flex: 1`
- Content (cover, title, timebar, play buttons, action buttons) is vertically centered
- Action buttons (lyrics, repeat, cast, shuffle, queue) end up in the middle of screen — too high

### Implementation
- Add `paddingTop` to `playerContainer` style to shift centered content downward
- Keep `justifyContent: 'center'` so content remains centered but lower
- Value: `paddingTop: 80` (adjustable, puts buttons in lower-middle)
- Affects mobile `FullScreenPlayer.js` only; desktop `FullScreenHorizontalPlayer.js` already uses flex layout with controls at bottom

## TODO #10: Playlist Improvements (v2 — no swipe)

### Current state (verified in code)
- `Playlist.js`: `LegendList` of `SongItem`s, no search/sort UI
- `OptionsSongsList.removeFromPlaylist()` (line 124): already calls `getApi('updatePlaylist', { songIndexToRemove })`
- `OptionsPlaylist.js`: no "Delete" option (deletePlaylist API used in `OptionsPlaylists.js:23`)
- `useTranslation` + `useSafeAreaInsets` already imported in `Playlist.js`

### Implementation (no swipe gestures in this batch)

#### 1. Searchbar on top of playlist
- Add `searchQuery` state in `Playlist.js`
- Add `View` with `TextInput` above the `LegendList` (or in header area)
- Filter `songs` by title/artist (case-insensitive) as user types
- Pass filtered `songs` to `LegendList` and `OptionsSongsList`

#### 2. Sort playlist (client-side)
- Add `sortPlaylist` to `defaultSettings` in `settings.js` (null = use playlist order)
- Add sort selector button in the header (icon button)
- Sort options: title, artist, album, duration, track number
- Sort applied to filtered songs before rendering
- Persisted in settings via `useSetSettings`

#### 3. Remove from playlist (context menu — already exists)
- `OptionsSongsList.removeFromPlaylist` already works
- No new code needed, just verify it's wired correctly

#### 4. Delete playlist
- Add "Delete" option in `OptionsPlaylist.js` with red `trash` icon
- Use `confirmAlert` from `~/utils/alert.js` for confirmation
- Call `getApi(config, 'deletePlaylist', { id: playlist.id })`
- On success: `onRefresh()` + `onClose()` → navigate back if on Playlist screen

#### 5. i18n
- Check existing keys: `Search` (likely exists), `Sort`, `Delete`, `Delete playlist` may exist
- Add any missing keys to `en.json` and `de.json`

## Steps (combined)
1. `Navigation.js`: Add status bar background View + import `useSafeAreaInsets`
2. `FullScreenPlayer.js`: Add `paddingTop` to `playerContainer` style
3. `Playlist.js`: Add searchbar + sort selector + filter/sort logic
4. `OptionsPlaylist.js`: Add "Delete" option with confirmation
5. i18n: Add/check translation keys
6. eslint + rebuild APK + install + smoke test

## Files to modify
- `app/components/Navigation.js`
- `app/components/player/FullScreenPlayer.js`
- `app/screens/Pres/Playlist.js`
- `app/components/options/OptionsPlaylist.js`
- `app/i18next/translations/en.json` (if needed)
- `app/i18next/translations/de.json` (if needed)

## Shipped
- (none yet)
