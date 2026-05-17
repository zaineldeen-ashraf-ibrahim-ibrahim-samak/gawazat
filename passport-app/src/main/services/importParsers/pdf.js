const fs = require('fs');
const pdfParse = require('pdf-parse');

/**
 * Heuristic to check if a line is a header row
 */
function isHeader(line) {
  const lower = line.toLowerCase();
  let matches = 0;
  if (lower.includes('passport') || lower.includes('document')) matches++;
  if (lower.includes('name')) matches++;
  if (lower.includes('gender') || lower.includes('sex') || lower.includes('نوع') || lower.includes('جنس')) matches++;
  if (lower.includes('nationality') || lower.includes('جنسية')) matches++;
  if (lower.includes('date of birth') || lower.includes('dob') || lower.includes('مواليد')) matches++;
  return matches >= 3;
}

/**
 * Heuristic to detect columns in a row
 */
function parseColumns(line) {
  // Split by 2 or more spaces or tabs
  const cols = line.split(/\s{2,}|\t+/).map(c => c.trim()).filter(Boolean);
  return cols;
}

/**
 * Parse a PDF file and extract passenger table data
 * @param {string} filePath 
 * @returns {Promise<Array<Object>>}
 */
async function parsePdf(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);

  const lines = data.text.split(/\r?\n/).filter(line => line.trim().length > 0);
  
  let headerCols = null;
  const rows = [];
  let detectedColumns = 0;
  let rowIndexCounter = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (!headerCols) {
      if (isHeader(line)) {
        headerCols = parseColumns(line);
        detectedColumns = headerCols.length;
        if (detectedColumns < 4) {
          const err = new Error('Not enough columns detected in PDF table');
          err.code = 'IMPORT_PDF_NO_TABLE';
          throw err;
        }
      }
      continue;
    }

    // Attempt to parse data row
    const cols = parseColumns(line);
    // Rough check: if it has enough columns, treat as a row
    if (cols.length >= detectedColumns - 2 && cols.length > 0) {
      rowIndexCounter++;
      
      // Let's do a naive map. 
      // Ideally, we'd map header names to canonical keys, but we can also just guess based on index
      // if header detection matched some names.
      // For simplicity, we just use the same logic as XLSX if we can.
      
      // Here we just map by index based on headerCols if we use `mapHeaders` from xlsx
      // but `mapHeaders` expects array of strings.
      const { mapHeaders } = require('./xlsx');
      const headerMap = mapHeaders(headerCols);

      if (Object.keys(headerMap).length < 3) {
        // Fallback naive mapping if aliases don't match
        // Assuming typical order: Passport, Name, Gender, Nationality, DOB
        const mappedRow = {
          _rowIndex: rowIndexCounter,
          passport_number: cols[0] || '',
          name: cols[1] || '',
          gender: cols[2] || '',
          nationality: cols[3] || '',
          date_of_birth: cols[4] || ''
        };
        rows.push(mappedRow);
      } else {
        const mappedRow = { _rowIndex: rowIndexCounter };
        for (const [canonical, idx] of Object.entries(headerMap)) {
          mappedRow[canonical] = cols[idx] || '';
        }
        rows.push(mappedRow);
      }
    }
  }

  if (detectedColumns > 0 && detectedColumns < 4) {
    const err = new Error('Not enough columns detected in PDF table');
    err.code = 'IMPORT_PDF_NO_TABLE';
    throw err;
  }

  if (rows.length === 0) {
    const err = new Error('No tabular data detected in PDF');
    err.code = 'IMPORT_PDF_NO_TABLE';
    throw err;
  }

  return rows;
}

module.exports = { parsePdf };
