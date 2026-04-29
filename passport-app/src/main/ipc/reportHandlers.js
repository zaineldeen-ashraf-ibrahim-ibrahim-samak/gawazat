/**
 * IPC Handlers for Reports
 * Handles: generatePdf, print
 */

const { generateReport } = require('../services/reportPdf');
const logger = require('../services/logger');
const path = require('path');
const fs = require('fs');

/**
 * Create report handlers
 * @param {Object} store - EncryptedStore instance
 * @returns {Object} Handlers
 */
function createReportHandlers(store) {
  return {
    /**
     * Generate a PDF report file
     * @param {{kind: string, savePath: string}} args
     */
    generatePdf: async (args) => {
      try {
        const { kind, savePath } = args;
        const state = store.getState();
        const manifest = state.manifest || [];
        const boarding = state.boarding_records || {};

        const scanHistory = state.scan_history || [];

        // Build a set of passport numbers that were scanned more than once
        const scanCounts = {};
        scanHistory.forEach(rec => {
          const k = rec.passport_number_normalized || rec.passport_number;
          if (k) scanCounts[k] = (scanCounts[k] || 0) + 1;
        });

        let filtered = manifest;
        if (kind === 'entered') {
          filtered = manifest.filter(p => boarding[p.passport_number_normalized]);
        } else if (kind === 'pending') {
          filtered = manifest.filter(p => !boarding[p.passport_number_normalized]);
        } else if (kind === 'warnings') {
          filtered = manifest.filter(p => (scanCounts[p.passport_number_normalized] || 0) > 1);
        } else if (kind === 'new') {
          filtered = manifest.filter(p => p.source === 'added-at-gate');
        }

        const settings = state.settings || {};
        const data = {
          voyage: {
            ...(state.voyage || {}),
            ship_name: settings.ship_name || state.voyage?.ship_name || '',
          },
          passengers: filtered.map(p => ({
            ...p,
            is_entered:   boarding[p.passport_number_normalized] !== undefined,
            is_duplicate: (scanCounts[p.passport_number_normalized] || 0) > 1,
          }))
        };

        await generateReport(kind, data, savePath);
        return { ok: true };
      } catch (err) {
        logger.error(`Report generate failed: ${err.message}`);
        return { ok: false, message: err.message };
      }
    },

    /**
     * Print a report (direct to printer)
     */
    print: async (args) => {
      try {
        const { kind } = args;
        const tempPath = path.join(require('electron').app.getPath('temp'), `print-${Date.now()}.pdf`);

        const genResult = await createReportHandlers(store).generatePdf({ kind, savePath: tempPath });
        if (!genResult.ok) return { ok: false, message: genResult.message || 'فشل إنشاء الملف' };

        if (!fs.existsSync(tempPath)) return { ok: false, message: 'الملف لم يُنشأ' };

        const { shell } = require('electron');
        const errMsg = await shell.openPath(tempPath);
        if (errMsg) {
          logger.error(`shell.openPath failed: ${errMsg}`);
          return { ok: false, message: errMsg };
        }

        return { ok: true };
      } catch (err) {
        logger.error(`Report print failed: ${err.message}`);
        return { ok: false, message: err.message };
      }
    }
  };
}

module.exports = { createReportHandlers };
