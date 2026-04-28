const { test, expect } = require('@playwright/test');

test.describe('Dashboard', () => {
  test('should display summary stats', async ({ page }) => {
    await page.goto('#/dashboard');
    
    // Verify counters exist
    await expect(page.locator('.card-title')).toContainText([/إجمالي/i, /مدخل/i, /انتظار/i]);
  });
});
