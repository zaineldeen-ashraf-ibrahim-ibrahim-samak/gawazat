---

description: "Task list for Passenger Scanner Enhancements (feature 002)"
---

# Tasks: Passenger Scanner Enhancements

**Input**: Design documents from `/specs/002-passenger-scanner-enhancements/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included — Constitution IV (Test-First Discipline) mandates unit, IPC contract, locale-parity, and E2E coverage for every change.

**Organization**: Tasks are grouped by user story so each can be implemented and validated independently. Story IDs map to spec.md (US1..US8).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Parallelizable (different file, no dependency on an incomplete task in the same phase)
- **[Story]**: User-story label (US1..US8); omitted for Setup, Foundational, and Polish phases
- All file paths are relative to the existing `passport-app/` project from feature 001

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: New dependencies and config plumbing needed by every story below.

- [X] T001 Install `@google/generative-ai` and `pdf-parse` in `passport-app/package.json` and lock the versions (`npm install --save @google/generative-ai pdf-parse`)
- [X] T002 [P] Create `passport-app/.env.example` documenting `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_TIMEOUT_MS`, `GEMINI_MAX_RETRIES`
- [X] T003 [P] Ensure `passport-app/.env.local` is listed in `.gitignore`
- [X] T004 [P] Add `dotenv` loading at the top of `passport-app/src/main/index.js` (`require('dotenv').config({ path: '.env.local' })` guarded for non-production)
- [X] T005 [P] Add npm scripts `test:unit:new` and `test:e2e:002` to `passport-app/package.json` scoped to the new test files for fast iteration

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Cross-story building blocks. No user-story phase may start until this phase is green.

- [X] T006 Create `passport-app/src/shared/reasonCodes.js` exporting frozen constants for every `Reason.code` listed in data-model.md and contracts/ (`MRZ_CHECKSUM_FAILED`, `DOB_UNPARSEABLE`, `DUPLICATE_PASSPORT`, `GEMINI_TIMEOUT`, `GEMINI_DISABLED`, `GEMINI_BAD_RESPONSE`, `GEMINI_AUTH_FAILED`, `GEMINI_TRANSIENT`, `REQUIRED_FIELD_MISSING`, `IPC_INVALID_ARGS`, `IMPORT_NO_PASSPORT`, `IMPORT_DOB_UNPARSEABLE`, `IMPORT_JSON_BAD_ELEMENT`, `IMPORT_PDF_NO_TABLE`, `IMPORT_FORMAT_UNSUPPORTED`, `IMPORT_FILE_UNREADABLE`)
- [X] T007 [P] Create `passport-app/src/shared/fieldRequirements.js` exporting the canonical `FIELD_KEYS` list and `DEFAULT_FIELD_REQUIREMENTS` matching feature 001's required set (passport number, family name, given name, DOB, nationality required; gender, document type optional)
- [X] T008 [P] Extend `passport-app/renderer/i18n/locales/ar.json` and `en.json` with a `reasons.*` namespace — one key per code from T006 — and matching `duplicate.*`, `filters.*`, `fieldRequirements.*`, `geminiNotice.*` namespaces (keep AR and EN at perfect key-parity)
- [X] T009 Extend `passport-app/src/main/store/encryptedStore.js` to persist new settings keys (`settings.fieldRequirements`, `settings.geminiNoticeAcknowledged`) with safe defaults if absent; preserve atomic-write behavior
- [X] T010 [P] Audit `passport-app/src/main/services/manifestImport.js`, `scanProcessor.js`, `store/encryptedStore.js`, and `renderer/pages/passengerList.js` for any explicit `100` / `slice(0, 100)` / `length > 100` guard; remove or replace with windowed rendering; document findings inline as a one-line comment per removal
- [X] T011 [P] Add `tests/unit/reason-codes.spec.js` asserting every code referenced in production code exists in `src/shared/reasonCodes.js` and every code has matching `ar` + `en` i18n keys (extends the existing locale-parity test in `tests/locale/parity.spec.js`)

**Checkpoint**: Foundation ready — user-story phases may begin in parallel.

---

## Phase 3: User Story 1 — Reliable Duplicate Detection on Import/Scan (Priority: P1) 🎯 MVP

**Goal**: A re-scan or re-import within the current session is blocked with "Already scanned"; a fuzzy match opens the "Is this …?" modal allowing Merge / Keep separate / Cancel.

**Independent Test**: Scan or import the same passport twice within one session — duplicate is rejected; scan a partial-match record — modal appears and resolution is honored.

### Tests for User Story 1 (write first, ensure failing)

- [X] T012 [P] [US1] `tests/unit/duplicate-matcher.spec.js` — exact match on normalized passport key blocks; fuzzy match on name+DOB+nationality with ≤2 differing/missing fields returns `kind: 'fuzzy'`; no false positives across name length difference > 2 Levenshtein
- [X] T013 [P] [US1] `tests/unit/ipc-contract.spec.js` (new file) — `detectDuplicate` and `resolveDuplicate` accept/reject argument shapes per `contracts/ipc-bridge-additions.md`
- [X] T014 [P] [US1] `tests/e2e/duplicate-flow.spec.js` — Playwright: scan same passport twice → toast "Already scanned"; scan partial-match → modal opens; selecting Merge updates existing row; selecting Keep separate creates a second row; Cancel inserts nothing

### Implementation for User Story 1

- [X] T015 [P] [US1] Create `passport-app/src/main/services/duplicateMatcher.js` implementing in-memory `Map<passportNumberKey, Passenger>` + `Map<\`${normalizedName}|${dob}|${nationality}\`, Passenger>` and exporting `detect(normalized)` returning `{kind:'none'|'exact'|'fuzzy', existingPassengerId?, differences?}` (Levenshtein helper inline; no new dep)
- [X] T016 [US1] Extend `passport-app/src/main/store/indices.js` to build both maps on session load and update them on every insert/merge/delete (depends on T015)
- [X] T017 [P] [US1] Create `passport-app/src/main/ipc/duplicateHandlers.js` registering `ipcMain.handle('detectDuplicate', ...)` and `ipcMain.handle('resolveDuplicate', ...)` per `contracts/ipc-bridge-additions.md`; persist a `DuplicateDecision` audit entry on every resolve
- [X] T018 [US1] Wire the new handlers in `passport-app/src/main/ipc/registry.js` and expose `window.api.detectDuplicate` and `window.api.resolveDuplicate` in `passport-app/src/main/preload.js` (with shape re-validation that emits `IPC_INVALID_ARGS`)
- [X] T019 [P] [US1] Modify `passport-app/src/main/services/scanProcessor.js` so every accepted scan calls `duplicateMatcher.detect` BEFORE insert; on `exact` short-circuit with a warning event; on `fuzzy` emit a renderer event with the candidate
- [X] T020 [US1] Modify `passport-app/src/main/services/manifestImport.js` to apply the same gating during bulk import, collecting fuzzy candidates into `ImportResult.fuzzyPrompts` (per `contracts/ipc-bridge-additions.md`)
- [X] T021 [P] [US1] Create `passport-app/renderer/components/duplicateConfirmModal.js` — Bootstrap 5 RTL modal that renders the field-difference table and emits `merge|keep-separate|cancel`; all strings via `i18next` `duplicate.*` keys
- [X] T022 [US1] Update `passport-app/renderer/pages/scan.js` to show "Already scanned" toast on `kind:'exact'` and open the modal on `kind:'fuzzy'`, then call `window.api.resolveDuplicate` with the operator's choice
- [X] T023 [US1] Update `passport-app/renderer/pages/import.js` to walk `fuzzyPrompts` one at a time via the same modal and report final counts in the import summary
- [X] T024 [US1] Add `duplicateFlag` to each persisted Passenger in `passport-app/src/shared/entities.js` factory (default `'unique'`; mutated by handlers in T017)

**Checkpoint**: US1 fully functional with local normalization only.

---

## Phase 4: User Story 2 — Remove 100-Passenger Cap (Priority: P1)

**Goal**: Sessions with 1,000+ passengers behave correctly across list, search, filter, reports.

**Independent Test**: Import a 1,000-row manifest — every row stored and reachable via list, filter, and export; interactions remain under 2 s.

### Tests for User Story 2

- [X] T025 [P] [US2] `tests/e2e/capacity-1000.spec.js` — Playwright: import `tests/fixtures/manifest-1000.xlsx`, assert all 1,000 rows present in list, scroll smoothly, generate report, assert performance budget (<2 s for filter and search interactions)
- [X] T026 [P] [US2] `tests/fixtures/_generate.js` — extend the existing fixture generator with a `manifest-1000.xlsx` builder (idempotent)

### Implementation for User Story 2

- [X] T027 [US2] Apply the cap-removal edits located in T010 (T010 is the audit; this task is the actual code removal) across `manifestImport.js`, `scanProcessor.js`, `encryptedStore.js`, and `passengerList.js`
- [X] T028 [US2] Add windowed rendering to `passport-app/renderer/pages/passengerList.js` — render `<tr>` rows in 100-row chunks via `IntersectionObserver`, all 1,000 rows always in memory (no virtual-scrolling lib per Constitution V)
- [X] T029 [US2] Confirm `passport-app/src/main/services/reportPdf.js` paginates for arbitrary row counts; add a unit test `tests/unit/report-pagination.spec.js` covering 1,000 rows

**Checkpoint**: US2 fully functional, performance budget met.

---

## Phase 5: User Story 3 — Specific Error & Warning Reasons (Priority: P2)

**Goal**: Every failure surfaces a `Reason` with code, localized message, and field/suggestion as applicable.

**Independent Test**: Trigger each failure mode (bad MRZ, bad DOB, duplicate, missing required field, AI-normalize failure) and assert a distinct code is shown.

### Tests for User Story 3

- [x] T030 [P] [US3] `tests/unit/reasons-coverage.spec.js` — for every production path that emits a Reason, assert the emitted `code` is in `reasonCodes.js` and resolves to a localized string in both `ar` and `en`
- [x] T031 [P] [US3] `tests/e2e/error-reasons.spec.js` — Playwright: provoke each failure mode and assert the visible message in the active locale

### Implementation for User Story 3

- [x] T032 [P] [US3] Update `passport-app/src/main/services/manifestImport.js`, `scanProcessor.js`, and each `importParsers/*.js` (created later in US4 phase but pre-existing for xlsx) to emit `Reason` objects rather than throw/log raw strings
- [x] T033 [US3] Create `passport-app/renderer/components/reasonToast.js` — Bootstrap toast that takes a `Reason` and renders code + localized message + optional field/suggestion
- [x] T034 [US3] Replace all generic error displays in `renderer/pages/{scan,import,passengerList,reports,settings}.js` with `reasonToast` calls

**Checkpoint**: US3 fully functional.

---

## Phase 6: User Story 4 — AI Normalization via Gemini (Priority: P2)

**Goal**: Records are normalized via Gemini before persistence and duplicate matching; local fallback fires on any failure.

**Independent Test**: With valid Gemini env vars, import "AHMED, MOHAMED" then scan "Mohamed Ahmed" — duplicate detection fires; with `GEMINI_API_KEY` unset, same flow uses local normalization and surfaces `GEMINI_DISABLED` warning.

### Tests for User Story 4

- [ ] T035 [P] [US4] `tests/unit/gemini-fallback.spec.js` — covers all four cases in `contracts/gemini-service.md` (missing key → disabled, timeout, bad JSON, success) using a mocked SDK
- [ ] T036 [P] [US4] `tests/unit/local-normalize.spec.js` — deterministic outputs for Arabic + Latin name pairs, date format variants, passport-number normalization
- [ ] T037 [P] [US4] `tests/unit/ipc-contract.spec.js` — extend with `normalizePassenger` request/response shape assertions

### Implementation for User Story 4

- [ ] T038 [P] [US4] Create `passport-app/src/main/services/localNormalize.js` — synchronous deterministic normalizer (NFC, trim, Title-case Latin, leave Arabic, ISO date coercion for the formats listed in research.md R3)
- [ ] T039 [P] [US4] Create `passport-app/src/main/services/geminiClient.js` per `contracts/gemini-service.md` — reads env vars at module load, exports `normalize(raw)`, throws typed errors on failure modes, never logs payload or key
- [ ] T040 [US4] Create `passport-app/src/main/ipc/normalizeHandlers.js` registering `ipcMain.handle('normalizePassenger', ...)` — calls geminiClient, catches all errors, falls back to localNormalize, attaches the appropriate Reason warning, returns `NormalizationResult` per contract (depends on T038, T039)
- [ ] T041 [US4] Wire normalize handlers in `registry.js` and expose `window.api.normalizePassenger` in `preload.js`
- [ ] T042 [US4] Modify `passport-app/src/main/services/scanProcessor.js` and `manifestImport.js` to call normalize BEFORE duplicateMatcher (so duplicate detection runs on normalized keys) — replaces any inline normalization
- [ ] T043 [US4] Extend `passport-app/src/shared/entities.js` Passenger factory with `raw`, `normalized`, `normalizationSource`, `normalizationConfidence` per data-model.md
- [ ] T044 [P] [US4] Add the one-time PII-transmission notice: extend `renderer/pages/settings.js` to render a Bootstrap modal on app boot when `settings.geminiNoticeAcknowledged === false`; on Acknowledge call `window.api.acknowledgeGeminiNotice` (add handler in `settingsHandlers.js`)
- [ ] T045 [P] [US4] Add structured logging in `geminiClient.js` via `electron-log`: one `info` event per call with outcome (`hit` / `fallback-{code}` / `error-{code}`); never include payload

**Checkpoint**: US4 fully functional; US1 fuzzy-match quality improves automatically.

---

## Phase 7: User Story 5 — Row Indexes in All Reports (Priority: P2)

**Goal**: Every report and list view shows a 1-based row-index column reflecting visible order.

**Independent Test**: Generate each report with 10+ rows under varying sort/filter; index column is always 1..N in the displayed order.

### Tests for User Story 5

- [X] T046 [P] [US5] `tests/unit/report-indexing.spec.js` — `reportPdf.js` includes an index column 1..N matching input order; index resets when input changes
- [ ] T047 [P] [US5] `tests/e2e/report-indexing.spec.js` — Playwright: generate PDF and on-screen reports with filter applied; index reflects filtered order

### Implementation for User Story 5

- [X] T048 [US5] Modify `passport-app/src/main/services/reportPdf.js` to inject a leading "#" column populated 1..N at render time (not persisted)
- [X] T049 [P] [US5] Update on-screen list/table renderers in `renderer/pages/passengerList.js`, `scanHistory.js`, `pendingApproval.js`, and `reports.js` to show a leading index column derived from the visible (post-filter, post-sort) order
- [X] T050 [P] [US5] Add i18n keys `reports.indexHeader` to `ar.json` (`م`) and `en.json` (`#`)

**Checkpoint**: US5 fully functional.

---

## Phase 8: User Story 6 — Fix Search-Bar Focus Bug (Priority: P2)

**Goal**: Typing a multi-character query in the search input never loses focus mid-typing.

**Independent Test**: Click search bar once, type 10 characters — all 10 land without re-clicking.

### Tests for User Story 6

- [X] T051 [P] [US6] `tests/e2e/search-focus.spec.js` — Playwright: open Passenger List, click search input, type `mohamed1234`, assert input value is the full string and `document.activeElement` is still the search input

### Implementation for User Story 6

- [X] T052 [US6] Refactor `passport-app/renderer/pages/passengerList.js` so the search `<input>` is rendered ONCE at page mount and only the `<tbody>` is re-rendered on each `input` event (root cause per research.md R5); attach the listener with a debounced 100 ms filter call

**Checkpoint**: US6 fully functional.

---

## Phase 9: User Story 7 — Advanced Filters on Passenger List (Priority: P3)

**Goal**: Combined multi-criterion filtering on the passenger list, also applied to reports/exports while active.

**Independent Test**: Open advanced filters, set nationality + has-warning, observe list narrows; clear, observe list resets; export, observe filtered rows in the export.

### Tests for User Story 7

- [X] T053 [P] [US7] `tests/unit/filter-state.spec.js` — pure-function filter applies each criterion combinatorially (AND); empty state returns all rows
- [ ] T054 [P] [US7] `tests/e2e/advanced-filter.spec.js` — Playwright: combine 2+ criteria, assert list count; verify Clear restores; verify report export contains only filtered rows

### Implementation for User Story 7

- [X] T055 [P] [US7] Create `passport-app/renderer/components/advancedFilterPanel.js` — Bootstrap form-controls offcanvas/modal emitting a `FilterState` object per data-model.md; includes Apply + Clear + active-filter badge
- [X] T056 [US7] Wire the panel into `passport-app/renderer/pages/passengerList.js`; maintain `currentFilter` page state; recompute visible rows on Apply/Clear; pass `currentFilter` into report-generation calls
- [X] T057 [US7] Update `passport-app/src/main/services/reportPdf.js` and `passport-app/renderer/pages/reports.js` to accept and respect a `FilterState` parameter (defaults to empty = no filter)

**Checkpoint**: US7 fully functional.

---

## Phase 10: User Story 8 — Optional Field Configuration (Priority: P3)

**Goal**: Operator marks fields required/optional from Settings; subsequent scans/imports accept records missing optional fields with a "missing" badge.

**Independent Test**: Toggle `gender` to optional in Settings; scan a passenger without gender — record saved with badge.

### Tests for User Story 8

- [X] T058 [P] [US8] `tests/unit/field-requirements.spec.js` — `validate(record, requirements)` returns `[]` for missing-optional, `[REQUIRED_FIELD_MISSING]` Reason for missing-required
- [X] T059 [P] [US8] `tests/unit/ipc-contract.spec.js` — extend with `getFieldRequirements` / `setFieldRequirements` shape assertions; unknown keys rejected
- [X] T060 [P] [US8] `tests/e2e/field-requirements.spec.js` — Playwright: toggle a field optional, save, scan record missing that field, assert acceptance + badge

### Implementation for User Story 8

- [X] T061 [P] [US8] Extend `passport-app/src/main/ipc/settingsHandlers.js` with `getFieldRequirements` and `setFieldRequirements` handlers; validate against `FIELD_KEYS`; persist via `encryptedStore`
- [X] T062 [US8] Expose `window.api.getFieldRequirements` and `window.api.setFieldRequirements` in `preload.js`
- [X] T063 [US8] Modify `passport-app/src/main/services/manifestImport.js`, `scanProcessor.js`, and any manual-entry handler to consult `settings.fieldRequirements` before rejecting; on missing-optional, attach the field key to `Passenger.missingOptionalFields`
- [X] T064 [P] [US8] Update `passport-app/renderer/pages/settings.js` with a "Field Requirements" Bootstrap table — one row per `FIELD_KEYS` entry with a toggle; Save calls `window.api.setFieldRequirements`
- [X] T065 [P] [US8] Update `passport-app/renderer/pages/passengerList.js` and `reports.js` to render a "missing" badge for keys in `Passenger.missingOptionalFields`

**Checkpoint**: US8 fully functional.

---

## Phase 11: Multi-Format Import (Cross-Cutting; supports US1 and US3)

**Purpose**: The bulk-import format expansion (xlsx/csv/json/pdf) per clarification Q4 and `contracts/import-formats.md`. Touches multiple stories but is contained.

- [ ] T066 [P] `tests/unit/import-parsers.spec.js` — for each parser, asserts the `RawPassengerRow[]` output shape and that documented failure modes produce the right Reason code
- [ ] T067 [P] `tests/fixtures/manifest.csv`, `tests/fixtures/manifest.json`, `tests/fixtures/manifest.pdf` — small (~10-row) fixtures
- [ ] T068 [P] `tests/e2e/import-multi-format.spec.js` — Playwright: import each format end-to-end, assert correct row count, fuzzy prompts surfaced, parse warnings shown via `reasonToast`
- [ ] T069 Create `passport-app/src/main/services/importParsers/xlsx.js` — extract existing SheetJS logic from `manifestImport.js` into this module returning `RawPassengerRow[]`
- [ ] T070 [P] Create `passport-app/src/main/services/importParsers/csv.js` — SheetJS CSV mode with delimiter auto-detect + RFC 4180 quoting
- [ ] T071 [P] Create `passport-app/src/main/services/importParsers/json.js` — accepts array or `{passengers: []}`; emits `IMPORT_JSON_BAD_ELEMENT` on non-object elements
- [ ] T072 [P] Create `passport-app/src/main/services/importParsers/pdf.js` — uses `pdf-parse` + column-anchor heuristic; emits `IMPORT_PDF_NO_TABLE` if <4 columns detected
- [ ] T073 Refactor `passport-app/src/main/services/manifestImport.js` to dispatch by file extension to the appropriate parser, then run the unified post-parse pipeline (normalize → duplicate-check → insert/queue) (depends on T069–T072)
- [ ] T074 Update `passport-app/renderer/pages/import.js` to accept the new extensions in the file picker filter

---

## Phase 12: Polish & Cross-Cutting

- [ ] T075 [P] Update `passport-app/README.md` with a "Feature 002 additions" section pointing at `quickstart.md`
- [ ] T076 [P] Run `tests/locale/parity.spec.js` and resolve any missing keys introduced by US1–US8
- [ ] T077 Run full `npm test` and `npm run test:e2e`; ensure green on Windows
- [ ] T078 Run `quickstart.md` smoke-test checklist on a packaged build (`npm run build:win` then install)
- [ ] T079 [P] Trim placeholder lines from `CLAUDE.md` (Python/FastAPI example rows on lines 9, 25, 30 left over from the initial template)
- [ ] T080 [P] Verify no Gemini payloads or API keys appear in `electron-log` output (manual audit + grep in CI log fixtures)

---

## Dependencies & Execution Order

### Phase dependencies

- Phase 1 (Setup) → Phase 2 (Foundational) → Phase 3+ user stories
- Phase 11 (Multi-format import) can begin once Phase 2 is done; T073 depends on T069–T072
- Phase 12 (Polish) depends on every user-story phase being green

### User-story dependencies

- **US1** (P1): independent after Phase 2; benefits from US4 once available
- **US2** (P1): independent after Phase 2 (T010 audit is in Phase 2; cap-removal is in US2)
- **US3** (P2): independent after Phase 2; touches files modified by US1/US4 — sequence with them if same developer
- **US4** (P2): independent after Phase 2; once shipped, US1's fuzzy match upgrades automatically
- **US5** (P2): fully independent
- **US6** (P2): fully independent — a single-file refactor
- **US7** (P3): independent; benefits from US5 (index column inside filtered exports)
- **US8** (P3): independent; touches `settingsHandlers.js` and Passenger factory — sequence with US1 if same developer

### Within each user story

- Tests written first and asserted failing
- Shared module (matcher / parser / normalizer) before IPC handler
- IPC handler before preload exposure
- Preload + handler before renderer wiring
- Renderer wiring before E2E test passes

---

## Parallel Example: User Story 1

```text
# After Phase 2 completes, three tests can be written in parallel:
T012 [P] tests/unit/duplicate-matcher.spec.js
T013 [P] tests/unit/ipc-contract.spec.js
T014 [P] tests/e2e/duplicate-flow.spec.js

# Then implementation, parallelizing by file:
T015 [P] src/main/services/duplicateMatcher.js
T017 [P] src/main/ipc/duplicateHandlers.js
T021 [P] renderer/components/duplicateConfirmModal.js
# Sequential after their dependencies:
T016 → T018 → T019 → T022 → T023 → T024
```

---

## Implementation Strategy

### MVP

US1 + US2 (the two P1 stories). Delivers correct, uncapped passenger handling — the highest-value subset.

1. Phase 1 Setup
2. Phase 2 Foundational
3. Phase 3 (US1) + Phase 4 (US2)
4. Phase 12 Polish (tests + smoke build)

### Incremental delivery

Ship in this order, each as an independently testable demo:

1. MVP (US1 + US2)
2. US3 (reasons) + US6 (search focus) — pure UX wins
3. US4 (Gemini normalization) + US5 (report indexes)
4. US7 (advanced filters) + US8 (field requirements) + Phase 11 (multi-format import)

### Parallel team strategy

After Phase 2: assign one developer per priority tier. US5 and US6 are great "starter" tasks because they don't touch any shared module.

---

## Notes

- [P] tasks differ in file and have no pending dependency in the same phase
- Every renderer change must add both `ar.json` and `en.json` keys in the same commit (Constitution I — non-negotiable)
- Every IPC payload shape must be re-validated in `preload.js` (Constitution III — no TypeScript means runtime checks)
- Commit after each task or each logical task group; stop at any Checkpoint to validate independently
