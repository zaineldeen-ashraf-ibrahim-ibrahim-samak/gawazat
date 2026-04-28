/**
 * IPC Handlers for Settings
 * Handles: get, set, clearSession
 */

const logger = require('../services/logger');
const { rebuildIndices } = require('../store/indices');

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
      return state.appSettings || {};
    },

    /**
     * Update settings
     * @param {Object} newSettings
     */
    set: async (newSettings) => {
      try {
        store.mutate(draft => {
          draft.appSettings = {
            ...(draft.appSettings || {}),
            ...newSettings
          };
        });
        logger.info('Settings updated');
        return { ok: true };
      } catch (err) {
        logger.error(`Settings update failed: ${err.message}`);
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
