const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const config = require('./services/config');
const { registerAllHandlers } = require('./ipc/registry');
const { EncryptedStore } = require('./store/encryptedStore');
const { purgeRetention } = require('./services/retention');
const { setCspHeaders } = require('./services/cspMiddleware');
const { initRegula } = require('./services/regulaClient');
const { initPenta } = require('./services/pentaClient');
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
    title: config.appName,
    backgroundColor: '#0b1d3a',
    icon: config.appIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow.webContents.on('console-message', (e, level, message, line, sourceId) => {
    console.log(`[RENDERER LOG] ${message}`);
  });


  // Load the app from file
  mainWindow.loadFile(path.join(__dirname, '..', '..', 'renderer', 'index.html'));

  // Open DevTools in development
  if (config.isDev || process.argv.includes('--debug')) {
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
    logger.info('Registering manifest handlers...');
    const manifestHandlers = require('./ipc/manifestHandlers').createManifestHandlers(store);
    
    logger.info('Registering scan handlers...');
    const scanHandlers = require('./ipc/scanHandlers').createScanHandlers(store);
    
    logger.info('Registering pending handlers...');
    const pendingHandlers = require('./ipc/pendingHandlers').createPendingHandlers(store);
    
    logger.info('Registering history handlers...');
    const historyHandlers = require('./ipc/historyHandlers').createHistoryHandlers(store);
    
    logger.info('Registering reports handlers...');
    const reportHandlers = require('./ipc/reportHandlers').createReportHandlers(store);
    
    logger.info('Registering settings handlers...');
    const settingsHandlers = require('./ipc/settingsHandlers').createSettingsHandlers(store);
    
    logger.info('Registering dashboard handlers...');
    const dashboardHandlers = require('./ipc/dashboardHandlers').createDashboardHandlers(store);

    const handlers = {
      manifest: manifestHandlers,
      scan: scanHandlers,
      pending: pendingHandlers,
      history: historyHandlers,
      reports: reportHandlers,
      settings: settingsHandlers,
      dashboard: dashboardHandlers,
    };
    
    logger.info('Calling registerAllHandlers...');
    registerAllHandlers(handlers);

    logger.info('IPC handlers registered');

    // Initialize device clients
    initRegula(store);
    initPenta(store);
    logger.info('Device clients initialized (Regula + Penta)');
  } catch (err) {
    logger.error('Initialization failed:', err);
    if (err.stack) logger.error(err.stack);
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
