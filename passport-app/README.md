# بوابة المسافرين — Seaport Passport Scanner

An offline-first, secure desktop application for verifying passenger passports at seaport entry gates. Built with Electron + vanilla JavaScript, Bootstrap 5 RTL, and encrypted local storage.

## Prerequisites

- Node.js LTS (≥ 20)
- npm ≥ 10
- macOS for development; Windows 10/11 x64 for the production target
- (Optional) A Regula Baltija reader on the same Windows workstation in production; not required for development

## First-time Setup

```bash
git clone <repo-url> gawazat
cd gawazat/passport-app
npm install
```

## Run in Development

```bash
npm run dev
```

This launches Electron with `nodemon` for auto-reloading on file changes. The Scan page can be tested without a real Regula device by switching **Settings → Scan Mode** to **Keyboard** and typing a sample MRZ into the focused input.

Sample MRZs are available in `tests/unit/mrz.spec.js`.

## Run Tests

```bash
npm test                # all test suites
npm run test:unit       # MRZ parser, normalize, retention
npm run test:locale     # AR/EN key parity (fails CI on drift)
npm run test:e2e        # Playwright + Electron, IPC contracts and scan flows
```

## Build the Windows Installer (from macOS)

```bash
npm run build-win
```

Produces `dist/بوابة المسافرين Setup x.y.z.exe` (NSIS, x64, AR/EN installer languages).

> **Note**: Code signing is disabled in development; production builds require a code-signing cert configured via `electron-builder`.

### Required Assets

All assets are **auto-downloaded** on `npm install` (via `postinstall`) or manually via `npm run setup-assets`.

#### Vendor JavaScript (`renderer/vendor/`)

| File | Size | Status | Source | Used By |
|------|------|--------|--------|---------|
| `bootstrap.bundle.min.js` | ~81 KB | ✅ Present | `node_modules/bootstrap/dist/js/` | Dropdowns, modals, tooltips |
| `i18next.min.js` | ~49 KB | ✅ Present | `node_modules/i18next/` | Arabic/English translations |

#### Vendor CSS (`renderer/styles/vendor/`)

| File | Size | Status | Source | Used By |
|------|------|--------|--------|---------|
| `bootstrap.rtl.min.css` | ~233 KB | ✅ Present | `node_modules/bootstrap/dist/css/` | Arabic RTL layout (default) |
| `bootstrap.min.css` | ~233 KB | ✅ Present | `node_modules/bootstrap/dist/css/` | English LTR layout |
| `bootstrap-icons.css` | ~100 KB | ✅ Present | `node_modules/bootstrap-icons/font/` | Icon font stylesheet |

#### Vendor Fonts (`renderer/styles/vendor/fonts/`)

| File | Size | Status | Source | Used By |
|------|------|--------|--------|---------|
| `bootstrap-icons.woff` | ~180 KB | ✅ Present | `node_modules/bootstrap-icons/font/fonts/` | Icon glyphs |
| `bootstrap-icons.woff2` | ~134 KB | ✅ Present | `node_modules/bootstrap-icons/font/fonts/` | Icon glyphs (compressed) |

#### Arabic Fonts for PDF Reports (`renderer/assets/fonts/`)

| File | Size | Status | Source | Used By |
|------|------|--------|--------|---------|
| `Amiri-Regular.ttf` | ~430 KB | ✅ Auto-downloaded | [Google Fonts — Amiri](https://fonts.google.com/specimen/Amiri) | `reportPdf.js` — Arabic text in PDF reports |
| `Amiri-Bold.ttf` | ~407 KB | ✅ Auto-downloaded | [Google Fonts — Amiri](https://fonts.google.com/specimen/Amiri) | `reportPdf.js` — Bold Arabic text in PDF reports |

#### Audio Cues (`renderer/assets/audio/`)

| File | Size | Status | Source | Used By |
|------|------|--------|--------|---------|
| `success.wav` | ~35 KB | ✅ Auto-generated | Two-tone chime (C5→E5, 400ms) | Green scan result audio cue |
| `warning.wav` | ~52 KB | ✅ Auto-generated | Single tone (A3, 600ms) | Yellow/Orange scan result audio cue |

#### Application Icon (`renderer/assets/`)

| File | Size | Status | Source | Used By |
|------|------|--------|--------|---------|
| `icon.ico` | ~4 KB | ✅ Auto-generated | 32×32 navy/gold shield | BrowserWindow icon + Windows installer icon |

#### i18n Locale Files (`renderer/i18n/locales/`)

| File | Status | Used By |
|------|--------|---------|
| `ar.json` | ✅ Present (68 keys) | Arabic translations (source of truth) |
| `en.json` | ✅ Present (68 keys) | English translations |

#### App Theme (`renderer/styles/`)

| File | Status | Used By |
|------|--------|---------|
| `theme.css` | ✅ Present | Dark-navy premium theme, all CSS overrides |

#### Google Fonts (loaded at runtime via CSS `@import`)

| Font | Status | Used By |
|------|--------|---------|
| [Cairo](https://fonts.google.com/specimen/Cairo) | 🌐 Remote (runtime) | Main UI text — Arabic + Latin. Loaded from `fonts.googleapis.com` via `theme.css`. Falls back to system fonts if offline. |

### Packaging Checklist

1. Run `npm install` — all assets are auto-downloaded by `postinstall`.
2. Or run `npm run setup-assets` to re-download assets only.
3. Run `npm test` — all tests must pass before building.
4. Run `npm run build-win` — the output will be in the `dist/` directory.

## Project Structure

```
passport-app/
├── src/
│   ├── main/           # Electron main process
│   │   ├── index.js    # App lifecycle, BrowserWindow
│   │   ├── preload.js  # contextBridge API
│   │   ├── ipc/        # IPC handlers (manifestHandlers, scanHandlers, etc.)
│   │   ├── services/   # Business logic (scanProcessor, reportPdf, regulaClient, etc.)
│   │   └── store/      # Encrypted state management
│   └── shared/         # Code shared between main and renderer
│       ├── entities.js # Data model factories
│       ├── mrz.js      # MRZ parser (TD1/TD3)
│       └── normalize.js# Passport number normalization
├── renderer/
│   ├── index.html      # Entry point (RTL, Bootstrap)
│   ├── app.js          # App shell, nav, language switcher
│   ├── router.js       # Hash-based SPA router
│   ├── pages/          # Page renderers (dashboard, scan, import, etc.)
│   ├── i18n/           # i18next setup + AR/EN locale files
│   ├── styles/         # theme.css + vendor CSS
│   ├── vendor/         # Bundled JS libs (no CDN)
│   └── assets/         # Icons, fonts, audio
└── tests/
    ├── unit/           # Mocha + Chai unit tests
    ├── locale/         # i18n parity tests
    └── e2e/            # Playwright E2E tests
```

## Where Data Lives at Runtime

| Data          | Location                                                         |
|---------------|------------------------------------------------------------------|
| Encrypted store | `%APPDATA%/passport-app/store.enc` (Win) or `~/Library/Application Support/passport-app/store.enc` (Mac) |
| Logs          | `<userData>/logs/main.log` (rotated, 5MB × 5 files, **no PII**) |

## Resetting

- **Soft reset** (clear voyage data only): Settings → "Clear current session". Keeps language, scan mode, retention setting.
- **Hard reset** (factory): delete the `userData` directory while the app is closed.

## Keyboard Shortcuts

| Shortcut (macOS / Windows) | Action                         |
|---------------------------|--------------------------------|
| `⌘ + /` / `Ctrl + /`     | Open keyboard shortcuts help   |
| `Enter`                   | Submit MRZ scan                |
| `Escape`                  | Clear scan result              |
| `F5`                      | Reset scan page                |
| `⌘ + Z` / `Ctrl + Z`     | Undo last entry (on green)     |

## Supported Devices

| Device | Mode | Description |
|--------|------|-------------|
| **Keyboard** | `keyboard` | Default. Operator types or pastes MRZ text directly. No hardware required. |
| **Regula** | `regula` | Regula Document Reader SDK via local HTTP API (default: `localhost:8080`). |
| **DESKO Penta** | `penta` | DESKO Penta Scanner via local Page Scan API (default: `localhost:8085`). |

Configure the active device in **Settings → Scan Mode**. Device-specific URL and polling interval settings appear automatically.

## Smoke Test (5 Minutes)

1. Launch the app. Default UI is Arabic RTL.
2. **Settings** → set Ship Name = "MV Test", Scan Mode = "Keyboard".
3. **Import** → drag `tests/fixtures/manifest-10.xlsx`. Expect a 10-row preview, no errors.
4. **Scan** → focus is on the MRZ input by default. Paste the TD3 fixture from `tests/unit/mrz.spec.js`. Expect a green result, success cue, "Undo last entry" available for ~3 s, then auto-reset.
5. **Scan** → paste a TD3 not in the fixture manifest. Expect a yellow flash with "أُضيف إلى قائمة المراجعة", auto-reset, and the entry visible on Pending Approval.
6. **Scan** → paste the same green TD3 again. Expect orange duplicate.
7. **Reports** → generate "Entered passengers" PDF. Verify Arabic text shapes correctly and totals match.

## Security Model

- **Electron**: `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, `webSecurity: true`
- **CSP**: `script-src 'self'` — no inline scripts, no eval
- **Data**: Encrypted at rest via `safeStorage` (OS keychain)
- **Network**: Zero outbound connections (except loopback for Regula device)
- **Logging**: All PII (passport numbers, names, DOB) redacted before logging

## License

PROPRIETARY — Port Said Authority
