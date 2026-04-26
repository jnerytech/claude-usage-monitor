'use strict';

const { app, BrowserWindow, Tray, Menu, ipcMain, screen, session, nativeImage, Notification } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { autoUpdater } = require('electron-updater');

const store = new Store();

let mainWindow = null;
let loginWindow = null;
let hiddenWindow = null;
let tray = null;
let reloadTimer = null;  // fires at user interval → reloads the page
let extractTimer = null; // fires every 2s → re-reads already-loaded DOM
let nextFetchAt = null;
let isQuitting = false;
let trayNotificationShown = false;
let alertState = { thresholdFired: {}, nearResetFired: {}, prevPct: {} };

const DEFAULT_INTERVAL_S = 5;
const RENDER_DELAY_MS = 3_000;
const EXTRACT_INTERVAL_MS = 2_000; // how often to re-read DOM while page is loaded
const CLAUDE_ORIGIN = 'https://claude.ai';
const USAGE_URL = 'https://claude.ai/settings/usage';
const LOGIN_URL = 'https://claude.ai/login';

// ---------------------------------------------------------------------------
// Cookie persistence
// ---------------------------------------------------------------------------

async function saveCookies() {
  try {
    const cookies = await session.defaultSession.cookies.get({ url: CLAUDE_ORIGIN });
    store.set('cookies', cookies);
  } catch (err) {
    console.error('saveCookies error:', err);
  }
}

async function restoreCookies() {
  const cookies = store.get('cookies', []);
  for (const cookie of cookies) {
    try {
      const { hostOnly, session: _s, expirationDate, ...rest } = cookie;
      await session.defaultSession.cookies.set({
        url: CLAUDE_ORIGIN,
        expirationDate: expirationDate || Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
        ...rest,
      });
    } catch (_) {}
  }
}

function hasSavedCookies() {
  const cookies = store.get('cookies', []);
  return Array.isArray(cookies) && cookies.length > 0;
}

// ---------------------------------------------------------------------------
// Data extraction (runs in hidden window context)
// ---------------------------------------------------------------------------

const EXTRACT_SCRIPT = `
(function() {
  try {
    const bars = Array.from(document.querySelectorAll('[role="progressbar"][aria-valuenow]'));
    if (!bars.length) return null;

    const results = [];
    for (const bar of bars) {
      const pct = parseInt(bar.getAttribute('aria-valuenow'), 10);
      if (isNaN(pct)) continue;

      // Walk up DOM to find a container that has 2+ <p> tags
      let node = bar.parentElement;
      let label = '';
      let resetText = '';

      for (let i = 0; i < 12 && node; i++) {
        const ps = Array.from(node.querySelectorAll('p'));
        if (ps.length >= 2) {
          label = ps[0].textContent.trim();
          const resetP = ps.find(p => /reset/i.test(p.textContent));
          resetText = resetP ? resetP.textContent.trim() : '';
          break;
        }
        node = node.parentElement;
      }

      if (!label) continue;
      results.push({ label, pct, resetText });
    }
    if (!results.length) return null;
    const timeEl = document.querySelector('time[datetime]');
    const resetAt = timeEl ? timeEl.getAttribute('datetime') : null;
    return { items: results, resetAt };
  } catch (e) {
    return { error: e.message };
  }
})();
`;

// ---------------------------------------------------------------------------
// Hidden window — keep-alive architecture
//
// Two separate timers:
//   reloadTimer  → reloads the page at user-configured interval (fresh server data)
//   extractTimer → re-reads the already-loaded DOM every 2s (near real-time)
// ---------------------------------------------------------------------------

function getRefreshIntervalMs() {
  const s = store.get('settings', {});
  return (s.refreshInterval || DEFAULT_INTERVAL_S) * 1000;
}

async function extractOnce() {
  if (!hiddenWindow || hiddenWindow.isDestroyed()) return;
  if (hiddenWindow.webContents.isDestroyed()) return;
  if (hiddenWindow.webContents.isLoading()) return;
  try {
    const data = await hiddenWindow.webContents.executeJavaScript(EXTRACT_SCRIPT);
    if (data && data.items) {
      checkAlerts(data.items, store.get('settings', {}));
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('usage-data', { data, fetchedAt: Date.now() });
    }
  } catch (err) {
    // Frame disposed during page reload — expected, not an error.
    if (err.message && err.message.includes('disposed')) return;
    console.error('extractOnce error:', err);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('usage-data', { error: err.message, fetchedAt: Date.now() });
    }
  }
}

function startExtractLoop() {
  clearInterval(extractTimer);
  extractOnce();
  extractTimer = setInterval(extractOnce, EXTRACT_INTERVAL_MS);
}

function ensureHiddenWindow() {
  if (!hiddenWindow || hiddenWindow.isDestroyed()) {
    hiddenWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        session: session.defaultSession,
      },
    });

    hiddenWindow.webContents.on('did-finish-load', () => {
      // Wait for React to render, then start polling the DOM
      setTimeout(startExtractLoop, RENDER_DELAY_MS);
    });

    hiddenWindow.webContents.on('did-fail-load', (_, code, desc) => {
      console.error('Hidden window load failed:', code, desc);
      clearInterval(extractTimer);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('usage-data', { error: `Load failed: ${desc}`, fetchedAt: Date.now() });
      }
    });
  }
  hiddenWindow.loadURL(USAGE_URL);
}

function pushNextFetchAt() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('next-fetch-at', nextFetchAt);
  }
}

function scheduleFetch() {
  clearInterval(reloadTimer);
  clearInterval(extractTimer);

  ensureHiddenWindow();

  const interval = getRefreshIntervalMs();
  nextFetchAt = Date.now() + interval;
  pushNextFetchAt(); // tell renderer immediately so countdown starts correctly

  reloadTimer = setInterval(() => {
    nextFetchAt = Date.now() + getRefreshIntervalMs();
    clearInterval(extractTimer);
    pushNextFetchAt(); // reset countdown the moment reload fires
    ensureHiddenWindow();
  }, interval);
}

// ---------------------------------------------------------------------------
// Login window
// ---------------------------------------------------------------------------

function openLoginWindow() {
  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.focus();
    return;
  }

  loginWindow = new BrowserWindow({
    width: 480,
    height: 660,
    title: 'Claude — Login',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      session: session.defaultSession,
    },
  });

  loginWindow.loadURL(LOGIN_URL);

  const checkNavigation = async (url) => {
    try {
      const parsed = new URL(url);
      // Login success: user landed on claude.ai but NOT on /login
      if (
        parsed.hostname === 'claude.ai' &&
        !parsed.pathname.startsWith('/login') &&
        !parsed.pathname.startsWith('/oauth')
      ) {
        await saveCookies();
        store.set('loggedIn', true);

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('auth-status', { loggedIn: true });
        }

        if (loginWindow && !loginWindow.isDestroyed()) {
          loginWindow.close();
        }

        scheduleFetch();
      }
    } catch (_) {}
  };

  loginWindow.webContents.on('did-navigate', (_, url) => checkNavigation(url));
  loginWindow.webContents.on('did-navigate-in-page', (_, url) => checkNavigation(url));

  loginWindow.on('closed', () => { loginWindow = null; });
}

// ---------------------------------------------------------------------------
// Main widget window
// ---------------------------------------------------------------------------

function createMainWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  const winW = 280;
  const winH = 380;
  const margin = 16;

  const appIcon = process.platform === 'win32'
    ? path.join(__dirname, 'assets', 'icon.ico')
    : path.join(__dirname, 'build',  'icon.png');

  mainWindow = new BrowserWindow({
    width: winW,
    height: winH,
    minWidth: 220,
    minHeight: 120,
    x: width - winW - margin,
    y: height - winH - margin,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: true,
    hasShadow: false,
    icon: appIcon,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
      showTrayNotification();
    }
  });
}

// ---------------------------------------------------------------------------
// Alert system
// ---------------------------------------------------------------------------

function notify(title, body) {
  if (!Notification.isSupported()) return;
  new Notification({ title: `Claude Usage Monitor — ${title}`, body }).show();
  mainWindow?.webContents.send('notification-added', { title, body, timestamp: Date.now() });
}

function parseResetMins(text) {
  if (!text) return null;
  const hrMin = text.match(/in\s+(\d+)\s+hr\s+(\d+)\s+min/i);
  if (hrMin) return parseInt(hrMin[1]) * 60 + parseInt(hrMin[2]);
  const hrOnly = text.match(/in\s+(\d+)\s+hr/i);
  if (hrOnly) return parseInt(hrOnly[1]) * 60;
  const minOnly = text.match(/in\s+(\d+)\s+min/i);
  if (minOnly) return parseInt(minOnly[1]);
  const daysOnly = text.match(/in\s+(\d+)\s+day/i);
  if (daysOnly) return parseInt(daysOnly[1]) * 1440;
  return null;
}

function checkAlerts(items, settings) {
  if (!settings.alerts) return;
  const { alerts } = settings;

  for (const item of items) {
    const { label, pct, resetText } = item;
    const prev = alertState.prevPct[label] ?? pct;

    if (alerts.threshold?.enabled) {
      const thr = alerts.threshold.pct;
      if (pct >= thr && !alertState.thresholdFired[label]) {
        notify(label, `Usage at ${pct}% (threshold: ${thr}%)`);
        alertState.thresholdFired[label] = true;
      }
      if (pct < thr - 5) alertState.thresholdFired[label] = false;
    }

    if (alerts.nearReset?.enabled) {
      const minsLeft = parseResetMins(resetText);
      if (minsLeft !== null) {
        const { minutesLeft, minPct } = alerts.nearReset;
        if (minsLeft <= minutesLeft && pct >= minPct && !alertState.nearResetFired[label]) {
          notify(`${label} — reset soon`, `${pct}% used, ${Math.round(minsLeft)} min remaining`);
          alertState.nearResetFired[label] = true;
        }
        if (pct <= 10) alertState.nearResetFired[label] = false;
      }
    }

    if (alerts.planReset?.enabled) {
      if (prev >= 50 && pct <= 10) {
        notify(`${label} reset`, `Limit renewed — usage now at ${pct}%`);
      }
    }

    if (alerts.spike?.enabled) {
      const delta = pct - prev;
      if (delta >= alerts.spike.deltaPct) {
        notify(`${label} — usage spike`, `+${delta}% in one refresh (${pct}% total)`);
      }
    }

    alertState.prevPct[label] = pct;
  }
}

// ---------------------------------------------------------------------------
// Tray notification
// ---------------------------------------------------------------------------

function showTrayNotification() {
  if (trayNotificationShown || !Notification.isSupported()) return;
  trayNotificationShown = true;
  new Notification({
    title: 'Claude Usage Monitor',
    body: 'Minimizado para a bandeja. Clique no ícone para reabrir.',
  }).show();
}

// ---------------------------------------------------------------------------
// Tray
// ---------------------------------------------------------------------------

function createTray() {
  // Minimal 1x1 transparent icon fallback (16x16 white square)
  const iconPath = path.join(__dirname, 'assets', 'tray.png');
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) throw new Error('empty');
  } catch (_) {
    // Create a 16x16 solid-color icon as fallback
    icon = nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAAhGVYSWZNTQAqAAAACAAFARIAAwAAAAEAAQAAARoABQAAAAEAAABKARsABQAAAAEAAABSASgAAwAAAAEAAgAAh2kABAAAAAEAAABaAAAAAAAAAEgAAAABAAAASAAAAAEAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAEKADAAQAAAABAAAAEAAAAACRmxBXAAAACXBIWXMAAAsTAAALEwEAmpwYAAACymlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iWE1QIENvcmUgNi4wLjAiPgogICA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPgogICAgICA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIgogICAgICAgICAgICB4bWxuczpleGlmPSJodHRwOi8vbnMuYWRvYmUuY29tL2V4aWYvMS4wLyIKICAgICAgICAgICAgeG1sbnM6dGlmZj0iaHR0cDovL25zLmFkb2JlLmNvbS90aWZmLzEuMC8iPgogICAgICAgICA8ZXhpZjpQaXhlbFlEaW1lbnNpb24+MTY8L2V4aWY6UGl4ZWxZRGltZW5zaW9uPgogICAgICAgICA8ZXhpZjpQaXhlbFhEaW1lbnNpb24+MTY8L2V4aWY6UGl4ZWxYRGltZW5zaW9uPgogICAgICAgICA8ZXhpZjpDb2xvclNwYWNlPjE8L2V4aWY6Q29sb3JTcGFjZT4KICAgICAgICAgPHRpZmY6T3JpZW50YXRpb24+MTwvdGlmZjpPcmllbnRhdGlvbj4KICAgICAgPC9yZGY6RGVzY3JpcHRpb24+CiAgIDwvcmRmOlJERj4KPC94OnhtcG1ldGE+Cnr0sVAAAABaSURBVDgRY/z//z8DJYCJgUIAuoEmhpHAiM9AMCHGxsb/CQkJ/2FiDg4O/2GGOzk5/YeZDgAA//8YGBj+w8R/Q6EAABKNCAiPRCMCGRERAbERAQAAAP//AwBKpQiHcKRbWAAAAABJRU5ErkJggg=='
    );
  }

  tray = new Tray(icon);
  tray.setToolTip('Claude Usage Monitor');

  const buildMenu = () => Menu.buildFromTemplate([
    {
      label: mainWindow && mainWindow.isVisible() ? 'Ocultar' : 'Mostrar',
      click: toggleMainWindow,
    },
    { type: 'separator' },
    { label: 'Sair', click: () => app.quit() },
  ]);

  tray.on('click', toggleMainWindow);
  tray.on('right-click', () => tray.popUpContextMenu(buildMenu()));
}

function toggleMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow();
    return;
  }
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

// ---------------------------------------------------------------------------
// Position presets
// ---------------------------------------------------------------------------

function applyPositionPreset(preset) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const margin = 16;
  const [winW, winH] = mainWindow.getSize();
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();

  let display;
  if (preset === 'monitor1') {
    display = primary;
  } else if (preset === 'monitor2') {
    display = displays.find(d => d.id !== primary.id) ?? primary;
  } else {
    const { x, y } = mainWindow.getBounds();
    display = screen.getDisplayNearestPoint({ x, y });
  }

  const { x: dx, y: dy, width: dw, height: dh } = display.workArea;
  let wx, wy;

  switch (preset) {
    case 'top-left':
      wx = dx + margin;              wy = dy + margin;              break;
    case 'top-right':
      wx = dx + dw - winW - margin;  wy = dy + margin;              break;
    case 'bottom-left':
      wx = dx + margin;              wy = dy + dh - winH - margin;  break;
    default: // bottom-right, monitor1, monitor2
      wx = dx + dw - winW - margin;  wy = dy + dh - winH - margin;  break;
  }

  mainWindow.setPosition(wx, wy);
}

// ---------------------------------------------------------------------------
// IPC handlers
// ---------------------------------------------------------------------------

ipcMain.handle('get-auth-status', () => ({ loggedIn: store.get('loggedIn', false) }));

ipcMain.handle('get-next-fetch-at', () => nextFetchAt);

ipcMain.on('open-login', () => openLoginWindow());

ipcMain.on('refresh-data', () => scheduleFetch());

ipcMain.on('logout', async () => {
  store.delete('cookies');
  store.delete('loggedIn');
  await session.defaultSession.clearStorageData({ origin: CLAUDE_ORIGIN });
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('auth-status', { loggedIn: false });
  }
});

ipcMain.on('minimize-widget', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setMinimumSize(220, 44);
    mainWindow.setSize(mainWindow.getSize()[0], 44);
  }
});

ipcMain.on('restore-widget', (_, height) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setMinimumSize(220, 120);
    mainWindow.setSize(mainWindow.getSize()[0], height || 380);
  }
});

ipcMain.on('resize-window', (_, height) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setSize(mainWindow.getSize()[0], height);
  }
});

ipcMain.handle('get-settings', () => {
  return store.get('settings', { refreshInterval: DEFAULT_INTERVAL_S, hiddenItems: [] });
});

ipcMain.handle('save-settings', (_, settings) => {
  store.set('settings', settings);
  if (hasSavedCookies()) scheduleFetch();
});

ipcMain.on('quit-app', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide();
    showTrayNotification();
  }
});

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Auto-update (electron-updater → GitHub Releases)
// ---------------------------------------------------------------------------

function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('error', (err) => console.error('autoUpdater error:', err));
  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version);
  });
  autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded:', info.version);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-downloaded', { version: info.version });
      mainWindow.webContents.send('notification-added', {
        title: `Update v${info.version} ready`,
        body: 'Click Install & Restart to apply.',
        timestamp: Date.now(),
      });
    }
  });

  // Dev builds don't have update metadata — skip to avoid noisy errors.
  if (!app.isPackaged) return;

  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    console.error('checkForUpdates failed:', err);
  });
}

ipcMain.on('install-update', () => autoUpdater.quitAndInstall());

ipcMain.on('set-position', (_, preset) => applyPositionPreset(preset));

ipcMain.handle('get-login-item', () => app.getLoginItemSettings().openAtLogin);
ipcMain.on('set-login-item', (_, enable) => app.setLoginItemSettings({ openAtLogin: enable }));
ipcMain.on('test-notification', () => notify('Test', 'Notifications are working!'));

app.whenReady().then(async () => {
  await restoreCookies();
  createMainWindow();
  createTray();
  setupAutoUpdater();

  if (hasSavedCookies()) {
    scheduleFetch();
  }
});

app.on('window-all-closed', () => {
  // Keep app alive via tray — intentionally do not call app.quit()
});

app.on('before-quit', () => {
  isQuitting = true;
  clearInterval(reloadTimer);
  clearInterval(extractTimer);
});
