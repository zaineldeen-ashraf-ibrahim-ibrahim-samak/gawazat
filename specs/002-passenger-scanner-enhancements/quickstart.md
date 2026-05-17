# Quickstart: Passenger Scanner Enhancements (Feature 002)

**Audience**: Developer setting up to implement feature 002 on top of the existing `passport-app/` from feature 001.
**Prerequisites**: feature 001 quickstart already completed; Node + npm installed; the app builds and runs locally.

---

## 1. New runtime dependencies

```powershell
cd passport-app
npm install @google/generative-ai pdf-parse
```
That's all the new packages this feature needs. SheetJS, pdfmake, i18next, electron-log, Bootstrap RTL, Mocha/Chai, and Playwright are all already in `package.json` from feature 001.

## 2. Environment variables (for the Gemini integration)

Create `passport-app/.env.local` (gitignored) for local dev:

```env
GEMINI_API_KEY=your-key-here
GEMINI_MODEL=gemini-1.5-flash
GEMINI_TIMEOUT_MS=2000
GEMINI_MAX_RETRIES=1
```

In production the operator/administrator sets these via the system environment (System Properties → Environment Variables on Windows, or a `.env` loaded by the Electron `main` process). Missing `GEMINI_API_KEY` is **not** an error — the app starts with local-fallback normalization only and shows a one-time settings banner.

## 3. Run the app locally

```powershell
npm start
```

You should see:

- The existing dashboard, unchanged.
- On first launch with this feature: a one-time modal disclosing that passenger data will be sent to Google Gemini (per FR-008a). Click **Acknowledge**.
- The Settings tab now has a **Field Requirements** section listing each passenger field with a required/optional toggle.
- The Passenger List has an **Advanced Filters** button next to the search bar; the search bar now retains focus while typing.

## 4. Smoke test (manual, ~3 minutes)

1. **Search focus fix**: open Passenger List, click the search bar once, type `mohamed` — all seven characters land without re-clicking.
2. **Duplicate exact match**: import the existing `manifest-10.xlsx`; immediately scan one of those passports → a toast "Already scanned" appears, no duplicate row added.
3. **Duplicate fuzzy match**: scan a passenger whose passport differs in case/spacing but whose name + DOB + nationality match → "Is this <name>?" modal opens; pick **Merge** → the existing row is updated, no new row.
4. **Capacity > 100**: import `manifest-1000.xlsx`; verify all 1,000 rows appear; sort and scroll; no warnings.
5. **Indexed report**: from Reports, generate the PDF → row 1..N column present and matches displayed order.
6. **Field requirements**: in Settings, mark `gender` optional; scan a passenger with no gender → record saved, gender shown with a "missing" badge.
7. **Advanced filters**: open Advanced Filters, set `nationality = EGY` AND `hasWarning = true` → list narrows accordingly; click **Clear** to reset.

## 5. Automated tests

```powershell
npm test                          # all Mocha unit + locale-parity
npm run test:e2e                  # Playwright Electron E2E
npm run test:e2e -- --grep "duplicate"  # focused subset
```

New test files (per the plan) live under `tests/unit/` and `tests/e2e/` and are named after the user story they exercise.

## 6. Disabling Gemini for offline development

Unset `GEMINI_API_KEY` (or set it to empty) and restart. The app uses `localNormalize.js` for every record; all flows continue to work, with `source: 'local-fallback'` and a `GEMINI_DISABLED` warning attached to each new passenger.

## 7. Build the Windows installer

Unchanged from feature 001:

```powershell
npm run build:win
```

The Gemini SDK ships inside the asar bundle; the API key is **never** baked in (it's read from `process.env` at runtime).
