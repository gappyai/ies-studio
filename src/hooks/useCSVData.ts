import { useState } from 'react';
import { useIESFileStore, type BatchFile } from '../store/iesFileStore';
import { iesParser } from '../services/iesParser';
import { csvService, type CSVRow } from '../services/csvService';
import { buildCSVMetadata } from '../utils/metadataUtils';
import { applyPhotometricUpdates } from './usePhotometricUpdates';
import { photometricCalculator } from '../services/calculator';

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
  const { batchFiles, addBatchFiles, setCSVMetadata } = useIESFileStore();
  const [csvData, setCsvData] = useState<ExtendedCSVRow[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  
  const metersToFeet = (meters: number) => meters * 3.28084;
  const feetToMeters = (feet: number) => feet / 3.28084;
  
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
      const parsedFile = iesParser.parse(content, file.name, file.size);
      
      const batchFile: BatchFile = {
        ...parsedFile,
        id: `${file.name}-${Date.now()}-${i}`,
        metadataUpdates: {}
      };
      
      newBatchFiles.push(batchFile);
      
      // Determine unit from file
      const unit = parsedFile.photometricData.unitsType === 1 ? 'feet' : 'meters';
      
      const csvRow: ExtendedCSVRow = {
        filename: file.name,
        manufacturer: parsedFile.metadata.manufacturer || '',
        luminaireCatalogNumber: parsedFile.metadata.luminaireCatalogNumber || '',
        lampCatalogNumber: parsedFile.metadata.lampCatalogNumber || '',
        test: parsedFile.metadata.test || '',
        testLab: parsedFile.metadata.testLab || '',
        testDate: parsedFile.metadata.testDate || '',
        issueDate: parsedFile.metadata.issueDate || '',
        lampPosition: parsedFile.metadata.lampPosition || '',
        other: parsedFile.metadata.other || '',
        nearField: parsedFile.metadata.nearField || '',
        cct: parsedFile.metadata.colorTemperature?.toString() || '',
        wattage: parsedFile.photometricData.inputWatts.toFixed(2),
        lumens: parsedFile.photometricData.totalLumens.toFixed(0),
        length: parsedFile.photometricData.length.toFixed(3),
        width: parsedFile.photometricData.width.toFixed(3),
        height: parsedFile.photometricData.height.toFixed(3),
        unit,
        originalLength: parsedFile.photometricData.length,
        originalWidth: parsedFile.photometricData.width,
        originalHeight: parsedFile.photometricData.height,
        originalWattage: parsedFile.photometricData.inputWatts,
        originalLumens: parsedFile.photometricData.totalLumens,
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
    const parsedData = csvService.parseCSV(csvContent);
    const validation = csvService.validateCSV(parsedData);
    
    if (!validation.isValid) {
      return { data: [], errors: validation.errors };
    }
    
    return { data: parsedData, errors: [] };
  };
  
  /**
   * Apply CSV data updates to batch files and CSV rows
   * Uses unified photometric update logic
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
      
      // Store original filename for matching (before update_file_name changes it)
      const originalFilename = existingRow?.filename || newRow.filename;
      
      // Handle update_file_name - update filename if provided
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
        // Store original filename for matching batch files
        _originalFilename: originalFilename
      } as ExtendedCSVRow & { _originalFilename?: string };
    });
    
    // Update batch files with photometric changes
    const updatedFiles = batchFiles.map((file, index) => {
      // Match by original filename (before update_file_name changes it)
      const csvRow = updatedData.find(r => {
        const matchFilename = (r as any)._originalFilename || r.filename;
        const originalFilename = csvData[index]?.filename || file.fileName;
        return matchFilename === originalFilename || matchFilename === file.fileName;
      }) || updatedData[index];
      
      if (!csvRow) return file;
      
      let updatedFile = { ...file };
      
      // Store CSV values
      const csvWattage = csvRow.wattage ? parseFloat(csvRow.wattage) : undefined;
      const csvLumens = csvRow.lumens ? parseFloat(csvRow.lumens) : undefined;
      
      // Apply unified photometric updates (wattage first, then lumens)
      updatedFile.photometricData = applyPhotometricUpdates(file.photometricData, {
        fileId: file.id,
        originalWattage: csvRow.originalWattage,
        originalLumens: csvRow.originalLumens,
        newWattage: csvWattage,
        newLumens: csvLumens,
        autoAdjustWattage
      });
      
      // Update CSV data with final values for UI display
      const rowIndex = updatedData.findIndex(r => {
        const matchFilename = (r as any)._originalFilename || r.filename;
        const originalFilename = csvData[index]?.filename || file.fileName;
        return matchFilename === originalFilename || matchFilename === file.fileName;
      });
      
      if (rowIndex !== -1) {
        // Update wattage and lumens with final values
        updatedData[rowIndex].wattage = updatedFile.photometricData.inputWatts.toFixed(2);
        updatedData[rowIndex].lumens = updatedFile.photometricData.totalLumens.toFixed(0);
      }
      
      return updatedFile;
    });
    
    addBatchFiles(updatedFiles);
    
    // Remove temporary _originalFilename property before returning
    return updatedData.map(({ _originalFilename, ...row }) => row);
  };
  
  /**
   * Update a single cell in CSV data
   * Uses unified photometric update logic for wattage/lumens
   * This ensures UI updates match CSV updates exactly
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
    
    // Handle filename update
    if (field === 'filename') {
      let newFilename = value.trim();
      if (newFilename && !newFilename.toLowerCase().endsWith('.ies')) {
        newFilename = `${newFilename}.ies`;
      }
      newCsvData[rowIndex] = { ...row, filename: newFilename || row.filename };
      return newCsvData;
    }
    
    // Handle wattage and lumens updates using unified logic
    // This matches the CSV update logic exactly
    if (field === 'wattage' || field === 'lumens') {
      // Get the new value being set - validate it first
      const newWattage = field === 'wattage' ? parseFloat(value) : undefined;
      const newLumens = field === 'lumens' ? parseFloat(value) : undefined;
      
      // Only proceed if we have a valid number
      if ((field === 'wattage' && (isNaN(newWattage!) || newWattage! <= 0)) ||
          (field === 'lumens' && (isNaN(newLumens!) || newLumens! <= 0))) {
        // Invalid input - just update the field value without calculating
        const updatedRow = { ...row, [field]: value };
        newCsvData[rowIndex] = updatedRow;
        return newCsvData;
      }
      
      // Get current values from CSV row
      // We only pass the value being edited, and let the other value be derived from scaling
      // or stay as is (if not affected by scaling)
      const currentWattage = field === 'wattage' ? newWattage : undefined;
      const currentLumens = field === 'lumens' ? newLumens : undefined;
      
      // Apply unified photometric updates (same logic as CSV)
      // This checks both wattage and lumens changes and applies them in the correct order
      const updatedData = applyPhotometricUpdates(batchFile.photometricData, {
        fileId: batchFile.id,
        originalWattage: row.originalWattage,
        originalLumens: row.originalLumens,
        newWattage: currentWattage,
        newLumens: currentLumens,
        autoAdjustWattage
      });
      
      // Update batch file
      const updatedFiles = batchFiles.map(f => {
        if (f.id === batchFile.id) {
          return { ...f, photometricData: updatedData };
        }
        return f;
      });
      addBatchFiles(updatedFiles);
      
      // Update CSV row with final calculated values
      // Both wattage and lumens are updated to reflect the actual photometric data
      // This ensures the UI shows the correct auto-calculated values
      const updatedRow = { 
        ...row, 
        wattage: updatedData.inputWatts.toFixed(2),
        lumens: updatedData.totalLumens.toFixed(0)
      };
      newCsvData[rowIndex] = updatedRow;
      return newCsvData;
    }
    
    // Handle dimension changes
    if (field === 'length' || field === 'width' || field === 'height') {
      const newValue = parseFloat(value);
      if (!isNaN(newValue) && newValue > 0 && row.originalLength !== undefined) {
        const rowUnit = row.unit || 'meters';
        const targetUnit = batchFile.photometricData.unitsType === 1 ? 'feet' : 'meters';
        const needsConversion = rowUnit !== targetUnit;
        const convertFunc = needsConversion ? 
          (rowUnit === 'feet' ? feetToMeters : metersToFeet) : 
          (val: number) => val;
        
        const newValueInMeters = convertFunc(newValue);
        const dimension: 'length' | 'width' | 'height' = 
          field === 'length' ? 'length' :
          field === 'width' ? 'width' : 'height';
        
        const targetDimensionValue = targetUnit === 'feet' ? metersToFeet(newValueInMeters) : newValueInMeters;
        
        const result = photometricCalculator.scaleByDimension(
          batchFile.photometricData,
          targetDimensionValue,
          dimension
        );
        
        const updatedFiles = batchFiles.map(f => {
          if (f.id === batchFile.id) {
            return { ...f, photometricData: result.scaledPhotometricData };
          }
          return f;
        });
        addBatchFiles(updatedFiles);
      }
    }
    
    // For other fields, just update the value
    newCsvData[rowIndex] = { ...newCsvData[rowIndex], [field]: value };
    return newCsvData;
  };
  
  /**
   * Update metadata from CSV data
   */
  const updateMetadata = (data: ExtendedCSVRow[]) => {
    const metadata = buildCSVMetadata(data);
    setCSVMetadata(metadata);
  };
  
  return {
    csvData,
    setCsvData,
    csvErrors,
    setCsvErrors,
    loadIESFiles,
    parseCSVFile,
    applyCSVUpdates,
    updateCell,
    updateMetadata
  };
}

