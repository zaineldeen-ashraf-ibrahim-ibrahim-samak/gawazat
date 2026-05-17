const { expect } = require('chai');
const duplicateMatcher = require('../../src/main/services/duplicateMatcher');
const indices = require('../../src/main/store/indices');

describe('Duplicate Matcher', () => {
  beforeEach(() => {
    indices.reset();
  });

  it('detect returns kind: none for empty session', () => {
    const res = duplicateMatcher.detect({
      passportNumberKey: 'A123',
      name: 'MOHAMED AHMED',
      dob: '1990-01-01',
      nationality: 'EGY'
    });
    expect(res).to.deep.equal({ kind: 'none' });
  });

  it('detect returns kind: none on exact passportNumberKey match against manifest (handled by scanProcessor as green/orange)', () => {
    indices.insert({
      id: 'p1',
      passport_number_normalized: 'A123',
      name: 'MOHAMED AHMED',
      date_of_birth: '1990-01-01',
      nationality: 'EGY'
    });

    const res = duplicateMatcher.detect({
      passportNumberKey: 'A123',
      name: 'MOHAMED AHMED',
      dob: '1990-01-01',
      nationality: 'EGY'
    });
    expect(res.kind).to.equal('none');
  });

  it('detect returns kind: fuzzy on matching name+DOB+nationality with different passport', () => {
    indices.insert({
      id: 'p2',
      passport_number_normalized: 'A123',
      name: 'MOHAMED AHMED',
      date_of_birth: '1990-01-01',
      nationality: 'EGY'
    });

    const res = duplicateMatcher.detect({
      passportNumberKey: 'B999',
      name: 'MOHAMED AHMED',
      dob: '1990-01-01',
      nationality: 'EGY'
    });
    expect(res.kind).to.equal('fuzzy');
    expect(res.existingPassengerId).to.equal('p2');
    expect(res.differences).to.be.an('array');
  });

  it('fuzzy match returns none if name Levenshtein distance > 2', () => {
    indices.insert({
      id: 'p3',
      passport_number_normalized: 'A123',
      name: 'MOHAMED AHMED',
      date_of_birth: '1990-01-01',
      nationality: 'EGY'
    });

    const res = duplicateMatcher.detect({
      passportNumberKey: 'B999',
      name: 'MOHAMED KHALIL', // Very different name
      dob: '1990-01-01',
      nationality: 'EGY'
    });
    expect(res.kind).to.equal('none');
  });
});
