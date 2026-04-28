const { test, expect } = require('@playwright/test');

test.describe('Scan Flow', () => {
  test('should handle green scan and undo', async ({ page }) => {
    await page.goto('#/scan');
    
    // Simulate keyboard MRZ input
    const validMrz = 'P<EGYDOE<<JOHN<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<AB123456<1EGY8001014M2501012<<<<<<<<<<<<<<02';
    
    // We need to trigger the input and Enter key
    await page.evaluate((mrz) => {
      const input = document.getElementById('mrz-input');
      input.value = mrz;
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      input.dispatchEvent(event);
    }, validMrz);

    // Verify green result
    await expect(page.locator('#scan-status-panel')).toHaveCSS('border-color', 'rgb(34, 197, 94)'); // var(--green)
    await expect(page.locator('#result-title')).toContainText(/تحقق/i);

    // Verify undo button
    const undoBtn = page.locator('#btn-undo');
    await expect(undoBtn).toBeVisible();

    // Click undo
    await undoBtn.click();

    // Verify reset to prompt
    await expect(page.locator('#scan-prompt')).toBeVisible();
  });
});
