import { useState } from 'react';
import { useIESFileStore, type BatchFile } from '../store/iesFileStore';
import { csvHandler } from '../services/CSVHandler';
import type { CSVRow } from '../services/csvService';
import { IESFile } from '../models/IESFile';

// Extended CSV row with unit information and original dimensions
export interface ExtendedCSVRow extends CSVRow {
  unit?: 'meters' | 'feet';
  originalLength?: number;
  originalWidth?: number;
  originalHeight?: number;
  originalWattage?: number;
  originalLumens?: number;
  update_file_name?: string;
}

export function useCSVData() {
  const { batchFiles, addBatchFiles } = useIESFileStore();
  const [csvData, setCsvData] = useState<ExtendedCSVRow[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  
  /**
   * Load IES files and create CSV rows
   */
  const loadIESFiles = async (files: File[]): Promise<ExtendedCSVRow[]> => {
    const newBatchFiles: BatchFile[] = [];
    const newCsvData: ExtendedCSVRow[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.name.toLowerCase().endsWith('.ies')) continue;
      
      const content = await file.text();
      // Use IESFile.parse instead of direct parser usage
      const iesFile = IESFile.parse(content, file.name);
      const parsedData = iesFile.data;
      
      const batchFile: BatchFile = {
        ...parsedData,
        id: `${file.name}-${Date.now()}-${i}`,
        metadataUpdates: {}
      };
      
      newBatchFiles.push(batchFile);
      
      // Determine unit from file
      const unit = parsedData.photometricData.unitsType === 1 ? 'feet' : 'meters';
      
      const csvRow: ExtendedCSVRow = {
        filename: file.name,
        manufacturer: parsedData.metadata.manufacturer || '',
        luminaireCatalogNumber: parsedData.metadata.luminaireCatalogNumber || '',
        lampCatalogNumber: parsedData.metadata.lampCatalogNumber || '',
        test: parsedData.metadata.test || '',
        testLab: parsedData.metadata.testLab || '',
        testDate: parsedData.metadata.testDate || '',
        issueDate: parsedData.metadata.issueDate || '',
        lampPosition: parsedData.metadata.lampPosition || '',
        other: parsedData.metadata.other || '',
        nearField: parsedData.metadata.nearField || '',
        cct: parsedData.metadata.colorTemperature?.toString() || '',
        wattage: parsedData.photometricData.inputWatts.toFixed(2),
        lumens: parsedData.photometricData.totalLumens.toFixed(0),
        length: parsedData.photometricData.length.toFixed(3),
        width: parsedData.photometricData.width.toFixed(3),
        height: parsedData.photometricData.height.toFixed(3),
        unit,
        originalLength: parsedData.photometricData.length,
        originalWidth: parsedData.photometricData.width,
        originalHeight: parsedData.photometricData.height,
        originalWattage: parsedData.photometricData.inputWatts,
        originalLumens: parsedData.photometricData.totalLumens,
        update_file_name: ''
      };
      
      newCsvData.push(csvRow);
    }
    
    addBatchFiles(newBatchFiles);
    return newCsvData;
  };
  
  /**
   * Parse and validate CSV file
   */
  const parseCSVFile = (csvContent: string): { data: CSVRow[]; errors: string[] } => {
    const parsedData = csvHandler.parse(csvContent);
    const validation = csvHandler.validate(parsedData);
    
    if (!validation.isValid) {
      return { data: [], errors: validation.errors };
    }
    
    return { data: parsedData, errors: [] };
  };
  
  /**
   * Apply CSV data updates to batch files and CSV rows
   */
  const applyCSVUpdates = (
    newCSVData: CSVRow[],
    autoAdjustWattage: boolean
  ): ExtendedCSVRow[] => {
    const updatedData = newCSVData.map(newRow => {
      const existingRow = csvData.find(r => r.filename === newRow.filename);
      
      // Determine unit from CSV data or existing data
      let unit: 'meters' | 'feet' = 'meters';
      if (newRow.unit) {
        const unitValue = newRow.unit.toLowerCase().trim();
        if (unitValue === 'feet' || unitValue === 'ft' || unitValue === 'foot') {
          unit = 'feet';
        } else if (unitValue === 'meters' || unitValue === 'm' || unitValue === 'meter') {
          unit = 'meters';
        }
      } else if (existingRow?.unit) {
        unit = existingRow.unit;
      }
      
      // Preserve original values
      const originalWattage = existingRow?.originalWattage;
      const originalLumens = existingRow?.originalLumens;
      const originalLength = existingRow?.originalLength;
      const originalWidth = existingRow?.originalWidth;
      const originalHeight = existingRow?.originalHeight;
      
      // Store original filename for matching
      const originalFilename = existingRow?.filename || newRow.filename;
      
      // Handle update_file_name
      let filename = originalFilename;
      if ((newRow as any).update_file_name && (newRow as any).update_file_name.trim() !== '') {
        filename = (newRow as any).update_file_name.trim();
        if (!filename.toLowerCase().endsWith('.ies')) {
          filename = `${filename}.ies`;
        }
      }
      
      return {
        ...newRow,
        filename,
        unit,
        originalWattage,
        originalLumens,
        originalLength,
        originalWidth,
        originalHeight,
        _originalFilename: originalFilename
      } as ExtendedCSVRow & { _originalFilename?: string };
    });
    
    // Update batch files using IESFile logic
    const updatedFiles = batchFiles.map((file, index) => {
      // Match by original filename
      const csvRow = updatedData.find(r => {
        const matchFilename = (r as any)._originalFilename || r.filename;
        const originalFilename = csvData[index]?.filename || file.fileName;
        return matchFilename === originalFilename || matchFilename === file.fileName;
      }) || updatedData[index];
      
      if (!csvRow) return file;
      
      // Create independent clone for modification
      const fileClone: BatchFile = JSON.parse(JSON.stringify(file));
      const iesFile = new IESFile(fileClone);
      
      // Apply updates via handler
      csvHandler.applyRow(iesFile, csvRow, autoAdjustWattage);
      
      // Update CSV data with final values from calculation
      const rowIndex = updatedData.findIndex(r => r === csvRow);
      if (rowIndex !== -1) {
        updatedData[rowIndex].wattage = iesFile.photometricData.inputWatts.toFixed(2);
        updatedData[rowIndex].lumens = iesFile.photometricData.totalLumens.toFixed(0);
        
        // Convert file dims to row units for CSV display
        const fileUnit = iesFile.photometricData.unitsType === 1 ? 'feet' : 'meters';
        const rowUnit = csvRow.unit || 'meters';
        
        const toRowUnit = (v: number) => {
             if (rowUnit === fileUnit) return v;
             if (rowUnit === 'feet' && fileUnit === 'meters') return v * 3.28084;
             if (rowUnit === 'meters' && fileUnit === 'feet') return v / 3.28084;
             return v;
        };

        updatedData[rowIndex].length = toRowUnit(iesFile.photometricData.length).toFixed(3);
        updatedData[rowIndex].width = toRowUnit(iesFile.photometricData.width).toFixed(3);
        updatedData[rowIndex].height = toRowUnit(iesFile.photometricData.height).toFixed(3);
      }
      
      return fileClone;
    });
    
    addBatchFiles(updatedFiles);
    
    return updatedData.map(({ _originalFilename, ...row }) => row);
  };
  
  /**
   * Update a single cell in CSV data
   */
  const updateCell = (
    rowIndex: number,
    field: keyof CSVRow,
    value: string,
    autoAdjustWattage: boolean
  ): ExtendedCSVRow[] => {
    const newCsvData = [...csvData];
    const row = newCsvData[rowIndex];
    const batchFile = batchFiles[rowIndex];
    
    if (!batchFile) return newCsvData;
    
    // Handle filename update explicitly
    if (field === 'filename') {
      let newFilename = value.trim();
      if (newFilename && !newFilename.toLowerCase().endsWith('.ies')) {
        newFilename = `${newFilename}.ies`;
      }
      newCsvData[rowIndex] = { ...row, filename: newFilename || row.filename };
      return newCsvData;
    }

    // Create a temporary row with the update applied
    const fileClone: BatchFile = JSON.parse(JSON.stringify(batchFile));
    const iesFile = new IESFile(fileClone);
    
    // Handle Specific Fields to ensure proper side-effects without stale data interference
    if (field === 'wattage') {
        const val = parseFloat(value);
        if (!isNaN(val) && val > 0) {
            iesFile.updateWattage(val, true); // Always scale lumens/candela
        }
    } else if (field === 'lumens') {
        const val = parseFloat(value);
        if (!isNaN(val) && val > 0) {
            iesFile.updateLumens(val, autoAdjustWattage);
        }
    } else if (field === 'length' || field === 'width' || field === 'height') {
        const val = parseFloat(value);
        if (!isNaN(val) && val > 0) {
             const rowUnit = row.unit || 'meters';
             const fileUnit = iesFile.photometricData.unitsType === 1 ? 'feet' : 'meters';
             
             const metersToFeet = (m: number) => m * 3.28084;
             const feetToMeters = (f: number) => f / 3.28084;
             
             const toFileUnit = (v: number) => {
                 if (rowUnit === fileUnit) return v;
                 if (rowUnit === 'feet' && fileUnit === 'meters') return feetToMeters(v);
                 if (rowUnit === 'meters' && fileUnit === 'feet') return metersToFeet(v);
                 return v;
             };
             
             const valInFileUnits = toFileUnit(val);
             
             if (field === 'length') iesFile.updateDimensions(valInFileUnits, undefined, undefined);
             else if (field === 'width') iesFile.updateDimensions(undefined, valInFileUnits, undefined);
             else if (field === 'height') iesFile.updateDimensions(undefined, undefined, valInFileUnits);
        }
    } else {
        // For other fields (metadata), apply directly via partial update to avoid overwriting other fields
        const minimalRow: Partial<CSVRow> = {};
        minimalRow[field] = value;
        // Use applyRow but essentially only for metadata mapping
        csvHandler.applyRow(iesFile, minimalRow as CSVRow, autoAdjustWattage);
    }
    
    // Update store with modified file
    const updatedFiles = batchFiles.map(f => f.id === batchFile.id ? fileClone : f);
    addBatchFiles(updatedFiles);
    
    // Reflect changes back to CSV data
    const updatedRow = { ...row, [field]: value };
    
    // Sync dependent fields from iesFile state
    updatedRow.wattage = iesFile.photometricData.inputWatts.toFixed(2);
    updatedRow.lumens = iesFile.photometricData.totalLumens.toFixed(0);
    
    const fileUnit = iesFile.photometricData.unitsType === 1 ? 'feet' : 'meters';
    const rowUnit = row.unit || 'meters';
    
    const toRowUnit = (v: number) => {
         if (rowUnit === fileUnit) return v;
         if (rowUnit === 'feet' && fileUnit === 'meters') return v * 3.28084;
         if (rowUnit === 'meters' && fileUnit === 'feet') return v / 3.28084;
         return v;
    };
    
    updatedRow.length = toRowUnit(iesFile.photometricData.length).toFixed(3);
    updatedRow.width = toRowUnit(iesFile.photometricData.width).toFixed(3);
    updatedRow.height = toRowUnit(iesFile.photometricData.height).toFixed(3);
    
    // Ensure the input field value is preserved exactly as typed (to avoid cursor jumps)
    // (Only if it's a numeric field we just calculated)
    if (['wattage', 'lumens', 'length', 'width', 'height'].includes(field as string)) {
        (updatedRow as any)[field] = value;
    }
    
    newCsvData[rowIndex] = updatedRow;
    return newCsvData;
  };
  
  return {
    csvData,
    setCsvData,
    csvErrors,
    setCsvErrors,
    loadIESFiles,
    parseCSVFile,
    applyCSVUpdates,
    updateCell
  };
}
