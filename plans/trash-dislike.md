# Trash / Dislike on radio pill + configurable destination

## Requirement (user)
On the music pill (mini player), **only when reproducing songs from the random button in the Home tab**, show a **Dislike button** near the Like (heart) button. Pressing it adds the current song to the **Trash playlist** and auto-skips to the next song. In Settings, allow editing the default playlist destination. Is it doable?

Answer: yes – `song.radioMode` already tracks random sessions, `addSongToPlaylist` already dedupes, Subsonic `updatePlaylist`/`createPlaylist` are stable.

---

## Research findings

### Radio session tracking
- `song.radioMode` persisted in `app/contexts/song/provider.js:114,317,337` – default `false` `provider.js:338`.
- Set to `true` after every shuffle entry point **after** `playSong` resolves (because `playSong` dispatches `setQueue` which clears it `provider.js:124`):
  - `app/screens/tabs/Home.js:39` `clickRandomSong` → `playSong` → `setRadioMode(true)`
  - `app/components/button/RandomButton.js` (Favorited/Album/Playlist), `app/screens/Pres/Genre.js`, `app/screens/Pres/Artist.js` – same pattern.
- Cleared by any normal playback (`setQueue`) `provider.js:125` and `reset` `provider.js:318`. Survives `restore`.
- `app/utils/playerCore.js:11,62` `extendRadio` + `nextSong` `playerCore.js:62-83` already uses `radioMode` to top up queue when `index === last && !upNext` (`playerCore.js:75`). At last index, `radioMode` extends even with `repeatQueue ON` (fix `radio-loop-exclusions.md`).

### Pill locations
- **Mobile** `app/components/player/BoxPlayer.js:18` – `Animated.View` pill, `PanResponder` swipe. Buttons row `BoxPlayer.js:141-154`: `FavoritedButton` `BoxPlayer.js:142` (guarded on `songInfo.id`, `starredIds.has`) + `PlayButton`. Order requested right-to-left: play, heart, dislike.
- **Desktop** `app/components/player/BoxDesktopPlayer.js:18` – sidebar mini player, not swipeable. Heart `BoxDesktopPlayer.js:50` uses `useCachedFirst getStarred2` inline (not `useStarredIds`).
- **Full-screen** `app/components/player/FullScreenPlayer.js` – NOT in scope (user said pill only). Keep untouched.

### Like button
- `app/components/button/FavoritedButton.js:12` – `heart`/`heart-o`, `theme.primaryTouch`, `getApi star/unstar` + `refreshApi getStarred2` + `setUpdateApi`. No change needed.

### Playlists API
- `app/utils/api.js:62` `addSongToPlaylist(config, playlist, songId)` – fetches `getPlaylist` → check `entry.some(id)` → `updatePlaylist {playlistId, songIdToAdd}`; returns false if already present (dedup, like TODO #19).
- `app/utils/api.js:71` `addSongsToPlaylist` – batch variant, same dedup.
- `app/screens/tabs/Playlists.js:70` `createPlaylist {name}` – creates.
- `app/components/options/OptionsPlaylist.js:58` `updatePlaylist {playlistId, comment}` for exclusive tag.
- Cache invalidation via `refreshApi` + `setUpdateApi` `FavoritedButton.js:32` pattern; `getPlaylists` cached via `useCachedAndApi`.

### Exclusions (Trash already exclusive)
- `app/utils/exclusions.js:8` tag `#<username>-exclusive`, storage `excludedSongs:<url>` `exclusions.js:9`, memory `exclusions.js:11`.
- Trash playlist already marked exclusive by user → `filterExcluded` `exclusions.js:69` already filters its songs from `Home.js:36` `clickRandomSong` and `playerCore.js:23` `extendRadio`. No extra exclusive logic needed.

### Settings
- `app/contexts/settings.js:66` `defaultSettings` – flat object, persisted to AsyncStorage `settings`. `updateGlobalSettings` `settings.js:267` wires globals. Add new keys here.
- `app/screens/Settings/Playlists.js:34` – order/reverse/swipe settings; place for new Dislike destination picker.
- `app/i18next/en.json:256` – strings inside `translation` object.

### Existing Trash concept
- Grep `trash|Trash` – no code, only docs/comments. No conflict.

---

## Decisions (agreed with user 2026-09-03)

- **Autoskip**: yes – after `addSongToPlaylist`, call `Player.nextSong(config, song, songDispatch)` (`playerCore.js:62` via `~/utils/player`).
- **Icon**: `thumbs-down` (FontAwesome) near heart. Not `times`/`trash-o`. Size `size.icon.small` like heart `BoxPlayer.js:146`.
- **Destination**: user can **select an existing playlist**. Store `settings.trashPlaylistId` (string id) + `settings.trashPlaylistName` (display). Picker in Settings lists `getPlaylists` results. User already has exclusive Trash playlist → select it.
- **Also on desktop pill**: yes – same conditional button in `BoxDesktopPlayer.js`.
- **Trash exclusive**: already exclusive – no code to mark; adding to it implicitly excludes from future radio via existing `exclusions.js`.
- **Storage choice**: `id` primary (exact), `name` fallback for cross-server robustness. Servers share library (TODO #14 seamless switch – ids match), so id is portable today. On `dislike`, resolve: try `id` via `getPlaylist`, else lookup by `name` (case-insensitive), else `createPlaylist {name: trashPlaylistName || 'Trash'}`. `ponytail:` prefer `id` – add name fallback only if cross-server diverge.
- **Create if missing**: yes – `createPlaylist` then `addSongToPlaylist`.

---

## Design

### New file `app/utils/trash.js`
```js
import { getApi, addSongToPlaylist } from '~/utils/api'
import logger from '~/utils/logger'

export const resolveTrashPlaylistId = async (config, settings) // → {id, name} or null
  // 1. if settings.trashPlaylistId → try getPlaylist {id} → return if ok
  // 2. else search getPlaylists → find by name === settings.trashPlaylistName (case-ins) → return
  // 3. else createPlaylist {name: settings.trashPlaylistName || 'Trash'} → return new id

export const dislikeSong = async (config, settings, songId)
  // resolve id → addSongToPlaylist(config, {id}, songId) → return boolean
```

Reuse `addSongToPlaylist` dedup; catch and `logger.error('trash', ...)`, return false.

### Pill changes

**BoxPlayer.js** `BoxPlayer.js:18`
- Imports: `IconButton`, `useSettings` (or `useSetSettings` if needed), `dislikeSong`, `Player`.
- Hook: `const settings = useSettings()`
- Conditional before heart or between heart and play (chosen: `thumbs-down | heart | play` to keep play at edge):
```jsx
{song.radioMode && song?.songInfo?.id && (
  <IconButton icon="thumbs-down" size={size.icon.small} color={theme.secondaryText}
    style={{ paddingVertical:5, paddingHorizontal:6 }}
    onPress={async ()=>{
      const ok = await dislikeSong(config, settings, song.songInfo.id).catch(()=>false)
      if (ok !== false) Player.nextSong(config, song, songDispatch)
    }}
  />
)}
```
- Keep `FavoritedButton` guard `song?.songInfo?.id` already there.

**BoxDesktopPlayer.js** `BoxDesktopPlayer.js:18` – same conditional, same handler, same placement next to `FavoritedButton` `BoxDesktopPlayer.js:50`. Desktop heart currently uses `useCachedFirst` inline; keep, but dislike uses same `settings` + `config`.

### Settings picker

**`app/screens/Settings/Playlists.js:34`**
- New section at top: title `Dislike playlist` + description `Choose where disliked songs go (only in radio mode)`.
- Fetch: `const [playlists] = useCachedAndApi([], 'getPlaylists', null, (j,s)=>s(j.playlists.playlist||[]), [])`
- Map to `SelectItem` per playlist: `isSelect={p.id===settings.trashPlaylistId}`, `onPress=>setSettings({...settings, trashPlaylistId:p.id, trashPlaylistName:p.name})`
- Footer hint: if `settings.trashPlaylistId` but not in list → text `Previously selected playlist not found – will be created as "Trash"`.
- No free-text `OptionInput` initially (YAGNI – picker covers existing; create via `createPlaylist` fallback). Add when user requests custom name.

### Settings defaults

**`app/contexts/settings.js:66`**
```js
trashPlaylistId: null,
trashPlaylistName: 'Trash',
```

### i18n

**`app/i18next/en.json`** inside `translation`:
- `Dislike` (if not present), `Dislike playlist`, `settings.playlists.Dislike playlist Description`, `Added to Trash` (optional toast later).

No other locales required – fallback to en.

---

## Steps

- [ ] Create this plan file `plans/trash-dislike.md` (this file) and keep updated.
- [ ] Add `trashPlaylistId`/`trashPlaylistName` to `defaultSettings` in `app/contexts/settings.js`.
- [ ] Create `app/utils/trash.js` with `resolveTrashPlaylistId` + `dislikeSong`.
- [ ] Wire `BoxPlayer.js` – conditional `thumbs-down` + handler (autoskip).
- [ ] Wire `BoxDesktopPlayer.js` – same.
- [ ] Add Dislike playlist picker section in `app/screens/Settings/Playlists.js`.
- [ ] Add i18n keys in `app/i18next/en.json` (and `de.json` if present).
- [ ] Verify: `eslint` clean, `getApi`/`getPlaylists` mock sanity.
- [ ] Build `JAVA_HOME=/usr/lib/jvm/java-17-openjdk ./android/gradlew -p android app:assembleRelease -x lint -x test` and install.
- [ ] Manual verify:
  - Home → Random Song → pill shows `thumbs-down` next to heart → tap → song appears in Trash playlist (check via Playlists → Trash) + playback advances to next track.
  - Play album normally (not radio) → pill shows no thumbs-down.
  - Radio session that tops up via `extendRadio` → still shows.
  - Settings → Playlists → Dislike playlist picker → select different playlist → next dislike goes there.
  - Trash already exclusive → disliked songs no longer appear in subsequent Home Random fetches (filterExcluded).
- [ ] Update `TODO.md` and `STRUCTURE.md` (settings + trash util + player pills).

---

## Edge cases & handling

- **No config / offline**: `dislikeSong` early return `if (!config?.url) return false`; handler no-ops; `catch` logged.
- **Song already in Trash**: `addSongToPlaylist` returns `false` → still autoskip (user intent: remove from flow).
- **Selected playlist deleted**: `getPlaylist` throws → fallback to name search → `createPlaylist`.
- **Multiple servers**: `config.url` keyed; `trashPlaylistId` stored globally but resolved per-server via fallback; safe because library shared (TODO #14).
- **Rapid double-tap**: second call hits same `songId` → `addSongToPlaylist` dedupes, second `nextSong` dedupes via `loadingKey` `playerCore.js:36`.
- **Empty Trash name**: fallback to `'Trash'`.
- **RadioMode false**: button not rendered – no handler leak.

---

## Alternatives considered & skipped

- Store only `trashPlaylistName` (lookup each time) – skipped: id is more exact, picker already gives id.
- Mark Trash as exclusive on dislike – skipped: user already has exclusive Trash; adding generic `updatePlaylist comment` would duplicate `OptionsPlaylist.js:54` logic.
- Show dislike also in `FullScreenPlayer.js` – skipped: user said pill only.
- Toast/snackbar on success – skipped: ponytail, add when requested; `logger.info` sufficient.

---

## Open questions (resolved)

- Autoskip? → **yes**.
- Icon? → **thumbs-down**.
- Select existing? → **yes, picker**.
- Desktop pill? → **yes**.
- Trash exclusive? → **already exclusive**, no extra code.

---

## What shipped / skipped / deferred

- Shipped: plan file only (this file). Implementation deferred until user approves build.
- Deferred: free-text custom Trash name input (picker covers it), toast feedback, per-server id map (YAGNI).
