/**
 * DESKO PENTA Scanner Client
 * Communicates with the DESKO Penta passport reader via its local HTTP/REST API.
 * The DESKO Page Scan API runs a local service that exposes document reading
 * capabilities over HTTP on a configurable port (default: 8085).
 *
 * Flow: idle → polling → processing → idle
 * Similar architecture to regulaClient.js but adapted for DESKO's API contract.
 */

const { processMrz } = require('./scanProcessor');
const logger = require('./logger');

let mode = 'keyboard'; // 'keyboard', 'regula', or 'penta'
let pollingInterval = null;
let isProcessing = false;
let storeInstance = null;

/**
 * Initialize Penta Client
 * @param {Object} store - EncryptedStore instance
 */
function initPenta(store) {
  storeInstance = store;
  const settings = store.getState().settings || {};
  mode = settings.scan_mode || 'keyboard';

  if (mode === 'penta') {
    startPolling();
  }
}

/**
 * Set scanning mode
 * @param {'keyboard'|'regula'|'penta'} newMode
 */
function setPentaMode(newMode) {
  mode = newMode;
  if (mode === 'penta') {
    startPolling();
  } else {
    stopPolling();
  }
}

function startPolling() {
  if (pollingInterval) return;

  const settings = storeInstance.getState().settings || {};
  const url = settings.penta_url || 'http://localhost:8085';
  const intervalMs = settings.penta_poll_ms || 500;

  logger.info(`Starting DESKO Penta polling at ${url}`);

  pollingInterval = setInterval(async () => {
    if (isProcessing) return;

    try {
      // DESKO Penta: Check device status
      const status = await httpRequest('GET', `${url}/api/v1/scanner/status`);

      if (status && status.documentPresent === true) {
        isProcessing = true;
        await handleDocumentPlaced(url);
        isProcessing = false;
      }
    } catch (err) {
      // Silently ignore polling errors to avoid log spam
    }
  }, intervalMs);
}

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    logger.info('Stopped DESKO Penta polling');
  }
}

async function handleDocumentPlaced(url) {
  try {
    logger.info('DESKO Penta: Document detected, processing...');

    // DESKO Penta: Process document — request MRZ-only read
    const result = await httpRequest('POST', `${url}/api/v1/scanner/read`, {
      readMode: 'MRZ',
      timeout: 5000
    });

    if (result && result.mrz) {
      // DESKO returns MRZ as a single string with \n separators
      const rawMrz = result.mrz;
      const scanResult = await processMrz(storeInstance, rawMrz, 'penta');

      // Emit result to all renderer windows
      require('electron').BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('regula:event', scanResult);
      });

      // Emit device status
      require('electron').BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('regula:status', {
          device: 'penta',
          status: 'success',
          outcome: scanResult.outcome
        });
      });
    } else if (result && result.error) {
      logger.warn(`DESKO Penta read error: ${result.error}`);

      // Emit error status
      require('electron').BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('regula:status', {
          device: 'penta',
          status: 'error',
          message: result.error
        });
      });
    }
  } catch (err) {
    logger.error(`DESKO Penta process error: ${err.message}`);

    require('electron').BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('regula:status', {
        device: 'penta',
        status: 'error',
        message: err.message
      });
    });
  }
}

/**
 * Helper for HTTP requests (no external dependencies)
 */
function httpRequest(method, url, data = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      method,
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    const req = require('http').request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(body ? JSON.parse(body) : {});
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.setTimeout(3000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

module.exports = { initPenta, setPentaMode };
