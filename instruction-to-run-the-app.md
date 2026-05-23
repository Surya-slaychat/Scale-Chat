# Instructions to Run the App

How to start the Scale-Chat Expo app on an Android emulator using a **development build** (the long-term workflow for this project). Run the commands in order from a fresh PowerShell window on Windows.

> The app source lives in `my-app/`, not the repo root. Always `cd my-app` before running any `expo` / `npx` commands.

---

## Prerequisites (one-time)

- **Android Studio** with at least one AVD (Android Virtual Device) configured. We use a Pixel 10 Pro emulator.
- **Android platform-tools** installed (ships with Android Studio). Default Windows location: `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe`.
- **Node.js** with `npx`.
- **The development build APK installed on the emulator.** Confirm with:

  ```powershell
  & "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" shell pm list packages | Select-String "com.surya_expo88.myapp"
  ```

  If nothing prints, install the APK:
  1. Open the EAS dashboard for `my-app` → **Builds** → pick the latest **development** profile build → click **Install** to download the `.apk`.
  2. Drag the downloaded `.apk` onto the running emulator window (or `adb install <path>`).

  When you add a native module or change `app.json`, you must rebuild this APK via `eas build --profile development --platform android`.

---

## Every-time startup (4 steps)

### 1. Start the Android emulator

Open Android Studio → **Device Manager** → click ▶ next to the Pixel 10 Pro AVD. Wait until the home screen appears.

Verify it's connected:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" devices
```

Expected output:

```
List of devices attached
emulator-5554   device
```

### 2. Set up the port forward (`adb reverse`)

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" reverse tcp:8081 tcp:8081
```

This makes `localhost:8081` *inside* the emulator tunnel to `localhost:8081` *on your PC* — sidesteps any LAN / Wi-Fi / firewall issues. **Re-run this every time the emulator restarts** (it's not persistent across reboots).

### 3. Start the Metro dev server

```powershell
cd C:\Users\surya\OneDrive\Desktop\work\projects\personal_proj\Scale-Chat\my-app
npx expo start --dev-client
```

Flag breakdown:

- `--dev-client` — tells Expo to print URLs for your custom dev build (scheme `exp+my-app://`), not for Expo Go.
- **Do NOT add `--localhost`.** On Windows + modern Node, `--localhost` causes Metro to bind only to IPv6 `::1`, but `adb reverse` only forwards IPv4. The result is `"unexpected end of stream on http://127.0.0.1:8081"` in the dev client. Without the flag, Metro binds to `::` (dual-stack wildcard), which accepts IPv4 — and `adb reverse` works correctly.

Wait until you see:

```
› Metro waiting on exp+my-app://...
Logs for your project will appear below.
```

### 4. Open the dev client and connect to Metro

On the emulator:

1. Open the app drawer (swipe up from the bottom).
2. Tap **my-app** (the icon with "A" — your development build).
3. The dev launcher home screen appears with a header "DEVELOPMENT SERVERS".
4. In the `exp://` text input, type:

   ```
   exp://127.0.0.1:8081
   ```

5. Tap **Connect**.

Metro will receive the request, bundle in ~10 seconds, and your app loads.

> **Do NOT use `npx expo start --dev-client --android`** (the `--android` auto-launch) and do **NOT** fire a deep-link intent at the dev client. Both crash the current dev-client build with a `NullPointerException` in `ReactActivityDelegate.onUserLeaveHint` (it sends the app a "user leaving" lifecycle signal before the React bridge is ready). Launching from the app drawer and connecting via the URL input avoids that code path entirely.

---

## Why these specific choices?

`★ Insights ─────────────────────────────────────`
- **Why `adb reverse` instead of using the LAN IP:** On Windows, Defender Firewall blocks inbound Node.js connections by default. With the emulator NAT'd behind Android's bridge, a request from the emulator to `192.168.x.y:8081` often fails silently. `adb reverse` tunnels through the ADB channel — no LAN, no firewall, works on any Wi-Fi.
- **Why no `--localhost` flag:** Node's DNS resolver on Windows prefers IPv6, so `localhost` → `::1`. `adb reverse tcp:8081 tcp:8081` only forwards IPv4, so the emulator hits a closed IPv4 port and OkHttp throws "unexpected end of stream." Binding to all interfaces (`::`) fixes both client types.
- **Why launch via app drawer + URL input, not deep link:** Expo SDK 56's dev-client has a lifecycle bug — when an `exp+my-app://` intent arrives at `MainActivity`, `onUserLeaveHint` fires before the React bridge is initialized, dereferences a null delegate, and crashes into the launcher's error screen. Cold-launching via the icon then connecting through the UI is a slower but reliable alternative.
- **Why `127.0.0.1` and not `localhost` in the URL field:** Expo's URL parser prefers numeric IPs for `exp://` schemes — `localhost` sometimes resolves wrong inside the dev client's network stack.
`─────────────────────────────────────────────────`

---

## While Expo is running

Single-key shortcuts in the Metro terminal:

- `r` — reload the JS bundle on the device
- `j` — open the JS debugger in Chrome
- `m` — toggle the in-app dev menu
- `?` — list all shortcuts
- `Ctrl+C` — stop Metro

Save any `.tsx`/`.ts` file under `src/` to trigger Fast Refresh.

---

## Stopping cleanly

1. `Ctrl+C` in the Metro terminal.
2. (Optional) Close the emulator window, or:

   ```powershell
   & "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" emu kill
   ```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `ConfigError: package.json does not exist` | Ran `expo start` from the repo root | `cd my-app` first |
| `unexpected end of stream on http://127.0.0.1:8081` | Metro bound IPv6-only (`--localhost` flag was used, or some Node versions default that way) | Stop Metro, restart **without** `--localhost`. Verify with `Get-NetTCPConnection -LocalPort 8081 -State Listen` — `LocalAddress` should be `::` or `0.0.0.0`, not `::1` |
| Dev launcher → "Error loading app" | Stale state from a previous crash | `adb shell pm clear com.surya_expo88.myapp`, then relaunch from app drawer |
| Dev launcher → `DevLauncherErrorActivity` with `NullPointerException` in `ReactActivityDelegate.onUserLeaveHint` | You used `--android` flag or sent an `exp+my-app://` deep link | Launch via app drawer icon, then type URL into Connect field |
| `adb devices` shows nothing | Emulator not booted, or `adbd` crashed | Wait for AVD to fully boot, or `adb kill-server && adb start-server` |
| `EADDRINUSE :8081` | Old Metro process still alive | `Get-NetTCPConnection -LocalPort 8081 -State Listen \| ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }` |
| Connect button stays gray | Empty URL field | Type the full `exp://127.0.0.1:8081` URL |
| App loads stale code | Metro cache | `Ctrl+C`, restart with `npx expo start --dev-client --clear` |
| `adb reverse` mapping disappeared | Emulator was rebooted | Re-run step 2 |
| Bundle loads but app immediately crashes | Native module mismatch (you added a native package without rebuilding the dev client) | `eas build --profile development --platform android`, install the new APK |

---

## When do I need to rebuild the dev-client APK?

Only when you change something **native**. Pure JS changes never require a rebuild.

| Change | Rebuild needed? |
|---|---|
| Edit `.ts` / `.tsx` / `.js` | ❌ Fast Refresh handles it |
| Add a pure-JS npm package (`zod`, `lodash`, etc.) | ❌ Restart Metro |
| Add a package with native code (`react-native-mmkv`, `@stripe/stripe-react-native`, etc.) | ✅ Rebuild |
| Change `app.json` permissions, icons, splash, or `plugins` | ✅ Rebuild |
| Bump Expo SDK version | ✅ Rebuild |
| Add an Expo Config Plugin | ✅ Rebuild |

To rebuild:

```powershell
cd my-app
eas build --profile development --platform android
```

…then install the resulting APK on the emulator the same way as the initial setup.

---

## Quickstart cheat sheet

For when you've already done this once and just need the commands:

```powershell
# 1. Start emulator from Android Studio Device Manager (▶ Pixel 10 Pro)

# 2. Port forward
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" reverse tcp:8081 tcp:8081

# 3. Metro
cd C:\Users\surya\OneDrive\Desktop\work\projects\personal_proj\Scale-Chat\my-app
npx expo start --dev-client

# 4. On emulator: open my-app → type exp://127.0.0.1:8081 → tap Connect
```

---

## Appendix — Expo Go fallback

If the development build is broken or unavailable, you can fall back to Expo Go for JS-only work. Note: any native module not bundled with Expo Go will crash. Use this only for emergency demos.

```powershell
cd C:\Users\surya\OneDrive\Desktop\work\projects\personal_proj\Scale-Chat\my-app
npx expo start --go --dev-client=false
```

Then in the Metro terminal press `a`, or open Expo Go on the emulator manually and connect to `exp://127.0.0.1:8081`.
