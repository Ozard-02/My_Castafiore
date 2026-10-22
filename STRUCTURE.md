# Castafiore - Code Structure

A React Native / Expo music client for Subsonic API-compatible servers (Navidrome, LMS, Ampache). Supports Android, iOS, and Web from a single codebase using platform-specific file extensions (`.native.js` / `.web.js`).

---

## Entry Points

### index.js
- Registers the root App component via Expo's `registerRootComponent`.
- Calls `initService()` to set up the native playback service (background audio on Android).

### App.js
- Root component wrapping the app in `AppProvider` (context providers) and `SafeAreaProvider`.
- Initializes `i18next` for internationalization.
- Sets global defaults: `global.maxBitRate = 0`, `global.streamFormat = "mp3"`.

---

## AppProvider (app/contexts/index.js)

Provider hierarchy (innermost first):

```
ConfigProvider -> SongProvider -> SettingsProvider -> ThemeProvider -> UpdateApiProvider -> RemoteProvider
```

- **ConfigProvider**: Loads server connection config from AsyncStorage into `global.config`.
- **SongProvider**: Music playback state via a reducer (`songReducer`). Holds main queue (`queue`), a separate "up next" list (`upNext`), current index, playback state, action-on-end-of-song mode, `radioMode` (endless-shuffle flag set by random/shuffle buttons, cleared by any normal playback), `queueEnded` (set when the queue ran out and stopped — makes the play button restart from the top) and `isSongLoad`. On Android it calls `Player.initPlayer()` immediately when `AppState.currentState === 'active'` and **retries on every foreground** until the player is set up (the OS can boot the playback service headless, where `setupPlayer` fails with `android_cannot_setup_player_in_background`). A second AppState listener calls `Player.reconcileState` on resume once `song.isInit`.
- **SettingsProvider**: App settings (theme, language, home layout, cache, player prefs). Persists to AsyncStorage. Exports `defaultSettings` and `homeSections`. The `global.*` mirrors (`streamFormat`, `maxBitRate`, `cacheNextSong`, `parallelDownloads`, `isSongCaching`, `saveQueue`, `repeatQueue`) are plain `useEffect`s here, for the player/download code that runs outside React.
- **ThemeProvider**: Resolves theme object from `settings.theme` + `settings.themePlayer`. Sets `window` background on web.
- **UpdateApiProvider**: Lightweight pub/sub for cache invalidation -- fires `updateApi` changes so other components can re-read their cache.
- **RemoteProvider**: (Native only) Manages remote playback device connections (Chromecast, UPnP). Orchestrates transfer of playback between devices.

A `PlayerEvent` component within `AppProvider` wires `Player.useEvent()` to sync native player state back into the song reducer.

---

## Navigation (app/components/Navigation.js)

- Uses `@react-navigation/bottom-tabs` with 4 main tabs: **Home**, **Music**, **Playlists**, **Settings**.
- `TabBar` component conditionally renders `SideBar` (desktop) or `BottomBar` (mobile).
- Tab bar also renders the mini `Player` component at the bottom.
- Each tab has its own native stack navigator defined in `app/screens/Stacks.js`:
  - **HomeStack**: Home, ShowAll, FreshReleases, UpdateRadio, Album, Artist, ArtistAlbums, EditPlaylist, Genre, GenreAlbum, GenreSong, Info, Playlist, Songs
  - **TracksStack**: Tracks (search bar + Songs/Albums/Artists explorer with grid/list toggle), SearchMore, AlbumExplorer, ArtistExplorer, SongExplorer, plus Pres screens
  - **PlaylistsStack**: Playlists, Favorited, plus shared Pres screens
  - **SettingsStack**: Settings, Connect, AddServer, sub-settings screens (incl. Settings/Downloads)
- `TabBar` also mounts the `DownloadBanner` (mobile) above the mini player when downloads are active.
- Search is embedded inline in the Music tab (search bar on top; typing swaps the explorer for results). No separate Search tab.

---

## Contexts

### app/contexts/config.js
- `ConfigProvider` exposes `config` (server URL, username, auth query) via `useConfig()` / `useSetConfig()`.
- On config change, sets `global.config = { ...config, folderCache }` and calls `initCacheSong()`.

### app/contexts/settings.js
- `SettingsProvider` exposes `settings` and `saveSettings`.
- Loads/saves to AsyncStorage. Merges with `defaultSettings`.
- **updateGlobalSettings()** sets globals: `streamFormat`, `maxBitRate`, `cacheNextSong`, `isSongCaching`, `saveQueue`, `repeatQueue`.
- Exports `defaultSettings`, `demoServers`, and `homeSections` (array defining Home screen widgets).

### app/contexts/song/
- **context.js**: Creates `SongContext` and `SongDispatchContext`.
- **provider.js**: `SongProvider` wraps `songReducer` with `React.useReducer`. Exports `songReducer`, `defaultSong`, and `convertTrack()`.
  - Reducer actions: `init`, `restore`, `setQueue`, `setIndex`, `setState`, `addToQueue`, `setRating`, `removeFromQueue`, `addToUpNext`, `nextUpNext`, `removeFromUpNext`, `moveUpNext`, `moveInQueue`, `moveUpNextToQueue`, `moveQueueToUpNext`, `syncGlobal`, `setActionEndOfSong`, `reset`.
  - `newSong()` updates state, sets `global.song`, and persists to AsyncStorage.
- **use.js**: `useSong()` and `useSongDispatch()` hooks.
- **index.js**: Re-exports from `provider.js` and `use.js`.

### app/contexts/theme.js
- Resolves theme objects from `themes` and `themesPlayer` maps based on `settings.theme` / `settings.themePlayer`.
- Exports `useTheme()` and `ThemeProvider`.

### app/contexts/updateApi.js
- Simple context holding `{ path, query, uid }` to broadcast cache invalidation events.
- `isUpdatable()` checks if the current updateApi matches a given path/query.

### app/contexts/remote/ (Native only)
- Manages Chromecast / UPnP device discovery and playback transfer.
- `RemoteProvider` watches `selectedDevice` changes and calls `Player.connect()` / `Player.switchPlayer()` / `Player.restoreState()`.
- Web fallback (`index.web.js`) returns a no-op `defaultRemote` with `type: "local"`.

---

## Utils

### app/utils/api.js - API Layer
Core functions for Subsonic API calls:

| Function | Description |
|---|---|
| `getUrl(config, path, query)` | Builds a Subsonic REST API URL from config. |
| `getApi(config, path, query)` | Fetches JSON from Subsonic API, resolves `subsonic-response` payload. Rejects on HTTP error or API error. |
| `getCachedAndApi(config, path, query, setData)` | Reads from cache first, then fetches fresh, then writes result back to cache. |
| `refreshApi(config, path, query)` | Fetches fresh data and writes to cache. Returns the JSON. |
| `useCachedAndApi(initialState, path, query, setFunc, deps)` | React hook: loads cached + fresh data, triggers on `updateApi` changes. Returns `[data, refresh, setData]`. |
| `useCachedFirst(initialState, path, query, setFunc, deps)` | React hook: cache-first strategy. Returns `[data, setData]`. |
| `getApiCacheFirst(config, path, query)` | Returns cached data if available; otherwise fetches from network and caches. |
| `getApiNetworkFirst(config, path, query)` | Fetches from network first; falls back to cache on failure. |

### app/utils/playerCore.js - Shared Player Core
Platform-agnostic logic used by both `player.native.js` and `player.web.js`. Three shared decisions live here so the four backends can't drift again:
- `endOfTrackAction(song)` → `'none' | 'reset' | 'repeat' | 'stop' | 'next'`. **Single source of truth for "the track just ended"** — previously written out five times (service, cast, upnp, web, core) and the copies had diverged: cast/upnp seeked to 0 without resuming (repeat-one stalled), web had no stop branch, and the end-of-queue predicate was duplicated with and without the radio/up-next guards.
- `scrobbleTrack(config, song, submission)` — end-of-track scrobble, failures swallowed.
- `stopAtQueueEnd(songDispatch, stop)` — dispatches `setQueueEnded` then stops, so the play button can restart the queue instead of calling `resumeSong()` on an ended track.

`createSongControls({ loadSong, stopSong })` returns `playSong`/`nextSong`/`previousSong`/`setIndex` (the backend supplies `loadSong` + `stopSong`), plus `setRepeat`, `secondToTime`, and all queue-mutation dispatchers (`removeFromQueue`, `addToQueue`, `addToUpNext`, `removeFromUpNext`, `moveUpNext`, `moveInQueue`, `moveTrack`). Both platform files re-export these, so consumers see one identical API on every platform. `setIndex` takes an options object: `{ clearUpNext, clearRadio }` — an explicit user jump in the queue view drops the Up-next list and leaves a radio session; plain next/previous and the resume reconcile preserve both. Endless-shuffle radio is a **continuous stream, not 50-track batches**: `nextSong` calls `refillRadio()` once fewer than `RADIO_LOW_WATER` (10) tracks are unplayed, so the fetch happens while tracks are still playing instead of in the gap after the last one. A shared `radioPending` promise lets the low-water kick-off and the end-of-queue safety net await the same fetch. A radio session **never wraps** (whatever `repeatQueue` says) — an exhausted pool reshuffles the whole allowed set rather than replaying a batch, and only stops if that fetch fails. Past `RADIO_MAX_QUEUE` (200) the session restarts on a fresh pool via `setQueue` with `keepUpNext`. History: `nextSong` calls `extendRadio()` — refreshes exclusions, fetches `getRandomSongs size=50` (200 if that yields nothing new), filters exclusions, dedupes against the current queue **and within the page** (the server repeats ids, which played back-to-back), appends via `addToQueue`, then advances using fresh `global.song.queue`. If the top-up fails, playback **stops** rather than wrapping — silently looping the queue was reported as "the playlist loops". Repeat-one (`actionEndOfSong === 'repeat'`) is cleared *before* awaiting the load, so a `PlaybackQueueEnded` landing in the load window can't seek the freshly loaded track back to 0.

### app/utils/player.js (platform-resolved)
- **Native** (`player.native.js`): Delegates to `LocalPlayer`, `CastPlayer`, or `UpnpPlayer` based on the current `type` variable (`"local"`, `"chromecast"`, `"upnp"`). Provides `connect()`, `disconnect()`, `switchPlayer()`, `saveState()`, `restoreState()`. Song navigation + queue mutations come from `playerCore.js`.
- **Web** (`player.web.js`): Uses the HTML5 `<audio>` element. Implements playback controls (load/pause/seek/volume) and MediaSession API integration; song navigation + queue mutations come from `playerCore.js`.

### app/utils/player/ - Native Player Implementations
| File | Description |
|---|---|
| `playerLocal.native.js` | `react-native-track-player` based local playback. Handles download/caching of songs (bitrate-aware cache lookups via `songCacheKey`). `convertState` maps RNTP `State`→`MyState` (incl. `Loading`/`Connecting`→Loading, `Ended`→Stopped). `reconcileState` heals React against `getActiveTrack()`, falling back to `syncGlobal` when the active track is not in the queue (up-next playback). `appKilledPlaybackBehavior: StopPlaybackAndRemoveNotification` (user decision: swiping the app away stops playback) and **no** `alwaysPauseOnInterruption` (it made the service's duck handler dead code and left playback paused forever after a notification). |
| `playerCast.native.js` | Google Cast (Chromecast) playback via `react-native-google-cast`. |
| `playerUpnp.native.js` | UPnP / DLNA playback. |

### app/utils/playerState.js
Playback state enum: `Playing`, `Paused`, `Stopped`, `Loading`, `Error`, `None`.

### app/utils/cache.js (platform-resolved)
| Platform | Implementation |
|---|---|
| `cache.native.js` | AsyncStorage for API cache; `expo-file-system` for song cache. `initCacheSong()` sets up `global.listCacheSong` and prunes files that don't match the `songCacheKey` shape. `songCacheKey(songId, format, maxBitRate)` is the file identity: the bitrate suffix applies **only when `format !== 'raw'`**, because `urlStream` returns a plain `stream?id=X` for raw and the bitrate doesn't change the bytes — keying on it for raw would re-download the library on every slider move. The **server is deliberately not part of the key**: both configured servers are the same library behind two addresses, so bytes are interchangeable and re-fetching on a WiFi/cellular switch would burn the data plan. |
| `cache.web.js` | Uses browser `Cache` API and service worker. API cache handled by SW fetch handler. |

### app/utils/downloadManager.js (platform-resolved) — Downloads
| Platform | Implementation |
|---|---|
| `downloadManager.native.js` | Spotify-style download manager. `buildMeta` records `server: global.config.url` as provenance (never used to invalidate — same library) and stores `duration`/`albumId`/`artistId`/`coverArt`/`track` so offline rows keep real metadata (entries downloaded before that fall back to title/artist/album); `coverForCurrentServer(meta, config)` re-points a baked cover URL at the active server; `initDownloads` re-points `queued`/`paused` items after an automatic server switch (in-flight items keep their URL); `partUri` is derived in `runDownload`, not at enqueue, so a format/bitrate change mid-queue can't strand a `.part`. **Cover cache**: every enqueued song (and collection cover) queues its getCoverArt image — deduped per cover id, ≤4 concurrent, validated 200-only, stored at `cache/covers/<id>.jpg`. `initDownloads` scans the folder and backfills missing covers for already-downloaded songs when online; `getLocalCoverUri` serves them to `urlCover` while offline; `clearAllDownloads` wipes the folder (single-song removal keeps the shared album cover).  **parallel** queue engine (fills up to `global.parallelDownloads` slots, default 3) built on `DownloadResumable` (pause/resume survives restarts), per-server persistence (`downloadQueue:/downloadIndex:/downloadCollections:` keys in AsyncStorage), rolling 10s speed tracker, collection records (one album/playlist = removable unit). Cache-ahead downloads are flagged `silent` so the banner/progress UI ignores them. O(1) lookups via a `queueById` map rebuilt in `setState`. Exposes `useDownloads()` (useSyncExternalStore), `enqueueSong`, `enqueueCollection`, `pauseDownload`, `resumeDownload`, `retryDownload`, `cancelDownload`, `cancelCollection`, `resumeCollection`, `removeSong`, `removeSource`, `clearAllDownloads`, `getCollectionState`, `getSongState`, `getDownloadedSongs`, `getDownloadSpeed`, `formatSpeed`, `formatBytes`. Initialized in `config.js` alongside `initCacheSong()`. |
| `downloadManager.web.js` | No-op stub (offline handled by the service worker). Same exports + `useDownloads`. |

### Other Utils
- **url.js**: `urlCover()` resolves cover art URLs (handles navidrome/ampache/generic Subsonic types). Offline it first asks the download manager for a locally cached cover file (keyed by the getCoverArt `id`; `coverIdFromUrl`/`getLocalCoverUri`) and falls through to the server URL — which fails gracefully to the placeholder — when there is no cache. `urlStream()` resolves audio stream URLs. `coverIdOf()` is the single cover-id chooser (item → getCoverArt id) shared by `urlCover` and the palette extractor, so the offline cover cache and the palette can never disagree on a file name.
- **playerPalette.js**: cover-art palette for the animated player background. `usePlayerPalette(config, songInfo, enabled)` extracts swatches via `react-native-image-colors` (AndroidX Palette; local cached cover file first, then `urlCover(..., 150)` — skipped while offline with no local file), then `preparePalette()` dedupes, sorts dark→light, resamples to exactly 6 slots and luminance-clamps every color (WCAG relative luminance ≤ 0.30, scaled in linear RGB; near-black ramps are lifted so bands stay visible) so white text keeps ≥ 4.5:1 through the 0.35 container fill + shader dim. Cached per cover id in AsyncStorage (`playerPalette:<id>`); `themedPalette(theme)` supplies the instant/fallback ramp from the active player accent. Pure helpers (`hexToRgb`, `preparePalette`, …) are exported and node-testable.
- **tools.js**: `shuffle()`, `saveQueue()` (caps the id list — the whole queue travels in the query string and a 1000-track radio queue produced a multi-KB URL servers reject).
- **exclusions.js**: Negative playlists — songs of playlists tagged `#<username>-exclusive` in their comment (same mechanism as pins) are excluded from the Home random-shuffle button. Per-server ID set (`excludedSongs:<folderCache>` in AsyncStorage + memory cache), refreshed on toggle in `OptionsPlaylist` and before every Home random click (`refreshExcludedSongIds`). `filterExcluded()` is the single filter point (`Home.js clickRandomSong`, `playerCore.radioPool` — applied to the unseen pool **and** the reshuffled repeat fallback, so an excluded track can never reach a shuffle session).
- **albumActions.js**: `addAlbumToQueue(config, songDispatch, albumId, asNext)` — fetches album songs and queues them (or plays the album when no queue is active). Used by swipe actions on album rows (AlbumExplorer, SearchMore).
- **lrc.js**: `parseLrc()` parses LRC-format lyrics into `{ time, text }` objects.
- **logger.js**: In-memory log buffer (`global.logs`, max 1000 entries). Provides `info()`, `debug()`, `error()`, `get()`.
- **alert.js**: `confirmAlert()` - cross-platform confirm dialog (native `Alert` / web `window.confirm`).
- **useKeyboardIsOpen** (platform-resolved): Native uses Keyboard API; Web returns `false`.
- **PlaylistSwipeRow.js**: Generic swipeable row (playlist rows, Music tab songs/albums, search results). Actions per direction from `settings.swipeRightAction`/`swipeLeftAction` (queue / play next / remove / action menu (left only) / none); configured action is revealed as a hint during the drag (layers always mounted behind an opaque row); 'menu' keeps the remove+play-next panel with parent-driven `open` state (safe with LegendList row recycling).
- **useQueueDnD.js**: All queue drag-and-drop state shared by both full-screen players: list refs (`scroll`/`upNextScroll`), scroll offsets, viewports, `onLayout` box positions (`boxY`/`boxH`), `rowHeight`, the `isCurrentInQueue`/`queueItems` derivation (queue **rotated** to start at the current song — next song first, previous songs wrapped to the bottom; current song stays pinned above, `song.queue` remains the source of truth). The rotation anchors on **where `songInfo` actually sits in the queue**, not on `song.index` (up-next playback moves `songInfo` without moving `index`). `queueRealIndex` (display→real index mapping `(index + 1 + i) % queue.length`), `queueKeys`/`upNextKeys` (occurrence-aware row keys — `id` plus a duplicate counter — because plain indices carried the previous occupant's per-row state across a rotation and plain ids collide when a track is queued twice), the `lists` memo for `QueueDragProvider`, `handleMove` (routes through `Player.moveTrack`), and the scroll-to-top effect. Options: `bottomAligned` (desktop flex-end queue), `scrollAnimated`.
- **offline.js (platform-resolved)**: connection state for offline mode. `.native.js` uses `@react-native-community/netinfo`; offline = `isConnected === false` (a connected-but-unreachable server is NOT offline — LAN Navidrome servers keep working and API errors surface as usual). `.web.js` uses `navigator.onLine` + online/offline events. Both expose `useOffline()` (`useSyncExternalStore`) and `getIsOffline()`.
- **offlineContent.js**: pure selectors over the download state for offline browsing — `offlineSongs(downloads)` (newest first), `offlineCollections(downloads, type)` (album/playlist with ≥1 completed song, `songCount` recomputed from the index), `offlineCollectionSongs(downloads, type, id)` (songs whose `sources` include that collection — used when the API cache is empty), `isSongDownloaded(downloads, id)`. Songs derive `coverArt` from the baked cover URL when older entries lack it (kept import-free so it stays node-testable). No network, no API.

---

## Services

### app/services/servicePlayback.js (Native only)
- Registers background playback event listeners via `react-native-track-player`.
- Handles: remote play/pause/next/previous/seek, audio ducking, playback-end scrobbling, queue-ended logic, and song caching triggers.

### app/services/serviceWorkerRegistration.web.js
- Web service worker registration for PWA caching and offline support. Uses Workbox (configured in `workbox-config.js`).

---

## Screens

### Tab Screens (app/screens/tabs/)
| File | Description |
|---|---|
| Home.js | Renders home feed from `homeSections` config. Random song button, server scan trigger, refresh. Offline: downloaded albums + downloaded songs sections instead, Random Song shuffles the downloads (no radio mode), server buttons hidden. |
| Tracks.js | Music tab (4th tab position, no separate Search tab). Search bar on top (shared `mainStyles.searchBox`/`searchInput`); when empty shows the Selector (Songs/Albums/Artists, selected pill shows a check icon) + explorer; typing swaps to inline `SearchResults`. Grid/list toggle persists `gridView`. Fixed status-bar View pattern. Offline: Songs/Albums views only (artists hidden), rebuilt from the download index (`OfflineSongs`/`OfflineCollections`), typing swaps to `OfflineSearch`. |
| Playlists.js | Lists user playlists (sorted, with pin filtering). Add playlist inline. Favorites section removed. Offline: downloaded playlists only, Favorited section filtered to downloaded songs, refresh/create hidden. |
| Settings.js | Master settings screen with navigation to sub-screens. App version, connect status, theme/language/cache/player/home/playlists/shares settings. |

### Pres Screens (app/screens/Pres/)
| File | Description |
|---|---|
| Album.js | Album detail: track list, header with cover, favorited/random buttons. Fetches via `getAlbum` API. Offline with an empty cache, songs fall back to the download index (`offlineCollectionSongs`). |
| Artist.js | Artist detail: biography, albums sorted by year, top songs, similar artists, favorited songs. |
| ArtistAlbums.js | Grid/list of an artist's albums. |
| Favorited.js | List of starred/favorited songs. Offline: filtered to downloaded songs. |
| Genre.js | Genre landing: albums by genre, artists extracted from albums/songs, song list. |
| GenreAlbum.js | Paginated list of albums in a genre. |
| GenreSong.js | Paginated list of songs in a genre. |
| Playlist.js | Playlist detail with song list, optional reverse order, queue options. Offline with an empty cache, songs fall back to the download index. |
| Songs.js | Static song list (used for top songs, etc.). Uses LegendList with sticky header. |

### Explorer Screens (app/screens/Explorer/)
| File | Description |
|---|---|
| AlbumExplorer.js | Paginated album browser with type selector (newest, highest, frequent, etc.). Accepts `layout` ('list'\|'grid') and `showHeader` props; grid mode is a virtualized `LegendList numColumns={2}`. |
| ArtistExplorer.js | Artist browser with sidebar letter index (list mode), favorited filtering. Grid mode hides the sidebar (virtualized `LegendList numColumns={2}`). |
| SongExplorer.js | Paginated song browser. Accepts `layout` and `showHeader` props; grid mode is a virtualized `LegendList numColumns={2}`. |

### Settings Screens (app/screens/Settings/)
| File | Description |
|---|---|
| AddServer.js | Form to add/edit a server connection. Supports Navidrome, Subsonic, LMS, Ampache types. |
| Cache.js | Cache management: view stats, clear API cache, clear song cache. |
| Connect.js | Server connection management: select from saved servers, ping for status, delete servers. |
| Downloads.js | Download manager UI: live speed/active/queued stats card, active downloads with progress + pause/resume/retry/cancel, downloaded collections removable individually, individual songs bucket, clear all. Active queue renders via virtualized `LegendList` (header/footer hold the static sections). Cache settings include the `parallelDownloads` concurrency input. |
| Home.js | Configure which home sections are enabled and their order. |
| Informations.js | App/system information display. |
| Language.js | Language selector. |
| Logs.js | Displays in-memory logs (from `logger.js`). |
| Player.js | Player-related settings (stream format, max bit rate, caching, repeat queue). |
| Playlists.js | Playlist display settings (reverse, order). |
| Shares.js | Share app via platform share sheet. |
| Theme.js | Theme and player theme selector, plus the mini player background setting (2026-10-19): switch + user-chosen FPS (10/15/20/30, default 15) for the fBM pill. |

### Other Screens
| File | Description |
|---|---|
| EditPlaylist.js | Form to edit playlist name, public flag, and comment. |
| FreshReleases.js | Fetch fresh releases from ListenBrainz API. |
| Info.js | Song/album/artist info display with cache status and deletion. |
| SearchMore.js | Paginated search results for artists, albums, or songs. Toggle between list (ExplorerItem) and grid (AllItem, virtualized `LegendList numColumns={2}`) view. |
| UpdateRadio.js | Create or update an internet radio station. |
| ShowAll.native.js | Shows all items for a given home section (albums, artists). |
| ShowAll.web.js | Web equivalent of ShowAll. |

---

## Components

### Player Components (app/components/player/)
| File | Description |
|---|---|
| Player.js | Top-level player container. Shows `BoxPlayer` or `FullScreenPlayer` based on state. |
| BoxPlayer.js | Mini player (mobile, fixed at bottom). Cover, title, artist, cast + favourite + play/pause buttons (next/prev are swipe gestures only). PanResponder swipe: horizontal = next/prev song, vertical up = expand, vertical down = dismiss + stop playback (returns on new song/queue). Since 2026-10-19 it can render the same fBM field behind the card (`PlayerBackground`, `settings.miniPlayerBackground`, FPS from `miniPlayerFps`, `noiseScale` 1.6, dim 0.25 + theme scrim 0.18 for contrast); the loop passes `paused` while dismissed or keyboard-open and the solid theme background stays under Reduce transparency. |
| BoxDesktopPlayer.js | Mini player for desktop layout (fixed sidebar). Includes progress bar and volume. |
| FullScreenPlayer.js | Full-screen modal player. `preview` is now only COVER \| LYRICS — the queue is a separate `isQueueOpen` overlay, not a third enum value, because two independent gestures would otherwise write the same field. Tapping the cover toggles lyrics (`SlideControl`'s optional `onTap` replaces double-tap play/pause); a `picture-o` button in the top bar is the way back, since the lyrics pane is a FlatList whose rows seek on tap and so cannot also be the tap target. The queue sheet is absolutely positioned over the whole window (controls included): `translateY` starts one window-height below the viewport and tracks the finger 1:1, opened by an upward swipe, closed by dragging its header down / the X / back. `CoverItem` sits in a `coverSlot` (`flex: 1`, centred) so the cover absorbs all leftover height. The deleted bottom button row's height lives in `paddingBottom`, so the control cluster stays put. Transport row: shuffle / prev / play / next / repeat. `onRequestClose` dismisses by layer order (queue → lyrics → player) because Android's bottom-edge back gesture reaches the Modal before any PanResponder. Since the fBM background (2026-10-18) the layout follows the spec's two-container rule: the cover/lyrics `coverPane` (18px padding, 24px radius, cover size formula subtracts it) and the `controlPill` (24px radius, same as the pane, clamped by height); `PlayerBackground` renders absolute-fill below everything (`pointerEvents="none"`), both fills are `rgba(0,0,0,0.35)` (opaque `primaryBack` under Reduce transparency, transparent when the background setting is off) and the queue overlay is a 0.35 black scrim over the same background. When the animated background is on, the top bar + player content sit in an `Animated.View` whose opacity interpolates `queueY` (0 → 1), so the open queue shows only the background underneath, not the player UI. |
| QueueSheet.js | Queue contents (pinned "Now playing" + "Up next" + main queue, plus `OptionsQueue`/`OptionsUpNext`), extracted from `CoverItem` when the queue became a swipe-up overlay. Owns `useQueueDnD` and the two option-popup indexes, so they no longer run on every player render while the cover is showing. Over the animated background (spec §3.3) it adds no containers: rows are wrapped in a 0.9-opacity `styles.row` View and pass `overlay` to `SongItem` for text shadows; the "Now playing"/"Up next"/"Queue" labels get the same shadow. |
| PlayerBackground.native.js / PlayerBackground.web.js | Animated fBM background of the full-screen player (spec 2026-10-18): `expo-gl` GLView, one fullscreen-triangle draw per frame, 5-octave 3D simplex-noise fBM (lacunarity 2, gain 0.5, base frequency 2.4, time on the z axis) mapped across 6 palette slots with an unrolled mix chain (GLSL ES 1.0 only guarantees constant indices into uniform arrays) then dimmed by `u_dim`. Flat output only — no gloss/bloom/blur. 30 fps cap, 450 ms palette crossfade on track change, time axis frozen under the system Reduce Motion setting, loop paused via AppState when backgrounded. Surface sizing is self-healing: expo-gl creates its EGL surface once at mount and ignores later resizes (a mount during an intermediate/other window mode captures a bogus size — e.g. `1313x2028` on a 1080x2520 screen — and the uncovered strip stays frozen), so the component measures itself (`onLayout` → dp × PixelRatio) and remounts the `GLView` (capped, throttled, logged) until `gl.drawingBufferWidth/Height` match the view; `context WxH (view VxV)` is logged at every context creation. Props: `fps` (default 30; the mini player passes the user choice 10-30), `paused` (external pause — used by the mini player when dismissed/keyboard-open, the component stays mounted with `display:none`), `noiseScale` (`u_scale`, default 1 leaves the full-screen shader unchanged; the short pill passes 1.6 so the field still reads). The `.web.js` stub returns null, keeping `expo-gl` out of the web bundle (web keeps the flat background). |
| FullScreenHorizontalPlayer.js | Full-screen horizontal layout of player (desktop); same queue view with right-aligned rows and a drag handle. Since 2026-10-22 it also renders the animated fBM background (`PlayerBackground`) + cover palette when `settings.playerBackground` is on, with translucent `panelFill` panels and the blurred-cover fallback otherwise. |
| QueueDrag.js | Cross-section drag-and-drop for the queue view: `QueueDragProvider` (one manager for both lists — lists are direct children of one container, their `onLayout` `boxY`/`boxH` + the gesture `dy` resolve the drop target with no window-coordinate measurement; region detection uses "Up next" only when that box exists; edge-autoscrolls the active list; springs sibling rows ±`rowHeight` to open a live gap; `bottomAligned` queues get a bottom-pad correction) + `QueueDragRow` (grab-handle PanResponder row; lifted row styled with `backgroundColor`, no elevation). Drop → `moveTrack` (`moveUpNext`/`moveInQueue`/`moveUpNextToQueue`/`moveQueueToUpNext`). |
| Lyric.js | Synchronized lyrics display. Fetches from server, caches locally, falls back to LrcLib API. Keyed on `song.songInfo?.id` (not the songInfo object, which every `setRating`/`syncGlobal` replaced, re-triggering the fetch and flashing "Loading lyrics..."), with a cancellation guard so a late response can't paint the previous track's lyrics. |

### Bar Components (app/components/bar/)
| File | Description |
|---|---|
| TabBar.js | Wrapper that renders `SideBar` or `BottomBar` based on `settings.isDesktop`, plus `Player`, plus `DownloadBanner` + `OfflineBanner` (mobile). |
| BottomBar.js | Bottom tab navigation bar for mobile. |
| SideBar.js | Vertical sidebar tab navigation for desktop. |

### Banner Components (app/components/banner/)
| File | Description |
|---|---|
| DownloadBanner.js | Slim status banner above the mini player when downloads are active: title of the active download, bytes, thin progress line. Tap → `Settings/Downloads`. |
| OfflineBanner.js | Thin "you are offline" strip above the mini player (mobile; desktop sidebar left alone). The only signal that the app silently swapped to downloaded content. |

### Offline Components (app/components/offline/)
| File | Description |
|---|---|
| OfflineSongs.js | Tracks tab while offline: virtualized list/grid of the download index songs, no API/paging. Rows reuse `SongItem` + `PlaylistSwipeRow` + `OptionsSongsList`; playback always hits the cached file. |
| OfflineCollections.js | Grid/list of downloaded albums or playlists (Tracks "albums" view, Playlists tab); tapping opens the Pres screen. Also exports `OfflineCollectionRow` (list row with cover + name/artist), reused by `OfflineSearch`. |
| OfflineSearch.js | Search while offline: case-insensitive local filter over downloaded songs/albums/playlists, rendered as Albums/Playlists/Songs sections. No debounce, no network. |

### List Components (app/components/lists/)
| File | Description |
|---|---|
| HorizontalList.js | Dynamic list that renders the correct horizontal sub-list based on `homeSections` type. |
| HorizontalQueue.js | Horizontal list of queue entries. |
| HorizontalAlbums.js | Horizontal album cover list with LazyLoad. |
| HorizontalArtists.js | Horizontal artist list with LazyLoad. |
| HorizontalGenres.js | Horizontal genre list. |
| HorizontalPlaylists.js | Horizontal playlist list. |
| HorizontalLBStat.js | Horizontal ListenBrainz listening activity stats. |
| RadioList.js | Horizontal radio station list. |
| SongsList.js | Vertical song list used in Pres screens. |
| VerticalPlaylist.js | Vertical playlist list used in Playlists tab. |
| CustomFlat.js | Custom FlatList wrapper with themed styling. |

### Item Components (app/components/item/)
| File | Description |
|---|---|
| SongItem.js | Single song row with cover, title, artist, add-to-playlist circle (`PlaylistButton`), cached indicator. `playsOnPress` (default `true`) decides whether the row calls `playSong` itself — set `false` when `onPress` owns playback (queue-view jumps). The old contract inferred this from `onPress`'s return value, so a handler returning a Promise (always truthy) made the row fire a second `playSong` on top of its own `setIndex`. `overlay` (used by the queue view) adds a subtle black text shadow to title/artist/duration so the row stays legible over the animated background. |
| ExplorerItem.js | Item with cover, title, subtitle for explorer lists. |
| AllItem.js | Grid tile for the `LegendList numColumns={2}` grids (Tracks/Explorer grids, SearchMore, Playlists, ShowAll). Root is `width:'100%'` to fill its numColumns cell. |
| LBAlbumItem.js | Album item from ListenBrainz (used in FreshReleases). |
| PlaylistItem.js | Playlist item for vertical playlist list. |
| HistoryItem.js | Search history item with delete action. |
| GenreItem.js | Genre item for horizontal genre list. |

### Button Components (app/components/button/)
| File | Description |
|---|---|
| PlayButton.js | Play/pause button. Switches icon based on `song.state`. Shows `ActivityIndicator` while loading. When `song.queueEnded` it restarts the queue from the top instead of resuming (resuming an already-ended track did nothing). |
| IconButton.js | Generic icon button using `react-native-vector-icons`. |
| FavoritedButton.js | Heart toggle button (albums, artists, playlists). Long-press opens rating popup. Calls `star`/`unstar` API. Songs/players use `PlaylistButton` instead. |
| PlaylistButton.js | Songs + players replacement for the heart: a drawn circle (the sheet's `SelectCircle` look — 2px ring, check when filled; `size` is the diameter, default 26) whose fill follows the song's starred state (its "Favourited" membership). Drawn rather than a FontAwesome glyph because an outline glyph reads much smaller than the heart it replaced. Tap opens `PlaylistSelectPopup`; long-press keeps the rating popup. Syncs its local fill from the sheet's `onDone` extras since list sources don't re-fetch on close. Hidden while offline (membership + star/unstar need the API). |
| BackButton.js | Back navigation button (white chevron with dark text-shadow halo so it reads over any cover/theme). |
| RotateIconButton.js | Icon button with optional rotation animation on press. |
| RandomButton.js | Shuffle play button. |
| DownloadButton.js | Spotify-style download toggle for an album/playlist/favorited: idle → enqueue, queued spinner, downloading ring with %, paused/error states, done/partial filled circle (tap removes with confirm). Uses `getCollectionState`. |
| SlideBar.js | Progress/slider bar component. |
| SlideControl.js | Wrapper for controlled sliding interaction: horizontal drag = next/prev. Optional `onTap` — when supplied, a single tap calls it and double-tap play/pause is disabled (the portrait player uses it for lyrics; the landscape player omits it and keeps double-tap). Also forwards `onLayout`. |
| SidebarLetter.js | Letter index sidebar for artist navigation. |
| ConnectButton.native.js | Device connection button (Chromecast, etc.). |
| ConnectButton.web.js | Web no-op version of ConnectButton. |

### Settings Components (app/components/settings/)
| File | Description |
|---|---|
| ButtonMenu.js | Menu-style button with icon and end text. |
| ButtonSwitch.js | Toggle switch with title and icon. |
| OptionInput.js | Text input row for forms. |
| OptionText.js | Multiline text input row for forms. |
| TableItem.js | Key-value row for displaying info. |
| SelectItem.js | Selectable item row. |
| HomeOrder.js | Drag-and-drop reordering for home sections. |

### Other Components
| File | Description |
|---|---|
| Header.js | Back arrow + title header used in sub-screens. Optional `right` slot for a trailing action (e.g. list/grid toggle). |
| PresHeader.js | Header for Pres screens with cover image, buttons, and content below. |
| PresHeaderIcon.js | Header with icon above title, used in Explorer and Favorited screens. |
| SectionTitle.js | Section title with optional "show all" button. |
| ImageError.js | Image component with fallback handling (icon or placeholder). |
| Selector.js | Horizontal scrollable selector for choosing a value (e.g., album list type). |

### Search Components (app/components/search/)
| File | Description |
|---|---|
| SearchResults.js | Inline search results used by the Music tab: debounced `search3` fetch, state machine, history (AsyncStorage `search.history`), Artists/Albums/Songs sections (link to SearchMore) + explorer shortcuts. Takes `{ query, setQuery }`. |

### Popup Components (app/components/popup/)
| File | Description |
|---|---|
| OptionsPopup.js | Generic bottom-sheet-style popup with custom options. |
| PlaylistSelectPopup.js | Multi-select "Add to playlist" sheet, shared by all entry points (`OptionsPlayer`, `OptionsSongsList`, `OptionsQueue`, `OptionsAlbum`, `OptionsAlbums`, `PlaylistButton`). Really a **membership editor**: a playlist already containing the song(s) starts with a filled circle, and deselecting it REMOVES them. A partially-containing playlist shows an empty circle and is left alone unless tapped. Membership costs one `getPlaylist` per playlist (capped at 5 concurrent) since `getPlaylists` omits entries. Rows flagged `readonly` by the server (Navidrome: synced from a `.m3u`/`.nsp`, where the file is the source of truth and writes are refused with Subsonic error 50 regardless of owner) are dimmed with a lock and never written. Takes a `songs` prop (`{ id, starred }[]`). The top row is the **Favourited pseudo-playlist**: filled when all target songs are starred, tapping stars only the missing ones, deselecting unstars; applied via `star`/`unstar` + `songDispatch setRating` + `refreshApi getStarred2` (same sync the old heart did). Done button is always enabled; with nothing changed it just closes. `onDone(ok, total, { starred })` reports the resulting Favourited state back to `PlaylistButton`. |
| RatingPopup.js | Star rating selection popup. |
| DiscoveryPanel.native.js | Chromecast device discovery panel (native only). |

### Options Components (app/components/options/)
| File | Description |
|---|---|
| OptionsSongsList.js | Context menu for songs (queue, play next, star, go to artist/album, etc.). |
| OptionsPlaylist.js | Options for playlists (play, shuffle, delete, edit, etc.). |
| OptionsAlbum.js | Album context menu (play, play next whole album, go to artist, star, etc.). |
| OptionsArtist.js | Artist context menu (play shuffled, star, etc.). |
| OptionsMultiArtists.js | Multi-artist selection for navigation. |
| OptionsAlbums.js | Multi-album selection for batch operations. |
| OptionsArtists.js | Multi-artist selection for batch operations. |
| OptionsPlaylists.js | Multi-playlist selection for batch operations. |
| OptionsFavorited.js | Options for the Favorited screen. |
| OptionsPlayer.js | Player options (queue, lyrics, etc.). |
| OptionsQueue.js | Main-queue management (move to top/up/down/bottom, remove from queue, go to artist/album, add to playlist). |
| OptionsUpNext.js | "Up next" management (move to top/up/down/bottom, remove from up next). |

---

## Styles (app/styles/)
| File | Description |
|---|---|
| main.js | Shared styles: main container, titles, subtitles, section titles, cover sizes, text styles. |
| pres.js | Pres screen styles: header container, title, subtitle, buttons, cover. |
| settings.js | Settings screen styles: options containers, option items, title containers. |
| size.js | Centralized dimensions: image sizes, title/text/icon sizes, radius. |

---

## i18n (app/i18next/)
| File | Description |
|---|---|
| i18next.js | Initializes i18next with `initReactI18next`. Loads 10+ language JSON files. |
| utils.js | `localeLang()` detects system language (Android NativeModules / web navigator). |
| *.json | Translation files for: ca, de, en, es, fr, gl, it, ja, ko, pt-br, ru, zh-Hans, zh-Hant. |

---

## Configuration & Root Files
| File | Description |
|---|---|
| App.js | Root React component. |
| index.js | Expo entry point. Registers App and calls `initService()`. |
| app.config.js | Expo config. Defines Android package, splash, icon, plugins (expo-build-properties, edge-to-edge, google-cast, asyncStorage). |
| babel.config.js | Babel config with root-import plugin. |
| metro.config.js | Metro bundler config. |
| eslint.config.mjs | ESLint config. |
| workbox-config.js | Workbox config for web PWA service worker. |
| UI.md | Style comparison vs BitChord + ranked UI/UX improvement guide (no code). |
| docker-compose.yml | Docker compose for development. |
| Dockerfile | Docker build for the app. |
| eas.json | EAS build profiles. |
| plugins/asyncStorage.js | Expo plugin for async-storage. |

---

## Working Function: How the App Runs

### 1. Startup
1. `index.js` calls `registerRootComponent(App)` and `initService()`.
2. `initService()` (native) registers the `servicePlayback.js` background service with `TrackPlayer`.
3. `App.js` initializes i18n, sets global defaults, and renders `AppProvider`.

### 2. Provider Initialization
4. `ConfigProvider` reads saved server config from AsyncStorage.
5. When config loads, `global.config` is set and `initCacheSong()` initializes the song cache directory (native).
6. `SongProvider` initializes the song reducer with `defaultSong`. On app start (Android), waits for AppState "active" before calling `Player.initPlayer()`.
7. `SettingsProvider` reads saved settings from AsyncStorage, merging with `defaultSettings`.
8. `ThemeProvider` resolves the theme based on settings.
9. `UpdateApiProvider` initializes the cache invalidation state.
10. `RemoteProvider` (native) sets up device connection tracking.
11. `PlayerEvent` component calls `Player.useEvent()` to wire native player callbacks into the song reducer.

### 3. Navigation Flow
12. `Navigation.js` renders the bottom tab / sidebar navigator with 4 tabs.
13. `TabBar` checks if `config.query` is null and auto-navigates to Settings if so.
14. When connected, the `Player` component (mini or desktop) renders at the bottom/side.

### 4. Data Flow
15. Screens and components use `useConfig()` to get the server connection.
16. API data is fetched via hooks (`useCachedAndApi`, `useCachedFirst`) or direct calls (`getApi`, `getApiNetworkFirst`).
17. The caching layer (`cache.js`) handles both API response caching (AsyncStorage on native, Cache API on web) and song file caching (expo-file-system on native).
18. When a star/favorite action occurs (`FavoritedButton`, or the Favourited row inside `PlaylistSelectPopup`), the API is called and then `refreshApi()` + `setUpdateApi()` broadcast a cache invalidation that triggers `useCachedAndApi` effects in other components.

### 5. Playback Flow
19. User presses a song (`SongItem.onPress` or `PlayButton.onPress`).
20. `Player.playSong(config, songDispatch, queue, index)` is called.
21. Native: delegates to the active player implementation (Local/Cast/UPnP).
   - Local: calls `LocalPlayer.loadSong()` which converts the track, checks if cached, then calls `TrackPlayer.load()` and `TrackPlayer.play()`.
22. Web: calls `loadSong()` which sets `<audio>.src`, plays, and sets up `MediaMetadata`.
23. Song reducer dispatches `setQueue` action, updating `global.song` and persisting to AsyncStorage.
24. The `Player` component reads `song.state` (via `useSong()`) to render the correct UI.
25. When a song ends:
   - Native: `PlaybackQueueEnded` event in `servicePlayback.js` handles next/previous logic based on `actionEndOfSong` mode (next/repeat/random).
   - Web: `<audio>` `ended` event handler calls `nextSong()` or `reload()` for repeat.
26. Scrobbling: `getApi(config, "scrobble", ...)` is called on track change and song end.

### 6. Remote Playback (Native)
27. User connects a device via `ConnectButton`.
28. `RemoteProvider` detects `selectedDevice` change, calls `Player.connect()`, `Player.switchPlayer()`, and restores playback state on the new device.
29. Playback type switches between `"local"`, `"chromecast"`, `"upnp"` implementations.

