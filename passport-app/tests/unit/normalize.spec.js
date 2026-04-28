/* eslint-env mocha */
const { expect } = require('chai');
const { normalizePassportNumber } = require('../../src/shared/normalize');

describe('normalizePassportNumber', () => {
  it('should handle empty strings', () => {
    expect(normalizePassportNumber('')).to.equal('');
    expect(normalizePassportNumber(null)).to.equal('');
    expect(normalizePassportNumber(undefined)).to.equal('');
  });

  it('should trim whitespace', () => {
    expect(normalizePassportNumber('  ABC123  ')).to.equal('ABC123');
  });

  it('should convert to uppercase', () => {
    expect(normalizePassportNumber('abc123')).to.equal('ABC123');
  });

  it('should remove special characters', () => {
    expect(normalizePassportNumber('A-B-C 1-2-3')).to.equal('ABC123');
  });

  it('should handle embedded dashes and spaces', () => {
    expect(normalizePassportNumber('A-B/C 1 2 3')).to.equal('ABC123');
  });

  it('should be idempotent', () => {
    const input = 'Test-123-ABC';
    const once = normalizePassportNumber(input);
    const twice = normalizePassportNumber(once);
    expect(once).to.equal(twice);
  });

  it('should strip Unicode digits and keep only ASCII', () => {
    // Unicode digit ٣ (Arabic 3)
    expect(normalizePassportNumber('AB١٢٣')).to.equal('AB');
  });
});
