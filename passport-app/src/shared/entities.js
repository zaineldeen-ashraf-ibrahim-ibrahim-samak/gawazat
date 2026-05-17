const { v4: uuidv4 } = require('uuid');

/**
 * @typedef {Object} Voyage
 * @property {string} id
 * @property {string} ship_name
 * @property {string} port_name
 * @property {string} imported_at - ISO datetime
 */

/**
 * @typedef {Object} Passenger
 * @property {string} id
 * @property {string} passport_number
 * @property {string} passport_number_normalized
 * @property {string} name
 * @property {string} gender - 'M' or 'F'
 * @property {string} nationality - ISO 3166-1 alpha-3
 * @property {string} date_of_birth - ISO date
 * @property {string} [vessel]
 * @property {string} [seat]
 * @property {string} source - 'manifest' or 'added-at-gate'
 */

/**
 * @typedef {Object} ScanEvent
 * @property {string} id
 * @property {string} voyage_id
 * @property {string} at - ISO datetime
 * @property {string} mode - 'keyboard' or 'api'
 * @property {string} outcome - 'green'|'yellow'|'orange'|'read-failed'|'operator-undone'|'pending-approved'|'pending-rejected'
 * @property {Object} mrz_fields
 * @property {string} [linked_passport_number_normalized]
 * @property {string} [linked_pending_id]
 */

/**
 * @typedef {Object} BoardingRecord
 * @property {string} passport_number_normalized
 * @property {string} voyage_id
 * @property {string} entered_at - ISO datetime
 * @property {string} via - 'auto'|'manual-toggle'|'pending-approval'
 * @property {string} last_scan_event_id
 */

/**
 * @typedef {Object} PendingApprovalEntry
 * @property {string} id
 * @property {string} voyage_id
 * @property {string} created_at - ISO datetime
 * @property {Object} mrz_fields
 * @property {string} state - 'awaiting'|'approved'|'rejected'
 * @property {string} [resolved_at]
 * @property {string} [resolution_event_id]
 */

/**
 * @typedef {Object} AppSettings
 * @property {string} scan_mode - 'keyboard' or 'api'
 * @property {string} regula_url
 * @property {number} regula_poll_ms
 * @property {string} ship_name
 * @property {string} port_name
 * @property {number} auto_reset_seconds
 * @property {boolean} sound_enabled
 * @property {string} language - 'ar' or 'en'
 * @property {number} retention_days
 */

function makeVoyage(shipName = '', portName = 'Port Said') {
  return {
    id: uuidv4(),
    ship_name: shipName,
    port_name: portName,
    imported_at: new Date().toISOString(),
  };
}

function makePassenger(data = {}) {
  return {
    id: uuidv4(),
    passport_number: data.passport_number || '',
    passport_number_normalized: data.passport_number_normalized || '',
    name: data.name || '',
    gender: data.gender || 'M',
    nationality: data.nationality || '',
    date_of_birth: data.date_of_birth || '',
    vessel: data.vessel || '',
    seat: data.seat || '',
    source: data.source || 'manifest',
    duplicateFlag: data.duplicateFlag || 'unique',
  };
}

function makeScanEvent(data = {}) {
  return {
    id: uuidv4(),
    voyage_id: data.voyage_id || '',
    at: new Date().toISOString(),
    mode: data.mode || 'keyboard',
    outcome: data.outcome || 'read-failed',
    mrz_fields: data.mrz_fields || {},
    passport_number_normalized: data.passport_number_normalized || null,
    passenger_id: data.passenger_id || null,
    linked_passport_number_normalized: data.linked_passport_number_normalized || null,
    linked_pending_id: data.linked_pending_id || null,
  };
}

function makeBoardingRecord(data = {}) {
  return {
    passenger_id: data.passenger_id || '',
    passport_number_normalized: data.passport_number_normalized || '',
    voyage_id: data.voyage_id || '',
    entered_at: new Date().toISOString(),
    via: data.via || 'auto',
    last_scan_event_id: data.scan_event_id || data.last_scan_event_id || '',
  };
}

function makePendingApprovalEntry(data = {}) {
  return {
    id: uuidv4(),
    voyage_id: data.voyage_id || '',
    created_at: new Date().toISOString(),
    passport_number_normalized: data.passport_number_normalized || '',
    scan_event_id: data.scan_event_id || '',
    mrz_fields: data.mrz_fields || {},
    state: 'awaiting',
    resolved_at: null,
    resolution_event_id: null,
  };
}

function makeAppSettings() {
  return {
    scan_mode: 'keyboard',
    regula_url: 'http://localhost:8080',
    regula_poll_ms: 500,
    penta_url: 'http://localhost:8085',
    penta_poll_ms: 500,
    ship_name: '',
    port_name: 'Port Said',
    auto_reset_seconds: 3,
    sound_enabled: true,
    language: 'ar',
    retention_days: 30,
    api_server_path: '/import/mrz',
    watch_file_enabled: false,
    watch_file_path: '',
  };
}

module.exports = {
  makeVoyage,
  makePassenger,
  makeScanEvent,
  makeBoardingRecord,
  makePendingApprovalEntry,
  makeAppSettings,
};
