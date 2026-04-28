/**
 * Environment Configuration Loader
 * Reads .env file and exposes app config values.
 * No external dependencies — pure Node.js.
 */

const fs = require('fs');
const path = require('path');

const APP_ROOT = path.join(__dirname, '..', '..', '..');
const envPath = path.join(APP_ROOT, '.env');

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
 * Resolve icon path — supports both relative (to APP_ROOT) and absolute paths
 */
function resolveIconPath() {
  const envIcon = process.env.APP_ICON || 'renderer/assets/icon.ico';
  // If absolute path, use as-is; otherwise resolve relative to app root
  const resolved = path.isAbsolute(envIcon)
    ? envIcon
    : path.join(APP_ROOT, envIcon);
  return resolved;
}

/**
 * Get app configuration from environment.
 * All values have sensible defaults.
 * Change APP_NAME, APP_NAME_EN, APP_ICON in .env to rebrand the app.
 */
const config = {
  /** Arabic app name — used in window title, navbar, reports */
  appName: process.env.APP_NAME || 'بوابة المسافرين',

  /** English app name */
  appNameEn: process.env.APP_NAME_EN || 'Passenger Gate',

  /** Resolved icon path (absolute) */
  appIcon: resolveIconPath(),

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
