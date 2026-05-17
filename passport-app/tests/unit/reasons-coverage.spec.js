const { expect } = require('chai');
const { ReasonCodes } = require('../../src/shared/reasonCodes');
const arLocale = require('../../renderer/i18n/locales/ar.json');
const enLocale = require('../../renderer/i18n/locales/en.json');
const { processMrz } = require('../../src/main/services/scanProcessor');
const { validateRow } = require('../../src/main/services/manifestImport');

describe('Specific Error & Warning Reasons Coverage (US3 - T030)', () => {
  it('verifies that emitted reason codes exist in reasonCodes.js and have localized strings in ar and en', async () => {
    // 1. Check scanProcessor Reason emission (REQUIRED_FIELD_MISSING)
    const mockStore = {
      getState: () => ({
        manifest: [],
        boarding_records: {},
        pending_approval: [],
        scan_events: [],
        settings: { fieldRequirements: { gender: true, passportNumber: true, name: true, dob: true, nationality: true } }
      }),
      mutate: (fn) => { /* mock mutation */ }
    };

    // Global indices mock needed by scanProcessor in unit test environment
    global.manifestByNormalized = new Map();
    global.boardingByNormalized = new Map();

    // Use the exact valid TD3 line lengths (44 chars) from mrz.spec.js
    // Line 1: P<EGYNAME<<<<<<<<<<<<<<<<<<<<< (30 chars) -> wait, TD3 requires 44 chars per line!
    // Let's pad line 1 to 44 chars: 'P<EGYNAME<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<'
    // Line 2: A00000000<3EGY8001015<2512319800000000<<<<<<<<<<4 (49 chars? let's count: A00000000(9) + <(1) + 3(1) + EGY(3) + 800101(6) + 5(1) + <(1) + 251231(6) + 9(1) + 800000000(9) + <(10) + 4(1) = 49 chars. Wait, mrz.spec.js line 2 is 49 chars? Let's check length: A00000000<3EGY8001015M2512319800000000<<<<<<<<<<4 -> 9+1+1+3+6+1+1+6+1+9+10+1 = 49 chars. Wait, why did mrz.spec.js pass? Because mrz.spec.js didn't check check_digits_valid to be true! It just checked property existence!)
    
    // Let's create a TRULY valid TD3 MRZ with 44 chars per line and valid check digits.
    // Line 1 (44 chars): P<EGYNAME<<GIVEN<<<<<<<<<<<<<<<<<<<<<<<<<<<<
    // Line 2 (44 chars): A12345678<8EGY8001015<2512319<00000000000004
    // Let's verify check digits:
    // doc_number: A12345678 (weights 7,3,1): A(10)*7 + 1*3 + 2*1 + 3*7 + 4*3 + 5*1 + 6*7 + 7*3 + 8*1 = 70 + 3 + 2 + 21 + 12 + 5 + 42 + 21 + 8 = 184. 184 % 10 = 4. Wait, doc_check should be 4! Let's put 4.
    // dob: 800101 (weights 7,3,1): 8*7 + 0*3 + 0*1 + 1*7 + 0*3 + 1*1 = 56 + 0 + 0 + 7 + 0 + 1 = 64. 64 % 10 = 4. dob_check should be 4! Let's put 4.
    // exp: 251231 (weights 7,3,1): 2*7 + 5*3 + 1*1 + 2*7 + 3*3 + 1*1 = 14 + 15 + 1 + 14 + 9 + 1 = 54. 54 % 10 = 4. exp_check should be 4! Let's put 4.
    // personal_number: <0000000000000 (14 chars of < and 0): all 0 value, sum 0, pers_check = 0.
    // overall_check: includes doc_number(9)+doc_check(1) + dob(6)+dob_check(1) + exp(6)+exp_check(1) + personal_number(14)+pers_check(1). Total 39 chars.
    // String: A12345678480010142512314<00000000000000
    // Summing weights (7,3,1):
    // A123456784: 184 (from A12345678) + 4*7 = 212.
    // 8001014: 64 (from 800101) + 4*1 (since 8 started at index 10, weight 3. Wait! Let's be precise with index matching).
    // Let's do index by index for the 39 chars:
    // 0: A (10*7=70)
    // 1: 1 (1*3=3)
    // 2: 2 (2*1=2)
    // 3: 3 (3*7=21)
    // 4: 4 (4*3=12)
    // 5: 5 (5*1=5)
    // 6: 6 (6*7=42)
    // 7: 7 (7*3=21)
    // 8: 8 (8*1=8) -> doc sum = 184
    // 9: 4 (doc_check, weight 7: 4*7=28)
    // 10: 8 (dob 0, weight 3: 8*3=24)
    // 11: 0 (dob 1, weight 1: 0)
    // 12: 0 (dob 2, weight 7: 0)
    // 13: 1 (dob 3, weight 3: 1*3=3)
    // 14: 0 (dob 4, weight 1: 0)
    // 15: 1 (dob 5, weight 7: 1*7=7)
    // 16: 4 (dob_check, weight 3: 4*3=12)
    // 17: 2 (exp 0, weight 1: 2*1=2)
    // 18: 5 (exp 1, weight 7: 5*7=35)
    // 19: 1 (exp 2, weight 3: 1*3=3)
    // 20: 2 (exp 3, weight 1: 2*1=2)
    // 21: 3 (exp 4, weight 7: 3*7=21)
    // 22: 1 (exp 5, weight 3: 1*3=3)
    // 23: 4 (exp_check, weight 1: 4*1=4)
    // 24..38: all < and 0, sum 0.
    // Total sum = 184 + 28 + 24 + 3 + 7 + 12 + 2 + 35 + 3 + 2 + 21 + 3 + 4 = 328.
    // 328 % 10 = 8. overall_check should be 8!
    // Let's assemble line 2 (44 chars):
    // A123456784EGY8001014<2512314<000000000000008
    // Let's verify length: A12345678(9) + 4(1) + EGY(3) + 800101(6) + 4(1) + <(1) + 251231(6) + 4(1) + <0000000000000(14) + 0(1) + 8(1) = 9+1+3+6+1+1+6+1+14+1+1 = 44 chars! Perfect!

    const line1 = 'P<EGYNAME<<GIVEN<<<<<<<<<<<<<<<<<<<<<<<<<<<<';
    const line2 = 'A123456784EGY8001014<2512314<000000000000008';
    const mrz = line1 + '\n' + line2;

    const resMissing = await processMrz(mockStore, mrz, 'keyboard');
    expect(resMissing.outcome).to.equal('read-failed');
    expect(resMissing.reason).to.equal(ReasonCodes.REQUIRED_FIELD_MISSING);
    expect(arLocale.reasons[resMissing.reason]).to.be.a('string').and.not.empty;
    expect(enLocale.reasons[resMissing.reason]).to.be.a('string').and.not.empty;

    // 2. Provoke manifestImport validation errors
    const rowMissingPassport = { name: 'Ahmed Ali', nationality: 'EGY', date_of_birth: '1990-01-01', gender: 'M' };
    const valRes = validateRow(rowMissingPassport, 1, { passportNumber: true });
    expect(valRes.outcome).to.equal('Error');
    expect(valRes.errors[0].rule).to.equal('required');

    // Ensure all defined ReasonCodes have valid non-empty strings in both locales
    for (const [key, code] of Object.entries(ReasonCodes)) {
      expect(arLocale.reasons).to.have.property(code);
      expect(enLocale.reasons).to.have.property(code);
      expect(arLocale.reasons[code]).to.be.a('string').and.not.empty;
      expect(enLocale.reasons[code]).to.be.a('string').and.not.empty;
    }
  });
});
