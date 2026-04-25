<div align="center">

<!--
  ┌──────────────────────────────────────────────────────────────────────┐
  │  IMAGE 1 — BANNER / LOGO                                             │
  │  Suggestion: horizontal banner (1280x320) with app logo,            │
  │  dark background and a mockup of the widget floating on the right.  │
  │  Suggested file: docs/banner.png                                     │
  └──────────────────────────────────────────────────────────────────────┘
-->
<img src="docs/banner.png" alt="Claude Usage Monitor — banner" width="820"/>

# Claude Usage Monitor

**Floating desktop widget to track your Claude plan usage in real time.**

[![Electron](https://img.shields.io/badge/Electron-41-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Platform](https://img.shields.io/badge/Windows-x64-0078D6?logo=windows&logoColor=white)](#installation)
[![Platform](https://img.shields.io/badge/macOS-x64%20%7C%20arm64-000000?logo=apple&logoColor=white)](#installation)
[![Platform](https://img.shields.io/badge/Linux-x64-FCC624?logo=linux&logoColor=black)](#installation)
[![License](https://img.shields.io/badge/license-MIT-6E56CF.svg)](#license)
[![Status](https://img.shields.io/badge/status-active-4ade80.svg)](#roadmap)

[About](#-about) • [Features](#-features) • [Screenshots](#-screenshots) • [Installation](#-installation) • [Usage](#-usage) • [Architecture](#-architecture) • [Roadmap](#-roadmap)

🇧🇷 [Versão em Português](README.pt-BR.md)

</div>

---

## ✨ About

**Claude Usage Monitor** is a small, always-on-top desktop widget that shows how much of your [Claude](https://claude.ai) plan you've already consumed — without having to open a browser and navigate to *Settings → Usage* every hour.

It connects to your Claude account through a native login window, stores the session securely, and refreshes data automatically in the background.

<!--
  ┌──────────────────────────────────────────────────────────────────────┐
  │  IMAGE 2 — HERO / MAIN PREVIEW                                       │
  │  Suggestion: screenshot of the widget in the bottom-right corner of  │
  │  the desktop, with the Claude window blurred in the background.      │
  │  Highlight: progress bars with visible usage percentages.            │
  │  Suggested file: docs/hero.png                                       │
  └──────────────────────────────────────────────────────────────────────┘
-->
<div align="center">
  <img src="docs/hero.png" alt="Widget running on desktop" width="720"/>
</div>

---

## 🚀 Features

- 🪟 **Floating widget** — always on top, frameless, transparent and draggable.
- 🔄 **Auto-refresh** — reloads server data at the interval you choose (5s to 5min).
- ⚡ **Near real-time DOM** — re-reads on-screen values every 2 seconds between reloads.
- 🔐 **Native persistent login** — authenticate once; session saved with secure cookies.
- 🌗 **Light and dark themes** — matches any desktop setup.
- 📊 **Multiple metrics** — shows all available usage bars (messages, Opus, Sonnet, etc.).
- ⏱️ **Countdown timer** — know exactly when the next refresh is coming.
- ⏳ **Reset countdown** — footer shows time remaining until your plan resets.
- 🎛️ **Filters** — hide metrics you don't want to see.
- 📉 **Minimize / restore** — collapse to a slim bar when you just want a quick glance.
- 🖥️ **System tray** — stays discreet in the system tray; one click shows/hides the widget.
- 🌐 **Bilingual** — English and Portuguese (pt-BR) interface.

---

## 📸 Screenshots

<!--
  ┌──────────────────────────────────────────────────────────────────────┐
  │  IMAGE 3 — WIDGET NORMAL STATE (DARK THEME)                          │
  │  Suggestion: focused capture of the widget only, with 3 or 4 bars   │
  │  filled at different percentages.                                    │
  │  Suggested file: docs/widget-dark.png                                │
  └──────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────┐
  │  IMAGE 4 — WIDGET NORMAL STATE (LIGHT THEME)                         │
  │  Suggestion: same capture as above but with the light theme active.  │
  │  Suggested file: docs/widget-light.png                               │
  └──────────────────────────────────────────────────────────────────────┘
-->

<table>
  <tr>
    <td align="center">
      <img src="docs/widget-dark.png" alt="Widget with dark theme" width="340"/>
      <br/><sub><b>Dark theme</b></sub>
    </td>
    <td align="center">
      <img src="docs/widget-light.png" alt="Widget with light theme" width="340"/>
      <br/><sub><b>Light theme</b></sub>
    </td>
  </tr>
</table>

<!--
  ┌──────────────────────────────────────────────────────────────────────┐
  │  IMAGE 5 — SETTINGS PANEL                                            │
  │  Suggestion: widget with the settings panel open, showing            │
  │  theme choice, reload interval and usage filters.                    │
  │  Suggested file: docs/settings.png                                   │
  └──────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────┐
  │  IMAGE 6 — LOGIN WINDOW                                              │
  │  Suggestion: the "Claude — Login" window open with the official      │
  │  claude.ai login screen inside.                                      │
  │  Suggested file: docs/login.png                                      │
  └──────────────────────────────────────────────────────────────────────┘
-->

<table>
  <tr>
    <td align="center">
      <img src="docs/settings.png" alt="Settings panel" width="340"/>
      <br/><sub><b>Settings</b></sub>
    </td>
    <td align="center">
      <img src="docs/login.png" alt="Login window" width="340"/>
      <br/><sub><b>Claude login</b></sub>
    </td>
  </tr>
</table>

<!--
  ┌──────────────────────────────────────────────────────────────────────┐
  │  IMAGE 7 — MINIMIZED MODE + SYSTEM TRAY                              │
  │  Suggestion: composite showing the widget collapsed to a slim bar    │
  │  + the tray icon with the context menu open.                         │
  │  Suggested file: docs/tray-minimized.png                             │
  └──────────────────────────────────────────────────────────────────────┘
-->
<div align="center">
  <img src="docs/tray-minimized.png" alt="Minimized widget and tray icon" width="560"/>
  <br/><sub><b>Minimized + tray icon</b></sub>
</div>

---

## 📦 Installation

### Option 1 — Pre-built installer

Go to the [Releases](../../releases) section and download the file for your platform:

| Platform | File | Architecture |
| -------- | ---- | ------------ |
| Windows  | `Claude-Usage-Monitor-Setup-x.x.x.exe` | x64 |
| macOS    | `Claude-Usage-Monitor-x.x.x.dmg` | x64 (Intel) / arm64 (Apple Silicon) |
| Linux    | `Claude-Usage-Monitor-x.x.x.AppImage` | x64 |

> 💡 You can also download binaries generated on every commit under the
> **Actions → Build → Artifacts** tab.

#### macOS — security warning (Gatekeeper)

The app is not Apple-signed (requires a paid developer account). On first launch macOS may show *"app is damaged"*. To work around this, open Terminal and run:

```bash
xattr -cr /Applications/Claude\ Usage\ Monitor.app
```

#### Linux — make the AppImage executable

```bash
chmod +x Claude-Usage-Monitor-*.AppImage
./Claude-Usage-Monitor-*.AppImage
```

### Option 2 — From source

```bash
# 1. Clone the repo
git clone https://github.com/jnerytech/claude-usage-monitor.git
cd claude-usage-monitor

# 2. Install dependencies
npm install

# 3. Run in development mode
npm start

# 4. (Optional) Build the installer for your current platform
npm run build
```

The installer is generated in `dist/`.

---

## 🎯 Usage

1. **Open the app** — the widget appears in the bottom-right corner of your screen.
2. **Sign in** — click *Sign in to Claude* and authenticate with your normal account.
3. **Done!** — usage data starts appearing within seconds.

### Widget controls

| Icon | Action |
| :--: | :----- |
| ↻ | Refresh now (forces a new fetch). |
| ⚙ | Open / close settings. |
| − | Minimize to a slim bar. |
| ✕ | Close the app. |

### System tray shortcuts

- **Single click** on the icon → show / hide the widget.
- **Right-click** → context menu with *Show / Hide* and *Quit* options.

<!--
  ┌──────────────────────────────────────────────────────────────────────┐
  │  IMAGE 8 — DEMO GIF (OPTIONAL)                                       │
  │  Suggestion: short GIF (10–15s) showing the flow: open → login →    │
  │  bars loading → change theme → minimize.                             │
  │  Suggested file: docs/demo.gif                                       │
  └──────────────────────────────────────────────────────────────────────┘
-->
<div align="center">
  <img src="docs/demo.gif" alt="Animated demo" width="640"/>
</div>

---

## 🏗️ Architecture

The app is a simple **Electron** application with three windows and a tray.

```
┌───────────────────────┐        ┌─────────────────────────┐
│   Main Window         │        │   Hidden Window         │
│   (floating widget)   │◀──IPC──│   (loads claude.ai/     │
│   renderer/index.html │        │    settings/usage in    │
└───────────────────────┘        │    background)          │
           ▲                     └─────────────────────────┘
           │                                  │
           │                                  │ executeJavaScript
           │                                  ▼
┌───────────────────────┐        ┌─────────────────────────┐
│   Tray Icon           │        │   DOM extraction        │
│   (show/hide)         │        │   (progress bars, %)    │
└───────────────────────┘        └─────────────────────────┘
```

**Update strategy** — two independent timers:

| Timer | Frequency | Purpose |
| ----- | --------- | ------- |
| `reloadTimer` | configurable (5s–5min) | reloads the page → fetches fresh server data |
| `extractTimer` | 2 seconds | re-reads the already-loaded DOM → responsiveness |

### Stack

- [Electron 41](https://www.electronjs.org/) — desktop runtime.
- [electron-store](https://github.com/sindresorhus/electron-store) — cookie and preference persistence.
- [electron-updater](https://www.electron.build/auto-update) — auto-update via GitHub Releases.
- [electron-builder](https://www.electron.build/) — installer packaging.
- **Plain HTML / CSS / JS** in the renderer — no framework, no bundler.

---

## 🗂️ Project structure

```
claude-usage-monitor/
├── main.js              # Electron main process (windows, tray, timers, IPC)
├── preload.js           # secure bridge between main and renderer
├── renderer/
│   ├── index.html       # widget UI
│   ├── style.css        # styles (light/dark themes)
│   ├── locales.js       # i18n strings (en / pt-BR)
│   └── app.js           # UI logic and claudeAPI communication
├── assets/              # app and installer icons
├── build/               # 1024×1024 icon for mac/linux builds
├── scripts/             # icon generation utilities
└── package.json
```

---

## 🔒 Privacy

- Session cookies stay **on your machine only**, managed via `electron-store`.
- The app **sends no data** to any proprietary server — it only accesses `claude.ai` on your behalf.
- You can sign out at any time (tray → Quit) → clears cookies and local storage.

---

## 🛠️ CI / Release

The repository has a [`Build`](.github/workflows/build.yml) workflow that compiles for all three platforms in parallel:

| Event | What happens |
| ----- | ------------ |
| Push to `main` or Pull Request | Build Windows + macOS + Linux, upload as **artifacts** (30 days). |
| Push of tag `v*` (e.g. `v1.0.0`) | Build + automatic **GitHub Release** creation with all installers. |
| `workflow_dispatch` | Manual build from the Actions tab. |

**Files generated per platform:**

| Platform | Files |
| -------- | ----- |
| Windows  | `.exe`, `.exe.blockmap`, `latest.yml` |
| macOS    | `.dmg`, `.dmg.blockmap`, `.zip`, `latest-mac.yml` |
| Linux    | `.AppImage`, `.AppImage.blockmap`, `latest-linux.yml` |

### Publishing a new release

```bash
# update version in package.json, commit, then:
git tag v1.0.0
git push origin v1.0.0
```

The pipeline compiles everything, creates the Release and attaches files for all platforms.
The `latest*.yml` files enable auto-update via `electron-updater` (works on Windows and Linux; macOS requires Apple signing).

### Regenerating icons

```bash
npm run icons
```

Converts `build/icon.svg` → `build/icon.png` (1024px) and `assets/icon.ico`, and `assets/tray.svg` → `assets/tray.png` (32px).

---

## 🗺️ Roadmap

- [x] Automated build and release via GitHub Actions
- [x] macOS and Linux support
- [x] System tray with show/hide
- [x] Reset countdown per metric
- [x] Bilingual UI (en / pt-BR)
- [x] Professional SVG icons
- [ ] Usage history chart (last 7 days)
- [ ] Notifications when a threshold is crossed (e.g. 80%)
- [ ] Configurable global shortcut to show/hide
- [ ] Persistent widget position and size between sessions

---

## 🤝 Contributing

Contributions, issues and suggestions are very welcome!

1. Fork the project.
2. Create your branch: `git checkout -b feat/my-feature`.
3. Commit: `git commit -m 'feat: my feature'`.
4. Push: `git push origin feat/my-feature`.
5. Open a Pull Request.

---

## 📄 License

Distributed under the **MIT** license. See [`LICENSE`](LICENSE) for details.

---

<div align="center">

Made with ☕ and lots of Claude by [**@jnerytech**](https://github.com/jnerytech)

<sub>This project is not affiliated with Anthropic. *Claude* is a trademark of Anthropic, PBC.</sub>

</div>
