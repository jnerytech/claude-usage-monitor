'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('claudeAPI', {
  getAuthStatus:  () => ipcRenderer.invoke('get-auth-status'),
  getNextFetchAt: () => ipcRenderer.invoke('get-next-fetch-at'),
  getSettings:    () => ipcRenderer.invoke('get-settings'),
  saveSettings:   (s) => ipcRenderer.invoke('save-settings', s),
  openLogin:      () => ipcRenderer.send('open-login'),
  refreshData:    () => ipcRenderer.send('refresh-data'),
  logout:         () => ipcRenderer.send('logout'),
  minimizeWidget: () => ipcRenderer.send('minimize-widget'),
  restoreWidget:  (h) => ipcRenderer.send('restore-widget', h),
  resizeWindow:   (h) => ipcRenderer.send('resize-window', h),
  quitApp:        () => ipcRenderer.send('quit-app'),
  onUsageData:    (cb) => ipcRenderer.on('usage-data',    (_, p) => cb(p)),
  onAuthStatus:   (cb) => ipcRenderer.on('auth-status',  (_, p) => cb(p)),
  onNextFetchAt:  (cb) => ipcRenderer.on('next-fetch-at', (_, v) => cb(v)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', (_, p) => cb(p)),
  installUpdate:  () => ipcRenderer.send('install-update'),
  getLoginItem:   () => ipcRenderer.invoke('get-login-item'),
  setLoginItem:   (enable) => ipcRenderer.send('set-login-item', enable),
});
