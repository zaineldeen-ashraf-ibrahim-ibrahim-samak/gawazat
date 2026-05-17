# Contract: IPC Bridge Additions

**Feature**: 002-passenger-scanner-enhancements
**Surface**: `window.api.*` exposed by `src/main/preload.js` via `contextBridge`
**Direction**: renderer → main (request/response via `ipcRenderer.invoke` / `ipcMain.handle`)

All payloads are plain JSON-serializable objects. The preload re-validates argument shapes at runtime (no TypeScript per feature 001's documented exception).

---

## `normalizePassenger(raw) → NormalizationResult`

```
raw: {
  name: string,
  dob: string,
  nationality: string,
  gender?: string,
  documentType?: string,
  passportNumber: string,
  // ...any other captured fields
}

NormalizationResult: {
  normalized: { ...same keys..., passportNumberKey: string },
  source: 'gemini' | 'local-fallback',
  confidence: number | null,
  warnings: Reason[]    // see data-model.md
}
```

Errors: never throws to the renderer; failures are returned as `source: 'local-fallback'` with a populated `warnings` array.

## `detectDuplicate(normalized) → DuplicateMatchResult`

```
normalized: NormalizationResult.normalized

DuplicateMatchResult:
  | { kind: 'none' }
  | { kind: 'exact',  existingPassengerId: string }
  | { kind: 'fuzzy',  existingPassengerId: string, differences: string[] }
```

`exact` instructs the renderer to surface "Already scanned" and block insert. `fuzzy` instructs the renderer to open the "Is this …?" modal.

## `resolveDuplicate(decision) → { passengerId: string }`

```
decision: {
  incomingRaw: object,
  incomingNormalized: object,
  existingPassengerId: string,
  decision: 'merge' | 'keep-separate' | 'cancel'
}
```

`merge` updates the existing passenger and returns its id. `keep-separate` inserts a new passenger and returns the new id. `cancel` returns `{ passengerId: existingPassengerId }` and inserts nothing. All three append a `DuplicateDecision` audit entry.

## `getFieldRequirements() → Record<FieldKey, { required: boolean }>`

Returns the current configuration.

## `setFieldRequirements(next) → { ok: true }`

```
next: Record<FieldKey, { required: boolean }>
```

Validates against the canonical field list; unknown keys → throws (renderer shows a Reason).

## `acknowledgeGeminiNotice() → { ok: true }`

Persists `settings.geminiNoticeAcknowledged = true`. Idempotent.

## `importManifest(filePath, format) → ImportResult`

```
format: 'xlsx' | 'csv' | 'json' | 'pdf'

ImportResult: {
  inserted: number,
  duplicatesBlocked: number,
  fuzzyPrompted: number,         // count of rows that *would* prompt; the renderer
                                  // walks them via resolveDuplicate one at a time
  fuzzyPrompts: Array<{ rowIndex: number, raw: object, match: DuplicateMatchResult }>,
  rowErrors: Array<{ rowIndex: number, reason: Reason }>
}
```

---

## Contract tests (planned location: `tests/unit/ipc-contract.spec.js`)

For each method above:

- Argument-shape validation rejects malformed payloads with a `Reason` of code `IPC_INVALID_ARGS`.
- Return shape matches the documented schema (validated with a small schema-assert helper).
- `normalizePassenger` returns `source: 'local-fallback'` when Gemini env vars are missing.
- `detectDuplicate` returns `kind: 'none'` on empty session.
