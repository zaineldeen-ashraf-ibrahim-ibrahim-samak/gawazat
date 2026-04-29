/**
 * Local HTTP API server for Regula and other clients.
 *
 * Endpoints:
 *   GET  /health         → { ok: true }
 *   POST /import/mrz     → accept .txt MRZ payload and APPEND parsed
 *                          passengers to the current manifest.
 *                          Body may be:
 *                            - text/plain  (raw MRZ text)
 *                            - multipart/form-data with a `file` field
 *                          Response: { ok, imported, skipped, errors }
 *
 * Bound to 127.0.0.1 only — never exposed to the LAN.
 */

const http = require('http');
const { processMrz } = require('./scanProcessor');
const logger = require('./logger');

const HOST = '127.0.0.1';
const DEFAULT_PORT = 7755;
const DEFAULT_PATH = '/import/mrz';
const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5 MB cap

let server = null;
let storeRef = null;

function startApiServer(store, options = {}) {
  if (server) return server;
  storeRef = store;

  const port = options.port || DEFAULT_PORT;

  server = http.createServer((req, res) => handleRequest(req, res));
  server.on('error', (err) => {
    logger.error(`API server error: ${err.message}`);
  });

  server.listen(port, HOST, () => {
    logger.info(`API server listening on http://${HOST}:${port}`);
  });

  return server;
}

function stopApiServer() {
  if (!server) return;
  server.close();
  server = null;
  logger.info('API server stopped');
}

/**
 * Restart the API server with new options.
 * Safe to call even if the server was never started.
 */
function restartApiServer(store, options = {}) {
  stopApiServer();
  if (options.enabled === false) {
    logger.info('API server disabled by settings — not restarting');
    return null;
  }
  return startApiServer(store, options);
}

/**
 * Get the current API server status.
 * @returns {{ running: boolean, port: number|null }}
 */
function getApiServerStatus() {
  if (!server || !server.listening) {
    return { running: false, port: null, path: null };
  }
  const addr = server.address();
  const settings = storeRef ? storeRef.getState().settings || {} : {};
  return {
    running: true,
    port: addr ? addr.port : null,
    path: settings.api_server_path || DEFAULT_PATH,
  };
}

function handleRequest(req, res) {
  const url = req.url.split('?')[0];

  if (req.method === 'GET' && url === '/health') {
    return sendJson(res, 200, { ok: true });
  }

  // Read the configured path from settings (hot-reloadable, no restart needed)
  const settings = storeRef ? storeRef.getState().settings || {} : {};
  const importPath = settings.api_server_path || DEFAULT_PATH;

  if (req.method === 'POST' && url === importPath) {
    return readBody(req, res, async (err, body, contentType) => {
      if (err) return sendJson(res, err.status || 400, { ok: false, message: err.message });

      let mrzText;
      try {
        mrzText = extractMrzText(body, contentType);
      } catch (e) {
        return sendJson(res, 400, { ok: false, message: e.message });
      }

      if (!mrzText || mrzText.trim() === '') {
        return sendJson(res, 400, { ok: false, message: 'Empty MRZ payload' });
      }

      try {
        const result = await processMrz(storeRef, mrzText, 'api');
        
        let message = 'Scan processed successfully';
        if (result.outcome === 'orange') {
          message = 'WARNING: This person is already scanned/added and will not be added again.';
        }

        // Trigger IPC event to update UI in real-time if a mainWindow is available
        const { BrowserWindow } = require('electron');
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
          windows[0].webContents.send('regula:event', {
            type: 'scan',
            data: { ...result, warning_message: result.outcome === 'orange' ? message : null }
          });
        }
        
        return sendJson(res, 200, { ok: true, message, result });
      } catch (e) {
        logger.error(`API processing failed: ${e.message}`);
        return sendJson(res, 500, { ok: false, message: e.message });
      }
    });
  }

  return sendJson(res, 404, { ok: false, message: 'Not found' });
}

function readBody(req, res, cb) {
  const chunks = [];
  let total = 0;
  let aborted = false;

  req.on('data', (chunk) => {
    if (aborted) return;
    total += chunk.length;
    if (total > MAX_BODY_BYTES) {
      aborted = true;
      cb({ status: 413, message: 'Payload too large' });
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => {
    if (aborted) return;
    cb(null, Buffer.concat(chunks), req.headers['content-type'] || '');
  });
  req.on('error', (err) => {
    if (aborted) return;
    aborted = true;
    cb({ status: 400, message: err.message });
  });
}

/**
 * Extract MRZ text either from a raw text/plain body or from the first file
 * field of a multipart/form-data body.
 */
function extractMrzText(buffer, contentType) {
  const ct = String(contentType).toLowerCase();

  if (ct.startsWith('multipart/form-data')) {
    const match = /boundary=("?)([^";]+)\1/i.exec(contentType);
    if (!match) throw new Error('Multipart boundary missing');
    return extractFirstFilePart(buffer, match[2]);
  }

  // text/plain, application/octet-stream, or unspecified — treat as raw text
  return buffer.toString('utf8');
}

/**
 * Minimal multipart parser: returns the body of the first part that has a
 * filename (or the first part with a body if none has a filename).
 */
function extractFirstFilePart(buffer, boundary) {
  const delimiter = Buffer.from(`--${boundary}`);
  const crlf = Buffer.from('\r\n');
  const parts = [];

  let pos = 0;
  while (pos < buffer.length) {
    const start = buffer.indexOf(delimiter, pos);
    if (start === -1) break;
    const afterDelim = start + delimiter.length;
    if (buffer.slice(afterDelim, afterDelim + 2).toString() === '--') break; // closing
    const partStart = afterDelim + crlf.length;
    const nextDelim = buffer.indexOf(delimiter, partStart);
    if (nextDelim === -1) break;
    const partEnd = nextDelim - crlf.length;
    parts.push(buffer.slice(partStart, partEnd));
    pos = nextDelim;
  }

  for (const part of parts) {
    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd === -1) continue;
    const headers = part.slice(0, headerEnd).toString('utf8');
    const body = part.slice(headerEnd + 4);
    if (/filename=/i.test(headers)) return body.toString('utf8');
  }

  // Fallback: first non-empty part
  for (const part of parts) {
    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd === -1) continue;
    const body = part.slice(headerEnd + 4);
    if (body.length > 0) return body.toString('utf8');
  }

  throw new Error('No file part found in multipart body');
}



function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

module.exports = { startApiServer, stopApiServer, restartApiServer, getApiServerStatus };
