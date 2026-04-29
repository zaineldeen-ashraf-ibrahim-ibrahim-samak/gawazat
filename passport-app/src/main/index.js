const { app, BrowserWindow, ipcMain, session, nativeImage, dialog } = require('electron');
const path = require('path');
const config = require('./services/config');

// Set app name before 'ready' so macOS dock/menu bar shows the correct name
app.setName(config.appName);
const { registerAllHandlers } = require('./ipc/registry');
const { EncryptedStore } = require('./store/encryptedStore');
const { purgeRetention } = require('./services/retention');
const { setCspHeaders } = require('./services/cspMiddleware');
const { initRegula } = require('./services/regulaClient');
const { initPenta } = require('./services/pentaClient');
const { startApiServer, stopApiServer, restartApiServer } = require('./services/apiServer');
const logger = require('./services/logger');

let mainWindow;
let store;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    frame: true,
    title: config.appName,
    backgroundColor: '#0b1d3a',
    icon: config.appIcon,
    show: false, // Don't show until ready — prevents white flash
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      enableRemoteModule: false,
    },
  });

  // ─── Production Security: Prevent navigation to external URLs ───
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Only allow file:// protocol (our local app)
    if (!url.startsWith('file://')) {
      event.preventDefault();
      logger.warn(`Blocked navigation to: ${url}`);
    }
  });

  // ─── Production Security: Block new window creation ───
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    logger.warn(`Blocked window open: ${url}`);
    return { action: 'deny' };
  });

  // ─── Show window when ready (smooth launch) ───
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Load the app from file
  mainWindow.loadFile(path.join(__dirname, '..', '..', 'renderer', 'index.html'));

  // Open DevTools only when explicitly requested via --debug flag
  if (process.argv.includes('--debug')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  logger.info('Main window created');
}

async function initialize() {
  try {
    // Log config from .env
    logger.info(`App: ${config.appName} (${config.appNameEn})`);
    logger.info(`Icon: ${config.appIcon}`);
    logger.info(`Env loaded from: ${config.envFilePath}`);
    logger.info(`Mode: ${config.isDev ? 'development' : 'production'}`);

    // Set up CSP headers
    setCspHeaders();

    // ─── Production Security: Disable permission requests ───
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      // Deny all permission requests (camera, mic, geolocation, etc.)
      callback(false);
    });

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
    const manifestHandlers = require('./ipc/manifestHandlers').createManifestHandlers(store);
    const scanHandlers = require('./ipc/scanHandlers').createScanHandlers(store);
    const pendingHandlers = require('./ipc/pendingHandlers').createPendingHandlers(store);
    const historyHandlers = require('./ipc/historyHandlers').createHistoryHandlers(store);
    const reportHandlers = require('./ipc/reportHandlers').createReportHandlers(store);
    const settingsHandlers = require('./ipc/settingsHandlers').createSettingsHandlers(store);
    const dashboardHandlers = require('./ipc/dashboardHandlers').createDashboardHandlers(store);

    registerAllHandlers({
      manifest: manifestHandlers,
      scan: scanHandlers,
      pending: pendingHandlers,
      history: historyHandlers,
      reports: reportHandlers,
      settings: settingsHandlers,
      dashboard: dashboardHandlers,
    });

    logger.info('IPC handlers registered');

    // Initialize device clients
    initRegula(store);
    initPenta(store);
    logger.info('Device clients initialized (Regula + Penta)');

    // Start local HTTP API server — port derived from the active device URL in settings
    const settings = store.getState().settings || {};
    const _deviceUrl = settings.scan_mode === 'penta'
      ? (settings.penta_url  || process.env.PENTA_URL  || 'http://localhost:8085')
      : (settings.regula_url || process.env.REGULA_URL || 'http://localhost:8080');
    let _apiPort = 7755;
    try { const p = parseInt(new URL(_deviceUrl).port); if (p) _apiPort = p; } catch (_) {}
    startApiServer(store, { port: _apiPort });

    // Start file watcher if enabled
    const { startFileWatcher } = require('./services/fileWatcher');
    startFileWatcher(store, settings);
  } catch (err) {
    logger.error('Initialization failed:', err);
    if (err.stack) logger.error(err.stack);
    throw err;
  }
}

// ─── App Lifecycle ───────────────────────────────────────────────────

app.on('ready', async () => {
  try {
    // Set dock icon on macOS (BrowserWindow.icon doesn't affect the dock)
    if (process.platform === 'darwin' && app.dock && config.appIcon) {
      try {
        app.dock.setIcon(config.appIcon);
      } catch (e) {
        logger.warn('Could not set dock icon:', e.message);
      }
    }

    await initialize();
    createWindow();
  } catch (err) {
    logger.error('App ready failed:', err);
    if (err && err.stack) logger.error(err.stack);
    try {
      dialog.showErrorBox(
        'Startup error',
        `${(err && err.message) || err}\n\nLogs: ${app.getPath('userData')}\\logs\\main.log`
      );
    } catch (_) { /* ignore */ }
    app.quit();
  }
});

app.on('window-all-closed', () => {
  // Always quit on all platforms (this is a kiosk-style app, not a macOS multi-window app)
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Save store before quitting
app.on('before-quit', async () => {
  try {
    stopApiServer();
  } catch (err) {
    logger.error('Failed to stop API server on quit:', err.message);
  }
  if (store) {
    try {
      await store.forceSave();
      logger.info('Store saved on app quit');
    } catch (err) {
      logger.error('Failed to save store on quit:', err);
    }
  }
});

// ─── Process-level crash safety ──────────────────────────────────────

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err.message);
  logger.error(err.stack);
  // Don't crash — try to save data first
  if (store) {
    try { store.save(); } catch (e) { /* last resort */ }
  }
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection:', reason);
});
