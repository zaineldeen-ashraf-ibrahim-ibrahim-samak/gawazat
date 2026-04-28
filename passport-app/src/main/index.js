const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const { registerAllHandlers } = require('./ipc/registry');
const { EncryptedStore } = require('./store/encryptedStore');
const { purgeRetention } = require('./services/retention');
const { setCspHeaders } = require('./services/cspMiddleware');
const logger = require('./services/logger');

let mainWindow;
let store;

async function createWindow() {
  // Security: Create window with locked-down settings
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1280,
    minHeight: 800,
    frame: true,
    backgroundColor: '#0b1d3a',
    icon: path.join(__dirname, '..', 'renderer', 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  // Load the app
  const isDev = process.env.NODE_ENV === 'development';
  const url = isDev ? 'http://localhost:3000' : `file://${path.join(__dirname, '..', '..', 'renderer', 'index.html')}`;
  
  // For now, since we don't have a dev server, load from file
  mainWindow.loadFile(path.join(__dirname, '..', '..', 'renderer', 'index.html'));

  // Open DevTools in development
  if (isDev || process.argv.includes('--debug')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  logger.info('Main window created');
}

async function initialize() {
  try {
    // Set up CSP headers
    setCspHeaders();

    // Initialize encrypted store
    store = new EncryptedStore();
    await store.load();
    logger.info('Encrypted store loaded');

    // Run retention purge
    try {
      purgeRetention(store);
      logger.info('Retention purge completed');
    } catch (err) {
      logger.error('Retention purge failed:', err.message);
    }

    // Register all IPC handlers
    const handlers = {
      manifest: require('./ipc/manifestHandlers'),
      scan: require('./ipc/scanHandlers'),
      pending: require('./ipc/pendingHandlers'),
      history: require('./ipc/historyHandlers'),
      reports: require('./ipc/reportHandlers'),
      settings: require('./ipc/settingsHandlers'),
      dashboard: require('./ipc/dashboardHandlers'),
    };
    registerAllHandlers(handlers);

    logger.info('IPC handlers registered');
  } catch (err) {
    logger.error('Initialization failed:', err);
    throw err;
  }
}

// App event handlers
app.on('ready', async () => {
  try {
    await initialize();
    createWindow();
  } catch (err) {
    logger.error('App ready failed:', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Handle app quit - save store
app.on('before-quit', async () => {
  if (store) {
    try {
      await store.save();
      logger.info('Store saved on app quit');
    } catch (err) {
      logger.error('Failed to save store on quit:', err);
    }
  }
});

// Export for testing
module.exports = { createWindow, app, store };
