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

  logger.info('Starting DESKO Penta polling');

  pollingInterval = setInterval(async () => {
    if (isProcessing) return;

    // Read URL fresh each tick so settings changes take effect immediately
    const settings = storeInstance.getState().settings || {};
    const url = (settings.penta_url || 'http://localhost:8085').replace(/\/$/, '');

    try {
      const status = await httpRequest('GET', `${url}/api/v1/scanner/status`, null, 2000);

      if (status && status.documentPresent === true) {
        isProcessing = true;
        try {
          await handleDocumentPlaced(url);
        } finally {
          isProcessing = false;
        }
      }
    } catch (_) {
      // Silently ignore polling errors to avoid log spam
    }
  }, storeInstance.getState().settings?.penta_poll_ms || 500);
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
      const rawMrz = result.mrz;
      const scanResult = await processMrz(storeInstance, rawMrz, 'penta');

      const envelope = {
        type: 'scan',
        data: {
          ...scanResult,
          warning_message: scanResult.outcome === 'orange' ? 'هذا المسافر تم مسحه مسبقاً' : null,
        },
      };

      require('electron').BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('regula:event', envelope);
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
function resolveIPv4(hostname) {
  return new Promise((resolve) => {
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return resolve(hostname);
    require('dns').lookup(hostname, { family: 4 }, (err, address) => {
      resolve(err ? hostname : address);
    });
  });
}

async function httpRequest(method, url, data = null, timeoutMs = 3000) {
  const urlObj = new URL(url);
  const ip = await resolveIPv4(urlObj.hostname);
  const port = parseInt(urlObj.port) || 80;

  return new Promise((resolve, reject) => {
    const options = {
      method,
      hostname: ip,
      port,
      path: urlObj.pathname + (urlObj.search || ''),
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Host': urlObj.host },
    };

    const req = require('http').request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
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

    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('Request timeout')); });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

module.exports = { initPenta, setPentaMode };
