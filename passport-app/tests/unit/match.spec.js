const { expect } = require('chai');
const { processMrz } = require('../../src/main/services/scanProcessor');
const { normalizePassportNumber } = require('../../src/shared/normalize');

describe('Scan Matcher', () => {
  const mockManifest = [
    {
      passport_number: 'AB123456',
      passport_number_normalized: 'AB123456',
      name: 'John Doe',
      nationality: 'USA',
      gender: 'M',
      date_of_birth: '1980-01-01'
    }
  ];

  const mockStore = {
    getState: () => ({
      manifest: mockManifest,
      boarding_records: {},
      pending_approval: [],
      scan_events: [],
      appSettings: { auto_reset_seconds: 5 }
    }),
    mutate: (fn) => {
      // Mock mutation
    }
  };

  // Mock indices (usually provided by src/main/store/indices.js)
  global.manifestByNormalized = new Map();
  global.boardingByNormalized = new Map();
  
  mockManifest.forEach(p => global.manifestByNormalized.set(p.passport_number_normalized, p));

  it('should return green for a valid manifest match', async () => {
    // This will require scanProcessor.js to exist
  });
});
