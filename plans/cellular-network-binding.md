# Plan: Bind server to Cellular data too (auto-switch)

Status: DONE
Related TODO: #5 (Local WiFi Management) — extension

## Goal
Currently a server can be bound to a WiFi SSID; auto-switch only reacts to WiFi.
User wants: also bind a server to "Cellular data" — while on mobile data, auto-switch
to that server. Keep the WiFi logic unchanged; make the AddServer network selector offer
"WiFi SSID" OR "Cellular data".

## Research
- `app/utils/network.native.js`: `getCurrentNetwork()` = `NetInfo.fetch('wifi')` → ssid,
  returns null on cellular (and `networkAutoSwitch` short-circuits on null → no cellular handling).
- `app/contexts/networkAutoSwitch.js`: `decide()` — finds server whose `network` matches ssid,
  remembers `lastFallback` (AsyncStorage) when switching, falls back on leaving the bound network.
- `server.network` is a free-text SSID string. AddServer stores it; Connect.js shows a wifi icon
  when set. No server-edit flow (AddServer is add-only) — only AddServer + decide() need changes.

## Decisions
- Reserved token `CELLULAR_NETWORK = '__cellular__'` stored in `server.network` (collision-proof
  vs real SSIDs, no schema change). Exported from `utils/network`.
- `network.native.js`: add `getNetworkInfo()` → `{ type: 'wifi', ssid }` | `{ type: 'cellular' }`
  | `{ type: 'none' }` (via `NetInfo.fetch()` with no arg). Keep `getCurrentNetwork()` as ssid-only
  wrapper for AddServer wifi detection. Web stub returns `{ type: 'none' }`.
- `decide()`: none/unknown or wifi-without-ssid → return (conservative, matches old behavior).
  Cellular → match server with `network === CELLULAR_NETWORK`; WiFi → match by ssid (skip CELLULAR token).
  Leaving-bound check: `activeBound === CELLULAR ? isCellular : ssid matches` → else fallback
  (lastFallback, then first server with no `network`). This also fixes the old gap where leaving a
  bound WiFi for cellular did nothing (old code returned early on null ssid).
- AddServer UI: cellular chip (icon `mobile`) alongside SSID chips sets `network = CELLULAR_NETWORK`;
  field shows translated "Cellular data" label while bound to cellular. `settings.networks` history
  keeps only real SSIDs (exclude the token).
- i18n en/de: rename `Network (WiFi)` → `Network`, add `Cellular` key.

## Steps
1. network.native.js / network.web.js: `getNetworkInfo()` + `CELLULAR_NETWORK` export. — DONE
2. networkAutoSwitch.js: rewrite `decide()` for cellular + leaving-network fallback on cellular. — DONE
3. AddServer.js: cellular chip + field label + networks-history filter. — DONE
4. i18n en/de keys. — DONE
5. eslint + rebuild + install + smoke-test. — DONE
6. Docs (.log, TODO #5, plans). — DONE
7. Commit + push. — TODO

## Skipped
- Nothing (feature is intentionally small).
