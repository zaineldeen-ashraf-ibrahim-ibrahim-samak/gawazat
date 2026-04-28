/**
 * Regula Device Client
 * Communicates with the Regula Document Reader SDK via HTTP API.
 * Contract: specs/001-seaport-passport-scanner/contracts/regula-service.md
 */

const { processMrz } = require('./scanProcessor');
const logger = require('./logger');

let mode = 'keyboard'; // 'keyboard' or 'api'
let pollingInterval = null;
let isProcessing = false;
let storeInstance = null;

/**
 * Initialize Regula Client
 * @param {Object} store - EncryptedStore instance
 */
function initRegula(store) {
  storeInstance = store;
  const settings = store.getState().settings || {};
  mode = settings.scan_mode || 'keyboard';
  
  if (mode === 'api') {
    startPolling();
  }
}

/**
 * Set scanning mode
 * @param {'keyboard'|'api'} newMode
 */
function setMode(newMode) {
  mode = newMode;
  if (mode === 'api') {
    startPolling();
  } else {
    stopPolling();
  }
}

function startPolling() {
  if (pollingInterval) return;
  
  const settings = storeInstance.getState().settings || {};
  const url = settings.regula_url || 'http://localhost:8080';
  const intervalMs = settings.regula_poll_ms || 500;

  logger.info(`Starting Regula polling at ${url}`);

  pollingInterval = setInterval(async () => {
    if (isProcessing) return;

    try {
      // Check status
      // const response = await axios.get(`${url}/api/device/status`);
      // Use node http since axios might not be installed
      const status = await httpRequest('GET', `${url}/api/device/status`);
      
      if (status && status.documentPlaced === true) {
        isProcessing = true;
        await handleDocumentPlaced(url);
        isProcessing = false;
      }
    } catch (err) {
      // Don't log every poll error to avoid spam, but track status
      // logger.debug(`Regula poll error: ${err.message}`);
    }
  }, intervalMs);
}

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    logger.info('Stopped Regula polling');
  }
}

async function handleDocumentPlaced(url) {
  try {
    logger.info('Document detected, processing...');
    
    // Process document
    const result = await httpRequest('POST', `${url}/api/process`, {
      processParam: {
        scenario: 'MrzOnly'
      }
    });

    if (result && result.text && result.text.fields) {
      // Find MRZ fields
      const mrzField = result.text.fields.find(f => f.fieldName === 'MRZ');
      if (mrzField && mrzField.value) {
        const rawMrz = mrzField.value;
        const scanResult = await processMrz(storeInstance, rawMrz, 'api');
        
        // Emit to renderer via a global event emitter or directly if we have access to BrowserWindow
        // In this architecture, main/index.js wires everything.
        // We can use a custom event emitter.
        require('electron').BrowserWindow.getAllWindows().forEach(win => {
          win.webContents.send('regula:event', scanResult);
        });
      }
    }
  } catch (err) {
    logger.error(`Regula process error: ${err.message}`);
  }
}

/**
 * Helper for HTTP requests without dependencies
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
        'Content-Type': 'application/json'
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
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

module.exports = { initRegula, setMode };
