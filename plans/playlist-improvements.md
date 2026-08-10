# Plan: Playlist Improvements — searchbar, sort, swipe gestures, delete

Status: DONE (partial — swipe gestures deferred)
Related TODO: #10, #11, #12

## Problem

Playlist detail screen (`app/screens/Pres/Playlist.js`) lacks:
1. A search bar to filter songs within the playlist
2. Sort options to reorder the displayed song list
3. Swipe gestures on song rows for quick actions (play next, add to queue, remove)
4. A "Delete" option in the playlist context menu

## Research findings (verified in code)

- **Playlist screen** (`Playlist.js`): fetches via `useCachedAndApi('getPlaylist')`, renders `LegendList` of `SongItem`s. `SongsList` component is NOT used here — `SongItem` is used directly.
- **Remove from playlist**: `OptionsSongsList.removeFromPlaylist` (line 124) already calls `getApi(config, 'updatePlaylist', { playlistId, songIndexToRemove })`. Already wired into the long-press context menu.
- **Delete playlist**: `OptionsPlaylists.js` (line 23) already calls `getApi(config, 'deletePlaylist', { id })`. NOT surfaced in `OptionsPlaylist.js` (the per-playlist context menu shown on the detail screen).
- **Swipe gesture idiom**: codebase uses `PanResponder` + `Animated` (see `BoxPlayer.js`, `QueueDrag.js`). `react-native-gesture-handler` is NOT installed.
- **SongItem** (`SongItem.js`): supports `setIndexOptions`, `onPress`, `onLongPress`, optional `handle` prop. Currently no swipe support.
- **OptionsSongsList** (line 10-11): `addToQueue` and `playNext` functions exist — can be reused for swipe actions.
- **Settings**: `settings.reversePlaylist` already persisted in AsyncStorage; sort choice can follow same pattern.

## Decisions

- Searchbar: local filter only (client-side, live update). No server search.
- Sort: client-side display reorder only (doesn't change server playlist order). Persisted in settings.
- Swipe: swipe-left on SongItem reveals icon buttons. PanResponder + Animated (no new deps).
- Delete: confirmation dialog via existing `confirmAlert` utility.

## Steps

1. **Searchbar on top of playlist** (`Playlist.js`) ✅ done
   - Added `searchQuery` state; `TextInput` with search icon above `LegendList` in `ListHeaderComponent`
   - `filteredSortedSongs` memo filters by title/artist (case-insensitive, live on each keystroke)

2. **Sort playlist** (`Playlist.js` + settings) ✅ done
   - Added `sortPlaylist: null` to `defaultSettings` in `settings.js`
   - Sort icon button → `OptionsPopup` with 6 options: Default, Title, Artist, Album, Duration, Track
   - `filteredSortedSongs` memo sorts client-side; choice persisted in `settings.sortPlaylist`

3. **Swipe gestures on song rows** DEFERRED
   - No `react-native-gesture-handler`; needs custom `PanResponder` + `Animated` wrapper around `SongItem`
   - Planned actions: Play next, Add to queue, Remove from playlist (swipe left reveals icons)

4. **Delete playlist** (`OptionsPlaylist.js` + `Playlist.js`) ✅ done
   - Added "Delete" option (trash icon) → `confirmAlert` → `deletePlaylist` API
   - `Playlist.js` passes `onDelete={() => navigation.goBack()}` to navigate back after delete

5. **i18n**: added en/de keys ✅ done — Sort, Sort by title/artist/album/duration/track, Default, Search in playlist, Are you sure…

6. **Verify**: eslint clean. APK rebuild pending.

## Shipped
- Searchbar (client-side, live filter)
- Sort (6 options, persisted in settings)
- Delete playlist (with confirmation dialog)
- Status bar background (Navigation.js, global)
- Player controls position (FullScreenPlayer.js, space-between + paddingBottom)

## Skipped/Deferred
- Swipe gestures on playlist song rows (no gesture-handler lib; needs custom PanResponder)
- Playlist sort does NOT sync back to the server (client-side display only)
