# UI/UX Consistency Pass (TODO #16)

Goal: unify look & behavior across screens. User chose: skip the code refactor, go straight to UI consistency.

## Findings (from code, verifying the TODO review notes)

1. **Navigation mix** — `useNavigation()` hook (Home.js, Playlist.js, BackButton.js) vs `navigation` prop
   (`tabs/Playlists.js`, `Pres/Album.js`). → standardize on the hook.
2. **Search/input styles differ (3 looks)** — (a) Tracks inline search (`secondaryBack`, radius 10,
   absolute search icon, fragile padding); (b) Playlist overlay search (`rgba(0,0,0,0.45)` + white text);
   (c) Playlists tab new-playlist name (`gray border, radius 6`). → extract one shared inline
   search-input style; keep the overlay one distinct (it sits over cover art).
3. **Hardcoded colors break light themes** — `BackButton` chevron `#fff`; `PresHeaderIcon` cover
   `#c68588` + icon `#cd1921`. → theme-aware + dark halo behind back button.
4. **Grid/list toggle** — `Tracks.js` hardcoded `size 22` vs `tabs/Playlists.js` `size.icon.small` (23).
   → use `size.icon.small` in both.
5. **Explore entry points** — SearchResults explorer boxes (flex:1, `secondaryBack`, radius 10) vs
   Tracks `Selector` pills (radius 20, `primaryTouch`). → PENDING user choice (both navigate to the
   same Explorer screens).
6. **Selected affordance** — Selector pill bg, SelectItem `check`, OptionsPopup sort `check`.
   → PENDING user choice (pick one idiom).
7. **Status-bar handling** — Home/Playlists/Settings: fixed `<View height={insets.top}>`; Tracks:
   `paddingTop: insets.top` (scrolls away). → make Tracks use the fixed View pattern.
8. **Tab header/title margins** — `mainTitle` (margin 20/30) overridden in Playlists header and
   `flex:1` in Tracks. → standardize (drop overrides where safe).
9. **Magic offsets** — Playlist searchbar `top: insets.top + 55`, BoxPlayer bottom `+59`. → leave as-is
   (they are anchored to different elements; tokenizing adds indirection for no visual gain).

## Steps
- [x] Research all target files (done) + user decisions: explore entry-point idiom = **pills over boxes**, selected affordance = **check icon everywhere**
- [x] #1 Navigation: converted all screens to `useNavigation()` hook (Playlists, Settings, Album, Artist, ArtistAlbums, Connect, AddServer, ShowAll native+web, UpdateRadio, DownloadBanner); navigator render-prop bars keep the prop
- [x] #2 Shared inline search-input style (`mainStyles.searchBox` + `searchInput`) in main.js; applied to Tracks + Playlists new-playlist field; Playlist overlay search stays distinct (over cover art)
- [x] #3 PresHeaderIcon cover/icon → theme-aware (`secondaryBack`/`primaryTouch`); BackButton white chevron + dark text-shadow halo
- [x] #4 Tracks grid toggle uses `size.icon.small`
- [x] #5 SearchResults explorer boxes → pill styling (radius 20, secondaryBack) matching Selector
- [x] #6 Selector selected pill now shows a leading check icon
- [x] #7 Tracks status-bar → fixed `<View height={insets.top}>` pattern
- [x] #8 Title margins: reviewed, both screens already render the same 20/30 rhythm — no change
- [ ] ~Magic offsets (Playlist searchbar / BoxPlayer): skipped (YAGNI — different anchor elements)~
- [x] eslint (full `app`) clean + release build + install APK

## Shipped
- Navigation hook everywhere, shared search-input styles, theme-aware PresHeaderIcon + BackButton halo,
  size.icon.small grid toggle, SearchResults pills, Selector check icon, Tracks fixed status bar.
- Skipped: magic-offset tokenization (different anchor elements, no visual gain). Revisit if a shared
  header component emerges.
