/**
 * ICAO 9303 MRZ Parser (TD1 and TD3)
 * TD1: 3 lines × 30 characters
 * TD3: 2 lines × 44 characters
 *
 * @typedef {Object} MrzResult
 * @property {string} type - 'TD1' or 'TD3'
 * @property {string} document_number
 * @property {string} surname
 * @property {string} given_names
 * @property {string} nationality - ISO 3166-1 alpha-3
 * @property {string} date_of_birth - YYYY-MM-DD
 * @property {string} sex - 'M' or 'F'
 * @property {string} expiry_date - YYYY-MM-DD
 * @property {boolean} check_digits_valid
 */

/**
 * Parse MRZ string (TD1 or TD3 format)
 * @param {string} rawText - Raw text from passport reader
 * @returns {MrzResult}
 */
function parseMrz(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return createFailedResult('Invalid input');
  }

  // Clean and split lines - preserve only alphanumeric and <
  const lines = rawText
    .split(/[\n\r]+/)
    .map((line) => {
      // Keep only A-Z0-9 and <
      return line.replace(/[^A-Z0-9<]/gi, '').toUpperCase();
    })
    .filter((line) => line.length > 0);

  // Debug: log what we got
  // console.log('Parsed lines:', lines, 'lengths:', lines.map(l => l.length));

  // Detect TD1 (3 lines of 30 chars) or TD3 (2 lines of 44 chars)
  if (lines.length === 3 && lines.every((l) => l.length === 30)) {
    return parseTD1(lines);
  } else if (lines.length === 2 && lines.every((l) => l.length === 44)) {
    return parseTD3(lines);
  }

  return createFailedResult('Invalid MRZ format');
}

/**
 * Parse TD1 (3×30 format)
 * @private
 */
function parseTD1(lines) {
  // Line 0: Type(1) + Code(2) + Names with < separator
  // Line 1: Passport number + check digit + Optional data
  // Line 2: DoB + check digit + Gender + Expiry + check digit + Personal number + check digit + Overall check

  const line0 = lines[0];
  const line1 = lines[1];
  const line2 = lines[2];

  // Extract fields
  const type_code = line0.substring(0, 3);
  const names = line0.substring(3);
  const nameParts = names.split('<<').filter((p) => p.length > 0);
  const surname = (nameParts[0] || '').replace(/</g, ' ').trim();
  const given_names = (nameParts[1] || '').replace(/</g, ' ').trim();

  const document_number = line1.substring(0, 9).replace(/<+$/, '').trim();
  const doc_check = parseInt(line1.substring(9, 10), 10);
  const optional = line1.substring(10, 30);

  const date_of_birth_raw = line2.substring(0, 6);
  const dob_check = parseInt(line2.substring(6, 7), 10);
  const sex = line2.substring(7, 8);
  const expiry_date_raw = line2.substring(8, 14);
  const exp_check = parseInt(line2.substring(14, 15), 10);
  const nationality = line2.substring(15, 18);
  const personal_number = line2.substring(18, 28);
  const pers_check = parseInt(line2.substring(28, 29), 10);
  const overall_check = parseInt(line2.substring(29, 30), 10);

  // Validate check digits
  const doc_check_valid = validateCheckDigit(document_number, doc_check);
  const dob_check_valid = validateCheckDigit(date_of_birth_raw, dob_check);
  const exp_check_valid = validateCheckDigit(expiry_date_raw, exp_check);
  const pers_check_valid = validateCheckDigit(personal_number, pers_check);
  const overall_check_valid = validateCheckDigit(
    document_number + date_of_birth_raw + expiry_date_raw + personal_number,
    overall_check,
  );

  const check_digits_valid =
    doc_check_valid &&
    dob_check_valid &&
    exp_check_valid &&
    pers_check_valid &&
    overall_check_valid;

  return {
    type: 'TD1',
    document_number,
    surname,
    given_names,
    nationality,
    date_of_birth: convertDate(date_of_birth_raw),
    sex,
    expiry_date: convertDate(expiry_date_raw),
    check_digits_valid,
  };
}

/**
 * Parse TD3 (2×44 format)
 * @private
 */
function parseTD3(lines) {
  // Line 0: Type(1) + Country(3) + Names (surname and given)
  // Line 1: Document number + check + DoB + Gender + Expiry + check + Personal number + check + Overall check

  const line0 = lines[0];
  const line1 = lines[1];

  // Extract type and country
  const type_code = line0.substring(0, 2);
  const nationality = line0.substring(2, 5);

  // Names are in line 0, position 5-44
  const names = line0.substring(5);
  const nameParts = names.split('<<').filter((p) => p.length > 0);
  const surname = (nameParts[0] || '').replace(/</g, ' ').trim();
  const given_names = (nameParts[1] || '').replace(/</g, ' ').trim();

  // Line 1: Passport info
  const document_number = line1.substring(0, 9).replace(/<+$/, '').trim();
  const doc_check = parseInt(line1.substring(9, 10), 10);
  const date_of_birth_raw = line1.substring(13, 19);
  const dob_check = parseInt(line1.substring(19, 20), 10);
  const sex = line1.substring(20, 21);
  const expiry_date_raw = line1.substring(21, 27);
  const exp_check = parseInt(line1.substring(27, 28), 10);
  const personal_number = line1.substring(28, 42);
  const pers_check = parseInt(line1.substring(42, 43), 10);
  const overall_check = parseInt(line1.substring(43, 44), 10);

  // Validate check digits
  const doc_check_valid = validateCheckDigit(document_number, doc_check);
  const dob_check_valid = validateCheckDigit(date_of_birth_raw, dob_check);
  const exp_check_valid = validateCheckDigit(expiry_date_raw, exp_check);
  const pers_check_valid = validateCheckDigit(personal_number, pers_check);
  const overall_check_valid = validateCheckDigit(
    line1.substring(0, 10) + line1.substring(13, 20) + line1.substring(21, 43),
    overall_check,
  );

  const check_digits_valid =
    doc_check_valid &&
    dob_check_valid &&
    exp_check_valid &&
    pers_check_valid &&
    overall_check_valid;

  return {
    type: 'TD3',
    document_number,
    surname,
    given_names,
    nationality,
    date_of_birth: convertDate(date_of_birth_raw),
    sex: sex === 'M' ? 'M' : sex === 'F' ? 'F' : '',
    expiry_date: convertDate(expiry_date_raw),
    check_digits_valid,
  };
}

/**
 * Validate a check digit using ICAO 9303 weights (7, 3, 1)
 * @private
 */
function validateCheckDigit(input, expectedCheckDigit) {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    let value = 0;
    if (char === '<') {
      value = 0;
    } else if (char >= '0' && char <= '9') {
      value = parseInt(char, 10);
    } else if (char >= 'A' && char <= 'Z') {
      value = char.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
    }
    sum += value * weights[i % 3];
  }
  const checkDigit = sum % 10;
  return checkDigit === expectedCheckDigit;
}

/**
 * Convert YYMMDD to YYYY-MM-DD
 * @private
 */
function convertDate(yymmdd) {
  if (yymmdd.length !== 6) return '';
  const yy = parseInt(yymmdd.substring(0, 2), 10);
  const mm = yymmdd.substring(2, 4);
  const dd = yymmdd.substring(4, 6);

  // Windowing: years <= current_year_2digit + 10 -> 2000s, else 1900s
  const currentYear = new Date().getFullYear();
  const currentYY = currentYear % 100;
  const century = yy <= currentYY + 10 ? 2000 : 1900;
  const yyyy = century + yy;

  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Create a failed MRZ result
 * @private
 */
function createFailedResult(reason) {
  return {
    type: 'UNKNOWN',
    document_number: '',
    surname: '',
    given_names: '',
    nationality: '',
    date_of_birth: '',
    sex: '',
    expiry_date: '',
    check_digits_valid: false,
  };
}

module.exports = { parseMrz };
