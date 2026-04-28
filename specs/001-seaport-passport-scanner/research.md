# Phase 0 Research — Seaport Passport Scanner

All `NEEDS CLARIFICATION` items have been resolved by the spec's Clarifications section
or by the decisions below.

## R1. PDF generation with Arabic RTL

- **Decision**: Use `pdfmake` with embedded `Amiri-Regular.ttf` (SIL OFL) registered in the pdfmake VFS at build time. Tables use `alignment: 'right'`, document `defaultStyle.font: 'Amiri'`, and column order is reversed at the document level for RTL reading order.
- **Rationale**: pdfmake handles complex Arabic shaping correctly when the font supplies the required ligatures. It produces deterministic, printable PDFs and runs purely in JS (no native deps).
- **Alternatives**:
  - `jsPDF` + `jspdf-autotable`: Arabic shaping is fragile without an extra `arabic-reshaper` step, and the result is brittle on right-aligned multi-line cells.
  - Headless Chromium print-to-PDF: heavier, requires a renderer window, and complicates the kiosk lifecycle.

## R2. At-rest encryption

- **Decision**: `electron.safeStorage.encryptString` / `decryptString` for the entire JSON store. On Windows, this is DPAPI bound to the current user account.
- **Rationale**: Satisfies spec FR-025 (Q1 clarification = Option B) with zero operator friction. No passphrase, no key file to manage.
- **Alternatives**:
  - `node:crypto` AES-GCM with a key derived from a passphrase — rejected by Q1 (Option C).
  - Plaintext + NTFS ACLs — rejected by Q1 (Option A).

## R3. Excel import library

- **Decision**: `xlsx` (SheetJS) parsing executed in the **main** process; renderer receives a normalized JSON array via IPC.
- **Rationale**: Keeps `Buffer`, file-system, and parser in the privileged process. Renderer remains sandboxed (constitution III). SheetJS reads the cells we need (date as Excel-native date or ISO string) and produces deterministic output.
- **Alternatives**:
  - `exceljs` — heavier, mostly redundant for read-only import.
  - Renderer-side parsing — would force `nodeIntegration` or fetching the file via blob; rejected on security grounds.

## R4. Regula web-service consumption

- **Decision**: Single `regula-client.js` module in main. State machine: `idle → polling → processing → idle`. Poll `GET /api/device/status` every 500 ms (settings-configurable). On `documentPlaced` truthy, `POST /api/process`, then emit a single `regula:scan` IPC event with the parsed fields. Drop polling responses while a process is in flight.
- **Rationale**: A finite-state machine prevents double-firing if the device reports presence on consecutive polls.
- **Alternatives**:
  - Server-sent events / websocket — Regula service in this deployment exposes only the documented HTTP endpoints.
  - Renderer-side polling — would expose `localhost:8080` to the renderer's CSP and fragment the device state across processes.

## R5. MRZ parser

- **Decision**: Hand-written `src/shared/mrz.js`. Detects TD1 (three 30-char lines) and TD3 (two 44-char lines). Implements the ICAO 9303 weighted check-digit (weights 7-3-1, `<` = 0, A-Z = 10..35) for: document number, DoB, expiry, composite. Returns a structured object plus a `check_digits_valid` boolean (do not silently accept failures — surface to UI).
- **Rationale**: Hand-rolled is ~150 LOC, has zero deps, is unit-testable against fixed fixtures (Egyptian, Saudi, Jordanian sample MRZs), and avoids supply-chain risk.
- **Alternatives**:
  - `mrz` npm package — adds a dep for code we control fully ourselves; rejected (YAGNI / supply chain).

## R6. Keyboard-emulation capture

- **Decision**: A hidden `<input>` on the Scan page receives keystrokes when not on another input. A 50 ms idle timer determines "device finished typing"; the captured string is then validated against TD1 or TD3 length and dispatched to the same scan handler used by the Regula HTTP path.
- **Rationale**: Most scanner devices type the MRZ at >100 keys/sec; 50 ms idle reliably separates a complete read from human typing.
- **Alternatives**:
  - Looking for a sentinel newline — many devices don't append one; brittle.

## R7. Storage layout

- **Decision**: Single encrypted blob `userData/store.enc` containing:

  ```json
  {
    "schemaVersion": 1,
    "voyage": { "ship_name": "...", "imported_at": "2026-04-28T10:00:00Z" },
    "manifest": [ { /* Passenger */ } ],
    "scan_events": [ { /* ScanEvent */ } ],
    "boarding_records": { "<passport>": { /* BoardingRecord */ } },
    "pending_approval": [ { /* PendingApprovalEntry */ } ],
    "settings": { /* AppSettings */ }
  }
  ```
- **Rationale**: One atomic write per change. At 600 passengers + a few thousand scan events the blob stays well under 5 MB; encrypt/decrypt cost is negligible. Atomic write via `fs.writeFile` to `store.enc.tmp` then `rename` (POSIX atomic; on Windows, `fs.rename` is atomic on the same volume).
- **Alternatives**:
  - SQLite (`better-sqlite3`) — adds a native dep that must be rebuilt for Windows from macOS (electron-rebuild step). Overkill for 600 records.
  - LevelDB — same native-build pain.

## R8. Cross-build macOS → Windows

- **Decision**: `electron-builder --win --x64`, NSIS target, `installerLanguages: ["ar", "en"]`, icon `assets/icon.ico`, code-signing disabled in dev. Wine is **not** required for NSIS x64 since electron-builder bundles a precompiled stub.
- **Rationale**: Aligns with user brief and the project's "macOS → Windows" build constraint.
- **Alternatives**:
  - `electron-forge` — viable but the brief specifies electron-builder.

## R9. Logging / observability (deferred from clarifications)

- **Decision**: `electron-log` writing to `userData/logs/main.log` with size-based rotation (5 MB × 5 files). Renderer logs are forwarded over IPC to main. Log level: `info` in prod, `debug` when launched with `--debug`. Log content excludes passport numbers and names — events log only outcome category, voyage id, and timestamp.
- **Rationale**: Satisfies the deferred observability category without leaking PII in logs (paired with the at-rest encryption decision).

## R10. Internationalization

- **Decision**: `i18next` with `i18next-fs-backend` loading `renderer/js/locales/{ar,en}.json`. Default language `ar`, default `dir="rtl"`. Switching language updates `document.documentElement.lang` and `dir` attributes and re-renders the active tab. CI test fails if AR and EN key sets diverge.
- **Rationale**: Constitution principle I requires a real i18n layer + locale-parity enforcement.

## R11. Performance for 600 passengers

- **Decision**: On manifest import, build a `Map<normalizedPassportNumber, index>` once. Lookup is O(1). The Passenger List renders 600 rows directly in a Bootstrap table — no virtualization needed at this size; profiled-acceptable.
- **Rationale**: Premature virtualization would violate principle V.

## R12. Sound cues

- **Decision**: Two short MP3s (`beep-success.mp3`, `beep-warning.mp3`), preloaded as `Audio` objects at renderer init. Gated by `settings.soundEnabled`.
- **Rationale**: Smallest possible footprint; no Web Audio complexity needed.
