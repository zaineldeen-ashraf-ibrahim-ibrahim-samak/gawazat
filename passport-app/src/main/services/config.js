/**
 * Environment Configuration Loader
 * Reads .env file and exposes app config values.
 * No external dependencies — pure Node.js.
 */

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '..', '..', '.env');

// Parse .env file (only sets values NOT already in process.env)
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) return;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

/**
 * Get app configuration from environment
 * All values have sensible defaults
 */
const config = {
  /** Arabic app name — used in window title, reports, etc. */
  appName: process.env.APP_NAME || 'بوابة المسافرين',

  /** English app name */
  appNameEn: process.env.APP_NAME_EN || 'Passenger Gate',

  /** Electron builder app ID */
  appId: process.env.APP_ID || 'eg.portsaid.gawazat',

  /** Node environment */
  nodeEnv: process.env.NODE_ENV || 'production',

  /** Whether we're in dev mode */
  isDev: process.env.NODE_ENV === 'development',

  /** Default Regula scanner URL */
  regulaUrl: process.env.REGULA_URL || 'http://localhost:8080',

  /** Default Penta scanner URL */
  pentaUrl: process.env.PENTA_URL || 'http://localhost:8085',
};

module.exports = config;
