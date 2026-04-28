const { contextBridge, ipcRenderer } = require('electron');

/**
 * Secure IPC bridge exposed to renderer
 * All communication between main and renderer goes through these channels
 */

const api = {
  // Manifest operations
  manifest: {
    import: (args) => ipcRenderer.invoke('manifest:import', args),
    downloadTemplate: (args) => ipcRenderer.invoke('manifest:downloadTemplate', args),
    list: (args) => ipcRenderer.invoke('manifest:list', args),
    exportFiltered: (args) => ipcRenderer.invoke('manifest:exportFiltered', args),
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
      ipcRenderer.on('regula:event', (event, data) => callback(data));
      return () => ipcRenderer.removeAllListeners('regula:event');
    },
    onStatus: (callback) => {
      ipcRenderer.on('regula:status', (event, data) => callback(data));
      return () => ipcRenderer.removeAllListeners('regula:status');
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
};

// Expose API to renderer
contextBridge.exposeInMainWorld('api', api);

console.log('Preload script loaded - API exposed to renderer');
