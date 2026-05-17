# Contract: Import File Formats

**Feature**: 002-passenger-scanner-enhancements
**Files**: `src/main/services/importParsers/{xlsx,csv,json,pdf}.js` → `manifestImport.js`

All parsers return the same intermediate shape so downstream normalization, duplicate detection, and reason-collection are format-agnostic.

---

## Common output

```
RawPassengerRow: {
  rowIndex: number,    // 1-based, in source order
  raw: object,         // shape varies by source; minimum keys below
  parseWarnings: Reason[]
}

// raw MUST contain at least these keys when present in the source:
//   passportNumber, name (or givenName + familyName), dob, nationality
// Any other columns are passed through verbatim.
```

`manifestImport.js` then runs each `RawPassengerRow` through `normalizePassenger` → `detectDuplicate` → insert OR queue for the renderer's fuzzy-prompt walker.

---

## XLSX (Excel)

- Parser: `xlsx` (SheetJS) — already in feature 001's deps.
- First sheet only; first row is header.
- Header matching is case-insensitive and trims whitespace; aliases: `passport_no | passport | passport number → passportNumber`, `dob | date_of_birth | birth_date → dob`, `nat | country → nationality`.
- Empty rows skipped silently; rows with no `passportNumber` produce reason `IMPORT_NO_PASSPORT`.

## CSV

- Parser: SheetJS CSV mode (no new dep).
- UTF-8 with BOM tolerated; comma OR semicolon OR tab delimiter auto-detected from the header row.
- Quoting and escaped quotes per RFC 4180.
- Same header aliases as XLSX.

## JSON

- Parser: `JSON.parse`.
- Accepts either a top-level array OR an object with a `passengers` array.
- Each element is treated as `raw` directly; the parser only fills `rowIndex`.
- Validation: each element MUST be a plain object; otherwise reason `IMPORT_JSON_BAD_ELEMENT`.

## PDF (tabular)

- Parser: `pdf-parse` (new dep) for text extraction; a small column-anchor heuristic groups characters into columns based on x-coordinate clusters.
- First page treated as header detection; subsequent pages as data.
- If the heuristic finds fewer than 4 columns, the whole import fails with reason `IMPORT_PDF_NO_TABLE`.
- Per-row issues (missing cells, unparseable dates) attach reasons but do not abort the import.

---

## Reason codes introduced by importers

| Code | Severity | Meaning |
|---|---|---|
| `IMPORT_NO_PASSPORT` | error | Row had no recognizable passport number column or value. |
| `IMPORT_DOB_UNPARSEABLE` | warning | DOB present but could not be coerced to ISO date; left raw, will go through Gemini. |
| `IMPORT_JSON_BAD_ELEMENT` | error | A JSON array element was not a plain object. |
| `IMPORT_PDF_NO_TABLE` | error | PDF extractor could not locate a tabular layout. |
| `IMPORT_FORMAT_UNSUPPORTED` | error | File extension or detected format is not one of xlsx/csv/json/pdf. |
| `IMPORT_FILE_UNREADABLE` | error | File could not be opened. |

All codes resolve to localized messages via the `reasons.*` i18n namespace in `renderer/i18n/locales/{ar,en}.json`.
