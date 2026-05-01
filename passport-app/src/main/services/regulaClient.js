/**
 * Regula Device Client
 * Polls the Regula Document Reader SDK HTTP API.
 */

const { processMrz } = require('./scanProcessor');
const logger = require('./logger');

let mode = 'keyboard';
let pollingInterval = null;
let isProcessing = false;
let storeInstance = null;

function initRegula(store) {
  storeInstance = store;
  const settings = store.getState().settings || {};
  mode = settings.scan_mode || 'keyboard';

  if (mode === 'regula' || mode === 'api') {
    startPolling();
  }
}

function setMode(newMode) {
  mode = newMode;
  if (mode === 'regula' || mode === 'api') {
    startPolling();
  } else {
    stopPolling();
  }
}

function startPolling() {
  if (pollingInterval) return;

  logger.info('Starting Regula polling');

  pollingInterval = setInterval(async () => {
    if (isProcessing) return;

    // Read URL fresh each tick so settings changes take effect immediately
    const settings = storeInstance.getState().settings || {};
    const url = (settings.regula_url || 'http://localhost:8080').replace(/\/$/, '');

    try {
      const status = await httpRequest('GET', `${url}/api/device/status`, null, 2000);

      if (status && status.documentPlaced === true) {
        isProcessing = true;
        try {
          await handleDocumentPlaced(url);
        } finally {
          isProcessing = false;
        }
      }
    } catch (_) {
      // Device offline or not ready — suppress per-tick noise
    }
  }, storeInstance.getState().settings?.regula_poll_ms || 500);
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
    logger.info('Regula: document detected, processing…');

    const result = await httpRequest('POST', `${url}/api/process`, {
      processParam: { scenario: 'MrzOnly' }
    }, 8000);

    let rawMrz = null;

    // Regula SDK response: result.text.fieldList or result.text.fields
    const fields =
      result?.text?.fieldList ||
      result?.text?.fields ||
      [];

    const mrzField = fields.find(
      f => f.fieldName === 'MRZ' || f.fieldName === 'Document MRZ'
    );
    if (mrzField) {
      rawMrz = mrzField.value || mrzField.valueList?.[0]?.value || null;
    }

    // Fallback: some SDK versions return MRZ directly
    if (!rawMrz && result?.mrz) rawMrz = result.mrz;
    if (!rawMrz && typeof result?.text === 'string') rawMrz = result.text;

    if (!rawMrz) {
      logger.warn('Regula: no MRZ in response');
      return;
    }

    const scanResult = await processMrz(storeInstance, rawMrz, 'regula');

    // Wrap in the same envelope that apiServer and scan.js expect
    const envelope = {
      type: 'scan',
      data: {
        ...scanResult,
        warning_message: scanResult.outcome === 'orange'
          ? 'هذا المسافر تم مسحه مسبقاً'
          : null,
      },
    };

    require('electron').BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('regula:event', envelope);
    });

    logger.info(`Regula scan: ${scanResult.outcome}`);
  } catch (err) {
    logger.error(`Regula process error: ${err.message}`);
  }
}

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
      headers: { 'Content-Type': 'application/json', 'Host': urlObj.host },
    };

    const req = require('http').request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(body ? JSON.parse(body) : {});
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
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

module.exports = { initRegula, setMode };
