/**
 * IPC Handlers for Manifest Management
 * Handles: import, downloadTemplate, list, exportFiltered
 */

const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { parseFile } = require('../services/manifestImport');
const { makePassenger, makeVoyage } = require('../../shared/entities');
const { rebuildIndices } = require('../store/indices');
const logger = require('../services/logger');

/**
 * Create manifest handlers for the current store instance
 * @param {Object} store - EncryptedStore instance
 * @returns {Object} Handlers object
 */
function createManifestHandlers(store) {
  const handlers = {
    /**
     * Import an Excel manifest file
     * @param {{filePath: string}} args - Path to Excel file
     * @returns {Promise<{ok: boolean, voyage?: Voyage, passengers?: Passenger[], errors?: ImportError[], message?: string}>}
     */
    import: async (args) => {
      try {
        const { filePath } = args;

        if (!filePath || typeof filePath !== 'string') {
          return { ok: false, message: 'Invalid file path' };
        }

        // Parse and validate the file
        const parseResult = parseFile(filePath);

        if (parseResult.errors.length > 0 && !parseResult.rows.some(r => r.outcome === 'Pass')) {
          logger.warn(`Import failed: ${parseResult.errors.length} errors, 0 valid rows`);
          return {
            ok: false,
            errors: parseResult.errors,
            message: `File contains ${parseResult.errors.length} validation error(s) and no valid rows.`
          };
        }

        // Extract passing rows
        const passingRows = parseResult.rows.filter(r => r.outcome === 'Pass');

        if (passingRows.length === 0) {
          return {
            ok: false,
            message: 'No valid rows in file',
            errors: parseResult.rows.filter(r => r.outcome === 'Error').flatMap(r => r.errors)
          };
        }

        // Create a new voyage (atomically replace the current one)
        const state = store.getState();
        const settings = state.appSettings || {};

        const voyage = makeVoyage({
          ship_name: settings.ship_name || '',
          port_name: settings.port_name || 'Port Said',
          imported_at: new Date().toISOString()
        });

        // Create passenger records
        const passengers = passingRows.map(row => {
          return makePassenger({
            passport_number: row.passport_number,
            passport_number_normalized: row.passport_number_normalized,
            name: row.name,
            gender: row.gender,
            nationality: row.nationality,
            date_of_birth: row.date_of_birth,
            vessel: row.vessel,
            seat: row.seat,
            source: 'manifest'
          });
        });

        // Atomically update store: replace voyage and manifest
        store.mutate((draft) => {
          draft.voyage = voyage;
          draft.manifest = passengers;
          // Clear previous scan events, boarding records, pending entries
          draft.scan_events = [];
          draft.boarding_records = {};
          draft.pending_approval = [];
        });

        // Rebuild indices
        rebuildIndices(store.getState());

        logger.info(`Imported ${passengers.length} passengers for voyage ${voyage.id}`);

        return {
          ok: true,
          voyage,
          passengers,
          errors: parseResult.rows.filter(r => r.outcome === 'Error').flatMap(r => r.errors)
        };
      } catch (err) {
        logger.error(`Import failed: ${err.message}`);
        return {
          ok: false,
          message: `Import failed: ${err.message}`
        };
      }
    },

    /**
     * Preview an Excel manifest file without importing
     * @param {{filePath: string}} args
     */
    preview: async (args) => {
      try {
        const { filePath } = args;
        const parseResult = parseFile(filePath);

        return {
          ok: true,
          passengers: parseResult.rows.filter(r => r.outcome === 'Pass'),
          errors: parseResult.rows.filter(r => r.outcome === 'Error').flatMap(r => r.errors)
        };
      } catch (err) {
        logger.error(`Preview failed: ${err.message}`);
        return { ok: false, message: err.message };
      }
    },

    /**
     * Download a blank template Excel file
     * @param {{savePath: string}} args - Where to save the template
     * @returns {Promise<{ok: boolean, message?: string}>}
     */
    downloadTemplate: async (args) => {
      try {
        const { savePath } = args;

        if (!savePath || typeof savePath !== 'string') {
          return { ok: false, message: 'Invalid save path' };
        }

        // Create sheet 1: Template with header row only
        const templateData = [
          [
            'رقم الجواز',     // passport_number
            'الاسم',           // name
            'النوع',           // gender
            'الجنسية',         // nationality
            'تاريخ الميلاد',   // date_of_birth
            'السفينة',         // vessel (optional)
            'المقعد'           // seat (optional)
          ],
          // One sample row for reference
          [
            'EG123456',
            'محمد علي أحمد',
            'M',
            'EGY',
            '1990-05-15',
            '',
            ''
          ]
        ];

        const wsTemplate = XLSX.utils.aoa_to_sheet(templateData);
        wsTemplate['!cols'] = [
          { wch: 15 }, // passport
          { wch: 25 }, // name
          { wch: 10 }, // gender
          { wch: 10 }, // nationality
          { wch: 15 }, // DOB
          { wch: 15 }, // vessel
          { wch: 10 }  // seat
        ];

        // Create sheet 2: Instructions
        const instructionsData = [
          ['الحقل', 'الصيغة', 'ملاحظات', ''],
          ['رقم الجواز', 'نص، ≥5 أحرف', 'مطلوب', ''],
          ['الاسم', 'نص', 'مطلوب', ''],
          ['النوع', 'M/F أو Male/Female أو ذكر/أنثى', 'مطلوب', ''],
          ['الجنسية', 'كود ISO 3 أحرف (مثل EGY)', 'مطلوب', ''],
          ['تاريخ الميلاد', 'YYYY-MM-DD أو تاريخ Excel', 'مطلوب، يجب أن يكون في الماضي', ''],
          ['السفينة', 'نص', 'اختياري', ''],
          ['المقعد', 'نص', 'اختياري', '']
        ];

        const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);
        wsInstructions['!cols'] = [{ wch: 30 }, { wch: 40 }, { wch: 50 }, { wch: 20 }];

        // Create workbook
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, wsTemplate, 'Template');
        XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

        // Ensure directory exists
        const dir = path.dirname(savePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        // Write file
        XLSX.writeFile(wb, savePath);

        logger.info(`Template saved to ${savePath}`);
        return { ok: true };
      } catch (err) {
        logger.error(`Template download failed: ${err.message}`);
        return { ok: false, message: `Template download failed: ${err.message}` };
      }
    },

    /**
     * List passengers with optional filtering
     * @param {{filter?: string, search?: string}} args - Filter and search options
     * @returns {Promise<Passenger[]>}
     */
    list: async (args) => {
      try {
        const { filter, search } = args || {};
        const state = store.getState();
        const manifest = state.manifest || [];
        const boarding = state.boarding_records || {};

        let results = manifest;

        // Apply status filter
        if (filter === 'entered') {
          results = results.filter(p => {
            const normalized = p.passport_number_normalized;
            return boarding[normalized] !== undefined;
          });
        } else if (filter === 'pending') {
          results = results.filter(p => {
            const normalized = p.passport_number_normalized;
            return boarding[normalized] === undefined;
          });
        } else if (filter === 'M' || filter === 'F') {
          // Gender filter
          results = results.filter(p => p.gender === filter);
        }
        // 'all' means no additional filtering

        // Apply search filter
        if (search && typeof search === 'string') {
          const searchLower = search.trim().toLowerCase();
          results = results.filter(p => {
            return (
              p.name.toLowerCase().includes(searchLower) ||
              p.passport_number_normalized.toLowerCase().includes(searchLower) ||
              (p.passport_number && p.passport_number.toLowerCase().includes(searchLower))
            );
          });
        }

        // Map with extra flags for UI
        return results.map(p => ({
          ...p,
          is_entered: boarding[p.passport_number_normalized] !== undefined,
          entered_at: boarding[p.passport_number_normalized]?.entered_at || null
        }));
      } catch (err) {
        logger.error(`List failed: ${err.message}`);
        return [];
      }
    },

    /**
     * Export filtered passengers to Excel
     * @param {{filter?: string, search?: string, savePath: string}} args
     * @returns {Promise<{ok: boolean, count?: number, message?: string}>}
     */
    exportFiltered: async (args) => {
      try {
        const { filter, search, savePath } = args || {};

        if (!savePath) {
          return { ok: false, message: 'Save path is required' };
        }

        // Get filtered list
        const passengers = await handlers.list({ filter, search });

        if (passengers.length === 0) {
          return { ok: false, message: 'No passengers to export' };
        }

        // Build export data with boarding status
        const state = store.getState();
        const boarding = state.boarding_records || {};

        const headers = [
          'رقم الجواز',
          'الاسم',
          'النوع',
          'الجنسية',
          'تاريخ الميلاد',
          'السفينة',
          'المقعد',
          'حالة الدخول',
          'وقت الدخول'
        ];

        const data = [headers];

        for (const p of passengers) {
          data.push([
            p.passport_number,
            p.name,
            p.gender,
            p.nationality,
            p.date_of_birth,
            p.vessel || '',
            p.seat || '',
            p.is_entered ? 'تم الدخول' : 'في الانتظار',
            p.entered_at || ''
          ]);
        }

        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [
          { wch: 15 }, // passport
          { wch: 25 }, // name
          { wch: 10 }, // gender
          { wch: 10 }, // nationality
          { wch: 15 }, // dob
          { wch: 15 }, // vessel
          { wch: 10 }, // seat
          { wch: 15 }, // status
          { wch: 20 }  // entered_at
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Passengers');

        const dir = path.dirname(savePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        XLSX.writeFile(wb, savePath);

        logger.info(`Exported ${passengers.length} passengers to ${savePath}`);
        return { ok: true, count: passengers.length };
      } catch (err) {
        logger.error(`Export failed: ${err.message}`);
        return { ok: false, message: `Export failed: ${err.message}` };
      }
    },

    /**
     * Manually toggle the entered status of a passenger
     * @param {{passport_number_normalized: string, entered: boolean}} args
     * @returns {Promise<{ok: boolean, message?: string}>}
     */
    toggleEntered: async (args) => {
      try {
        const { passport_number_normalized, entered } = args;
        const state = store.getState();
        const passenger = (state.manifest || []).find(p => p.passport_number_normalized === passport_number_normalized);

        if (!passenger) {
          return { ok: false, message: 'Passenger not found' };
        }

        const { makeBoardingRecord, makeScanEvent } = require('../../shared/entities');

        store.mutate(draft => {
          if (entered) {
            // Create manual boarding record
            const record = makeBoardingRecord({
              passenger_id: passenger.id,
              passport_number_normalized,
              via: 'manual-toggle'
            });
            draft.boarding_records[passport_number_normalized] = record;

            // Write manual entry event
            draft.scan_events.push(makeScanEvent({
              outcome: 'manual-entered',
              mode: 'manual',
              passport_number_normalized,
              passenger_id: passenger.id
            }));
          } else {
            // Remove boarding record
            delete draft.boarding_records[passport_number_normalized];

            // Write undone event
            draft.scan_events.push(makeScanEvent({
              outcome: 'operator-undone',
              mode: 'manual',
              passport_number_normalized,
              passenger_id: passenger.id
            }));
          }
        });

        rebuildIndices(store.getState());
        logger.info(`Manual toggle: ${passport_number_normalized} set to ${entered}`);
        return { ok: true };
      } catch (err) {
        logger.error(`Toggle failed: ${err.message}`);
        return { ok: false, message: err.message };
      }
    }
  };
  return handlers;
}

module.exports = { createManifestHandlers };
