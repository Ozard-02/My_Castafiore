# Castafiore Roadmap & Planned Features

## Planned Features

### Mood mixes (daily / weekly) ✅ done
- Two optional Home sections, `mood-daily` and `mood-weekly`; each renders five generated
  mixes of 50 tracks.
- Themes come from a 16-entry catalog (`chill`, `energy`, `focus`, `party`, `melancholy`,
  `romantic`, `workout`, `sleep`, `acoustic`, `electronic`, `throwback`, `discovery`,
  `upbeat`, `ambient`, `jazz`, `rock`) and are chosen randomly when the group expires
  (local day for daily, ISO week for weekly).
- One shared `getRandomSongs(size=500)` pool per server; seeded shuffle keeps a mix stable
  inside its period. Cached in AsyncStorage per server + group.
- Settings only exposes the two group toggles/order rows; no per-theme controls.
- Each mix is one square card (cover mosaic + theme + count) in a horizontal row, like
  the genre section; tapping opens the normal song list with the 50 tracks.
- Offline: both sections are absent. Plan/details: `plans/mood-mixes.md`.
- ✅ Implemented 2026-10-25. `npm run eslint` and `expo export -p web` pass; not yet
  device-tested.

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

20. **Playlist Swipe — fix + customizable** ✅ done (2026-08-23, needs on-device verify)
    - ✅ Fix: action layers always mounted behind an opaque row, revealed by the drag itself
      (before: mounted only when open → black background, zero feedback). Gesture gate relaxed
      (dx>5, 1:1 dominance) to win vs LegendList scroll; gesture handlers resolve actions from a
      ref at event time (LegendList row recycling fired stale closures).
    - ✅ Customizable: Settings > Playlists > "Swipe right"/"Swipe left" (queue / play next /
      remove / none). `PlaylistSwipeRow` is generic (onQueue/onNext/onRemove) and reads
      `settings.swipeRightAction`/`swipeLeftAction`.
    - ✅ Revised (user): NO action panel — both directions are direct hint actions
      (defaults: right=queue, left=play next; "Remove" only via long-press menu or settings).
      Legacy persisted 'menu' value maps to 'next'.
    - ✅ Wired into Music tab list view (SongExplorer songs, AlbumExplorer albums via
      `utils/albumActions.js` — whole-album queue/next, no remove) and SearchMore list (song+album).
    - ⚠️ Gesture feel + Tracks/search swipe to verify on device.
    - Broken on device: swiping a playlist row shows only black / does nothing. Likely causes:
      no visual feedback during drag (action buttons only mount when `open===true`, so during the
      drag you see bare background) and the gesture gate (`|dx|>8 && |dx|>|dy|*1.2`) losing to
      LegendList scroll. Fix progressive reveal of actions DURING the drag first.
    - Then make it customizable: both directions (left + right) configurable in Settings.
      Actions: Queue / Play next / Remove from playlist / None (extensible).
    - Same behavior in the Music (Tracks) tab list view for songs AND albums (albums: queue/next
      only — no remove), including after a search.

21. **Playlist searchbar placement** ✅ done (2026-08-23)
    - ✅ Searchbox now on the back-button row: `[←] [search flex] [⋮]` (same 63dp row height,
      inset by 63 on both sides). Still fixed while scrolling (sibling overlay).
    - Searchbox currently sits under the back button and the ⋮ icon; squeeze it between them on
      the same row: `[←] [searchbox flex] [⋮]`.

22. **Negative playlists** ✅ done (2026-08-23, needs on-device verify)
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

23. **Z Flip 7 cover screen UI** ✅ done (2026-08-23, needs on-device verify)
    - ✅ Adaptive `compact` mode (width<420 or height<700): FullScreenPlayer cover capped by
      height (`min(width-50, 450, max(140, height-340))`), smaller transport icons/gaps, slimmer
      header/favorite padding; BottomBar compact icons+labels below 420dp.
    - On the cover display (~720×948) the bottom icons get smashed up (full-screen player control
      row + bottom tab bar). Adaptive compact layout via `useWindowDimensions`: smaller sizes,
      labels hidden when too narrow. Iterate on device.

24. **Icon consistency pass** ✅ done (2026-08-23)
    - ✅ "Play next" unified to `play-circle` (song popup + swipe hints/panel; album popups
      already used it).
    - ✅ Album header alignment: `presStyles.button` centers content now — DownloadButton centered
      while heart/shuffle sat at top of tall title rows (the misalignment in screenshots).
    - "Play next" icon differs between option menus (song popup vs album popup use different glyphs)
      — unify everywhere.
    - Album header: heart + shuffle on one row, download cloud wrapped alone to the next line —
      align all three on one row.

25. **Mini player (pill) polish** ✅ done (2026-08-23, needs on-device verify)
    - ✅ Axis lock: first 10px of a drag decide x vs y; horizontal swipes no longer move the pill
      vertically.
    - ✅ Return animation 200→120ms (timing kept — no springs introduced).
    - ✅ Song change: pill content slides in from the right (next) / left (previous), 160ms.
    - Vertical wobble while swiping horizontally: BoxPlayer applies `dy` to translateY regardless of
      gesture direction — axis-lock after intent detection.
    - Snappier return animation (shorten existing timing; do NOT introduce springs where none exist).
    - Song-change transition on the pill: outgoing/incoming slide — next song enters from the right,
      previous returns from the left.
    - ✅ Swipe-down dismiss now also stops playback (`Player.stopSong()`, 2026-08-23).

26. **Pill: play/pause only + gestures** ✅ done (2026-08-23, needs on-device verify)
    - ✅ Removed the "next track" button from the pill; play/pause + swipe gestures remain.
    - ✅ Button row (left→right): cast (ConnectButton), favourite (FavoritedButton, guarded on
      song id, starred from `songInfo.starred`), play/pause — i.e. right-to-left:
      playpause, favourite, cast as requested (Spotify ref).

27. **Player UI overhaul** ⏳ done 2026-08-23, needs on-device verify
    - Full-screen player (Spotify refs ~/Pictures/castafiore/): big **Lyrics card** between
      transport and bottom row fills the free vertical space (`flex:1`, cap 160) and toggles
      the existing full lyrics view (label Lyrics ↔ Hide lyrics); small `comment-o` icon
      removed from the bottom row (now repeat/cast/random/queue). Play button enlarged
      (icon 54, box 70×66), transport margins tightened. NO share button (explicit).
    - Pill: see #26.
    - Skipped: scroll-with-resistance lyrics reveal (card button covers it — revisit if it
      feels wrong on device). Desktop horizontal player untouched.
    - Plan: `plans/player-ui.md`.

28. **Endless shuffle radio + exclusion refresh** ✅ done 2026-08-24, needs on-device verify
    - Home random button leaked excluded songs: NOT a parsing bug (`comment.includes(tag)`
      matches `Auto-imported from 'BL34J1.m3u8'#esplor02-exclusive` fine) — the excluded-id
      cache only refreshed on manual in-app toggle, so m3u8 re-syncs/server edits leaked.
      Fix: `clickRandomSong` awaits `refreshExcludedSongIds` before filtering.
    - Random sessions no longer stop at end of queue: new persisted `song.radioMode` flag set
      by every shuffle entry point (Home random button, RandomButton [Favorited/Album/Playlist],
      Genre.js, Artist.js). Cleared by any normal playback (setQueue) / reset; survives restore.
      When queue+up next are drained and `!repeatQueue`, `nextSong` (playerCore) fetches
      `getRandomSongs size=50`, filters exclusions, dedupes against current queue ids, appends
      via addToQueue and advances reading fresh `global.song.queue`. End-of-queue stop branches
      in servicePlayback + playerCast + playerUpnp now fall through to nextSong when radioMode.
    - Uniform top-up: always library-wide randoms (genre/artist-aware refill skipped — would
      need serializable fetchers). Player shuffle toggle (`actionEndOfSong`) untouched.
    - Plan: `plans/endless-shuffle.md`.

---

29. **Next/prev loops on the same song (icons & Bluetooth, not swipe)** ✅ done 2026-08-28, needs on-device verify
    - Symptom: pressing next/prev (full-screen transport / notification / Bluetooth) sometimes
      plays the same song from the start 3-5× before advancing. Swipe gestures never do.
    - Root cause: KISS refactor `d8ffc98` made `playerCore.setIndex` dispatch `setIndex` only
      AFTER `await loadSong(...)` (native was fire-and-forget + immediate dispatch before). During
      the load window `global.song.index` is stale → any re-trigger (natural `PlaybackQueueEnded`
      near song end, Bluetooth double event, fast double-tap) issues a second `load()` of the same
      track → restarts until the deferred dispatch lands.
    - Trigers (same root defect): (1) natural-end collision, (2) double-invocation of the skip,
      (3) repeat-ON `setPosition(0)+resume` during the window (benign, left as-is).
    - Fix: dedupe concurrent loads of the same track id in `setIndex` via `loadingKey`
      (try/finally cleared) — a repeat request only syncs state. Covers local/cast/upnp/web since
      all auto-advance routes funnel through this one `setIndex`. Plan: `plans/fix-next-prev-looping.md`.

30. **Radio loops same 50 + exclusions never filter** ✅ done 2026-08-28, needs on-device verify
    - Radio loop: `repeatQueue` defaults ON (`settings.js:109`) and `nextSong` gated the radio top-up
      on `!repeatQueue` → queue wrapped at the end instead of extending. Fix: at the last index,
      `radioMode` always extends (repeatQueue ignored); non-radio keeps stop/wrap behavior.
      Plan: `plans/radio-loop-exclusions.md`.
    - Exclusions dead since `cf9f526`: `exclusions.js` keyed everything on `config.folderCache`,
      but `useConfig()` returns the stored config which has no `folderCache` (only `global.config`
      does) → every guard early-returned an empty set → `filterExcluded` never ran. Fix: key on
      `config.url` (storage key, memory key, guards, invalidate). No migration needed (nothing
      was ever written); hidden tags re-derive on next Home random press.

31. **Playback correctness + inconsistency sweep** ✅ done 2026-09-26, needs on-device verify
    Report: background problems, songs looping, cover not updating, playlists looping.
    Plan: `plans/playback-correctness.md`. Baseline commit `ba8b982`.
    - **Queue-row double play** (mobile only): `SongItem`'s `onPress` return value decided
      whether it *also* called `playSong`, and `FullScreenPlayer`'s queue rows returned a
      Promise (always truthy) → one tap issued `setIndex` **and** `playSong`: two `load()`s of
      the same track (song restarts from 0) plus a `setQueue` that wiped `upNext`,
      `originalQueue` and `radioMode` and reset `actionEndOfSong` to `next`. Replaced the
      truthiness contract with an explicit `playsOnPress` prop; desktop was never affected
      (`QueueRow` is a plain `Pressable`).
    - **Radio top-up prepended instead of appending**: `extendRadio` dispatched `addToQueue`
      with no `index`, and the reducer only guarded `index === null`, so `splice(undefined)`
      coerced to 0 — every 50-track top-up rebuilt the queue at the FRONT in reverse order and
      left `index` pointing at a different track. Guard is now `typeof index !== 'number'`.
      Also deduped within the fetched page (getRandomSongs repeats ids → the same song played
      back-to-back).
    - **Wrong cover after resume**: up-next playback (`nextUpNext`) moves `songInfo` without
      moving `index`, so `reconcileState` could not map the active track into the queue
      (`findIndex === -1`) and returned without dispatching — the UI kept the previous song's
      title/cover. It now trusts the native track and heals the pointer. `useQueueDnD` anchors
      the queue rotation on where `songInfo` actually sits instead of on the stale `index`.
    - **Up next disappeared on every navigation**: `setIndex` wiped `upNext` unconditionally, so
      a plain next/previous, a drag, or a resume-reconcile deleted the whole list. It is now
      cleared only on an explicit queue-row jump (`clearUpNext`, `clearRadio`).
    - **`repeatQueue` default → false** (user decision). Playback now stops at the end of a
      queue unless repeat is on. A failed radio top-up no longer silently wraps (that was the
      "playlist loops" report) — it stops. App swipe-away still stops playback and removes the
      notification (user decision, now an explicit commented choice).
    - **Repeat-one race**: `actionEndOfSong` was cleared *after* `await setIndex(...)`, so a
      natural `PlaybackQueueEnded` in the load window seeked the freshly loaded track back to 0
      and could re-enter `ENDED`. Cleared before the load now (logged as "benign, left as-is" on
      2026-08-28 — it wasn't benign).
    - **Repeat-one was dead on Chromecast/UPnP**: both seeked to 0 without resuming, so the
      track stopped instead of looping. Both now seek + resume.
    - **End-of-track decision consolidated**: it was written out 5× (service, cast, upnp, web,
      playerCore) and had drifted — cast/upnp seek-without-play, no stop branch at all on web,
      and the end-of-queue predicate duplicated with and without the radio/up-next guards. New
      `endOfTrackAction()` in `playerCore` is the single decision; mechanics stay per backend.
      Shared `scrobbleTrack()` and `stopAtQueueEnd()` alongside it.
    - **Dead play button at the end of a queue**: `isSongLoad` stayed true, so pressing play
      called `resumeSong()` on an already-ENDED track. New `song.queueEnded` flag → play
      restarts the queue from the top. Also fixed a missing `else` in `PlayButton.onPress` that
      ran `resumeSong()` right after `playSong()`.
    - **Background**: `initPlayer` no longer returns before dispatching `init` when
      `setupPlayer` fails headless, and `SongProvider` retries on every foreground instead of
      removing its AppState listener after one attempt (one early failure left the player
      un-setup and disabled resume reconcile for the whole session). Dropped
      `alwaysPauseOnInterruption: true`, which made the `RemoteDuck` handler dead code and left
      playback paused forever after any notification. `progressUpdateEventInterval: -1` → `1`
      (it had disabled the Android notification's progress bar/scrubber).
    - **`convertState` divergence**: `playerLocal` had no `State.Loading`/`Connecting` branch
      (fell through to `Stopped`, so no loading spinner), and `playerCast` used `playerState`'s
      `State.Stopped` (`'stopped'`) as a GoogleCast lookup key — not a key of its table, so it
      resolved to `undefined` and the reducer dropped it (no error icon on Chromecast).
    - **Reducer/UI consistency**: `addToQueue`/`addToUpNext` now run `convertTrack` (the queue
      mixed raw-API and converted shapes, and every reducer action re-serialized the lot to
      AsyncStorage); `convertTrack` keeps `isLiveStream` (the downloader was trying to cache
      live radio streams and the seek bar showed a finite duration for them) plus
      `albumArtists`/`discNumber`; `setRating` also writes `starred` so queue-row hearts update.
    - **Hooks**: `updateGlobalSettings()` called seven `useEffect`s from a plain async function
      during render — moved into `SettingsProvider` as real effects.
    - **Lists**: index `keyExtractor`s replaced with occurrence-aware keys (`id` + duplicate
      counter, exposed as `queueKeys`/`upNextKeys`) in both queue views, `Lyric`, `Favorited`
      and `Playlist` — index keys made rows carry the previous occupant's download icon after a
      rotation, search or sort.
    - **`Lyric`**: dep is now `song.songInfo?.id` (it was the object, so every `setRating`/
      `syncGlobal` re-triggered the fetch and flashed "Loading lyrics..."), plus a
      cancellation guard so a late response can't paint the previous track's lyrics, and an
      empty-`syncedLyrics` fallback to "No lyrics found" (it rendered a blank pane).
    - **Misc**: `servicePlayback` no longer dereferences `global.song.queue` unguarded (a cold
      headless start threw and took the scrobble with it); `TimeBar` deps include the track;
      `ImageError` normalises a nullish `source`; `saveQueue` caps the id list (a 1000-track
      radio queue built a multi-KB URL that servers reject); `RemoteProvider` no longer
      transfers without a queue (it called `playSong(config, dispatch, null, 0)` → TypeError)
      and reads the live `global.song` instead of a stale React snapshot;
      `playerUpnp.disconnect(device)` no longer shadows the module-level `device`.
    - Deferred: `Player.updateTime()` still runs all three backends' hooks (2 `useProgress(500)`
      pollers + an always-on UPnP progress listener) because switching the set by device type
      would change the hook count per component; `useCachedFirst` still has no in-flight `uid`
      guard; no `eslint-plugin-react-hooks` install (would flag ~20 pre-existing call sites).
    - `npm run eslint` clean; release APK builds (Metro bundle resolves).

32. **Radio as a continuous sampler (not 50-track batches)** ✅ done 2026-09-26, needs on-device verify
    Report: "it plays the same 50 songs in loop, I do not want a 50 songs selection plus at the end
    a new 50 songs selection, more a continuous sampling".
    - Root cause: the top-up only ran once the last track ENDED, so the fetch happened in the gap
      between batches (audible dead pause = the "chunked" feel), and a failed top-up fell through to
      `(index+1) % length`, replaying the same 50 in the same order. Compounded by `repeatQueue`
      being stored as `true` on existing installs (see #31: changing a default never reaches a
      stored value), so the wrap was always taken.
    - `playerCore`: `RADIO_LOW_WATER=10` — the queue is topped up while tracks are still playing,
      never in the gap. Batch 20 (fallback page 100) is a refill cadence, not a unit. A shared
      `radioPending` promise means the low-water kick-off and the end-of-queue safety net await the
      same fetch, so the stream never stops just because a refill started seconds earlier.
    - **A radio session never wraps**, whatever `repeatQueue` says: `endOfTrackAction` returns
      'next' for `radioMode`, and an exhausted pool stops rather than replaying a batch.
    - Exhausted pool (small library / mostly excluded) → sample again from the whole allowed set,
      **reshuffled**. Repeats are fine for a sampler; replaying one batch in order is not.
    - `#<user>-exclusive` playlists are filtered out of every sampling path — the unseen pool AND
      the repeat fallback. No excluded track can reach a shuffle session.
    - Growth cap without index maths: past `RADIO_MAX_QUEUE=200` the session restarts on a fresh
      pool via `setQueue` (`keepUpNext: true` so a pending Up-next survives). Much cheaper than
      trimming played tracks off the head, which would mean re-deriving `song.index`, the queue
      rotation and every drag-and-drop index.
    - Visibility: a **Radio** badge next to the shuffle button (tap to end the session) and an
      "End radio" entry in the player options. `radioMode` was previously invisible, which is why
      an endless session read as a bug.
    - Collection shuffles no longer start a radio: `RandomButton` (Album/Playlist/Favorited),
      `Artist.js` and `Genre.js` just play their collection and stop. They used to set `radioMode`,
      so shuffling a 12-track album silently continued into endless library-wide randoms.
    - Queue cap → new `song.queueEnded` flag is what makes the play button restart the queue.

33. **Download/cache identity across the two server addresses** ✅ done 2026-09-26, needs on-device verify
    Both configured servers are the same library behind two addresses (LAN + public), and
    `NetworkAutoSwitch` flips between them automatically on a network change.
    - Mismatch 1 — **bitrate was not part of the cache identity**. Filenames were `${id}.${format}`
      while the URL carried `maxBitRate`, so a 128k transcode kept answering a 320k request forever.
      New `songCacheKey(id, format, bitRate)` adds the bitrate suffix — **but only when
      `format !== 'raw'`**, because `urlStream` returns a plain `stream?id=X` for 'raw' and the
      bitrate changes nothing about the file. Keying on it for raw would re-download the whole
      library byte-for-byte on every slider move. 'raw' is the default, so the common case keeps
      today's exact filenames: no migration, no re-download.
    - Mismatch 2 — **no provenance**. `buildMeta` now records `server: global.config.url`, and
      `finishSuccess` stores it on the index entry, so a cross-server file is visible instead of
      silent. Deliberately does NOT invalidate: same library means interchangeable bytes, and
      re-fetching on every WiFi/cellular change would burn the data plan.
    - Mismatch 3 — **the mid-flight switch**. `songUrl` baked `global.config` at enqueue, so queued
      items kept pointing at the old address. `initDownloads` (already re-run on every config
      change) now re-points `queued`/`paused` items. In-flight items keep their URL — the bytes are
      still valid and cancelling would discard a partial download for nothing.
    - `meta.cover` is a full URL baked at enqueue, so after a switch it pointed at the LAN host and
      404'd off the house wifi. `coverForCurrentServer(meta, config)` re-points the host at render
      (no re-download); also exported from the web stub so the screen builds there.
    - `partUri` is now derived in `runDownload` instead of at enqueue, so a format/bitrate change
      mid-queue can't leave an orphan `.part` plus a `moveAsync` to a stale name.
    - `initCacheSong` prunes files that don't match the `songCacheKey` shape (old `.part` leftovers
      and pre-bitrate names). Removed the dead `global.config.folderCache` (`config.js` assigned it,
      nothing read it).
    - `maxBitRate` threaded through all 8 `getPathSong` call sites; every `isSongCached` caller was
      already passing it — the parameter existed and was ignored.
    - Verified with a 15-assertion node harness over the verbatim `songCacheKey` /
      `coverForCurrentServer` / orphan rules (the release APK isn't debuggable, so the cache can't be
      read from the CLI): raw+bitrate is unchanged, mp3 128 vs 320 differ, a 128 file does not
      answer a 320 query, `.part` is pruned, cover host swaps and legacy entries don't crash.
    - **Not done, flagged:** `NetworkAutoSwitch` still flips servers mid-song, and the current track
      is deliberately left playing to the end (it is cached or already streaming) rather than being
      interrupted and reloaded. Ask the user if they want it to cut over.

34. **Multi-select "Add to playlist" sheet** ✅ done 2026-09-28, needs on-device verify
    Replaces the flat single-select playlist list with a real membership editor. Plan:
    `plans/playlist-membership-select.md`.
    - Per-playlist circle: empty = not selected, filled + check = selected. Playlists that
      already contain the song(s) start filled, and **deselecting one REMOVES them** — the
      model is bidirectional, not just "add".
    - A partially-containing playlist shows an **empty circle** (user decision) and is left
      untouched unless tapped, which then adds only the missing songs. So a playlist holding
      9 of an album's 27 songs is never damaged by inaction.
    - **Done** button pinned at the bottom, always enabled — with nothing changed it just
      closes with no API traffic. Applies every selection in one pass, closes the sheet and
      returns to the page it was opened from. Removals get a `confirmAlert` naming the
      playlists; adds do not. Partial failure is reported as a count, with **no rollback**
      (a rollback would be a second destructive pass nobody asked for).
    - All five entry points rewired: `OptionsPlayer`, `OptionsSongsList`, `OptionsQueue`,
      `OptionsAlbum`, `OptionsAlbums`.
    - `updatePlaylistEntries` (new, `app/utils/api.js`): Subsonic removes by **0-based index**,
      and every removal shifts the entries after it down by one, so removals MUST go
      highest-index-first — ascending silently deletes the wrong songs. The helper re-fetches
      immediately before applying (another client editing the playlist would leave the indices
      stale), adds first (appending can't shift an index), then removes descending. Verified
      with a 7-assertion simulation, including one that proves the descending sort is
      load-bearing (ascending genuinely corrupts the playlist).
    - **Read-only playlists**: Navidrome flags playlists synced from a `.m3u`/`.nsp` with
      `readonly: true` in `getPlaylists` and refuses API writes (Subsonic error 50)
      *regardless of owner* — the file on disk is the source of truth. Castafiore was
      discarding the field, so the only way to discover it was to attempt a write and swallow
      the error, which the old single-select did (`.catch(() => { })`). Those rows are now
      dimmed with a lock and never queued for a write. Plain Subsonic servers omit the field,
      so they keep current behaviour.

35. **Full-screen player: compact control cluster** ✅ done 2026-09-28
    The track/seek/controls block was taking ~50% of the screen, leaving the cover cramped.
    - `CoverItem` moved into a `coverSlot` (`flex: 1`, centred) and `playerContainer` lost
      `justifyContent: 'space-between'`. That was the real fix: `space-between` smeared the
      leftover height into four equal gaps between the five children, so tightening the
      controls just pushed the cluster *further from the cover* — the bottom region only shrank
      by 0.75x the amount removed. With a flex slot the split is directly controllable.
      The cover's size formula is untouched, so it does not change size.
    - Three on-device passes, measured by row analysis of a 1080x2520 screenshot:
      centred/tight → cover top 1336, gap 733, cluster 452px (17.9%);
      flex-end → cover top 1569, gap 445, cluster 507px (20.1%) — fixed the gap but shoved the
      cover 233px down, which was worse;
      centred/roomier → cover top 1254, gap 705, cluster 562px (22.3%). Shipped.
    - The queue view keeps a top-aligned slot variant (`coverSlotTop`) so the list fills from
      the top instead of floating in the middle.
    - Known constraint: the cover is width-capped at `width - 50` (361dp on a 411x960dp screen),
      so it only occupies ~37% of the height. At a fixed cover size the leftover void is
      unavoidable — only a bigger control cluster can consume it.
    - Untouched: `FullScreenHorizontalPlayer` (landscape/desktop puts the cover left, a
      different split entirely).
    - Noted, not changed: `compact = width < 420 || height < 700` is true on a 411x960dp
      device purely because of the width, so a tall phone gets compact spacing and the smaller
      play button. Raising the threshold would also enlarge the play button and grow the
      cluster, so it is a separate decision.

36. **Player gestures: drop the bottom button row** ✅ shipped 2026-09-29 (`beccb47`)
    Plan: `plans/player-gestures-cast.md`. Commit `beccb47`.
    - **Lyrics on cover tap.** `SlideControl` gained an optional `onTap`; when supplied, a single
      tap calls it and the double-tap play/pause is skipped (one gesture per intent, no 300ms
      arbitration). The portrait player passes it, the landscape/desktop player does not and keeps
      double-tap. *The tap target could not be reused as the way back:* the lyrics pane is a
      `FlatList` whose rows seek on tap, so they win the tap. A `picture-o` button in the top bar
      appears only while the lyrics show.
    - **Queue as a swipe-up overlay**, not a `preview` enum value — `preview` is now just
      COVER | LYRICS and the queue is a separate `isQueueOpen`. The sheet is absolutely
      positioned over the whole window, `translateY` starts one window-height below the viewport
      and tracks the finger 1:1; it opens on an upward swipe and closes by dragging its header
      down, the X, or back. Contents moved to `QueueSheet.js`.
    - **Cast to Home**, as a sibling of the refresh control (not inside its ternary, so it cannot
      jump when a scan starts/stops). Home only, not every tab — that is what was asked for and
      one place is easier to reason about than four. Consequence accepted: no cast picker from
      the Music tab.
    - **Deleted row's height** went into `playerContainer`'s `paddingBottom` (30 → 82) so the
      title/seek/transport cluster stays exactly where the measured passes in #35 put it, and the
      freed space goes to the cover. Re-measured and confirmed unchanged on device.
    - **Radio badge removed** from the transport row. Display-only: "End radio" is still in the
      `...` menu, so the finite / never-looping session remains one tap away.

    Three platform findings that cost real time, recorded so they are not rediscovered:
    - `PanResponder` fills in `x0`/`y0` only at **grant** time (PanResponder.js:471); before that
      they are literally `0`, so a move-phase handler must test `g.moveY`, never `g.y0`. Testing
      `y0` made the condition `0 > bottom`, i.e. always false, and the gesture looked dead.
    - `onMoveShouldSetResponder` on an ancestor **loses**: the pressable under the finger wins the
      responder on touch-START, so the parent is never asked again. Must be
      `onMoveShouldSetResponderCapture`; taps still fall through because capture only fires on a
      real move.
    - A `View` with **no props is collapsed out of the native hierarchy** on Android, so a touch
      landing on plain empty space never enters the responder system and produces no MOVE events
      at all. This is why the swipe only ever worked from the buttons and the title. Fixed with a
      `neverTake` `onStartShouldSetResponder` on the containers, plus a real drag strip in the
      empty band under the transport row that claims on DOWN (nothing interactive is beneath it).
    - Android's own **bottom-edge back gesture** is consumed by the platform before any
      PanResponder sees it; it surfaced as `Modal.onRequestClose` closing the whole player.
      `onRequestClose` now dismisses by layer order: queue → lyrics → player.

37. **Delete song from server library** 🚧 PARKED (waiting on Navidrome upstream)
    - User request: "remove a song from the library" — meaning erase the audio file on the
      Navidrome host, not just hide it locally or drop the local cache
      (`deleteSongCache` in `app/screens/Info.js` stays as-is).
    - Blocker: stock Navidrome (server v0.64.2) is read-only by design — Subsonic `rest/*`
      has no delete-media endpoint and native `DELETE /api/song/:id` is GET-only.
      Plugin HTTP endpoints (`/ext/{pluginID}/*`, PR navidrome#5045) are still Draft/unmerged,
      so no released version can receive a delete call from the app.
    - Decision 2026-10-11: wait for upstream, no sidecar microservice.
    - When unblocked: small `.ndp` plugin (`HTTPEndpoint`, `auth: subsonic`, `users`
      allow-list, `library AllowWriteAccess=true`) + `deleteLibrarySong()` in
      `app/utils/api.js` + "Delete from server" entry in `OptionsSongsList` with
      `confirmAlert`, then `startScan` + `refreshApi`.
    - Plan: `plans/delete-song-from-library.md`.

38. **Song heart → "Add to playlist" circle + Favourited as playlist** ✅ done 2026-10-17 (commit `dc48aaf`, needs on-device verify)
    - User: replace the heart in songs with the empty/full circle used in the playlist
      sheet; tap opens the add-to-playlist menu instead of starring; "Favourited" becomes
      a choosable pseudo-playlist there.
    - Decisions: scope = song rows + player (album/artist/playlist hearts unchanged);
      filled = starred; keep long-press rating.
    - Plan: `plans/heart-to-playlist.md`. New `PlaylistButton`, `PlaylistSelectPopup`
      gains the Favourited row and a `songs` prop.
    - Shipped: `PlaylistButton` (circle `circle-o`→`check-circle` in `primaryTouch`, tap opens
      the sheet, long-press keeps the rating popup); `PlaylistSelectPopup` rewritten around a
      `songs: [{id, starred}]` prop — Favourited row = all starred → filled, partial → empty
      and untouched unless tapped (then adds only the missing stars), deselect unstars the
      listed songs, no confirm dialog; `onDone(ok, total, { starred })` reports the resulting
      Favourited state so `PlaylistButton` syncs its own fill. All 5 callers updated
      (`OptionsSongsList/Queue/Player/Album/Albums`); song reducer `setRating` only rewrites
      the rating when one is passed (the sheet updates `starred` alone).
    - Follow-up same day (user: "circle is too small"): the glyph is replaced by a drawn
      circle — sheet's `SelectCircle` look (2px ring; filled disc + check when starred),
      `size` = diameter (default 26, desktop mini 22).

39. **Offline mode (no connection → downloaded content only)** ✅ done 2026-10-17 (needs on-device verify)
    - User: when there is no connection, allow an offline mode showing only downloaded
      albums/tracks/playlists; search stays enabled but within downloaded content.
    - Automatic only (NetInfo, already a dependency); no manual switch.
    - Plan: `plans/offline-mode.md`.
    - Detection: `app/utils/offline.native.js` (`NetInfo.isConnected === false` — a connected
      but unreachable server is NOT offline, LAN servers stay usable) + `offline.web.js`
      (`navigator.onLine`), both exposing `useOffline()` / `getIsOffline()`.
    - Data: `app/utils/offlineContent.js` selectors over the download state (`offlineSongs`,
      `offlineCollections`, `offlineCollectionSongs`, `isSongDownloaded`); `buildMeta` now
      stores duration/albumId/artistId/coverArt/track so offline rows have real metadata.
    - UI: `components/offline/OfflineSongs|OfflineCollections|OfflineSearch` +
      `components/banner/OfflineBanner` (thin strip in the TabBar). Tracks (songs/albums views,
      artists hidden, local search), Playlists (downloaded playlists + Favorited filtered to
      downloaded; refresh/create hidden), Home (downloaded albums + songs, Random shuffles
      downloads, server buttons hidden), Album/Playlist fall back to download-index songs when
      the API cache is empty, Favorited filters to downloaded, `PlaylistButton` hides offline.
    - Follow-up same day (user: covers offline): cover cache — enqueues queue the getCoverArt
      image (`cache/covers/<id>.jpg`, deduped, ≤4 concurrent, HTTP-200 only); `initDownloads`
      backfills older downloads when online; `urlCover` prefers the local file offline; old
      entries derive `coverArt` from their baked cover URL.

40. **Full-screen player: animated fBM background + translucent pill UI** ✅ done 2026-10-18
    - User spec: full-bleed animated fBM noise background colored from the album cover; two
      flat translucent containers on the player (pill control bar + rounded cover/lyrics
      pane); queue view bare with reduced-opacity content; legibility (contrast ≥ 4.5:1);
      reduce-motion/transparency honored; 30–60 FPS cap, pause when backgrounded.
    - Implemented: `expo-gl` shader background (`PlayerBackground.{native,web}.js`), cover
      palette (`utils/playerPalette.js`: react-native-image-colors + luminance clamp +
      AsyncStorage cache + theme fallback), player reworked into the two spec containers,
      queue restyled (scrim + 0.9-opacity rows + shadows), Settings → Player "Appearance"
      (Animated background / Reduce transparency), en+it keys. Decisions: user picked
      expo-gl, image-colors, Android-first, on-by-default (2026-10-18).
    - First release build launched to a hard crash (`TypeError: 0.5 is not a function` at
      bundle load): backticks inside the FRAGMENT_SHADER **template literal** closed it
      early, so the rest was parsed as JS — `... * 0.5 + 0.5` + a second backtick became a
      **tagged template call on the number 0.5**. Fixed by removing the backticks from the
      in-shader comment; shader source re-verified by evaluating the transformed template.
      Detail + the bytecode-offset→file:line diagnostic recipe in `.log` + the plan file.
    - Verified on device (GLView-in-Modal z-order, perf/battery, palette quality, pill/pane
      proportions); user verdict: "tutto perfetto". Two release-only R8 crashes surfaced and
      were fixed with keep rules (GLView constructor + GLContext.flush; rationale in `.log`
      and `android/app/proguard-rules.pro`, now re-applied automatically after prebuild by
      `plugins/proguardRules.js`). Feedback round: control pill radius 999 → 24 (matches the
      cover pane) and the queue fades the player content out (`playerOpacity`) so only the
      background shows through. Desktop player + web untouched by decision.
    - Plan: `plans/fbm-player-background.md`.

41. **Player background: frozen top strip ("gold artifact")** ✅ done 2026-10-18
    - Symptom: top ~15% of the full-screen player was pixel-frozen (frame-diff 0.0 over 1.4 s)
      while the rest animated; the strip showed the *previous* palette (gold).
    - Cause: `expo-gl` creates the EGL surface once from the size at mount time and ignores
      later size changes (`GLView.kt` re-initializes only after a 0-size start). A mount
      during an intermediate/different window mode captured `1313x2028` on a 1080x2520
      screen → all draws landed in that buffer → the uncovered strip kept old pixels.
    - Fix: `PlayerBackground.native.js` self-measures (`onLayout` → dp x PixelRatio) and
      remounts the `GLView` (capped at 5, ≥500 ms apart) while `gl.drawingBufferWidth/Height`
      don't match; logs `context WxH (view VxV)` + remount lines. Same mechanism suspected
      behind "background stops working" reports (context created mid-layout → partial draw).

42. **Mini player: animated fBM background ("pill"), configurable** ✅ done 2026-10-19 (user verified on device)
    - User request: same fBM behind the mini player; setting in the Theme screen.
      Decisions: off by default, user-chosen FPS (10/15/20/30, default 15), keeps animating
      while paused, follows the Reduce transparency fallback.
    - Implementation: `PlayerBackground` gained `fps`/`paused`/`noiseScale`; `BoxPlayer`
      renders it behind a theme scrim when `settings.miniPlayerBackground`; Theme screen has
      the switch + FPS list; defaults `miniPlayerBackground:false`, `miniPlayerFps:15`.
    - Note: expo-gl's GLView is a `TextureView` (not a SurfaceView), so the pill's radius and
      translate animations clip/follow correctly.
    - Plan: `plans/mini-player-fbm.md`.
    - On device: user tested it (pill animation, open/close player, track change) — OK.
      Left to measure only if the idle-burn work (#43) resumes: CPU delta pill-on/off.

43. **Idle CPU burn (~20–35% foreground, main + JS) — investigation** 🚧 open
    - Observed 2026-10-18 with a loaded (paused) session on Home: main thread ~19%, `mqt_js`
      ~10%, `Choreographer#doFrame` at ~120/s with ~0 HWUI draws → a per-vsync loop that
      renders nothing. Persists across tabs (Settings/Music), online and offline, and after
      dismissing the mini player. No `Animated.loop`/rAF loop in app code (only
      `PlayerBackground`, unmounted there); legend-list rAF paths are scroll/event-driven.
    - Ruled out: Home-only, mini player, `useKeyboardIsOpen`, `updateApi` churn, UPnP polling
      (starts only when casting), `useProgress` / Cast `useStreamPosition` (player screens not
      mounted), LegendList (not mounted on the tested screens).
    - Next: install the instrumented build — the probe patch is saved outside the repo at
      `/tmp/opencode/temp-debug-raf-hunt.patch` (counts rAF/timers/Animated starts + stacks;
      the bundle needs `minifierConfig {mangle:false}` to keep names readable) and read the
      `[HUNT]` logs.
    - Blocked: USB devices were unplugged mid-investigation.

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
- `android/app/proguard-rules.pro` keeps reanimated + turbomodule, plus the expo-gl `GLView` constructor and `GLContext.flush` rules (comments in the file, rationale in `.log`). Since 2026-10-18 `plugins/proguardRules.js` re-appends the custom block automatically during `expo prebuild`, so only the abiFilters/proguard knobs still need a manual re-apply after a fresh `prebuild --clean`.
- `android/local.properties` (`sdk.dir=/home/espo/Android`) can be wiped by `prebuild --clean`. Recreate it.
- Root `react-native.config.js` (fixes `expo.core.ExpoModulesPackage` compile error) survives prebuild.

### Known fixed bug
- `expo.core.ExpoModulesPackage` compile error in generated `PackageList.java` → fixed via project-level `react-native.config.js` dependency override (expo's own config fails to load under pnpm nested resolution, so the autolinker falls back to the gradle namespace path). Do not delete this file.

### For real Play Store distribution (later)
- Generate a real keystore and use a signed release config (current release uses `signingConfigs.debug`).

---

35. **Desktop full-screen player: fBM background parity** ✅ done (2026-10-22)
    - Ported the mobile fBM animated background (`PlayerBackground` + cover-derived palette)
      to `FullScreenHorizontalPlayer.js`: conditional render (on when `settings.playerBackground`,
      off keeps the blurred cover + scrim fallback), translucent `panelFill` on the queue column.
    - `PlaylistButton` circle already wired (size 26, opens `PlaylistSelectPopup`, long-press rating).
    - Scope: fullscreen only; web keeps flat fallback; queue stays inline on the right.
    - Plan: `plans/desktop-player-background.md`.

---

36. **Offline library: one index, collection sync, favourites** ✅ done (2026-10-25)
    - Auto-cache removed: a song is on disk only if explicitly downloaded. One-time
      purge deletes legacy auto-cached files (keeps downloads + paused `.part`).
    - `downloadManager` is the single source of truth (`isSongLocal`, local-library
      selectors, `file` on index entries). `cache.js` is API-cache only.
    - Downloaded albums/playlists can be **synced**: `DownloadButton` shows an update
      state when the server list changed; `syncCollection` adds/removes only the delta
      and keeps files shared by another downloaded collection.
    - Favourite state is stored in download metadata and refreshed from `getStarred2`;
      `PlaylistButton` is read-only offline. Favorited collection has "Sync download".
    - Offline playlist order follows the stored `songIds`.
    - Plan: `plans/offline-unification.md`, `plans/downloaded-collection-sync.md`.
    - Manual verification owed: edit a downloaded playlist online → sync icon → delta
      downloads; star a downloaded song → offline circle updates.

---

44. **UI restyling — "Soft Glass"** 🚧 in progress (Fase 0 done)
    - Direzione: "Soft Glass" (accenno di Liquid Glass, non imitazione). Principio:
      il vetro e' solo per il chrome flottante, mai per il contenuto. Contenuto opaco
      e piatto sotto, chrome traslucido sopra. Mantiene la performance delle LegendList
      e crea la gerarchia visiva che oggi manca.
    - **iOS fuori scope**: niente blur reale. "Glass" = fill semitrasparente + hairline
      luminoso + tinta accent/artwork + ombra morbida. expo-blur non serve.
    - **Web fuori scope**: niente fallback backdrop-filter. Solo Android.
    - **Android**: blur sempre solid (no blur reale). Elevation minima per ombra.
    - Ingredienti (tutti come token in `app/styles/`):
      1. Superficie vetro: fill semitrasparente derivato dal tema + tinta accent/cover 6-10%.
      2. Bordo hairline luminoso: 1px `StyleSheet.hairlineWidth`, bianco ~12% dark / nero ~6% light;
         lato superiore leggermente piu' chiaro (~20%) — gradient bordo rimandato.
      3. Ombra morbida e diffusa sotto gli elementi flottanti.
      4. Raggi concentrici: flottanti 28, card 16-20, thumb 8-10; raggio interno = esterno - padding.
      5. Sfondi tinti dall'artwork: gradient scrim dal colore dominante (palette gia' nel player)
         nelle detail page e nel full-screen player.
      6. Tab bar flottante: pill staccata dai bordi (margine ~12-16px, max-width ~520px centrata).
    - Motion: `app/styles/motion.js` (durate 100/160/240/360/500, easing cubic-bezier,
      spring snappy/smooth/bouncy, helper `nativeDriver = Platform.OS !== 'web'`,
      hook `useReduceMotion` che rispetta il sistema — vince sempre — + override per spegnere).
      Regole: animare SOLO transform e opacity, useNativeDriver true; nessuna animazione
      sulle righe virtualizzate al riciclo (solo primo mount schermata); rispettare Reduce Motion.
    - Token: `app/styles/tokens.js` (typography, radius, spacing, useTokens legato a
      `settings.newUI`), `app/styles/glass.js` (fillAlpha, tintOpacity, borderAlpha, radius,
      isLight derivato dalla luminanza del bg del tema, hairlineColorFor).
    - Feature flag `settings.newUI` a LIVELLO DI TOKEN (non di componente), rimosso a fine Fase 5.
    - Palette artwork: cache key = solo cover id; estrai da 64-100px; LRU AsyncStorage cap ~300;
      flag enabled separato player vs detail; crossfade 300ms solo su arrivo asincrono
      (se in cache, colore subito giusto); tinta iniziale = accent del tema; due layer +
      opacity (mai backgroundColor animato).
    - Inset hook `useBottomInset`: layout-aware via `settings.isDesktop`; sempre safe area
      inferiore; somma banner + mini player solo se visibili.
    - Dipendenze: `expo-haptics` in Fase 3 (aggiungere `VIBRATE` a `app.config.js` permissions —
      la lista esplicita sovrascrive l'auto-inferito), `expo-linear-gradient` in Fase 4.
      Installare con `npx expo install`; nuova build nativa richiesta.
    - native-stack: su Android provare `animation: 'fade_from_bottom'` (fallback `fade`);
      su web nessuna transizione per l'MVP.
    - Transizione mini->full: semplificata (fade+scale cover, scrim 0->0.4), senza shared element.
    - Drag-to-dismiss con PanResponder: misurare jank con fBM attivo in Fase 5 su build release
      (riferimento: 2-3 GB RAM, SoC entry Snapdragon 4xx/Helio G3x).
    - Stima: 13-16 giorni-uomo cross-platform (Android).

    ### Fasi
    - Fase 0 — Token (1 giorno, zero impatto visivo) ✅ fatto: tokens.js, glass.js, motion.js.
    - Fase 1 — Glass primitive ✅ fatto: GlassSurface (solid + hairline + tinta + ombra),
      Scrim helper, DevGlass showcase, route dev-only in SettingsStack.
    - Fase 2 — Chrome ✅ fatto: useBottomInset hook, BottomBar floating pill + sliding indicator,
      BoxPlayer floating pill + hairline/shadow, banners floating pills, contentMainContainer
      paddingBottom 120->170. (enter/exit banner via LayoutAnimation gia' presente.)
    - Fase 3 — Motion core ✅ fatto: press feedback globale (IconButton scale+opacity spring,
      AllItem tile scale), tab indicator spring bouncy, banner LayoutAnimation, useReduceMotion
      rispettato. expo-haptics installato, VIBRATE aggiunto a app.config.js, haptics dietro
      setting hapticsEnabled (default off).
    - Fase 4 — Detail pages ✅ fatto: PresHeader artwork-wash (blurred cover bg + Scrim),
      track numbers su album detail (SongItem sostituisce cover con numero quando isIndex),
      useCoverPalette aggiunto (palette da cover id, LRU cache). Skeleton loaders rimandati.
      expo-linear-gradient non installato: Scrim usa fallback View sovrapposte.
    - Fase 5 — Player motion ✅ fatto: Modal animationType fade, cover fade-in 300ms su cambio
      traccia, drag-to-dismiss gia' presente (misurare jank su build release). newUI flag
      rimosso: useTokens restituisce sempre newTokens. Play/pause crossfade rimandato.

    Plan file: `plans/ui-soft-glass.md`.
