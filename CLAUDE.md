# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## Commands

```bash
npm start          # Run in development mode (Electron)
npm run build      # Build installer for current platform
npm run icons      # Regenerate icons (SVG → PNG/ICO via scripts/gen-icons.js)
```

No lint or test scripts configured.

## Architecture

Three-window Electron app. No framework, no bundler — plain HTML/CSS/JS throughout.

**Windows (all created in `main.js`):**
- `mainWindow` — floating always-on-top widget (`renderer/index.html`)
- `loginWindow` — native browser for claude.ai authentication
- `hiddenWindow` — background page loader for `claude.ai/settings/usage` (never shown)

**Data flow:**
1. Auth: `loginWindow` detects post-login URL → saves cookies via `electron-store`
2. Two independent timers on `hiddenWindow`:
   - `reloadTimer` (user-configured: 5s–5min) — reloads the usage page
   - `extractTimer` (2s fixed) — `executeJavaScript` injects `EXTRACT_SCRIPT` to parse `role="progressbar"` DOM elements
3. Extracted data sent to `mainWindow` via IPC → renderer updates UI
4. `checkAlerts()` in `main.js` compares metrics against thresholds → desktop `Notification`

**IPC bridge:** `preload.js` exposes `window.claudeAPI` via `contextBridge`. All renderer↔main communication goes through it.

**Persistence:** `electron-store` stores settings (theme, language, intervals, alert thresholds) and session cookies.

**Key files:**
- `main.js` — all Electron logic: windows, tray, IPC handlers, timers, alert logic, DOM extraction script
- `renderer/app.js` — UI state, event handlers, theme/language switching, countdown timer
- `renderer/locales.js` — i18n strings (en, pt-BR); add new languages here
- `renderer/style.css` — CSS custom properties for light/dark themes; transparency controlled via `--widget-opacity`

## Build & Release

GitHub Actions (`.github/workflows/build.yml`) builds Windows/macOS/Linux in parallel on push. Tags matching `v*` trigger a GitHub Release with installers attached. `electron-updater` handles auto-update from those releases.
