const { normalize: localNormalize } = require('../services/localNormalize');
const geminiClient = require('../services/geminiClient');

function createNormalizeHandlers(store) {
  /**
   * Handle normalizePassenger request
   * @param {Object} event - IPC event
   * @param {Object} raw - The raw passenger record
   * @returns {Promise<{ normalized: Object, confidence: number | null, source: string, warnings?: string[] }>}
   */
  async function normalizePassenger(event, raw) {
    if (!raw || typeof raw !== 'object') {
      const err = new Error('Invalid arguments: raw must be an object');
      err.code = 'IPC_INVALID_ARGS';
      throw err;
    }

    try {
      // Attempt Gemini normalization
      const result = await geminiClient.normalize(raw);
      return {
        normalized: result.normalized,
        confidence: result.confidence,
        source: 'gemini'
      };
    } catch (err) {
      // Fallback to local normalization
      const fallbackResult = localNormalize(raw);
      
      const warnings = [];
      if (err instanceof geminiClient.GeminiError) {
        warnings.push(err.code);
      } else {
        warnings.push('GEMINI_TRANSIENT');
      }

      return {
        normalized: fallbackResult.normalized,
        confidence: fallbackResult.confidence,
        source: 'local-fallback',
        warnings
      };
    }
  }

  return {
    normalizePassenger
  };
}

module.exports = { createNormalizeHandlers };
