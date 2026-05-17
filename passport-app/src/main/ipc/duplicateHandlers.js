const { ipcMain } = require('electron');
const { detect } = require('../services/duplicateMatcher');
const { makePassenger } = require('../../shared/entities');
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
            // Update fields from incoming
            Object.assign(existing, {
              ...incomingRaw,
              ...incomingNormalized,
              duplicateFlag: 'merged',
            });
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
