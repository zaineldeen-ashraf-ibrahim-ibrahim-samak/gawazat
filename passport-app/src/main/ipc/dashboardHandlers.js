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
        const totalEntered     = Object.keys(boarding).length; // old + new combined
        const totalPending     = pending.filter(e => e.state === 'awaiting').length;
        const totalWarnings    = events.filter(e => e.outcome === 'orange' || e.outcome === 'read-failed').length;

        // Recent events (last 5)
        const passengerMap = new Map();
        manifest.forEach(p => passengerMap.set(p.id, p));

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
          pending: totalPending,
          warnings: totalWarnings,
          recentEvents,
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
