import type { IESMetadata } from '../types/ies.types';
import type { CSVMetadata } from '../store/iesFileStore';
import type { CSVRow } from '../services/csvService';

/**
 * Merge metadata with proper handling of empty strings (to allow clearing fields)
 * If a field is explicitly provided in updates (even if empty string), it overrides the original
 * If a field is not provided in updates, the original value is preserved
 */
export function mergeMetadata(
  original: IESMetadata,
  updates: Partial<IESMetadata>
): IESMetadata {
  const merged = { ...original };
  
  // Update all fields that are explicitly provided in updates
  (Object.keys(updates) as Array<keyof IESMetadata>).forEach((key) => {
    const value = updates[key];
    
    // For string fields, update if value is explicitly provided (even if empty)
    // This allows CSV to clear fields by setting them to empty string
    if (typeof value === 'string') {
      (merged as any)[key] = value; // Allow empty strings to override
    } 
    // For number fields, only update if value is defined and not NaN
    else if (typeof value === 'number') {
      if (!isNaN(value) && value !== undefined) {
        (merged as any)[key] = value;
      }
    }
    // For other types, update if value is explicitly provided
    else if (value !== undefined && value !== null) {
      (merged as any)[key] = value;
    }
  });
  
  return merged;
}

/**
 * Build metadata object from CSV row
 * Includes all fields from CSV row if they exist (even if empty)
 */
export function buildMetadataFromCSVRow(row: CSVRow): Partial<IESMetadata> {
  const metadata: Partial<IESMetadata> = {};
  
  // Include fields if they exist in the row (even if empty string)
  // Use !== undefined to check if field was in CSV (even if empty string)
  if (row.manufacturer !== undefined) {
    metadata.manufacturer = row.manufacturer;
  }
  if (row.luminaireCatalogNumber !== undefined) {
    metadata.luminaireCatalogNumber = row.luminaireCatalogNumber;
  }
  if (row.lampCatalogNumber !== undefined) {
    metadata.lampCatalogNumber = row.lampCatalogNumber;
  }
  if (row.test !== undefined) {
    metadata.test = row.test;
  }
  if (row.testLab !== undefined) {
    metadata.testLab = row.testLab;
  }
  if (row.testDate !== undefined) {
    metadata.testDate = row.testDate;
  }
  if (row.issueDate !== undefined) {
    metadata.issueDate = row.issueDate;
  }
  if (row.lampPosition !== undefined) {
    metadata.lampPosition = row.lampPosition;
  }
  if (row.other !== undefined) {
    metadata.other = row.other;
  }
  if (row.nearField !== undefined) {
    metadata.nearField = row.nearField;
  }
  
  // Handle CCT - only set if it's a valid number
  if (row.cct && row.cct.trim() !== '') {
    const cct = parseFloat(row.cct);
    if (!isNaN(cct)) {
      metadata.colorTemperature = cct;
    }
  }
  
  return metadata;
}

/**
 * Build CSVMetadata from array of CSV rows
 */
export function buildCSVMetadata(rows: CSVRow[]): CSVMetadata {
  const metadata: CSVMetadata = {};
  
  rows.forEach(row => {
    const rowMetadata = buildMetadataFromCSVRow(row);
    
    // Always add to metadata if there are any fields (even if empty)
    // This ensures CSV data is applied even when clearing fields
    if (Object.keys(rowMetadata).length > 0) {
      metadata[row.filename] = rowMetadata;
    }
  });
  
  return metadata;
}

