const { ipcMain } = require('electron');
const { detect } = require('../services/duplicateMatcher');
const { makePassenger, makeBoardingRecord, makeScanEvent } = require('../../shared/entities');
const { ReasonCodes } = require('../../shared/reasonCodes');
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
            // Merge incoming fields onto existing, but DON'T overwrite an existing
            // value with an empty/undefined one — this preserves manifest data
            // when the operator confirmed a partial scan against an existing
            // passenger (some passports don't carry every field in the MRZ).
            const incomingMerged = { ...incomingRaw, ...incomingNormalized };
            for (const [k, v] of Object.entries(incomingMerged)) {
              if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) continue;
              existing[k] = v;
            }
            existing.duplicateFlag = 'merged';

            // Treat operator confirmation as a successful identification: record a
            // scan event and board the passenger if not already boarded. Without
            // this, a confirmed partial-scan would leave the passenger un-entered.
            const normalizedKey = existing.passport_number_normalized
              || incomingNormalized?.passportNumberKey
              || incomingRaw?.passport_number
              || incomingRaw?.document_number;
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
