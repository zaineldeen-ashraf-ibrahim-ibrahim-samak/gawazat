/**
 * geminiClient.js
 * Normalizes passenger records via Gemini API
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('./logger');

// Load config from environment once at module load
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const GEMINI_TIMEOUT_MS = parseInt(process.env.GEMINI_TIMEOUT_MS, 10) || 2000;
const GEMINI_MAX_RETRIES = parseInt(process.env.GEMINI_MAX_RETRIES, 10) || 1;

let genAI = null;
let model = null;
let disabledForSession = false;

if (!GEMINI_API_KEY) {
  disabledForSession = true;
  logger.info('geminiClient initialized: disabled (no API key)');
} else {
  try {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    logger.info(`geminiClient initialized: model=${GEMINI_MODEL}`);
  } catch (err) {
    disabledForSession = true;
    logger.error(`geminiClient failed to initialize: ${err.message}`);
  }
}

class GeminiError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'GeminiError';
    this.code = code; // e.g., 'GEMINI_TIMEOUT', 'GEMINI_BAD_RESPONSE'
  }
}

/**
 * Normalizes a raw passenger record via Gemini.
 * @param {Object} raw - The raw passenger record
 * @returns {Promise<{ normalized: Object, confidence: number | null }>}
 */
async function normalize(raw) {
  if (disabledForSession) {
    throw new GeminiError('Gemini is disabled for this session', 'GEMINI_DISABLED');
  }

  const prompt = `
Treat the input as a passenger record from a passport/manifest.
Return JSON with the following fields extracted and normalized:
- "passportNumber" (verbatim, uppercase, alphanumerics only)
- "givenName"
- "familyName"
- "dob" (ISO YYYY-MM-DD)
- "nationality" (ISO 3166-1 alpha-3 if possible)
- "gender" (M/F/X)
- "documentType"
- "confidence" (number 0..1 representing confidence in extraction)

CRITICAL RULES:
- Preserve Arabic script as Arabic; do not transliterate unless the input was already Latin.
- Do not add markdown backticks around the JSON output, just output raw JSON.

Input Record:
${JSON.stringify(raw)}
  `;

  let attempt = 0;
  let lastError = null;

  while (attempt <= GEMINI_MAX_RETRIES) {
    try {
      // AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

      const result = await model.generateContent(prompt, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const text = result.response.text();
      let parsed;
      try {
        // Strip markdown backticks if Gemini ignores instructions
        const cleanText = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
        parsed = JSON.parse(cleanText);
      } catch (parseErr) {
        logger.info('Gemini call outcome: fallback-GEMINI_BAD_RESPONSE');
        throw new GeminiError('Failed to parse Gemini response as JSON', 'GEMINI_BAD_RESPONSE');
      }

      logger.info('Gemini call outcome: hit');
      const { confidence, ...normalized } = parsed;
      return {
        normalized,
        confidence: typeof confidence === 'number' ? confidence : null
      };

    } catch (err) {
      if (err instanceof GeminiError) throw err; // re-throw our own typed errors

      if (err.name === 'AbortError') {
        lastError = new GeminiError('Gemini request timed out', 'GEMINI_TIMEOUT');
      } else if (err.status >= 400 && err.status < 500) {
        disabledForSession = true; // disable on auth/config errors
        logger.info('Gemini call outcome: fallback-GEMINI_AUTH_FAILED');
        throw new GeminiError('Gemini auth/config failed', 'GEMINI_AUTH_FAILED');
      } else {
        lastError = new GeminiError('Gemini transient error', 'GEMINI_TRANSIENT');
      }
      
      attempt++;
      if (attempt <= GEMINI_MAX_RETRIES) {
        // simple backoff could be added here
      }
    }
  }

  logger.info(`Gemini call outcome: fallback-${lastError.code}`);
  throw lastError;
}

module.exports = { normalize, GeminiError };
