const { ReasonCodes } = require('./reasonCodes');

const FIELD_KEYS = Object.freeze([
  'passportNumber',
  'familyName',
  'givenName',
  'dob',
  'nationality',
  'gender',
  'documentType'
]);

const DEFAULT_FIELD_REQUIREMENTS = Object.freeze({
  passportNumber: true,
  familyName: true,
  givenName: true,
  dob: true,
  nationality: true,
  gender: false,
  documentType: false
});

/**
 * Validate a record against field requirements.
 * @param {Object} record - The parsed record/mrz fields
 * @param {Object} requirements - Map of fieldKey -> boolean (true = required)
 * @returns {{ valid: boolean, missingRequired: string[], missingOptional: string[], errors: string[] }}
 */
function validate(record = {}, requirements = DEFAULT_FIELD_REQUIREMENTS) {
  const missingRequired = [];
  const missingOptional = [];

  for (const key of FIELD_KEYS) {
    const isReq = requirements[key] ?? DEFAULT_FIELD_REQUIREMENTS[key];
    
    // Map record fields to FIELD_KEYS
    let val = record[key];
    if (val === undefined) {
      if (key === 'passportNumber') val = record.passportNumber || record.passport_number || record.document_number || record.documentNumber;
      else if (key === 'familyName') val = record.familyName || record.surname || record.name;
      else if (key === 'givenName') val = record.givenName || record.given_names || record.givenNames || record.name;
      else if (key === 'dob') val = record.dob || record.date_of_birth || record.dateOfBirth;
      else if (key === 'nationality') val = record.nationality;
      else if (key === 'gender') val = record.gender || record.sex;
      else if (key === 'documentType') val = record.documentType || record.document_code || record.documentCode;
    }

    const isEmpty = val === undefined || val === null || String(val).trim() === '';

    if (isEmpty) {
      if (isReq) {
        missingRequired.push(key);
      } else {
        missingOptional.push(key);
      }
    }
  }

  const errors = missingRequired.length > 0 ? [ReasonCodes.REQUIRED_FIELD_MISSING] : [];

  return {
    valid: missingRequired.length === 0,
    missingRequired,
    missingOptional,
    errors
  };
}

module.exports = {
  FIELD_KEYS,
  DEFAULT_FIELD_REQUIREMENTS,
  validate
};
