import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import JSZip from 'jszip';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Batch Length Editor', () => {
  test.setTimeout(60000);

  test.beforeAll(() => {
    const downloadsDir = path.join(__dirname, 'downloads');
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }
  });

  test('should update length and verify scaling', async ({ page }) => {
    await page.goto('batch-length');
    await expect(page.getByRole('heading', { name: 'Batch Length Editor' })).toBeVisible();

    const testFilesDir = path.resolve(__dirname, '../src/testfiles/test2');
    const iesFile = path.join(testFilesDir, 'DLS2402103_IES.IES'); // L=1m, W=1W, Lm=2000
    
    await page.locator('input[accept=".ies,.IES"]').setInputFiles([iesFile]);
    await expect(page.getByRole('heading', { name: 'Length Editor', level: 2 })).toBeVisible();

    // Check Original Length
    // The file has length 1.0 (meters).
    // The page shows "Original (m)"
    await expect(page.locator('td', { hasText: '1.000' }).first()).toBeVisible();

    // Update Target Length to 2.0
    await page.locator('div', { hasText: '1.000' }).click();
    await page.locator('input[type="number"]').fill('2.0');
    await page.keyboard.press('Enter');

    // Verify Scale Factor (Should be 2.0)
    await expect(page.locator('td', { hasText: '2.000' })).toBeVisible();

    // Verify Preview Power (Should be 2W)
    await expect(page.locator('td', { hasText: '2.00 W' })).toBeVisible();

    // Verify Preview Lumens (Should be 4000 lm)
    await expect(page.locator('td', { hasText: '4000 lm' })).toBeVisible();
  });
});

