/**
 * IPC Handlers for Scanning
 * Handles: submitMrz, undoLast
 */

const { processMrz } = require('../services/scanProcessor');
const { setMode: setRegulaMode } = require('../services/regulaClient');
const { setPentaMode } = require('../services/pentaClient');
const logger = require('../services/logger');
const { normalizePassportNumber } = require('../../shared/normalize');
const { makeScanEvent, makeBoardingRecord, makePendingApprovalEntry } = require('../../shared/entities');
const { getIndices, rebuildIndices } = require('../store/indices');

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
     * Submit manual passenger data (no MRZ)
     */
    submitManual: async (args) => {
      try {
        const { passport, name, gender, nationality, date_of_birth } = args;
        if (!passport || !name) return { outcome: 'read-failed', message: 'رقم الجواز والاسم مطلوبان' };

        const normalized = normalizePassportNumber(passport);
        rebuildIndices(store.getState());
        const { manifestByNormalized, boardingByNormalized } = getIndices();
        const passenger = manifestByNormalized.get(normalized);
        const existingBoarding = boardingByNormalized.get(normalized);

        const mrz_fields = { document_number: passport, name, gender, nationality, date_of_birth };
        const normalizedPassenger = {
          passportNumberKey: normalized,
          name,
          dob: date_of_birth,
          nationality
        };

        const { detect } = require('../services/duplicateMatcher');
        const duplicateMatch = detect(normalizedPassenger);

        if (duplicateMatch.kind === 'exact') {
          return { outcome: 'rejected', reason: 'DUPLICATE_PASSPORT', duplicateMatch };
        } else if (duplicateMatch.kind === 'fuzzy') {
          const existingPassenger = store.getState().manifest.find(p => p.id === duplicateMatch.existingPassengerId);
          return { outcome: 'fuzzy', mrz_fields, normalizedPassenger, duplicateMatch, existingPassenger };
        }

        let outcome = 'yellow';
        let firstEnteredAt = null;

        if (passenger) {
          if (existingBoarding) {
            outcome = 'orange';
            firstEnteredAt = existingBoarding.entered_at;
          } else {
            outcome = 'green';
          }
        } else {
          const { validate } = require('../../shared/fieldRequirements');
          const reqs = store.getState().settings?.fieldRequirements;
          const validation = validate(mrz_fields, reqs);
          if (!validation.valid) {
            return {
              outcome: 'read-failed',
              reason: 'REQUIRED_FIELD_MISSING',
              message: `الحقول المطلوبة مفقودة: ${validation.missingRequired.join(', ')}`,
              missingRequired: validation.missingRequired
            };
          }
        }

        const scanEvent = makeScanEvent({ outcome, mode: 'manual', passport_number_normalized: normalized, passenger_id: passenger?.id || null, mrz_fields });

        store.mutate(draft => {
          draft.scan_events.push(scanEvent);
          if (outcome === 'green') {
            draft.boarding_records[normalized] = makeBoardingRecord({ passenger_id: passenger.id, passport_number_normalized: normalized, scan_event_id: scanEvent.id, via: 'manual' });
          } else if (outcome === 'yellow') {
            const { validate } = require('../../shared/fieldRequirements');
            const reqs = store.getState().settings?.fieldRequirements;
            const validation = validate(mrz_fields, reqs);

            const pendingEntry = makePendingApprovalEntry({ scan_event_id: scanEvent.id, passport_number_normalized: normalized, mrz_fields, state: 'awaiting' });
            if (validation.missingOptional?.length > 0) {
              pendingEntry.missingOptionalFields = validation.missingOptional;
            }
            draft.pending_approval.push(pendingEntry);
          }
        });

        // Rebuild so subsequent scans always see the updated boarding/pending state
        rebuildIndices(store.getState());

        if (outcome === 'green') lastUndoableScanId = scanEvent.id;
        logger.info(`Manual entry: ${outcome} for ${normalized}`);
        return { outcome, scan_event_id: scanEvent.id, passenger: passenger || { passport_number: passport, name, gender, nationality, date_of_birth }, mrz_fields, first_entered_at: firstEnteredAt };
      } catch (err) {
        logger.error(`submitManual failed: ${err.message}`);
        return { outcome: 'read-failed', message: err.message };
      }
    },

    /**
     * Set scan mode
     * @param {{mode: 'keyboard'|'regula'|'penta'}} args
     */
    setMode: async (args) => {
      const newMode = args.mode;
      // Notify both device clients so they can start/stop polling
      setRegulaMode(newMode);
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
