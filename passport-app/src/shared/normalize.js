/**
 * Passport number normalization function
 * Canonical match key for all passport comparisons
 * @param {string} s - Raw passport number
 * @returns {string} Normalized passport number
 */
function normalizePassportNumber(s) {
  if (!s || typeof s !== 'string') return '';
  return s.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Extract a display name from any record shape the app might hold:
 * - manifest passenger (.name)
 * - parsed MRZ (.surname + .given_names)
 * - AI/local normalized output (.familyName + .givenName, .fullName)
 * - manual entry fallback
 * Returns '' if nothing is available.
 */
function extractDisplayName(record) {
  if (!record || typeof record !== 'object') return '';
  const direct = record.name || record.fullName || record.full_name;
  if (direct && String(direct).trim()) return String(direct).trim();

  const family = record.familyName || record.surname || '';
  const given  = record.givenName || record.given_names || record.givenNames || '';
  const composed = `${family} ${given}`.trim();
  if (composed) return composed;

  return '';
}

module.exports = { normalizePassportNumber, extractDisplayName };
