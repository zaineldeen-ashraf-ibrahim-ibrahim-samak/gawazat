const XLSX = require('xlsx');

// Allowed aliases for canonical keys
const HEADER_ALIASES = {
  passport_number: ['passport number', 'passport_number', 'passport', 'رقم الجواز', 'رقم الوثيقة', 'document number'],
  name: ['name', 'full name', 'passenger name', 'الاسم', 'اسم المسافر'],
  gender: ['gender', 'sex', 'الجنس', 'النوع'],
  nationality: ['nationality', 'الجنسية'],
  date_of_birth: ['date of birth', 'date_of_birth', 'dob', 'تاريخ الميلاد', 'الميلاد'],
  vessel: ['vessel', 'ship', 'الباخرة', 'السفينة'],
  seat: ['seat', 'cabin', 'رقم المقعد', 'المقعد', 'الكابينة']
};

/**
 * Normalizes header string for comparison
 */
function normalizeHeader(str) {
  if (!str || typeof str !== 'string') return '';
  return str.toLowerCase().replace(/[\s_*-]+/g, ' ').trim();
}

/**
 * Maps input headers to canonical schema keys
 * @param {string[]} headers - Raw header row from Excel
 * @returns {Object} Map of canonical_key -> index
 */
function mapHeaders(headers) {
  const mapping = {};
  const normalizedHeaders = headers.map(normalizeHeader);

  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const alias of aliases) {
      const idx = normalizedHeaders.findIndex(h => h === alias);
      if (idx !== -1) {
        mapping[canonical] = idx;
        break; // found the column for this canonical key
      }
    }
  }

  return mapping;
}

/**
 * List sheet names in an Excel file. Used by the renderer to prompt the
 * operator which tab to import when a workbook contains multiple sheets.
 * @param {string} filePath
 * @returns {string[]}
 */
function listSheets(filePath) {
  const workbook = XLSX.readFile(filePath, { bookSheets: true });
  return Array.isArray(workbook.SheetNames) ? workbook.SheetNames.slice() : [];
}

/**
 * Parse an Excel file (.xlsx, .xls) and return raw rows
 * @param {string} filePath
 * @param {string} [sheetName] - optional sheet to read; defaults to the first
 * @returns {Array<Object>}
 */
function parseXlsx(filePath, sheetName) {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const chosen = sheetName && workbook.SheetNames.includes(sheetName)
    ? sheetName
    : workbook.SheetNames[0];
  const worksheet = workbook.Sheets[chosen];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }); // Get as array of arrays

  if (data.length < 2) {
    throw new Error('File must contain at least one data row (plus header)');
  }

  const headers = data[0];
  const headerMap = mapHeaders(headers);

  // Check required columns
  const missingRequired = ['passport_number', 'name', 'gender', 'nationality', 'date_of_birth']
    .filter(col => !(col in headerMap));

  if (missingRequired.length > 0) {
    throw new Error(`Missing required columns: ${missingRequired.join(', ')}`);
  }

  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    // Skip empty rows
    if (!row || row.every(cell => !cell)) continue;

    const mappedRow = {};
    for (const [canonical, idx] of Object.entries(headerMap)) {
      mappedRow[canonical] = row[idx];
    }
    
    // Attach rowIndex so the main processor knows which line it is
    mappedRow._rowIndex = i + 1; 
    rows.push(mappedRow);
  }

  return rows;
}

module.exports = { parseXlsx, mapHeaders, listSheets };
