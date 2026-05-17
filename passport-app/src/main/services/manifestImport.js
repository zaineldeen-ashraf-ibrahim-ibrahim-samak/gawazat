/**
 * Manifest Import Service
 * Parses and validates Excel files containing passenger manifests
 * Contract: specs/001-seaport-passport-scanner/contracts/excel-manifest.md
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { normalizePassportNumber } = require('../../shared/normalize');
const { parseMrz } = require('../../shared/mrz');

/**
 * @typedef {Object} ImportError
 * @property {number} rowIndex - 1-based row number
 * @property {string} field - Column name where error occurred
 * @property {string} rule - Validation rule violated
 * @property {string} message - User-friendly error message
 */

/**
 * @typedef {Object} ParsedRow
 * @property {number} rowIndex - 1-based row number
 * @property {string} passport_number - Raw passport number
 * @property {string} passport_number_normalized - Normalized passport number
 * @property {string} name - Full name
 * @property {string} gender - M or F
 * @property {string} nationality - ISO 3166-1 alpha-3 code
 * @property {string} date_of_birth - ISO 8601 date (YYYY-MM-DD)
 * @property {string} [vessel] - Optional vessel name
 * @property {string} [seat] - Optional seat number
 * @property {string} source - Always 'manifest'
 * @property {'Pass'|'Warn'|'Error'} outcome - Validation outcome
 * @property {ImportError[]} errors - Any validation errors for this row
 */

/**
 * Valid ISO 3166-1 alpha-3 nationality codes
 * (Common ones for port context)
 */
const VALID_NATIONALITIES = new Set([
  'AFG', 'ALB', 'DZA', 'AND', 'AGO', 'AIA', 'ATA', 'ATG', 'ARG', 'ARM', 'ABW', 'AUS', 'AUT',
  'AZE', 'BHS', 'BHR', 'BGD', 'BRB', 'BLR', 'BEL', 'BLZ', 'BEN', 'BMU', 'BTN', 'BOL', 'BIH',
  'BWA', 'BRA', 'IOT', 'BRN', 'BGR', 'BFA', 'BDI', 'KHM', 'CMR', 'CAN', 'CPV', 'CYM', 'CAF',
  'TCD', 'CHL', 'CHN', 'CXR', 'CCK', 'COL', 'COM', 'COG', 'COK', 'CRI', 'HRV', 'CUB', 'CYP',
  'CZE', 'DNK', 'DJI', 'DMA', 'DOM', 'ECU', 'EGY', 'SLV', 'GNQ', 'ERI', 'EST', 'ETH', 'FLK',
  'FRO', 'FJI', 'FIN', 'FRA', 'GUF', 'PYF', 'ATF', 'GAB', 'GMB', 'GEO', 'DEU', 'GHA', 'GIB',
  'GRC', 'GRL', 'GRD', 'GLP', 'GUM', 'GTM', 'GGY', 'GIN', 'GNB', 'GUY', 'HTI', 'HND', 'HKG',
  'HUN', 'ISL', 'IND', 'IDN', 'IRN', 'IRQ', 'IRL', 'IMN', 'ISR', 'ITA', 'CIV', 'JAM', 'JPN',
  'JEY', 'JOR', 'KAZ', 'KEN', 'KIR', 'PRK', 'KOR', 'KWT', 'KGZ', 'LAO', 'LVA', 'LBN', 'LSO',
  'LBR', 'LBY', 'LIE', 'LTU', 'LUX', 'MAC', 'MKD', 'MDG', 'MWI', 'MYS', 'MDV', 'MLI', 'MLT',
  'MHL', 'MTQ', 'MRT', 'MUS', 'MAY', 'MEX', 'FSM', 'MDA', 'MCO', 'MNG', 'MNE', 'MAR', 'MOZ',
  'MMR', 'NAM', 'NRU', 'NPL', 'NLD', 'ANT', 'NCL', 'NZL', 'NIC', 'NER', 'NGA', 'NIU', 'NFK',
  'MNP', 'NOR', 'OMN', 'PAK', 'PLW', 'PSE', 'PAN', 'PNG', 'PRY', 'PER', 'PHL', 'PCN', 'POL',
  'PRT', 'PRI', 'QAT', 'REU', 'ROU', 'RUS', 'RWA', 'BLM', 'KNA', 'LCA', 'MAF', 'SPM', 'VCT',
  'WSM', 'SMR', 'STP', 'SAU', 'SEN', 'SRB', 'SYC', 'SLE', 'SGP', 'SVK', 'SVN', 'SLB', 'SOM',
  'ZAF', 'SSD', 'ESP', 'LKA', 'SDN', 'SUR', 'SWZ', 'SWE', 'CHE', 'SYR', 'TWN', 'TJK', 'TZA',
  'THA', 'TLS', 'TGO', 'TKL', 'TON', 'TTO', 'TUN', 'TUR', 'TKM', 'TCA', 'TUV', 'UGA', 'UKR',
  'ARE', 'GBR', 'USA', 'URY', 'UZB', 'VUT', 'VAT', 'VEN', 'VNM', 'VGB', 'VIR', 'WLF', 'ESH',
  'YEM', 'ZMB', 'ZWE', 'XKX' // XKX = Kosovo (unofficial)
]);

// Column name mappings: Arabic and English aliases
const COLUMN_ALIASES = {
  passport_number: [
    'passport_number', 'passport number', 'رقم الجواز', 'رقم جواز'
  ],
  name: [
    'name', 'full name', 'الاسم', 'الاسم الكامل', 'full_name'
  ],
  gender: [
    'gender', 'النوع', 'الجنس'
  ],
  nationality: [
    'nationality', 'الجنسية', 'country'
  ],
  date_of_birth: [
    'date_of_birth', 'dob', 'تاريخ الميلاد', 'date of birth'
  ],
  vessel: [
    'vessel', 'ship', 'السفينة'
  ],
  seat: [
    'seat', 'المقعد'
  ]
};

/**
 * Map header row to canonical column names
 * @param {string[]} headers - Raw header row from Excel
 * @returns {Object} - Map of canonical names to column indices
 */
function mapHeaders(headers) {
  const result = {};
  const headerLower = headers.map(h => String(h || '').trim().toLowerCase());

  for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (let i = 0; i < headerLower.length; i++) {
      if (aliases.some(alias => headerLower[i] === alias.toLowerCase())) {
        result[canonical] = i;
        break; // Use first match
      }
    }
  }

  return result;
}

/**
 * Normalize gender value to M or F
 * @param {string} value - Raw gender value
 * @returns {string|null} - 'M' or 'F', or null if invalid
 */
function normalizeGender(value) {
  if (!value) return null;
  const normalized = String(value).trim().toUpperCase();
  if (normalized === 'M' || normalized === 'MALE' || normalized === 'ذكر') return 'M';
  if (normalized === 'F' || normalized === 'FEMALE' || normalized === 'أنثى') return 'F';
  return null;
}

/**
 * Parse an Excel date serial to ISO date string
 * Excel stores dates as serial numbers: 1 = Jan 1, 1900
 * @param {number|string} excelDate - Excel date serial or string
 * @returns {string|null} - ISO date (YYYY-MM-DD) or null if invalid
 */
function parseExcelDate(excelDate) {
  if (!excelDate) return null;

  // Date object (xlsx with cellDates:true returns these). Use UTC to dodge
  // timezone drift — the date itself, not the wall-clock interpretation,
  // is what matters for a date of birth.
  if (excelDate instanceof Date && !isNaN(excelDate.getTime())) {
    return excelDate.toISOString().split('T')[0];
  }

  if (typeof excelDate === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(excelDate)) {
      return excelDate;
    }
    const parsed = new Date(excelDate);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
    return null;
  }

  if (typeof excelDate === 'number') {
    // Excel epoch is 1900-01-01 with the well-known leap-year bug; the -1
    // here compensates for the off-by-one introduced by that.
    const excelEpoch = new Date(1900, 0, 1);
    const jsDate = new Date(excelEpoch.getTime() + (excelDate - 1) * 24 * 60 * 60 * 1000);
    return jsDate.toISOString().split('T')[0];
  }

  return null;
}

/**
 * Validate a parsed row
 * @param {Object} row - Row object with canonical column names
 * @param {number} rowIndex - 1-based row number
 * @param {Object} [requirements] - Field requirements map
 * @returns {Object} - { outcome: 'Pass'|'Warn'|'Error', errors: ImportError[], row: ParsedRow }
 */
async function validateRow(row, rowIndex, requirements, preNormalized) {
  const errors = [];
  const result = {
    rowIndex,
    source: 'manifest',
    errors: [],
    outcome: 'Pass'
  };

  // Extract raw fields
  const passportNumber = String(row.passport_number || '').trim();
  const name = String(row.name || '').trim();
  const genderRaw = row.gender;
  const nationalityRaw = String(row.nationality || '').trim();
  const dobRaw = row.date_of_birth;

  // Use the pre-computed normalize result when provided (batch-AI path), else
  // fall back to a per-row call. Either way `normalizedData` ends up populated.
  let normalizeRes = preNormalized;
  if (!normalizeRes) {
    const { createNormalizeHandlers } = require('../ipc/normalizeHandlers');
    const normalizeHandlers = createNormalizeHandlers({});
    normalizeRes = await normalizeHandlers.normalizePassenger({}, row);
  }
  const normalizedData = normalizeRes.normalized || {};

  result.normalizationSource = normalizeRes.source;
  result.normalizationConfidence = normalizeRes.confidence;
  result.normalizationWarnings = normalizeRes.warnings;

  // Optional fields
  const vessel = row.vessel ? String(row.vessel).trim() : undefined;
  const seat = row.seat ? String(row.seat).trim() : undefined;

  const { validate } = require('../../shared/fieldRequirements');
  const validation = validate(normalizedData, requirements);

  // Validate passport_number
  if (!passportNumber && !normalizedData.passportNumber) {
    if (validation.missingRequired.includes('passportNumber')) {
      errors.push({
        rowIndex,
        field: 'passport_number',
        rule: 'required',
        message: 'Passport number is required'
      });
    }
  } else {
    const normalized = normalizedData.passportNumber || normalizePassportNumber(passportNumber);
    if (normalized.length < 5) {
      errors.push({
        rowIndex,
        field: 'passport_number',
        rule: 'min_length',
        message: 'Normalized passport number must be at least 5 characters'
      });
    } else {
      result.passport_number = passportNumber || normalizedData.passportNumber;
      result.passport_number_normalized = normalized;
    }
  }

  // Validate name
  if (!name && !normalizedData.name && !normalizedData.familyName && !normalizedData.givenName) {
    if (validation.missingRequired.includes('name')) {
      errors.push({
        rowIndex,
        field: 'name',
        rule: 'required',
        message: 'Full name is required'
      });
    }
  } else {
    result.name = normalizedData.name || [normalizedData.familyName, normalizedData.givenName].filter(Boolean).join(' ') || name;
  }

  // Validate gender
  const normalizedGender = normalizeGender(normalizedData.gender || genderRaw);
  if (!normalizedGender) {
    if (validation.missingRequired.includes('gender')) {
      errors.push({
        rowIndex,
        field: 'gender',
        rule: 'invalid_value',
        message: 'Gender must be M/F, Male/Female, or ذكر/أنثى'
      });
    }
  } else {
    result.gender = normalizedGender;
  }

  // Validate nationality
  const nat = normalizedData.nationality || nationalityRaw;
  if (!nat) {
    if (validation.missingRequired.includes('nationality')) {
      errors.push({
        rowIndex,
        field: 'nationality',
        rule: 'required',
        message: 'Nationality is required'
      });
    }
  } else if (nat.length !== 3) {
    errors.push({
      rowIndex,
      field: 'nationality',
      rule: 'invalid_format',
      message: 'Nationality must be a 3-letter ISO code (e.g., EGY)'
    });
  } else if (!VALID_NATIONALITIES.has(nat)) {
    errors.push({
      rowIndex,
      field: 'nationality',
      rule: 'unknown_code',
      message: `Unknown nationality code: ${nat}`
    });
  } else {
    result.nationality = nat;
  }

  // Validate date_of_birth
  const parsedDob = normalizedData.dob || parseExcelDate(dobRaw);
  if (!parsedDob) {
    if (validation.missingRequired.includes('dob')) {
      errors.push({
        rowIndex,
        field: 'date_of_birth',
        rule: 'invalid_format',
        message: 'Date of birth must be in YYYY-MM-DD format or valid Excel date, and must be in the past'
      });
    }
  } else {
    const dobDate = new Date(parsedDob);
    const now = new Date();
    // Check if date is in the past
    if (dobDate >= now) {
      errors.push({
        rowIndex,
        field: 'date_of_birth',
        rule: 'future_date',
        message: 'Date of birth must be in the past'
      });
    } else {
      result.date_of_birth = parsedDob;
    }
  }

  // Optional fields (warn if present but invalid)
  if (vessel) {
    result.vessel = vessel;
  }
  if (seat) {
    result.seat = seat;
  }

  if (validation.missingOptional?.length > 0) {
    result.missingOptionalFields = validation.missingOptional;
  }

  // Determine outcome
  if (errors.length > 0) {
    result.outcome = 'Error';
    result.errors = errors;
  } else if (Object.keys(result).filter(k => !['rowIndex', 'source', 'errors', 'outcome', 'missingOptionalFields'].includes(k)).length < 5) {
    result.outcome = 'Pass';
  }

  result.errors = errors;
  return result;
}

/**
 * Split a raw .txt buffer into MRZ records.
 * Records are separated by one or more blank lines; each record is the
 * 2 (TD3) or 3 (TD1) lines that parseMrz expects.
 */
function splitMrzRecords(text) {
  const records = [];
  let current = [];
  for (const rawLine of text.split(/\r?\n/)) {
    if (rawLine.trim() === '') {
      if (current.length > 0) {
        records.push(current);
        current = [];
      }
    } else {
      current.push(rawLine);
    }
  }
  if (current.length > 0) records.push(current);
  return records;
}

/**
 * Parse a .txt file containing MRZ records and validate each as a manifest row.
 * Emits the same shape as parseFile so downstream handlers do not need to care.
 * @param {string} filePath
 * @param {Object} [requirements]
 * @returns {Object} - { rows: ParsedRow[], errors: ImportError[], duplicates: string[] }
 */
async function parseTxtFile(filePath, requirements) {
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    const records = splitMrzRecords(text);

    if (records.length === 0) {
      return {
        rows: [],
        errors: [{ message: 'File contains no MRZ records' }],
        duplicates: []
      };
    }

    const rows = [];
    const duplicateNormalized = new Map();
    const parseErrors = [];

    // Pre-batch the MRZ-extracted rows through AI normalize (with local
    // fallback) just like the spreadsheet path. We build the raw rows first
    // so a single batch call covers the whole file.
    const preParsed = [];
    for (let idx = 0; idx < records.length; idx++) {
      const mrz = parseMrz(records[idx].join('\n'));
      if (mrz.type === 'UNKNOWN') {
        preParsed.push({ rowIndex: idx + 1, failed: true });
        continue;
      }
      const fullName = [mrz.surname, mrz.given_names].filter(Boolean).join(' ').trim();
      preParsed.push({
        rowIndex: idx + 1,
        mappedRow: {
          passport_number: mrz.document_number,
          name: fullName,
          gender: mrz.sex,
          nationality: mrz.nationality,
          date_of_birth: mrz.date_of_birth
        }
      });
    }

    const validRows = preParsed.filter(p => !p.failed);
    const BATCH_SIZE = 20;
    const { createNormalizeHandlers } = require('../ipc/normalizeHandlers');
    const normalizeHandlers = createNormalizeHandlers({});
    const batchResults = new Map();
    for (let start = 0; start < validRows.length; start += BATCH_SIZE) {
      const slice = validRows.slice(start, start + BATCH_SIZE);
      const batchRes = await normalizeHandlers.normalizePassengerBatch({}, slice.map(p => p.mappedRow));
      for (let j = 0; j < batchRes.length; j++) {
        batchResults.set(slice[j].rowIndex, batchRes[j]);
      }
    }

    // Parse MRZ first
    const rowPromises = records.map((lines, idx) => {
      const rowIndex = idx + 1;
      const mrz = parseMrz(lines.join('\n'));

      if (mrz.type === 'UNKNOWN') {
        const failed = {
          rowIndex,
          source: 'manifest',
          outcome: 'Error',
          errors: [{
            rowIndex,
            field: 'mrz',
            rule: 'invalid_format',
            message: 'Could not parse MRZ block (expected TD1 = 3×30 or TD3 = 2×44)'
          }]
        };
        return Promise.resolve({ failed, rowIndex });
      }

      const fullName = [mrz.surname, mrz.given_names].filter(Boolean).join(' ').trim();
      const mappedRow = {
        passport_number: mrz.document_number,
        name: fullName,
        gender: mrz.sex,
        nationality: mrz.nationality,
        date_of_birth: mrz.date_of_birth
      };

      return validateRow(mappedRow, rowIndex, requirements, batchResults.get(rowIndex))
        .then(validation => ({ validation, rowIndex }));
    });

    const results = await Promise.all(rowPromises);

    for (const res of results) {
      if (res.failed) {
        rows.push(res.failed);
        parseErrors.push(...res.failed.errors);
      } else if (res.validation) {
        const validation = res.validation;
        if (validation.outcome === 'Pass' && validation.passport_number_normalized) {
          const normalized = validation.passport_number_normalized;
          if (duplicateNormalized.has(normalized)) {
            duplicateNormalized.get(normalized).push(validation.rowIndex);
          } else {
            duplicateNormalized.set(normalized, [validation.rowIndex]);
          }
        }
        rows.push(validation);
        if (validation.outcome === 'Error') {
          parseErrors.push(...validation.errors);
        }
      }
    }

    const duplicates = [];
    for (const [normalized, rowIndices] of duplicateNormalized) {
      if (rowIndices.length > 1) {
        duplicates.push(normalized);
        for (const rowIdx of rowIndices) {
          const row = rows.find(r => r.rowIndex === rowIdx);
          if (row) {
            row.outcome = 'Error';
            row.errors.push({
              rowIndex: rowIdx,
              field: 'passport_number_normalized',
              rule: 'duplicate',
              message: `Duplicate passport number found in rows: ${rowIndices.join(', ')}`
            });
          }
        }
        parseErrors.push(...rowIndices.map(idx => ({
          rowIndex: idx,
          field: 'passport_number_normalized',
          rule: 'duplicate',
          message: `Duplicate passport number found in rows: ${rowIndices.join(', ')}`
        })));
      }
    }

    return { rows, errors: parseErrors, duplicates };
  } catch (err) {
    return {
      rows: [],
      errors: [{ message: `File parsing failed: ${err.message}` }],
      duplicates: []
    };
  }
}

/**
 * Parse a manifest file and validate its contents.
 * Dispatches by extension: .txt → MRZ parser, otherwise uses correct parser.
 * @param {string} filePath - Path to file
 * @param {Object} [requirements] - Field requirements map
 * @param {Object} [options]
 * @param {string} [options.sheetName] - For .xlsx/.xls: which sheet to read
 * @returns {Object} - { rows: ParsedRow[], errors: ImportError[], duplicates: string[] }
 */
async function parseFile(filePath, requirements, options = {}) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.txt') {
    return await parseTxtFile(filePath, requirements);
  }

  try {
    let rawRows = [];

    if (ext === '.xlsx' || ext === '.xls') {
      const { parseXlsx } = require('./importParsers/xlsx');
      rawRows = parseXlsx(filePath, options.sheetName);
    } else if (ext === '.csv') {
      const { parseCsv } = require('./importParsers/csv');
      rawRows = parseCsv(filePath);
    } else if (ext === '.json') {
      const { parseJson } = require('./importParsers/json');
      rawRows = parseJson(filePath);
    } else if (ext === '.pdf') {
      const { parsePdf } = require('./importParsers/pdf');
      rawRows = await parsePdf(filePath);
    } else {
      throw new Error(`Unsupported file type: ${ext}`);
    }

    if (rawRows.length === 0) {
      return {
        rows: [],
        errors: [{ message: 'File must contain at least one passenger record' }],
        duplicates: []
      };
    }

    // Parse data rows
    const duplicateNormalized = new Map(); // Track duplicates
    const parseErrors = [];

    // ── AI-first batched normalization ──
    // Send the parsed rows to Gemini in chunks; on any failure (or when no
    // API key is configured) each row falls back to the local normalizer.
    // This is faster than per-row AI calls and gives the model cross-row
    // context to spot misaligned columns / infer ISO codes from siblings.
    const BATCH_SIZE = 20;
    const { createNormalizeHandlers } = require('../ipc/normalizeHandlers');
    const normalizeHandlers = createNormalizeHandlers({});
    const normalizeResults = new Array(rawRows.length);
    for (let start = 0; start < rawRows.length; start += BATCH_SIZE) {
      const slice = rawRows.slice(start, start + BATCH_SIZE);
      const batchRes = await normalizeHandlers.normalizePassengerBatch({}, slice);
      for (let j = 0; j < batchRes.length; j++) {
        normalizeResults[start + j] = batchRes[j];
      }
    }

    const rowPromises = [];
    for (let i = 0; i < rawRows.length; i++) {
      const mappedRow = rawRows[i];
      const actualRowIndex = mappedRow._rowIndex || (i + 2);
      rowPromises.push(
        validateRow(mappedRow, actualRowIndex, requirements, normalizeResults[i])
          .then(validation => ({ validation, rowIndex: actualRowIndex }))
      );
    }

    const results = await Promise.all(rowPromises);
    const rows = [];

    for (const res of results) {
      if (res.validation) {
        const validation = res.validation;
        
        // Track duplicates
        if (validation.outcome === 'Pass' && validation.passport_number_normalized) {
          const normalized = validation.passport_number_normalized;
          if (duplicateNormalized.has(normalized)) {
            duplicateNormalized.get(normalized).push(validation.rowIndex);
          } else {
            duplicateNormalized.set(normalized, [validation.rowIndex]);
          }
        }

        rows.push(validation);

        // Collect errors
        if (validation.outcome === 'Error') {
          parseErrors.push(...validation.errors);
        }
      }
    }

    // Mark duplicates as errors
    const duplicates = [];
    for (const [normalized, rowIndices] of duplicateNormalized) {
      if (rowIndices.length > 1) {
        duplicates.push(normalized);
        // Add error to all duplicate rows
        for (const rowIdx of rowIndices) {
          const row = rows.find(r => r.rowIndex === rowIdx);
          if (row) {
            row.outcome = 'Error';
            row.errors.push({
              rowIndex: rowIdx,
              field: 'passport_number_normalized',
              rule: 'duplicate',
              message: `Duplicate passport number found in rows: ${rowIndices.join(', ')}`
            });
          }
        }
        parseErrors.push(...rowIndices.map(idx => ({
          rowIndex: idx,
          field: 'passport_number_normalized',
          rule: 'duplicate',
          message: `Duplicate passport number found in rows: ${rowIndices.join(', ')}`
        })));
      }
    }

    return {
      rows,
      errors: parseErrors,
      duplicates
    };
  } catch (err) {
    return {
      rows: [],
      errors: [{ message: err.message, code: err.code, rowIndex: err.rowIndex }],
      duplicates: []
    };
  }
}

module.exports = {
  parseFile,
  parseTxtFile,
  splitMrzRecords,
  validateRow,
  normalizeGender,
  parseExcelDate,
  mapHeaders,
  VALID_NATIONALITIES
};
