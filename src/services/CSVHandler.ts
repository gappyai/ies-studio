import type { CSVRow } from './csvService';
import { csvService } from './csvService';
import { IESFile } from '../models/IESFile';

export class CSVHandler {
  /**
   * Parse CSV content into structured data
   */
  parse(content: string): CSVRow[] {
    return csvService.parseCSV(content);
  }

  /**
   * Generate CSV string from rows
   */
  generate(rows: CSVRow[]): string {
    return csvService.exportCSV(rows, true);
  }

  /**
   * Generate CSV template
   */
  generateTemplate(includePhotometric: boolean = false): string {
    return csvService.generateTemplate(includePhotometric);
  }

  /**
   * Validate CSV data
   */
  validate(rows: CSVRow[], existingFilenames?: string[]): { isValid: boolean; errors: string[] } {
    return csvService.validateCSV(rows, existingFilenames);
  }

  /**
   * Apply a CSV row to an IES file
   */
  applyRow(file: IESFile, row: CSVRow, autoAdjustWattage: boolean = false): void {
    // 1. Update metadata
    file.updateMetadata({
      manufacturer: row.manufacturer,
      luminaireCatalogNumber: row.luminaireCatalogNumber,
      lampCatalogNumber: row.lampCatalogNumber,
      test: row.test,
      testLab: row.testLab,
      testDate: row.testDate,
      issueDate: row.issueDate,
      lampPosition: row.lampPosition,
      other: row.other,
      nearField: row.nearField,
    });

    if (row.cct) {
      const cct = parseFloat(row.cct);
      if (!isNaN(cct)) file.updateMetadata({ colorTemperature: cct });
    }

    // 2. Update dimensions (Length/Width/Height)
    // Handle units conversion
    // CSV 'unit' field defaults to 'meters' if not specified or unrecognized (usually)
    // But logically, if 'unit' is missing, we might assume it matches file or is meters.
    // Let's assume meters if 'feet' is not explicitly specified, to match typical behavior?
    // Actually, safest is to parse 'feet' or 'meters'.
    
    const rowUnitStr = row.unit?.toLowerCase().trim();
    const rowUnit = rowUnitStr === 'feet' || rowUnitStr === 'ft' ? 'feet' : 'meters'; 
    // If empty, defaulting to meters might be dangerous if user meant feet. 
    // But standard IES is often feet. 
    // However, existing `BatchMetadataEditorPage` doesn't strictly default, it compares against target.
    // If `row.unit` is empty, what happens? `BatchMetadataEditorPage` line 310: `csvRow.unit !== targetUnit`.
    // If `csvRow.unit` is undefined, and `targetUnit` is 'feet', `undefined !== 'feet'` is true.
    // So it triggers conversion? `convertFunc` checks: `csvRow.unit === 'feet' ? ...`.
    // If undefined, it's not feet, so it uses `metersToFeet`.
    // So undefined implies Meters in existing code. I will stick to that.

    const fileUnit = file.photometricData.unitsType === 1 ? 'feet' : 'meters';
    
    const toFileUnit = (val: number) => {
      if (rowUnit === fileUnit) return val;
      if (rowUnit === 'feet' && fileUnit === 'meters') return val / 3.28084;
      if (rowUnit === 'meters' && fileUnit === 'feet') return val * 3.28084;
      return val;
    };

    const l = row.length ? toFileUnit(parseFloat(row.length)) : undefined;
    const w = row.width ? toFileUnit(parseFloat(row.width)) : undefined;
    const h = row.height ? toFileUnit(parseFloat(row.height)) : undefined;
    
    // Filter out NaNs
    const validL = l !== undefined && !isNaN(l) ? l : undefined;
    const validW = w !== undefined && !isNaN(w) ? w : undefined;
    const validH = h !== undefined && !isNaN(h) ? h : undefined;

    if (validL !== undefined || validW !== undefined || validH !== undefined) {
      file.updateDimensions(validL, validW, validH);
    }

    // 3. Wattage / Lumens
    const newWattage = row.wattage ? parseFloat(row.wattage) : undefined;
    const newLumens = row.lumens ? parseFloat(row.lumens) : undefined;

    // Apply logic mimicking applyPhotometricUpdates
    const currentWatts = file.photometricData.inputWatts;
    if (newWattage !== undefined && !isNaN(newWattage) && Math.abs(newWattage - currentWatts) > 0.001) {
      file.updateWattage(newWattage, true); // updateLumens=true (scale everything)
    }
    
    // Check lumens after potential wattage update
    const currentLumens = file.photometricData.totalLumens;
    if (newLumens !== undefined && !isNaN(newLumens) && Math.abs(newLumens - currentLumens) > 0.1) {
      file.updateLumens(newLumens, autoAdjustWattage);
    }
  }
}

export const csvHandler = new CSVHandler();
