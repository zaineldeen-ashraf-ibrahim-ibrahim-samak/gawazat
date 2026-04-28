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

module.exports = { normalizePassportNumber };
