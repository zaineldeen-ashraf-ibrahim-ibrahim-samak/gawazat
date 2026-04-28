const log = require('electron-log');
const path = require('path');
const { app } = require('electron');

// Configure electron-log
log.transports.file.resolvePath = () => path.join(app.getPath('userData'), 'logs', 'main.log');
log.transports.file.maxSize = 5 * 1024 * 1024; // 5 MB
log.transports.file.maxBackupSize = 5 * 1024 * 1024; // Keep max 5 files

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
 * Create logger wrapper
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
