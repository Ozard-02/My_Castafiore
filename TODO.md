# Castafiore Roadmap & Planned Features

## Planned Features

1. **Different Queue Management**
   - Add queue reordering via drag-and-drop
   - Show queue as a modal/list with move-to-top, move-to-bottom, remove options
   - Separate "up next" queue from the full playback queue
	 - Shuffle should  act only on actual queue not up next

2. **Whole Album Play Next** ✅ done
   - Add "Play next" option for entire albums (queue all album tracks after current song)
   - Add to context menu on Album screens and album-level options

3. **Swipe When Minimized**
   - Enable swipe gestures on the mini player (BoxPlayer/BoxDesktopPlayer) to dismiss or expand
   - Enable swipe gestures (left/right) to navigate btw songs

4. **Better Download Management**
   - Dedicated Downloads screen in settings: list cached songs, pause/resume, remove individually or in bulk
   - Show download progress in player/queue UI
	 - Select download quality

5. **Local WiFi Management**
   - I can already insert more than onw server, nut i have to swhich manually, i want this to be network specific, not just wifi/data but select a spsecific wifi network and it will switch automatically

6. **Lyrics Background** ✅ done
   - when showing lyrics use album art as background but with some transparency blur effect

7. **Search Grid (not list)** ✅ done
   - Add grid view option for search results (artists, albums, songs)
   - Toggle between list and grid view for search results

8. **Tracks Tab (5th bottom bar element)** ✅ planned — no implementation yet
   - Add a fifth element "Tracks" to the bottom bar. Pressing it opens a page with all tracks.
   - On top of that page: buttons to switch between **Songs / Albums / Artists** views.
   - In each view, a toggle between **grid** and **list** layout.
   - Remove the Favorited/Favorites section from the Playlists tab.

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
