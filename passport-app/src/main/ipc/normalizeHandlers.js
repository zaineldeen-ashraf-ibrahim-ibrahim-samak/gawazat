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

  /**
   * Normalize many records at once. Tries Gemini batch first; on any failure
   * falls back to local normalize for every record so the caller never sees
   * an empty/partial result. The returned array preserves input order and
   * length.
   */
  async function normalizePassengerBatch(event, records) {
    if (!Array.isArray(records)) {
      const err = new Error('Invalid arguments: records must be an array');
      err.code = 'IPC_INVALID_ARGS';
      throw err;
    }
    if (records.length === 0) return [];

    try {
      const aiResults = await geminiClient.normalizeBatch(records);
      return aiResults.map(r => ({
        normalized: r.normalized,
        confidence: r.confidence,
        source: 'gemini-batch'
      }));
    } catch (err) {
      const code = err instanceof geminiClient.GeminiError ? err.code : 'GEMINI_TRANSIENT';
      // Local fallback for every record — keeps the import moving when AI is
      // disabled, rate-limited, or returning malformed JSON.
      return records.map(raw => {
        const local = localNormalize(raw);
        return {
          normalized: local.normalized,
          confidence: local.confidence,
          source: 'local-fallback',
          warnings: [code]
        };
      });
    }
  }

  return {
    normalizePassenger,
    normalizePassengerBatch
  };
}

module.exports = { createNormalizeHandlers };
