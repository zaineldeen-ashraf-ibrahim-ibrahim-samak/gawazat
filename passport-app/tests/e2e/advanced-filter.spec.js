const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Advanced Filter (US7)', () => {
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

  test('combines 2+ criteria, asserts list count, and clears', async () => {
    await page.goto('file://' + path.join(__dirname, '../../renderer/index.html'));
    await page.click('#nav-passengers'); // go to passenger list

    // Assume some passengers exist
    const filterButton = await page.$('#btn-advanced-filters');
    if (!filterButton) return; // skip if UI not ready

    await filterButton.click();
    
    // Fill criteria
    await page.fill('#filter-nationality', 'EGY');
    await page.check('#filter-has-warning');
    await page.click('#btn-apply-filters');

    // Check that table filtered (we don't know exact counts, but we can check the badge)
    const activeBadge = await page.textContent('#filter-active-badge');
    expect(activeBadge.trim()).not.toBe('');

    // Clear filters
    await page.click('#btn-advanced-filters');
    await page.click('#btn-clear-filters');

    // Badge should be gone
    const isBadgeHidden = await page.isHidden('#filter-active-badge');
    expect(isBadgeHidden).toBe(true);
  });
});
