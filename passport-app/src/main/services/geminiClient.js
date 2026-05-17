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
- "nationality" (ISO 3166-1 alpha-3 if possible, e.g. "مصر" -> "EGY", "سوريا" -> "SYR")
- "gender" (M/F/X)
- "documentType"
- "confidence" (number 0..1 representing confidence in extraction)

CRITICAL RULES:
- Preserve Arabic script as Arabic for names; do not transliterate unless the input was already Latin.
- However, for "nationality" you MUST translate Arabic or other languages into the 3-letter ISO code.
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

/**
 * Normalize a batch of records in a single Gemini call. Returns an array
 * the same length as the input. Throws GeminiError on failure so callers
 * can decide whether to fall back to local-per-row normalization.
 *
 * Sending many rows in one prompt gives the model cross-row context (it can
 * spot mis-aligned columns, infer country codes from siblings, etc.) and
 * keeps the wall-clock import time roughly proportional to ceil(N/batch).
 */
async function normalizeBatch(records) {
  if (!Array.isArray(records) || records.length === 0) return [];
  if (disabledForSession) {
    throw new GeminiError('Gemini is disabled for this session', 'GEMINI_DISABLED');
  }

  const prompt = `
You are given an array of passenger records pulled from a manifest spreadsheet.
The cells may include partial/misaligned data — your job is to read each row
intelligently and produce a normalized passenger record.

For EACH input record, return one object with these fields:
- "passportNumber"  (verbatim, uppercase, alphanumerics only)
- "givenName"
- "familyName"
- "name"            (full display name; family + given when both available)
- "dob"             (ISO YYYY-MM-DD)
- "nationality"     (ISO 3166-1 alpha-3 if at all possible — convert country names, EVEN Arabic ones, to 3-letter codes. e.g., "United Kingdom" → "GBR", "Egypt" or "مصر" → "EGY", "سوريا" → "SYR")
- "gender"          ("M" / "F" / "X"; map "Male"/"Female"/Arabic equivalents)
- "documentType"
- "confidence"      (number 0..1)

CRITICAL RULES:
- Output a JSON ARRAY only — no markdown fences, no prose, same length and order as input.
- If a field cannot be determined, set it to null (do NOT invent data).
- Preserve Arabic script as Arabic for names; do not transliterate unless the input was already Latin.
- However, for "nationality" you MUST translate Arabic or other languages into the 3-letter ISO code.
- Use cross-row context: if most rows in the batch are EGY and the column for one row says "Egypt" or "مصر", emit "EGY".

Input Records (JSON array):
${JSON.stringify(records)}
`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), Math.max(GEMINI_TIMEOUT_MS, 8000));

  try {
    const result = await model.generateContent(prompt, { signal: controller.signal });
    clearTimeout(timeoutId);

    const text = result.response.text();
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      throw new GeminiError('Batch response was not valid JSON', 'GEMINI_BAD_RESPONSE');
    }
    if (!Array.isArray(parsed)) {
      throw new GeminiError('Batch response was not a JSON array', 'GEMINI_BAD_RESPONSE');
    }
    if (parsed.length !== records.length) {
      logger.info(`Gemini batch length mismatch: got ${parsed.length}, expected ${records.length}`);
      // tolerate by padding/truncating
      while (parsed.length < records.length) parsed.push({});
      parsed.length = records.length;
    }
    logger.info(`Gemini batch normalize: ${records.length} records → hit`);
    return parsed.map(obj => {
      const { confidence, ...rest } = (obj && typeof obj === 'object') ? obj : {};
      return { normalized: rest, confidence: typeof confidence === 'number' ? confidence : null };
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof GeminiError) throw err;
    if (err.name === 'AbortError') {
      throw new GeminiError('Gemini batch request timed out', 'GEMINI_TIMEOUT');
    }
    if (err.status >= 400 && err.status < 500) {
      disabledForSession = true;
      throw new GeminiError('Gemini auth/config failed', 'GEMINI_AUTH_FAILED');
    }
    throw new GeminiError(`Gemini batch transient: ${err.message}`, 'GEMINI_TRANSIENT');
  }
}

function getStatus() {
  return {
    hasKey: !!GEMINI_API_KEY,
    enabled: !disabledForSession,
    model: GEMINI_MODEL
  };
}

module.exports = { normalize, normalizeBatch, GeminiError, getStatus };

