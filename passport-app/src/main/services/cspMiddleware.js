const { session } = require('electron');

/**
 * Set up Content Security Policy headers
 * Enforces strict security boundaries on renderer
 */
function setCspHeaders() {
  const cspHeader = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data:",
    "connect-src 'self' http://localhost:*",
    "font-src 'self' data: https://fonts.gstatic.com",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [cspHeader],
      },
    });
  });
}

module.exports = { setCspHeaders };
