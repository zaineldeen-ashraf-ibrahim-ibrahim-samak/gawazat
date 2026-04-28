const path = require('path');

// Mock store
const store = {
  getState: () => ({
    manifest: [],
    boarding_records: {},
    scan_events: [],
    pending_approval: [],
    appSettings: {}
  }),
  mutate: () => {}
};

try {
  console.log('Testing factory functions...');
  const manifest = require('../src/main/ipc/manifestHandlers').createManifestHandlers(store);
  const scan = require('../src/main/ipc/scanHandlers').createScanHandlers(store);
  const pending = require('../src/main/ipc/pendingHandlers').createPendingHandlers(store);
  const history = require('../src/main/ipc/historyHandlers').createHistoryHandlers(store);
  const reports = require('../src/main/ipc/reportHandlers').createReportHandlers(store);
  const settings = require('../src/main/ipc/settingsHandlers').createSettingsHandlers(store);
  const dashboard = require('../src/main/ipc/dashboardHandlers').createDashboardHandlers(store);
  console.log('All factory functions executed successfully');
} catch (err) {
  console.error('Factory failed:', err);
  process.exit(1);
}
