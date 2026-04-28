const { test, expect } = require('@playwright/test');

test.describe('Scan History', () => {
  test('should display scan events', async ({ page }) => {
    await page.goto('#/history');
    
    // Verify table headers
    await expect(page.locator('th')).toContainText([/وقت/i, /نتيجة/i, /الاسم/i]);
  });
});
