/**
 * IPC Handlers for Scanning
 * Handles: submitMrz, undoLast
 */

const { processMrz } = require('../services/scanProcessor');
const { setMode: setRegulaMode } = require('../services/regulaClient');
const { setPentaMode } = require('../services/pentaClient');
const logger = require('../services/logger');

let lastUndoableScanId = null;

/**
 * Create scan handlers
 * @param {Object} store - EncryptedStore instance
 * @returns {Object} Handlers
 */
function createScanHandlers(store) {
  return {
    /**
     * Submit raw MRZ text for processing
     * @param {{rawMrz: string}} args
     * @returns {Promise<ScanResult>}
     */
    submitMrz: async (args) => {
      try {
        const { rawMrz } = args;
        const result = await processMrz(store, rawMrz, 'keyboard');
        
        if (result.outcome === 'green') {
          lastUndoableScanId = result.scan_event_id;
        } else {
          lastUndoableScanId = null;
        }
        
        return result;
      } catch (err) {
        logger.error(`submitMrz failed: ${err.message}`);
        return {
          outcome: 'read-failed',
          message: err.message
        };
      }
    },

    /**
     * Set scan mode
     * @param {{mode: 'keyboard'|'regula'|'penta'}} args
     */
    setMode: async (args) => {
      const newMode = args.mode;
      // Notify both device clients so they can start/stop polling
      setRegulaMode(newMode === 'regula' ? 'api' : 'keyboard');
      setPentaMode(newMode);
      logger.info(`Scan mode set to: ${newMode}`);
      return { ok: true };
    },

    /**
     * Undo the last green scan
     */
    undoLast: async () => {
      try {
        if (!lastUndoableScanId) {
          return { ok: false, message: 'No undoable scan found' };
        }

        const state = store.getState();
        const lastEvent = state.scan_events.find(e => e.id === lastUndoableScanId);
        
        if (!lastEvent || lastEvent.outcome !== 'green') {
          return { ok: false, message: 'Invalid undo state' };
        }

        const normalized = lastEvent.passport_number_normalized;

        store.mutate(draft => {
          // Remove boarding record
          delete draft.boarding_records[normalized];
          
          // Add operator-undone event
          const undoEvent = {
            id: require('uuid').v4(),
            timestamp: new Date().toISOString(),
            outcome: 'operator-undone',
            mode: 'manual',
            passport_number_normalized: normalized,
            scan_event_id: lastUndoableScanId
          };
          draft.scan_events.push(undoEvent);
        });

        logger.info(`Undo successful for ${normalized}`);
        lastUndoableScanId = null;
        return { ok: true };

      } catch (err) {
        logger.error(`undoLast failed: ${err.message}`);
        return { ok: false, message: err.message };
      }
    }
  };
}

module.exports = { createScanHandlers };
