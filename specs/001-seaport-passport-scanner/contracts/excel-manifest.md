# Contract: Excel Manifest Import

## Required columns (header names — case-insensitive, both AR and EN accepted)

| Canonical key | English header | Arabic header | Type | Validation |
|---|---|---|---|---|
| `passport_number` | `passport_number` or `Passport Number` | `رقم الجواز` | string | non-empty; ≥ 5 chars after normalization |
| `name` | `name` or `Full Name` | `الاسم` | string | non-empty |
| `gender` | `gender` | `النوع` | enum | resolves to `M`/`F` from `M/F/Male/Female/ذكر/أنثى` |
| `nationality` | `nationality` | `الجنسية` | string | ISO 3166-1 alpha-3 (e.g., `EGY`); 3-letter validated |
| `date_of_birth` | `date_of_birth` or `DoB` | `تاريخ الميلاد` | date | ISO `YYYY-MM-DD` or Excel native date; must be in the past |

## Optional columns

| Canonical key | English | Arabic | Type |
|---|---|---|---|
| `vessel` | `vessel` | `السفينة` | string |
| `seat` | `seat` | `المقعد` | string |

## Blank-template column order (downloadable from Import page)

```
رقم الجواز | الاسم | النوع | الجنسية | تاريخ الميلاد | السفينة (اختياري) | المقعد (اختياري)
```

A second sheet named `Instructions` documents the accepted formats, sample rows, and notes that empty rows are skipped silently.

## Validation outcomes

For each row:

- **Pass**: row imports as a `Passenger`.
- **Warn**: row imports but a non-required field is missing/malformed (e.g., bad nationality code) — flagged in the preview table.
- **Error**: row is rejected. Errors are listed by row number with the violated rule. Import does not commit until the operator clicks "Import valid rows" or fixes the file.

Cross-row validation:

- Duplicate `passport_number_normalized` within the file → all duplicates are errored (the operator must decide which to keep).
- More than `2000` rows → import is allowed but a warning is shown that performance targets (SC-001/SC-002) were sized for ~600.

## Filtered export

The Passenger List exports use the same canonical column keys plus two extra columns: `boarding_status` (`entered` / `pending`) and `entered_at` (ISO datetime, blank if not entered). Filters and search are applied **before** export.
