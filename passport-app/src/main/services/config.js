/**
 * Environment Configuration Loader
 * Reads .env file and exposes app config values.
 * No external dependencies — pure Node.js.
 *
 * In production, the .env is searched in this order:
 *   1. Next to the executable (portable override — operator can edit)
 *   2. Inside the app's userData dir (per-machine override)
 *   3. Inside the asar/app bundle (default from build)
 *
 * In development, the .env is read from the project root.
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// ─── Resolve app root (works in both dev and production/asar) ────────
const APP_ROOT = path.join(__dirname, '..', '..', '..');

/**
 * Find the best .env file.
 * Priority: exe directory > userData > app bundle
 */
function findEnvFile() {
  const candidates = [];

  if (app && app.isPackaged) {
    // 1. Next to the .exe / .app (portable override)
    const exeDir = path.dirname(app.getPath('exe'));
    candidates.push(path.join(exeDir, '.env'));

    // 2. In userData (per-machine, survives updates)
    candidates.push(path.join(app.getPath('userData'), '.env'));

    // 3. In resources dir (bundled via extraResources)
    if (process.resourcesPath) {
      candidates.push(path.join(process.resourcesPath, '.env'));
    }
  }

  // 3. Inside the app bundle / project root (dev or fallback)
  candidates.push(path.join(APP_ROOT, '.env'));

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

// ─── Parse .env file ─────────────────────────────────────────────────

const envFile = findEnvFile();
if (envFile) {
  const content = fs.readFileSync(envFile, 'utf-8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) return;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    // Only set if not already defined (process.env takes precedence)
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

// ─── Icon path resolution ────────────────────────────────────────────

function resolveIconPath() {
  const envIcon = process.env.APP_ICON || 'renderer/assets/icon.ico';

  // Absolute path → use as-is
  if (path.isAbsolute(envIcon)) return envIcon;

  // On macOS, .ico is unsupported — prefer .png or .icns with same base name
  function platformIcon(p) {
    if (process.platform !== 'darwin') return p;
    const ext = path.extname(p);
    if (ext === '.ico') {
      for (const alt of ['.icns', '.png']) {
        const candidate = p.slice(0, -ext.length) + alt;
        if (fs.existsSync(candidate)) return candidate;
      }
    }
    return p;
  }

  // Relative path → resolve against app root
  const resolved = path.join(APP_ROOT, envIcon);
  if (fs.existsSync(resolved)) return platformIcon(resolved);

  // Fallback: try next to exe (production)
  if (app && app.isPackaged) {
    const exeIcon = path.join(path.dirname(app.getPath('exe')), envIcon);
    if (fs.existsSync(exeIcon)) return platformIcon(exeIcon);
  }

  return resolved; // return even if missing — Electron will show default icon
}

// ─── Exported config ─────────────────────────────────────────────────

const config = {
  /** Arabic app name — window title, navbar, PDF reports */
  appName: process.env.APP_NAME || 'بوابة المسافرين',

  /** English app name — used when lang=en */
  appNameEn: process.env.APP_NAME_EN || 'Passenger Gate',

  /** Absolute icon path (resolved from APP_ICON) */
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

  /** Path to the .env file that was loaded (for logging) */
  envFilePath: envFile || '(none)',
};

module.exports = config;
