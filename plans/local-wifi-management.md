# Plan: Local WiFi management — optional per-server network + auto-switch

Status: DONE (code shipped, installed on R5CY71GYKWF)
Related TODO: #5 (Local WiFi Management)

## Requirement (user report)
When inserting a server, optionally specify a network: by typing a name **and** by selecting from
known networks of the device. Server should then be used when the device is on that network.

## Research findings
- No network lib installed in `package.json`. Added `expo-network` `~7.1.5` (SDK 53 compatible,
  `npx expo install`). It exposes `Network.getWifiSsid()` (Android). Compiles fine under pnpm autolinking.
- Android SSID constraints: cannot enumerate saved networks on Android 10+; SSID read may require
  location permission + location on. Added `ACCESS_WIFI_STATE` + `ACCESS_FINE_LOCATION` to
  `android/app/src/main/AndroidManifest.xml` manually (no prebuild — would regenerate the android dir).
- Server config is a single JSON under AsyncStorage key `'config'` (`upConfig()` in AddServer/Connect).
  A server list lives in `settings.servers`. `global.config.folderCache` = sanitized url.
- `getWifiSsid()` is Android-only → wrapped in platform-split `app/utils/network.{native,web}.js`;
  web returns null (auto-switch no-op).

## Design
- **`app/utils/network.native.js` / `.web.js`**: `getCurrentNetwork()` → stripped SSID or null.
- **`app/contexts/networkAutoSwitch.js`** (`<NetworkAutoSwitch/>`, mounted in `app/contexts/index.js`):
  on mount + every `AppState` 'active', reads SSID; if a saved server has a matching `network` and is
  not the active config → persist via AsyncStorage + `setConfig` + `Player.resetAudio(songDispatch)`.
- **`app/screens/Settings/AddServer.js`**: "Network (WiFi)" `OptionInput` (manual name) + tappable chips
  (current SSID first, then previously used networks from `settings.networks`) + a "Only connect on this
  network" switch that binds to the current SSID. On connect the `network` field is saved on the server
  and pushed to the `networks` history (deduped, capped at 10).
- **`app/contexts/settings.js`**: `networks: []` in `defaultSettings`.
- **`app/screens/Settings/Connect.js`**: wifi icon on server rows that have a `network` set.
- i18n keys added (en/de): Network, Network Placeholder, Current, Network only.

## Steps
1. `npx expo install expo-network` — DONE
2. platform-split `getCurrentNetwork` — DONE
3. `NetworkAutoSwitch` component + mount — DONE
4. AddServer network field + chips + history — DONE
5. defaultSettings `networks` — DONE
6. Connect row wifi icon — DONE
7. Manifest permissions — DONE
8. eslint (clean), `:app:assembleRelease` (success, 12m), install + launch on R5CY71GYKWF — DONE

## Decisions
- No toggle to enable/disable auto-switch; only servers with a `network` participate.
- History list replaces "known networks" (Android can't enumerate saved networks on 10+).

## Open questions / known ceiling
- `ponytail: current-SSID detection needs location on Android 10+; manual network name + history
  always work. Upgrade path: request runtime location permission (needs expo-location) if SSID reads
  matter for users without location services.
- SSID equality is case-insensitive; quoted SSIDs (iOS) are stripped.

## Shipped / skipped
- All steps shipped. Skipped: runtime location permission prompt (add expo-location + flow when a
  user reports current-network detection failing); per-server "auto-switch" toggle (YAGNI).
