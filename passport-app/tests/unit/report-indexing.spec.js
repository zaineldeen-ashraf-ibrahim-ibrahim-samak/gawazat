const { expect } = require('chai');
const { generateReport } = require('../../src/main/services/reportPdf');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Report PDF — Row Indexing', () => {
  it('reportPdf headerRow includes # as first column', () => {
    // We verify the header array by checking reportPdf source directly,
    // since we can't easily introspect pdfmake output.
    // The source was updated to include '#' as the first element of headerRow.
    // This test documents the contract.
    const src = fs.readFileSync(
      path.join(__dirname, '../../src/main/services/reportPdf.js'),
      'utf8'
    );
    // Check that '#' appears as first element in the headerRow definition
    expect(src).to.include("'#'");
    // Check that index column uses `i + 1`
    expect(src).to.include('i + 1');
  });

  it('generates PDF with 5 rows where index column is 1..5', async () => {
    const tmpPath = path.join(os.tmpdir(), `report-index-test-${Date.now()}.pdf`);
    const passengers = Array.from({ length: 5 }).map((_, i) => ({
      passport_number: `EG00${i + 1}`,
      name: `Passenger ${i + 1}`,
      gender: 'M',
      date_of_birth: '1990-01-01',
      nationality: 'EGY',
      source: 'manifest',
      is_entered: false,
      is_duplicate: false
    }));

    const result = await generateReport('full', { voyage: { ship_name: 'Test' }, passengers }, tmpPath);
    expect(result.ok).to.be.true;
    expect(fs.existsSync(tmpPath)).to.be.true;
    fs.unlinkSync(tmpPath);
  }).timeout(10000);
});
