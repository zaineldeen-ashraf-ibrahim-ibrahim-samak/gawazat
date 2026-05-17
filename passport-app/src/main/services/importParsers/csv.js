const XLSX = require('xlsx');
const { mapHeaders } = require('./xlsx');

/**
 * Parse a CSV file and return raw rows
 * @param {string} filePath 
 * @returns {Array<Object>}
 */
function parseCsv(filePath) {
  // SheetJS handles CSV delimiter auto-detection and RFC 4180 out of the box
  const workbook = XLSX.readFile(filePath, { type: 'file', raw: false, cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

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
    
    // Attach rowIndex
    mappedRow._rowIndex = i + 1;
    rows.push(mappedRow);
  }

  return rows;
}

module.exports = { parseCsv };
