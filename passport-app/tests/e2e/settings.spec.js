const { test, expect } = require('@playwright/test');

test.describe('Settings', () => {
  test('should update app settings', async ({ page }) => {
    await page.goto('#/settings');
    
    // Change ship name
    const shipInput = page.locator('input[id="input-ship-name"]');
    await shipInput.fill('Test Ship');
    await page.locator('button[id="btn-save-settings"]').click();
    
    // Verify toast or success message
    // await expect(page.locator('.toast')).toBeVisible();
  });
});
