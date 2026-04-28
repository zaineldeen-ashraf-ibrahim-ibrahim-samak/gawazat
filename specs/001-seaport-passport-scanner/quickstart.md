# Quickstart — Seaport Passport Scanner

## Prerequisites

- Node.js LTS (≥ 20)
- npm ≥ 10
- macOS for development; Windows 10/11 x64 for the production target
- (Optional) A Regula Baltija reader on the same Windows workstation in production; not required for development

## First-time setup

```bash
git clone <repo-url> gawazat
cd gawazat/passport-app
npm install
```

## Run in development (live reload of renderer)

```bash
npm start
```

This launches Electron with `--debug` enabled. The Scan page can be tested without a real Regula device by switching Settings → Scan Mode to **Keyboard** and typing a sample MRZ into the focused input. Sample MRZs are in `tests/unit/mrz.spec.js`.

## Run tests

```bash
npm test                # all test suites
npm run test:unit       # MRZ parser, normalize, retention
npm run test:locale     # AR/EN key parity (fails CI on drift)
npm run test:e2e        # Playwright + Electron, IPC contracts and scan flows
```

## Build the Windows installer (from macOS)

```bash
npm run build-win
```

Produces `dist/بوابة المسافرين Setup x.y.z.exe` (NSIS, x64, AR/EN installer languages). Code signing is disabled in development; production builds require a code-signing cert configured via `electron-builder`.

## Where data lives at runtime

- Encrypted store: `%APPDATA%/passport-app/store.enc` (Windows) or `~/Library/Application Support/passport-app/store.enc` (macOS dev).
- Logs: `<userData>/logs/main.log` (rotated, no PII).

## Resetting

- **Soft reset** (clear voyage data only): Settings → "Clear current session". Keeps language, scan mode, retention setting.
- **Hard reset** (factory): delete the `userData` directory while the app is closed.

## Smoke test (5 minutes)

1. Launch the app. Default UI is Arabic RTL.
2. Settings → set Ship Name = "MV Test", Scan Mode = "Keyboard".
3. Import → drag `tests/fixtures/manifest-10.xlsx`. Expect a 10-row preview, no errors.
4. Scan → focus is on the MRZ input by default. Paste the TD3 fixture from `tests/unit/mrz.spec.js`. Expect a green result, success cue, "Undo last entry" available for ~3 s, then auto-reset.
5. Scan → paste a TD3 not in the fixture manifest. Expect a yellow flash with "أُضيف إلى قائمة المراجعة", auto-reset, and the entry visible on Pending Approval.
6. Scan → paste the same green TD3 again. Expect orange duplicate.
7. Reports → generate "Entered passengers" PDF. Verify Arabic text shapes correctly and totals match.
