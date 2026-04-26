# Technology Stack

**Analysis Date:** 2026-04-26

## Languages

**Primary:**
- JavaScript (ES2020+, `'use strict'`) - All application code: `main.js`, `preload.js`, `renderer/app.js`, `renderer/locales.js`, `scripts/gen-icons.js`

**Secondary:**
- HTML5 - Single renderer page: `renderer/index.html`
- CSS3 (custom properties) - All styling: `renderer/style.css`

## Runtime

**Environment:**
- Node.js 20 (required by CI; see `.github/workflows/build.yml`)
- Electron 41.x — provides Chromium renderer + Node.js main process

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present; CI uses `npm ci`

## Frameworks

**Core:**
- Electron `^41.3.0` - Desktop app shell (multi-window, IPC, tray, notifications, session management)

**Testing:**
- None — no test framework configured

**Build/Dev:**
- electron-builder `^26.8.1` - Cross-platform installer packaging (NSIS/DMG/AppImage)

## Key Dependencies

**Critical:**
- `electron-store ^8.1.0` - Persistent settings and cookie storage; used in `main.js` for all app state
- `electron-updater ^6.8.3` - Auto-update via GitHub Releases; wired in `main.js` via `autoUpdater`

**Dev / Build-time:**
- `@resvg/resvg-js ^2.6.2` - SVG → PNG rasterizer; used only in `scripts/gen-icons.js`
- `png-to-ico ^3.0.1` - PNG → ICO converter; used only in `scripts/gen-icons.js`
- `electron ^41.3.0` - Dev dependency (bundled into final binary by electron-builder)

## Configuration

**Environment:**
- No `.env` files used at runtime — the app requires no environment variables to run
- `GH_TOKEN` is the only CI secret (GitHub Actions built-in), used exclusively during `electron-builder --publish`

**Build:**
- Build config is embedded in `package.json` under the `"build"` key (no separate `electron-builder.yml`)
- Output directory: `dist/`
- App ID: `com.nery.claude-usage-monitor`
- Publish provider: GitHub (`owner: jnerytech`, `repo: claude-usage-monitor`)

## Platform Requirements

**Development:**
- Node.js 20+
- npm
- `npm start` → launches Electron in dev mode
- `npm run icons` → regenerates icon assets (requires `@resvg/resvg-js` and `png-to-ico`)

**Production:**
- Windows: NSIS installer (x64), `assets/icon.ico`
- macOS: DMG + ZIP (x64 + arm64), `build/icon.png`, unsigned (`identity: null`)
- Linux: AppImage (x64), `build/icon.png`

---

*Stack analysis: 2026-04-26*
