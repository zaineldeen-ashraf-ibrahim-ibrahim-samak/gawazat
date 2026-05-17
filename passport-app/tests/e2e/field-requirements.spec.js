const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');

const APP_PATH = path.resolve(__dirname, '..', '..');

test.describe('Field Requirements Flow (US8)', () => {
  let electronApp;
  let page;

  test.beforeAll(async () => {
    electronApp = await electron.launch({
      args: [APP_PATH],
    });
    page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000); // Wait for app init, i18n, and router
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('should toggle field optional in settings, scan record missing field, and show badge', async () => {
    // 0. Clear session data to ensure pristine state
    await page.evaluate(async () => { await window.api.session.clear(); });

    // 1. Go to settings and uncheck gender requirement
    await page.evaluate(() => { window.location.hash = '/settings'; });
    await page.waitForSelector('#table-field-reqs');

    const genderToggle = page.locator('input[data-key="gender"]');
    if (await genderToggle.isChecked()) {
      await genderToggle.uncheck();
    }
    
    // Save field requirements
    page.on('dialog', dialog => dialog.accept()); // Accept success alert
    await page.locator('#btn-save-field-reqs').click();
    await page.waitForTimeout(500);

    // 2. Go to scan page
    await page.evaluate(() => { window.location.hash = '/scan'; });
    await page.waitForSelector('#scan-prompt');

    // Simulate MRZ without gender (replace M/F with <)
    // Line 1: P<EGYDOE<<JOHN<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< (44 chars)
    // Line 2: AB123456<4EGY8001014<2501017<<<<<<<<<<<<<<06 (44 chars, check digits perfectly valid)
    const mrzMissingGender = 'P<EGYDOE<<JOHN<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<\nAB123456<4EGY8001014<2501017<<<<<<<<<<<<<<06';
    const scanRes = await page.evaluate(async (mrz) => {
      return await window.api.scan.submitMrz({ rawMrz: mrz });
    }, mrzMissingGender);

    console.log('scanRes:', scanRes);

    expect(scanRes.outcome).not.toBe('read-failed');
    expect(scanRes.outcome).not.toBe('rejected');

    // 3. Go to pending approval list to verify missing badge (yellow scans go to pending approval)
    await page.evaluate(() => { window.location.hash = '/pending'; });
    await page.waitForSelector('table tbody tr');

    const missingBadge = page.locator('table tbody tr span.badge.bg-warning', { hasText: 'مفقود' }).first();
    await expect(missingBadge).toBeVisible();
  });
});

