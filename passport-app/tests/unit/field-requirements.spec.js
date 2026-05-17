/**
 * Field Requirements — Unit Tests (T058)
 * Verifies validate(record, requirements) returns correct validation results.
 */

const { expect } = require('chai');
const { validate, FIELD_KEYS, DEFAULT_FIELD_REQUIREMENTS } = require('../../src/shared/fieldRequirements');
const { ReasonCodes } = require('../../src/shared/reasonCodes');

describe('Field Requirements Validation (T058)', () => {
  it('returns valid when all required fields are present', () => {
    const record = {
      passport_number: 'EG123456',
      surname: 'Doe',
      given_names: 'John',
      date_of_birth: '1990-01-01',
      nationality: 'EGY',
      gender: 'M'
    };
    const res = validate(record, DEFAULT_FIELD_REQUIREMENTS);
    expect(res.valid).to.be.true;
    expect(res.errors).to.be.empty;
    expect(res.missingRequired).to.be.empty;
  });

  it('identifies missing optional fields without failing validation', () => {
    const record = {
      passport_number: 'EG123456',
      surname: 'Doe',
      given_names: 'John',
      date_of_birth: '1990-01-01',
      nationality: 'EGY',
      // gender is missing, but it is optional by default
    };
    const res = validate(record, DEFAULT_FIELD_REQUIREMENTS);
    expect(res.valid).to.be.true;
    expect(res.errors).to.be.empty;
    expect(res.missingOptional).to.include('gender');
    expect(res.missingRequired).to.be.empty;
  });

  it('fails validation and returns REQUIRED_FIELD_MISSING when required field is missing', () => {
    const record = {
      passport_number: 'EG123456',
      surname: 'Doe',
      given_names: 'John',
      // date_of_birth is missing (required by default)
      nationality: 'EGY',
    };
    const res = validate(record, DEFAULT_FIELD_REQUIREMENTS);
    expect(res.valid).to.be.false;
    expect(res.errors).to.include(ReasonCodes.REQUIRED_FIELD_MISSING);
    expect(res.missingRequired).to.include('dob');
  });

  it('respects custom requirements overriding defaults (e.g. gender made required)', () => {
    const customReq = {
      ...DEFAULT_FIELD_REQUIREMENTS,
      gender: true // now required
    };
    const record = {
      passport_number: 'EG123456',
      surname: 'Doe',
      given_names: 'John',
      date_of_birth: '1990-01-01',
      nationality: 'EGY',
      // gender missing
    };
    const res = validate(record, customReq);
    expect(res.valid).to.be.false;
    expect(res.errors).to.include(ReasonCodes.REQUIRED_FIELD_MISSING);
    expect(res.missingRequired).to.include('gender');
  });
});
