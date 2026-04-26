# External Integrations

**Analysis Date:** 2026-04-26

## APIs & External Services

**Claude.ai (Anthropic):**
- Used for: Monitoring the authenticated user's Claude usage quotas
- Access method: Electron `BrowserWindow` loads `https://claude.ai/settings/usage` in a hidden window; no SDK or HTTP client — DOM scraping via `executeJavaScript` injecting `EXTRACT_SCRIPT` into the live page
- Auth: Session cookies managed by `session.defaultSession`; saved/restored via `electron-store`
- Key constants in `main.js`:
  - `CLAUDE_ORIGIN = 'https://claude.ai'`
  - `USAGE_URL = 'https://claude.ai/settings/usage'`
  - `LOGIN_URL = 'https://claude.ai/login'`

**GitHub Releases (auto-update):**
- Used for: Distributing app updates to end users
- SDK/Client: `electron-updater ^6.8.3` (`autoUpdater` from `electron-updater`)
- Config: `package.json` `"publish"` block — provider `github`, owner `jnerytech`, repo `claude-usage-monitor`
- Flow: On app start (packaged builds only), `autoUpdater.checkForUpdatesAndNotify()` checks the GitHub release feed; downloads automatically; installs on quit
- Implementation: `main.js` — `setupAutoUpdater()` function

## Data Storage

**Databases:**
- None — no external database

**Local Persistence:**
- `electron-store ^8.1.0` — JSON file store on user's filesystem
- Stored keys:
  - `cookies` — Array of claude.ai session cookies for re-authentication
  - `loggedIn` — Boolean auth state
  - `settings` — Object containing: `refreshInterval`, `hiddenItems`, `theme`, `opacity`, `lang`, `alerts`
- Implementation: `main.js` — `const store = new Store()` (module-level singleton)

**File Storage:**
- Local filesystem only — icon assets at `assets/`, `build/`

**Caching:**
- None

## Authentication & Identity

**Auth Provider:**
- Anthropic / claude.ai (native browser-based login flow)
- Implementation: `loginWindow` (a visible `BrowserWindow`) loads `https://claude.ai/login`; `main.js` monitors `did-navigate` / `did-navigate-in-page` events to detect post-login redirect; on success, cookies are saved via `session.defaultSession.cookies.get()` and persisted to `electron-store`
- Session restoration: On app launch, `restoreCookies()` in `main.js` replays stored cookies into `session.defaultSession` before any window is shown
- Logout: `session.defaultSession.clearStorageData()` + `store.delete('cookies')` + `store.delete('loggedIn')`

## Monitoring & Observability

**Error Tracking:**
- None — no external error tracking service

**Logs:**
- `console.error` / `console.log` only; output goes to Electron's stdout/stderr (visible in dev mode terminal or captured by the OS on packaged builds)

## CI/CD & Deployment

**Hosting:**
- GitHub Releases (binary distribution)
- No server-side hosting — purely desktop app

**CI Pipeline:**
- GitHub Actions: `.github/workflows/build.yml`
- Triggers: push to `main`/`master`, version tags (`v*`), pull requests, manual dispatch
- Jobs:
  - `build-windows` — `windows-latest`, produces NSIS `.exe` + blockmap + `latest.yml`
  - `build-macos` — `macos-latest`, produces DMG + ZIP + blockmap + `latest-mac.yml`
  - `build-linux` — `ubuntu-latest`, produces AppImage + blockmap + `latest-linux.yml`
  - `release` — runs only on `v*` tags; publishes all artifacts to a GitHub Release using `softprops/action-gh-release@v2`
- Secrets used: `GITHUB_TOKEN` (built-in, no additional secrets required)

## Environment Configuration

**Required env vars:**
- None at runtime
- `GH_TOKEN` required only in CI for `electron-builder --publish` (provided automatically by GitHub Actions as `secrets.GITHUB_TOKEN`)

**Secrets location:**
- GitHub Actions repository secrets (only `GITHUB_TOKEN`)

## Webhooks & Callbacks

**Incoming:**
- None — the app has no server component and accepts no inbound HTTP traffic

**Outgoing:**
- None — all external communication is outbound browser navigation (claude.ai) or the `electron-updater` polling GitHub's release API

---

*Integration audit: 2026-04-26*
