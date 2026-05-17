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

  // If already ISO string format, return as-is
  if (typeof excelDate === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(excelDate)) {
      return excelDate;
    }
    // Try parsing as date string
    const parsed = new Date(excelDate);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
    return null;
  }

  // Handle Excel serial number
  if (typeof excelDate === 'number') {
    // Excel epoch is 1900-01-01, but it has a leap year bug (1900 was not a leap year)
    // We account for this by adjusting
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
function validateRow(row, rowIndex, requirements) {
  const errors = [];
  const result = {
    rowIndex,
    source: 'manifest',
    errors: [],
    outcome: 'Pass'
  };

  // Required fields
  const passportNumber = String(row.passport_number || '').trim();
  const name = String(row.name || '').trim();
  const genderRaw = row.gender;
  const nationalityRaw = String(row.nationality || '').trim().toUpperCase();
  const dobRaw = row.date_of_birth;

  // Optional fields
  const vessel = row.vessel ? String(row.vessel).trim() : undefined;
  const seat = row.seat ? String(row.seat).trim() : undefined;

  const { validate } = require('../../shared/fieldRequirements');
  const validation = validate(row, requirements);

  // Validate passport_number
  if (!passportNumber) {
    if (validation.missingRequired.includes('passportNumber')) {
      errors.push({
        rowIndex,
        field: 'passport_number',
        rule: 'required',
        message: 'Passport number is required'
      });
    }
  } else {
    const normalized = normalizePassportNumber(passportNumber);
    if (normalized.length < 5) {
      errors.push({
        rowIndex,
        field: 'passport_number',
        rule: 'min_length',
        message: 'Normalized passport number must be at least 5 characters'
      });
    } else {
      result.passport_number = passportNumber;
      result.passport_number_normalized = normalized;
    }
  }

  // Validate name
  if (!name) {
    if (validation.missingRequired.includes('familyName') || validation.missingRequired.includes('givenName')) {
      errors.push({
        rowIndex,
        field: 'name',
        rule: 'required',
        message: 'Full name is required'
      });
    }
  } else {
    result.name = name;
  }

  // Validate gender
  const normalizedGender = normalizeGender(genderRaw);
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
  if (!nationalityRaw) {
    if (validation.missingRequired.includes('nationality')) {
      errors.push({
        rowIndex,
        field: 'nationality',
        rule: 'required',
        message: 'Nationality is required'
      });
    }
  } else if (nationalityRaw.length !== 3) {
    errors.push({
      rowIndex,
      field: 'nationality',
      rule: 'invalid_format',
      message: 'Nationality must be a 3-letter ISO code (e.g., EGY)'
    });
  } else if (!VALID_NATIONALITIES.has(nationalityRaw)) {
    errors.push({
      rowIndex,
      field: 'nationality',
      rule: 'unknown_code',
      message: `Unknown nationality code: ${nationalityRaw}`
    });
  } else {
    result.nationality = nationalityRaw;
  }

  // Validate date_of_birth
  const parsedDob = parseExcelDate(dobRaw);
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
function parseTxtFile(filePath, requirements) {
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

    records.forEach((lines, idx) => {
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
        rows.push(failed);
        parseErrors.push(...failed.errors);
        return;
      }

      const fullName = [mrz.surname, mrz.given_names].filter(Boolean).join(' ').trim();
      const mappedRow = {
        passport_number: mrz.document_number,
        name: fullName,
        gender: mrz.sex,
        nationality: mrz.nationality,
        date_of_birth: mrz.date_of_birth
      };

      const validation = validateRow(mappedRow, rowIndex, requirements);

      if (validation.outcome === 'Pass' && validation.passport_number_normalized) {
        const normalized = validation.passport_number_normalized;
        if (duplicateNormalized.has(normalized)) {
          duplicateNormalized.get(normalized).push(rowIndex);
        } else {
          duplicateNormalized.set(normalized, [rowIndex]);
        }
      }

      rows.push(validation);
      if (validation.outcome === 'Error') {
        parseErrors.push(...validation.errors);
      }
    });

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
 * Dispatches by extension: .txt → MRZ parser, otherwise Excel.
 * @param {string} filePath - Path to .xlsx, .xls, or .txt file
 * @param {Object} [requirements] - Field requirements map
 * @returns {Object} - { rows: ParsedRow[], errors: ImportError[], duplicates: string[] }
 */
function parseFile(filePath, requirements) {
  if (path.extname(filePath).toLowerCase() === '.txt') {
    return parseTxtFile(filePath, requirements);
  }
  try {
    const workbook = XLSX.readFile(filePath, { cellDates: true });
    const sheetName = workbook.SheetNames[0]; // Use first sheet
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }); // Get as array of arrays

    if (data.length < 2) {
      // Header + at least 1 data row
      return {
        rows: [],
        errors: [{ message: 'File must contain at least one data row (plus header)' }],
        duplicates: []
      };
    }

    const headers = data[0];
    const headerMap = mapHeaders(headers);

    // Check required columns
    const missingRequired = ['passport_number', 'name', 'gender', 'nationality', 'date_of_birth']
      .filter(col => !(col in headerMap));

    if (missingRequired.length > 0) {
      return {
        rows: [],
        errors: [{ message: `Missing required columns: ${missingRequired.join(', ')}` }],
        duplicates: []
      };
    }

    // Parse data rows
    const rows = [];
    const duplicateNormalized = new Map(); // Track duplicates
    const parseErrors = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      // Skip empty rows
      if (!row || row.every(cell => !cell)) continue;

      // Map row data to canonical object
      const mappedRow = {};
      for (const [canonical, colIndex] of Object.entries(headerMap)) {
        if (colIndex !== undefined && colIndex < row.length) {
          mappedRow[canonical] = row[colIndex];
        }
      }

      const validation = validateRow(mappedRow, i, requirements); // 1-based row numbering

      // Check for duplicates (only for passing rows)
      if (validation.outcome === 'Pass' && validation.passport_number_normalized) {
        const normalized = validation.passport_number_normalized;
        if (duplicateNormalized.has(normalized)) {
          duplicateNormalized.get(normalized).push(i);
        } else {
          duplicateNormalized.set(normalized, [i]);
        }
      }

      rows.push(validation);

      if (validation.outcome === 'Error') {
        parseErrors.push(...validation.errors);
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
      errors: [{ message: `File parsing failed: ${err.message}` }],
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
