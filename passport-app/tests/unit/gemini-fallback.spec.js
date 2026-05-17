const { expect } = require('chai');
const sinon = require('sinon');
const { ReasonCodes } = require('../../src/shared/reasonCodes');

describe('Gemini Fallback & Normalization (T035)', () => {
  let geminiClient;
  let mockGenAI;
  let normalizePassenger;
  let localNormalizeSpy;
  let getEnvStub;
  let localNormalizeModule;

  beforeEach(() => {
    // Clear modules to mock safely
    delete require.cache[require.resolve('../../src/main/services/geminiClient')];
    delete require.cache[require.resolve('../../src/main/ipc/normalizeHandlers')];
    delete require.cache[require.resolve('../../src/main/services/localNormalize')];

    // Mock localNormalize so we can spy on it
    localNormalizeModule = require('../../src/main/services/localNormalize');
    localNormalizeSpy = sinon.spy(localNormalizeModule, 'normalize');

    // Stub process.env to control GEMINI vars
    getEnvStub = sinon.stub(process, 'env').value({});
  });

  afterEach(() => {
    sinon.restore();
    delete require.cache[require.resolve('../../src/main/services/geminiClient')];
    delete require.cache[require.resolve('../../src/main/ipc/normalizeHandlers')];
    delete require.cache[require.resolve('../../src/main/services/localNormalize')];
  });

  it('falls back to local normalize with GEMINI_DISABLED if GEMINI_API_KEY is missing', async () => {
    sinon.stub(process, 'env').value({});
    geminiClient = require('../../src/main/services/geminiClient');
    const { createNormalizeHandlers } = require('../../src/main/ipc/normalizeHandlers');
    const handlers = createNormalizeHandlers({ /* mock store */ });
    normalizePassenger = handlers.normalizePassenger;

    const raw = { name: 'test' };
    const res = await normalizePassenger({}, raw);

    expect(res.source).to.equal('local-fallback');
    expect(res.warnings).to.include(ReasonCodes.GEMINI_DISABLED);
    expect(localNormalizeSpy.calledOnce).to.be.true;
    expect(res.normalized.name).to.equal('TEST'); // local normalize uppercase
  });

  it('falls back to local normalize with GEMINI_TIMEOUT if SDK times out', async () => {
    sinon.stub(process, 'env').value({ GEMINI_API_KEY: 'test-key', GEMINI_TIMEOUT_MS: '10' });
    
    // Mock the SDK
    const mockModel = {
      generateContent: sinon.stub().rejects(Object.assign(new Error('Timeout'), { name: 'AbortError' }))
    };
    mockGenAI = {
      GoogleGenerativeAI: sinon.stub().returns({ getGenerativeModel: () => mockModel })
    };
    
    const Module = require('module');
    const originalRequire = Module.prototype.require;
    sinon.stub(Module.prototype, 'require').callsFake(function(path) {
      if (path === '@google/generative-ai') return mockGenAI;
      return originalRequire.apply(this, arguments);
    });

    geminiClient = require('../../src/main/services/geminiClient');
    const { createNormalizeHandlers } = require('../../src/main/ipc/normalizeHandlers');
    const handlers = createNormalizeHandlers({ });
    normalizePassenger = handlers.normalizePassenger;

    const raw = { name: 'test' };
    const res = await normalizePassenger({}, raw);

    expect(res.source).to.equal('local-fallback');
    expect(res.warnings).to.include(ReasonCodes.GEMINI_TIMEOUT);
    expect(localNormalizeSpy.calledOnce).to.be.true;
  });

  it('falls back to local normalize with GEMINI_BAD_RESPONSE if JSON is unparseable', async () => {
    sinon.stub(process, 'env').value({ GEMINI_API_KEY: 'test-key' });
    
    const mockModel = {
      generateContent: sinon.stub().resolves({
        response: { text: () => 'Not JSON' }
      })
    };
    mockGenAI = {
      GoogleGenerativeAI: sinon.stub().returns({ getGenerativeModel: () => mockModel })
    };
    
    const Module = require('module');
    const originalRequire = Module.prototype.require;
    sinon.stub(Module.prototype, 'require').callsFake(function(path) {
      if (path === '@google/generative-ai') return mockGenAI;
      return originalRequire.apply(this, arguments);
    });

    geminiClient = require('../../src/main/services/geminiClient');
    const { createNormalizeHandlers } = require('../../src/main/ipc/normalizeHandlers');
    const handlers = createNormalizeHandlers({ });
    normalizePassenger = handlers.normalizePassenger;

    const raw = { name: 'test' };
    const res = await normalizePassenger({}, raw);

    expect(res.source).to.equal('local-fallback');
    expect(res.warnings).to.include(ReasonCodes.GEMINI_BAD_RESPONSE);
    expect(localNormalizeSpy.calledOnce).to.be.true;
  });

  it('returns Gemini source and confidence on success', async () => {
    sinon.stub(process, 'env').value({ GEMINI_API_KEY: 'test-key' });
    
    const validJson = JSON.stringify({
      passportNumber: 'EG123',
      givenName: 'Ali',
      confidence: 0.95
    });

    const mockModel = {
      generateContent: sinon.stub().resolves({
        response: { text: () => validJson }
      })
    };
    mockGenAI = {
      GoogleGenerativeAI: sinon.stub().returns({ getGenerativeModel: () => mockModel })
    };
    
    const Module = require('module');
    const originalRequire = Module.prototype.require;
    sinon.stub(Module.prototype, 'require').callsFake(function(path) {
      if (path === '@google/generative-ai') return mockGenAI;
      return originalRequire.apply(this, arguments);
    });

    geminiClient = require('../../src/main/services/geminiClient');
    const { createNormalizeHandlers } = require('../../src/main/ipc/normalizeHandlers');
    const handlers = createNormalizeHandlers({ });
    normalizePassenger = handlers.normalizePassenger;

    const raw = { passportNumber: ' eg123 ' };
    const res = await normalizePassenger({}, raw);

    expect(res.source).to.equal('gemini');
    expect(res.confidence).to.equal(0.95);
    expect(res.warnings).to.be.undefined;
    expect(localNormalizeSpy.called).to.be.false;
    expect(res.normalized.givenName).to.equal('Ali');
  });
});
