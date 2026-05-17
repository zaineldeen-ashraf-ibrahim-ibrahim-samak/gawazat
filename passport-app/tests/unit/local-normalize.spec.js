const { expect } = require('chai');
const { normalize } = require('../../src/main/services/localNormalize');

describe('localNormalize (T036)', () => {
  it('trims and capitalizes Latin strings, leaves Arabic as-is', () => {
    const raw = {
      givenName: ' ahmed ',
      familyName: 'مُحَمَّد',
      passportNumber: ' eg123456 ',
      nationality: ' egy '
    };
    const res = normalize(raw);
    expect(res.normalized.givenName).to.equal('AHMED');
    expect(res.normalized.familyName).to.equal('مُحَمَّد');
    expect(res.normalized.passportNumber).to.equal('EG123456');
    expect(res.normalized.nationality).to.equal('EGY');
  });

  it('normalizes various date formats to ISO YYYY-MM-DD', () => {
    expect(normalize({ dob: '1990-05-12' }).normalized.dob).to.equal('1990-05-12');
    expect(normalize({ dob: '12/05/1990' }).normalized.dob).to.equal('1990-05-12');
    expect(normalize({ dob: '12-05-1990' }).normalized.dob).to.equal('1990-05-12');
    expect(normalize({ dob: '19900512' }).normalized.dob).to.equal('1990-05-12');
    // Invalid or missing date should be left as-is or null
    expect(normalize({ dob: 'invalid' }).normalized.dob).to.equal('invalid');
  });

  it('preserves other fields unchanged', () => {
    const raw = { gender: 'm', unknown: 'test' };
    const res = normalize(raw);
    expect(res.normalized.gender).to.equal('M'); // uppercased if string
    expect(res.normalized.unknown).to.equal('test');
  });
});
