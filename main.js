'use strict';

const { app, BrowserWindow, Tray, Menu, ipcMain, screen, session, nativeImage } = require('electron');
const path = require('path');
const Store = require('electron-store');

const store = new Store();

let mainWindow = null;
let loginWindow = null;
let hiddenWindow = null;
let tray = null;
let fetchTimer = null;
let nextFetchAt = null;

const DEFAULT_INTERVAL_S = 30;
const RENDER_DELAY_MS = 3_000;
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
          resetText = ps[ps.length - 1].textContent.trim();
          break;
        }
        node = node.parentElement;
      }

      if (!label) continue;
      results.push({ label, pct, resetText });
    }
    return results.length ? results : null;
  } catch (e) {
    return { error: e.message };
  }
})();
`;

// ---------------------------------------------------------------------------
// Hidden window for fetching usage data
// ---------------------------------------------------------------------------

function createHiddenWindow() {
  if (hiddenWindow && !hiddenWindow.isDestroyed()) {
    hiddenWindow.destroy();
  }

  hiddenWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      session: session.defaultSession,
    },
  });

  hiddenWindow.webContents.on('did-finish-load', () => {
    setTimeout(async () => {
      if (!hiddenWindow || hiddenWindow.isDestroyed()) return;
      try {
        const data = await hiddenWindow.webContents.executeJavaScript(EXTRACT_SCRIPT);
        const payload = { data, fetchedAt: Date.now() };
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('usage-data', payload);
        }
      } catch (err) {
        console.error('executeJavaScript error:', err);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('usage-data', { error: err.message, fetchedAt: Date.now() });
        }
      }
    }, RENDER_DELAY_MS);
  });

  hiddenWindow.webContents.on('did-fail-load', (_, code, desc) => {
    console.error('Hidden window load failed:', code, desc);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('usage-data', { error: `Load failed: ${desc}`, fetchedAt: Date.now() });
    }
  });

  hiddenWindow.loadURL(USAGE_URL);
}

function getRefreshIntervalMs() {
  const s = store.get('settings', {});
  return ((s.refreshInterval || DEFAULT_INTERVAL_S) * 1000);
}

function scheduleFetch() {
  clearInterval(fetchTimer);
  const interval = getRefreshIntervalMs();
  nextFetchAt = Date.now() + interval;
  createHiddenWindow();

  fetchTimer = setInterval(() => {
    nextFetchAt = Date.now() + getRefreshIntervalMs();
    createHiddenWindow();
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

  const winW = 288;  // 280px widget + 4px body padding × 2 sides
  const winH = 388;
  const margin = 16;

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
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ---------------------------------------------------------------------------
// Tray
// ---------------------------------------------------------------------------

function createTray() {
  // Minimal 1x1 transparent icon fallback (16x16 white square)
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
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
// IPC handlers
// ---------------------------------------------------------------------------

ipcMain.handle('get-auth-status', () => ({ loggedIn: store.get('loggedIn', false) }));

ipcMain.handle('get-next-fetch-at', () => nextFetchAt);

ipcMain.on('open-login', () => openLoginWindow());

ipcMain.on('refresh-data', () => {
  clearInterval(fetchTimer);
  scheduleFetch();
});

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
    mainWindow.setMinimumSize(220, 52); // 44px header + 4px padding × 2
    mainWindow.setSize(mainWindow.getSize()[0], 52);
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

ipcMain.on('quit-app', () => app.quit());

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(async () => {
  await restoreCookies();
  createMainWindow();
  createTray();

  if (hasSavedCookies()) {
    scheduleFetch();
  }
});

app.on('window-all-closed', () => {
  // Keep app alive via tray — intentionally do not call app.quit()
});

app.on('before-quit', () => {
  clearInterval(fetchTimer);
});
