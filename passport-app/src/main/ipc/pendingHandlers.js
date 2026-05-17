/**
 * IPC Handlers for Pending Approval
 * Handles: list, approve, reject
 */

const { makePassenger, makeBoardingRecord, makeScanEvent } = require('../../shared/entities');
const { rebuildIndices } = require('../store/indices');
const logger = require('../services/logger');

/**
 * Create pending handlers
 * @param {Object} store - EncryptedStore instance
 * @returns {Object} Handlers
 */
function createPendingHandlers(store) {
  return {
    /**
     * List awaiting pending entries
     */
    list: async () => {
      const state = store.getState();
      return (state.pending_approval || []).filter(e => e.state === 'awaiting');
    },

    /**
     * Approve a pending entry
     * Creates a passenger and a boarding record
     */
    approve: async (args) => {
      try {
        const { id } = args;
        const state = store.getState();
        const entryIndex = state.pending_approval.findIndex(e => e.id === id);
        const entry = state.pending_approval[entryIndex];

        if (!entry || entry.state !== 'awaiting') {
          return { ok: false, message: 'Entry not found or already processed' };
        }

        const mrz = entry.mrz_fields;
        const normalized = entry.passport_number_normalized;

        store.mutate(draft => {
          // 1. Create Passenger (source='added-at-gate')
          const passenger = makePassenger({
            passport_number: mrz.document_number,
            passport_number_normalized: normalized,
            name: mrz.name || `${mrz.surname} ${mrz.given_names}`,
            gender: mrz.gender || mrz.sex,
            nationality: mrz.nationality,
            date_of_birth: mrz.date_of_birth,
            source: 'added-at-gate'
          });
          draft.manifest.push(passenger);

          // 2. Do NOT create Boarding Record automatically — new passengers default to pending status per user request

          // 3. Mark entry as approved — carry mrz_fields so history always shows the name
          const resolvedEvent = makeScanEvent({
            outcome: 'pending-approved',
            mode: 'manual',
            passport_number_normalized: normalized,
            passenger_id: passenger.id,
            mrz_fields: mrz,
          });
          draft.scan_events.push(resolvedEvent);

          // 4. Back-fill passenger_id on the original pending scan event so it shows the name too
          const origIdx = draft.scan_events.findIndex(ev => ev.id === entry.scan_event_id);
          if (origIdx !== -1 && !draft.scan_events[origIdx].passenger_id) {
            draft.scan_events[origIdx].passenger_id = passenger.id;
          }

          draft.pending_approval[entryIndex].state = 'approved';
          draft.pending_approval[entryIndex].resolved_at = new Date().toISOString();
          draft.pending_approval[entryIndex].resolution_event_id = resolvedEvent.id;
        });

        rebuildIndices(store.getState());
        logger.info(`Pending entry ${id} approved for ${normalized}`);
        
        return { ok: true };
      } catch (err) {
        logger.error(`Pending approve failed: ${err.message}`);
        return { ok: false, message: err.message };
      }
    },

    /**
     * Reject a pending entry
     */
    reject: async (args) => {
      try {
        const { id } = args;
        const state = store.getState();
        const entryIndex = state.pending_approval.findIndex(e => e.id === id);
        const entry = state.pending_approval[entryIndex];

        if (!entry || entry.state !== 'awaiting') {
          return { ok: false, message: 'Entry not found or already processed' };
        }

        store.mutate(draft => {
          const rejectEvent = makeScanEvent({
            outcome: 'pending-rejected',
            mode: 'manual',
            passport_number_normalized: entry.passport_number_normalized,
            mrz_fields: entry.mrz_fields,
          });
          draft.scan_events.push(rejectEvent);

          draft.pending_approval[entryIndex].state = 'rejected';
          draft.pending_approval[entryIndex].resolved_at = new Date().toISOString();
          draft.pending_approval[entryIndex].resolution_event_id = rejectEvent.id;
        });

        logger.info(`Pending entry ${id} rejected`);
        return { ok: true };
      } catch (err) {
        logger.error(`Pending reject failed: ${err.message}`);
        return { ok: false, message: err.message };
      }
    }
  };
}

module.exports = { createPendingHandlers };
