# Feature Specification: Passenger Scanner Enhancements

**Feature Branch**: `002-passenger-scanner-enhancements`
**Created**: 2026-05-17
**Status**: Draft
**Input**: User description (from `plan001.md`):

## Clarifications

### Session 2026-05-17

- Q: Should duplicate detection apply across all historical manifests, or only within the current manifest/session? → A: Current manifest/session only — no cross-session/historical lookup.
- Q: What passenger data may be transmitted to Gemini for normalization? → A: The full passenger record (including passport number) is sent as-is.
- Q: What network availability should the design assume for the Gemini integration? → A: Online operation is assumed; local fallback fires only on transient failure (no offline queue/retry).
- Q: Which file formats must bulk import support? → A: Excel (.xlsx), CSV, JSON, and PDF tables.
- Q: How should the required/optional field configuration be managed? → A: A settings screen accessible to any operator; no separate administrator role.

---


> 1. Detect already-scanned/imported passengers (manual or scanned) — do not re-add; report "already scanned".
> 2. Remove the 100-passenger limit; support unlimited passengers.
> 3. Add environment variables for Gemini AI configuration; use AI to normalize passenger data because data is inconsistent between import and scan.
> 4. When importing or scanning, add an "Is this …?" duplicate-confirmation step that handles near-duplicates where scans occasionally miss fields but the passenger is actually the same.
> 5. Add index numbering (row indexes) to all reporting outputs.
> 6. Fix the search bar bug where each typed letter requires re-clicking the search input to focus before the next letter is accepted.
> 7. Show the reason for any warning/error during import, scan, and related operations.
> 8. Add an advanced filter system in the passenger list.
> 9. Allow some fields to be optional (not required) during manual entry or scanning.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reliable Duplicate Detection on Import/Scan (Priority: P1)

An operator processes a stream of passengers via either passport scanning or manual import. The system recognizes when a passenger has already been recorded and, instead of silently creating a duplicate, tells the operator "this passenger is already scanned" and skips the redundant insert. For ambiguous cases (a scan that missed one or two fields but otherwise matches an existing record), the system prompts the operator with "Is this <existing passenger>?" so they can confirm or treat as new.

**Why this priority**: Duplicate records corrupt every downstream report and waste operator time re-resolving the same passenger. This is the highest-value correctness fix.

**Independent Test**: Scan or import a passenger twice and verify the second attempt is recognized and reported as a duplicate (exact match) or prompts for confirmation (partial match) instead of creating a second record.

**Acceptance Scenarios**:

1. **Given** passenger P already exists in the current session/list, **When** the operator scans or imports the same passport, **Then** the system displays "Already scanned" with a reference to the existing record and does not create a new entry.
2. **Given** passenger P exists with full data, **When** a new scan arrives matching the passport number but missing one or more secondary fields, **Then** the system shows a confirmation dialog "Is this <P>?" with the differences highlighted and the operator can choose Merge / Keep separate / Cancel.
3. **Given** a manual entry whose passport number matches an existing record, **When** the operator submits, **Then** the system blocks creation and surfaces the existing record.

---

### User Story 2 - Remove 100-Passenger Cap (Priority: P1)

The operator needs to handle vessels with more than 100 passengers in a single session. The artificial limit is removed so any number of passengers can be added, listed, filtered, and reported.

**Why this priority**: A hard cap blocks real operational use on larger vessels; without this, the tool cannot be used for many manifests.

**Independent Test**: Add 250 passengers via mixed scan and import; verify all are stored, listed, paginated/scrolled, and included in reports without truncation or error.

**Acceptance Scenarios**:

1. **Given** the passenger list contains 100 entries, **When** the operator adds the 101st, **Then** the addition succeeds with no warning or rejection.
2. **Given** a list of 500 passengers, **When** the operator opens reports, **Then** every passenger appears (subject to any explicit filter, not an internal cap).

---

### User Story 3 - Better Error & Warning Reasons (Priority: P2)

When a scan or import fails or produces a warning, the operator sees a specific, human-readable reason ("MRZ checksum failed on line 2", "Date of birth could not be parsed: '32/13/1990'", "Duplicate of passenger #47") instead of a generic failure.

**Why this priority**: Without reasons, operators cannot recover from failures and either retry blindly or skip records.

**Independent Test**: Intentionally trigger each known failure mode (bad MRZ, invalid date, duplicate, missing required field, AI normalization failure) and confirm a distinct, accurate reason is shown.

**Acceptance Scenarios**:

1. **Given** a scan with corrupted MRZ data, **When** processing fails, **Then** the UI shows the specific reason and a suggested next action (rescan, edit, skip).
2. **Given** an import row that violates a field rule, **When** import runs, **Then** the row is flagged with the specific field and rule that failed.

---

### User Story 4 - AI Normalization via Gemini Configuration (Priority: P2)

Because scanned data and imported data use different conventions (name order, transliteration, date formats, casing), the system uses the Gemini AI service to normalize incoming passenger records into a single canonical shape before they are stored or matched for duplicates. The Gemini connection is configured through environment variables so that credentials and endpoints are not hard-coded.

**Why this priority**: Inconsistent data is the root cause of the duplicate-detection misses described in Story 1; normalization makes Stories 1 and 8 dramatically more accurate.

**Independent Test**: Import a passenger whose name is "AHMED, MOHAMED" and later scan the same passport returning "Mohamed Ahmed"; verify that after normalization both produce the same canonical record and that Story 1's duplicate detection fires.

**Acceptance Scenarios**:

1. **Given** Gemini credentials are configured via environment variables, **When** a passenger is scanned or imported, **Then** the record is normalized (name order, casing, date format, transliteration) before being persisted.
2. **Given** the Gemini service is unreachable or credentials are missing, **When** normalization is attempted, **Then** the system falls back to deterministic local normalization, records the failure reason (Story 3), and continues without dropping the record.
3. **Given** an administrator updates the Gemini environment variables, **When** the application restarts (or reloads config), **Then** the new values take effect without code changes.

---

### User Story 5 - Indexes in All Reports (Priority: P2)

Every report (PDF, printable, on-screen list, export) displays a sequential row index (1, 2, 3, …) next to each passenger so operators and reviewers can refer to specific rows unambiguously.

**Why this priority**: Reports are reviewed verbally and on paper; without row numbers, referring to "the third Mohamed" is error-prone.

**Independent Test**: Generate every report type with at least 10 passengers and confirm a 1-based monotonically increasing index column is present and aligned to the displayed (post-filter, post-sort) order.

**Acceptance Scenarios**:

1. **Given** a report of N passengers, **When** it renders, **Then** an index column counts 1 to N in the displayed order.
2. **Given** a filtered or sorted report, **When** it renders, **Then** indexes restart at 1 and follow the visible order, not the underlying storage order.

---

### User Story 6 - Fix Search Bar Focus Bug (Priority: P2)

The operator can type a multi-letter search term continuously without losing focus on the search input between keystrokes.

**Why this priority**: A broken search bar makes every list-lookup workflow painful and is hit on essentially every session.

**Independent Test**: Click the search bar once and type a 10-character query; verify all 10 characters are accepted in sequence without the operator needing to re-click between letters.

**Acceptance Scenarios**:

1. **Given** the search input has focus, **When** the operator types successive characters, **Then** focus is retained and each character appears without intervening clicks.
2. **Given** the search input updates the filtered list on each keystroke, **When** the list re-renders, **Then** the input does not lose focus.

---

### User Story 7 - Advanced Filters on Passenger List (Priority: P3)

The operator can narrow the passenger list using multiple combined criteria — for example nationality, gender, age range, date of birth range, document type, scan source (scanned vs. imported vs. manual), duplicate status, and presence of warnings — and can save / clear the active filter set.

**Why this priority**: Useful for reconciliation and reporting but not blocking core scan flow.

**Independent Test**: Apply two or more filters simultaneously (e.g., nationality = X AND has-warning = true) and verify the list, counts, and reports respect the combination.

**Acceptance Scenarios**:

1. **Given** a list of mixed passengers, **When** the operator opens advanced filters and selects multiple criteria, **Then** the list updates to show only matching passengers.
2. **Given** filters are active, **When** the operator clicks "Clear filters", **Then** the list returns to the unfiltered state.

---

### User Story 8 - Optional Fields for Entry and Scan (Priority: P3)

The operator can mark certain fields as optional (per field, configurable) so that a scan or manual entry missing those fields is still accepted, with the missing fields visibly flagged for later completion rather than rejected.

**Why this priority**: Improves throughput when partial data is acceptable, but most operators can work around strict requirements short-term.

**Independent Test**: Configure a non-essential field (e.g., middle name) as optional, then submit a passenger without it; verify the record is created and the field is marked "missing" in the UI and reports.

**Acceptance Scenarios**:

1. **Given** field F is configured optional, **When** a passenger is submitted without F, **Then** creation succeeds.
2. **Given** field F is configured required, **When** a passenger is submitted without F, **Then** creation is blocked with a specific reason (Story 3) naming F.
3. **Given** an optional field is missing, **When** the passenger appears in lists/reports, **Then** a visual marker indicates the field is missing.

---

### Edge Cases

- Two passengers share the same passport number due to data-entry typo — duplicate prompt (Story 1) must let the operator override and keep both.
- Gemini AI returns a low-confidence normalization — system stores the original raw value alongside the normalized value and flags low confidence as a warning (Story 3).
- Operator scans 1,000 passengers in one session — list rendering, search (Story 6), and filters (Story 7) must remain responsive.
- Search query is changed rapidly while list is re-rendering — no characters are dropped and focus is retained.
- Optional-field configuration is changed mid-session — existing records are not retroactively invalidated.
- Report is exported while filters are active — exported file contains exactly the filtered, indexed rows.
- Gemini config is partially present (e.g., API key set, model name missing) — system reports the specific missing variable at startup.

## Requirements *(mandatory)*

### Functional Requirements

**Duplicate detection (Story 1)**

- **FR-001**: System MUST detect when an incoming scanned or imported passenger matches an existing record **within the current manifest/session** by primary identifier (passport number) and reject the duplicate while surfacing the existing record. Duplicate detection does NOT consult prior/historical manifests.
- **FR-002**: System MUST detect partial/fuzzy duplicates **within the current manifest/session** (matching primary identifier or matching across normalized name + date-of-birth + nationality with one or two missing fields) and prompt the operator with an "Is this <existing passenger>?" confirmation showing the field differences.
- **FR-003**: Duplicate prompt MUST offer at minimum: Merge into existing, Keep as separate record, Cancel.
- **FR-004**: System MUST apply duplicate detection consistently across manual entry, single-passport scan, and bulk import (always scoped to the current manifest/session).

**Capacity (Story 2)**

- **FR-005**: System MUST allow an unbounded number of passengers per session/manifest; no hard-coded 100-record cap.
- **FR-006**: List, search, filter, and report functions MUST continue to operate correctly with at least 1,000 passengers in a single manifest.

**AI normalization (Story 4)**

- **FR-007**: System MUST read Gemini AI configuration (API key, model name, endpoint/region, request timeout) from environment variables; no credentials in source.
- **FR-008**: System MUST normalize incoming passenger records (name ordering, casing, date format, transliteration) via the configured AI service before persisting and before duplicate matching. The full passenger record — including passport number, names, date of birth, nationality, gender, and document type — MAY be sent to Gemini as-is; no field-level redaction or pseudonymization is required.
- **FR-008a**: System MUST display a one-time notice to the operator (acknowledged per install) stating that scanned/imported passenger data is transmitted to Google Gemini for normalization, so the operator/administrator can confirm this is compatible with their local privacy obligations before use.
- **FR-009**: System MUST fall back to deterministic local normalization when the AI service is unavailable or misconfigured, and MUST record the failure reason. Persistent online connectivity is assumed during normal operation; no offline queue, deferred normalization, or background replay of unsent records is required.
- **FR-010**: System MUST preserve the original raw scanned/imported values alongside normalized values.

**Import formats**

- **FR-010a**: Bulk import MUST accept Excel (`.xlsx`), CSV, JSON, and PDF (tabular) files. Each format MUST surface format-specific parse errors with row/sheet/page references where applicable.

**Reasons for warnings/errors (Story 3)**

- **FR-011**: System MUST display a specific, human-readable reason for every import, scan, normalization, validation, or save failure, including the field or rule that triggered it.
- **FR-012**: Warnings (non-blocking) MUST be distinguishable from errors (blocking) in the UI.

**Report indexing (Story 5)**

- **FR-013**: Every report and list view MUST display a 1-based sequential row-index column reflecting the visible (post-filter, post-sort) order.

**Search input (Story 6)**

- **FR-014**: The passenger-list search input MUST retain keyboard focus across re-renders so the operator can type a multi-character query in one continuous action.

**Advanced filters (Story 7)**

- **FR-015**: System MUST provide an advanced filter panel on the passenger list supporting at minimum: nationality, gender, age or date-of-birth range, document type, scan source (scan/import/manual), duplicate-flag status, and warning/error status.
- **FR-016**: Filters MUST be combinable (AND across criteria) and reversible via a single "Clear filters" action.
- **FR-017**: Filters MUST apply to both the on-screen list and to generated reports/exports while active.

**Optional fields (Story 8)**

- **FR-018**: System MUST provide an in-app Settings screen, accessible to any operator (no separate admin role or authentication), where individual passenger fields can be marked required or optional. Changes take effect for subsequent scans/imports/manual entries.
- **FR-019**: System MUST accept submissions missing optional fields and visually flag the missing values in lists and reports.
- **FR-020**: System MUST reject submissions missing required fields with a reason naming the field (per FR-011).

**Cross-cutting**

- **FR-021**: All new behavior MUST work for both Arabic and Latin script passenger names (existing app is bilingual).

### Key Entities *(include if feature involves data)*

- **Passenger**: A person on a manifest. Attributes include passport number (primary identifier), given name(s), family name, date of birth, nationality, gender, document type, raw scanned/imported values, normalized values, scan source, duplicate-status flag, warnings list, and per-field "missing" markers.
- **Manifest / Session**: The current collection of passengers being processed; no longer capped at 100. Holds the active filter set and reporting context.
- **Field Configuration**: Per-field metadata declaring whether a field is required or optional and any validation rules.
- **AI Normalization Configuration**: Environment-sourced settings for the Gemini integration (credentials, model, endpoint, timeout, retry policy).
- **Duplicate Decision**: Operator's resolution (Merge / Keep separate / Cancel) for a fuzzy-match prompt, retained for audit.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Duplicate passengers (exact passport-number match) are caught 100% of the time on re-scan or re-import **within the same manifest/session**, with zero duplicate records created. Cross-session duplicates are out of scope.
- **SC-002**: For partial-match cases, the duplicate-confirmation prompt fires in at least 95% of test cases where a known same-person record exists with one or two missing/differing non-key fields.
- **SC-003**: A single manifest containing 1,000 passengers can be created, listed, filtered, searched, and exported with on-screen interactions completing in under 2 seconds.
- **SC-004**: 100% of failure conditions across scan, import, and normalization surface a specific reason; no generic "an error occurred" messages remain in those flows.
- **SC-005**: Typing a 10-character search query requires exactly one click on the search input; no characters are lost.
- **SC-006**: Every report output includes a row-index column and is verifiably 1..N for displayed rows.
- **SC-007**: Operators report (in a brief post-deployment survey) at least a 50% reduction in time spent reconciling duplicates compared to the prior version.
- **SC-008**: Gemini configuration can be rotated entirely via environment variables with no code change and no application redeploy beyond a restart.

## Assumptions

- The existing app is the seaport passport scanner from feature `001-seaport-passport-scanner`; this is an enhancement layer, not a rewrite.
- Passport number is acceptable as the primary identifier for exact-match duplicate detection; combinations of normalized name + DOB + nationality are acceptable as fuzzy-match keys.
- A Gemini AI account/API key will be provisioned by the operator/administrator; the application only consumes it.
- "Unlimited" passengers is bounded only by device memory and storage, not by an application-imposed cap.
- Field required/optional configuration is set from an in-app Settings screen by any operator; there is no separate administrator role or login.
- Existing scan and import code paths can be extended; no migration of stored passengers from prior sessions is required.
- The search-bar focus issue is a UI re-render problem (component identity changing on each keystroke) rather than a platform bug.

## Dependencies

- Access to Google Gemini API (network egress + valid API key). Operating environment is expected to have reliable internet connectivity during scanning/import sessions.
- The existing passenger storage, scan, and import modules from feature 001.
- A configuration mechanism that reads environment variables at startup.
