import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import JSZip from 'jszip';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Batch Wattage Editor', () => {
  test.setTimeout(60000);

  test.beforeAll(() => {
    const downloadsDir = path.join(__dirname, 'downloads');
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }
  });

  test('should update wattage and verify scaled lumens', async ({ page }) => {
    await page.goto('batch-wattage');
    await expect(page.getByRole('heading', { name: 'Batch Wattage Editor' })).toBeVisible();

    const testFilesDir = path.resolve(__dirname, '../src/testfiles/test2');
    // Use file with known wattage/lumens. DLS2402103_IES.IES: 1W, 2000lm
    const iesFile = path.join(testFilesDir, 'DLS2402103_IES.IES');
    
    // Upload
    await page.locator('input[accept=".ies,.IES"]').setInputFiles([iesFile]);
    await expect(page.getByRole('heading', { name: 'Wattage Editor', level: 2 })).toBeVisible();
    
    // Check original values
    await expect(page.locator('td', { hasText: '1.00' }).first()).toBeVisible(); // Original Wattage
    await expect(page.locator('td', { hasText: '2000' }).first()).toBeVisible(); // Original Lumens

    // Update Wattage via UI (Click cell to edit)
    // The cell displays "1.00". Click it.
    await page.locator('div', { hasText: '1.00' }).click();
    await page.locator('input[type="number"]').fill('2');
    await page.keyboard.press('Enter');

    // Verify Preview Lumens (Should double: 2000 -> 4000)
    // Preview Lumens is in a column with class bg-blue-50
    // We can look for "4000"
    await expect(page.locator('td', { hasText: '4000' })).toBeVisible();

    // Download
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Download Files")');
    const download = await downloadPromise;
    const downloadPath = path.join(__dirname, 'downloads', download.suggestedFilename());
    await download.saveAs(downloadPath);

    // Verify File
    const zipData = fs.readFileSync(downloadPath);
    const zip = await JSZip.loadAsync(zipData);
    const content = await zip.file('DLS2402103_IES.IES')?.async('string');
    
    expect(content).toBeDefined();
    if (content) {
        expect(content).toContain('4000'); // New Lumens
    }
  });

  test('should update wattage via CSV', async ({ page }) => {
    await page.goto('batch-wattage');
    const testFilesDir = path.resolve(__dirname, '../src/testfiles/test2');
    const iesFile = path.join(testFilesDir, 'DLS2402103_IES.IES');
    await page.locator('input[accept=".ies,.IES"]').setInputFiles([iesFile]);
    await expect(page.getByRole('heading', { name: 'Wattage Editor', level: 2 })).toBeVisible();

    // Prepare CSV
    const csvContent = `filename,wattage
DLS2402103_IES.IES,3.0`;
    const csvPath = path.join(testFilesDir, 'temp_wattage_update.csv');
    fs.writeFileSync(csvPath, csvContent);

    // Upload CSV
    await page.locator('#csv-upload').setInputFiles(csvPath);
    await expect(page.getByRole('heading', { name: 'Preview CSV Data' })).toBeVisible();
    await page.getByRole('button', { name: 'Apply Changes' }).click();

    // Verify Preview Lumens (1W -> 3W means 3x -> 6000lm)
    await expect(page.locator('td', { hasText: '6000' })).toBeVisible();
  });
});

