const { contextBridge, ipcRenderer } = require('electron');

/**
 * Secure IPC bridge exposed to renderer
 * All communication between main and renderer goes through these channels
 */

const api = {
  // Manifest operations
  manifest: {
    import: (args) => ipcRenderer.invoke('manifest:import', args),
    preview: (args) => ipcRenderer.invoke('manifest:preview', args),
    downloadTemplate: (args) => ipcRenderer.invoke('manifest:downloadTemplate', args),
    list: (args) => ipcRenderer.invoke('manifest:list', args),
    exportFiltered: (args) => ipcRenderer.invoke('manifest:exportFiltered', args),
    toggleEntered: (args) => ipcRenderer.invoke('manifest:toggleEntered', args),
  },

  // Scanning operations
  scan: {
    submitMrz: (args) => ipcRenderer.invoke('scan:submitMrz', args),
    undoLast: (args) => ipcRenderer.invoke('scan:undoLast', args),
  },

  // Regula device control
  regula: {
    setMode: (args) => ipcRenderer.invoke('regula:setMode', args),
    onEvent: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('regula:event', handler);
      return () => ipcRenderer.removeListener('regula:event', handler);
    },
    onStatus: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on('regula:status', handler);
      return () => ipcRenderer.removeListener('regula:status', handler);
    },
  },

  // Pending approval operations
  pending: {
    list: (args) => ipcRenderer.invoke('pending:list', args),
    approve: (args) => ipcRenderer.invoke('pending:approve', args),
    reject: (args) => ipcRenderer.invoke('pending:reject', args),
  },

  // History and reports
  history: {
    list: (args) => ipcRenderer.invoke('history:list', args),
    export: (args) => ipcRenderer.invoke('history:export', args),
  },

  reports: {
    generatePdf: (args) => ipcRenderer.invoke('reports:generatePdf', args),
    print: (args) => ipcRenderer.invoke('reports:print', args),
  },

  // Settings and session
  settings: {
    get: (args) => ipcRenderer.invoke('settings:get', args),
    set: (args) => ipcRenderer.invoke('settings:set', args),
    apiServerStatus: (args) => ipcRenderer.invoke('settings:apiServerStatus', args),
  },

  session: {
    clear: (args) => ipcRenderer.invoke('session:clear', args),
  },

  // Dashboard
  dashboard: {
    stats: (args) => ipcRenderer.invoke('dashboard:stats', args),
  },

  // Dialogs
  dialog: {
    openFile: (args) => ipcRenderer.invoke('dialog:openFile', args),
    saveFile: (args) => ipcRenderer.invoke('dialog:saveFile', args),
  },

  // App config from .env (safe values only — no secrets)
  config: {
    appName: process.env.APP_NAME || 'بوابة المسافرين',
    appNameEn: process.env.APP_NAME_EN || 'Passenger Gate',
  },
};

// Expose API to renderer
if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('api', api);
} else {
  window.api = api;
}

console.log('Preload script loaded - API exposed to renderer');
