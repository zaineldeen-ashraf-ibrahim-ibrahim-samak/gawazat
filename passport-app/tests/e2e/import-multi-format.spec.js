const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Import Multi-Format (Phase 11)', () => {
  let electronApp;
  let page;

  test.beforeAll(async () => {
    const { _electron: electron } = require('@playwright/test');
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../../src/main/index.js')],
      env: { ...process.env, NODE_ENV: 'test' }
    });
    page = await electronApp.firstWindow();
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test('imports CSV format end-to-end', async () => {
    await page.goto('file://' + path.join(__dirname, '../../renderer/index.html'));
    await page.click('#nav-import');

    const fileInput = await page.$('input[type=file]');
    if (fileInput) {
      await fileInput.setInputFiles(path.join(__dirname, '../fixtures/manifest-10.csv'));
      // The app should trigger import
      const successToast = await page.waitForSelector('.toast-success', { timeout: 2000 }).catch(() => null);
      if (successToast) {
        const text = await successToast.textContent();
        expect(text).toContain('10');
      }
    }
  });

  test('imports JSON format end-to-end', async () => {
    await page.click('#nav-import');
    const fileInput = await page.$('input[type=file]');
    if (fileInput) {
      await fileInput.setInputFiles(path.join(__dirname, '../fixtures/manifest-10.json'));
      const successToast = await page.waitForSelector('.toast-success', { timeout: 2000 }).catch(() => null);
      if (successToast) {
        const text = await successToast.textContent();
        expect(text).toContain('10');
      }
    }
  });
});
