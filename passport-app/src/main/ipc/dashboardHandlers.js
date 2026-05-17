/**
 * IPC Handlers for Dashboard
 * Handles: stats
 */

const logger = require('../services/logger');

/**
 * Create dashboard handlers
 * @param {Object} store - EncryptedStore instance
 * @returns {Object} Handlers
 */
function createDashboardHandlers(store) {
  return {
    /**
     * Get dashboard statistics and recent events
     */
    stats: async () => {
      try {
        const state = store.getState();
        const manifest = state.manifest || [];
        const boarding = state.boarding_records || {};
        const events = state.scan_events || [];
        const pending = state.pending_approval || [];

        const originalManifest = manifest.filter(p => p.source !== 'added-at-gate');
        const newPassengers    = manifest.filter(p => p.source === 'added-at-gate');
        const totalPassengers  = originalManifest.length;
        const totalNew         = newPassengers.length;
        const totalEntered     = manifest.filter(p => boarding[p.passport_number_normalized]).length;
        const totalPending     = pending.filter(e => e.state === 'awaiting').length;
        const totalWarnings    = events.filter(e => e.outcome === 'orange' || e.outcome === 'read-failed').length;
        const originalEntered  = originalManifest.filter(p => boarding[p.passport_number_normalized]).length;
        const waitingCount     = totalPassengers - originalEntered;

        // Recent events (last 5)
        const passengerMap = new Map();
        manifest.forEach(p => passengerMap.set(p.id, p));

        // Nationality breakdown for original manifest
        const nationalityCounts = {};
        originalManifest.forEach(p => {
          const nat = (p.nationality || '???').toUpperCase();
          nationalityCounts[nat] = (nationalityCounts[nat] || 0) + 1;
        });

        // Nationality breakdown for new passengers (added at gate)
        const nationalityCountsNew = {};
        newPassengers.forEach(p => {
          const nat = (p.nationality || '???').toUpperCase();
          nationalityCountsNew[nat] = (nationalityCountsNew[nat] || 0) + 1;
        });

        // Nationality breakdown for entered passengers
        const nationalityCountsEntered = {};
        manifest.filter(p => boarding[p.passport_number_normalized]).forEach(p => {
          const nat = (p.nationality || '???').toUpperCase();
          nationalityCountsEntered[nat] = (nationalityCountsEntered[nat] || 0) + 1;
        });

        const recentEvents = events.slice(-5).reverse().map(e => {
          const passenger = e.passenger_id ? passengerMap.get(e.passenger_id) : null;
          return {
            ...e,
            passenger_name: passenger ? passenger.name : (e.mrz_fields?.surname ? `${e.mrz_fields.surname} ${e.mrz_fields.given_names}` : '---')
          };
        });

        const settings = state.settings || {};
        return {
          total: totalPassengers,
          totalNew,
          entered: totalEntered,
          originalEntered,
          newEntered: totalEntered - originalEntered,
          pending: totalPending,
          warnings: totalWarnings,
          waiting: waitingCount,
          recentEvents,
          nationalityCounts,
          nationalityCountsNew,
          nationalityCountsEntered,
          ship_name: settings.ship_name || state.voyage?.ship_name || '',
        };
      } catch (err) {
        logger.error(`Dashboard stats failed: ${err.message}`);
        return {
          total: 0,
          entered: 0,
          pending: 0,
          warnings: 0,
          recentEvents: []
        };
      }
    }
  };
}

module.exports = { createDashboardHandlers };
