const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  verifyAdminPassword: (password) => ipcRenderer.invoke('verify-admin-password', password),
  exitApp: () => ipcRenderer.send('exit-app'),
  startSessionWindow: () => ipcRenderer.send('start-session-window'),
  endSession: () => ipcRenderer.send('end-session'),
});


