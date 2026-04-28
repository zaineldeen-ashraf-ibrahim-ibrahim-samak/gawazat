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

        const totalPassengers = manifest.length;
        const totalEntered = Object.keys(boarding).length;
        const totalPending = pending.filter(e => e.state === 'awaiting').length;
        const totalWarnings = events.filter(e => e.outcome === 'orange' || e.outcome === 'read-failed').length;

        // Recent events (last 5)
        const passengerMap = new Map();
        manifest.forEach(p => passengerMap.set(p.id, p));

        const recentEvents = events.slice(-5).reverse().map(e => {
          const passenger = e.passenger_id ? passengerMap.get(e.passenger_id) : null;
          return {
            ...e,
            passenger_name: passenger ? passenger.name : (e.mrz_fields?.name || '---')
          };
        });

        return {
          total: totalPassengers,
          entered: totalEntered,
          pending: totalPending,
          warnings: totalWarnings,
          recentEvents
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
