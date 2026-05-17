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
        // Make sure the failure is captured in scan history even when the
        // exception escaped scanProcessor before it could record one.
        try {
          const state = store.getState();
          const already = err.__scanEventRecorded || (state.scan_events || []).some(ev =>
            ev.outcome === 'read-failed' && ev.mrz_fields?.error === err.message);
          if (!already) {
            const errEvent = makeScanEvent({
              outcome: 'read-failed',
              mode: 'keyboard',
              raw_data: args?.rawMrz || '',
              mrz_fields: { error: err.message }
            });
            store.mutate(draft => draft.scan_events.push(errEvent));
          }
        } catch (_) { /* swallow */ }
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
          const rejEvent = makeScanEvent({
            outcome: 'orange',
            mode: 'manual',
            passport_number_normalized: normalized,
            passenger_id: duplicateMatch.existingPassengerId,
            mrz_fields
          });
          store.mutate(draft => draft.scan_events.push(rejEvent));
          return { outcome: 'rejected', reason: 'DUPLICATE_PASSPORT', scan_event_id: rejEvent.id, duplicateMatch, mrz_fields };
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
          // Offer candidate recommendations from the manifest before
          // defaulting to pending or rejecting. Operator can pick one of
          // these (continue as that passenger), send to pending, or cancel.
          const { detectCandidates } = require('../services/duplicateMatcher');
          const candidates = detectCandidates(normalizedPassenger, 5);
          if (candidates.length > 0) {
            return {
              outcome: 'recommend',
              mrz_fields,
              normalizedPassenger,
              candidates: candidates.map(c => ({
                passenger: c.passenger,
                score: c.score,
                differences: c.differences
              }))
            };
          }

          const { validate } = require('../../shared/fieldRequirements');
          const reqs = store.getState().settings?.fieldRequirements;
          const validation = validate(mrz_fields, reqs);
          if (!validation.valid) {
            // Mirror processMrz: before failing, try a fuzzy manifest match using
            // whatever fields the operator did supply. If found, surface the
            // "Is this <existing passenger>?" prompt so missing fields can come
            // from the manifest record. Some manual entries (and some passports)
            // don't include every required field.
            const fallbackMatch = detect(normalizedPassenger);
            if (fallbackMatch.kind === 'fuzzy') {
              const existingPassenger = store.getState().manifest.find(p => p.id === fallbackMatch.existingPassengerId);
              if (existingPassenger) {
                return {
                  outcome: 'fuzzy',
                  mrz_fields,
                  normalizedPassenger,
                  duplicateMatch: fallbackMatch,
                  existingPassenger,
                  missingRequired: validation.missingRequired,
                  partialScan: true
                };
              }
            }
            const failEvent = makeScanEvent({
              outcome: 'read-failed',
              mode: 'manual',
              passport_number_normalized: normalized,
              mrz_fields
            });
            store.mutate(draft => draft.scan_events.push(failEvent));
            return {
              outcome: 'read-failed',
              reason: 'REQUIRED_FIELD_MISSING',
              scan_event_id: failEvent.id,
              message: `الحقول المطلوبة مفقودة: ${validation.missingRequired.join(', ')}`,
              missingRequired: validation.missingRequired,
              mrz_fields
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
        try {
          const errEvent = makeScanEvent({
            outcome: 'read-failed',
            mode: 'manual',
            mrz_fields: { error: err.message, ...(args || {}) }
          });
          store.mutate(draft => draft.scan_events.push(errEvent));
        } catch (_) { /* swallow */ }
        return { outcome: 'read-failed', message: err.message };
      }
    },

    /**
     * Commit the operator's choice from the recommendation modal.
     * decision:
     *   'select-existing' — board the chosen manifest passenger and merge any
     *                       non-empty incoming fields onto their record.
     *   'pending'         — file the scan into the pending-approval queue.
     *   'cancel'          — record a read-failed event and walk away.
     */
    resolveRecommendation: async (args) => {
      try {
        const { decision, candidateId, mrz_fields, normalizedPassenger } = args || {};
        if (!['select-existing', 'pending', 'cancel'].includes(decision)) {
          return { ok: false, message: 'Invalid decision' };
        }
        const normalized = normalizedPassenger?.passportNumberKey
          || (mrz_fields ? normalizePassportNumber(mrz_fields.document_number || mrz_fields.passport_number || mrz_fields.passportNumber || '') : '');

        if (decision === 'select-existing') {
          if (!candidateId) return { ok: false, message: 'candidateId required' };
          const existing = store.getState().manifest.find(p => p.id === candidateId);
          if (!existing) return { ok: false, message: 'Candidate not found' };

          const scanEvent = makeScanEvent({
            outcome: 'green',
            mode: 'recommend-confirm',
            passport_number_normalized: existing.passport_number_normalized || normalized,
            passenger_id: existing.id,
            mrz_fields: mrz_fields || {}
          });

          store.mutate(draft => {
            const passenger = draft.manifest.find(p => p.id === candidateId);
            if (passenger) {
              const incomingMerged = { ...(mrz_fields || {}), ...(normalizedPassenger || {}) };
              for (const [k, v] of Object.entries(incomingMerged)) {
                if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) continue;
                passenger[k] = v;
              }
              passenger.duplicateFlag = 'merged';
            }
            draft.scan_events.push(scanEvent);
            const boardingKey = existing.passport_number_normalized || normalized;
            if (boardingKey && !draft.boarding_records[boardingKey]) {
              draft.boarding_records[boardingKey] = makeBoardingRecord({
                passenger_id: existing.id,
                passport_number_normalized: boardingKey,
                scan_event_id: scanEvent.id,
                via: 'recommend-confirm'
              });
            }
          });
          rebuildIndices(store.getState());
          lastUndoableScanId = scanEvent.id;
          return { ok: true, outcome: 'green', scan_event_id: scanEvent.id, passenger_id: existing.id };
        }

        if (decision === 'pending') {
          const scanEvent = makeScanEvent({
            outcome: 'yellow',
            mode: 'recommend-pending',
            passport_number_normalized: normalized,
            mrz_fields: mrz_fields || {}
          });
          const pendingEntry = makePendingApprovalEntry({
            scan_event_id: scanEvent.id,
            passport_number_normalized: normalized,
            mrz_fields: mrz_fields || {},
            state: 'awaiting'
          });
          store.mutate(draft => {
            draft.scan_events.push(scanEvent);
            draft.pending_approval.push(pendingEntry);
          });
          rebuildIndices(store.getState());
          return { ok: true, outcome: 'yellow', scan_event_id: scanEvent.id, pending_id: pendingEntry.id };
        }

        // cancel
        const failEvent = makeScanEvent({
          outcome: 'read-failed',
          mode: 'recommend-cancel',
          passport_number_normalized: normalized,
          mrz_fields: mrz_fields || {}
        });
        store.mutate(draft => draft.scan_events.push(failEvent));
        return { ok: true, outcome: 'read-failed', scan_event_id: failEvent.id };
      } catch (err) {
        logger.error(`resolveRecommendation failed: ${err.message}`);
        return { ok: false, message: err.message };
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
