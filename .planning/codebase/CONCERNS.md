# Codebase Concerns

**Analysis Date:** 2026-04-26

## Tech Debt

**Hardcoded tray notification in Portuguese:**
- Issue: `showTrayNotification()` in `main.js` (line 374) sends a hardcoded Portuguese string `'Minimizado para a bandeja. Clique no ícone para reabrir.'` regardless of the user's selected language. The i18n system only exists in the renderer; `main.js` has no access to `LOCALES`.
- Files: `main.js`
- Impact: English-language users receive a Portuguese tray notification when the app minimizes to tray. Contradiction of the two-language UX promise.
- Fix approach: Either pass the current language to main via an IPC call before minimizing, or move the tray notification trigger to the renderer side (postMessage after hide).

**Tray menu hardcoded in Portuguese:**
- Issue: `buildMenu()` in `main.js` (lines 399–406) uses hardcoded labels `'Ocultar'`, `'Mostrar'`, and `'Sair'` that never change with the user's language setting.
- Files: `main.js`
- Impact: Portuguese-only context menu regardless of language setting.
- Fix approach: Same solution as tray notification — send locale strings via IPC when settings change.

**Close confirmation overlay dead code:**
- Issue: `renderer/index.html` (lines 159–168) includes a `#confirm-overlay` element with cancel/quit buttons and Portuguese-only hardcoded strings. `renderer/app.js` has no event listeners or logic referencing `confirm-overlay`, `confirm-cancel`, or `confirm-quit`. The overlay never renders.
- Files: `renderer/index.html`, `renderer/app.js`
- Impact: Dead HTML that confuses future maintainers. The close button calls `quitApp()` directly without any confirmation dialog.
- Fix approach: Either implement the confirmation flow in `app.js` or remove the overlay from `index.html`.

**`setLang` falls back to `pt-BR` for unknown locales:**
- Issue: In `renderer/locales.js` (line 95), `setLang(lang)` defaults to `'pt-BR'` when an unknown locale is passed: `currentLang = LOCALES[lang] ? lang : 'pt-BR'`. This is backwards — `'en'` is the more universal default.
- Files: `renderer/locales.js`
- Impact: If a future locale key is partially entered or corrupted in persisted settings, the UI falls back to Portuguese rather than English.
- Fix approach: Change fallback to `'en'`.

**`t()` function fallback chain includes pt-BR:**
- Issue: `t(key)` in `renderer/locales.js` (line 91) falls through to `LOCALES['pt-BR'][key]` before returning the raw key. If a new key is added to `en` but not `pt-BR`, this masks the missing translation silently in pt-BR locale.
- Files: `renderer/locales.js`
- Impact: Missing pt-BR translations are hidden rather than surfaced. Harder to detect translation gaps.
- Fix approach: Remove the pt-BR fallback from `t()`; return the key directly as last resort and add translation completeness checks.

**`restoreCookies` swallows all cookie-set errors:**
- Issue: `restoreCookies()` in `main.js` (lines 41–53) catches cookie restoration errors with an empty catch block `} catch (_) {}`. Any failed cookie (expired, malformed, domain mismatch) is silently discarded.
- Files: `main.js`
- Impact: Authentication state can be silently broken after a session. Users may see the app as "logged in" (`store.get('loggedIn')` is still `true`) but no cookies were actually restored, leading to 403 errors from the hidden window.
- Fix approach: Log cookie restoration failures. Consider clearing the `loggedIn` flag if the cookie set fails entirely.

**Login state `loggedIn` flag is never cleared on network auth failure:**
- Issue: `store.set('loggedIn', true)` is set on login success, but the only place it is cleared (`store.delete('loggedIn')`) is the explicit logout IPC handler. If session cookies expire silently, `hasSavedCookies()` remains true and `scheduleFetch()` keeps firing, while the hidden window gets 403/401 responses.
- Files: `main.js`
- Impact: App appears logged in indefinitely after session expiry, cycling through failed fetches. The `reconnectBtn` is only shown if the error message matches `/auth|login|403/i` — a fragile string match.
- Fix approach: Detect auth errors in `extractOnce` or `did-fail-load` and proactively clear the `loggedIn` flag, triggering an IPC auth-status update.

**`reloadTimer` interval drift:**
- Issue: `scheduleFetch()` sets `reloadTimer` using `setInterval` with a fixed snapshot of `interval` at schedule time (line 188). If settings change (new `refreshInterval`), `save-settings` calls `scheduleFetch()` again — which clears the old timer and restarts. However, the interval used inside the setInterval callback calls `getRefreshIntervalMs()` dynamically (line 189) whereas the outer interval period was locked at schedule time. This means the countdown shown to the user (`nextFetchAt`) can drift from the actual reload period if settings are changed.
- Files: `main.js`
- Impact: Minor UX inconsistency — the displayed countdown doesn't match the actual next reload after settings change until the next reload cycle completes.
- Fix approach: Always recreate `reloadTimer` when settings change (already done), but ensure the timer period also uses `getRefreshIntervalMs()` lazily, or restart the interval with the new period immediately.

## Known Bugs

**`usageList.innerHTML = ''` recreates DOM on every 2-second extract:**
- Symptoms: Every 2 seconds `renderUsage()` wipes and rebuilds the entire `#usage-list` DOM, causing a flash and losing any user hover or focus state on the list.
- Files: `renderer/app.js` (line 139)
- Trigger: Triggered any time usage data arrives, which is every 2 seconds via the extract loop.
- Workaround: None. The re-render is unconditional.

**Reset date parsing: "Resets May 1" without year is ambiguous:**
- Symptoms: `parseResetDate()` in `renderer/app.js` (lines 318–325) parses "Resets May 1" by appending `new Date().getFullYear()`. If the reset date is in the next year (e.g., it's December and the reset is January 1), the year increment only fires if `d <= new Date()`, which should handle it — but relies on the current date being accurate and the reset string containing an English month abbreviation. Non-English claude.ai UIs would silently fail.
- Files: `renderer/app.js`
- Trigger: Reset date appearing as a month/day string (rather than the `<time datetime>` element) when the `resetAt` ISO datetime is unavailable.

**`parseResetMins` in `main.js` and `parseResetDate` in `renderer/app.js` duplicate logic:**
- Symptoms: Two separate regex-based parsers for the same Claude usage reset text format exist independently in `main.js` and `renderer/app.js`. If the format changes on claude.ai's UI, both must be updated independently.
- Files: `main.js` (lines 307–317), `renderer/app.js` (lines 299–327)
- Trigger: Any claude.ai UI change to the reset text format causes both parsers to break, requiring two separate fixes.

## Security Considerations

**Session cookies stored in plaintext via electron-store:**
- Risk: `electron-store` persists cookies to the OS user's app data directory in a JSON file without encryption. The `session.defaultSession` cookies for `claude.ai` (including session tokens) are serialized and written to disk on every login.
- Files: `main.js` (lines 32–38)
- Current mitigation: The file is in the user's local app data folder (not world-readable by default on modern OSes). `electron-store` does not encrypt by default.
- Recommendations: Use `electron-store`'s `encryptionKey` option, or use the OS keychain (`keytar` package) to store the session token rather than the full cookie set.

**`executeJavaScript` in hidden window is a privileged operation:**
- Risk: `hiddenWindow.webContents.executeJavaScript(EXTRACT_SCRIPT)` runs arbitrary JavaScript in the context of a real `claude.ai` session. If `EXTRACT_SCRIPT` were tampered with (e.g., supply-chain attack on the package), it would execute with full authenticated session access.
- Files: `main.js` (line 122)
- Current mitigation: `EXTRACT_SCRIPT` is a static string defined in `main.js` with no user input. The hidden window has `nodeIntegration: false` and `contextIsolation: true`.
- Recommendations: Pin `electron` and `electron-updater` package hashes. Consider using `executeJavaScriptInIsolatedWorld` if available in the Electron version in use.

**Auto-updater with `autoDownload: true`:**
- Risk: `autoUpdater.autoDownload = true` (line 491) means any update published to the configured GitHub Releases is automatically downloaded and installed on app quit, without user confirmation.
- Files: `main.js`
- Current mitigation: Updates are signed via `electron-builder`'s default code signing flow. The macOS build sets `identity: null` which disables code signing on macOS builds, meaning macOS users receive unsigned updates.
- Recommendations: Enable code signing for macOS (`identity: null` should be removed and a proper certificate configured). Add a user prompt before installing.

**`identity: null` in macOS build config disables code signing:**
- Risk: `package.json` `build.mac` section sets `"identity": null`, which explicitly disables macOS code signing. This means distributed macOS builds are unsigned and Gatekeeper will block them or show security warnings.
- Files: `package.json`
- Current mitigation: None. CI uses `CSC_IDENTITY_AUTO_DISCOVERY: false` to suppress signing errors.
- Recommendations: Obtain an Apple Developer ID and configure signing, or explicitly document that macOS users must bypass Gatekeeper.

**IPC handlers accept data from renderer without validation:**
- Risk: `ipcMain.handle('save-settings', (_, settings) => { store.set('settings', settings); ... })` stores whatever object the renderer sends without schema validation.
- Files: `main.js` (line 470)
- Current mitigation: The renderer always generates `settings` from known UI inputs, so the object is well-formed in practice. The preload uses `contextBridge` which prevents prototype pollution.
- Recommendations: Add a settings schema validator (e.g., Zod or manual shape check) before persisting to `electron-store`.

## Performance Bottlenecks

**Full DOM teardown and rebuild every 2 seconds:**
- Problem: `renderUsage()` calls `usageList.innerHTML = ''` then repopulates the list from scratch on every extract cycle (every 2 seconds).
- Files: `renderer/app.js` (lines 138–167)
- Cause: No diffing or update-in-place strategy. Each cycle forces a full layout and paint.
- Improvement path: Compare incoming items against `lastUsageData` before rendering; skip re-render if data is unchanged. Update individual progress bar widths in-place if only percentages changed.

**`autoResize()` triggers two animation frames on every data update:**
- Problem: `autoResize()` schedules two nested `requestAnimationFrame` calls every time `showUsage()` or `showPanel()` is called — which happens on every usage-data IPC message.
- Files: `renderer/app.js` (lines 63–74)
- Cause: Double-RAF is needed to read settled layout, but it fires even when the height hasn't changed.
- Improvement path: Cache the last known `fullHeight` and only call `window.claudeAPI.resizeWindow()` when the measured height actually differs (already partially done via the `> 1` check, but the two RAF callbacks always execute regardless).

**Hidden window reloads the full `claude.ai/settings/usage` page at user-configured interval:**
- Problem: The minimum reload interval is 5 seconds. Each reload fetches and renders the entire usage settings page in a hidden Chromium window, including all its JavaScript bundles. This is a full network request to a production web app on every cycle.
- Files: `main.js` (lines 178–194)
- Cause: Architecture decision — no API endpoint for usage, must scrape the UI.
- Improvement path: Extend the minimum interval to 30+ seconds; cache the last good data and display it while waiting for fresh data.

## Fragile Areas

**DOM scraping via `role="progressbar"` selector:**
- Files: `main.js` (lines 67–101, `EXTRACT_SCRIPT`)
- Why fragile: The entire data pipeline depends on `claude.ai`'s rendered DOM having `[role="progressbar"][aria-valuenow]` elements and a specific `<p>` tag hierarchy reachable within 12 parent-node hops. Any UI redesign on Anthropic's side silently breaks data extraction — `EXTRACT_SCRIPT` returns `null`, and the app shows empty state or stale data with no indication of the actual cause.
- Safe modification: Treat `EXTRACT_SCRIPT` changes as high risk. Always test against live `claude.ai/settings/usage`. Add a version sentinel or checksum check to detect when the DOM shape has changed.
- Test coverage: None. No tests exist in this project.

**`checkNavigation` login detection using URL path exclusion:**
- Files: `main.js` (lines 219–243)
- Why fragile: Login success is detected by navigating to any `claude.ai` URL that is not `/login` or `/oauth`. If Anthropic adds a new pre-login landing page (e.g., `/sso`, `/verify`, `/mfa`), the app would incorrectly detect it as a successful login, save empty/invalid cookies, and enter an authenticated-but-broken state.
- Safe modification: Use a positive allowlist of post-login paths (e.g., `/`, `/chats`) rather than a blocklist of login paths.
- Test coverage: None.

**`alertState` is module-level mutable state that is never reset on logout:**
- Files: `main.js` (line 19, `alertState`)
- Why fragile: `alertState.thresholdFired`, `nearResetFired`, and `prevPct` persist for the lifetime of the process. If a user logs out and back in under a different account, the previous account's threshold-fired flags carry over, suppressing alerts that should fire.
- Safe modification: Reset `alertState` in the logout IPC handler.
- Test coverage: None.

**`extractTimer` not cleared when `hiddenWindow` is destroyed:**
- Files: `main.js` (lines 139–143, 156–169)
- Why fragile: `startExtractLoop` sets `extractTimer` after `did-finish-load`. If the hidden window crashes or is destroyed between the `setTimeout(startExtractLoop, 3000)` callback being queued and `extractOnce` running, the guard `if (!hiddenWindow || hiddenWindow.isDestroyed())` catches it but the interval may have already been set. There is also no `destroyed` event handler on `hiddenWindow.webContents` to clear `extractTimer` proactively.
- Safe modification: Add a `hiddenWindow.on('closed', ...)` handler that calls `clearInterval(extractTimer)`.
- Test coverage: None.

## Scaling Limits

**Single-user, single-account only:**
- Current capacity: One set of cookies, one hidden window, one session.
- Limit: The app cannot monitor multiple Claude accounts simultaneously. `electron-store` stores one `cookies` entry.
- Scaling path: Would require a significant redesign — multiple hidden windows, account-keyed cookie storage, per-account settings.

## Dependencies at Risk

**`electron` at `^41.3.0` (major version, wide semver range):**
- Risk: The caret range allows automatic updates across minor/patch versions of a major Electron release. Electron major versions include Chromium upgrades that can change `webContents` API behavior, session APIs, and CSP enforcement.
- Impact: A minor Electron update could alter cookie handling, `executeJavaScript` sandbox behavior, or the `did-navigate` event contract, silently breaking core features.
- Migration plan: Pin to a specific Electron version (`"41.3.0"` without caret) and explicitly upgrade with testing.

**`electron-updater` at `^6.8.3`:**
- Risk: Auto-update library with broad semver range on a security-critical component (code that runs and installs binaries).
- Impact: A compromised or breaking release of `electron-updater` could affect update delivery integrity.
- Migration plan: Pin to exact version and audit update changelog before bumping.

**No lockfile enforcement in CI beyond `npm ci`:**
- Risk: `package-lock.json` is present and `npm ci` is used in CI, which is correct. However, there is no explicit lockfile integrity check or audit step.
- Impact: A dependency compromise not reflected in the lock file (e.g., a new transitive dependency added by a minor upgrade) would not be caught.
- Migration plan: Add `npm audit --audit-level=moderate` step in CI workflow.

## Missing Critical Features

**No error recovery for broken DOM scrape:**
- Problem: When `EXTRACT_SCRIPT` returns `null` (page not yet rendered or DOM structure changed), the app sends `{ data: null, fetchedAt }` to the renderer, which falls through to showing `emptyState`. There is no distinction between "page is loading" and "page loaded but data is missing" — both show the same empty state.
- Blocks: Users cannot tell if the app stopped working due to a claude.ai UI change versus normal loading.

**No settings migration/versioning:**
- Problem: `electron-store` stores settings as a flat object. If a new settings key is added (e.g., a new alert type), old stored settings objects simply lack the key. The defaults are applied via `??` in the renderer but not enforced in the store.
- Blocks: Adding or removing settings fields can silently break persisted user configuration across updates.

## Test Coverage Gaps

**Zero test coverage across the entire codebase:**
- What's not tested: All logic — DOM extraction (`EXTRACT_SCRIPT`), alert triggering (`checkAlerts`), login detection (`checkNavigation`), reset time parsing (`parseResetMins`, `parseResetDate`), cookie persistence (`saveCookies`, `restoreCookies`), settings persistence, UI rendering (`renderUsage`).
- Files: `main.js`, `renderer/app.js`, `renderer/locales.js`, `preload.js`
- Risk: Any change to any file has no regression safety net. Claude.ai UI changes that break the scraper produce no automated signal.
- Priority: High. `parseResetMins` / `parseResetDate` regex logic and `checkAlerts` threshold/cooldown logic are the most critical to unit-test first as they are pure functions with no Electron dependencies.

---

*Concerns audit: 2026-04-26*
