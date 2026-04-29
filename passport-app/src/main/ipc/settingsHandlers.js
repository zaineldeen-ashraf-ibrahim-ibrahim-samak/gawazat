/**
 * IPC Handlers for Settings
 * Handles: get, set, clearSession
 */

const logger = require('../services/logger');
const { rebuildIndices } = require('../store/indices');
const { restartApiServer, getApiServerStatus } = require('../services/apiServer');

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
        });

        // Auto-restart API server if relevant settings changed
        const apiChanged =
          newSettings.api_server_enabled !== undefined &&
          newSettings.api_server_enabled !== oldSettings.api_server_enabled ||
          newSettings.api_server_port !== undefined &&
          newSettings.api_server_port !== oldSettings.api_server_port;
        if (apiChanged) {
          const merged = store.getState().settings || {};
          restartApiServer(store, {
            enabled: merged.api_server_enabled !== false,
            port: merged.api_server_port,
          });
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
     * Get API server status
     */
    apiServerStatus: async () => {
      return getApiServerStatus();
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
