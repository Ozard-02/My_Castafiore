# Castafiore Roadmap & Planned Features

## Planned Features

1. **Different Queue Management** ✅ done
   - Add queue reordering via drag-and-drop
   - Show queue as a modal/list with move-to-top, move-to-bottom, remove options
   - Separate "up next" queue from the full playback queue
	 - Shuffle should  act only on actual queue not up next
   - ✅ Done: new persisted `upNext` array in the song reducer. "Play next" inserts at the front of
     "up next" (`addToUpNext(atStart=true)`); "Add to queue" still appends to the main queue.
     `nextSong` drains up next first (shuffle/repeat/random never touch it). Tapping a queue song
     or starting a new queue clears up next. Auto-advance syncs through the local player
     (`PlaybackActiveTrackChanged` → new `syncGlobal` reducer case) and end-of-queue stop checks
     (servicePlayback/cast/upnp) skip stopping while up next is non-empty.
   - QUEUE view (full-screen + desktop) splits into an "Up next" section + the main queue.
   - Reordering: drag-and-drop via a grab handle (`QueueDrag`, PanResponder + Animated, edge
     autoscroll, scroll-compensated) plus Move to top/up/down/bottom + remove in the long-press
     menu (`OptionsQueue`, new `OptionsUpNext`).
   - Queue view polish (follow-up): pinned "Now playing" row on top of both sections — and the current
     song is **removed from the queue list** (it only lives in the pinned section; display-level filter,
     queue stays the source of truth). Drag-and-drop works **across** the Up next ↔ Queue sections and
     reacts dynamically (sibling rows spring open a live gap, lifted row stays visible — no elevation,
     just a background tint; drop targets are resolved from each list's `onLayout` box + the gesture dy,
     no window-coordinate measurement). Drop → `moveTrack` → same-list `moveUpNext`/`moveInQueue` or
     cross-list `moveUpNextToQueue`/`moveQueueToUpNext` (current song can't be dropped into Up next).
     Shared drag state lives in `app/utils/useQueueDnD.js`. See `plans/queue-dnd.md`.
   - Plan: `plans/queue-management.md`.
   - **DnD autoscroll direction was inverted** ✅ done: `QueueDrag.js:62-67` scrolled DOWN near the top
     edge and UP near the bottom edge. Fixed by negating the two `scroll` signs (top edge → negative/UP,
     bottom edge → positive/DOWN).
2. **Whole Album Play Next** ✅ done
   - Add "Play next" option for entire albums (queue all album tracks after current song)
   - Add to context menu on Album screens and album-level options

3. **Swipe When Minimized** ✅ done
   - Enable swipe gestures on the mini player (BoxPlayer/BoxDesktopPlayer) to dismiss or expand
   - Enable swipe gestures (left/right) to navigate btw songs
   - ✅ Done: `PanResponder` + `Animated` (repo idiom) on `BoxPlayer`: horizontal swipe =
     next/previous song, vertical swipe-up expands the full player. Moves claim the responder
     only past a 6px threshold, so taps on expand/play/next still work. `song`/`config` are read
     via refs in the responder so repeated gestures keep advancing (the first version captured the
     initial song and froze after one skip). Swipe-down dismiss + restore bubble were removed
     (user request). Desktop `BoxDesktopPlayer` swipe skipped (its seek/volume `SlideBar`
     PanResponders conflict; YAGNI).

4. **Better Download Management**
   - Dedicated Downloads screen in settings: list cached songs, pause/resume, remove individually or in bulk
   - Show download progress in player/queue UI
	 - Select download quality
   - ⏳ **In progress**: Spotify-style downloads (substreamer inspo) — status banner (DownloadBanner)
     tap → Downloads detail screen (Settings/Downloads) with live speed, per-collection downloads
     that can be removed individually (delete one playlist, keep an album), pause/resume/cancel,
     persistence per server via AsyncStorage.
      - ✅ Done: `downloadManager.native.js` (queue engine, DownloadResumable pause/resume that
        survives restarts, rolling speed tracker, collection/index persistence, `useDownloads`),
        `downloadManager.web.js` stub, `DownloadButton` (ring/percent/done states),
        `DownloadBanner` in TabBar, `Settings/Downloads` screen + stack registration + Settings row,
        `Download` option replacing "Cache all songs" in OptionsAlbum/Playlist/Favorited, per-song
        Download action in OptionsSongsList + state icon in SongItem, player `downloadSong`/
        `downloadNextSong` routed through the manager, i18n en/de.
      - ✅ Done 2026-08-10 (18th session):
        - **Silent caching**: cache-ahead `downloadNextSong` enqueues with `silent: true`; the
          `DownloadBanner` and per-song progress/clock indicators in `SongItem` skip silent items,
          so auto-caching runs invisibly (manual downloads still animate). `getSongState` maps
          silent items to done/none.
        - **Long-queue performance**: `queueById` (id→item) map rebuilt once in `setState` makes
          `getSongState`/`onProgress`/`moveToQueue` O(1) (was O(n) per call — brutal with ~1000
          queued items); `Settings/Downloads` now renders active downloads with a virtualized
          `LegendList` (only visible rows mounted) instead of `.map()`-ing all rows in a ScrollView
          (header/footer hold the static sections).
        - **Parallel downloads**: single-slot `isProcessing` boolean → `activeDownloads` counter;
          `startNext()` fills up to N concurrent slots. N = new `parallelDownloads` setting
          (default 3) under Downloads → Song caching (integer input beside "Cache next song"),
          wired via `global.parallelDownloads`; pause/cancel/clear release slots correctly.
        - **Shared-song semantics** (documented, no change): songs in 2+ downloaded collections
          accumulate `sources` on their index entry; `removeSource` deletes the file only when
          sources drop to `[]`, so removing one playlist keeps the song for the other. Known edge
          case (deferred): removing a collection while a shared song is still queued cancels that
          queue item and the surviving collection won't re-download it.
      - Deferred (documented): drag-reorder in queue, true headless background download,
        per-collection quality selector (reuses global streamFormat/maxBitRate).

5. **Local WiFi Management** ✅ done
   - I can already insert more than onw server, nut i have to swhich manually, i want this to be network specific, not just wifi/data but select a spsecific wifi network and it will switch automatically
   - ✅ Done: optional "Network" per server in AddServer (type a WiFi SSID or tap a chip: current
     SSID first, then previously used networks, plus a "Cellular data" chip). "Use current network"
     switch fills the field with the connected SSID (requests location permission on first use).
     App auto-switches to the matching server on launch / on network change — a server bound to
     `Cellular data` is matched whenever on mobile data — and returns to the last manually-used
     server when you leave the bound network (WiFi or cellular).
     `@react-native-community/netinfo` added (expo-network removed — its `getWifiSsid()` was deleted
     in v7). Permissions `ACCESS_WIFI_STATE`+`ACCESS_FINE_LOCATION` added manually (do NOT prebuild).
     See `plans/local-wifi-management.md`, `plans/cellular-network-binding.md`.
   - Known ceiling: current-SSID detection on Android 10+ needs location permission/services;
     manual name + history always work.

6. **Lyrics Background** ✅ done
   - when showing lyrics use album art as background but with some transparency blur effect

7. **Search Grid (not list)** ✅ done
   - Add grid view option for search results (artists, albums, songs)
   - Toggle between list and grid view for search results

8. **Tracks Tab (5th bottom bar element)** ✅ done
   - Add a fifth element "Tracks" to the bottom bar. Pressing it opens a page with all tracks.
   - On top of that page: buttons to switch between **Songs / Albums / Artists** views.
   - In each view, a toggle between **grid** and **list** layout.
    - Remove the Favorited/Favorites section from the Playlists tab.
      - ↩ **Reverted 2026-08-09**: Favorited section re-added to the Playlists tab, **below**
        "My Playlists" (not above the header). Favorited row + preview list restored
        (`getStarred2`, `previewFavorited`, `SongsList`).

9. **Virtualized grid** ✅ done
   - Grid view (Tracks tab, SearchMore, ShowAll) is a non-virtualized `flexWrap` ScrollView —
     all items stay mounted. Fine while pagination keeps each grid ~100 items/page, but slow
     on huge native lists (e.g. the full artist list).
   - ✅ Done: all six grids converted to `LegendList numColumns={2}` (SongExplorer, AlbumExplorer,
     ArtistExplorer, SearchMore, Playlists tab, ShowAll.web), pagination via `onEndReached`,
     headers/selectors moved into `ListHeaderComponent`. `AllItem` root is now `width:'100%'`
     (+`paddingHorizontal:10`) to fill its numColumns cell. `onEndReached`/`estimatedItemSize`
     are already the list-mode pattern, so nothing new was added.

   ### Plan
   - **A. Navigation** — `app/components/Navigation.js`: add `TracksStack` tab
     (`title: 'Tracks'`, icon `music`) between Search and Playlists. `BottomBar`/`SideBar`
     render routes dynamically, so the 5th item appears automatically.
   - **B. Stack** — `app/screens/Stacks.js`: new `TracksStack` = `Tracks` screen +
     shared Pres screens (Album, Artist, ArtistAlbums, Genre, GenreAlbum, GenreSong, Info, Songs, EditPlaylist).
   - **C. New screen** — `app/screens/tabs/Tracks.js`: header title "Tracks", a
     `Selector` with Songs / Albums / Artists, a list/grid toggle icon (same pattern as
     SearchMore), and the matching Explorer screen embedded below (conditional render).
   - **D. Grid support in Explorers** — `SongExplorer`, `AlbumExplorer`, `ArtistExplorer`:
     add `layout` state ('list'|'grid') + toggle in the header; grid reuses `AllItem` in a
     flexWrap container (native 2-col, web auto-fill), same as SearchMore. Accept optional
     `title`/embed props so Tracks can override the header. ArtistExplorer letter sidebar
     only shows in list mode.
   - **E. Remove Favorites from Playlists tab** — `app/screens/tabs/Playlists.js`: drop the
     Favorited header + preview `SongsList` block and the `getStarred2` fetch/refresh; remove
     unused imports (`SongsList`). Keep the `Favorited` screen itself (still reachable from
     the desktop SideBar). `previewFavorited` setting becomes unused → remove later.
   - **F. i18n** — add `tabs.Tracks` to locale JSONs (at least en).
   - **G. Docs** — update STRUCTURE.md (Navigation, Stacks, Tracks screen, Explorer grid
     toggle) and `.log`.

   ### Decisions
   - Tab order: Home, Search, **Tracks**, Playlists, Settings. ✅ decided
   - Tab icon: `music` (FontAwesome).
   - Grid support also appears in the standalone Explorer screens (reachable from Search) —
     free, since the toggle lives in the Explorers themselves.

10. **Playlist Improvements** ⏳ in progress (searchbar, sort, remove, delete done — swipe to review/redo another day)
    - ✅ Searchbar on top of playlist: local filter (client-side, live update) in `Playlist.js`. Filters by title/artist.
    - ✅ Sort playlist: client-side sort (title, artist, album, duration, track) via sort popup; persisted in `settings.sortPlaylist`.
    - ✅ Remove from playlist: already existed in `OptionsSongsList.removeFromPlaylist` (calls `updatePlaylist` with `songIndexToRemove`); no change needed — wired correctly.
    - ✅ Swipe gestures on song rows: `PlaylistSwipeRow.js` (PanResponder + Animated, repo idiom) — swipe **right** enqueues, swipe **left** reveals "Remove from playlist" + "Play next" buttons. Open state is parent-driven (`openSongId`) so LegendList row recycling can't leave a stale-open row. Handlers mirror `OptionsSongsList`. Plan: `plans/playlist-swipe.md`.
    - ✅ Delete playlist: "Delete" option added to `OptionsPlaylist` → `deletePlaylist` API + `confirmAlert`.
    - ✅ Searchbar moved above the playlist cover (overlay, semi-transparent `rgba(0,0,0,0.45)`) — cover stays visible behind it; sort icon sits in the same bar.
    - ✅ Searchbar is fixed on screen while scrolling: moved out of the `LegendList` header into a sibling overlay (`position:absolute`, `zIndex:3`), so it stays pinned while the cover/songs scroll underneath.
    - ✅ Fixed crash opening a playlist: `styles.searchInput(theme)` was called but `searchInput` was never defined in the StyleSheet → `TypeError: undefined is not a function` on the Playlist screen. Added the style.

11. **Status Bar Background** ✅ done
    - Added a fixed `View` with `height: insets.top` + `backgroundColor: theme.primaryBack` at the top
      of Home, Playlists, and Settings tabs. Content scrolls below the status bar with a constant
      background — no bleed-through behind data/time/battery icons.
    - Applied at the tab level (not globally in Navigation.js) so Pres screens (Album, Artist, etc.)
      keep their full-bleed cover image design.

12. **Player Controls Position** ✅ done
    - `FullScreenPlayer.js` `playerContainer`: changed `justifyContent: 'center'` → `'space-between'`
      + `paddingBottom: 20`. Cover/title at top, buttons in lower third (not pressed on bottom).
      Desktop `FullScreenHorizontalPlayer.js` unchanged (already bottom-aligned via flex gap).

13. **Shuffle Behavior** ✅ done
    - Current: shuffle (`actionEndOfSong = 'random'`) uses a hidden `randomIndex` mapping — playback
      jumps randomly but the queue list stays in original order. User wants the queue visually +
      functionally reordered when shuffle is on.
    - Desired behavior:
      1. Shuffle OFF → queue plays in original order
      2. Shuffle ON → queue array is randomly reordered (visual + playback follow shuffle)
      3. Shuffle OFF again → queue restores to original order
      4. Re-press while ON → new random reorder (from the preserved original order)
    - ✅ Done: shuffle physically reorders `song.queue` via `shuffle()`; the preserved original order
      lives in a new persisted `song.originalQueue`. `setActionEndOfSong('random')` saves the original
      on first activation and re-shuffles from it on re-press (button = toggle OFF→ON). Leaving
      `random` restores `originalQueue` and remaps the current song's index by id. `nextSong`/
      `previousSong` dropped the random branch — the queue is already shuffled, so they advance
      sequentially (removed `randomIndex`/`nextRandomIndex`/`prevRandomIndex` from `tools.js`).
      Add/remove/move mutations while shuffled keep `originalQueue` in sync by id (added/removed songs
      survive the toggle). Up-next is never touched by shuffle (already the case).
    - Foundation for future "smart shuffle" (artist-aware, no consecutive same-artist tracks).

14. **Seamless Server Switching** ✅ done
    - **Requirement (user)**: during a server switch (e.g. leaving the bound WiFi → auto-switch via #5),
      playback must NOT stop. The same song/playlist/album keeps reproducing seamlessly from the new server.
    - **What was killing playback**: `NetworkAutoSwitch.switchTo()` called `Player.resetAudio(songDispatch)`
      → `songReducer 'reset'` wiped queue/songInfo AND `TrackPlayer.reset()` stopped audio.
    - **Fix**: new `Player.switchServer(config)` on all players (local/cast/upnp/web): saves
      position+isPlaying, reloads the current song via `loadSong(newConfig, song.queue, song.index)`
      (URLs re-derived against the new server), restores position, resumes. `switchTo` and the manual
      `Connect`/`AddServer` `upConfig` now call `switchServer` instead of `resetAudio` — queue stays,
      audio keeps playing. Works because servers share the same library → song IDs match.
    - **Decided**: servers share the same library → reload-by-id is enough; no cross-server id mapping.
      Skipped queue-source tracking + title/artist re-resolution (YAGNI; add only if servers diverge).
      Plan: `plans/seamless-server-switch.md`.
    - **Follow-up — reuse the song cache for instant resume** ✅ done:
      - Problem: after a switch, if the *new* server is slow there was still a pause (playback restarts
        the track from the new server and waits on its buffer).
      - Fix: the song is already cached on the device as it plays. Song cache was **per-server**
        (`cache/<sanitizedUrl>/songs/`) → after a switch `isSongCached()` returned false. Now a single
        shared `cache/songs/` folder (`cache.native.js`), with `initCacheSong()` consolidating old
        per-server folders. Servers share the same library → ids match → cached file is reused
        instantly on switch (`convertToTrack` already prefers the local file).
      - Also: download queue/index/collections AsyncStorage keys were per-server (`folderCache`) →
        **unified 2026-08-10** to shared `downloadQueue`/`downloadIndex`/`downloadCollections` keys
        (song files already shared → the downloaded-list changing on server switch was a bug; legacy
        per-server data merged in `initDownloads`).
    - **Follow-up 2 — kill the remaining switch pause** ✅ done:
      - User: "it still stops for a second, i want something really seamless."
      - Root causes in `playerLocal.switchServer`: (a) it called `loadSong` (= `TrackPlayer.load` +
        **play**) then `setPosition` — the track audibly restarted from 0 and jumped to the saved
        position (the perceived 1s stop); (b) it reloaded even when the current track was already
        playing from a server-independent cached file.
      - Fix: return early (no player touch) when the active track already plays from `getPathSong`;
        otherwise load from the shared cache if available and **seek BEFORE play**, then play/pause.
      - Constraint (honest): TrackPlayer is a single engine — `load()` tears down + rebuilds it, so a
        mid-song source swap can't be truly gapless. Now: 0 gap when already on cache, ~0.2-0.3s
        otherwise (local file, no restart-from-0 artifact). A zero-gap swap would need a preemptive
        "swap to cache when the current song finishes downloading" (small hiccup early in each streamed
        song) — NOT shipped; offer if still audible.

15. **Improve the gapless experience** 🚧 WANTED (user priority)
    - User: "i want something really seamless" — the ~0.2-0.3s reload blip on a server switch (TODO #14)
      is still audible and should go to zero.
    - Single-engine TrackPlayer constraint: `load()` = teardown + rebuild, so a mid-song source swap
      can't be gapless today. Options to explore:
      - Preemptive swap: as soon as the current song finishes downloading (during its playback), reload
        it from the local cache so a later server switch is a complete no-op. Cost: one small hiccup
        ~15-30s into each streamed song (may be worse UX than a switch-time blip).
      - Load the current track from the cache from the start when it's already downloaded
        (convertToTrack already does this) → zero gap for previously-downloaded songs.
      - Investigate gapless/crossfade support in react-native-track-player / ExoPlayer (two instances,
        `setQueue`, buffer-ahead, or `audioSession` tuning) and whether Android allows a true
        crossfade between two sources.
      - Reconsider download-before-play for the current song (wait for the cache instead of streaming)
        and its start-delay trade-off.
    - Plan: `plans/gapless-experience.md` (to create).

16. **UI Consistency Pass** ❌ reverted (user: "it's ugly")
    - Goal: unify look & behavior across screens. Findings from a UI-wide review:
    - **Navigation pattern mix**: `useNavigation()` hook (Home.js, Playlist.js, BackButton.js) vs `navigation` prop (`tabs/Playlists.js`, `Album.js`). Pick one (hook) and use it everywhere.
      - ✅ Done: all screens converted to `useNavigation()` hook (`tabs/Playlists`, `tabs/Settings`, `Pres/Album`, `Pres/Artist`, `Pres/ArtistAlbums`, `Settings/Connect`, `Settings/AddServer`, `ShowAll` native+web, `UpdateRadio`, `DownloadBanner`). Navigators' render-props (`TabBar`/`SideBar`/`BottomBar`) keep the prop.
    - **Search/input styles differ (3 looks)**: (a) Tracks tab inline search — `secondaryBack`, radius 10, absolute search icon with fragile padding/lineHeight; (b) Playlist overlay search — `rgba(0,0,0,0.45)` + white text (Playlist.js:181-209); (c) Playlists tab new-playlist name — gray `borderWidth:1, borderRadius:6` (tabs/Playlists.js:101-110). Extract one shared search-input style.
      - ✅ Done: shared `mainStyles.searchBox(theme)` + `mainStyles.searchInput(theme)` in `styles/main.js`. Tracks inline search and the Playlists new-playlist name now use them (leading search icon inline, no absolute positioning). The Playlist overlay search stays distinct — it sits over cover art.
    - **Hardcoded colors break light themes**: BackButton chevron `#fff`, PresHeaderIcon cover `#c68588` + icon `#cd1921`, Playlist searchbar white-on-dark text/icons. White overlay text is invisible on `soundCloud`/`lightMode`. Make these theme-aware (or a dark overlay that persists in light themes).
      - ✅ Done: `PresHeaderIcon` cover → `theme.secondaryBack`, icon → `theme.primaryTouch`. `BackButton` keeps the white chevron (over full-bleed cover art) but gains a dark text-shadow halo so it reads in every theme.
    - **Grid/list toggle**: same icons (`list`/`th-large`) but hardcoded `size 22` (Tracks.js) vs `size.icon.small` 23 (tabs/Playlists.js). Use `size.icon.small` in both.
      - ✅ Done.
    - **"Explore" entry points look different**: SearchResults explorer boxes (flex:1, `secondaryBack`, radius 10) vs Tracks `Selector` pills (radius 20, `primaryTouch`). Both navigate to the same Explorer screens — pick one visual idiom.
      - ✅ Done (user decision: **pills over boxes**): SearchResults explorer boxes restyled as pills (radius 20, `secondaryBack`, compact padding) matching the Selector idiom.
    - **"Selected" affordance differs**: Selector pill background, SelectItem checkmark, OptionsPopup sort check. Decide a single selection idiom.
      - ✅ Done (user decision: **check icon everywhere**): Selector now also renders a leading check icon on the selected pill (matches SelectItem/OptionsPopup).
    - **Status-bar handling**: Home/Playlists/Settings use a fixed `<View height: insets.top>`; Tracks uses `paddingTop` (scrolls away). Make consistent.
      - ✅ Done: Tracks now uses the fixed status-bar `<View>` pattern.
    - **Tab header/title margins**: `mainTitle` (margin 20/30) is overridden (`marginTop/Bottom:0`) in the Playlists header and `flex:1` in Tracks. Standardize.
      - ✅ Reviewed: both render the same 20/30 rhythm already (Playlists zeroes mainTitle margins inside its own header row; Tracks uses `flex:1` in its own row) — no code change needed.
    - **Magic offsets**: Playlist searchbar `top: insets.top + 55`, BoxPlayer bottom `+ 59`. Tokenize against the BackButton/player positions.
      - ⏳ Skipped: they anchor to different elements (cover-header buttons vs mini-player), tokenizing adds indirection with no visual gain. Revisit if a shared header component emerges.
    - Plan: `plans/ui-consistency.md`.

17. **Queue top part is misleading** ✅ done
    - Problem: when a song is selected in the middle of a playlist, the queue view is scrolled to the
      next song but all the *previous* playlist songs (before the current) are still shown above it —
      the current song should be at the top and the previous songs rolled to the bottom.
    - Spec (user): current song stays pinned at the top; the songs before it are **rolled to the
      bottom** (wrapped around), so the list starts at the current song and continues in playback order.
    - ✅ Done: `useQueueDnD.queueItems` is now the queue *rotated* to start at the current song —
      `[...queue.slice(index+1), ...queue.slice(0, index)]` when the current song is in the queue
      (`song.queue` stays the source of truth; this is display-level like the current-song pin).
      `queueRealIndex`/`displayToReal` use `(index + 1 + i) % queue.length` so taps and DnD move
      targets resolve to real queue indices. Scroll-to-index (both players + the hook's effect)
      targets 0 (top) instead of `song.index`. `isCurrentInQueue === false` (radio/up-next playback)
      leaves the list untouched.
      - 🔧 Crash fix 2026-08-09: playing a **single song** yields an empty rotated `queueItems`
        (`[...queue.slice(1), ...]` = `[]`) while `isCurrentInQueue` stays true → `scrollToIndex({index:0})`
        fired on an empty FlatList → `Invariant Violation: scrollToIndex out of range`. Guarded all three
        `scrollToIndex` call sites (`useQueueDnD.js` effect, both players' `onLayout`) with `queueItems.length > 0`.

18. **When the queue finishes, smart-choose the next song** 🚧 WANTED
    - Today the queue just stops at the end (or repeats, depending on `repeatQueue`). User wants the
      player to keep going by intelligently picking the next song when the queue runs out.
    - Ideas to explore (ask user which they want):
      - Similar songs (Subsonic `getSimilarSongs`) seeded from the last played song / current queue.
      - A defined "autoplay" rule: random songs from the library, same genre/artist/album, or continue
        from the last artist/album.
      - Only act when `repeatQueue`/`repeat` are OFF and the queue is exhausted (don't fight repeat).
    - Likely touches: `nextSong` in the player backends (local/cast/upnp/web), `songReducer`
      end-of-queue handling, `Settings` toggle + i18n. Plan: `plans/autoplay-next.md` (to create).

19. **Avoid duplicate song insertions in a playlist** ✅ done
    - When adding songs to a playlist, skip songs that are already present (no double insertions).
    - ✅ Done: new `addSongToPlaylist(config, playlist, songId)` in `app/utils/api.js` fetches the
      playlist's current songs (`getPlaylist` → `entry`) and returns `false` (no `updatePlaylist`
      call) if the song id is already there. Used by the three add-to-playlist actions
      (`OptionsSongsList`, `OptionsPlayer`, `OptionsQueue`). Silently skips — the popup just closes.

20. **Playlist Swipe — fix + customizable** 🚧 WANTED
    - Broken on device: swiping a playlist row shows only black / does nothing. Likely causes:
      no visual feedback during drag (action buttons only mount when `open===true`, so during the
      drag you see bare background) and the gesture gate (`|dx|>8 && |dx|>|dy|*1.2`) losing to
      LegendList scroll. Fix progressive reveal of actions DURING the drag first.
    - Then make it customizable: both directions (left + right) configurable in Settings.
      Actions: Queue / Play next / Remove from playlist / None (extensible).
    - Same behavior in the Music (Tracks) tab list view for songs AND albums (albums: queue/next
      only — no remove), including after a search.

21. **Playlist searchbar placement** 🚧 WANTED
    - Searchbox currently sits under the back button and the ⋮ icon; squeeze it between them on
      the same row: `[←] [searchbox flex] [⋮]`.

22. **Negative playlists** 🚧 WANTED
    - Playlists marked "exclusive": their songs are excluded from the Home random-shuffle button,
      reachable ONLY through the playlist itself (playing the playlist stays untouched; a song in
      both a negative and a normal playlist stays excluded but playable from both).
    - Server-side flag via playlist comment tag `#<username>-exclusive` (same mechanism as the
      pins, `#<username>-pin` — Subsonic standard, Navidrome-compatible).
    - Toggle "Exclude from shuffle" in `OptionsPlaylist`; new `app/utils/exclusions.js` holding the
      excluded-song-ID set per server (memory cache + AsyncStorage snapshot); filter applied in
      `Home.js clickRandomSong`.
    - Skipped (agreed): album-level home sections, browse/search hiding, Genre.js random (one line
      with the same helper if wanted later).

23. **Z Flip 7 cover screen UI** 🚧 WANTED
    - On the cover display (~720×948) the bottom icons get smashed up (full-screen player control
      row + bottom tab bar). Adaptive compact layout via `useWindowDimensions`: smaller sizes,
      labels hidden when too narrow. Iterate on device.

24. **Icon consistency pass** 🚧 WANTED
    - "Play next" icon differs between option menus (song popup vs album popup use different glyphs)
      — unify everywhere.
    - Album header: heart + shuffle on one row, download cloud wrapped alone to the next line —
      align all three on one row.

25. **Mini player (pill) polish** 🚧 WANTED
    - Vertical wobble while swiping horizontally: BoxPlayer applies `dy` to translateY regardless of
      gesture direction — axis-lock after intent detection.
    - Snappier return animation (shorten existing timing; do NOT introduce springs where none exist).
    - Song-change transition on the pill: outgoing/incoming slide — next song enters from the right,
      previous returns from the left.

---

## Build & Release (local APK)

Release APK output:
- `android/app/build/outputs/apk/release/app-release.apk` (22MB, arm64-v8a, signed with `debug.keystore` → directly installable)

Rebuild after editing code (JS is bundled inside the gradle build):
```bash
cd android
JAVA_HOME=/usr/lib/jvm/java-17-openjdk ./gradlew :app:assembleRelease
# clean rebuild if stale:  ./gradlew clean :app:assembleRelease
# debug (faster dev):      ./gradlew :app:assembleDebug
```

Install to device (USB debugging on):
```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

### Gotchas (things `expo prebuild` wipes / ignores)
- `reactNativeArchitectures` in `gradle.properties` is **ignored** on old-arch (`newArchEnabled=false`). ABI filtering must be set explicitly in `android/app/build.gradle`: `ndk { abiFilters 'arm64-v8a' }`.
- `android/app/build.gradle` edits (abiFilters) and `android/gradle.properties` knobs (proguard/shrink) are **regenerated/deleted** by `expo prebuild --clean`. Re-apply them after a fresh prebuild.
- `android/local.properties` (`sdk.dir=/home/espo/Android`) can be wiped by `prebuild --clean`. Recreate it.
- Root `react-native.config.js` (fixes `expo.core.ExpoModulesPackage` compile error) survives prebuild.

### Known fixed bug
- `expo.core.ExpoModulesPackage` compile error in generated `PackageList.java` → fixed via project-level `react-native.config.js` dependency override (expo's own config fails to load under pnpm nested resolution, so the autolinker falls back to the gradle namespace path). Do not delete this file.

### For real Play Store distribution (later)
- Generate a real keystore and use a signed release config (current release uses `signingConfigs.debug`).
