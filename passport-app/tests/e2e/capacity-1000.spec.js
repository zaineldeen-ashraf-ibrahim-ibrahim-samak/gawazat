const { test, expect } = require('@playwright/test');
const path = require('path');
const { _electron: electron } = require('playwright');

test.describe('Capacity 1000', () => {
  let electronApp;
  let window;

  test.beforeEach(async () => {
    electronApp = await electron.launch({ args: ['.'] });
    window = await electronApp.firstWindow();
  });

  test.afterEach(async () => {
    if (electronApp) await electronApp.close();
  });

  test('imports 1000 rows and lists them efficiently', async () => {
    // 1. Navigate to Settings and uncheck watch to avoid side-effects
    await window.click('text="الإعدادات"');
    
    // 2. Go to Import and drop the file
    await window.click('text="استيراد"');
    
    // Playwright doesn't easily drop files natively without file chooser, so we'll trigger the API directly for import
    await window.evaluate(async () => {
      const path = require('path');
      const fixture = path.join(__dirname, '..', 'fixtures', 'manifest-1000.xlsx');
      await window.api.manifest.import({ filePaths: [fixture] });
    });

    // 3. Go to Passenger List
    await window.click('text="الركاب"');

    // Wait for list to render
    await window.waitForSelector('table tbody tr');

    // 4. Assert performance budget and presence
    // Actually, checking row count in DOM might fail if windowed. We should check stats header.
    const stats = await window.locator('#list-stats').textContent();
    expect(stats).toContain('1000');

    // 5. Test search filter speed
    const startTime = Date.now();
    await window.fill('#search-input', 'EG0500');
    await window.waitForTimeout(100); // debounce wait
    const resultCount = await window.locator('table tbody tr').count();
    const endTime = Date.now();
    
    expect(resultCount).toBe(1);
    expect(endTime - startTime).toBeLessThan(2000);
  });
});
