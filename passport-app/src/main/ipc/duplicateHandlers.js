const { ipcMain } = require('electron');
const { detect } = require('../services/duplicateMatcher');
const { makePassenger, makeBoardingRecord, makeScanEvent } = require('../../shared/entities');
const { ReasonCodes } = require('../../shared/reasonCodes');
const { normalizePassportNumber } = require('../../shared/normalize');
const logger = require('../services/logger');

function createDuplicateHandlers(store) {
  return {
    detectDuplicate: async (event, normalized) => {
      if (!normalized || typeof normalized !== 'object' || !normalized.passportNumberKey) {
        const err = new Error('Invalid arguments');
        err.code = ReasonCodes.IPC_INVALID_ARGS;
        throw err;
      }
      return detect(normalized);
    },

    resolveDuplicate: async (event, payload) => {
      const { incomingRaw, incomingNormalized, existingPassengerId, decision } = payload || {};
      
      if (!decision || !['merge', 'keep-separate', 'cancel'].includes(decision)) {
        const err = new Error('Invalid decision');
        err.code = ReasonCodes.IPC_INVALID_ARGS;
        throw err;
      }

      let resultId = existingPassengerId;

      store.mutate((state) => {
        if (!state.session.duplicateDecisionsAudit) {
          state.session.duplicateDecisionsAudit = [];
        }
        
        state.session.duplicateDecisionsAudit.push({
          timestamp: new Date().toISOString(),
          decision,
          existingPassengerId,
          incomingNormalized,
        });

        if (decision === 'merge') {
          const existing = state.manifest.find(p => p.id === existingPassengerId);
          if (existing) {
            // 1) Merge non-empty incoming fields onto existing — preserves
            //    manifest data when the incoming scan was partial.
            const incomingMerged = { ...incomingRaw, ...incomingNormalized };
            for (const [k, v] of Object.entries(incomingMerged)) {
              if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) continue;
              existing[k] = v;
            }
            existing.duplicateFlag = 'merged';

            // 2) Collapse any OTHER manifest entries that represent the same
            //    person into this one, so the passenger list shows ONE row.
            //    "Same person" = any manifest entry whose normalized passport
            //    number matches the existing record's key OR the incoming key.
            //    This covers both:
            //      - a prior "keep-separate" duplicate that the operator now
            //        wants to consolidate, and
            //      - an import row that landed in the manifest under a slightly
            //        different shape.
            const candidateKeys = new Set();
            const addKey = (v) => {
              if (!v) return;
              const norm = normalizePassportNumber(String(v));
              if (norm) candidateKeys.add(norm);
            };
            addKey(existing.passport_number_normalized);
            addKey(existing.passport_number);
            addKey(incomingNormalized?.passportNumberKey);
            addKey(incomingRaw?.passport_number);
            addKey(incomingRaw?.document_number);

            const toRemoveIds = [];
            for (const p of state.manifest) {
              if (p.id === existing.id) continue;
              const k = p.passport_number_normalized || normalizePassportNumber(p.passport_number || '');
              if (k && candidateKeys.has(k)) toRemoveIds.push(p.id);
            }
            if (toRemoveIds.length > 0) {
              const removeSet = new Set(toRemoveIds);
              // Drop the duplicate manifest rows.
              state.manifest = state.manifest.filter(p => !removeSet.has(p.id));

              // Re-point any boarding records that referenced a removed
              // passenger so the entry-state is preserved on the survivor.
              if (state.boarding_records) {
                for (const key of Object.keys(state.boarding_records)) {
                  const br = state.boarding_records[key];
                  if (br && removeSet.has(br.passenger_id)) {
                    br.passenger_id = existing.id;
                  }
                }
              }
              // Re-point any pending-approval entries.
              if (Array.isArray(state.pending_approval)) {
                for (const entry of state.pending_approval) {
                  if (entry && removeSet.has(entry.passenger_id)) {
                    entry.passenger_id = existing.id;
                  }
                }
              }
              // Re-point past scan events for traceability.
              if (Array.isArray(state.scan_events)) {
                for (const ev of state.scan_events) {
                  if (ev && removeSet.has(ev.passenger_id)) {
                    ev.passenger_id = existing.id;
                  }
                }
              }
              logger.info(`Merge collapsed ${toRemoveIds.length} duplicate passenger row(s) into ${existing.id}`);
            }

            // 3) Treat operator confirmation as a successful identification:
            //    record a scan event and board the passenger if not already.
            const normalizedKey = existing.passport_number_normalized
              || incomingNormalized?.passportNumberKey
              || normalizePassportNumber(incomingRaw?.passport_number || incomingRaw?.document_number || '');
            if (normalizedKey) {
              const scanEvent = makeScanEvent({
                outcome: 'green',
                mode: 'duplicate-confirm',
                passport_number_normalized: normalizedKey,
                passenger_id: existing.id,
                raw_data: incomingRaw?.rawMrz || '',
                mrz_fields: incomingRaw || {}
              });
              if (!state.scan_events) state.scan_events = [];
              state.scan_events.push(scanEvent);

              if (!state.boarding_records) state.boarding_records = {};
              if (!state.boarding_records[normalizedKey]) {
                state.boarding_records[normalizedKey] = makeBoardingRecord({
                  passenger_id: existing.id,
                  passport_number_normalized: normalizedKey,
                  scan_event_id: scanEvent.id,
                  via: 'duplicate-confirm'
                });
              }
            }
          }
        } else if (decision === 'keep-separate') {
          const newPassenger = makePassenger({ ...incomingRaw, ...incomingNormalized });
          newPassenger.duplicateFlag = 'kept-separate';
          state.manifest.push(newPassenger);
          
          // Rebuild indices will happen later or manually
          resultId = newPassenger.id;
        }
      });
      
      // Need to rebuild indices if we changed the manifest, but usually the caller (scanProcessor) does it or we trigger an event
      const { rebuildIndices } = require('../store/indices');
      rebuildIndices(store.getState());

      return { passengerId: resultId };
    }
  };
}

module.exports = { createDuplicateHandlers };
