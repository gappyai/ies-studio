import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import JSZip from 'jszip';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('CCT Batch Generator', () => {
  test.setTimeout(60000);

  test.beforeAll(() => {
    const downloadsDir = path.join(__dirname, 'downloads');
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }
  });

  test('should generate CCT variants', async ({ page }) => {
    await page.goto('batch-generator');
    await expect(page.getByRole('heading', { name: 'CCT Batch Generator' })).toBeVisible();

    const testFilesDir = path.resolve(__dirname, '../src/testfiles/test2');
    const iesFile = path.join(testFilesDir, 'DLS2402103_IES.IES');
    
    // Upload Base File
    await page.locator('input[accept=".ies,.IES"]').setInputFiles([iesFile]);
    await expect(page.locator('text=Base File:')).toBeVisible();
    
    // Add Variant
    await page.click('button:has-text("Add Variant")');
    await expect(page.getByRole('heading', { name: 'Add CCT Variants' })).toBeVisible();
    
    // Add 3000K, Multiplier 1.0
    await page.locator('input[placeholder="e.g. 3000"]').fill('3000');
    await page.locator('input[placeholder="1.0"]').fill('1.0');
    await page.click('button:has-text("Add")'); // Add to list
    
    // Add 4000K, Multiplier 1.1
    await page.locator('input[placeholder="e.g. 3000"]').fill('4000');
    await page.locator('input[placeholder="1.0"]').fill('1.1');
    await page.click('button:has-text("Add")');
    
    // Confirm generation
    await page.getByRole('button', { name: 'Generate Variants' }).click();

    // Verify Table
    await expect(page.locator('div', { hasText: '3000' })).toBeVisible();
    await expect(page.locator('div', { hasText: '4000' })).toBeVisible();
    
    // Download
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Download Files")');
    const download = await downloadPromise;
    const downloadPath = path.join(__dirname, 'downloads', download.suggestedFilename());
    await download.saveAs(downloadPath);

    // Verify Zip
    const zipData = fs.readFileSync(downloadPath);
    const zip = await JSZip.loadAsync(zipData);
    
    // Expect: DLS2402103_IES_3000.ies and DLS2402103_IES_4000.ies (default naming)
    const file3000 = Object.keys(zip.files).find(f => f.includes('3000'));
    const file4000 = Object.keys(zip.files).find(f => f.includes('4000'));
    
    expect(file3000).toBeDefined();
    expect(file4000).toBeDefined();
    
    const content4000 = await zip.file(file4000!)?.async('string');
    expect(content4000).toBeDefined();
    if (content4000) {
        expect(content4000).toContain('4000'); // CCT
        // Multiplier 1.1 means lumens should be 2000 * 1.1 = 2200
        expect(content4000).toContain('2200'); 
    }
  });
});

