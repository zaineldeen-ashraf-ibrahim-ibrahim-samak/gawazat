/**
 * IPC Handlers for Scan History
 * Handles: list, export
 */

const logger = require('../services/logger');
const { extractDisplayName } = require('../../shared/normalize');

/**
 * Create history handlers
 * @param {Object} store - EncryptedStore instance
 * @returns {Object} Handlers
 */
function createHistoryHandlers(store) {
  return {
    /**
     * List all scan events with passenger details
     */
    list: async () => {
      try {
        const state = store.getState();
        const events = state.scan_events || [];
        const manifest = state.manifest || [];
        
        // Create a map for quick lookup
        const passengerMap = new Map();
        manifest.forEach(p => passengerMap.set(p.id, p));

        // Return events with passenger names — try manifest first, then MRZ
        // fields, then any normalized variants that may be present.
        return events.map(e => {
          const passenger = e.passenger_id ? passengerMap.get(e.passenger_id) : null;
          const name = (passenger && extractDisplayName(passenger))
            || extractDisplayName(e.mrz_fields)
            || '---';
          return { ...e, passenger_name: name };
        }).reverse(); // Most recent first
      } catch (err) {
        logger.error(`History list failed: ${err.message}`);
        return [];
      }
    },

    /**
     * Export scan history to Excel
     */
    export: async (args) => {
      try {
        const { savePath } = args;
        if (!savePath) return { ok: false, message: 'No save path provided' };

        const state = store.getState();
        const events = state.scan_events || [];
        const manifest = state.manifest || [];
        const passengerMap = new Map();
        manifest.forEach(p => passengerMap.set(p.id, p));

        const XLSX = require('xlsx');
        
        const headers = ['Timestamp', 'Outcome', 'Mode', 'Passport', 'Name'];
        const data = [headers];

        events.forEach(e => {
          const passenger = e.passenger_id ? passengerMap.get(e.passenger_id) : null;
          const name = (passenger && extractDisplayName(passenger))
            || extractDisplayName(e.mrz_fields)
            || '';
          data.push([
            e.at,
            e.outcome,
            e.mode,
            e.passport_number_normalized || '',
            name
          ]);
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'Scan History');
        
        XLSX.writeFile(wb, savePath);

        return { ok: true };
      } catch (err) {
        logger.error(`History export failed: ${err.message}`);
        return { ok: false, message: err.message };
      }
    }
  };
}

module.exports = { createHistoryHandlers };
