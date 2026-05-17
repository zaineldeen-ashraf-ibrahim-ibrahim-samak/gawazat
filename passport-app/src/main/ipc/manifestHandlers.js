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
     * Import Excel manifest files
     * @param {{filePaths: string[]}} args - Paths to Excel files
     * @returns {Promise<{ok: boolean, voyage?: Voyage, passengers?: Passenger[], errors?: ImportError[], message?: string}>}
     */
    import: async (args) => {
      try {
        const { filePaths } = args;
        if (!filePaths || !Array.isArray(filePaths) || filePaths.length === 0) {
          return { ok: false, message: 'Invalid file paths' };
        }

        const state = store.getState();
        const existingManifest = state.manifest || [];
        const { detect } = require('../services/duplicateMatcher');
        const { ReasonCodes } = require('../../shared/reasonCodes');

        let inserted = 0;
        let duplicatesBlocked = 0;
        let fuzzyPrompted = 0;
        const fuzzyPrompts = [];
        const rowErrors = [];
        let allPassingRowsMap = new Map();

        for (const filePath of filePaths) {
          const parseResult = parseFile(filePath, state.settings?.fieldRequirements);
          
          for (const err of parseResult.errors) {
            rowErrors.push({ rowIndex: err.rowIndex, reason: 'IMPORT_JSON_BAD_ELEMENT', message: err.message }); // simplistic mapping
          }
          
          const passingRows = parseResult.rows.filter(r => r.outcome === 'Pass');
          for (const row of passingRows) {
            // First check within this batch
            if (allPassingRowsMap.has(row.passport_number_normalized)) {
              duplicatesBlocked++;
              rowErrors.push({ rowIndex: row.rowIndex, reason: 'DUPLICATE_PASSPORT' });
              continue;
            }

            const normalizedPassenger = {
              passportNumberKey: row.passport_number_normalized,
              name: row.name,
              dob: row.date_of_birth,
              nationality: row.nationality
            };

            const duplicateMatch = detect(normalizedPassenger);

            if (duplicateMatch.kind === 'exact') {
              duplicatesBlocked++;
              rowErrors.push({ rowIndex: row.rowIndex, reason: 'DUPLICATE_PASSPORT' });
            } else if (duplicateMatch.kind === 'fuzzy') {
              fuzzyPrompted++;
              const existingPassenger = store.getState().manifest.find(p => p.id === duplicateMatch.existingPassengerId);
              fuzzyPrompts.push({
                rowIndex: row.rowIndex,
                raw: row,
                match: duplicateMatch,
                existingPassenger
              });
            } else {
              allPassingRowsMap.set(row.passport_number_normalized, row);
            }
          }
        }

        const passengersToInsert = Array.from(allPassingRowsMap.values()).map(row => {
          const p = makePassenger({
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
          if (row.missingOptionalFields?.length > 0) {
            p.missingOptionalFields = row.missingOptionalFields;
          }
          return p;
        });

        if (passengersToInsert.length > 0) {
          const settings = state.settings || {};
          const voyage = state.voyage || makeVoyage(settings.ship_name || '', settings.port_name || 'Port Said');
          
          store.mutate((draft) => {
            if (!draft.voyage) draft.voyage = voyage;
            if (!draft.manifest) draft.manifest = [];
            draft.manifest.push(...passengersToInsert);
          });
          
          rebuildIndices(store.getState());
          inserted = passengersToInsert.length;
          logger.info(`Appended ${inserted} passengers for voyage ${store.getState().voyage?.id}`);
        }

        return {
          inserted,
          duplicatesBlocked,
          fuzzyPrompted,
          fuzzyPrompts,
          rowErrors,
          ok: true
        };
      } catch (err) {
        logger.error(`Import failed: ${err.message}`);
        return { ok: false, message: `Import failed: ${err.message}` };
      }
    },

    /**
     * Preview Excel manifest files without importing
     * @param {{filePaths: string[]}} args
     */
    preview: async (args) => {
      try {
        const { filePaths } = args;
        if (!filePaths || !Array.isArray(filePaths)) {
           return { ok: false, message: 'Invalid file paths' };
        }

        const state = store.getState();
        const existingManifest = state.manifest || [];
        const existingPassports = new Set(existingManifest.map(p => p.passport_number_normalized));

        let allPassingRowsMap = new Map();
        let allErrors = [];

        for (const filePath of filePaths) {
          const parseResult = parseFile(filePath);
          
          const fileErrors = parseResult.errors.map(e => ({
            ...e,
            message: `[${path.basename(filePath)}] ${e.message}`
          }));
          
          allErrors.push(...fileErrors);
          
          const passingRows = parseResult.rows.filter(r => r.outcome === 'Pass');
          for (const row of passingRows) {
            // Deduplicate across files AND existing passenger manifests
            if (existingPassports.has(row.passport_number_normalized) || allPassingRowsMap.has(row.passport_number_normalized)) {
              allErrors.push({
                rowIndex: row.rowIndex,
                field: 'passport_number',
                rule: 'duplicate_file',
                fileName: path.basename(filePath),
                passportRaw: row.passport_number,
                message: `[${path.basename(filePath)}] Duplicate passport number (${row.passport_number}) ignored.`
              });
            } else {
              allPassingRowsMap.set(row.passport_number_normalized, row);
            }
          }
        }

        const allPassingRows = Array.from(allPassingRowsMap.values());

        return {
          ok: true,
          passengers: allPassingRows,
          errors: allErrors
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
            'Passport Number',     // passport_number
            'Name',                // name
            'Gender',              // gender
            'Nationality',         // nationality
            'Date of Birth',       // date_of_birth
            'Vessel',              // vessel (optional)
            'Seat'                 // seat (optional)
          ],
          // One sample row for reference
          [
            'EG123456',
            'John Doe',
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
          ['Field', 'Format', 'Notes', ''],
          ['Passport Number', 'Text, ≥5 chars', 'Required', ''],
          ['Name', 'Text', 'Required', ''],
          ['Gender', 'M/F, Male/Female, or Arabic equivalent', 'Required', ''],
          ['Nationality', 'ISO 3-letter code (e.g., EGY)', 'Required', ''],
          ['Date of Birth', 'YYYY-MM-DD or Excel Date', 'Required, must be in past', ''],
          ['Vessel', 'Text', 'Optional', ''],
          ['Seat', 'Text', 'Optional', '']
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
        } else if (filter === 'new') {
          results = results.filter(p => p.source === 'added-at-gate');
        } else if (filter === 'M' || filter === 'F') {
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
        const headers = [
          'Passport Number',
          'Name',
          'Gender',
          'Nationality',
          'DOB',
          'Vessel',
          'Seat',
          'Status',
          'Entered At'
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
            p.is_entered ? 'Entered' : 'Waiting',
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
    deletePassenger: async (args) => {
      try {
        const { passport_number_normalized } = args;
        store.mutate(draft => {
          draft.manifest = (draft.manifest || []).filter(p => p.passport_number_normalized !== passport_number_normalized);
          delete draft.boarding_records[passport_number_normalized];
        });
        rebuildIndices(store.getState());
        logger.info(`Deleted passenger: ${passport_number_normalized}`);
        return { ok: true };
      } catch (err) {
        logger.error(`Delete failed: ${err.message}`);
        return { ok: false, message: err.message };
      }
    },

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
