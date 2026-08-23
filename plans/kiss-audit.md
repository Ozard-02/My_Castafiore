# KISS whole-repo audit (ponytail-audit)

## Goal
Scan `app/` (~17k lines) for over-engineering: dead code, reinvented stdlib,
platform-covered deps, single-caller abstractions, duplication. Ranked report,
no fixes applied in this pass.

## Process
1. Deps audit (package.json vs usage).
2. Duplication hunt across screens/components.
3. Dead-export / unused-flag hunt.

## Findings (final, ranked)
See `.log` 2026-08-23 entry for the full list. Headline:
1. Explorer trio + SearchMore + ShowAll twins → shared paged-list hook (~350 ln)
2. Options* menu factories: share/add-to-playlist/goToArtist/move-set/similar (~250 ln)
3. Player core web vs native facade: nextSong/previousSong/playSong/setIndex/
   queue wrappers/clamps duplicated (~180 ln, drift risk)
4. FullScreenPlayer vs HorizontalPlayer: QueuePanel + TimeBar + transport (~140 ln)
5. SideBar vs BottomBar TabRoute (~50 ln); SideBar internal FavoritedItem/PlaylistItem (~35 ln)
6. SearchResults shortcut/section maps (~35 ln)
7. delete: CustomScroll.js (71 ln, 0 importers), clearSongCache both platforms,
   native getCache stub, size.title.large, App.js stale globals

Deps: all 15 runtime deps verified in use — none cuttable.

## Status
- [x] plan created
- [x] scan
- [x] report delivered 2026-08-23
- [x] batch 1 applied 2026-08-23: dead-code deletes + playerCore dedup (~-310 ln,
      eslint clean; device verify pending). See `.log`.
- [ ] batch 2 candidates: Explorer usePagedList (#1), Options factories (#2),
      FullScreenPlayer QueuePanel/TimeBar (#4)
