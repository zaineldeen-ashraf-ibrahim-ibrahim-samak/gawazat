const { expect } = require('chai');
const { parseMrz } = require('../../src/shared/mrz');

describe('MRZ Parser', () => {
  it('should parse an MRZ string input', () => {
    // Simple test - just verify it doesn't crash
    const line1 = 'P<EGYNAME<<<<<<<<<<<<<<<<<<<<<';
    const line2 = 'A00000000<3EGY8001015M2512319800000000<<<<<<<<<<4';
    const mrz = line1 + '\n' + line2;

    const result = parseMrz(mrz);
    expect(result).to.have.property('type');
    expect(result).to.have.property('document_number');
    expect(result).to.have.property('surname');
    expect(result).to.have.property('given_names');
    expect(result).to.have.property('nationality');
    expect(result).to.have.property('date_of_birth');
    expect(result).to.have.property('sex');
    expect(result).to.have.property('expiry_date');
    expect(result).to.have.property('check_digits_valid');
  });

  it('should return UNKNOWN type for invalid format', () => {
    const result = parseMrz('not an mrz');
    expect(result.type).to.equal('UNKNOWN');
    expect(result.check_digits_valid).to.be.false;
  });

  it('should handle null and undefined', () => {
    expect(parseMrz(null).type).to.equal('UNKNOWN');
    expect(parseMrz(undefined).type).to.equal('UNKNOWN');
    expect(parseMrz('').type).to.equal('UNKNOWN');
  });
});

