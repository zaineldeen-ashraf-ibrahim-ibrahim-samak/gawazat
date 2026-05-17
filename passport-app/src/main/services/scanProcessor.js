/**
 * Scan Processor Service
 * Handles the logic of matching a scan against the manifest and boarding records.
 */

const { parseMrz } = require('../../shared/mrz');
const { normalizePassportNumber } = require('../../shared/normalize');
const { makeScanEvent, makeBoardingRecord, makePendingApprovalEntry } = require('../../shared/entities');
const { getIndices, rebuildIndices } = require('../store/indices');
const logger = require('./logger');

/**
 * Process an MRZ scan result
 * @param {Object} store - EncryptedStore instance
 * @param {string} rawMrz - Raw MRZ text from reader
 * @param {'api'|'keyboard'} mode - Scan mode
 * @returns {Promise<Object>} ScanResult
 */
async function processMrz(store, rawMrz, mode = 'keyboard') {
  try {
    // 1. Parse MRZ
    const parsed = parseMrz(rawMrz);
    
    // 2. If read failed (invalid format or check digits)
    if (!parsed || parsed.type === 'UNKNOWN' || (parsed.check_digits_valid === false)) {
      const event = makeScanEvent({
        outcome: 'read-failed',
        mode,
        raw_data: rawMrz,
        mrz_fields: parsed
      });
      
      store.mutate(draft => {
        draft.scan_events.push(event);
      });
      
      return {
        outcome: 'read-failed',
        scan_event_id: event.id,
        passenger: null,
        mrz_fields: parsed
      };
    }

    // 3. Normalize passport number
    const normalized = normalizePassportNumber(parsed.document_number);
    
    const nameStr = [parsed.surname, parsed.given_names].filter(Boolean).join(' ');
    const normalizedPassenger = {
      passportNumberKey: normalized,
      name: nameStr,
      dob: parsed.date_of_birth,
      nationality: parsed.nationality
    };

    const { detect } = require('./duplicateMatcher');
    const duplicateMatch = detect(normalizedPassenger);

    if (duplicateMatch.kind === 'exact') {
      const scanEvent = makeScanEvent({
        outcome: 'orange',
        mode,
        passport_number_normalized: normalized,
        passenger_id: duplicateMatch.existingPassengerId,
        raw_data: rawMrz,
        mrz_fields: parsed
      });
      store.mutate(draft => draft.scan_events.push(scanEvent));
      
      return {
        outcome: 'rejected',
        reason: 'DUPLICATE_PASSPORT',
        scan_event_id: scanEvent.id,
        passenger: null,
        mrz_fields: parsed,
        duplicateMatch
      };
    } else if (duplicateMatch.kind === 'fuzzy') {
      const existingPassenger = store.getState().manifest.find(p => p.id === duplicateMatch.existingPassengerId);
      return {
        outcome: 'fuzzy',
        scan_event_id: null,
        passenger: null,
        mrz_fields: parsed,
        normalizedPassenger,
        duplicateMatch,
        existingPassenger
      };
    }

    // 4. Lookup in manifest and boarding records
    const { manifestByNormalized, boardingByNormalized } = getIndices();
    const passenger = manifestByNormalized.get(normalized);
    const existingBoarding = boardingByNormalized.get(normalized);

    let outcome = 'yellow'; // Default: Unknown (Pending Approval)
    let scanEventId = null;
    let pendingId = null;
    let firstEnteredAt = null;

    if (passenger) {
      if (existingBoarding) {
        outcome = 'orange'; // Duplicate
        firstEnteredAt = existingBoarding.entered_at;
      } else {
        outcome = 'green'; // Match
      }
    } else {
      const currentState = store.getState();
      const existingPending = (currentState.pending_approval || []).find(
        e => e.passport_number_normalized === normalized && e.state === 'awaiting'
      );
      if (existingPending) {
        outcome = 'orange'; // Already pending
        firstEnteredAt = existingPending.created_at;
        pendingId = existingPending.id;
      } else {
        // T063: Consult settings.fieldRequirements before creating pending entry
        const { validate } = require('../../shared/fieldRequirements');
        const reqs = currentState.settings?.fieldRequirements;
        const validation = validate(parsed, reqs);
        if (!validation.valid) {
          outcome = 'read-failed';
          const event = makeScanEvent({
            outcome: 'read-failed',
            mode,
            raw_data: rawMrz,
            mrz_fields: parsed
          });
          store.mutate(draft => draft.scan_events.push(event));
          return {
            outcome: 'read-failed',
            reason: 'REQUIRED_FIELD_MISSING',
            scan_event_id: event.id,
            passenger: null,
            mrz_fields: parsed,
            missingRequired: validation.missingRequired
          };
        }
      }
    }

    // 5. Create Scan Event
    const scanEvent = makeScanEvent({
      outcome,
      mode,
      passport_number_normalized: normalized,
      passenger_id: passenger ? passenger.id : null,
      raw_data: rawMrz,
      mrz_fields: parsed
    });
    scanEventId = scanEvent.id;

    // 6. Mutate store based on outcome
    store.mutate(draft => {
      draft.scan_events.push(scanEvent);

      if (outcome === 'green') {
        const boardingRecord = makeBoardingRecord({
          passenger_id: passenger.id,
          passport_number_normalized: normalized,
          scan_event_id: scanEvent.id,
          via: 'auto'
        });
        draft.boarding_records[normalized] = boardingRecord;
      } else if (outcome === 'yellow') {
        const { validate } = require('../../shared/fieldRequirements');
        const reqs = store.getState().settings?.fieldRequirements;
        const validation = validate(parsed, reqs);

        const pendingEntry = makePendingApprovalEntry({
          scan_event_id: scanEvent.id,
          passport_number_normalized: normalized,
          mrz_fields: parsed,
          state: 'awaiting'
        });
        if (validation.missingOptional?.length > 0) {
          pendingEntry.missingOptionalFields = validation.missingOptional;
        }
        draft.pending_approval.push(pendingEntry);
        pendingId = pendingEntry.id;
      }
    });

    // 7. Rebuild indices so subsequent scans always see fresh boarding/pending state
    rebuildIndices(store.getState());

    logger.info(`Scan processed: ${outcome} for ${normalized}`);

    return {
      outcome,
      scan_event_id: scanEventId,
      passenger: passenger || null,
      mrz_fields: parsed,
      first_entered_at: firstEnteredAt,
      pending_id: pendingId
    };

  } catch (err) {
    logger.error(`Error processing MRZ: ${err.message}`);
    throw err;
  }
}

module.exports = { processMrz };
