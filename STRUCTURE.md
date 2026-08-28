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
- **SongProvider**: Music playback state via a reducer (`songReducer`). Holds main queue (`queue`), a separate "up next" list (`upNext`), current index, playback state, action-on-end-of-song mode, and `radioMode` (endless-shuffle flag set by random/shuffle buttons, cleared by any normal playback).
- **SettingsProvider**: App settings (theme, language, home layout, cache, player prefs). Persists to AsyncStorage. Exports `defaultSettings` and `homeSections`.
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
- `updateGlobalSettings()` sets globals: `streamFormat`, `maxBitRate`, `cacheNextSong`, `isSongCaching`, `saveQueue`, `repeatQueue`.
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
Platform-agnostic logic used by both `player.native.js` and `player.web.js`: `createSongControls({ loadSong })` (returns `playSong`/`nextSong`/`previousSong`/`setIndex` — the backend only supplies its `loadSong`), plus `setRepeat`, `secondToTime`, and all queue-mutation dispatchers (`removeFromQueue`, `addToQueue`, `addToUpNext`, `removeFromUpNext`, `moveUpNext`, `moveInQueue`, `moveTrack`). Both platform files re-export these, so consumers see one identical API on every platform. Endless-shuffle radio: when a session started via a random/shuffle button (`song.radioMode`) drains queue + up next (and `!repeatQueue`), `nextSong` calls `extendRadio()` — fetches `getRandomSongs size=50`, filters exclusions, dedupes vs current queue, appends via `addToQueue`, then advances using fresh `global.song.queue`.

### app/utils/player.js (platform-resolved)
- **Native** (`player.native.js`): Delegates to `LocalPlayer`, `CastPlayer`, or `UpnpPlayer` based on the current `type` variable (`"local"`, `"chromecast"`, `"upnp"`). Provides `connect()`, `disconnect()`, `switchPlayer()`, `saveState()`, `restoreState()`. Song navigation + queue mutations come from `playerCore.js`.
- **Web** (`player.web.js`): Uses the HTML5 `<audio>` element. Implements playback controls (load/pause/seek/volume) and MediaSession API integration; song navigation + queue mutations come from `playerCore.js`.

### app/utils/player/ - Native Player Implementations
| File | Description |
|---|---|
| `playerLocal.native.js` | `react-native-track-player` based local playback. Handles download/caching of songs. |
| `playerCast.native.js` | Google Cast (Chromecast) playback via `react-native-google-cast`. |
| `playerUpnp.native.js` | UPnP / DLNA playback. |

### app/utils/playerState.js
Playback state enum: `Playing`, `Paused`, `Stopped`, `Loading`, `Error`, `None`.

### app/utils/cache.js (platform-resolved)
| Platform | Implementation |
|---|---|
| `cache.native.js` | AsyncStorage for API cache; `expo-file-system` for song cache (downloads folder). `initCacheSong()` sets up `global.listCacheSong`. |
| `cache.web.js` | Uses browser `Cache` API and service worker. API cache handled by SW fetch handler. |

### app/utils/downloadManager.js (platform-resolved) — Downloads
| Platform | Implementation |
|---|---|
| `downloadManager.native.js` | Spotify-style download manager: **parallel** queue engine (fills up to `global.parallelDownloads` slots, default 3) built on `DownloadResumable` (pause/resume survives restarts), per-server persistence (`downloadQueue:/downloadIndex:/downloadCollections:` keys in AsyncStorage), rolling 10s speed tracker, collection records (one album/playlist = removable unit). Cache-ahead downloads are flagged `silent` so the banner/progress UI ignores them. O(1) lookups via a `queueById` map rebuilt in `setState`. Exposes `useDownloads()` (useSyncExternalStore), `enqueueSong`, `enqueueCollection`, `pauseDownload`, `resumeDownload`, `retryDownload`, `cancelDownload`, `cancelCollection`, `resumeCollection`, `removeSong`, `removeSource`, `clearAllDownloads`, `getCollectionState`, `getSongState`, `getDownloadedSongs`, `getDownloadSpeed`, `formatSpeed`, `formatBytes`. Initialized in `config.js` alongside `initCacheSong()`. |
| `downloadManager.web.js` | No-op stub (offline handled by the service worker). Same exports + `useDownloads`. |

### Other Utils
- **url.js**: `urlCover()` resolves cover art URLs (handles navidrome/ampache/generic Subsonic types). `urlStream()` resolves audio stream URLs.
- **tools.js**: `shuffle()`, `saveQueue()`.
- **exclusions.js**: Negative playlists — songs of playlists tagged `#<username>-exclusive` in their comment (same mechanism as pins) are excluded from the Home random-shuffle button. Per-server ID set (`excludedSongs:<folderCache>` in AsyncStorage + memory cache), refreshed on toggle in `OptionsPlaylist` and before every Home random click (`refreshExcludedSongIds`). `filterExcluded()` is the single filter point (`Home.js clickRandomSong`, `playerCore.extendRadio`).
- **albumActions.js**: `addAlbumToQueue(config, songDispatch, albumId, asNext)` — fetches album songs and queues them (or plays the album when no queue is active). Used by swipe actions on album rows (AlbumExplorer, SearchMore).
- **lrc.js**: `parseLrc()` parses LRC-format lyrics into `{ time, text }` objects.
- **logger.js**: In-memory log buffer (`global.logs`, max 1000 entries). Provides `info()`, `debug()`, `error()`, `get()`.
- **alert.js**: `confirmAlert()` - cross-platform confirm dialog (native `Alert` / web `window.confirm`).
- **useKeyboardIsOpen** (platform-resolved): Native uses Keyboard API; Web returns `false`.
- **PlaylistSwipeRow.js**: Generic swipeable row (playlist rows, Music tab songs/albums, search results). Actions per direction from `settings.swipeRightAction`/`swipeLeftAction` (queue / play next / remove / action menu (left only) / none); configured action is revealed as a hint during the drag (layers always mounted behind an opaque row); 'menu' keeps the remove+play-next panel with parent-driven `open` state (safe with LegendList row recycling).
- **useQueueDnD.js**: All queue drag-and-drop state shared by both full-screen players: list refs (`scroll`/`upNextScroll`), scroll offsets, viewports, `onLayout` box positions (`boxY`/`boxH`), `rowHeight`, the `isCurrentInQueue`/`queueItems` derivation (queue **rotated** to start at the current song — next song first, previous songs wrapped to the bottom; current song stays pinned above, `song.queue` remains the source of truth), `queueRealIndex` (display→real index mapping `(index + 1 + i) % queue.length`), the `lists` memo for `QueueDragProvider`, `handleMove` (routes through `Player.moveTrack`), and the scroll-to-top effect. Options: `bottomAligned` (desktop flex-end queue), `scrollAnimated`.

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
| Home.js | Renders home feed from `homeSections` config. Random song button, server scan trigger, refresh. |
| Tracks.js | Music tab (4th tab position, no separate Search tab). Search bar on top (shared `mainStyles.searchBox`/`searchInput`); when empty shows the Selector (Songs/Albums/Artists, selected pill shows a check icon) + explorer; typing swaps to inline `SearchResults`. Grid/list toggle persists `gridView`. Fixed status-bar View pattern. |
| Playlists.js | Lists user playlists (sorted, with pin filtering). Add playlist inline. Favorites section removed. |
| Settings.js | Master settings screen with navigation to sub-screens. App version, connect status, theme/language/cache/player/home/playlists/shares settings. |

### Pres Screens (app/screens/Pres/)
| File | Description |
|---|---|
| Album.js | Album detail: track list, header with cover, favorited/random buttons. Fetches via `getAlbum` API. |
| Artist.js | Artist detail: biography, albums sorted by year, top songs, similar artists, favorited songs. |
| ArtistAlbums.js | Grid/list of an artist's albums. |
| Favorited.js | List of starred/favorited songs. |
| Genre.js | Genre landing: albums by genre, artists extracted from albums/songs, song list. |
| GenreAlbum.js | Paginated list of albums in a genre. |
| GenreSong.js | Paginated list of songs in a genre. |
| Playlist.js | Playlist detail with song list, optional reverse order, queue options. |
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
| Theme.js | Theme and player theme selector. |

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
| BoxPlayer.js | Mini player (mobile, fixed at bottom). Cover, title, artist, cast + favourite + play/pause buttons (next/prev are swipe gestures only). PanResponder swipe: horizontal = next/prev song, vertical up = expand, vertical down = dismiss + stop playback (returns on new song/queue). |
| BoxDesktopPlayer.js | Mini player for desktop layout (fixed sidebar). Includes progress bar and volume. |
| FullScreenPlayer.js | Full-screen modal player with cover, queue view (pinned "Now playing" + "Up next" + main queue). Transport row: shuffle / prev / play / next / repeat (shuffle+repeat tinted when active). Bottom row: lyrics toggle, cast, queue. Lyrics background fills the whole screen. The current song is shown only in the pinned row — it is filtered out of the queue list (display-level). |
| FullScreenHorizontalPlayer.js | Full-screen horizontal layout of player (desktop); same queue view with right-aligned rows and a drag handle. |
| QueueDrag.js | Cross-section drag-and-drop for the queue view: `QueueDragProvider` (one manager for both lists — lists are direct children of one container, their `onLayout` `boxY`/`boxH` + the gesture `dy` resolve the drop target with no window-coordinate measurement; region detection uses "Up next" only when that box exists; edge-autoscrolls the active list; springs sibling rows ±`rowHeight` to open a live gap; `bottomAligned` queues get a bottom-pad correction) + `QueueDragRow` (grab-handle PanResponder row; lifted row styled with `backgroundColor`, no elevation). Drop → `moveTrack` (`moveUpNext`/`moveInQueue`/`moveUpNextToQueue`/`moveQueueToUpNext`). |
| Lyric.js | Synchronized lyrics display. Fetches from server, caches locally, falls back to LrcLib API. |

### Bar Components (app/components/bar/)
| File | Description |
|---|---|
| TabBar.js | Wrapper that renders `SideBar` or `BottomBar` based on `settings.isDesktop`, plus `Player`, plus `DownloadBanner` (mobile). |
| BottomBar.js | Bottom tab navigation bar for mobile. |
| SideBar.js | Vertical sidebar tab navigation for desktop. |

### Banner Components (app/components/banner/)
| File | Description |
|---|---|
| DownloadBanner.js | Slim status banner above the mini player when downloads are active: title of the active download, bytes, thin progress line. Tap → `Settings/Downloads`. |

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
| SongItem.js | Single song row with cover, title, artist, favorited button, cached indicator. |
| ExplorerItem.js | Item with cover, title, subtitle for explorer lists. |
| AllItem.js | Grid tile for the `LegendList numColumns={2}` grids (Tracks/Explorer grids, SearchMore, Playlists, ShowAll). Root is `width:'100%'` to fill its numColumns cell. |
| LBAlbumItem.js | Album item from ListenBrainz (used in FreshReleases). |
| PlaylistItem.js | Playlist item for vertical playlist list. |
| HistoryItem.js | Search history item with delete action. |
| GenreItem.js | Genre item for horizontal genre list. |

### Button Components (app/components/button/)
| File | Description |
|---|---|
| PlayButton.js | Play/pause button. Switches icon based on `song.state`. Shows `ActivityIndicator` while loading. |
| IconButton.js | Generic icon button using `react-native-vector-icons`. |
| FavoritedButton.js | Heart toggle button. Long-press opens rating popup. Calls `star`/`unstar` API. |
| BackButton.js | Back navigation button (white chevron with dark text-shadow halo so it reads over any cover/theme). |
| RotateIconButton.js | Icon button with optional rotation animation on press. |
| RandomButton.js | Shuffle play button. |
| DownloadButton.js | Spotify-style download toggle for an album/playlist/favorited: idle → enqueue, queued spinner, downloading ring with %, paused/error states, done/partial filled circle (tap removes with confirm). Uses `getCollectionState`. |
| SlideBar.js | Progress/slider bar component. |
| SlideControl.js | Wrapper for controlled sliding interaction. |
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
18. When a star/favorite action occurs (`FavoritedButton`), the API is called and then `refreshApi()` + `setUpdateApi()` broadcast a cache invalidation that triggers `useCachedAndApi` effects in other components.

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

