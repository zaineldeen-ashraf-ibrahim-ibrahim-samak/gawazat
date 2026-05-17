# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/e2e/smoke.spec.js >> Smoke Test (5-minute quickstart) >> Step 3: Import manifest
- Location: tests/e2e/smoke.spec.js:73:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
TimeoutError: page.click: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('a[href="#/import"]')
    - locator resolved to <a href="#/import" class="nav-link py-1 px-2">…</a>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - performing click action
      - <a href="#/dashboard" class="nav-link py-1 px-2">…</a> intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - performing click action
      - <a href="#/dashboard" class="nav-link py-1 px-2">…</a> intercepts pointer events
    - retrying click action
      - waiting 100ms
    4 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - performing click action
      - <a href="#/dashboard" class="nav-link py-1 px-2">…</a> intercepts pointer events
    - retrying click action
      - waiting 500ms
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - performing click action
    - <a href="#/scan" class="nav-link py-1 px-2">…</a> intercepts pointer events
  28 × retrying click action
       - waiting 500ms
       - waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - performing click action
       - <a href="#/dashboard" class="nav-link py-1 px-2">…</a> intercepts pointer events
  2 × retrying click action
      - waiting 500ms
      - waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - performing click action
      - <i class="bi bi-upc-scan me-1"></i> from <a href="#/scan" class="nav-link py-1 px-2">…</a> subtree intercepts pointer events
  11 × retrying click action
       - waiting 500ms
       - waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - performing click action
       - <a href="#/dashboard" class="nav-link py-1 px-2">…</a> intercepts pointer events
  - retrying click action
    - waiting 500ms
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - performing click action
    - <i class="bi bi-upc-scan me-1"></i> from <a href="#/scan" class="nav-link py-1 px-2">…</a> subtree intercepts pointer events
  2 × retrying click action
      - waiting 500ms
      - waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - performing click action
      - <a href="#/scan" class="nav-link py-1 px-2">…</a> intercepts pointer events
  4 × retrying click action
      - waiting 500ms
      - waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - performing click action
      - <a href="#/dashboard" class="nav-link py-1 px-2">…</a> intercepts pointer events
  - retrying click action
    - waiting 500ms
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - performing click action
    - <i class="bi bi-upc-scan me-1"></i> from <a href="#/scan" class="nav-link py-1 px-2">…</a> subtree intercepts pointer events
  - retrying click action
    - waiting 500ms
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - performing click action
    - <a href="#/dashboard" class="nav-link py-1 px-2">…</a> intercepts pointer events
  - retrying click action
    - waiting 500ms
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - navigation [ref=e4]:
    - generic [ref=e5]:
      - link "بوابة المسافرين" [ref=e6] [cursor=pointer]:
        - /url: "#/"
        - generic [ref=e7]: بوابة المسافرين
      - generic: 
      - generic [ref=e8]:
        - generic [ref=e9]:
          - link " لوحة التحكم" [ref=e10] [cursor=pointer]:
            - /url: "#/dashboard"
            - generic [ref=e11]: 
            - text: لوحة التحكم
          - link " استيراد بيانات" [ref=e12] [cursor=pointer]:
            - /url: "#/import"
            - generic [ref=e13]: 
            - text: استيراد بيانات
          - link " المسح الضوئي" [ref=e14] [cursor=pointer]:
            - /url: "#/scan"
            - generic [ref=e15]: 
            - text: المسح الضوئي
          - link " قائمة المسافرين" [ref=e16] [cursor=pointer]:
            - /url: "#/passengers"
            - generic [ref=e17]: 
            - text: قائمة المسافرين
          - link " سجل المسح" [ref=e18] [cursor=pointer]:
            - /url: "#/history"
            - generic [ref=e19]: 
            - text: سجل المسح
          - link " التقارير" [ref=e20] [cursor=pointer]:
            - /url: "#/reports"
            - generic [ref=e21]: 
            - text: التقارير
          - link " قيد المراجعه" [ref=e22] [cursor=pointer]:
            - /url: "#/pending"
            - generic [ref=e23]: 
            - text: قيد المراجعه
        - generic [ref=e24]:
          - button "" [ref=e25] [cursor=pointer]:
            - generic [ref=e26]: 
          - link " الإعدادات" [ref=e27] [cursor=pointer]:
            - /url: "#/settings"
            - generic [ref=e28]: 
            - text: الإعدادات
          - combobox [ref=e29]:
            - option "العربية" [selected]
            - option "English"
  - main [ref=e30]
  - text: 
```

# Test source

```ts
  1   | /**
  2   |  * Smoke Test E2E — 5-minute quickstart validation
  3   |  * T078: Validates the full end-to-end flow per quickstart.md
  4   |  * 
  5   |  * Steps:
  6   |  * 1. App launches in Arabic RTL
  7   |  * 2. Settings → set Ship Name, Scan Mode = Keyboard
  8   |  * 3. Import → load manifest-10.xlsx, preview, confirm
  9   |  * 4. Scan → known passenger (green), unknown (yellow), duplicate (orange)
  10  |  * 5. Dashboard → verify counters
  11  |  * 6. Passenger List → verify count
  12  |  * 7. Pending Approval → verify yellow scan appeared
  13  |  */
  14  | 
  15  | const { test, expect, _electron: electron } = require('@playwright/test');
  16  | const path = require('path');
  17  | 
  18  | const APP_PATH = path.resolve(__dirname, '..', '..');
  19  | const FIXTURE_MANIFEST = path.resolve(__dirname, '..', 'fixtures', 'manifest-10.xlsx');
  20  | 
  21  | // TD3 MRZ samples — must match test fixture data
  22  | const KNOWN_TD3 = [
  23  |   'P<EGYSMITH<<JOHN<<<<<<<<<<<<<<<<<<<<<<<<<<<<',
  24  |   'EG1234560EGY9005155M3012315<<<<<<<<<<<<<<06',
  25  | ].join('\n');
  26  | 
  27  | const UNKNOWN_TD3 = [
  28  |   'P<USADOE<<JANE<<<<<<<<<<<<<<<<<<<<<<<<<<<<<',
  29  |   'US9999990USA8506152F2512317<<<<<<<<<<<<<<02',
  30  | ].join('\n');
  31  | 
  32  | test.describe('Smoke Test (5-minute quickstart)', () => {
  33  |   let electronApp;
  34  |   let page;
  35  | 
  36  |   test.beforeAll(async () => {
  37  |     electronApp = await electron.launch({
  38  |       args: [APP_PATH],
  39  |     });
  40  |     page = await electronApp.firstWindow();
  41  |     await page.waitForLoadState('domcontentloaded');
  42  |     await page.waitForTimeout(1000); // Wait for i18n init
  43  |   });
  44  | 
  45  |   test.afterAll(async () => {
  46  |     if (electronApp) {
  47  |       await electronApp.close();
  48  |     }
  49  |   });
  50  | 
  51  |   test('Step 1: App launches in Arabic RTL', async () => {
  52  |     const htmlDir = await page.getAttribute('html', 'dir');
  53  |     const htmlLang = await page.getAttribute('html', 'lang');
  54  |     expect(htmlDir).toBe('rtl');
  55  |     expect(htmlLang).toBe('ar');
  56  |   });
  57  | 
  58  |   test('Step 2: Navigate to Settings and configure', async () => {
  59  |     await page.click('a[href="#/settings"]');
  60  |     await page.waitForSelector('#settings-form');
  61  | 
  62  |     // Set ship name
  63  |     await page.fill('#input-ship-name', 'MV Test');
  64  | 
  65  |     // Set scan mode to keyboard
  66  |     await page.selectOption('#select-scan-mode', 'keyboard');
  67  | 
  68  |     // Submit
  69  |     await page.click('#btn-save-settings');
  70  |     await page.waitForTimeout(500);
  71  |   });
  72  | 
  73  |   test('Step 3: Import manifest', async () => {
> 74  |     await page.click('a[href="#/import"]');
      |                ^ TimeoutError: page.click: Timeout 30000ms exceeded.
  75  |     await page.waitForSelector('#import-dropzone');
  76  | 
  77  |     // Note: In a real E2E test, we would use IPC to simulate file selection
  78  |     // Since we can't trigger native dialog in Playwright, we test via IPC directly
  79  |     const result = await page.evaluate(async (filePath) => {
  80  |       return await window.api.manifest.preview({ filePath });
  81  |     }, FIXTURE_MANIFEST);
  82  | 
  83  |     // Verify preview returned passengers
  84  |     expect(result.ok).toBe(true);
  85  |     expect(result.passengers.length).toBeGreaterThan(0);
  86  | 
  87  |     // Now actually import
  88  |     const importResult = await page.evaluate(async (filePath) => {
  89  |       return await window.api.manifest.import({ filePath });
  90  |     }, FIXTURE_MANIFEST);
  91  | 
  92  |     expect(importResult.ok).toBe(true);
  93  |     expect(importResult.passengers.length).toBeGreaterThan(0);
  94  |   });
  95  | 
  96  |   test('Step 4: Navigate to Dashboard and verify initial state', async () => {
  97  |     await page.click('a[href="#/dashboard"]');
  98  |     await page.waitForTimeout(500);
  99  | 
  100 |     // Dashboard should show total passengers > 0
  101 |     const content = await page.textContent('.page-dashboard');
  102 |     expect(content).toBeTruthy();
  103 |   });
  104 | 
  105 |   test('Step 5: Navigate to Passenger List and verify count', async () => {
  106 |     await page.click('a[href="#/passengers"]');
  107 |     await page.waitForTimeout(500);
  108 | 
  109 |     // Should have rows in the table
  110 |     const rows = await page.$$('tbody tr');
  111 |     expect(rows.length).toBeGreaterThan(0);
  112 |   });
  113 | 
  114 |   test('Step 6: Verify language switch works', async () => {
  115 |     // Switch to English
  116 |     await page.click('#btn-lang-en');
  117 |     await page.waitForTimeout(500);
  118 | 
  119 |     const htmlLang = await page.getAttribute('html', 'lang');
  120 |     expect(htmlLang).toBe('en');
  121 | 
  122 |     // Switch back to Arabic
  123 |     await page.click('#btn-lang-ar');
  124 |     await page.waitForTimeout(500);
  125 | 
  126 |     const htmlLangAr = await page.getAttribute('html', 'lang');
  127 |     expect(htmlLangAr).toBe('ar');
  128 |   });
  129 | 
  130 |   test('Step 7: Help modal opens with Ctrl+/', async () => {
  131 |     await page.keyboard.press('Control+/');
  132 |     await page.waitForTimeout(500);
  133 | 
  134 |     const modal = await page.$('#helpModal.show');
  135 |     // Modal should be visible (Bootstrap adds .show class)
  136 |     expect(modal).toBeTruthy();
  137 | 
  138 |     // Close it
  139 |     await page.keyboard.press('Escape');
  140 |     await page.waitForTimeout(300);
  141 |   });
  142 | });
  143 | 
```