# Phase 0 Research: Passenger Scanner Enhancements

**Feature**: 002-passenger-scanner-enhancements
**Date**: 2026-05-17

All Technical Context items were resolved during `/speckit.clarify` or from the existing feature 001 architecture. This document records the decisions and the alternatives considered.

---

## R1. Gemini SDK selection and process placement

- **Decision**: Use the official `@google/generative-ai` npm package, imported only from `src/main/services/geminiClient.js`. The renderer reaches it through one IPC method `window.api.normalizePassenger(record)`.
- **Rationale**: Keeps the API key in the Node-privileged `main` process (Constitution III), preserves the renderer's CSP (`connect-src 'self' http://localhost:*`) unchanged, and avoids bundling the SDK into the sandboxed renderer.
- **Alternatives considered**:
  - Direct `fetch` from renderer → rejected: would leak key into renderer bundle and require CSP relaxation.
  - Using REST via raw `https.request` in main → rejected: SDK provides streaming/retry/timeout out of the box; smaller risk surface.

## R2. Gemini configuration via environment variables

- **Decision**: Read at app startup from `process.env`: `GEMINI_API_KEY` (required), `GEMINI_MODEL` (default `gemini-1.5-flash`), `GEMINI_TIMEOUT_MS` (default `2000`), `GEMINI_MAX_RETRIES` (default `1`). Missing required vars → AI normalization is disabled; the app boots with local normalization only and surfaces a one-time settings banner.
- **Rationale**: FR-007 requires environment-variable configuration; defaults keep the app usable without code changes.
- **Alternatives considered**: storing the key in `safeStorage` and entering it via the Settings UI → rejected for now; the spec explicitly calls for env-var configuration. Settings-based key entry can be added later without breaking the IPC contract.

## R3. Gemini fallback semantics

- **Decision**: On Gemini timeout, network error, HTTP 4xx/5xx, or malformed response → fall back to `localNormalize.js` (deterministic: trim, NFC normalize, Title-case Latin, leave Arabic as-is, normalize date strings to ISO `YYYY-MM-DD` via the few formats actually seen in feature 001 manifests). The record is still persisted; the failure reason is attached to the passenger as a non-blocking warning.
- **Rationale**: Aligns with FR-009 (record, don't drop) and the Q3 clarification (online-assumed, no offline queue).
- **Alternatives considered**: queue-and-retry → explicitly rejected in clarification Q3.

## R4. Duplicate matching algorithm (within current session)

- **Decision**:
  - **Exact match** on normalized passport number (strip non-alphanumerics, uppercase) → always blocks insert and surfaces "Already scanned".
  - **Fuzzy match** when passport number does NOT match but ALL of: normalized full name (Levenshtein ≤ 2 on the longer of the two), date of birth equal, and nationality equal — with up to two non-key fields differing or missing → triggers "Is this <existing>?" modal.
  - Index built in-memory as a `Map<normalizedPassport, Passenger>` plus a `Map<normalizedName|dob|nat, Passenger>` rebuilt on session load and updated on every insert (consistent with feature 001's `store/indices.js` pattern).
- **Rationale**: Passport number is the established primary key from feature 001 (`shared/normalize.js`); name/DOB/nationality combination is the most common manifest-vs-scan divergence; Levenshtein ≤ 2 covers transliteration noise without producing excessive false positives.
- **Alternatives considered**: phonetic match (Soundex/Metaphone) — rejected: doesn't work for Arabic; Jaro-Winkler — equivalent quality, more complex.

## R5. Search-bar focus retention

- **Decision**: Fix in `renderer/pages/passengerList.js`. Root cause is almost certainly re-rendering the input element on every keystroke (mounting a new DOM node), which is the only mechanism that loses focus mid-typing in vanilla JS. Solution: render the search input ONCE at page mount, attach an `input` event listener, and re-render only the result rows (`<tbody>`), not the input.
- **Rationale**: Matches the documented bug ("each typed letter requires re-clicking"). No new dependency; pure refactor.
- **Alternatives considered**: re-grab focus after re-render with `el.focus()` — rejected: causes caret-position jumps and selection loss.

## R6. Removing the 100-passenger cap

- **Decision**: Audit feature 001 source for any explicit `=== 100`, `> 100`, or `slice(0, 100)` patterns in `manifestImport.js`, `scanProcessor.js`, `passengerList.js`, `encryptedStore.js`, and `reportPdf.js`. Remove the cap; if none is found, the cap reported in `plan001.md` is likely a list-virtualization or pagination default — add virtualization (chunked rendering, 100 rows visible, all rows in memory) so the UI stays responsive at 1,000 rows without limiting data.
- **Rationale**: SC-003 mandates <2 s interactions at 1,000 passengers; rendering 1,000 `<tr>` nodes at once in Bootstrap-RTL is acceptable in Electron on a modern Windows machine, but a simple windowing approach is cheap insurance.
- **Alternatives considered**: virtual-scrolling library → rejected per Constitution V (no new dependency for a problem solvable in ~40 lines of vanilla JS).

## R7. Import file formats

- **Decision**: `xlsx` via existing SheetJS, `csv` via SheetJS's CSV parser (already bundled), `json` via `JSON.parse` with a documented row schema, `pdf` via `pdf-parse` for tabular text extraction + a simple column-anchor heuristic. Each parser returns the same intermediate `RawPassengerRow[]` so downstream normalization is format-agnostic.
- **Rationale**: SheetJS already handles two of four; `pdf-parse` is the smallest reliable Node PDF extractor; uniform intermediate type minimizes per-format code.
- **Alternatives considered**: `pdfjs-dist` for PDF → rejected: larger bundle, designed for browser rendering not text extraction.

## R8. Row indexing in reports

- **Decision**: Inject the index as the first column at render time (NOT persisted on the entity). Both `reportPdf.js` and any on-screen list iterate the visible (filtered/sorted) collection with a 1-based counter.
- **Rationale**: Index is a presentation concern, not a data attribute; filtering or sorting must produce 1..N in the displayed order (FR-013).
- **Alternatives considered**: store an `index` field — rejected: stale after any filter/sort change.

## R9. Field-requirements configuration

- **Decision**: Add `settings.fieldRequirements` to the encrypted store. Shape: `Record<FieldKey, { required: boolean }>`. Defaults match feature 001's existing required set. Editable via a new section in the existing Settings tab (table of fields + Bootstrap toggle switches). Changes take effect immediately for subsequent scans/imports/manual entries; existing records are NOT re-validated (per spec Edge Case).
- **Rationale**: Single Settings screen (per clarification Q5); existing `settingsHandlers.js` and encrypted-store atomic-write pattern are reused.
- **Alternatives considered**: per-session field overrides → rejected per Constitution V.

## R10. Advanced filter panel

- **Decision**: Filter state is a plain object `{ nationality?, gender?, ageMin?, ageMax?, dobFrom?, dobTo?, documentType?, source? (scan|import|manual), duplicateFlag?, hasWarning? }`. Renderer-only filtering against the in-memory passenger collection; no IPC round-trip per keystroke. Single "Apply" and "Clear" buttons (Bootstrap), with active-filter badge count.
- **Rationale**: With ≤ 1,000 passengers in memory, JS array filtering is sub-millisecond; round-tripping through IPC would be slower and complicate the search-focus fix.
- **Alternatives considered**: per-criterion immediate filtering → fine, but "Apply" is clearer for ports operators and easier to test.

## R11. Specific error/warning reasons

- **Decision**: Introduce a small `Reason` shape `{ code: string, message: string, field?: string, suggestion?: string }` produced by parsers, normalizers, validators, and the duplicate matcher. The renderer maps `code` to an i18n key, so the user always sees an Arabic or English message but tests assert on `code`.
- **Rationale**: Stable codes are testable; messages stay localizable (Constitution I).
- **Alternatives considered**: free-text error strings → rejected; would break locale-parity and brittle to test.

## R12. PII transmission notice (FR-008a)

- **Decision**: On first launch after this feature ships (detected via `settings.geminiNoticeAcknowledged === false`), show a Bootstrap modal with the disclosure text in both languages; the operator clicks Acknowledge, the flag is persisted, and the modal does not appear again.
- **Rationale**: Operationalizes the disclosure requirement added in clarification Q2 without adding role/auth complexity.
- **Alternatives considered**: per-session notice → too noisy; permanent banner → ignored after first day.

---

## Outstanding (Deferred to implementation phase)

- **Observability**: Minimal `electron-log` entries already exist from feature 001. We will add `info` events for each Gemini call outcome (`hit`/`fallback`/`error-{code}`) — no new dependency. Captured here so `/speckit.tasks` includes a logging task.
