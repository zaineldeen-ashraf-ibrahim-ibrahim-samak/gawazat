# Feature Specification: Seaport Passport Scanner Desktop Application

**Feature Branch**: `001-seaport-passport-scanner`
**Created**: 2026-04-28
**Status**: Draft
**Input**: User description: "Windows desktop app for Port Said seaport that imports a passenger Excel manifest, scans arriving passengers' passports via a Regula Baltija reader (keyboard-emulation or local web-service mode), verifies each passenger against the manifest, tracks boarding status, and produces Arabic RTL reports."

## Clarifications

### Session 2026-04-28

- Q: What level of at-rest protection must the local data store provide? → A: Encrypt the local data store with an OS-managed key (Windows DPAPI / Electron `safeStorage`); no operator passphrase required.
- Q: What is the retention policy for completed-voyage data on the workstation? → A: Auto-purge any voyage data older than a configurable retention window (default 30 days), in addition to manual "Clear current session".
- Q: What normalization MUST be applied to passport numbers on both sides before comparison? → A: Trim whitespace, uppercase ASCII, strip all non-alphanumeric characters, then exact compare.
- Q: Which scan events count as a "warning" for the Dashboard counter and the Warnings PDF report? → A: Every yellow scan still unresolved (awaiting approval/rejection) plus every MRZ read-failure event; orange duplicates are excluded (tracked separately); yellow scans that have been approved or rejected leave the warnings count.
- Q: How should the Scan workflow behave on a yellow (passport-not-in-manifest) outcome to keep the gate queue flowing? → A: The scan MUST NOT block the gate. The MRZ data (and portrait if available) is captured into a new **Pending Approval** queue and the Scan page auto-resets immediately, just like a green outcome. A separate Pending Approval page lets the operator/supervisor review each entry off the critical path and choose Approve Entry (which records boarding from the moment of approval) or Reject.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Verify a passenger against the manifest at the gate (Priority: P1)

A border officer at the Port Said seaport gate places an arriving passenger's passport on the Regula Baltija reader. The application reads the passport, looks the passenger up in the previously imported ship manifest, and within a couple of seconds shows a clear, color-coded result: green when the passenger is on the list and not yet boarded (auto-marked as entered), yellow when the passenger is **not** on the list (held for manual review), or orange when the passenger has already been scanned earlier (duplicate warning showing the first entry time). A short audible cue confirms the outcome. After a configurable delay the screen auto-resets so the next passenger can be processed without keyboard interaction.

**Why this priority**: This is the core operational flow the application exists to enable. Without it, none of the other features have value; with it alone, the port can already board a ship using paper manifests as a fallback for the other tabs.

**Independent Test**: Pre-load a small fixture manifest (e.g., 5 passengers), present three passport reads — one matching, one unknown, one duplicate of the first — and confirm each produces the correct color, message, sound, audit entry, and updated boarding status without needing the import, reports, or settings screens.

**Acceptance Scenarios**:

1. **Given** the manifest contains a passenger with passport number `A1234567` who has not yet boarded, **When** that passport is scanned, **Then** the result panel turns green, displays the passenger's name, passport number, nationality, gender (and portrait if available from the device), the passenger is recorded as entered with the current timestamp, a success cue plays, and the screen auto-resets after the configured delay.
2. **Given** a passport whose number is **not** in the manifest is scanned, **When** the read completes, **Then** the result panel briefly turns yellow with a "أُضيف إلى قائمة المراجعة" notice and the captured MRZ data, the warning cue plays, the entry is appended to the Pending Approval queue, no boarding state changes, and the Scan page auto-resets on the same delay as a green scan so the next passenger can proceed without waiting.
3. **Given** a passenger has already been marked as entered earlier in the session, **When** the same passport is scanned again, **Then** the result panel turns orange, shows the original entry time, warns about the duplicate, and does not change the existing boarding record.
4. **Given** scanning is in progress, **When** the operator presses Escape, **Then** the current result is cleared and the scan area is ready for the next read; **When** the operator presses F5, **Then** the scan state is reset; **When** the operator presses F1 / F2, **Then** the app navigates to the Scan / Dashboard pages respectively.

---

### User Story 2 — Import the ship's passenger manifest from Excel (Priority: P1)

Before the ship arrives, an officer drags an Excel file containing the booked passengers onto the Import page. The application validates the columns (passport number, name, gender, nationality, date of birth, optional vessel and seat), shows a preview table, and reports any rows with missing or malformed data so they can be corrected before scanning starts. A blank template can be downloaded directly from the same page.

**Why this priority**: Scanning is meaningless without a manifest to match against; this is the prerequisite to User Story 1.

**Independent Test**: Drop a sample `.xlsx` with 600 rows (including a few intentionally malformed rows) and verify a preview is shown, validation errors are listed with row numbers, valid rows are loaded, and downloading the blank template produces an Excel file with the documented column headers.

**Acceptance Scenarios**:

1. **Given** a valid Excel file with the required columns, **When** the file is dropped onto the upload zone, **Then** the rows appear in a preview table and become available for matching on the Scan screen.
2. **Given** a file with missing required columns or malformed dates, **When** import is attempted, **Then** specific validation errors are shown per row and the import is not committed until the operator chooses to proceed with valid rows only.
3. **Given** the operator clicks "Download blank template", **When** the action completes, **Then** an `.xlsx` file with the documented column headers is saved locally.

---

### User Story 3 — Review and manage the passenger list during boarding (Priority: P2)

The officer opens the Passenger List tab to see every imported passenger with current boarding status, search by name or passport number, filter by entered/pending/male/female, manually toggle a passenger as entered (e.g., when the device is unavailable), and export the currently filtered view to Excel.

**Why this priority**: Operational backup and visibility — required during real boarding but not strictly needed for the first end-to-end gate test.

**Independent Test**: With a manifest loaded and a few scans recorded, verify search returns matching rows, each filter narrows the table correctly, the manual-entry toggle updates status and audit history, and the Excel export contains exactly the filtered rows.

**Acceptance Scenarios**:

1. **Given** the manifest is loaded, **When** the operator searches by partial name or passport number, **Then** only matching rows are shown.
2. **Given** the operator selects the "Pending" filter, **When** the table refreshes, **Then** only passengers without an entry timestamp are listed.
3. **Given** the operator toggles a row to "entered" manually, **When** the change is saved, **Then** the boarding status updates, the entry time is recorded, and the action is reflected in the scan history as a manual entry.

---

### User Story 3b — Resolve Pending Approval entries off the critical path (Priority: P1)

When the Scan page encounters a passport that is not on the manifest, it captures the MRZ data and routes the passenger to a Pending Approval queue without holding up the gate. A supervisor (or the same officer between scans) opens the Pending Approval page, reviews each captured entry — name, passport number, nationality, gender, DoB, portrait if available, original scan time — and chooses Approve Entry or Reject. Approving records a boarding entry timestamped at the approval moment and adds the passenger to the manifest flagged as "added at gate"; Rejecting logs the rejection and removes the row from the queue.

**Why this priority**: This is what allows User Story 1 to never block the queue at the gate. Without it, every yellow scan stalls boarding while a supervisor is found.

**Independent Test**: Scan three unknown passports in rapid succession; verify the Scan page resets immediately between each, that all three appear in Pending Approval with their MRZ data, and that approving one and rejecting another updates counts and history correctly while the third remains pending.

**Acceptance Scenarios**:

1. **Given** an unknown passport is scanned, **When** the read completes, **Then** an entry appears in Pending Approval within ~1 second and the Scan page is ready for the next passenger immediately.
2. **Given** a Pending Approval entry, **When** the operator chooses Approve Entry, **Then** a boarding record is created with the approval timestamp, the passenger is added to the manifest as "added at gate", the Pending Approval row clears, and the warnings counter decrements.
3. **Given** a Pending Approval entry, **When** the operator chooses Reject, **Then** a rejection event is recorded in Scan History, the row clears from Pending Approval, and the warnings counter decrements.

---

### User Story 4 — Inspect the chronological scan history (Priority: P2)

The officer opens the Scan History tab to see every scan event in chronological order with time, passport number, name (if matched), and outcome (ok / warning / duplicate), color-coded for quick scanning, and exportable to Excel for record-keeping.

**Why this priority**: Required for accountability and shift handover, but downstream of the live scanning flow.

**Independent Test**: After producing several scans of each outcome type, open the history tab and verify ordering, color coding, and that the Excel export contains the same rows.

**Acceptance Scenarios**:

1. **Given** scans have occurred, **When** the operator opens Scan History, **Then** events are listed newest-first with correct timestamps and color-coded outcomes.
2. **Given** the operator clicks "Export to Excel", **When** the export completes, **Then** the resulting file contains all displayed events.

---

### User Story 5 — Generate boarding reports for printing (Priority: P2)

At any point (most often after boarding completes) the officer generates a PDF report — full manifest with statuses, entered-only, pending-only, or warnings log — with a header showing ship name, port, date, and summary totals, formatted as a professional Arabic RTL table, and either prints it directly or saves it as a PDF.

**Why this priority**: Required for the official paper trail handed to port authority and ship's master, but produced after the scanning is complete.

**Independent Test**: With a populated session, generate each of the four report types and verify Arabic text is shaped correctly, totals match the underlying data, and the PDF is printable on a standard office printer.

**Acceptance Scenarios**:

1. **Given** a session with mixed statuses, **When** the operator generates the "Entered passengers" report, **Then** the PDF lists exactly the entered passengers with the correct total and metadata in the header.
2. **Given** the same session, **When** the operator generates the "Warnings log" report, **Then** the PDF lists every unregistered scan event with the data captured from the passport.

---

### User Story 6 — See the live boarding picture on a dashboard (Priority: P3)

A supervisor opens the Dashboard tab and sees, at a glance, the ship name, total passengers, number entered, number pending, number of warnings, a boarding-progress bar, and the last 5 scan events with their outcomes.

**Why this priority**: Useful situational awareness, but not on the critical operational path.

**Independent Test**: With ongoing scans, verify counts and progress bar update on navigation back to the Dashboard, and that the recent-events feed always shows the latest 5 events.

**Acceptance Scenarios**:

1. **Given** scans have just been recorded, **When** the operator navigates to the Dashboard, **Then** all stats and the progress bar reflect the latest data.

---

### User Story 7 — Configure the workstation for the current ship (Priority: P3)

An administrator opens Settings to choose between Keyboard-emulation and Regula web-service mode, configure the device service URL, set the ship name, configure auto-reset delay (1–10 s), toggle sound, switch UI language between Arabic and English, and clear the current session before a new ship arrives.

**Why this priority**: Configured once per shift; sensible defaults make this non-blocking for first use.

**Independent Test**: Change each setting, restart the app, and verify settings persist; trigger a session reset and verify scans, manifest, and history are cleared while settings remain.

**Acceptance Scenarios**:

1. **Given** the operator switches scan mode, **When** they return to the Scan page, **Then** the new mode is active without needing to restart the app.
2. **Given** the operator triggers "Clear session", **When** the action is confirmed, **Then** all scan events, boarding statuses, and the loaded manifest are removed while user settings are preserved.

---

### Edge Cases

- The Regula web service is unreachable in API mode (service stopped, wrong URL): the Scan page must show a clear connection-status indicator and not silently fail; the operator can retry or fall back to keyboard mode without restart.
- A passport read produces an MRZ that fails check-digit validation: the event is logged, the operator is shown the partial data and a "read failed" indication, and no boarding status is changed automatically.
- The same passport is scanned twice within a few seconds (operator double-tap): only one entry record is created; the second event is recorded as a duplicate scan, not a new entry.
- A passenger appears in the manifest twice (data error): only the first matching record is updated as entered; subsequent matches are flagged as ambiguous and held for manual review.
- The Excel manifest is huge or malformed (e.g., empty rows, merged cells, BOM, mixed encodings): import either succeeds for clean rows and lists errors for the rest, or fails fast with an actionable message — it never partially imports without telling the operator.
- A scan happens while the operator is on a tab other than Scan: the result must still be captured and recorded correctly when keyboard-emulation focus is lost (or, if not feasible, the operator is told to keep the Scan page focused).
- The workstation has no internet (expected normal state): all features must work; nothing blocks on remote calls.
- Arabic name in the manifest vs. transliterated name on the passport MRZ: matching is by passport number, not name; mismatched names are surfaced for review but do not prevent a green result if the passport number matches.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow an operator to import a passenger manifest from an Excel file via drag-and-drop or file picker, with required columns `passport_number`, `name`, `gender`, `nationality`, `date_of_birth` and optional `vessel`, `seat`.
- **FR-002**: The system MUST validate the imported manifest and present a row-level error list before committing rows.
- **FR-003**: The system MUST provide a downloadable blank Excel template matching the documented columns.
- **FR-004**: The system MUST support two passport-reader integration modes — keyboard-emulation and a local web-service API — selectable from Settings without an application restart.
- **FR-005**: In keyboard-emulation mode, the system MUST capture MRZ keystrokes into a focused capture field on the Scan page and parse them.
- **FR-006**: In web-service mode, the system MUST poll the configured device-status endpoint at a regular interval (default ~500 ms) and, on detection, request the processed document and consume the returned fields and portrait image.
- **FR-007**: The system MUST parse MRZ strings conforming to ICAO 9303 TD1 (ID cards) and TD3 (passports), extract document number, surname, given name(s), nationality, date of birth, sex, expiry date, validate ICAO check digits, correctly handle the `<` filler character, and return a structured object.
- **FR-008**: The system MUST match each scan against the imported manifest by passport number and produce one of three outcomes: matched & not yet boarded → green; not in manifest → yellow ("يحتاج مراجعة يدوية"); already boarded → orange duplicate. Before comparison, both the manifest passport number and the MRZ-delivered passport number MUST be normalized by: (1) trimming leading/trailing whitespace, (2) uppercasing ASCII letters, (3) stripping every character that is not an ASCII letter or ASCII digit; the two normalized strings MUST then be compared byte-for-byte. No fuzzy or edit-distance matching is performed.
- **FR-009**: On a green outcome, the system MUST automatically record the passenger as entered with the current timestamp.
- **FR-010**: On a yellow outcome, the system MUST capture the full MRZ-derived data (and portrait image when available) into a persistent **Pending Approval** queue, MUST NOT change any boarding state automatically, and MUST auto-reset the Scan page on the same configurable delay used for green outcomes so the next passenger is not held up. The Scan page MUST briefly indicate to the operator that the passenger has been routed to Pending Approval (e.g., a yellow flash with the MRZ name and a "أُضيف إلى قائمة المراجعة" notice), but MUST NOT require the operator to act before the next scan can proceed.
- **FR-010a**: The system MUST provide a **Pending Approval** page listing every yellow-outcome entry not yet resolved, showing the captured MRZ fields, portrait (if any), the time of the original scan, and Approve Entry / Reject actions per row. Approving an entry MUST record a boarding entry timestamped at the moment of approval (not the original scan time) and MUST add the passenger to the manifest as a manually-added record (clearly flagged as "added at gate"). Rejecting MUST record a rejection event in the scan history and remove the entry from the Pending Approval queue. Both actions MUST be reflected in the Dashboard counters and in reports.
- **FR-011**: On any outcome, the system MUST play the appropriate audible cue (success / warning) when sound is enabled in Settings.
- **FR-012**: The Scan page MUST auto-reset after a configurable delay (1–10 s, default 3 s) and MUST also support manual reset via F5 or Escape.
- **FR-013**: The system MUST provide global keyboard shortcuts: F1 → Scan, F2 → Dashboard, F5 → reset scan, Escape → clear current scan result.
- **FR-014**: The Passenger List MUST support free-text search by name or passport number and filters for All / Entered / Pending / Male / Female, plus a per-row manual entry toggle, and MUST export the currently filtered view to Excel.
- **FR-015**: The Scan History MUST display every scan event chronologically with time, passport number, name (when matched), outcome, and colour coding, and MUST export to Excel.
- **FR-016**: The Reports page MUST generate four PDF reports — full manifest with status, entered only, pending only, warnings log — each with a header containing ship name, date, port name and summary totals, formatted as an Arabic RTL table that renders Arabic glyphs correctly.
- **FR-017**: The Reports page MUST allow direct printing or saving the report as a PDF file.
- **FR-018**: Settings MUST expose: scan mode toggle, device service URL, ship name, auto-reset delay, sound on/off, UI language (Arabic / English), retention window (days, default 30), and a "Clear current session" action.
- **FR-019**: The system MUST persist manifest, scan events, boarding statuses, and settings to local storage on the workstation, auto-save after every scan event, and restore the previous session on startup.
- **FR-020**: The "Clear current session" action MUST remove the manifest, scan events, and boarding statuses while preserving user settings, and MUST require explicit confirmation.
- **FR-021**: The Dashboard MUST display ship name and current timestamp, total / entered / pending / warning counts, a boarding-progress bar, and the five most recent scan events. The "warnings" counter MUST reflect exactly: (a) yellow scans still awaiting Approve/Reject in the Pending Approval queue, plus (b) MRZ read-failure events that have not been cleared. Orange duplicate scans are NOT counted as warnings (they are surfaced separately). Yellow entries that have been approved or rejected leave the warnings counter immediately.
- **FR-022**: The system MUST present a fully Arabic, right-to-left interface by default and MUST support switching to English (LTR) via Settings; all user-facing strings MUST come from the i18n layer.
- **FR-023**: The system MUST function entirely offline; it MUST NOT require any cloud or internet connectivity for any feature.
- **FR-024**: When the configured device service is unreachable in web-service mode, the system MUST display a visible connection status on the Scan page and MUST NOT silently drop reads.
- **FR-026**: The system MUST automatically purge any voyage data (manifest rows, scan events, boarding records, portrait images) older than a configurable retention window. The default retention window MUST be 30 days. The window MUST be configurable from Settings within a sensible range (e.g., 1–365 days). Purge MUST run on application start and at most once per day thereafter, MUST be irreversible, MUST be recorded in an internal audit log entry (not in the user-visible Scan History), and MUST NOT delete user settings.
- **FR-025**: The system MUST encrypt the persisted local data store (manifest, scan events, boarding records, portrait images) at rest using an OS-managed key tied to the current Windows user account (e.g., Windows DPAPI via Electron's `safeStorage` API). Plaintext on disk is prohibited. No operator passphrase is required; the unlock is automatic for the logged-in Windows user. If the OS key is unavailable, the application MUST refuse to read or write the store and surface an actionable error rather than fall back to plaintext.

### Key Entities *(include if feature involves data)*

- **Passenger (manifest row)**: A booked traveller listed in the imported Excel manifest. Key attributes: passport number (unique identity for matching), full name, gender, nationality, date of birth, optional vessel and seat, current boarding status (pending / entered), and entry timestamp when boarded.
- **Manifest (session)**: The collection of passengers imported for the current ship arrival, with associated ship name and the import timestamp. Replaced when a new manifest is imported or session is cleared.
- **Scan Event**: A single read from the passport reader, with timestamp, raw fields read (document number, names, nationality, DoB, sex, expiry), the determined outcome (matched / unknown / duplicate / read-failed), the linked passenger (when matched), and any operator override (approve / reject).
- **Boarding Record**: The state of a passenger as entered, including the linking scan event and entry timestamp. Created automatically on green outcomes, manually on operator approval, or via the manual list toggle.
- **Pending Approval Entry**: A record created from a yellow-outcome scan, containing the captured MRZ fields, portrait (if any), original scan timestamp, and current state (awaiting / approved / rejected). Approving converts it into a Passenger (flagged "added at gate") plus a Boarding Record at the approval timestamp. Rejecting converts it into a rejection Scan Event. Counted in the Dashboard warnings counter only while in the awaiting state.
- **App Settings**: Per-workstation configuration including scan mode, device service URL, ship name, auto-reset delay, sound preference, and UI language. Persisted across sessions and survives "Clear current session".

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A trained officer can process a passenger end-to-end (place passport → see colour-coded result → next passenger) in **under 5 seconds per scan** on a representative ship of 600 passengers.
- **SC-002**: Importing a 600-row Excel manifest completes and is browsable in the Passenger List in **under 10 seconds** on the target workstation.
- **SC-003**: Of all passengers whose data is correctly present in the manifest, **at least 99%** produce a correct green match on first scan (matching is by passport number, so failures here indicate an MRZ-read or check-digit issue, not a name-spelling issue).
- **SC-004**: All four PDF reports render Arabic text correctly (no broken glyphs, correct RTL column order) and totals in the report header match the underlying counts **exactly**, validated against three sample sessions.
- **SC-005**: The application launches, loads the previous session, and is ready for the first scan in **under 5 seconds** on the target workstation.
- **SC-006**: The application operates with **zero outbound network calls** during a complete boarding session (verified by a network-capture run).
- **SC-007**: After a forced workstation power-loss mid-session, on next launch **100% of scan events recorded before the cut** are still present (auto-save guarantee).
- **SC-008**: The operator can complete an entire boarding shift using only the keyboard (no mouse) for the Scan workflow, including navigation, reset, and manual approve/reject.

## Assumptions

- The Regula Baltija device is supplied, configured, and physically connected at the workstation by port IT before the application is used; the application's responsibility starts at the keystroke stream or the local HTTP service the device exposes.
- Matching of a scan to a manifest row is by **passport number** (a stable machine-readable identifier); name spelling differences between the manifest and the passport MRZ are expected and are not a match failure.
- The target workstation runs Windows 10 or 11 (x64) at 1920×1080, with a printer available for paper reports; macOS is only used as a build host.
- Arabic is the default UI language for Port Said operators; English is provided for inspectors or vendors and is functionally equivalent.
- One workstation handles one ship at a time; multi-station synchronisation across gates is **out of scope** for v1.
- The Excel manifest is the authoritative pre-boarding source; any reconciliation with port-authority back-office systems is performed outside this application.
- Passport portrait images obtained in web-service mode are displayed for visual operator confirmation only; the application does not perform face matching.
- Visa, watchlist, and document-authenticity checks are **out of scope** for v1; the application's "is this person on the list?" semantics are intentionally narrower than border-control suitability.
- Date format in the Excel manifest follows a single documented convention (ISO `YYYY-MM-DD` or Excel-native date cells); ambiguous date strings in the manifest are treated as validation errors at import time.
- A single operator at a time uses the workstation; no multi-user authentication is required for v1.