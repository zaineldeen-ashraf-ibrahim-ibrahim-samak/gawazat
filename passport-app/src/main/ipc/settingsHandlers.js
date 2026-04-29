/**
 * IPC Handlers for Settings
 * Handles: get, set, clearSession
 */

const http = require('http');
const dns  = require('dns');
const logger = require('../services/logger');
const { rebuildIndices } = require('../store/indices');
const { getApiServerStatus } = require('../services/apiServer');

/** Resolve hostname to IPv4 — uses dns.lookup(family:4) which handles 'localhost' correctly */
function resolveIPv4(hostname) {
  return new Promise((resolve) => {
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return resolve(hostname);
    dns.lookup(hostname, { family: 4 }, (err, address) => {
      resolve(err ? hostname : address);
    });
  });
}

async function testDeviceUrl(url) {
  try {
    const urlObj = new URL(url);
    const ip = await resolveIPv4(urlObj.hostname);
    const port = parseInt(urlObj.port) || 80;

    return await new Promise((resolve) => {
      const req = http.request({
        method: 'GET',
        hostname: ip,
        port,
        path: urlObj.pathname || '/',
        headers: { 'Accept': 'application/json', 'Host': urlObj.host },
      }, (res) => {
        let body = '';
        res.on('data', c => { body += c; });
        res.on('end', () => resolve({ ok: true, status: res.statusCode, body: body.slice(0, 200) }));
      });
      req.setTimeout(3000, () => { req.destroy(); resolve({ ok: false, message: 'Timeout — الجهاز لا يستجيب' }); });
      req.on('error', (e) => resolve({ ok: false, message: e.message }));
      req.end();
    });
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

/**
 * Create settings handlers
 * @param {Object} store - EncryptedStore instance
 * @returns {Object} Handlers
 */
function createSettingsHandlers(store) {
  return {
    /**
     * Get current settings
     */
    get: async () => {
      const state = store.getState();
      return state.settings || {};
    },

    /**
     * Update settings
     * @param {Object} newSettings
     */
    set: async (newSettings) => {
      try {
        const oldSettings = store.getState().settings || {};
        store.mutate(draft => {
          draft.settings = {
            ...(draft.settings || {}),
            ...newSettings
          };
          // Keep voyage.ship_name in sync so reports/dashboard always show the latest name
          if (newSettings.ship_name !== undefined && draft.voyage) {
            draft.voyage.ship_name = newSettings.ship_name;
          }
        });

        // Restart API server when the active device URL (and thus port) changes
        const merged = store.getState().settings || {};
        const activeUrl = merged.scan_mode === 'penta'
          ? (merged.penta_url  || process.env.PENTA_URL  || 'http://localhost:8085')
          : (merged.regula_url || process.env.REGULA_URL || 'http://localhost:8080');
        const oldActiveUrl = oldSettings.scan_mode === 'penta'
          ? (oldSettings.penta_url  || process.env.PENTA_URL  || 'http://localhost:8085')
          : (oldSettings.regula_url || process.env.REGULA_URL || 'http://localhost:8080');

        const urlChanged =
          newSettings.regula_url !== undefined ||
          newSettings.penta_url  !== undefined ||
          newSettings.scan_mode  !== undefined;

        if (urlChanged && activeUrl !== oldActiveUrl) {
          let newPort = 7755;
          try { const p = parseInt(new URL(activeUrl).port); if (p) newPort = p; } catch (_) {}
          const { restartApiServer } = require('../services/apiServer');
          restartApiServer(store, { enabled: true, port: newPort });
          logger.info(`API server restarted on port ${newPort} (device URL changed)`);
        }

        const watchChanged =
          newSettings.watch_file_enabled !== undefined &&
          newSettings.watch_file_enabled !== oldSettings.watch_file_enabled ||
          newSettings.watch_file_path !== undefined &&
          newSettings.watch_file_path !== oldSettings.watch_file_path;
        if (watchChanged) {
          const { restartFileWatcher } = require('../services/fileWatcher');
          const merged = store.getState().settings || {};
          restartFileWatcher(store, merged);
        }

        logger.info('Settings updated');
        return { ok: true };
      } catch (err) {
        logger.error(`Settings update failed: ${err.message}`);
        return { ok: false, message: err.message };
      }
    },

    /**
     * Test connectivity to a device URL
     */
    testDeviceUrl: async ({ url } = {}) => {
      if (!url) return { ok: false, message: 'No URL provided' };
      return testDeviceUrl(url);
    },

    /**
     * Get API server status
     */
    apiServerStatus: async () => {
      return getApiServerStatus();
    },

    /**
     * Clear all session data with password verification
     */
    clearSessionWithPassword: async ({ password } = {}) => {
      const correctPw = process.env.CLEAR_DATA_PASSWORD || '12345678';
      if (!password || password !== correctPw) {
        return { ok: false, message: 'كلمة المرور غير صحيحة' };
      }
      try {
        store.mutate(draft => {
          draft.voyage = null;
          draft.manifest = [];
          draft.boarding_records = {};
          draft.scan_events = [];
          draft.pending_approval = [];
        });
        rebuildIndices(store.getState());
        logger.info('Session cleared (password verified)');
        return { ok: true };
      } catch (err) {
        logger.error(`Session clear failed: ${err.message}`);
        return { ok: false, message: err.message };
      }
    },

    /**
     * Clear all session data (voyage, manifest, records)
     * Keeps settings intact
     */
    clearSession: async () => {
      try {
        store.mutate(draft => {
          draft.voyage = null;
          draft.manifest = [];
          draft.boarding_records = {};
          draft.scan_events = [];
          draft.pending_approval = [];
        });
        rebuildIndices(store.getState());
        logger.info('Session cleared');
        return { ok: true };
      } catch (err) {
        logger.error(`Session clear failed: ${err.message}`);
        return { ok: false, message: err.message };
      }
    }
  };
}


module.exports = { createSettingsHandlers };
