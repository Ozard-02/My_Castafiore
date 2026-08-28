# Fix: radio loop (same 50) + exclusions never filtering

## Problem
1. Home "Random Song" loops the same 50 songs instead of enqueueing new ones.
2. Songs from a playlist marked "Exclude from shuffle" still appear from the Home random button.

## Root causes
1. **Radio loop**: `settings.repeatQueue` defaults to `true` (`contexts/settings.js:109`), and
   `playerCore.nextSong` gated the radio top-up on `!global.repeatQueue`. With repeat ON the
   extend branch never fired → queue wrapped via modulo → same 50 loop forever.
2. **Exclusions dead**: `exclusions.js` keyed memory + AsyncStorage on `config.folderCache`,
   but `useConfig()` returns the stored config (`{name,url,username,query,type,network}`,
   `AddServer.js:96`), which has no `folderCache` — only `global.config` does (config.js:28).
   Every `if (!config?.folderCache) return new Set()` guard fired → excluded set always empty →
   `filterExcluded` never filtered. Feature dead since cf9f526. The server-side `#user-exclusive`
   tag was always written correctly; only the local set was broken.

## Fix
- `app/utils/playerCore.js` `nextSong`: at the last index, radio mode always extends
  (repeatQueue ignored); non-radio keeps prior behavior (stop when repeat OFF, wrap when ON).
- `app/utils/exclusions.js`: key on `config.url` instead of `config.folderCache`
  (storage key, memory key, undefined-guards, invalidate).

## Steps
- [x] playerCore last-index branch restructured
- [x] exclusions keyed on config.url
- [x] eslint clean
- [x] build + install (JDK 17)
- [ ] on-device verify: radio keeps pulling new songs; excluded playlist songs absent from
      Home random (no re-toggle needed — set re-derives on press)

## Notes
- Existing AsyncStorage `excludedSongs:*` keys were never written (broken guard) → no migration.
- extendRadio still returns false (offline / zero fresh songs) → playback stops cleanly, no wrap.
- RandomButton/Genre/Artist radio sessions also benefit from the repeatQueue decoupling.