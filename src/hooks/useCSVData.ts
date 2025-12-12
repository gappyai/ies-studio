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
      // We use JSON parse/stringify for deep clone as a safe fallback
      const fileClone: BatchFile = JSON.parse(JSON.stringify(file));
      const iesFile = new IESFile(fileClone);
      
      // Apply updates via handler
      csvHandler.applyRow(iesFile, csvRow, autoAdjustWattage);
      
      // Update CSV data with final values from calculation
      const rowIndex = updatedData.findIndex(r => r === csvRow);
      if (rowIndex !== -1) {
        updatedData[rowIndex].wattage = iesFile.photometricData.inputWatts.toFixed(2);
        updatedData[rowIndex].lumens = iesFile.photometricData.totalLumens.toFixed(0);
        // Also update dimensions in CSV to match scaled values?
        // Usually we want CSV to reflect file state.
        updatedData[rowIndex].length = iesFile.photometricData.length.toFixed(3);
        updatedData[rowIndex].width = iesFile.photometricData.width.toFixed(3);
        updatedData[rowIndex].height = iesFile.photometricData.height.toFixed(3);
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
    
    // Handle filename update explicitly as it doesn't affect IES content
    if (field === 'filename') {
      let newFilename = value.trim();
      if (newFilename && !newFilename.toLowerCase().endsWith('.ies')) {
        newFilename = `${newFilename}.ies`;
      }
      newCsvData[rowIndex] = { ...row, filename: newFilename || row.filename };
      return newCsvData;
    }

    // Create a temporary row with the update applied
    const updatedRow = { ...row, [field]: value };
    
    // Use IESFile to apply update and calculate effects
    const fileClone: BatchFile = JSON.parse(JSON.stringify(batchFile));
    const iesFile = new IESFile(fileClone);
    
    // Use applyRow to handle the update logic consistently
    // We pass the updatedRow which contains the new value for the field
    csvHandler.applyRow(iesFile, updatedRow, autoAdjustWattage);
    
    // Update store with modified file
    const updatedFiles = batchFiles.map(f => f.id === batchFile.id ? fileClone : f);
    addBatchFiles(updatedFiles);
    
    // Reflect changes back to CSV data
    updatedRow.wattage = iesFile.photometricData.inputWatts.toFixed(2);
    updatedRow.lumens = iesFile.photometricData.totalLumens.toFixed(0);
    updatedRow.length = iesFile.photometricData.length.toFixed(3);
    updatedRow.width = iesFile.photometricData.width.toFixed(3);
    updatedRow.height = iesFile.photometricData.height.toFixed(3);
    
    // Update metadata fields in CSV if they were changed?
    // Usually metadata changes in CSV are direct.
    
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
