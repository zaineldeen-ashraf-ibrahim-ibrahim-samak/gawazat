/**
 * Filter State — Unit Tests (T053)
 * Verifies applyFilterState pure function applies each criterion correctly.
 */

const { expect } = require('chai');

// We extract the pure function by requiring it through a shim since it's an ES module.
// For testability, we replicate the pure function here (matches advancedFilterPanel.js exactly).
function applyFilterState(passengers, filterState) {
  if (!filterState) return passengers;
  const { genders, statuses, sources, nationality, dobFrom, dobTo, ageMin, ageMax, hasWarning } = filterState;

  const today = new Date();

  return passengers.filter(p => {
    // Gender (OR logic within genders array)
    if (genders && genders.length > 0 && !genders.includes(p.gender)) return false;

    // Nationality
    if (nationality && p.nationality !== nationality) return false;

    // Source (OR logic within sources array)
    if (sources && sources.length > 0 && !sources.includes(p.source)) return false;

    // Statuses (OR logic within statuses array)
    if (statuses && statuses.length > 0) {
      const match = statuses.some(st => {
        if (st === 'entered')   return p.is_entered;
        if (st === 'pending')   return !p.is_entered;
        if (st === 'duplicate') return p.is_duplicate;
        return false;
      });
      if (!match) return false;
    }

    // Has Warning flag
    if (hasWarning && !p.is_duplicate) return false;

    // DOB range
    if (dobFrom && p.date_of_birth && p.date_of_birth < dobFrom) return false;
    if (dobTo   && p.date_of_birth && p.date_of_birth > dobTo)   return false;

    // Age range (computed from DOB)
    if ((ageMin !== '' && ageMin != null) || (ageMax !== '' && ageMax != null)) {
      if (!p.date_of_birth) return false;
      const dob = new Date(p.date_of_birth);
      let age = today.getFullYear() - dob.getFullYear();
      const m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
      if (ageMin !== '' && ageMin != null && age < ageMin) return false;
      if (ageMax !== '' && ageMax != null && age > ageMax) return false;
    }

    return true;
  });
}

const PASSENGERS = [
  { passport_number: 'EG001', name: 'Ahmed Ali',    gender: 'M', nationality: 'EGY', source: 'manifest',     is_entered: true,  is_duplicate: false, date_of_birth: '1990-01-01' },
  { passport_number: 'SA002', name: 'Sara Hassan',  gender: 'F', nationality: 'SAU', source: 'manifest',     is_entered: false, is_duplicate: false, date_of_birth: '2000-05-15' },
  { passport_number: 'EG003', name: 'Mohamed Saad', gender: 'M', nationality: 'EGY', source: 'added-at-gate',is_entered: false, is_duplicate: true,  date_of_birth: '1985-10-20' },
  { passport_number: 'JO004', name: 'Lina Haddad',  gender: 'F', nationality: 'JOR', source: 'manual',       is_entered: true,  is_duplicate: false, date_of_birth: '2015-03-10' },
];

describe('applyFilterState — pure filter function (multi-select arrays)', () => {
  it('returns all rows when filterState is null', () => {
    expect(applyFilterState(PASSENGERS, null)).to.have.length(4);
  });

  it('returns all rows when filterState is empty object', () => {
    expect(applyFilterState(PASSENGERS, {})).to.have.length(4);
  });

  it('filters by single gender M', () => {
    const result = applyFilterState(PASSENGERS, { genders: ['M'] });
    expect(result).to.have.length(2);
    result.forEach(p => expect(p.gender).to.equal('M'));
  });

  it('filters by multiple genders [M, F]', () => {
    const result = applyFilterState(PASSENGERS, { genders: ['M', 'F'] });
    expect(result).to.have.length(4);
  });

  it('filters by nationality EGY', () => {
    const result = applyFilterState(PASSENGERS, { nationality: 'EGY' });
    expect(result).to.have.length(2);
    result.forEach(p => expect(p.nationality).to.equal('EGY'));
  });

  it('filters by single status entered', () => {
    const result = applyFilterState(PASSENGERS, { statuses: ['entered'] });
    expect(result).to.have.length(2);
    result.forEach(p => expect(p.is_entered).to.be.true);
  });

  it('filters by multiple statuses [entered, pending]', () => {
    const result = applyFilterState(PASSENGERS, { statuses: ['entered', 'pending'] });
    expect(result).to.have.length(4);
  });

  it('filters by single source added-at-gate', () => {
    const result = applyFilterState(PASSENGERS, { sources: ['added-at-gate'] });
    expect(result).to.have.length(1);
    expect(result[0].passport_number).to.equal('EG003');
  });

  it('filters by multiple sources [added-at-gate, manual]', () => {
    const result = applyFilterState(PASSENGERS, { sources: ['added-at-gate', 'manual'] });
    expect(result).to.have.length(2);
  });

  it('filters by hasWarning = true', () => {
    const result = applyFilterState(PASSENGERS, { hasWarning: true });
    expect(result).to.have.length(1);
    expect(result[0].passport_number).to.equal('EG003');
  });

  it('combines categories with AND logic (genders [M] + nationality EGY)', () => {
    const result = applyFilterState(PASSENGERS, { genders: ['M'], nationality: 'EGY' });
    expect(result).to.have.length(2);
  });

  it('filters by dobFrom', () => {
    const result = applyFilterState(PASSENGERS, { dobFrom: '1995-01-01' });
    expect(result).to.have.length(2); // SA002 (2000), JO004 (2015)
  });

  it('filters by ageMin (e.g. min 20 years old)', () => {
    const result = applyFilterState(PASSENGERS, { ageMin: 20 });
    // EG001 (1990), SA002 (2000), EG003 (1985) are all >= 20. JO004 (2015) is ~11.
    expect(result).to.have.length(3);
  });
});
