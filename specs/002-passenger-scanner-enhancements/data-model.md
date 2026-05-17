# Data Model: Passenger Scanner Enhancements

**Feature**: 002-passenger-scanner-enhancements
**Date**: 2026-05-17
**Base**: Extends feature 001 entities (Passenger, Session/Manifest, Settings). Only **new** fields and **new** entities are documented here.

---

## Extended: Passenger (existing entity from feature 001)

New fields:

| Field | Type | Required | Description |
|---|---|---|---|
| `raw` | `object` | yes | The original, pre-normalization snapshot of the record as captured from scan or import. Includes at minimum `name`, `dob`, `nationality`, `gender`, `documentType`. |
| `normalized` | `object` | yes | Canonical values after AI or local normalization. Same shape as `raw` plus a `passportNumberKey` (uppercase, alphanumerics only) used as the duplicate-match key. |
| `normalizationSource` | `'gemini' \| 'local-fallback'` | yes | Which path produced `normalized`. |
| `normalizationConfidence` | `number \| null` | no | 0..1 when Gemini returns a confidence score; `null` otherwise. Values < 0.6 produce a warning. |
| `warnings` | `Reason[]` | yes | Empty array allowed. Populated by parser, normalizer, validator, or duplicate matcher. |
| `missingOptionalFields` | `string[]` | yes | List of field keys that were absent at insertion and are configured as optional. |
| `source` | `'scan' \| 'import' \| 'manual'` | yes | Origin of the record; used by the advanced filter. |
| `duplicateFlag` | `'unique' \| 'merged-from-duplicate' \| 'kept-separate-after-prompt'` | yes | Records the outcome of any duplicate prompt for this passenger; defaults to `unique`. |

Validation rules:

- `raw` and `normalized` MUST both exist before persistence.
- `normalized.passportNumberKey` MUST be unique within the current session (enforced by `duplicateMatcher`).
- A field listed in `missingOptionalFields` MUST be configured as `required: false` at the time of insertion.

State transitions (duplicate-related):

```
   (new record)
        │
        ▼
   normalize  ──► insert (duplicateFlag = "unique")
        │
        ▼ (exact passport match found)
   block insert, surface existing
        │
        ▼ (fuzzy match found, operator picks Merge)
   update existing, no new row, existing.duplicateFlag := "merged-from-duplicate"
        │
        ▼ (fuzzy match found, operator picks Keep separate)
   insert with duplicateFlag = "kept-separate-after-prompt"
```

---

## New: Reason

A small descriptor attached to errors and warnings throughout import, scan, normalization, and validation.

| Field | Type | Required | Description |
|---|---|---|---|
| `code` | `string` | yes | Stable, machine-readable, e.g. `MRZ_CHECKSUM_FAILED`, `DOB_UNPARSEABLE`, `DUPLICATE_PASSPORT`, `GEMINI_TIMEOUT`, `REQUIRED_FIELD_MISSING`. |
| `message` | `string` | yes | Localized, human-readable text resolved at render time from an i18n key. |
| `field` | `string?` | no | Field key the reason concerns (e.g. `"dob"`). |
| `suggestion` | `string?` | no | Optional next-action hint, also localized. |
| `severity` | `'warning' \| 'error'` | yes | `error` blocks the action; `warning` is informational. |

`code` values MUST exist in a central `src/shared/reasonCodes.js` constants file so both producers and tests reference the same set.

---

## New: DuplicateDecision (session-scoped audit)

Captures the operator's choice when a fuzzy-duplicate prompt fires. Persisted alongside the active session, NOT cross-session.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `uuid` | yes | |
| `incomingRaw` | `object` | yes | The `raw` of the new record that triggered the prompt. |
| `existingPassengerId` | `uuid` | yes | The existing matched passenger. |
| `differences` | `string[]` | yes | Field keys that differed between incoming and existing. |
| `decision` | `'merge' \| 'keep-separate' \| 'cancel'` | yes | |
| `decidedAt` | `ISO-8601 string` | yes | |

---

## Extended: Settings (existing entity)

New keys under `settings.*`:

| Key | Type | Default | Description |
|---|---|---|---|
| `fieldRequirements` | `Record<FieldKey, { required: boolean }>` | matches the feature 001 required set (passport number, family name, given name, DOB, nationality) | Editable from the Settings tab; toggle per field. |
| `geminiNoticeAcknowledged` | `boolean` | `false` | Set to `true` after the operator clicks Acknowledge on the PII-transmission notice modal. |
| `geminiAvailable` | `boolean` (runtime, NOT persisted) | computed | `true` iff required env vars resolved and a Gemini ping succeeded at startup. |

Editable fields (`required` toggles) MUST be from the canonical list in `src/shared/fieldRequirements.js`. Unknown keys are rejected.

---

## New: FilterState (renderer-only, transient)

Not persisted. Held in `passengerList` page state and reset on Clear.

```
{
  nationality?:   string,
  gender?:        'M' | 'F' | 'X',
  ageMin?:        number,
  ageMax?:        number,
  dobFrom?:       'YYYY-MM-DD',
  dobTo?:         'YYYY-MM-DD',
  documentType?:  string,
  source?:        'scan' | 'import' | 'manual',
  duplicateFlag?: 'unique' | 'merged-from-duplicate' | 'kept-separate-after-prompt',
  hasWarning?:    boolean
}
```

All criteria combine with AND. An empty object means "no filter".

---

## Indexes (in-memory, rebuilt on session load)

| Index | Purpose |
|---|---|
| `Map<passportNumberKey, Passenger>` | O(1) exact-match duplicate detection. |
| `Map<\`${normalizedName}\|${dob}\|${nationality}\`, Passenger>` | O(1) fuzzy-match candidate lookup; values then scored via Levenshtein on names. |

Both are derived state — never persisted — and are updated on every insert/merge/delete.
