<!-- refreshed: 2026-04-26 -->
# Architecture

**Analysis Date:** 2026-04-26

## System Overview

```text
┌──────────────────────────────────────────────────────────────┐
│                     Electron Main Process                     │
│                         `main.js`                             │
├──────────────────┬───────────────────┬───────────────────────┤
│   mainWindow     │   loginWindow     │    hiddenWindow        │
│  (widget UI)     │  (claude.ai auth) │  (data scraper)        │
│ `renderer/`      │  claude.ai/login  │  claude.ai/settings/   │
│                  │                   │  usage (never shown)   │
└────────┬─────────┴─────────┬─────────┴──────────┬────────────┘
         │  IPC (contextBridge)│                   │
         │  `preload.js`       │                   │ executeJavaScript
         ▼                     │                   ▼
┌────────────────────┐         │     ┌─────────────────────────┐
│  renderer/app.js   │         │     │    EXTRACT_SCRIPT        │
│  renderer/index.html│        │     │    (DOM parser — inlined │
│  renderer/locales.js│        │     │     in main.js ~L64)     │
│  renderer/style.css │        │     └─────────────────────────┘
└────────────────────┘         │
                                │   Auth detection (URL check)
                                ▼
                     ┌──────────────────┐
                     │  electron-store   │
                     │  (cookies +       │
                     │   settings)       │
                     └──────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Main process | Window management, IPC routing, timers, alert logic, auto-update | `main.js` |
| Preload bridge | Secure IPC surface exposed to renderer via `contextBridge` | `preload.js` |
| Widget renderer | UI state, panel switching, countdown, settings, usage display | `renderer/app.js` |
| Widget markup | HTML structure for all panels (auth, usage, settings, error) | `renderer/index.html` |
| i18n module | Locale strings (en, pt-BR), `t()` helper, `applyTranslations()` | `renderer/locales.js` |
| Widget styles | CSS custom-property theming (dark/light), transparency | `renderer/style.css` |
| Extraction script | Inline IIFE injected into hiddenWindow to parse progressbar DOM | `main.js` (L64–102) |
| Persistence | Settings and session cookies via `electron-store` | `main.js` (L8) |
| Icon generator | SVG → PNG/ICO conversion at dev time | `scripts/gen-icons.js` |

## Pattern Overview

**Overall:** Electron multi-window scraper widget — no framework, no bundler, plain HTML/CSS/JS

**Key Characteristics:**
- Three `BrowserWindow` instances with strictly separated roles
- All inter-process communication flows through a single `contextBridge` object (`window.claudeAPI`) defined in `preload.js`
- Data extraction uses `executeJavaScript` to inject a self-contained IIFE into a hidden browser window rather than a dedicated backend or API call
- Persistence uses `electron-store` (JSON file) for both settings and session cookies
- Renderer is a single-page app driven by panel visibility toggling — no router

## Layers

**Main Process:**
- Purpose: Orchestrates all Electron APIs, owns all three windows, manages timers, handles auth lifecycle, fires alerts
- Location: `main.js`
- Contains: Window factory functions, IPC handlers, cookie helpers, `EXTRACT_SCRIPT`, `checkAlerts()`, auto-updater setup
- Depends on: `electron`, `electron-store`, `electron-updater`, `preload.js`
- Used by: Entry point — nothing depends on it

**IPC Bridge:**
- Purpose: Exposes a typed, sandboxed API surface from the main process to the renderer; prevents direct Node access from renderer
- Location: `preload.js`
- Contains: `contextBridge.exposeInMainWorld('claudeAPI', {...})` — all `ipcRenderer.invoke` and `ipcRenderer.send` wrappers
- Depends on: `electron` (contextBridge, ipcRenderer)
- Used by: `renderer/app.js` via `window.claudeAPI`

**Renderer (Widget UI):**
- Purpose: Displays usage data, handles user interactions, manages UI state
- Location: `renderer/app.js`, `renderer/index.html`, `renderer/locales.js`, `renderer/style.css`
- Contains: Panel switching logic, usage rendering, settings serialization, countdown timer, reset time parsing
- Depends on: `window.claudeAPI` (IPC bridge), `locales.js` (loaded before `app.js`)
- Used by: End user (loaded in `mainWindow`)

**Persistence Layer:**
- Purpose: Durable storage for user settings and session cookies
- Location: Accessed throughout `main.js` via `store` (module-level singleton)
- Contains: `settings` object (theme, lang, interval, alerts, hiddenItems), `cookies` array, `loggedIn` boolean
- Depends on: `electron-store`
- Used by: All IPC handlers in `main.js` that read or write user preferences

## Data Flow

### Primary Usage Data Path

1. `scheduleFetch()` fires `reloadTimer` at user-configured interval → calls `ensureHiddenWindow()` (`main.js` L178–194)
2. `hiddenWindow` loads `https://claude.ai/settings/usage` using the shared `session.defaultSession` (which holds restored cookies)
3. `did-finish-load` fires after 3s `RENDER_DELAY_MS` → `startExtractLoop()` (`main.js` L156–159)
4. `extractTimer` calls `extractOnce()` every 2s → `hiddenWindow.webContents.executeJavaScript(EXTRACT_SCRIPT)` (`main.js` L117–137)
5. `EXTRACT_SCRIPT` queries `[role="progressbar"][aria-valuenow]` in the claude.ai DOM, walks up to find labels and reset text, returns `{ items, resetAt }` (`main.js` L64–102)
6. Extracted data passed to `checkAlerts()` then forwarded to `mainWindow` via IPC `usage-data` event (`main.js` L123–128)
7. `renderer/app.js` receives payload in `onUsageData` listener → calls `renderUsage(items)` to update DOM (`renderer/app.js` L355–387)

### Authentication Flow

1. User clicks "Sign in" → renderer calls `window.claudeAPI.openLogin()` → IPC sends `open-login`
2. Main opens `loginWindow` loading `https://claude.ai/login` with shared session
3. `did-navigate` / `did-navigate-in-page` events monitor URL; success detected when hostname is `claude.ai` but path is not `/login` or `/oauth` (`main.js` L219–242)
4. On success: `saveCookies()` → `store.set('loggedIn', true)` → `mainWindow` notified via `auth-status` IPC → `scheduleFetch()` starts
5. On subsequent app launches: `restoreCookies()` runs before any window is created → `hasSavedCookies()` triggers `scheduleFetch()` automatically (`main.js` L515–523)

### Alert Flow

1. Each `extractOnce()` result passes items to `checkAlerts(items, settings)` (`main.js` L319–363)
2. `checkAlerts` evaluates four alert types against `alertState` (module-level singleton): threshold, nearReset, planReset, spike
3. `parseResetMins()` parses natural-language reset text (e.g., "in 2 hr 24 min") for time-based alerts
4. `notify()` fires native `Notification` if Electron supports it (`main.js` L301–304)

**State Management:**
- Main process: Module-level `let` variables (`mainWindow`, `hiddenWindow`, `loginWindow`, `tray`, `reloadTimer`, `extractTimer`, `nextFetchAt`, `alertState`) — all mutable, no encapsulation
- Renderer: Module-level `let` variables in `renderer/app.js` (`minimized`, `loggedIn`, `lastUsageData`, `settings`, `nextFetchAt`, etc.)
- Persistent: `electron-store` JSON file on disk

## Key Abstractions

**`window.claudeAPI`:**
- Purpose: The only allowed communication channel between renderer and main process
- Examples: `preload.js` (definition), `renderer/app.js` (all call sites)
- Pattern: Invoke (`ipcRenderer.invoke`) for request/reply; Send (`ipcRenderer.send`) for one-way fire-and-forget; `on*` callbacks for main-to-renderer events

**`EXTRACT_SCRIPT`:**
- Purpose: Self-contained DOM scraper injected into the hidden window on each extraction cycle
- Examples: `main.js` L64–102
- Pattern: Inline IIFE string, returns structured data or `null`/`{ error }` — never throws to calling context

**`electron-store` singleton (`store`):**
- Purpose: Unified persistence for settings and auth state
- Examples: `main.js` L8 (init), every `ipcMain.handle` for settings
- Pattern: Module-level `const store = new Store()` — accessed directly throughout `main.js`

## Entry Points

**App start:**
- Location: `main.js` (registered as `"main"` in `package.json`)
- Triggers: `app.whenReady()` callback at L515
- Responsibilities: Restore cookies, create `mainWindow`, create tray, setup auto-updater, conditionally start data fetch

**Renderer init:**
- Location: `renderer/app.js` L506 (`init()` call)
- Triggers: Script load after `locales.js`
- Responsibilities: Fetch auth status and settings in parallel, apply theme/language, show appropriate initial panel, start countdown tick

## Architectural Constraints

- **Threading:** Single Electron main process; renderer runs in a separate Chromium renderer process. No web workers or worker threads used.
- **Global state:** Multiple module-level mutable singletons in `main.js` (`mainWindow`, `hiddenWindow`, `loginWindow`, `tray`, `reloadTimer`, `extractTimer`, `nextFetchAt`, `isQuitting`, `trayNotificationShown`, `alertState`). Same pattern in `renderer/app.js`.
- **Circular imports:** Not applicable — no module system in renderer (plain script tags); `main.js` uses CommonJS `require` with no circular risk.
- **Session sharing:** All three `BrowserWindow` instances share `session.defaultSession` — cookies set in `loginWindow` are immediately available to `hiddenWindow`. This is load-bearing for authentication.
- **CSP:** `renderer/index.html` enforces `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'` — no external resources allowed in the widget.
- **Node access in renderer:** Disabled (`nodeIntegration: false`, `contextIsolation: true`) — all Node access is proxied through `preload.js`.

## Anti-Patterns

### Alert state as mutable module-level object

**What happens:** `alertState` in `main.js` L19 is a plain object mutated directly across multiple calls to `checkAlerts()`
**Why it's wrong:** No reset mechanism if settings change; fired-flags accumulate indefinitely per label across the app lifetime
**Do this instead:** Reset `alertState` when settings are saved (the `save-settings` IPC handler at `main.js` L470) or encapsulate in a class with explicit lifecycle

### Hardcoded Portuguese strings in UI

**What happens:** Several UI strings in `main.js` (e.g., `showTrayNotification` body at L374, tray menu labels at L401–405, confirm overlay text in `renderer/index.html` L161–163) are hardcoded in Portuguese and not routed through `locales.js`
**Why it's wrong:** Breaks i18n completeness; English users see mixed-language UI
**Do this instead:** Move all user-visible strings through the `LOCALES` dictionary in `renderer/locales.js`; for main-process strings, pass the locale key via IPC or store the resolved string in settings

## Error Handling

**Strategy:** Best-effort with silent swallowing for expected transient failures (frame disposal during reload)

**Patterns:**
- `extractOnce()` catches errors from `executeJavaScript`; suppresses `disposed` errors silently, logs and forwards others to renderer (`main.js` L128–137)
- Cookie restore loop swallows individual cookie errors silently with empty catch (`main.js` L50)
- Renderer checks `payload.error` presence before rendering; shows error panel with optional reconnect button (`renderer/app.js` L358–365)
- Auth detection in `loginWindow` wraps URL parsing in try/catch to handle malformed URLs silently (`main.js` L219)

## Cross-Cutting Concerns

**Logging:** `console.error` for unexpected failures in main process; no structured logging, no log file
**Validation:** Minimal — alert threshold inputs have HTML `min`/`max` attributes; no server-side or runtime validation of stored settings
**Authentication:** Cookie-based; session cookies persisted to `electron-store` and restored on startup; no token refresh mechanism

---

*Architecture analysis: 2026-04-26*
