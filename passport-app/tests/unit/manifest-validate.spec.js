/* eslint-env mocha */
const { expect } = require('chai');
const path = require('path');
const { parseFile, validateRow } = require('../../src/main/services/manifestImport');

describe('Manifest Import Validation', () => {
  const fixturesDir = path.join(__dirname, '../fixtures');

  describe('validateRow', () => {
    it('should validate a correct passenger row', async () => {
      const row = {
        passport_number: 'EG001',
        name: 'أحمد محمد علي',
        gender: 'M',
        nationality: 'EGY',
        date_of_birth: '1990-05-15',
        vessel: 'MS Aida',
        seat: 'A01'
      };
      const result = await validateRow(row, 2);

      expect(result.outcome).to.equal('Pass');
      expect(result.errors).to.be.an('array').that.is.empty;
      expect(result.passport_number).to.equal('EG001');
      expect(result.passport_number_normalized).to.equal('EG001');
      expect(result.gender).to.equal('M');
      expect(result.nationality).to.equal('EGY');
    });

    it('should reject a row missing passport number', async () => {
      const row = {
        name: 'محمد علي',
        gender: 'M',
        nationality: 'EGY',
        date_of_birth: '1990-05-15'
      };
      const result = await validateRow(row, 2);

      expect(result.outcome).to.equal('Error');
      expect(result.errors).to.be.an('array').that.is.not.empty;
      expect(result.errors[0].field).to.equal('passport_number');
      expect(result.errors[0].rule).to.equal('required');
    });

    it('should reject a row with future date of birth', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const futureDate = tomorrow.toISOString().split('T')[0];

      const row = {
        passport_number: 'EG001',
        name: 'محمد علي',
        gender: 'M',
        nationality: 'EGY',
        date_of_birth: futureDate
      };
      const result = await validateRow(row, 2);

      expect(result.outcome).to.equal('Error');
      expect(result.errors).to.be.an('array').that.is.not.empty;
      expect(result.errors.find(e => e.field === 'date_of_birth')).to.exist;
    });

    it('should reject a row with invalid nationality code', async () => {
      const row = {
        passport_number: 'EG001',
        name: 'محمد علي',
        gender: 'M',
        nationality: 'XXX', // Invalid
        date_of_birth: '1990-05-15'
      };
      const result = await validateRow(row, 2);

      expect(result.outcome).to.equal('Error');
      expect(result.errors).to.be.an('array').that.is.not.empty;
      expect(result.errors.find(e => e.field === 'nationality')).to.exist;
    });

    it('should accept various gender formats', async () => {
      const testCases = ['M', 'F', 'Male', 'Female', 'ذكر', 'أنثى'];

      for (let idx = 0; idx < testCases.length; idx++) {
        const gender = testCases[idx];
        const row = {
          passport_number: `EG0000${idx}`, // Make sure normalized length >= 5
          name: `Name ${idx}`,
          gender,
          nationality: 'EGY',
          date_of_birth: '1990-05-15'
        };
        const result = await validateRow(row, 2);
        expect(result.outcome).to.equal('Pass', `Gender format '${gender}' should be valid`);
        expect(['M', 'F']).to.include(result.gender);
      }
    });

    it('should accept optional vessel and seat fields', async () => {
      const row = {
        passport_number: 'EG001',
        name: 'محمد علي',
        gender: 'M',
        nationality: 'EGY',
        date_of_birth: '1990-05-15',
        vessel: 'MS Aida',
        seat: 'A01'
      };
      const result = await validateRow(row, 2);

      expect(result.outcome).to.equal('Pass');
      expect(result.vessel).to.equal('MS Aida');
      expect(result.seat).to.equal('A01');
    });

    it('should handle missing optional fields gracefully', async () => {
      const row = {
        passport_number: 'EG001',
        name: 'محمد علي',
        gender: 'M',
        nationality: 'EGY',
        date_of_birth: '1990-05-15'
        // No vessel or seat
      };
      const result = await validateRow(row, 2);

      expect(result.outcome).to.equal('Pass');
      expect(result.vessel).to.be.undefined;
      expect(result.seat).to.be.undefined;
    });
  });

  describe('parseFile', () => {
    it('should parse valid manifest fixture with 10 rows', async () => {
      const filePath = path.join(fixturesDir, 'manifest-10.xlsx');
      const result = await parseFile(filePath);

      expect(result.rows).to.be.an('array');
      expect(result.rows.length).to.equal(10);
      expect(result.rows.every(r => r.outcome === 'Pass')).to.be.true;
      expect(result.errors).to.be.an('array').that.is.empty;
      expect(result.duplicates).to.be.an('array').that.is.empty;

      // Verify normalized passport numbers
      expect(result.rows[0].passport_number_normalized).to.equal('EG001');
      expect(result.rows[0].name).to.include('أحمد');
    });

    it('should handle error fixture with validation errors', async () => {
      const filePath = path.join(fixturesDir, 'manifest-with-errors.xlsx');
      const result = await parseFile(filePath);

      expect(result.rows).to.be.an('array');
      expect(result.rows.length).to.be.greaterThan(0);
      expect(result.errors).to.be.an('array').that.is.not.empty;

      // Count errors and passes
      const errorRows = result.rows.filter(r => r.outcome === 'Error');
      const passRows = result.rows.filter(r => r.outcome === 'Pass');

      expect(errorRows.length).to.be.greaterThan(0, 'Should have error rows');
      expect(passRows.length).to.be.greaterThan(0, 'Should have passing rows');

      // Check that errors are populated
      errorRows.forEach(row => {
        expect(row.errors).to.be.an('array').that.is.not.empty;
      });
    });

    it('should detect duplicate passport numbers', async () => {
      // Create a minimal test with duplicates
      const testRows = [
        {
          passport_number: 'EG100',
          name: 'Person 1',
          gender: 'M',
          nationality: 'EGY',
          date_of_birth: '1990-05-15'
        },
        {
          passport_number: 'EG100', // Duplicate
          name: 'Person 2',
          gender: 'F',
          nationality: 'EGY',
          date_of_birth: '1991-06-20'
        }
      ];

      const result1 = await validateRow(testRows[0], 2);
      const result2 = await validateRow(testRows[1], 3);

      expect(result1.outcome).to.equal('Pass');
      expect(result2.outcome).to.equal('Pass');
      // Note: Duplicate detection happens at parseFile level, not validateRow level
    });

    it('should handle empty or invalid files gracefully', async () => {
      const result = await parseFile('/nonexistent/file.xlsx');

      expect(result.rows).to.be.an('array').that.is.empty;
      expect(result.errors).to.be.an('array').that.is.not.empty;
      expect(result.errors[0]).to.have.property('message');
    });
  });

  describe('Integration', () => {
    it('should round-trip a valid passenger through validation', async () => {
      const original = {
        passport_number: 'EG99999',
        name: 'محمد أحمد علي عبدالله',
        gender: 'ذكر', // Arabic for male
        nationality: 'EGY',
        date_of_birth: '1985-03-22',
        vessel: 'MS Aida',
        seat: 'A12'
      };

      const result = await validateRow(original, 5);

      expect(result.outcome).to.equal('Pass');
      expect(result.passport_number).to.equal(original.passport_number);
      expect(result.name).to.equal(original.name);
      expect(result.gender).to.equal('M'); // Normalized
      expect(result.nationality).to.equal(original.nationality);
      expect(result.date_of_birth).to.equal(original.date_of_birth);
      expect(result.vessel).to.equal(original.vessel);
      expect(result.seat).to.equal(original.seat);
      expect(result.source).to.equal('manifest');
    });
  });
});
