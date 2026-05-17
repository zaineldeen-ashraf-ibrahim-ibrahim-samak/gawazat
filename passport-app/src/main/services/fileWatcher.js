const fs = require('fs');
const { processMrz } = require('./scanProcessor');
const logger = require('./logger');
const { BrowserWindow } = require('electron');

let watcher = null;
let storeRef = null;

function startFileWatcher(store, options = {}) {
  storeRef = store;
  stopFileWatcher();

  if (!options.watch_file_enabled || !options.watch_file_path) {
    logger.info('File watcher disabled or no path configured');
    return;
  }

  const watchPath = options.watch_file_path;

  logger.info(`Starting file watcher on: ${watchPath}`);
  
  try {
    // Check if file exists, if not try to create an empty one
    if (!fs.existsSync(watchPath)) {
      try {
        fs.writeFileSync(watchPath, '', 'utf8');
      } catch (e) {
        logger.error(`Could not create watch file: ${e.message}`);
        return;
      }
    }

    fs.watchFile(watchPath, { interval: 500 }, (curr, prev) => {
      if (curr.mtime !== prev.mtime) {
        handleFileChange(watchPath);
      }
    });
    watcher = watchPath;
  } catch (err) {
    logger.error(`Failed to start file watcher: ${err.message}`);
  }
}

function stopFileWatcher() {
  if (watcher) {
    fs.unwatchFile(watcher);
    watcher = null;
    logger.info('File watcher stopped');
  }
}

function restartFileWatcher(store, options = {}) {
  startFileWatcher(store, options);
}

async function handleFileChange(filePath) {
  try {
    logger.info(`File watcher detected change in: ${filePath}`);
    const mrzText = fs.readFileSync(filePath, 'utf8');
    
    if (!mrzText || mrzText.trim() === '') {
      return;
    }

    const result = await processMrz(storeRef, mrzText, 'api');
    
    // Clear the file after processing
    fs.writeFileSync(filePath, '', 'utf8');
    
    // Notify UI
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      // Let the renderer localize the message via i18n based on outcome.
      // Don't override with a hard-coded English string here.
      windows[0].webContents.send('regula:event', {
        type: 'scan',
        data: result
      });
    }
  } catch (err) {
    logger.error(`File watcher processing failed: ${err.message}`);
  }
}

module.exports = {
  startFileWatcher,
  stopFileWatcher,
  restartFileWatcher
};
