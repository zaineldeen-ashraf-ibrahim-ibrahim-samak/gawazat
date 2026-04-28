const { expect } = require('chai');
const ar = require('../../renderer/i18n/locales/ar.json');
const en = require('../../renderer/i18n/locales/en.json');

/**
 * Flatten a nested object to a single level with dot notation keys
 * @param {object} obj - Object to flatten
 * @param {string} prefix - Key prefix
 * @returns {object} Flattened object
 */
function flattenKeys(obj, prefix = '') {
  const result = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        Object.assign(result, flattenKeys(value, fullKey));
      } else {
        result[fullKey] = value;
      }
    }
  }
  return result;
}

describe('Locale Parity Test', () => {
  it('should have matching keys between AR and EN locales', () => {
    const arKeys = Object.keys(flattenKeys(ar)).sort();
    const enKeys = Object.keys(flattenKeys(en)).sort();

    const arSet = new Set(arKeys);
    const enSet = new Set(enKeys);

    const missingInEn = arKeys.filter((key) => !enSet.has(key));
    const missingInAr = enKeys.filter((key) => !arSet.has(key));

    const hasErrors = missingInEn.length > 0 || missingInAr.length > 0;

    if (hasErrors) {
      let message = 'Locale key mismatch:\n';
      if (missingInEn.length > 0) {
        message += `  Missing in EN: ${missingInEn.join(', ')}\n`;
      }
      if (missingInAr.length > 0) {
        message += `  Missing in AR: ${missingInAr.join(', ')}\n`;
      }
    }

    expect(arKeys).to.deep.equal(enKeys, 'AR and EN keys must match');
  });

  it('should have all keys present in both locales', () => {
    const arKeys = new Set(Object.keys(flattenKeys(ar)));
    const enKeys = new Set(Object.keys(flattenKeys(en)));

    expect(arKeys.size).to.equal(enKeys.size);
    for (const key of arKeys) {
      expect(enKeys.has(key)).to.be.true;
    }
  });
});
