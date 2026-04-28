const logger = require('./logger');

/**
 * Retention purge service
 * Removes voyage data older than retention_days (preserves settings)
 */
function purgeRetention(store) {
  try {
    const state = store.getState();
    const settings = state.settings || {};
    const retentionDays = settings.retention_days || 30;

    if (!state.voyage) {
      logger.info('No voyage to purge');
      return;
    }

    const importedAt = new Date(state.voyage.imported_at);
    const now = new Date();
    const ageMs = now - importedAt;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    logger.info('Checking retention', { voyageAge: ageDays, retentionDays });

    if (ageDays > retentionDays) {
      logger.info('Purging old voyage data');

      store.mutate((draft) => {
        // Clear voyage-specific data but preserve settings
        draft.voyage = null;
        draft.manifest = [];
        draft.scan_events = [];
        draft.boarding_records = {};
        draft.pending_approval = [];
        // Settings preserved
      });

      logger.info('Retention purge completed');
    }
  } catch (err) {
    logger.error('Retention purge error:', err.message);
  }
}

module.exports = { purgeRetention };
