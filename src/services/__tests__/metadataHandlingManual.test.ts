/**
 * Manual test script for metadata handling
 * 
 * Run with: npx tsx src/services/__tests__/metadataHandlingManual.test.ts
 * Or: node --loader ts-node/esm src/services/__tests__/metadataHandlingManual.test.ts
 * 
 * This script tests metadata handling without requiring a test framework.
 */

import { iesParser } from '../iesParser';
import { iesGenerator } from '../iesGenerator';
import { csvService } from '../csvService';
import type { IESFile, IESMetadata } from '../../types/ies.types';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper function to merge metadata (same logic as in BatchMetadataEditorPage)
function mergeMetadata(
  original: IESMetadata,
  updates: Partial<IESMetadata>
): IESMetadata {
  const merged = { ...original };
  
  (Object.keys(updates) as Array<keyof IESMetadata>).forEach((key) => {
    const value = updates[key];
    
    if (typeof value === 'string') {
      (merged as any)[key] = value;
    } 
    else if (typeof value === 'number') {
      if (!isNaN(value) && value !== undefined) {
        (merged as any)[key] = value;
      }
    }
    else if (value !== undefined && value !== null) {
      (merged as any)[key] = value;
    }
  });
  
  return merged;
}

function test(name: string, fn: () => void | boolean) {
  try {
    const result = fn();
    if (result === false) {
      console.error(`❌ FAIL: ${name}`);
      return false;
    }
    console.log(`✅ PASS: ${name}`);
    return true;
  } catch (error) {
    console.error(`❌ FAIL: ${name}`);
    console.error(error);
    return false;
  }
}

async function runTests() {
  console.log('Running metadata handling tests...\n');

  let passed = 0;
  let failed = 0;

  // Read test files
  const testFilePath = join(__dirname, '../../testfiles/C-SFR-F22B-VB-24CC-21K-WM-126-90-9W-55.6.IES');
  const testFileContent = readFileSync(testFilePath, 'utf-8');
  const parsedFile = iesParser.parse(testFileContent, 'test.ies', testFileContent.length);

  const csvFilePath = join(__dirname, '../../testfiles/batch_metadata_template.csv');
  const csvContent = readFileSync(csvFilePath, 'utf-8');
  const csvRows = csvService.parseCSV(csvContent);

  // Test 1: Parse empty metadata fields
  if (test('Parse empty metadata fields from original file', () => {
    return parsedFile.metadata.test === '' && 
           parsedFile.metadata.testLab === '' &&
           parsedFile.metadata.testDate === '29 July 2025';
  })) passed++; else failed++;

  // Test 2: Parse CSV metadata
  if (test('Parse CSV metadata correctly', () => {
    const firstRow = csvRows[0];
    return firstRow.filename === 'C-SFR-F22B-VB-24CC-21K-WM-126-90-9W-55.6.IES' &&
           firstRow.manufacturer === 'LEDFLEX' &&
           firstRow.luminaireCatalogNumber === 'UN16TVC219';
  })) passed++; else failed++;

  // Test 3: Merge metadata
  if (test('Merge metadata preserving empty fields from CSV', () => {
    const csvRow = csvRows[0];
    const csvMetadata: Partial<IESMetadata> = {
      manufacturer: csvRow.manufacturer || '',
      luminaireCatalogNumber: csvRow.luminaireCatalogNumber || '',
      test: csvRow.test || '',
      testLab: csvRow.testLab || '',
    };
    const merged = mergeMetadata(parsedFile.metadata, csvMetadata);
    return merged.manufacturer === 'LEDFLEX' &&
           merged.luminaireCatalogNumber === 'UN16TVC219' &&
           merged.test === 'UN16TVC219' &&
           merged.testLab === 'LEDFLEX';
  })) passed++; else failed++;

  // Test 4: Generate IES with metadata
  if (test('Generate IES file with correct metadata', () => {
    const csvRow = csvRows[0];
    const csvMetadata: Partial<IESMetadata> = {
      manufacturer: csvRow.manufacturer || '',
      luminaireCatalogNumber: csvRow.luminaireCatalogNumber || '',
      test: csvRow.test || '',
      testLab: csvRow.testLab || '',
      testDate: csvRow.testDate || '',
      issueDate: csvRow.issueDate || '',
    };
    const merged = mergeMetadata(parsedFile.metadata, csvMetadata);
    const updatedFile: IESFile = {
      ...parsedFile,
      metadata: merged,
    };
    const generated = iesGenerator.generate(updatedFile);
    const lines = generated.split('\n');
    
    const testLine = lines.find(l => l.startsWith('[TEST]'));
    const testLabLine = lines.find(l => l.startsWith('[TESTLAB]'));
    const manufacLine = lines.find(l => l.startsWith('[MANUFAC]'));
    
    return testLine === '[TEST] UN16TVC219' &&
           testLabLine === '[TESTLAB] LEDFLEX' &&
           manufacLine === '[MANUFAC] LEDFLEX';
  })) passed++; else failed++;

  // Test 5: Preserve empty metadata
  if (test('Preserve empty metadata when CSV field is empty', () => {
    const csvMetadata: Partial<IESMetadata> = {
      test: '',
      testLab: 'LEDFLEX',
    };
    const merged = mergeMetadata(parsedFile.metadata, csvMetadata);
    const updatedFile: IESFile = {
      ...parsedFile,
      metadata: merged,
    };
    const generated = iesGenerator.generate(updatedFile);
    const lines = generated.split('\n');
    const testLine = lines.find(l => l.startsWith('[TEST]'));
    return testLine === '[TEST] ' && merged.test === '';
  })) passed++; else failed++;

  // Test 6: Fixed metadata order
  if (test('Maintain fixed metadata order in generated file', () => {
    const csvRow = csvRows[0];
    const csvMetadata: Partial<IESMetadata> = {
      manufacturer: csvRow.manufacturer || '',
      luminaireCatalogNumber: csvRow.luminaireCatalogNumber || '',
      test: csvRow.test || '',
      testLab: csvRow.testLab || '',
      testDate: csvRow.testDate || '',
      issueDate: csvRow.issueDate || '',
    };
    const merged = mergeMetadata(parsedFile.metadata, csvMetadata);
    const updatedFile: IESFile = {
      ...parsedFile,
      metadata: merged,
    };
    const generated = iesGenerator.generate(updatedFile);
    const lines = generated.split('\n');
    
    const testIndex = lines.findIndex(l => l.startsWith('[TEST]'));
    const testLabIndex = lines.findIndex(l => l.startsWith('[TESTLAB]'));
    const testDateIndex = lines.findIndex(l => l.startsWith('[TESTDATE]'));
    const manufacIndex = lines.findIndex(l => l.startsWith('[MANUFAC]'));
    const tiltIndex = lines.findIndex(l => l.startsWith('TILT'));
    
    return testIndex < testLabIndex &&
           testLabIndex < testDateIndex &&
           testDateIndex < manufacIndex &&
           manufacIndex < tiltIndex;
  })) passed++; else failed++;

  console.log(`\n\nResults: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export { runTests, mergeMetadata };

