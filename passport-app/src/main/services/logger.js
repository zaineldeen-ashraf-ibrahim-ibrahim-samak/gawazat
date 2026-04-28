const log = require('electron-log');
const path = require('path');
const { app } = require('electron');

// Configure file transport
log.transports.file.resolvePathFn = () => path.join(app.getPath('userData'), 'logs', 'main.log');
log.transports.file.maxSize = 5 * 1024 * 1024; // 5 MB per file
log.transports.file.format = '{y}-{m}-{d} {h}:{i}:{s}.{ms} [{level}] {text}';

// In production: suppress console output (only write to file)
// In dev: keep both console and file
const isDev = process.env.NODE_ENV === 'development';
log.transports.console.level = isDev ? 'debug' : false;
log.transports.file.level = 'info';

/**
 * PII redaction - strips sensitive fields from objects before logging
 */
function redact(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  const redacted = Array.isArray(obj) ? [...obj] : { ...obj };
  const piiKeys = [
    'passport_number',
    'passport_number_normalized',
    'surname',
    'given_names',
    'date_of_birth',
    'name',
    'personal_number',
  ];

  if (Array.isArray(redacted)) {
    return redacted.map((item) => redact(item));
  }

  for (const key of piiKeys) {
    if (key in redacted) {
      redacted[key] = '[REDACTED]';
    }
  }

  return redacted;
}

/**
 * Production-safe logger
 * - PII is always redacted
 * - Console output suppressed in production
 * - File logging always active
 */
const logger = {
  info: (message, data) => {
    const cleanData = data ? redact(data) : undefined;
    log.info(message, cleanData);
  },
  warn: (message, data) => {
    const cleanData = data ? redact(data) : undefined;
    log.warn(message, cleanData);
  },
  error: (message, data) => {
    const cleanData = data ? redact(data) : undefined;
    log.error(message, cleanData);
  },
  debug: (message, data) => {
    const cleanData = data ? redact(data) : undefined;
    log.debug(message, cleanData);
  },
};

module.exports = logger;
