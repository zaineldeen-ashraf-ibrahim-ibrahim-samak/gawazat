# Contract: Regula Local Web Service (consumed)

The Regula Baltija reader installs a local HTTP service on the same Windows workstation. The application **consumes** this service; we do not host it.

## Endpoints we depend on

### `GET {regula_url}/api/device/status`

Polled at `regula_poll_ms` (default 500 ms). Used to detect when a passport has been placed on the reader.

**Expected response (200 OK):**

```json
{
  "documentPlaced": true,
  "ready": true
}
```

The application treats `documentPlaced === true` as the trigger to issue `POST /api/process`. While a `/api/process` call is in flight, further `documentPlaced` polls are ignored to prevent double-firing.

### `POST {regula_url}/api/process`

Returns the parsed document fields once a placed document has been read.

**Expected response (200 OK), fields we read:**

```json
{
  "result": {
    "text": {
      "fields": {
        "DOCUMENT_NUMBER": "A12345678",
        "SURNAME_AND_GIVEN_NAMES": "ELSAYED<<MOHAMED<AHMED",
        "NATIONALITY": "EGY",
        "DATE_OF_BIRTH": "1985-04-12",
        "SEX": "M",
        "EXPIRY_DATE": "2031-08-30"
      }
    }
  }
}
```

Fields we deliberately ignore (per spec clarification — no portrait):

- `result.images.fields.PORTRAIT`
- `result.images.fields.DOCUMENT_FRONT`
- any other image fields

## Failure modes the app handles

| Condition | App behavior |
|---|---|
| Connection refused / DNS error | Scan page shows red "device service unreachable" banner; no scan events written; status banner clears once the next poll succeeds. |
| HTTP 5xx from `/api/process` | Logged; one retry after 500 ms; on second failure write a `ScanEvent` of outcome `read-failed`. |
| Response missing required fields | Treated as `read-failed`. |
| `check_digits_valid === false` after MRZ parse | `read-failed` (does NOT proceed to match). |
| Timeout > 5 s on `/api/process` | `read-failed`. |

## Configuration surface

Only `regula_url` (default `http://localhost:8080`) and `regula_poll_ms` (default 500) are user-tunable from Settings. No authentication is configured because the service is loopback-only.

## Boundaries

- The application MUST NOT call any other endpoint of the Regula service.
- The application MUST NOT expose the Regula URL to the renderer process; all HTTP from main.
- The application MUST NOT make any HTTP request to a non-loopback host (enforced by CSP `connect-src 'self' http://localhost:*`).
