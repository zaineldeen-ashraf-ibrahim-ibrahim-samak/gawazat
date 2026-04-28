const { normalizePassportNumber } = require('../../shared/normalize');

let currentIndices = {
  manifestByNormalized: new Map(),
  boardingByNormalized: new Map(),
  pendingAwaiting: [],
};

/**
 * Rebuild in-memory indices from state
 * Called on load and after mutations for O(1) lookups
 */
function rebuildIndices(state) {
  currentIndices = {
    manifestByNormalized: new Map(),
    boardingByNormalized: new Map(),
    pendingAwaiting: [],
  };

  // Build manifest index
  if (state.manifest && Array.isArray(state.manifest)) {
    for (const passenger of state.manifest) {
      currentIndices.manifestByNormalized.set(passenger.passport_number_normalized, passenger);
    }
  }

  // Build boarding index
  if (state.boarding_records && typeof state.boarding_records === 'object') {
    for (const [key, record] of Object.entries(state.boarding_records)) {
      currentIndices.boardingByNormalized.set(key, record);
    }
  }

  // Build pending awaiting list
  if (state.pending_approval && Array.isArray(state.pending_approval)) {
    currentIndices.pendingAwaiting = state.pending_approval.filter((entry) => entry.state === 'awaiting');
  }

  return currentIndices;
}

/**
 * Get current in-memory indices
 */
function getIndices() {
  return currentIndices;
}

module.exports = { rebuildIndices, getIndices };
