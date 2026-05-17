# Implementation Plan: Passenger Scanner Enhancements

**Branch**: `002-passenger-scanner-enhancements` (working from `master`) | **Date**: 2026-05-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-passenger-scanner-enhancements/spec.md`

## Summary

Enhancement layer on top of the existing Seaport Passport Scanner desktop application (feature `001-seaport-passport-scanner`). Adds nine improvements grouped around four design themes: (a) duplicate-aware scanning/importing with Gemini-based name/date normalization, (b) capacity removal of the legacy 100-record cap to support unlimited passengers per session, (c) operator UX fixes (search focus retention, indexed reports, specific error/warning reasons, in-app field-required toggles, advanced filters), and (d) configurable AI integration via environment variables. The Gemini call lives in the `main` process only; the renderer never touches the network. Implementation reuses the existing Electron + vanilla JS + Bootstrap 5 RTL + JSON `safeStorage` architecture; no new framework is introduced.

## Technical Context

**Language/Version**: JavaScript ES2022 (no TypeScript — inherits the documented exception from feature 001)
**Primary Dependencies (new)**: `@google/generative-ai` (Gemini SDK, used only from `main`); `xlsx` and `pdfmake` already present from feature 001; PDF parsing via `pdf-parse`; existing `i18next`, `electron-log`, Bootstrap 5 RTL retained
**Storage**: Existing single encrypted JSON blob at `<userData>/store.enc` via Electron `safeStorage`. New persisted shapes: `settings.fieldRequirements`, `settings.geminiNoticeAcknowledged`, `session.duplicateDecisionsAudit[]`
**Testing**: Mocha + Chai (unit), locale-parity (Mocha), Playwright (`@playwright/test`) E2E — same stack as feature 001. New tests cover: duplicate detection (exact + fuzzy), Gemini fallback, capacity > 100, search focus retention, indexed report output, field-requirement toggling, advanced-filter combinations, import-format parsers
**Target Platform**: Windows 10/11 x64 (unchanged)
**Project Type**: Desktop application (Electron) — extending existing `passport-app/`
**Performance Goals**: SC-003 — on-screen list/search/filter/export interactions complete in <2 s with 1,000 passengers in the active manifest; Gemini round-trip <1 s p95 per record (timeout 2 s before local fallback)
**Constraints**: Online connectivity assumed during scan/import (per clarification Q3); Gemini calls only from `main` process; renderer CSP unchanged (`connect-src 'self' http://localhost:*`); full passenger record may be sent to Gemini as-is (per clarification Q2) so no field-redaction layer is added; duplicate detection scope is current session only (per clarification Q1); import accepts xlsx/csv/json/pdf (per clarification Q4); field-requirements editable by any operator from the existing Settings tab (per clarification Q5)
**Scale/Scope**: Up to 1,000 passengers per session (raised from feature 001's 600); 9 functional themes; 8 user stories; touches Scan, Import, Passenger List, Reports, and Settings tabs

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. Bilingual i18n (AR/EN) | All new strings (duplicate prompt, error reasons, filter labels, Gemini notice, field-requirements UI) added to both `ar.json` and `en.json`; locale-parity test continues to gate CI | ✅ PASS |
| II. UI Library First | New UI (advanced filter panel, "Is this …?" confirm dialog, settings table for field requirements, error/warning toast reasons) composed from existing Bootstrap 5 RTL primitives (modal, table, form-check, badge, alert) — no hand-rolled components | ✅ PASS |
| III. Electron Desktop Delivery | Gemini SDK loaded only in `main/services/geminiClient.js`; renderer reaches it via existing IPC bridge (`window.api.normalizePassenger`); `contextIsolation`, `sandbox`, CSP all unchanged | ✅ PASS |
| IV. Test-First Discipline | New unit + E2E test files specified in Project Structure; IPC contract for `normalizePassenger`, `detectDuplicate`, `updateFieldRequirements` listed in `contracts/` | ✅ PASS |
| V. Simplicity & YAGNI | One new external dependency (`@google/generative-ai`) justified by FR-007/008; no offline queue, no role system, no field redaction — all explicitly rejected via clarifications | ✅ PASS |

Initial gate: **PASS**. Post-design re-check (after Phase 1): **PASS**.

## Project Structure

### Documentation (this feature)

```text
specs/002-passenger-scanner-enhancements/
├── plan.md              # This file
├── spec.md              # Feature spec with Clarifications session 2026-05-17
├── research.md          # Phase 0 — resolved decisions
├── data-model.md        # Phase 1 — new entities + extended fields
├── contracts/
│   ├── ipc-bridge-additions.md     # New window.api.* methods
│   ├── gemini-service.md           # Gemini request/response contract
│   └── import-formats.md           # xlsx/csv/json/pdf row schema
├── quickstart.md        # Phase 1 — dev setup deltas + smoke test
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 — generated by /speckit.tasks
```

### Source Code (repository root)

Existing `passport-app/` from feature 001 is extended. **Bold** = new file; *italic* = modified.

```text
passport-app/
├── src/
│   ├── main/
│   │   ├── ipc/
│   │   │   ├── *scanHandlers.js*               # call detectDuplicate before insert
│   │   │   ├── *manifestHandlers.js*           # multi-format import + duplicate gating
│   │   │   ├── **normalizeHandlers.js**        # Gemini normalize IPC
│   │   │   ├── **duplicateHandlers.js**        # exact + fuzzy match IPC
│   │   │   ├── *settingsHandlers.js*           # fieldRequirements get/set
│   │   │   └── *reportHandlers.js*             # row-index injection
│   │   ├── services/
│   │   │   ├── **geminiClient.js**             # env-var config + retry + fallback
│   │   │   ├── **duplicateMatcher.js**         # exact + fuzzy match within session
│   │   │   ├── **localNormalize.js**           # deterministic fallback normalizer
│   │   │   ├── **importParsers/**
│   │   │   │   ├── xlsx.js
│   │   │   │   ├── csv.js
│   │   │   │   ├── json.js
│   │   │   │   └── pdf.js
│   │   │   ├── *manifestImport.js*             # dispatch by format + collect reasons
│   │   │   ├── *scanProcessor.js*              # normalize → duplicate-check → insert
│   │   │   ├── *reportPdf.js*                  # add 1-based index column
│   │   │   └── *logger.js*                     # redact passport numbers in any Gemini error logs
│   │   └── store/
│   │       └── *encryptedStore.js*             # remove 100-cap if present; persist field-requirements
│   └── shared/
│       ├── *normalize.js*                      # used by both AI and local paths
│       └── **fieldRequirements.js**            # canonical list + default required/optional
├── renderer/
│   ├── pages/
│   │   ├── *scan.js*                           # show "Already scanned" + "Is this …?" modal
│   │   ├── *import.js*                         # surface per-row reasons + duplicate prompt
│   │   ├── *passengerList.js*                  # advanced filter panel + indexed rows + search-focus fix
│   │   ├── *reports.js*                        # show row indexes
│   │   └── *settings.js*                       # field-requirements editor + Gemini-notice acknowledgment
│   ├── components/
│   │   ├── **duplicateConfirmModal.js**        # "Is this …?" Bootstrap modal
│   │   └── **advancedFilterPanel.js**          # Bootstrap form-controls; emits filter object
│   └── i18n/locales/
│       ├── *ar.json*                           # new keys
│       └── *en.json*                           # new keys
└── tests/
    ├── unit/
    │   ├── **duplicate-matcher.spec.js**
    │   ├── **gemini-fallback.spec.js**
    │   ├── **local-normalize.spec.js**
    │   ├── **import-parsers.spec.js**
    │   ├── **field-requirements.spec.js**
    │   └── **report-indexing.spec.js**
    ├── e2e/
    │   ├── **duplicate-flow.spec.js**
    │   ├── **capacity-1000.spec.js**
    │   ├── **search-focus.spec.js**
    │   ├── **advanced-filter.spec.js**
    │   ├── **field-requirements.spec.js**
    │   └── **import-multi-format.spec.js**
    └── fixtures/
        ├── **manifest-1000.xlsx**
        ├── **manifest.csv**
        ├── **manifest.json**
        └── **manifest.pdf**
```

**Structure Decision**: Reuse the single-Electron-project layout from feature 001 — no new top-level package. New main-process services (`geminiClient.js`, `duplicateMatcher.js`, `localNormalize.js`, `importParsers/`) sit under `src/main/services/`. New renderer components live under `renderer/components/` as plain JS modules composing Bootstrap 5 RTL classes. The renderer never imports the Gemini SDK; the IPC bridge (`preload.js`) gains three thin pass-through methods. This keeps the security boundary (Constitution III) and UI-library boundary (Constitution II) intact.

## Complexity Tracking

Inherits the two waivers from feature 001 (vanilla JS instead of TypeScript; Bootstrap 5 RTL CSS-only instead of a JS component framework). No new violations introduced.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| (inherited) Vanilla JS / no TypeScript | Set by feature 001 user brief | Re-typing the existing codebase is out of scope for this enhancement |
| (inherited) CSS-only UI library | Set by feature 001 plan | New components in this feature are simple compositions (modal + form-check + table) — no JS framework needed |
| Network call from a previously fully-offline app | Required by FR-007/008; user explicitly chose Gemini-backed normalization in `plan001.md` and clarification Q2 | Local-only normalization cannot handle Arabic transliteration variance; would not satisfy SC-002 fuzzy-match goal |
