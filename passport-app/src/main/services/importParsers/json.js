const fs = require('fs');

/**
 * Parse a JSON file and return raw rows
 * Accepts either an array of objects or an object like { passengers: [...] }
 * @param {string} filePath 
 * @returns {Array<Object>}
 */
function parseJson(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let data;
  try {
    data = JSON.parse(content);
  } catch (err) {
    throw new Error('Invalid JSON format: ' + err.message);
  }

  let arrayData = null;
  if (Array.isArray(data)) {
    arrayData = data;
  } else if (data && typeof data === 'object' && Array.isArray(data.passengers)) {
    arrayData = data.passengers;
  } else {
    throw new Error('JSON must be an array or an object containing a "passengers" array');
  }

  const rows = [];
  for (let i = 0; i < arrayData.length; i++) {
    const item = arrayData[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      const err = new Error('Invalid element in JSON array');
      err.code = 'IMPORT_JSON_BAD_ELEMENT';
      err.rowIndex = i + 1;
      throw err;
    }
    // Attach rowIndex (1-based)
    item._rowIndex = i + 1;
    rows.push(item);
  }

  return rows;
}

module.exports = { parseJson };
