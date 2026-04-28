# Tasks: Seaport Passport Scanner Desktop Application

**Input**: Design documents from `/specs/001-seaport-passport-scanner/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/regula-service.md, contracts/ipc-bridge.md, contracts/excel-manifest.md, quickstart.md
**Tests**: Included — the constitution requires Test-First Discipline (Mocha+Chai unit, Playwright E2E, locale-parity test).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependency on incomplete tasks)
- **[Story]**: US1..US7 (US3b is grouped with US1/US2 in Phase 5)

## Path Conventions

All paths are relative to repo root and rooted under `passport-app/`. The repo root currently is `C:\Users\ALFA2023\Desktop\gawazat\`. The application will live entirely under `passport-app/`. Outside that folder only `specs/` and `.specify/` are touched.

---

## ⚠️ Read this BEFORE writing any code (instructions for the implementing LLM)

These are non-obvious constraints that, if violated, will cause hours of rework. Re-read this list at the start of every implementation session.

1. **Vanilla JavaScript only** — ES2022, no TypeScript, no React/Vue/Svelte. Use JSDoc `@typedef` blocks at the top of every file with non-trivial shapes. The constitution waivers (`plan.md` Complexity Tracking) document why.
2. **UI library is Bootstrap 5 RTL CSS** (CDN-free — bundled local copy). Do **NOT** install React-Bootstrap, MDB, or any framework wrapper. We use plain `<button class="btn btn-primary">` etc. Custom dark-navy palette overrides go in `renderer/styles/theme.css`.
3. **Electron security baseline (non-negotiable)** — every `BrowserWindow` MUST set `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`. The renderer NEVER imports Node, `fs`, `path`, `child_process`, or `electron`. The renderer talks to main only through `window.api` exposed in `preload.js` via `contextBridge.exposeInMainWorld`.
4. **All file I/O, all SheetJS work, all PDF generation, all Regula HTTP calls happen in the MAIN process**. The renderer only renders. No `fetch('http://localhost:8080/...')` from the renderer — main holds the Regula client.
5. **Persistence is a single encrypted JSON blob** at `app.getPath('userData') + '/store.enc'`, encrypted with `safeStorage.encryptString` / decrypted with `safeStorage.decryptString`. No SQLite. No multiple files. Auto-save after every mutation by debouncing (200 ms) writes from a single `store.save()` function.
6. **Passport-number normalization is the canonical match key** — implement once in `src/shared/normalize.js` as `normalizePassportNumber(s)`: `s.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')`. EVERY comparison uses this. Manifest rows store both `passport_number` (raw) and `passport_number_normalized`. Scans normalize the MRZ document number before lookup.
7. **MRZ parser is hand-written**. ICAO 9303 TD1 (3×30) and TD3 (2×44). The `<` filler character must be treated as a separator between names and as zero in check-digit calculations. Weights are `7, 3, 1` cycling. See `tests/unit/mrz.spec.js` fixtures (you write these). DO NOT pull in `mrz` npm package — historical bugs with TD1.
8. **Yellow scans MUST NOT block the gate.** A yellow flash is shown for ~1 s, then the Scan page auto-resets on the same delay as a green scan. The MRZ data is captured into the Pending Approval queue. The operator does NOT confirm anything before the next scan.
9. **No portrait images.** The Regula device in this deployment returns text only. Do not request, render, store, or print any image fields. If you see code referencing PORTRAIT, DOCUMENT_FRONT, base64 images — delete it.
10. **i18n parity is enforced by CI.** Every key in `renderer/i18n/locales/ar.json` MUST exist in `en.json` and vice-versa. The locale-parity test (`tests/locale/parity.spec.js`) MUST fail the build if a key is missing.
11. **Default UI direction is RTL.** `<html dir="rtl" lang="ar">` is the initial render. Switching to English flips `dir` to `ltr` and `lang` to `en`, AND swaps the Bootstrap CSS file from `bootstrap.rtl.min.css` to `bootstrap.min.css`. Test both directions for every screen.
12. **All user-facing strings come from i18n.** No hardcoded Arabic or English text in templates or in JS — use `t('scan.green.title')` etc. Even error messages.
13. **Electron-log MUST NOT log PII** — wrap with a sanitizer that strips/redacts `passport_number`, `passport_number_normalized`, `surname`, `given_names`, `date_of_birth`. Log shapes/counts, not values.
14. **Build target is Windows x64 NSIS, built from macOS dev machines.** Avoid native modules. `xlsx` (SheetJS) and `pdfmake` are pure JS — keep it that way. If a dependency adds `node-gyp` to install logs, find a pure-JS replacement.
15. **Electron + Bootstrap CSP**: Set `Content-Security-Policy` via `session.defaultSession.webRequest.onHeadersReceived` to `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' http://localhost:*; font-src 'self' data:`. The `unsafe-inline` for styles is needed for Bootstrap utility-style attributes; everything else is locked down.
16. **Performance**: 600-row manifest must import in <10 s and match in <500 ms per scan. Use `Map<normalized, Passenger>` for O(1) lookup; never linear-scan the manifest array on the scan path.
17. **Commit format**: every task = one small commit; message format `T### <short verb-led summary>`. Do not bundle unrelated tasks. The constitution requires a checklist re-run before commit.
18. **When unsure, re-read** `specs/001-seaport-passport-scanner/contracts/*.md` — those are the source of truth for IPC, Regula, and Excel schema. The IPC bridge contract is especially load-bearing.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Bootstrap the `passport-app/` folder, install dependencies, configure tooling.

- [x] T001 Create the directory tree under `passport-app/` exactly as specified in `plan.md` Project Structure: `src/main/{ipc/,services/,store/}`, `src/shared/`, `renderer/{pages/,components/,i18n/locales/,styles/,assets/}`, `tests/{unit/,locale/,e2e/,fixtures/}`, plus empty placeholder `.gitkeep` files in every folder so git tracks empty dirs.
- [x] T002 Create `passport-app/package.json` with: `name: "passport-app"`, `version: "0.1.0"`, `main: "src/main/index.js"`, scripts `start` (`electron .`), `test` (runs unit + locale + e2e), `test:unit` (`mocha tests/unit/**/*.spec.js`), `test:locale` (`mocha tests/locale/**/*.spec.js`), `test:e2e` (`playwright test`), `build-win` (`electron-builder --win --x64`), `lint` (`eslint .`). Dependencies: `electron`, `electron-builder` (devDep), `xlsx`, `pdfmake`, `i18next`, `i18next-fs-backend`, `electron-log`, `uuid`. DevDependencies: `mocha`, `chai`, `playwright`, `@playwright/test`, `eslint`, `prettier`. Pin all versions to currently-latest stable. Set `"type": "commonjs"` (Electron main is CJS-friendly; renderer uses script tags).
- [x] T003 Create `passport-app/electron-builder.yml` with: `appId: eg.portsaid.gawazat`, `productName: بوابة المسافرين`, `directories.output: dist`, `win.target: nsis`, `win.x64`: true, `nsis.oneClick: false`, `nsis.installerLanguages: ["ar", "en"]`, `nsis.perMachine: false`, `files: ["src/**", "renderer/**", "package.json"]`. Document in a `# comment` block at the top that code-signing is configured separately by the deploy team.
- [x] T004 [P] Add `passport-app/.eslintrc.json` (extends `eslint:recommended`, env `{node, browser, es2022}`, parserOptions `{ecmaVersion: 2022, sourceType: "script"}`) and `passport-app/.prettierrc` (`{singleQuote: true, semi: true, trailingComma: "all", printWidth: 100}`).
- [x] T005 [P] Add `passport-app/.gitignore`: `node_modules/`, `dist/`, `out/`, `*.log`, `.DS_Store`, `coverage/`, plus `userData/` (in case anyone copies a profile in).
- [x] T006 [P] Run `cd passport-app && npm install` and commit the resulting `package-lock.json`. Verify `electron --version` runs successfully via `npx electron --version`.
- [x] T007 [P] Create placeholder app icon at `passport-app/renderer/assets/icon.ico` (use any 256×256 .ico with the dark-navy theme; commit the binary). Reference it from `electron-builder.yml` (`win.icon`) and from the `BrowserWindow` constructor.
- [x] T008 [P] Create empty Bootstrap 5 RTL/LTR CSS bundles by copying from `node_modules/bootstrap/dist/css/bootstrap.rtl.min.css` and `bootstrap.min.css` into `passport-app/renderer/styles/vendor/` (so we never load from CDN — offline requirement SC-006). Add a tiny build script `scripts/copy-vendor.js` that re-runs the copy on `postinstall`.

**Checkpoint**: `npm start` opens an empty Electron window without errors; `npm test` runs (zero tests yet); `npm run lint` passes.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure all user stories depend on. **No US tasks may start until this phase is complete.**

- [x] T009 Create `passport-app/src/main/index.js`: app lifecycle, single `BrowserWindow` (1280×800 min, frame-on, dark background `#0b1d3a`), security flags from instruction #3 above, `webPreferences.preload` pointing to `src/main/preload.js`. On `ready`, run retention purge (T026), load store, then create the window. Wire `app.on('window-all-closed')` to quit on non-darwin.
- [x] T010 Create `passport-app/src/main/preload.js`: import `contextBridge` and `ipcRenderer`, define `window.api` shape exactly per `contracts/ipc-bridge.md`, with each method as a thin wrapper around `ipcRenderer.invoke('<channel>', args)`. Add event subscriptions for `regula:event` and `regula:status` that use `ipcRenderer.on` and re-expose as `api.regula.onEvent(cb)` / `api.regula.onStatus(cb)` returning unsubscribe fns. **Validate** in preload that args have the expected shape before forwarding (defense in depth).
- [x] T011 Create `passport-app/src/main/ipc/registry.js`: a single function `registerAllHandlers(handlers)` that calls `ipcMain.handle('<channel>', handlers.<group>.<method>)` for every channel listed in `contracts/ipc-bridge.md`. This file is the central wiring point — no `ipcMain.handle` calls anywhere else in the codebase.
- [x] T012 Create `passport-app/src/main/store/encryptedStore.js`: load on boot (decrypt with `safeStorage.decryptString`, parse JSON; if file missing, return default empty state), `save()` debounced 200 ms (encrypt with `safeStorage.encryptString`, atomic write via temp file + rename to `store.enc`), expose `getState()` (returns frozen snapshot), `mutate(fn)` (applies fn to a draft, schedules save). On boot, if `safeStorage.isEncryptionAvailable()` is false, throw a fatal startup error and surface it via a dialog.
- [x] T013 [P] Create `passport-app/src/shared/normalize.js`: export `normalizePassportNumber(s)` exactly as in instruction #6. Pure function. No imports.
- [x] T014 [P] Create `passport-app/src/shared/mrz.js`: TD1 + TD3 parser. Export `parseMrz(rawText)` returning `{type, document_number, surname, given_names, nationality, date_of_birth, sex, expiry_date, check_digits_valid}`. Algorithm: detect `\n`-separated lines, strip non-MRZ chars (keep `A-Z0-9<`), pick TD1 if 3 lines of 30 chars else TD3 if 2 lines of 44. Compute composite + per-field check digits with weights 7,3,1 cycling, `<` = 0, digits as themselves, letters as `A=10..Z=35`. Date conversion `YYMMDD` → `YYYY-MM-DD` using window: years ≤ current_year_2digit + 10 → 2000s, else 1900s. Return `check_digits_valid: false` on any failed digit but still return parsed fields where possible.
- [x] T015 [P] Create `passport-app/tests/unit/normalize.spec.js`: test cases — empty, whitespace, mixed case, embedded dashes/spaces, Unicode digits (must NOT be normalized to ASCII — they get stripped), idempotency (`normalize(normalize(x)) === normalize(x)`).
- [x] T016 [P] Create `passport-app/tests/unit/mrz.spec.js` with at least 6 fixtures: 1 valid TD3, 1 valid TD1, 1 TD3 with composite check digit failing, 1 TD3 with `<` filler in surname, 1 TD3 with name-overflow into surname zone, 1 garbage input. Assert exact field values per ICAO 9303 spec.
- [x] T017 Create `passport-app/src/main/services/logger.js`: wrap `electron-log`, file at `<userData>/logs/main.log`, max 5 MB rotated × 5 files. Export `redact(obj)` that strips PII keys before logging (instruction #13). Replace `console.log` usage everywhere with `logger.info`.
- [x] T018 [P] Create `passport-app/renderer/i18n/locales/ar.json` and `passport-app/renderer/i18n/locales/en.json` with the initial key set: `app.title`, `nav.{dashboard,import,scan,passengerList,scanHistory,reports,settings,pendingApproval}`, `scan.{green,yellow,orange,readFailed,undo,placeMrz}.{title,subtitle}`, `import.{dropZone,template,errors}`, `pending.{approve,reject,empty}`, `passengerList.{search,filter.all,filter.entered,filter.pending,filter.male,filter.female}`, `history.export`, `reports.{full,entered,pending,warnings}`, `settings.{scanMode.api,scanMode.keyboard,regulaUrl,shipName,autoReset,sound,language,retention,clearSession}`, `common.{ok,cancel,confirm,error,loading,empty}`. Arabic is the source of truth — translate to English second.
- [x] T019 [P] Create `passport-app/tests/locale/parity.spec.js`: load both JSON files, assert `Object.keys(flatten(ar))` deep-equals `Object.keys(flatten(en))`. The test MUST fail (with the missing-key list) on any drift.
- [x] T020 Create `passport-app/renderer/i18n/index.js` (renderer-side): init `i18next` with both locales bundled (no fs-backend in renderer; backend is for main if needed). Expose `t(key)`, `setLanguage(lang)` (also flips `<html dir>` and swaps the Bootstrap CSS link element).
- [x] T021 Create `passport-app/renderer/index.html`: `<html dir="rtl" lang="ar">`, link `styles/vendor/bootstrap.rtl.min.css` (with `id="bootstrap-css"` so language switch can swap href), link `styles/theme.css`, single `<div id="app">`, then `<script src="app.js">`. **No inline JS, no inline event handlers.**
- [x] T022 Create `passport-app/renderer/styles/theme.css`: dark-navy palette (`--bg: #0b1d3a; --panel: #102a4c; --accent: #f4b942; --green: #22c55e; --yellow: #eab308; --orange: #f97316; --red: #ef4444; --text: #e6edf7;`), `body { background: var(--bg); color: var(--text); }`, override Bootstrap btn/card/table to the panel color. Tabular nav at top; large scan-result panel.
- [x] T023 Create `passport-app/renderer/app.js` + `passport-app/renderer/router.js`: hash-based router (`#/scan`, `#/dashboard`, etc.). Bind global keys: `F1`→scan, `F2`→dashboard, `F5`→reset scan, `Escape`→clear scan result. Each page is a function that takes the `<main>` element and renders into it; routing tears down listeners on navigate.
- [x] T024 [P] Create `passport-app/renderer/components/audio.js`: `playSuccess()` and `playWarning()` using bundled `.wav` files at `renderer/assets/audio/{success,warning}.wav`. Respect `settings.sound_enabled` (read via `window.api.settings.get`).
- [x] T025 Create `passport-app/src/main/services/cspMiddleware.js`: register `session.defaultSession.webRequest.onHeadersReceived` to inject the CSP header from instruction #15. Wire from `index.js` before window creation.
- [x] T026 Create `passport-app/src/main/services/retention.js`: on app ready and once-per-day after, find Voyage records where `imported_at` < `now - retention_days` and remove that voyage's `Voyage`, `Passenger[]`, `ScanEvent[]`, `BoardingRecord[]`, `PendingApprovalEntry[]`. Log to `<userData>/logs/retention.log` (separate from main.log per instruction #13). NEVER touches `AppSettings`.
- [x] T027 Define entity factories in `passport-app/src/shared/entities.js`: `makeVoyage`, `makePassenger`, `makeScanEvent`, `makeBoardingRecord`, `makePendingApprovalEntry`, `makeAppSettings` matching `data-model.md` exactly. Use `uuid.v4()` for ids. JSDoc typedefs at the top.
- [x] T028 Create `passport-app/src/main/store/indices.js`: rebuild `manifestByNormalized: Map`, `boardingByNormalized: Map`, `pendingAwaiting: Array` from a state snapshot. Re-run on every load and after every mutation (cheap for ~600 rows).

**Checkpoint**: App boots to empty shell with nav bar, RTL Arabic by default, language toggle works, encrypted store round-trips an empty state to disk and back, all parity + unit tests pass.

---

## Phase 3: User Story 2 — Excel manifest import (Priority: P1) 🎯 prerequisite for MVP

**Goal**: Operator can drop an Excel file and load 600 passengers as the active voyage manifest.

**Independent Test**: Drag `tests/fixtures/manifest-10.xlsx` (and `manifest-with-errors.xlsx`) onto Import; preview renders, errors are listed by row, valid rows commit and become queryable via `manifest:list`.

### Tests for User Story 2

- [ ] T029 [P] [US2] Create `passport-app/tests/fixtures/manifest-10.xlsx` (10 valid rows) and `manifest-with-errors.xlsx` (8 rows: 2 missing passport, 1 bad nationality, 1 future DoB, 4 valid). Generate via a small one-off script committed to `tests/fixtures/_generate.js`.
- [ ] T030 [P] [US2] Unit test `passport-app/tests/unit/manifest-validate.spec.js`: feed parsed rows to the validator service, assert per-row outcomes (Pass/Warn/Error per `contracts/excel-manifest.md`).
- [ ] T031 [P] [US2] E2E test `passport-app/tests/e2e/import.spec.js` (Playwright): launch app, navigate to `#/import`, simulate file drop with `manifest-10.xlsx`, assert preview row count, click "Import valid rows", assert `manifest:list` returns 10 passengers.

### Implementation

- [ ] T032 [US2] Create `passport-app/src/main/services/manifestImport.js`: `parseFile(filePath)` uses SheetJS `XLSX.readFile(filePath, {cellDates: true})`, reads first sheet, normalizes header names against AR + EN aliases per `contracts/excel-manifest.md`, returns `{rows: ParsedRow[], errors: ImportError[]}`. Cross-row dedup on `passport_number_normalized`.
- [ ] T033 [US2] Create `passport-app/src/main/ipc/manifestHandlers.js` exposing handlers for `manifest:import`, `manifest:downloadTemplate`, `manifest:list`, `manifest:exportFiltered`. `manifest:import` MUST replace the active voyage atomically (mutate-and-save) — never partial state on disk. Register from `ipc/registry.js`.
- [ ] T034 [US2] `manifest:downloadTemplate` writes a 2-sheet xlsx via `XLSX.write`: sheet 1 is the column header row in Arabic per `excel-manifest.md`; sheet 2 (`Instructions`) contains AR + EN field-format notes and one sample row.
- [ ] T035 [P] [US2] Create `passport-app/renderer/pages/import.js`: drop-zone (`dragover`/`drop` listeners), file-picker fallback button, calls `window.api.manifest.import({filePath})` (filePath obtained via `window.api.dialog.openFile` — add this whitelisted dialog channel in T010 if not present), renders preview table (Bootstrap `.table .table-dark`) with per-row error chips, and a "Download blank template" button calling `manifest:downloadTemplate` after `dialog:saveFile`.
- [ ] T036 [US2] Wire i18n keys for the import page; add to both locale files and re-run parity test.

**Checkpoint**: US2 works end-to-end. Stop here and run `npm test`.

---

## Phase 4: User Story 1 — Verify a passenger at the gate (Priority: P1) 🎯 MVP

**Goal**: Place passport on reader → green/yellow/orange in <2 s, with audible cue and Undo for green.

**Independent Test**: With `manifest-10.xlsx` loaded, scan three known TD3 strings (one matched, one not in manifest, one duplicate of #1) — assert correct outcomes, ScanEvent rows, BoardingRecord changes, and Undo behaviour on green.

### Tests for User Story 1

- [ ] T037 [P] [US1] Unit test `passport-app/tests/unit/match.spec.js`: given a fake manifest map, call the match function with 3 normalized numbers (matched, unknown, duplicate) — assert outcomes green/yellow/orange.
- [ ] T038 [P] [US1] E2E test `passport-app/tests/e2e/scan.spec.js`: import fixture, navigate to `#/scan`, set Scan Mode = keyboard, paste the TD3 from `mrz.spec.js`, assert green panel + Undo visible; scan again → orange; scan an unknown TD3 → yellow flash + Pending Approval count incremented (US3b dependency); click Undo within window → assert BoardingRecord removed and `operator-undone` event present.

### Implementation

- [ ] T039 [US1] Create `passport-app/src/main/services/scanProcessor.js`: `processMrz({rawMrz, mode}) → ScanResult`. Steps: (1) `parseMrz`, (2) if `!check_digits_valid` → write `read-failed` event and return; (3) `normalizePassportNumber(parsed.document_number)`; (4) lookup in `manifestByNormalized` and `boardingByNormalized`; (5) decide outcome; (6) on green: write ScanEvent + BoardingRecord(via=auto); (7) on yellow: write ScanEvent + PendingApprovalEntry(state=awaiting); (8) on orange: write ScanEvent only; (9) save store; (10) return shaped `ScanResult` per ipc-bridge contract.
- [ ] T040 [US1] Implement `scan:submitMrz` and `scan:undoLast` in `passport-app/src/main/ipc/scanHandlers.js`. `undoLast` uses an in-memory `lastUndoableScanId` cleared on next scan or by an internal `auto-reset` timer (server-side timer — don't trust the renderer). On undo: write `operator-undone` ScanEvent, remove the BoardingRecord, return `{ok:true}`.
- [ ] T041 [US1] Create `passport-app/src/main/services/regulaClient.js`: state machine `idle → polling → processing → idle`. `setMode('api'|'keyboard')`. In api mode: every `regula_poll_ms` ms, `GET ${regula_url}/api/device/status`; on `documentPlaced===true` and not already processing, transition to processing, `POST ${regula_url}/api/process`, parse `result.text.fields.*`, build a synthetic MRZ-equivalent text or call `scanProcessor.processFields(...)` directly. **Ignore image fields entirely.** Failures per `contracts/regula-service.md` → emit `regula:status` with the error and write `read-failed` events as documented.
- [ ] T042 [P] [US1] Create `passport-app/renderer/pages/scan.js`: large color panel (green/yellow/orange/red), keyboard-mode hidden input that auto-focuses and accumulates keystrokes with a 50 ms idle debounce before submitting (research item R6), API-mode listener subscribes to `window.api.regula.onEvent`. After result: show outcome card with passenger fields when present, play cue, start auto-reset countdown. Render an "أزل آخر إدخال / Undo last entry" button only when outcome=green. On `Escape` clear; on `F5` reset; on `Ctrl+Z` invoke `scan:undoLast` if green is on screen.
- [ ] T043 [P] [US1] Wire i18n keys for the scan page (green title, yellow "أُضيف إلى قائمة المراجعة" subtitle, orange duplicate text with first-entered timestamp interpolation, undo label, mrz placeholder).
- [ ] T044 [US1] Add a 1-second yellow-flash visual variant: yellow panel renders for ~1 s then auto-resets on `auto_reset_seconds` like green (per FR-010). Use a single `setTimeout` chain — don't stack timers.

**Checkpoint**: MVP done. The gate works end-to-end with US2+US1. Demo-ready.

---

## Phase 5: User Story 3b — Pending Approval queue (Priority: P1)

**Goal**: Yellow scans accumulate in a queue; supervisor approves (creates Passenger added-at-gate + BoardingRecord) or rejects (logs and removes).

**Independent Test**: Scan 3 unknown TD3s; navigate to Pending Approval; approve one (verify Passenger now exists with `source=added-at-gate`, BoardingRecord with `via=pending-approval`, warnings counter -1); reject one; third remains.

### Tests

- [ ] T045 [P] [US3b] Unit test `passport-app/tests/unit/pending.spec.js`: given a state with 3 awaiting entries, call approve(id1) and reject(id2); assert resulting Passenger, BoardingRecord, ScanEvents, and that pending list now has only entry 3.
- [ ] T046 [P] [US3b] E2E test `passport-app/tests/e2e/pending.spec.js`: full flow including dashboard warnings counter.

### Implementation

- [ ] T047 [US3b] Implement `passport-app/src/main/ipc/pendingHandlers.js`: `pending:list` (filter `state==='awaiting'`), `pending:approve({id})` (create `Passenger(source='added-at-gate')` from MRZ fields, create `BoardingRecord(via='pending-approval')` with `entered_at = now`, write ScanEvent `pending-approved`, mutate the entry to `state='approved', resolved_at, resolution_event_id`), `pending:reject({id})` (write ScanEvent `pending-rejected`, set entry state to `rejected`).
- [ ] T048 [US3b] Create `passport-app/renderer/pages/pendingApproval.js`: table of awaiting entries (passport number, name, nationality, gender, DoB, original scan time), per-row Approve / Reject buttons with confirm dialog, refresh after each action.
- [ ] T049 [US3b] Wire i18n keys; rerun parity test.

**Checkpoint**: All P1 stories shipped. The gate is throughput-safe.

---

## Phase 6: User Story 3 — Passenger List (Priority: P2)

- [ ] T050 [P] [US3] E2E test `passport-app/tests/e2e/passenger-list.spec.js`: filters, search, manual toggle, filtered Excel export.
- [ ] T051 [US3] Implement `manifest:list` filter+search logic in `manifestHandlers.js` (case-insensitive substring match on `name`; substring on `passport_number_normalized`; status filter joins with `boardingByNormalized`).
- [ ] T052 [US3] Implement `manifest:exportFiltered` writing an xlsx with extra columns `boarding_status`, `entered_at` per `contracts/excel-manifest.md`.
- [ ] T053 [P] [US3] Add a `passengers:toggleEntered({passport_number_normalized, entered: bool})` IPC handler that creates/removes a BoardingRecord(via='manual-toggle') and writes a corresponding ScanEvent (`outcome='operator-undone'` when un-entering, `green`-equivalent manual entry otherwise — keep its own outcome label `manual-entered` if needed; align with data-model). Update data-model.md if a new outcome is required.
- [ ] T054 [P] [US3] Create `passport-app/renderer/pages/passengerList.js`: search box, filter dropdown, Bootstrap table with row toggles, "Export" button.
- [ ] T055 [US3] i18n keys + parity.

---

## Phase 7: User Story 4 — Scan History (Priority: P2)

- [ ] T056 [P] [US4] E2E test for history list ordering and Excel export.
- [ ] T057 [US4] Implement `history:list` and `history:export` handlers (read-only over `ScanEvent[]`, newest first).
- [ ] T058 [P] [US4] Create `passport-app/renderer/pages/scanHistory.js`: color-coded rows by outcome, virtualized rendering if rows > 1000 (simple windowing — render last 200 plus paging button).
- [ ] T059 [US4] i18n keys + parity.

---

## Phase 8: User Story 5 — Reports (PDF) (Priority: P2)

- [ ] T060 [P] [US5] E2E test: generate each of the 4 report kinds; assert file exists; sanity-check PDF metadata page count > 0.
- [ ] T061 [US5] Add `passport-app/renderer/assets/fonts/Amiri-Regular.ttf` (download once and commit; license-permissive). Wire pdfmake `vfs_fonts` build using `pdfmake/build/vfs_fonts.js` as a base; add Amiri via the documented `pdfMake.vfs` injection method.
- [ ] T062 [US5] Implement `passport-app/src/main/services/reportPdf.js`: build pdfmake document definition with RTL table, Arabic header (ship name, port, date, totals). Document kinds: `full`, `entered`, `pending`, `warnings`. RTL: set `defaultStyle.alignment = 'right'`, columns reversed.
- [ ] T063 [US5] Implement `reports:generatePdf` (writes file to provided savePath) and `reports:print` (Electron `BrowserWindow.printToPDF` to a temp path then OS print via `shell.openPath` is unreliable — instead render the same pdfmake doc to a new hidden BrowserWindow and call `webContents.print()`). Document the chosen path in a top-of-file comment.
- [ ] T064 [P] [US5] Create `passport-app/renderer/pages/reports.js`: 4 buttons, save-dialog + print-button, success toast.
- [ ] T065 [US5] i18n keys + parity.

---

## Phase 9: User Story 6 — Dashboard (Priority: P3)

- [ ] T066 [P] [US6] E2E test: after some scans, dashboard counters and recent-events match.
- [ ] T067 [US6] Implement `dashboard:stats` handler (compute totals + recent 5 events from store).
- [ ] T068 [P] [US6] Create `passport-app/renderer/pages/dashboard.js`: cards (total/entered/pending/warnings), Bootstrap progress bar (entered/total), recent-events list. Re-fetches on navigation only (no polling).
- [ ] T069 [US6] i18n keys + parity.

---

## Phase 10: User Story 7 — Settings (Priority: P3)

- [ ] T070 [P] [US7] E2E test: change scan mode + ship name + retention, restart app, verify persistence; trigger Clear Session, verify manifest cleared but settings preserved.
- [ ] T071 [US7] Implement `settings:get`, `settings:set` (validate every field; reject unknown keys), `session:clear` requiring `confirmToken === 'CLEAR-CURRENT-SESSION'`.
- [ ] T072 [P] [US7] Create `passport-app/renderer/pages/settings.js`: form with controls per FR-018 + retention days. On scan-mode change, call `regula:setMode`. Confirm dialog before "Clear current session".
- [ ] T073 [US7] i18n keys + parity.

---

## Phase 11: Polish & Cross-Cutting Concerns

- [ ] T074 [P] Document keyboard shortcuts on a small in-app help modal (Ctrl+/ to open).
- [ ] T075 [P] Add `passport-app/README.md` mirroring `quickstart.md` plus a "How to package" section.
- [ ] T076 Run a full network-capture test on a packaged build to verify SC-006 (zero outbound non-loopback traffic).
- [ ] T077 Profile a 600-row import to confirm SC-002 (<10 s) on a representative Windows VM.
- [ ] T078 [P] Add Playwright test for `quickstart.md` 5-minute smoke test as a single E2E spec.
- [ ] T079 Run `npm run build-win` from macOS, install the resulting NSIS on a Windows 10 x64 VM, and execute the full smoke test.
- [ ] T080 Final security review: confirm `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true` on every BrowserWindow; confirm CSP is present in DevTools Network tab; grep for `eval(`, `new Function(`, `innerHTML =` and remove any.

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 (Setup) → Phase 2 (Foundational) → Phase 3 (US2) is a hard chain.
- Phase 4 (US1) requires Phase 3 (needs a manifest to match against).
- Phase 5 (US3b) requires Phase 4 (yellow ScanEvents are produced by the scan flow).
- Phases 6–10 each only require Phase 2 + the entities they touch; can be parallelized across developers after Phase 5.
- Phase 11 last.

### Critical-path MVP

Phase 1 → 2 → 3 → 4 → 5. Stop and demo. Everything else is upgrade-in-place.

### Parallel Opportunities

- All [P] tasks within a phase.
- Once Phase 5 is done, US3 / US4 / US5 / US6 / US7 can be done by separate developers concurrently — they touch separate renderer pages and IPC namespaces.
- Locale-parity test runs in CI on every PR.

---

## Implementation Strategy

### MVP First

1. Phases 1+2 in one developer-week (foundation).
2. Phase 3 (US2 import) — half a day.
3. Phase 4 (US1 scan) — 2 days.
4. Phase 5 (US3b pending) — 1 day.
5. **Cut MVP build, run on a Windows box at the gate with a Regula reader, validate SC-001/SC-005 in the field.**

### Incremental Delivery

- Ship US3 (passenger list) next — operational backup matters early.
- Ship US5 (reports) before any real boarding — port authority needs the paper trail.
- US4, US6, US7 can land in any order.

---

## Notes

- The locale-parity test is a hard CI gate; never bypass it with `.skip`.
- Always commit `package-lock.json`.
- Never store a passport number in any log file.
- The `confirmToken` for `session:clear` is intentionally a magic string — do not parameterize it.
- If a Regula HTTP response shape differs from `contracts/regula-service.md`, update the contract first, then the code, in the same commit.
