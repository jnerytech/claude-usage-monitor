'use strict';

// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------
const statusDot     = document.getElementById('status-dot');
const countdownEl   = document.getElementById('countdown');
const refreshBtn    = document.getElementById('refresh-btn');
const settingsBtn   = document.getElementById('settings-btn');
const minimizeBtn   = document.getElementById('minimize-btn');
const closeBtn      = document.getElementById('close-btn');
const loginBtn      = document.getElementById('login-btn');
const retryBtn      = document.getElementById('retry-btn');
const reconnectBtn  = document.getElementById('reconnect-btn');
const lastUpdateEl  = document.getElementById('last-update');
const resetInfoEl   = document.getElementById('reset-info');

const authPanel     = document.getElementById('auth-panel');
const loadingState  = document.getElementById('loading-state');
const errorState    = document.getElementById('error-state');
const emptyState    = document.getElementById('empty-state');
const usageList     = document.getElementById('usage-list');
const errorMsg      = document.getElementById('error-msg');
const settingsPanel = document.getElementById('settings-panel');

const intervalSelect   = document.getElementById('interval-select');
const itemsFilter      = document.getElementById('items-filter');
const saveSettingsBtn  = document.getElementById('save-settings-btn');
const opacitySlider    = document.getElementById('opacity-slider');
const opacityValueEl   = document.getElementById('opacity-value');


// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let minimized      = false;
let fullHeight     = 380;
let inSettings     = false;
let nextFetchAt    = null;
let countdownTick  = null;
let loggedIn       = false;
let lastUsageData  = null;
let lastResetMs    = null;
let resetTick      = null;
let settings       = { refreshInterval: 5, hiddenItems: [], theme: 'dark', opacity: 1, lang: 'pt-BR' };

// ---------------------------------------------------------------------------
// Panel helpers
// ---------------------------------------------------------------------------

const ALL_CONTENT_PANELS = [authPanel, loadingState, errorState, emptyState];

const WIDGET_EL = document.getElementById('widget');

function autoResize() {
  if (minimized) return;
  // Double-raf: first frame commits style changes, second measures settled layout.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const h = WIDGET_EL.offsetHeight;
    const clamped = Math.max(100, Math.min(560, h));
    if (Math.abs(clamped - fullHeight) > 1) {
      fullHeight = clamped;
      window.claudeAPI.resizeWindow(clamped);
    }
  }));
}

function applyTheme(theme) {
  document.body.classList.toggle('theme-light', theme === 'light');
  document.querySelectorAll('.theme-opt').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
}

function applyOpacity(value) {
  WIDGET_EL.style.opacity = value;
  const pct = Math.round(value * 100);
  opacitySlider.value = pct;
  opacityValueEl.textContent = `${pct}%`;
}

function showPanel(panel) {
  ALL_CONTENT_PANELS.forEach(p => p.style.display = 'none');
  usageList.style.display  = 'none';
  settingsPanel.style.display = 'none';
  if (panel) panel.style.display = 'flex';
  autoResize();
}

function showUsage() {
  ALL_CONTENT_PANELS.forEach(p => p.style.display = 'none');
  settingsPanel.style.display = 'none';
  usageList.style.display = 'flex';
  autoResize();
}

function setStatus(state) {
  statusDot.className = state;
}

// ---------------------------------------------------------------------------
// Countdown
// ---------------------------------------------------------------------------

function startCountdown() {
  clearInterval(countdownTick);
  countdownTick = setInterval(() => {
    if (!nextFetchAt) { countdownEl.textContent = '--:--'; return; }
    const secs = Math.max(0, Math.round((nextFetchAt - Date.now()) / 1000));
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    countdownEl.textContent = `${m}:${s}`;
  }, 1000);
}

async function syncNextFetchAt() {
  try { nextFetchAt = await window.claudeAPI.getNextFetchAt(); } catch (_) {}
}

// ---------------------------------------------------------------------------
// Usage rendering
// ---------------------------------------------------------------------------

function pctClass(pct) {
  if (pct >= 85) return 'high';
  if (pct >= 60) return 'medium';
  return 'low';
}

function renderUsage(items) {
  usageList.innerHTML = '';

  const visible = items.filter(i => !settings.hiddenItems.includes(i.label));

  if (!visible.length) {
    showPanel(emptyState);
    return;
  }

  visible.forEach(({ label, pct, resetText }) => {
    const cls = pctClass(pct);
    const fillW = Math.min(100, Math.max(0, pct));
    const item = document.createElement('div');
    item.className = 'usage-item';
    item.innerHTML = `
      <div class="usage-row">
        <span class="usage-label" title="${esc(label)}">${esc(label)}</span>
        <span class="usage-pct ${cls}">${pct}%</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill ${cls}${fillW === 100 ? ' full-bar' : ''}" style="width:${fillW}%"></div>
      </div>
      ${resetText ? `<div class="usage-reset">${esc(resetText)}</div>` : ''}
    `;
    usageList.appendChild(item);
  });

  showUsage();
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ---------------------------------------------------------------------------
// Settings panel
// ---------------------------------------------------------------------------

function buildItemsFilter() {
  itemsFilter.innerHTML = '';

  if (!lastUsageData || !lastUsageData.length) {
    itemsFilter.innerHTML = `<p class="settings-hint">${t('filtersHint')}</p>`;
    return;
  }

  lastUsageData.forEach(({ label }) => {
    const visible = !settings.hiddenItems.includes(label);

    const row = document.createElement('label');
    row.className = 'filter-item';
    row.innerHTML = `
      <span class="filter-item-label" title="${esc(label)}">${esc(label)}</span>
      <span class="toggle">
        <input type="checkbox" ${visible ? 'checked' : ''} data-label="${esc(label)}" />
        <span class="toggle-track"></span>
      </span>
    `;
    itemsFilter.appendChild(row);
  });
}

function openSettings() {
  inSettings = true;
  settingsBtn.innerHTML = '&#x2190;';
  settingsBtn.title = t('back');

  intervalSelect.value = String(settings.refreshInterval);
  applyTheme(settings.theme || 'dark');
  applyOpacity(settings.opacity ?? 1);
  document.querySelectorAll('[data-lang]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === currentLang);
  });
  buildItemsFilter();

  ALL_CONTENT_PANELS.forEach(p => p.style.display = 'none');
  usageList.style.display = 'none';
  settingsPanel.style.display = 'flex';
  autoResize();
}

function closeSettings() {
  inSettings = false;
  settingsBtn.innerHTML = '&#x2699;';
  settingsBtn.title = t('settingsTitle');
  settingsPanel.style.display = 'none';

  // restore previous view
  if (!loggedIn) {
    showPanel(authPanel);
  } else if (lastUsageData && lastUsageData.length) {
    renderUsage(lastUsageData);
  } else {
    showPanel(loadingState);
  }
}

async function saveSettings() {
  const newInterval = parseFloat(intervalSelect.value);

  const hiddenItems = [];
  itemsFilter.querySelectorAll('input[type=checkbox]').forEach(cb => {
    if (!cb.checked) hiddenItems.push(cb.dataset.label);
  });

  const activeThemeBtn = document.querySelector('.theme-opt[data-theme].active');
  const theme = activeThemeBtn ? activeThemeBtn.dataset.theme : 'dark';
  const opacity = parseInt(opacitySlider.value) / 100;

  settings = { refreshInterval: newInterval, hiddenItems, theme, opacity, lang: currentLang };
  await window.claudeAPI.saveSettings(settings);

  closeSettings();

  // re-render immediately with new filter
  if (lastUsageData) renderUsage(lastUsageData);
}

// ---------------------------------------------------------------------------
// Reset countdown
// ---------------------------------------------------------------------------

function parseResetDate(resetAt, text) {
  if (resetAt) {
    const d = new Date(resetAt);
    if (!isNaN(d)) return d;
  }
  if (!text) return null;
  // "Resets in 2 hr 24 min"
  const hrMin = text.match(/in\s+(\d+)\s+hr\s+(\d+)\s+min/i);
  if (hrMin) return new Date(Date.now() + (parseInt(hrMin[1]) * 60 + parseInt(hrMin[2])) * 60000);
  // "Resets in X hr"
  const hrOnly = text.match(/in\s+(\d+)\s+hr/i);
  if (hrOnly) return new Date(Date.now() + parseInt(hrOnly[1]) * 3600000);
  // "Resets in X min"
  const minOnly = text.match(/in\s+(\d+)\s+min/i);
  if (minOnly) return new Date(Date.now() + parseInt(minOnly[1]) * 60000);
  // "Resets in X days"
  const inDays = text.match(/in\s+(\d+)\s+day/i);
  if (inDays) return new Date(Date.now() + parseInt(inDays[1]) * 86400000);
  // "Resets May 1"
  const monthDay = text.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\.?\s+\d+/i);
  if (monthDay) {
    const d = new Date(`${monthDay[0]} ${new Date().getFullYear()}`);
    if (!isNaN(d)) {
      if (d <= new Date()) d.setFullYear(d.getFullYear() + 1);
      return d;
    }
  }
  return null;
}

function formatTimeRemaining(ms) {
  if (ms <= 0) return t('soon');
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function updateResetInfo() {
  if (!lastResetMs) { resetInfoEl.textContent = ''; return; }
  resetInfoEl.textContent = `${t('nextReset')} ${formatTimeRemaining(lastResetMs - Date.now())}`;
}

function startResetCountdown(resetDate) {
  clearInterval(resetTick);
  lastResetMs = resetDate ? resetDate.getTime() : null;
  updateResetInfo();
  if (lastResetMs) resetTick = setInterval(updateResetInfo, 30000);
}

// ---------------------------------------------------------------------------
// IPC listeners
// ---------------------------------------------------------------------------

window.claudeAPI.onUsageData((payload) => {
  setStatus('');

  if (payload.error) {
    const expired = /auth|login|403/i.test(payload.error);
    if (expired) reconnectBtn.style.display = 'block';
    errorMsg.textContent = t('errorMsg');
    if (!inSettings) showPanel(errorState);
    lastUpdateEl.textContent = `${t('errorAt')} ${formatTime(payload.fetchedAt)}`;
    return;
  }

  reconnectBtn.style.display = 'none';

  const items = payload.data?.items ?? payload.data;
  const resetAt = payload.data?.resetAt ?? null;

  if (items && items.length) {
    lastUsageData = items;
    // Use the soonest reset among all items for the footer countdown
    let soonest = null;
    for (const item of items) {
      const d = parseResetDate(null, item.resetText);
      if (d && (!soonest || d < soonest)) soonest = d;
    }
    startResetCountdown(soonest || parseResetDate(resetAt, null));
    if (!inSettings) renderUsage(lastUsageData);
  } else {
    if (!inSettings) showPanel(emptyState);
  }

  lastUpdateEl.textContent = `${t('updatedAt')} ${formatTime(payload.fetchedAt)}`;
});

window.claudeAPI.onNextFetchAt((val) => {
  nextFetchAt = val;
});

window.claudeAPI.onAuthStatus((payload) => {
  loggedIn = payload.loggedIn;
  if (loggedIn) {
    setStatus('loading');
    if (!inSettings) showPanel(loadingState);
    reconnectBtn.style.display = 'none';
  } else {
    setStatus('offline');
    if (!inSettings) showPanel(authPanel);
    reconnectBtn.style.display = 'none';
  }
});

// ---------------------------------------------------------------------------
// Button handlers
// ---------------------------------------------------------------------------

refreshBtn.addEventListener('click', () => {
  setStatus('loading');
  if (loggedIn && !inSettings) showPanel(loadingState);
  nextFetchAt = Date.now() + settings.refreshInterval * 1000;
  window.claudeAPI.refreshData();
});

settingsBtn.addEventListener('click', () => {
  if (inSettings) closeSettings();
  else openSettings();
});

minimizeBtn.addEventListener('click', () => {
  minimized = !minimized;
  minimizeBtn.innerHTML = minimized ? '&#x25A1;' : '&#x2212;';
  minimizeBtn.title     = minimized ? t('restoreTitle') : t('minimizeTitle');

  if (minimized) {
    fullHeight = WIDGET_EL.offsetHeight;
    window.claudeAPI.minimizeWidget(); // sets minHeight→44 + resizes window
    requestAnimationFrame(() => document.body.classList.add('minimized'));
  } else {
    document.body.classList.remove('minimized');
    window.claudeAPI.restoreWidget(fullHeight); // restores minHeight→120
    // let CSS settle then resize to actual content height
    autoResize();
  }
});

// Theme picker buttons
document.querySelectorAll('.theme-opt[data-theme]').forEach(btn => {
  btn.addEventListener('click', () => {
    applyTheme(btn.dataset.theme);
  });
});

opacitySlider.addEventListener('input', () => {
  applyOpacity(parseInt(opacitySlider.value) / 100);
});

document.querySelectorAll('[data-lang]').forEach(btn => {
  btn.addEventListener('click', () => {
    setLang(btn.dataset.lang);
    applyTranslations();
    document.querySelectorAll('[data-lang]').forEach(b => {
      b.classList.toggle('active', b.dataset.lang === currentLang);
    });
    settingsBtn.title = t('back');
    minimizeBtn.title = minimized ? t('restoreTitle') : t('minimizeTitle');
    if (lastResetMs) updateResetInfo();
  });
});

closeBtn.addEventListener('click', () => window.claudeAPI.quitApp());

loginBtn.addEventListener('click', () => window.claudeAPI.openLogin());
retryBtn.addEventListener('click', () => {
  setStatus('loading');
  showPanel(loadingState);
  window.claudeAPI.refreshData();
});
reconnectBtn.addEventListener('click', () => window.claudeAPI.openLogin());
saveSettingsBtn.addEventListener('click', saveSettings);

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

async function init() {
  try {
    [{ loggedIn: loggedIn }, settings] = await Promise.all([
      window.claudeAPI.getAuthStatus(),
      window.claudeAPI.getSettings(),
    ]);

    setLang(settings.lang || 'pt-BR');
    applyTranslations();
    applyTheme(settings.theme || 'dark');
    applyOpacity(settings.opacity ?? 1);

    if (loggedIn) {
      setStatus('loading');
      showPanel(loadingState);
      await syncNextFetchAt();
    } else {
      setStatus('offline');
      showPanel(authPanel);
    }
  } catch (err) {
    console.error('init:', err);
    setStatus('error');
    showPanel(authPanel);
  }
}

startCountdown();
init();
