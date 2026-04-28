# Contract: main ↔ renderer IPC Bridge

Exposed exclusively via `contextBridge.exposeInMainWorld('api', { ... })` in `preload.js`. The renderer sees only the methods listed here; it has no direct access to Node, fs, or the Regula HTTP client.

JSDoc types are the source of truth — preload re-asserts shapes before forwarding. All channels are request/response (`ipcRenderer.invoke`) **unless** noted as event streams.

## Manifest

| Method | Direction | Args | Returns |
|---|---|---|---|
| `manifest:import` | renderer → main | `{ filePath: string }` | `{ ok: true, voyage: Voyage, passengers: Passenger[], errors: ImportError[] }` or `{ ok: false, error: string }` |
| `manifest:downloadTemplate` | renderer → main | `{ savePath: string }` | `{ ok: true }` |
| `manifest:list` | renderer → main | `{ filter?: 'all'/'entered'/'pending'/'M'/'F', search?: string }` | `Passenger[]` |
| `manifest:exportFiltered` | renderer → main | `{ filter, search, savePath }` | `{ ok: true, count: number }` |

## Scanning

| Method | Direction | Args | Returns |
|---|---|---|---|
| `scan:submitMrz` | renderer → main | `{ rawMrz: string }` | `ScanResult` |
| `scan:undoLast` | renderer → main | `{}` | `{ ok: boolean }` |
| `regula:setMode` | renderer → main | `{ mode: 'keyboard'/'api' }` | `{ ok: true }` |
| `regula:event` | main → renderer (event) | — | emits `ScanResult` whenever the Regula HTTP path produces one |
| `regula:status` | main → renderer (event) | — | emits `{ connected: boolean, lastError?: string }` |

`ScanResult` shape:

```json
{
  "outcome": "green | yellow | orange | read-failed",
  "scan_event_id": "uuid",
  "passenger": { /* Passenger when matched, else null */ },
  "mrz_fields": { /* parsed */ },
  "first_entered_at": "ISO when outcome=orange, else null",
  "pending_id": "uuid when outcome=yellow, else null"
}
```

## Pending Approval

| Method | Direction | Args | Returns |
|---|---|---|---|
| `pending:list` | renderer → main | `{}` | `PendingApprovalEntry[]` (state=awaiting only) |
| `pending:approve` | renderer → main | `{ id: string }` | `{ ok: true, passenger: Passenger }` |
| `pending:reject` | renderer → main | `{ id: string }` | `{ ok: true }` |

## History & reports

| Method | Direction | Args | Returns |
|---|---|---|---|
| `history:list` | renderer → main | `{}` | `ScanEvent[]` (newest first) |
| `history:export` | renderer → main | `{ savePath: string }` | `{ ok: true, count: number }` |
| `reports:generatePdf` | renderer → main | `{ kind: 'full'/'entered'/'pending'/'warnings', savePath: string }` | `{ ok: true }` |
| `reports:print` | renderer → main | `{ kind: ... }` | `{ ok: true }` |

## Settings & session

| Method | Direction | Args | Returns |
|---|---|---|---|
| `settings:get` | renderer → main | `{}` | `AppSettings` |
| `settings:set` | renderer → main | `Partial<AppSettings>` | `AppSettings` (merged) |
| `session:clear` | renderer → main | `{ confirmToken: string }` | `{ ok: true }` |

`session:clear` requires `confirmToken === 'CLEAR-CURRENT-SESSION'` to prevent accidental invocations from buggy renderer code.

## Dashboard

| Method | Direction | Args | Returns |
|---|---|---|---|
| `dashboard:stats` | renderer → main | `{}` | `{ ship_name, total, entered, pending, warnings, recent: ScanEvent[5] }` |

## Security invariants

1. No method exposes a raw file system path under `userData`. Save paths are always supplied by the renderer via the OS save-dialog (which it requests through a separate `dialog:saveFile` channel — also whitelisted).
2. The renderer cannot configure the encryption key, retention path, or log file path.
3. The renderer cannot call `regula:setMode` to a value other than `keyboard` or `api`; main re-validates.
4. All event listeners (`regula:event`, `regula:status`) are unicast — main sends to the single active `BrowserWindow`, never to arbitrary frames.
