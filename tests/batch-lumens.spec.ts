import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import JSZip from 'jszip';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Batch Lumens Editor', () => {
  test.setTimeout(60000);

  test.beforeAll(() => {
    const downloadsDir = path.join(__dirname, 'downloads');
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }
  });

  test('should update lumens and auto-adjust wattage', async ({ page }) => {
    await page.goto('batch-lumens');
    await expect(page.getByRole('heading', { name: 'Batch Lumens Editor' })).toBeVisible();

    const testFilesDir = path.resolve(__dirname, '../src/testfiles/test2');
    const iesFile = path.join(testFilesDir, 'DLS2402103_IES.IES'); // 1W, 2000lm
    
    // Upload
    await page.locator('input[accept=".ies,.IES"]').setInputFiles([iesFile]);
    await expect(page.getByRole('heading', { name: 'Lumens Editor', level: 2 })).toBeVisible();

    // Check "Auto-adjust wattage" checkbox
    const autoAdjustCheckbox = page.getByLabel('Auto-adjust wattage');
    await expect(autoAdjustCheckbox).toBeChecked();

    // Update Lumens: 2000 -> 4000
    await page.locator('div', { hasText: '2000' }).first().click();
    await page.locator('input[type="number"]').fill('4000');
    await page.keyboard.press('Enter');

    // Verify Preview Wattage (Should double: 1W -> 2W)
    await expect(page.locator('td', { hasText: '2.00' })).toBeVisible();

    // Disable Auto-adjust
    await autoAdjustCheckbox.uncheck();
    
    // Update Lumens: 4000 -> 1000
    await page.locator('div', { hasText: '4000' }).click();
    await page.locator('input[type="number"]').fill('1000');
    await page.keyboard.press('Enter');
    
    // Verify Preview Wattage (Should remain 1.00 because auto-adjust is off and base was 1.00? 
    // Wait, previous edit updated the file state? Or is it purely preview?
    // In BatchLumensEditorPage, `updateLumens` updates `lumensData` state which holds previews.
    // The actual IES file update happens on download.
    // However, `updateLumens` uses `originalWattage` for calculation?
    // `calculatePreview`:
    //   iesFile.updateLumens(newLumens, adjustWattage);
    //   return previewWattage: p.inputWatts
    // The `iesFile` is cloned from `batchFile`. `batchFile` is not updated until download? 
    // No, `BatchLumensEditorPage` does NOT update `batchFiles` in store during edits, only `lumensData`.
    // Wait, `addBatchFiles` is used during upload.
    // `updateLumens` updates local state `lumensData`.
    // So base file is still original.
    // Original Wattage: 1W.
    // Edit 1: 4000lm, Auto=True -> Preview Wattage = 2W.
    // Edit 2: 1000lm, Auto=False -> Preview Wattage = 1W (Original).
    
    await expect(page.locator('td', { hasText: '1.00' }).first()).toBeVisible(); // Original
    await expect(page.locator('td', { hasText: '1.00' }).nth(1)).toBeVisible(); // Preview (since 1.00 appears twice now)
  });
});

