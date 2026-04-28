// Test all module requires and factory initialization
const path = require('path');

const store = {
  getState: () => ({
    schemaVersion: 1,
    voyage: null,
    manifest: [],
    scan_events: [],
    boarding_records: {},
    pending_approval: [],
    settings: {
      scan_mode: 'keyboard',
      regula_url: 'http://localhost:8080',
      ship_name: '',
      auto_reset_seconds: 3,
    }
  }),
  mutate: (fn) => {}
};

const tests = [
  ['manifestHandlers', '../src/main/ipc/manifestHandlers', 'createManifestHandlers'],
  ['scanHandlers', '../src/main/ipc/scanHandlers', 'createScanHandlers'],
  ['pendingHandlers', '../src/main/ipc/pendingHandlers', 'createPendingHandlers'],
  ['historyHandlers', '../src/main/ipc/historyHandlers', 'createHistoryHandlers'],
  ['reportHandlers', '../src/main/ipc/reportHandlers', 'createReportHandlers'],
  ['settingsHandlers', '../src/main/ipc/settingsHandlers', 'createSettingsHandlers'],
  ['dashboardHandlers', '../src/main/ipc/dashboardHandlers', 'createDashboardHandlers'],
];

let allPassed = true;
for (const [name, modPath, factory] of tests) {
  try {
    const mod = require(modPath);
    const handlers = mod[factory](store);
    const methods = Object.keys(handlers);
    console.log(`✓ ${name}: ${methods.join(', ')}`);
  } catch (err) {
    console.error(`✗ ${name}: ${err.message}`);
    allPassed = false;
  }
}

// Check entities
try {
  const entities = require('../src/shared/entities');
  const event = entities.makeScanEvent({ passport_number_normalized: 'TEST123', passenger_id: 'pid1', outcome: 'green' });
  console.log(`✓ makeScanEvent: passport_number_normalized=${event.passport_number_normalized}, passenger_id=${event.passenger_id}, at=${event.at}`);
  
  const boarding = entities.makeBoardingRecord({ passenger_id: 'pid1', passport_number_normalized: 'TEST123', scan_event_id: 'sid1' });
  console.log(`✓ makeBoardingRecord: passenger_id=${boarding.passenger_id}, last_scan_event_id=${boarding.last_scan_event_id}`);
} catch (err) {
  console.error(`✗ entities: ${err.message}`);
  allPassed = false;
}

console.log(allPassed ? '\n✓ ALL TESTS PASSED' : '\n✗ SOME TESTS FAILED');
process.exit(allPassed ? 0 : 1);
