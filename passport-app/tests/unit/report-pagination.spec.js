const fs = require('fs');
const path = require('path');
const os = require('os');
const { expect } = require('chai');
const { generateReport } = require('../../src/main/services/reportPdf');

describe('PDF Generation - Pagination & Capacity', () => {
  let tmpPath;

  before(() => {
    tmpPath = path.join(os.tmpdir(), `test-report-1000-${Date.now()}.pdf`);
  });

  after(() => {
    if (fs.existsSync(tmpPath)) {
      fs.unlinkSync(tmpPath);
    }
  });

  it('successfully generates a PDF report for 1000 rows', async () => {
    const passengers = Array.from({ length: 1000 }).map((_, i) => ({
      passport_number: `EG${String(i).padStart(4, '0')}`,
      name: `Test Passenger ${i}`,
      gender: i % 2 === 0 ? 'M' : 'F',
      date_of_birth: '1990-01-01',
      nationality: 'EGY',
      source: 'manifest',
      is_entered: i % 2 === 0,
      is_duplicate: i % 10 === 0
    }));

    const data = {
      voyage: { ship_name: 'Test Ship 1000' },
      passengers
    };

    const result = await generateReport('full', data, tmpPath);
    
    expect(result.ok).to.be.true;
    expect(fs.existsSync(tmpPath)).to.be.true;
    
    const stats = fs.statSync(tmpPath);
    expect(stats.size).to.be.above(10000); // 1000 rows should make a decently large PDF > 10KB
  }).timeout(10000);
});
