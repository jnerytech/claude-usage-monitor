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

const headerSessionEl  = document.getElementById('header-session');
const updateBanner     = document.getElementById('update-banner');
const updateText       = document.getElementById('update-text');
const installUpdateBtn = document.getElementById('install-update-btn');

const bellBtn          = document.getElementById('bell-btn');
const bellBadge        = document.getElementById('bell-badge');
const notifPanel       = document.getElementById('notif-panel');
const notifList        = document.getElementById('notif-list');
const notifClearBtn    = document.getElementById('notif-clear-btn');

const startupToggle    = document.getElementById('startup-enabled');
const intervalSelect   = document.getElementById('interval-select');
const itemsFilter      = document.getElementById('items-filter');
const saveSettingsBtn  = document.getElementById('save-settings-btn');
const saveAlertsBtn    = document.getElementById('save-alerts-btn');
const opacitySlider    = document.getElementById('opacity-slider');
const opacityValueEl   = document.getElementById('opacity-value');
const settingsMenu     = document.getElementById('settings-menu');


// ---------------------------------------------------------------------------
// SVG icon snippets (Feather Icons, MIT)
// ---------------------------------------------------------------------------
const SVG_SETTINGS   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
const SVG_BACK       = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`;
const SVG_MINIMIZE   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
const SVG_RESTORE    = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let minimized      = false;
let fullHeight     = 380;
let inSettings     = false;
let inSubPage      = false;
let currentSubPage = null;
let nextFetchAt    = null;
let countdownTick  = null;
let loggedIn       = false;
let lastUsageData  = null;
let lastResetMs    = null;
let resetTick      = null;
let settings       = { refreshInterval: 5, hiddenItems: [], theme: 'dark', opacity: 1, lang: 'en', alerts: { threshold: { enabled: true, pct: 80 }, nearReset: { enabled: true, minutesLeft: 30, minPct: 75 }, resetWarning: { enabled: true, minutesLeft: 30 }, planReset: { enabled: true }, spike: { enabled: true, deltaPct: 20 } } };
let notifications  = JSON.parse(localStorage.getItem('notif_v1') || '[]');
let notifOpen      = false;

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

function updateHeaderSession() {
  if (!lastUsageData || !lastUsageData.length) {
    headerSessionEl.textContent = '';
    headerSessionEl.className = '';
    return;
  }
  const visible = lastUsageData.filter(i => !settings.hiddenItems.includes(i.label));
  if (!visible.length) {
    headerSessionEl.textContent = '';
    headerSessionEl.className = '';
    return;
  }
  const item = visible.find(i => /session/i.test(i.label)) || visible[0];
  const resetDate = parseResetDate(null, item.resetText);
  const resetPart = resetDate ? ` · ${formatTimeRemaining(resetDate - Date.now())}` : '';
  headerSessionEl.textContent = `${item.pct}%${resetPart}`;
  headerSessionEl.className = pctClass(item.pct);
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
      ${resetText ? (() => {
        const rd = parseResetDate(null, resetText);
        const display = rd ? `Resets in ${formatTimeRemaining(rd - Date.now())}` : esc(resetText);
        return `<div class="usage-reset">${display}</div>`;
      })() : ''}
    `;
    usageList.appendChild(item);
  });

  updateHeaderSession();
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
// Notification bell
// ---------------------------------------------------------------------------

function saveNotifications() {
  if (notifications.length > 50) notifications = notifications.slice(-50);
  localStorage.setItem('notif_v1', JSON.stringify(notifications));
}

function unreadCount() {
  return notifications.filter(n => !n.read).length;
}

function updateBellBadge() {
  const count = unreadCount();
  if (count > 0) {
    bellBadge.textContent = count > 99 ? '99+' : String(count);
    bellBadge.style.display = 'flex';
  } else {
    bellBadge.style.display = 'none';
  }
}

function formatNotifTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
         d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function renderNotifPanel() {
  notifList.innerHTML = '';
  if (!notifications.length) {
    const empty = document.createElement('p');
    empty.style.cssText = 'font-size:11px;color:var(--text-muted);text-align:center;padding:8px 0';
    empty.textContent = t('notifEmpty');
    notifList.appendChild(empty);
    return;
  }
  [...notifications].reverse().forEach((n, revIdx) => {
    const realIdx = notifications.length - 1 - revIdx;
    const el = document.createElement('div');
    el.className = 'notif-item';
    el.innerHTML = `
      <div class="notif-item-body">
        <div class="notif-item-title">${esc(n.title)}</div>
        ${n.body ? `<div class="notif-item-text">${esc(n.body)}</div>` : ''}
        <div class="notif-item-time">${formatNotifTime(n.timestamp)}</div>
      </div>
      <button class="notif-dismiss" data-idx="${realIdx}" title="Dismiss">&#x2715;</button>
    `;
    notifList.appendChild(el);
  });
  notifList.querySelectorAll('.notif-dismiss').forEach(btn => {
    btn.addEventListener('click', () => {
      notifications.splice(parseInt(btn.dataset.idx), 1);
      saveNotifications();
      updateBellBadge();
      renderNotifPanel();
      autoResize();
    });
  });
}

function openNotifPanel() {
  notifOpen = true;
  notifications.forEach(n => { n.read = true; });
  saveNotifications();
  updateBellBadge();
  renderNotifPanel();
  notifPanel.style.display = 'flex';
  bellBtn.classList.add('active');
  autoResize();
}

function closeNotifPanel() {
  notifOpen = false;
  notifPanel.style.display = 'none';
  bellBtn.classList.remove('active');
  autoResize();
}

function addNotification(title, body) {
  notifications.push({ title, body, timestamp: Date.now(), read: false });
  saveNotifications();
  updateBellBadge();
  if (notifOpen) renderNotifPanel();
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

function openSettingsPage(name) {
  settingsMenu.style.display = 'none';
  document.getElementById(`settings-sub-${name}`).style.display = 'flex';
  inSubPage = true;
  currentSubPage = name;
  autoResize();
}

function closeSettingsPage() {
  document.getElementById(`settings-sub-${currentSubPage}`).style.display = 'none';
  settingsMenu.style.display = 'flex';
  inSubPage = false;
  currentSubPage = null;
  autoResize();
}

function openSettings() {
  inSettings = true;
  inSubPage = false;
  currentSubPage = null;
  settingsBtn.innerHTML = SVG_BACK;
  settingsBtn.title = t('back');

  window.claudeAPI.getLoginItem().then(v => { startupToggle.checked = v; });
  intervalSelect.value = String(settings.refreshInterval);
  applyTheme(settings.theme || 'dark');
  applyOpacity(settings.opacity ?? 1);
  document.querySelectorAll('[data-lang]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === currentLang);
  });
  buildItemsFilter();

  const a = settings.alerts || {};
  const thr = a.threshold || {};
  const nr  = a.nearReset  || {};
  const pr  = a.planReset  || {};
  const sp  = a.spike      || {};
  document.getElementById('alert-threshold-enabled').checked  = thr.enabled  ?? true;
  document.getElementById('alert-threshold-pct').value        = thr.pct       ?? 80;
  const rw  = a.resetWarning || {};
  document.getElementById('alert-nearreset-enabled').checked  = nr.enabled   ?? true;
  document.getElementById('alert-nearreset-mins').value       = nr.minutesLeft ?? 30;
  document.getElementById('alert-nearreset-pct').value        = nr.minPct    ?? 75;
  document.getElementById('alert-resetwarning-enabled').checked = rw.enabled ?? true;
  document.getElementById('alert-resetwarning-mins').value      = rw.minutesLeft ?? 30;
  document.getElementById('alert-planreset-enabled').checked  = pr.enabled   ?? true;
  document.getElementById('alert-spike-enabled').checked      = sp.enabled   ?? true;
  document.getElementById('alert-spike-delta').value          = sp.deltaPct  ?? 20;

  window.claudeAPI.getVersion().then(v => {
    document.getElementById('settings-version').textContent = `v${v}`;
  });

  settingsMenu.style.display = 'flex';
  document.querySelectorAll('.settings-sub').forEach(sub => { sub.style.display = 'none'; });

  ALL_CONTENT_PANELS.forEach(p => p.style.display = 'none');
  usageList.style.display = 'none';
  settingsPanel.style.display = 'flex';
  autoResize();
}

function closeSettings() {
  inSettings = false;
  inSubPage = false;
  currentSubPage = null;
  settingsBtn.innerHTML = SVG_SETTINGS;
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

  const alerts = {
    threshold: {
      enabled: document.getElementById('alert-threshold-enabled').checked,
      pct:     parseInt(document.getElementById('alert-threshold-pct').value),
    },
    nearReset: {
      enabled:     document.getElementById('alert-nearreset-enabled').checked,
      minutesLeft: parseInt(document.getElementById('alert-nearreset-mins').value),
      minPct:      parseInt(document.getElementById('alert-nearreset-pct').value),
    },
    resetWarning: {
      enabled:     document.getElementById('alert-resetwarning-enabled').checked,
      minutesLeft: parseInt(document.getElementById('alert-resetwarning-mins').value),
    },
    planReset: {
      enabled: document.getElementById('alert-planreset-enabled').checked,
    },
    spike: {
      enabled:  document.getElementById('alert-spike-enabled').checked,
      deltaPct: parseInt(document.getElementById('alert-spike-delta').value),
    },
  };
  settings = { refreshInterval: newInterval, hiddenItems, theme, opacity, lang: currentLang, alerts };
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
  // "Resets Sat 8:00" or "Resets Sat at 8:00 AM"
  const weekdayTime = text.match(/(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*[\s,]* *(?:at\s+)?(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (weekdayTime) {
    const DAYS = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
    const targetDay = DAYS[weekdayTime[1].toLowerCase().slice(0, 3)];
    let h = parseInt(weekdayTime[2]);
    const m = parseInt(weekdayTime[3]);
    const ampm = weekdayTime[4];
    if (ampm) {
      if (ampm.toLowerCase() === 'pm' && h !== 12) h += 12;
      if (ampm.toLowerCase() === 'am' && h === 12) h = 0;
    }
    const now = new Date();
    const d = new Date(now);
    d.setHours(h, m, 0, 0);
    let daysUntil = (targetDay - now.getDay() + 7) % 7;
    if (daysUntil === 0 && d <= now) daysUntil = 7;
    d.setDate(d.getDate() + daysUntil);
    return d;
  }
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
  if (inSubPage) closeSettingsPage();
  else if (inSettings) closeSettings();
  else openSettings();
});

minimizeBtn.addEventListener('click', () => {
  minimized = !minimized;
  minimizeBtn.innerHTML = minimized ? SVG_RESTORE : SVG_MINIMIZE;
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

bellBtn.addEventListener('click', () => {
  if (notifOpen) closeNotifPanel();
  else openNotifPanel();
});

notifClearBtn.addEventListener('click', () => {
  notifications = [];
  saveNotifications();
  updateBellBadge();
  closeNotifPanel();
});

window.claudeAPI.onNotificationAdded((n) => addNotification(n.title, n.body));

closeBtn.addEventListener('click', () => window.claudeAPI.quitApp());

loginBtn.addEventListener('click', () => window.claudeAPI.openLogin());
retryBtn.addEventListener('click', () => {
  setStatus('loading');
  showPanel(loadingState);
  window.claudeAPI.refreshData();
});
reconnectBtn.addEventListener('click', () => window.claudeAPI.openLogin());
saveSettingsBtn.addEventListener('click', saveSettings);
saveAlertsBtn.addEventListener('click', saveSettings);
document.getElementById('test-notification-btn').addEventListener('click', () => window.claudeAPI.testNotification());

document.getElementById('check-update-btn').addEventListener('click', () => {
  const btn = document.getElementById('check-update-btn');
  const status = document.getElementById('update-status-text');
  btn.disabled = true;
  status.textContent = t('updateChecking');
  status.style.display = 'block';
  window.claudeAPI.checkForUpdates();
});

window.claudeAPI.onUpdateNotAvailable(() => {
  const btn = document.getElementById('check-update-btn');
  const status = document.getElementById('update-status-text');
  if (btn) btn.disabled = false;
  if (status) { status.textContent = t('updateUpToDate'); status.style.display = 'block'; }
});

window.claudeAPI.onUpdateDownloaded(({ version }) => {
  const status = document.getElementById('update-status-text');
  if (status) { status.textContent = t('updateAvailable'); status.style.display = 'block'; }
  updateText.textContent = `v${version} ready to install`;
  updateBanner.style.display = 'flex';
  autoResize();
});
installUpdateBtn.addEventListener('click', () => window.claudeAPI.installUpdate());
startupToggle.addEventListener('change', () => window.claudeAPI.setLoginItem(startupToggle.checked));

document.querySelectorAll('[data-settings-page]').forEach(item => {
  item.addEventListener('click', () => openSettingsPage(item.dataset.settingsPage));
});

document.querySelectorAll('[data-position]').forEach(btn => {
  btn.addEventListener('click', () => window.claudeAPI.setPosition(btn.dataset.position));
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

async function init() {
  updateBellBadge();
  try {
    [{ loggedIn: loggedIn }, settings] = await Promise.all([
      window.claudeAPI.getAuthStatus(),
      window.claudeAPI.getSettings(),
    ]);

    setLang(settings.lang || 'en');
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
