# Plan: Local WiFi management — optional per-server network + auto-switch

Status: DONE (v2 — fixed, installed on R5CY71GYKWF)
Related TODO: #5 (Local WiFi Management)

## v2 fix (user report: toggle couldn't press, literal `settings.addServer.Network` shown)
- **Root cause 1**: i18n keys were added under the `settings.connect` block but the code read
  `settings.addServer.*` → literal key rendered.
- **Root cause 2**: `expo-network` **v7.1.5 removed `getWifiSsid()`** entirely → `Network.getWifiSsid()`
  was `undefined`, every call threw, `getCurrentNetwork` always returned `null` → the toggle had
  nothing to fill and the current-network chip never appeared. The toggle was pressable; it just no-opped.
- **Fix**: swapped `expo-network` for `@react-native-community/netinfo` (v11.4.1). SSID read via
  `NetInfo.fetch('wifi')` → `details.ssid` (requires runtime `ACCESS_FINE_LOCATION` + location on,
  requested via `PermissionsAndroid` in `requestLocationPermission()` — no extra dep).
- Toggle reworked per user proposal: pressing "Use current network" requests location (first time),
  detects the connected SSID, and **fills the network field**; failure shows an inline hint instead of
  a silent no-op.
- Auto-switch is now **bidirectional**: match → switch to the bound server (remembering the
  manually-used server as `lastFallback` in AsyncStorage); no match + active server is bound to
  another network → switch to `lastFallback` (or first non-bound server if the remembered one was
  deleted). Listens on NetInfo network-change events + AppState 'active' + on mount.

## Requirement (user report)
When inserting a server, optionally specify a network: by typing a name **and** by selecting from
known networks of the device. Server should then be used when the device is on that network.
Fallback behavior (decided with user): when NOT on any bound network → return to the last
manually-used server.

## Research findings
- `expo-network` no longer exposes SSID (removed). `netinfo` `state.details.ssid` is the Android
  path (official RN community module, in Expo SDK). Compiles fine under pnpm autolinking.
- Android SSID constraints: cannot enumerate saved networks on Android 10+; SSID read requires
  `ACCESS_FINE_LOCATION` granted at runtime + location services on.
  `ACCESS_FINE_LOCATION` added to `android/app/src/main/AndroidManifest.xml` manually (no prebuild —
  would regenerate the android dir).
- Server config is a single JSON under AsyncStorage key `'config'` (`upConfig()` in AddServer/Connect).
  A server list lives in `settings.servers`. `global.config.folderCache` = sanitized url.
- `NetInfo.fetch('wifi')` forces a fresh read (avoids cached state after permission grant).

## Design
- **`app/utils/network.native.js` / `.web.js`**: `getCurrentNetwork()` → stripped SSID or null;
  `requestLocationPermission()` → `PermissionsAndroid` result. Web returns null (auto-switch no-op).
- **`app/contexts/networkAutoSwitch.js`** (`<NetworkAutoSwitch/>`, mounted in `app/contexts/index.js`):
  bidirectional state machine (see v2 fix). AsyncStorage key `lastFallback`.
- **`app/screens/Settings/AddServer.js`**: "Network (WiFi)" `OptionInput` (manual name) + tappable chips
  (current SSID first, then previously used networks from `settings.networks`) + "Use current network"
  switch (fills the field with the connected SSID, requesting location on first use; failure shows a hint).
  On connect the `network` field is saved on the server and pushed to the `networks` history
  (deduped, capped at 10).
- **`app/contexts/settings.js`**: `networks: []` in `defaultSettings`.
- **`app/screens/Settings/Connect.js`**: wifi icon on server rows that have a `network` set.
- i18n keys (en/de): Network, Network Placeholder, Current, Use current network, Network permission,
  Network not detected.

## Steps
1. `npx expo install @react-native-community/netinfo`; `npm uninstall expo-network` — DONE
2. platform-split `getCurrentNetwork` + `requestLocationPermission` — DONE
3. `NetworkAutoSwitch` bidirectional component + mount — DONE
4. AddServer network field + toggle + chips + history + hint — DONE
5. defaultSettings `networks` — DONE
6. Connect row wifi icon — DONE
7. Manifest permissions — DONE
8. eslint (clean), `:app:assembleRelease` (success), install + launch on R5CY71GYKWF — DONE

## Decisions
- No toggle to enable/disable auto-switch; only servers with a `network` participate.
- History list replaces "known networks" (Android can't enumerate saved networks on 10+).
- Fallback = last manually-used server (`lastFallback`), else first non-bound server, else do nothing.

## Known ceiling
- `ponytail: current-SSID detection needs location permission + location services on Android 10+;
  manual network name + history always work. Upgrade path if it matters: guide users to enable
  location, or ship a Settings hint.
- SSID equality is case-insensitive; quoted SSIDs (iOS) are stripped.

## Shipped / skipped
- All steps shipped (v1 + v2 fix). Skipped: a Settings row to pre-grant location permission
  (YAGNI); iOS `com.apple.developer.networking.wifi-info` entitlement (Android-only project).
