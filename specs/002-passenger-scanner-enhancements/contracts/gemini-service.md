# Contract: Gemini Normalization Service

**Feature**: 002-passenger-scanner-enhancements
**File**: `src/main/services/geminiClient.js`
**SDK**: `@google/generative-ai`
**Process**: `main` only (never imported in renderer)

---

## Configuration (environment variables)

| Var | Required | Default | Purpose |
|---|---|---|---|
| `GEMINI_API_KEY` | yes | — | Auth. Missing → service permanently disabled this session. |
| `GEMINI_MODEL` | no | `gemini-1.5-flash` | Model id. |
| `GEMINI_TIMEOUT_MS` | no | `2000` | Per-request timeout. |
| `GEMINI_MAX_RETRIES` | no | `1` | Retries on 5xx/timeout. |

Resolution happens once at app startup (`whenReady`). The resolved values are cached. A change requires app restart (per FR-007 and clarification).

## Request

The service exposes one function:

```
normalize(raw: object) → Promise<{
  normalized: object,
  confidence: number | null
}>
```

Internally it sends a single text-completion prompt instructing Gemini to:

1. Treat the input as a passenger record from a passport/manifest.
2. Return JSON with: `passportNumber` (verbatim, uppercase, alphanumerics only), `givenName`, `familyName`, `dob` (ISO `YYYY-MM-DD`), `nationality` (ISO 3166-1 alpha-3 if possible), `gender` (`M`/`F`/`X`), `documentType`, and a `confidence` 0..1.
3. Preserve Arabic script as Arabic; do not transliterate unless the input was already Latin.

The full record is sent as-is per clarification Q2; no field-level redaction is performed.

## Response handling

- **HTTP 200 with parseable JSON** → return `{ normalized, confidence }`.
- **HTTP 200 with unparseable JSON** → throw `GeminiResponseError`; caller falls back to local normalization with reason `GEMINI_BAD_RESPONSE`.
- **HTTP 4xx (auth/config)** → throw `GeminiAuthError`; service is disabled for the remainder of the session (no retry storm); reason `GEMINI_AUTH_FAILED`.
- **HTTP 5xx or network error** → retry up to `GEMINI_MAX_RETRIES`; on final failure throw `GeminiTransientError`; reason `GEMINI_TRANSIENT`.
- **Timeout** → throw `GeminiTimeoutError`; reason `GEMINI_TIMEOUT`.

All errors are logged via `electron-log` at `info` level with the reason code only — never the passenger payload, never the API key.

## Fallback contract

When this service throws OR is disabled, callers MUST call `src/main/services/localNormalize.js#normalize(raw)` which is synchronous and never fails. The resulting record carries `source: 'local-fallback'` and a `warning` Reason with the appropriate code.

## Test surface (planned)

`tests/unit/gemini-fallback.spec.js`:

- Missing `GEMINI_API_KEY` → `normalizePassenger` IPC returns `source: 'local-fallback'`, warning `GEMINI_DISABLED`.
- Mocked SDK throws timeout → returns `source: 'local-fallback'`, warning `GEMINI_TIMEOUT`.
- Mocked SDK returns unparseable JSON → returns `source: 'local-fallback'`, warning `GEMINI_BAD_RESPONSE`.
- Mocked SDK returns valid JSON → returns `source: 'gemini'`, populated `confidence`.
