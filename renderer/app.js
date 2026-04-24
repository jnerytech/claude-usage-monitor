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

const confirmOverlay = document.getElementById('confirm-overlay');
const confirmCancel  = document.getElementById('confirm-cancel');
const confirmQuit    = document.getElementById('confirm-quit');

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let minimized      = false;
let fullHeight     = 380;
let inSettings     = false;
let nextFetchAt    = null;
let countdownTick  = null;
let loggedIn       = false;
let lastUsageData  = null;   // cache for settings filter
let settings       = { refreshInterval: 30, hiddenItems: [] };

// ---------------------------------------------------------------------------
// Panel helpers
// ---------------------------------------------------------------------------

const ALL_CONTENT_PANELS = [authPanel, loadingState, errorState, emptyState];

function showPanel(panel) {
  ALL_CONTENT_PANELS.forEach(p => p.style.display = 'none');
  usageList.style.display  = 'none';
  settingsPanel.style.display = 'none';
  if (panel) panel.style.display = 'flex';
}

function showUsage() {
  ALL_CONTENT_PANELS.forEach(p => p.style.display = 'none');
  settingsPanel.style.display = 'none';
  usageList.style.display = 'flex';
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
    itemsFilter.innerHTML = '<p class="settings-hint">Carregue os dados de uso para configurar os filtros.</p>';
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
  settingsBtn.title = 'Voltar';

  intervalSelect.value = String(settings.refreshInterval);
  buildItemsFilter();

  ALL_CONTENT_PANELS.forEach(p => p.style.display = 'none');
  usageList.style.display = 'none';
  settingsPanel.style.display = 'flex';
}

function closeSettings() {
  inSettings = false;
  settingsBtn.innerHTML = '&#x2699;';
  settingsBtn.title = 'Configurações';
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
  const newInterval = parseInt(intervalSelect.value, 10);

  const hiddenItems = [];
  itemsFilter.querySelectorAll('input[type=checkbox]').forEach(cb => {
    if (!cb.checked) hiddenItems.push(cb.dataset.label);
  });

  settings = { refreshInterval: newInterval, hiddenItems };
  await window.claudeAPI.saveSettings(settings);

  closeSettings();

  // re-render immediately with new filter
  if (lastUsageData) renderUsage(lastUsageData);
}

// ---------------------------------------------------------------------------
// Close confirmation
// ---------------------------------------------------------------------------

function showConfirm() {
  confirmOverlay.style.display = 'flex';
}

function hideConfirm() {
  confirmOverlay.style.display = 'none';
}

// ---------------------------------------------------------------------------
// IPC listeners
// ---------------------------------------------------------------------------

window.claudeAPI.onUsageData((payload) => {
  setStatus('');

  if (payload.error) {
    const expired = /auth|login|403/i.test(payload.error);
    if (expired) reconnectBtn.style.display = 'block';
    errorMsg.textContent = 'Erro ao carregar dados.';
    if (!inSettings) showPanel(errorState);
    lastUpdateEl.textContent = `Erro às ${formatTime(payload.fetchedAt)}`;
    return;
  }

  reconnectBtn.style.display = 'none';

  if (payload.data && payload.data.length) {
    lastUsageData = payload.data;
    if (!inSettings) renderUsage(lastUsageData);
  } else {
    if (!inSettings) showPanel(emptyState);
  }

  lastUpdateEl.textContent = `Atualizado às ${formatTime(payload.fetchedAt)}`;
  syncNextFetchAt();
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
  minimizeBtn.title     = minimized ? 'Restaurar' : 'Minimizar';

  if (minimized) {
    fullHeight = window.innerHeight;
    window.claudeAPI.minimizeWidget();
    requestAnimationFrame(() => document.body.classList.add('minimized'));
  } else {
    document.body.classList.remove('minimized');
    window.claudeAPI.restoreWidget(fullHeight);
  }
});

closeBtn.addEventListener('click', showConfirm);
confirmCancel.addEventListener('click', hideConfirm);
confirmQuit.addEventListener('click', () => window.claudeAPI.quitApp());

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
