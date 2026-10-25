# Mood mixes (daily / weekly home playlists)

Date: 2026-10-25. Status: implemented; web bundle + eslint pass. Not yet tried on a device.

## Goal
Show two optional Home sections, each with five generated playlists of 50 tracks:
- `mood-daily`: five daily mixes, refreshed when the local day changes.
- `mood-weekly`: five weekly mixes, refreshed when the ISO week changes.

Each slot picks a random theme from a catalog larger than ten themes. Themes are stable
for the period and change only when the slot expires. No per-theme settings; the only
settings entries are the two Home section toggles/order rows (`mood-daily`, `mood-weekly`).
Offline: both sections are absent (Home already renders its offline branch instead).

## Approach
- `app/utils/moodPlaylists.js`
  - themes catalog + matcher (`moods`, `genres`, `bpm`, `year`, recent).
  - one shared `getRandomSongs(size=500)` pool per server, deduped and filtered through
    the existing negative-playlist exclusions.
  - seeded shuffle per `group + period + theme`, so a mix is stable inside its period.
  - cache `{ periodKey, group, playlists }` in AsyncStorage, scoped by server URL + username.
  - daily key = local `YYYY-MM-DD`; weekly key = ISO `YYYY-Www`.
  - when a group expires, pick five themes from the catalog (avoiding themes currently used
    by the other group when possible).
- `app/components/lists/HorizontalMoodMixes.js`
  - renders the five mixes as sub-rows with `HorizontalSongs`.
- `app/components/lists/HorizontalList.js`
  - handles `type: 'mood'` without API path/query; renders `HorizontalMoodMixes`.
- `app/contexts/settings.js`
  - two `homeOrderV2` entries, default disabled.
  - two `homeSections` entries (`Daily Mixes`, `Weekly Mixes`).
- i18n: section titles + theme names (en/it; other locales fall back to en).

## Decisions
- 5 + 5 playlists, 50 tracks each (10 total).
- One shared pool, not one request per mix.
- Cache stores song objects so each mix stays stable for its period.
- Stale cache is used as a fallback if the server request fails while online.
- Theme selection is deterministic from server + group + period; it looks random but is
  reproducible and requires no extra persisted state.

## Open questions / deferred
- A local library index (AsyncStorage/SQLite) if rare themes cannot reach 50 tracks.
- Cross-group duplicate songs are allowed; duplicates inside one mix are not.
