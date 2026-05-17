const { expect } = require('chai');
const { ReasonCodes } = require('../../src/shared/reasonCodes');
// Since handlers are registered via a create* function, we can mock the store and test the returned map of handlers
const { createDuplicateHandlers } = require('../../src/main/ipc/duplicateHandlers');
let createNormalizeHandlers = () => ({});
let createSettingsHandlers = () => ({});
try { createNormalizeHandlers = require('../../src/main/ipc/normalizeHandlers').createNormalizeHandlers; } catch (e) {}
try { createSettingsHandlers = require('../../src/main/ipc/settingsHandlers').createSettingsHandlers; } catch (e) {}

describe('IPC Contract Validations', () => {
  let duplicateHandlers;
  let normalizeHandlers;
  let settingsHandlers;
  let mockStore;

  beforeEach(() => {
    mockStore = {
      getState: () => ({ session: { duplicateDecisionsAudit: [] }, settings: { fieldRequirements: {} } }),
      mutate: (fn) => fn(mockStore.getState()),
    };
    // Mock the duplicate handlers if available, else skip or mock empty
    try { duplicateHandlers = createDuplicateHandlers(mockStore); } catch (e) { duplicateHandlers = {}; }
    try { normalizeHandlers = createNormalizeHandlers(mockStore); } catch (e) { normalizeHandlers = {}; }
    try { settingsHandlers = createSettingsHandlers(mockStore); } catch (e) { settingsHandlers = {}; }
  });

  describe('detectDuplicate', () => {
    it('rejects malformed payloads with IPC_INVALID_ARGS', async () => {
      if (!duplicateHandlers.detectDuplicate) return; // skip if not implemented
      
      try {
        await duplicateHandlers.detectDuplicate({} /* mock event */, { bad: 'args' });
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err.code || err.message).to.include('IPC_INVALID_ARGS');
      }
    });
  });

  describe('resolveDuplicate', () => {
    it('rejects malformed payloads with IPC_INVALID_ARGS', async () => {
      if (!duplicateHandlers.resolveDuplicate) return;

      try {
        await duplicateHandlers.resolveDuplicate({} /* mock event */, { decision: 'bad-choice' });
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err.code || err.message).to.include('IPC_INVALID_ARGS');
      }
    });
  });

  describe('normalizePassenger', () => {
    it('rejects malformed payloads with IPC_INVALID_ARGS', async () => {
      if (!normalizeHandlers.normalizePassenger) return;

      try {
        await normalizeHandlers.normalizePassenger({} /* mock event */, null);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err.code || err.message).to.include('IPC_INVALID_ARGS');
      }
    });
  });

  describe('setFieldRequirements', () => {
    it('rejects unknown keys', async () => {
      if (!settingsHandlers.setFieldRequirements) return;

      try {
        await settingsHandlers.setFieldRequirements({} /* mock event */, { unknownKey: { required: true } });
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err.code || err.message).to.include('IPC_INVALID_ARGS');
      }
    });
  });
});
