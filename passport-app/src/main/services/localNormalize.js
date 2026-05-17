/**
 * localNormalize.js
 * Synchronous deterministic normalizer fallback
 */

const { normalizePassportNumber } = require('../../shared/normalize');

function normalizeDate(dobStr) {
  if (!dobStr || typeof dobStr !== 'string') return dobStr;
  const s = dobStr.trim();
  
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  
  // DD/MM/YYYY or DD-MM-YYYY
  const dmMatch = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (dmMatch) {
    return `${dmMatch[3]}-${dmMatch[2]}-${dmMatch[1]}`;
  }

  // YYYYMMDD
  const ymdMatch = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (ymdMatch) {
    return `${ymdMatch[1]}-${ymdMatch[2]}-${ymdMatch[3]}`;
  }

  return s; // leave as-is if unrecognized
}

function normalize(raw) {
  if (!raw || typeof raw !== 'object') return { normalized: raw, confidence: null };

  const normalized = { ...raw };

  for (const key in normalized) {
    if (typeof normalized[key] === 'string') {
      let val = normalized[key].trim().normalize('NFC');
      
      if (key === 'passportNumber' || key === 'passport_number') {
        normalized[key] = normalizePassportNumber(val);
      } else if (key === 'dob' || key === 'date_of_birth') {
        normalized[key] = normalizeDate(val);
      } else if (key === 'gender' || key === 'nationality') {
        normalized[key] = val.toUpperCase();
      } else if (key === 'name' || key === 'familyName' || key === 'givenName') {
        // Upper-case Latin characters, leave Arabic
        normalized[key] = val.toUpperCase();
      } else {
        normalized[key] = val;
      }
    }
  }

  return { normalized, confidence: null };
}

module.exports = { normalize, normalizeDate };
