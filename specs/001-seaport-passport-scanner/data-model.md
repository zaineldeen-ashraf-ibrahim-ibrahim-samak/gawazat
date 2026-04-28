# Data Model — Seaport Passport Scanner

All entities live inside one encrypted JSON blob (`userData/store.enc`). The schema below is what is held in memory and serialized; ISO 8601 (`YYYY-MM-DDTHH:mm:ssZ`) is used for all timestamps.

## Voyage

The currently-loaded voyage. Replaced on import. Cleared by "Clear current session".

| Field | Type | Notes |
|---|---|---|
| `id` | string (uuid v4) | Stable id; used by retention to group rows. |
| `ship_name` | string | From settings at import time. |
| `port_name` | string | Default `Port Said`; configurable in settings. |
| `imported_at` | string (ISO datetime) | Used by retention purge. |

## Passenger (manifest row)

| Field | Type | Required | Notes |
|---|---|---|---|
| `passport_number` | string | yes | Stored as-given; comparisons always use the normalized form. |
| `passport_number_normalized` | string | yes | Computed: trim → uppercase ASCII → strip non-`[A-Z0-9]`. **Index key.** |
| `name` | string | yes | As supplied by the manifest. |
| `gender` | enum `M`/`F` | yes | Normalized from `M/F/Male/Female/ذكر/أنثى`. |
| `nationality` | string (ISO 3166-1 alpha-3, e.g. `EGY`) | yes | Validated at import. |
| `date_of_birth` | string (ISO date) | yes | Excel-native date or ISO. |
| `vessel` | string | no | Optional manifest column. |
| `seat` | string | no | Optional manifest column. |
| `source` | enum `manifest`/`added-at-gate` | yes | `added-at-gate` is set when an entry is approved from Pending Approval. |

Uniqueness: `passport_number_normalized` MUST be unique within a voyage. Duplicates in the imported Excel are reported as validation errors at import time.

## ScanEvent

Append-only log of every read attempt.

| Field | Type | Notes |
|---|---|---|
| `id` | string (uuid v4) | |
| `voyage_id` | string | Foreign key. |
| `at` | string (ISO datetime) | |
| `mode` | enum `keyboard`/`api` | Which input path produced this event. |
| `outcome` | enum `green`/`yellow`/`orange`/`read-failed`/`operator-undone`/`pending-approved`/`pending-rejected` | See state-machine below. |
| `mrz_fields` | object | `{ document_number, surname, given_names, nationality, date_of_birth, sex, expiry_date, check_digits_valid }`. May be partial on `read-failed`. |
| `linked_passport_number_normalized` | string | Set when matched; unset for unknowns and read failures. |
| `linked_pending_id` | string | When the event resolves a Pending Approval entry. |

`ScanEvent` records are **never** mutated; corrections create new events (`operator-undone`, `pending-approved`, `pending-rejected`).

## BoardingRecord

The denormalized "is this passenger entered?" snapshot, keyed by normalized passport number.

| Field | Type | Notes |
|---|---|---|
| `passport_number_normalized` | string | Primary key (single record per passenger). |
| `voyage_id` | string | |
| `entered_at` | string (ISO datetime) | |
| `via` | enum `auto`/`manual-toggle`/`pending-approval` | Provenance for audit. |
| `last_scan_event_id` | string | Back-pointer for traceability. |

Removed (not just flagged) when an `operator-undone` event occurs within the Undo window. Manual-toggle off in the Passenger List also removes it and writes a corresponding `ScanEvent` of outcome `operator-undone`.

## PendingApprovalEntry

| Field | Type | Notes |
|---|---|---|
| `id` | string (uuid v4) | |
| `voyage_id` | string | |
| `created_at` | string (ISO datetime) | Original scan time. |
| `mrz_fields` | object | Same shape as `ScanEvent.mrz_fields`. |
| `state` | enum `awaiting`/`approved`/`rejected` | Only `awaiting` rows show on the Pending Approval page. |
| `resolved_at` | string (ISO datetime) | Set on transition out of `awaiting`. |
| `resolution_event_id` | string | Points to the `ScanEvent` of outcome `pending-approved` or `pending-rejected`. |

State machine:

```
        ┌─ approve ─→ approved (creates Passenger source=added-at-gate + BoardingRecord via=pending-approval)
awaiting┤
        └─ reject  ─→ rejected (no boarding)
```

## AppSettings (preserved across "Clear current session")

| Field | Type | Default | Notes |
|---|---|---|---|
| `scan_mode` | enum `keyboard`/`api` | `api` | |
| `regula_url` | string | `http://localhost:8080` | |
| `regula_poll_ms` | int | `500` | |
| `ship_name` | string | `""` | Required before reports. |
| `port_name` | string | `Port Said` | |
| `auto_reset_seconds` | int (1–10) | `3` | |
| `sound_enabled` | bool | `true` | |
| `language` | enum `ar`/`en` | `ar` | Drives `dir` attr. |
| `retention_days` | int (1–365) | `30` | FR-026. |

## Indices held in memory (rebuilt on load)

- `manifestByNormalized: Map<string, Passenger>` — O(1) match lookup.
- `boardingByNormalized: Map<string, BoardingRecord>` — O(1) "already entered?" check.
- `pendingAwaiting: Array<PendingApprovalEntry>` — filtered view for the Pending Approval page.

## Validation rules summary

- `passport_number_normalized` non-empty and ≥ 5 chars after normalization (else import error).
- `nationality` is a 3-letter alpha (else import error, not blocking — row flagged).
- `date_of_birth` is a real date and is in the past.
- `gender` resolves to `M` or `F`.

## Lifecycle / state transitions in plain English

- A scan starts a `ScanEvent`. After matching, exactly one of `green`, `yellow`, `orange`, `read-failed` is the outcome.
- `green` writes a `BoardingRecord(via=auto)`. The Undo window adds an `operator-undone` event and removes the BoardingRecord.
- `yellow` creates a `PendingApprovalEntry(state=awaiting)`. Approving creates a `Passenger(source=added-at-gate)` + `BoardingRecord(via=pending-approval)` + `ScanEvent(outcome=pending-approved)`. Rejecting writes a `ScanEvent(outcome=pending-rejected)`.
- `orange` (duplicate) writes a `ScanEvent` only; no boarding state change.
- `read-failed` writes a `ScanEvent` only; no boarding state change. Counts as a warning.
