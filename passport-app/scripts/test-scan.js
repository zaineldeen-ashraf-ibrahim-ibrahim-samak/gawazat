
const { parseFile } = require('../src/main/services/manifestImport.js');
const { DEFAULT_FIELD_REQUIREMENTS } = require('../src/shared/fieldRequirements.js');
const { rebuildIndices } = require('../src/main/store/indices.js');
const { createScanHandlers } = require('../src/main/ipc/scanHandlers.js');
const path = require('path');

async function testScan() {
  // Initialize in-memory store
  const mockStore = {
    state: { manifest: [], boarding_records: {}, scan_events: [], pending_approval: [], settings: {} },
    getState: function() { return this.state; },
    mutate: function(fn) { fn(this.state); }
  };

  const filePath = path.join(__dirname, '../../cases/mock-1000.xlsx');
  
  console.log('Importing 1000 mock passengers...');
  const result = await parseFile(filePath, DEFAULT_FIELD_REQUIREMENTS);
  
  // Populate store
  mockStore.mutate(draft => {
    draft.manifest = result.rows.map((r, i) => ({
       id: `mock-id-${i}`,
       ...r
    }));
  });
  rebuildIndices(mockStore.getState());

  const samplePassenger = result.rows[500]; // pick row 500
  console.log('Sample Passenger to Scan:', samplePassenger.name, '|', samplePassenger.passport_number);

  const scanHandlers = createScanHandlers(mockStore);

  console.log('Submitting scan...');
  console.time('scanTime');
  const scanResult = await scanHandlers.submitManual({
    passport: samplePassenger.passport_number,
    name: samplePassenger.name,
    gender: samplePassenger.gender,
    nationality: samplePassenger.nationality,
    date_of_birth: samplePassenger.date_of_birth
  });
  console.timeEnd('scanTime');
  
  console.log('Scan result outcome:', scanResult.outcome);
  if (scanResult.outcome === 'green') {
    console.log('✅ Success! Passenger found in manifest and boarded instantly.');
  } else {
    console.error('❌ Failed or unexpected outcome:', scanResult);
  }
}

testScan().catch(console.error);
