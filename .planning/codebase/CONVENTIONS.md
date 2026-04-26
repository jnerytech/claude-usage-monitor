# Coding Conventions

**Analysis Date:** 2026-04-26

## Naming Patterns

**Files:**
- Flat, lowercase, no separator: `main.js`, `preload.js`
- Renderer files are lowercase with no separator: `app.js`, `locales.js`, `style.css`, `index.html`
- Script files are kebab-case: `gen-icons.js`

**Functions:**
- camelCase throughout: `saveCookies`, `restoreCookies`, `hasSavedCookies`, `extractOnce`, `startExtractLoop`, `ensureHiddenWindow`, `scheduleFetch`, `openLoginWindow`, `createMainWindow`, `checkAlerts`, `showTrayNotification`, `createTray`, `toggleMainWindow`, `setupAutoUpdater`
- Verbs preferred: functions always start with action words (`get`, `set`, `save`, `restore`, `ensure`, `schedule`, `open`, `create`, `build`, `start`, `stop`, `push`, `parse`, `format`, `apply`, `render`, `show`, `close`)

**Variables:**
- camelCase for all local and module-level variables: `mainWindow`, `loginWindow`, `hiddenWindow`, `reloadTimer`, `extractTimer`, `nextFetchAt`, `isQuitting`, `trayNotificationShown`, `alertState`
- Constants use UPPER_SNAKE_CASE: `DEFAULT_INTERVAL_S`, `RENDER_DELAY_MS`, `EXTRACT_INTERVAL_MS`, `CLAUDE_ORIGIN`, `USAGE_URL`, `LOGIN_URL`, `EXTRACT_SCRIPT`
- DOM element references use a consistent suffix convention: `El` suffix for text/info spans (`countdownEl`, `lastUpdateEl`, `resetInfoEl`, `opacityValueEl`), `Btn` suffix for buttons (`refreshBtn`, `settingsBtn`, `loginBtn`), `Panel` for panel containers (`authPanel`, `settingsPanel`), `State` for state divs (`loadingState`, `errorState`, `emptyState`)

**CSS Classes:**
- kebab-case throughout: `.usage-item`, `.usage-row`, `.usage-label`, `.usage-pct`, `.bar-track`, `.bar-fill`, `.icon-btn`, `.primary-btn`, `.theme-opt`, `.settings-section`, `.settings-label`, `.filter-item`, `.alert-row`, `.alert-num`
- Modifier classes are single words appended directly: `.low`, `.medium`, `.high`, `.active`, `.full-bar`, `.danger`, `.minimized`, `.theme-light`

**CSS Custom Properties:**
- `--` prefixed, kebab-case: `--bg`, `--bg-card`, `--border`, `--border-light`, `--text-primary`, `--text-secondary`, `--text-muted`, `--accent-blue`, `--accent-orange`, `--accent-red`, `--accent-green`, `--radius`, `--radius-sm`, `--radius-bar`

## Code Style

**Strict Mode:**
- Every JS file begins with `'use strict';` — this is mandatory. See `main.js:1`, `preload.js:1`, `renderer/app.js:1`, `renderer/locales.js:1`, `scripts/gen-icons.js:1`

**Formatting:**
- No dedicated formatter config (no `.prettierrc`, no `biome.json`)
- 2-space indentation throughout all JS files
- Single quotes for strings in JS: `'use strict'`, `'cookies'`, `'loggedIn'`
- Semicolons used consistently
- Trailing commas present in multi-line object/array literals

**Line Length:**
- No enforced limit; long lines exist where readability is maintained (SVG strings, EXTRACT_SCRIPT template literal)

**Linting:**
- No project-level ESLint config (`.eslintrc` files exist only inside `node_modules`)

## Import Organization

**Node.js (main.js, scripts):**
- Destructured named imports from Electron at top: `const { app, BrowserWindow, … } = require('electron');`
- Node built-ins second: `const path = require('path');`
- Third-party packages last: `const Store = require('electron-store');`
- No path aliases — all requires use package names or `path.join(__dirname, …)`

**Renderer (browser context):**
- No `require`/`import` — plain `<script src="…">` tags in `index.html`
- Load order matters: `locales.js` before `app.js` (locales defines `t()` used by app)

## Section Delimiters

All files use a consistent banner comment style to separate logical sections:

```js
// ---------------------------------------------------------------------------
// Section Name
// ---------------------------------------------------------------------------
```

This appears in `main.js` and `renderer/app.js` to group: DOM refs, state, helpers, IPC listeners, button handlers, and init. Use this pattern for any new sections.

## Error Handling

**Patterns:**
- Async functions wrapped in `try/catch` with `console.error` for logging: `saveCookies`, `restoreCookies`, `extractOnce`, `init`
- Expected errors swallowed silently with empty catch: `restoreCookies` inner cookie loop (`catch (_) {}`), `checkNavigation` URL parse (`catch (_) {}`), `syncNextFetchAt` (`catch (_) {}`)
- Specific error strings inspected before routing: `if (err.message && err.message.includes('disposed')) return;` in `extractOnce` (`main.js:131`)
- Renderer auth error detection via regex against error message: `/auth|login|403/i.test(payload.error)` (`renderer/app.js:359`)
- IPC error paths always include `fetchedAt: Date.now()` in error payloads for timestamp display

**What to swallow vs. surface:**
- Swallow: frame-disposed errors during page reload, URL parse failures, cookie restore failures for individual cookies
- Surface via `console.error`: saveCookies failure, extractOnce unexpected errors, autoUpdater errors, hidden window load failures
- Surface to UI: usage data errors (sent as `{ error: string, fetchedAt }` via IPC)

## Logging

**Framework:** `console` only — no logging library

**Patterns:**
- `console.error('functionName error/context:', err)` for caught exceptions
- `console.log('Description:', value)` for informational events (autoUpdater lifecycle)
- Log prefix always identifies the source function or system: `'saveCookies error:'`, `'extractOnce error:'`, `'Hidden window load failed:'`, `'autoUpdater error:'`
- Renderer has a single `console.error('init:', err)` in the init catch block; no other renderer logging

## Comments

**When to Comment:**
- Section banners for logical groupings (see Section Delimiters above)
- Inline comments explain non-obvious decisions: timer architecture, CSS compositing layer trick, `did-navigate` vs. `did-navigate-in-page`, React render delay reasoning
- No JSDoc/TSDoc (plain JS, no type annotations)

**Examples of good inline comments in this codebase:**
```js
// Wait for React to render, then start polling the DOM
setTimeout(startExtractLoop, RENDER_DELAY_MS);

// Frame disposed during page reload — expected, not an error.
if (err.message && err.message.includes('disposed')) return;

// Keep app alive via tray — intentionally do not call app.quit()

// Dev builds don't have update metadata — skip to avoid noisy errors.
```

## Function Design

**Size:** Functions are small and single-purpose. No function exceeds ~40 lines. The longest is `checkAlerts` (~45 lines) which is intentionally unified for alert logic cohesion.

**Parameters:** Prefer passing data objects over many positional params. IPC handlers receive `(event, payload)` where payload is an object.

**Return Values:**
- Async functions return implicitly (no explicit `return undefined`)
- Early-return guards used consistently to avoid deep nesting: `if (!hiddenWindow || hiddenWindow.isDestroyed()) return;`
- IIFE used for the extracted DOM script (`EXTRACT_SCRIPT`) to avoid global variable pollution in the target page context

## Module Design

**Exports:** None — `main.js` and `preload.js` are Electron entry points, not modules. `renderer/app.js` and `renderer/locales.js` are browser scripts loaded via `<script>` tags.

**Globals in Renderer:**
- `locales.js` exposes `LOCALES`, `currentLang`, `t()`, `setLang()`, `applyTranslations()` as implicit globals (no `export`)
- `app.js` depends on those globals and `window.claudeAPI` (injected by `preload.js` via `contextBridge`)

**IPC Bridge Pattern:**
- `preload.js` is the sole bridge between renderer and main process
- All renderer↔main communication goes through `window.claudeAPI`
- Never use `nodeIntegration: true` or bypass `contextBridge`

## HTML Conventions

**i18n Attributes:**
- `data-i18n` — sets `innerHTML` (allows HTML entities/tags in translation)
- `data-i18n-text` — sets `textContent` (plain text only)
- `data-i18n-title` — sets `title` attribute
- All three are processed by `applyTranslations()` in `renderer/locales.js`

**Inline styles:**
- Used only for initial display state (`style="display:none"`) — toggled at runtime via JS
- Never use inline styles for theming; always use CSS custom properties or classes

## CSS Conventions

**Theming:**
- Dark theme is the default (`:root` variables)
- Light theme applied by adding `.theme-light` to `<body>` — CSS selectors under `.theme-light` override custom properties
- Opacity controlled at the `#widget` element level via `style.opacity` (set from JS, not a CSS class)

**Transparency:**
- `background: transparent` on `html, body` — the widget background is rendered by `#widget` itself with rounded corners

---

*Convention analysis: 2026-04-26*
