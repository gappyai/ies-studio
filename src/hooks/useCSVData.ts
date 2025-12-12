import { useState, useMemo } from 'react';
import { useIESFileStore, type BatchFile } from '../store/iesFileStore';
import { csvHandler } from '../services/CSVHandler';
import type { CSVRow } from '../services/csvService';
import { IESFile } from '../models/IESFile';

// Get access to the store for synchronous state access
const getStoreState = () => useIESFileStore.getState();

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

// Local state per file row to handle UI-specific preferences and input overrides
interface LocalRowState {
    unit: 'meters' | 'feet';
    // Stores transient string values while user is typing (to avoid cursor jumps or parsing/formatting issues)
    inputOverrides: Partial<Record<keyof CSVRow, string>>;
}

export function useCSVData() {
  const { batchFiles, addBatchFiles } = useIESFileStore();
  
  // Local state for UI preferences and input handling, keyed by file ID
  const [rowStates, setRowStates] = useState<Record<string, LocalRowState>>({});
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  
  // Computed CSV Data derived from batchFiles (Source of Truth) + rowStates (UI State)
  const csvData: ExtendedCSVRow[] = useMemo(() => {
    return batchFiles.map(file => {
      const rowState = rowStates[file.id] || { unit: file.photometricData.unitsType === 1 ? 'feet' : 'meters', inputOverrides: {} };
      const iesFile = new IESFile(JSON.parse(JSON.stringify(file))); // Read-only wrapper
      const data = iesFile.data;
      
      const fileUnit = data.photometricData.unitsType === 1 ? 'feet' : 'meters';
      const displayUnit = rowState.unit;

      const toDisplayUnit = (v: number) => {
         if (displayUnit === fileUnit) return v;
         if (displayUnit === 'feet' && fileUnit === 'meters') return v * 3.28084;
         if (displayUnit === 'meters' && fileUnit === 'feet') return v / 3.28084;
         return v;
      };

      // Base row from file data
      const row: ExtendedCSVRow = {
        filename: file.fileName,
        manufacturer: data.metadata.manufacturer || '',
        luminaireCatalogNumber: data.metadata.luminaireCatalogNumber || '',
        lampCatalogNumber: data.metadata.lampCatalogNumber || '',
        test: data.metadata.test || '',
        testLab: data.metadata.testLab || '',
        testDate: data.metadata.testDate || '',
        issueDate: data.metadata.issueDate || '',
        lampPosition: data.metadata.lampPosition || '',
        other: data.metadata.other || '',
        nearField: data.metadata.nearField || '',
        cct: data.metadata.colorTemperature?.toString() || '',
        
        // Numeric fields formatted
        wattage: data.photometricData.inputWatts.toFixed(2),
        lumens: data.photometricData.totalLumens.toFixed(0),
        length: toDisplayUnit(data.photometricData.length).toFixed(3),
        width: toDisplayUnit(data.photometricData.width).toFixed(3),
        height: toDisplayUnit(data.photometricData.height).toFixed(3),
        
        unit: displayUnit,
        
        // Originals for diff highlighting
        originalLength: data.photometricData.length,
        originalWidth: data.photometricData.width,
        originalHeight: data.photometricData.height,
        originalWattage: data.photometricData.inputWatts,
        originalLumens: data.photometricData.totalLumens,
        
        update_file_name: ''
      };

      // Apply input overrides (if user is typing "2.", we show "2." not "2.00")
      if (rowState.inputOverrides) {
        Object.entries(rowState.inputOverrides).forEach(([key, value]) => {
           if (value !== undefined) {
               (row as any)[key] = value;
           }
        });
      }
      
      return row;
    });
  }, [batchFiles, rowStates]);

  const loadIESFiles = async (files: File[]): Promise<ExtendedCSVRow[]> => {
    const newBatchFiles: BatchFile[] = [];
    const newRowStates: Record<string, LocalRowState> = {};
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.name.toLowerCase().endsWith('.ies')) continue;
      
      const content = await file.text();
      const iesFile = IESFile.parse(content, file.name);
      const parsedData = iesFile.data;
      
      const id = `${file.name}-${Date.now()}-${i}`;
      const batchFile: BatchFile = {
        ...parsedData,
        id,
        metadataUpdates: {}
      };
      
      newBatchFiles.push(batchFile);
      
      const unit = parsedData.photometricData.unitsType === 1 ? 'feet' : 'meters';
      newRowStates[id] = { unit, inputOverrides: {} };
    }
    
    // Merge with existing row states
    setRowStates(prev => ({ ...prev, ...newRowStates }));
    addBatchFiles(newBatchFiles);
    
    // Return empty array or computed ones - Page assumes it returns data to set state, 
    // but now we don't manage csvData state in Page.
    // We'll update the Page to ignore the return value or handle it differently.
    return []; 
  };
  
  const parseCSVFile = (csvContent: string): { data: CSVRow[]; errors: string[] } => {
    const parsedData = csvHandler.parse(csvContent);
    const validation = csvHandler.validate(parsedData);
    
    if (!validation.isValid) {
      return { data: [], errors: validation.errors };
    }
    
    return { data: parsedData, errors: [] };
  };
  
  // Applies bulk updates from CSV import
  const applyCSVUpdates = (
    newCSVData: CSVRow[],
    autoAdjustWattage: boolean
  ) => {
    // This function matches CSV rows to existing files and updates them.
    // Use getState() to get the LATEST batchFiles to avoid stale closure issues
    const currentBatchFiles = getStoreState().batchFiles;
    const updatedFiles = currentBatchFiles.map((file, index) => {
      // Find matching row by filename (original filename in file object)
      // Note: CSV import logic in original code matched by 'filename' column or index
      // Here we try to match by filename or index fallback
      
      const csvRow = newCSVData.find(r => r.filename === file.fileName) || newCSVData[index];
      if (!csvRow) return file;
      
      const fileClone: BatchFile = JSON.parse(JSON.stringify(file));
      const iesFile = new IESFile(fileClone);
      
      csvHandler.applyRow(iesFile, csvRow, autoAdjustWattage);
      
      // Update filename if provided in update_file_name (handled in original code?)
      if ((csvRow as any).update_file_name && (csvRow as any).update_file_name.trim() !== '') {
          let newName = (csvRow as any).update_file_name.trim();
          if (!newName.toLowerCase().endsWith('.ies')) newName += '.ies';
          iesFile.fileName = newName;
      }
      
      return fileClone;
    });
    
    // Also update rowStates for unit preferences if CSV specifies unit
    setRowStates(prev => {
        const updatedRowStates = { ...prev };
        updatedFiles.forEach((file, index) => {
            const csvRow = newCSVData.find(r => r.filename === file.fileName) || newCSVData[index];
            if (csvRow && csvRow.unit) {
                const u = csvRow.unit.toLowerCase().trim();
                if (u === 'feet' || u === 'ft') updatedRowStates[file.id] = { ...(updatedRowStates[file.id] || { inputOverrides: {} }), unit: 'feet' };
                else if (u === 'meters' || u === 'm') updatedRowStates[file.id] = { ...(updatedRowStates[file.id] || { inputOverrides: {} }), unit: 'meters' };
            }
        });
        return updatedRowStates;
    });
    
    addBatchFiles(updatedFiles);
  };
  
  const updateCell = (
    rowIndex: number,
    field: keyof CSVRow,
    value: string,
    autoAdjustWattage: boolean
  ) => {
    // IMPORTANT: Use getState() to get the LATEST batchFiles to avoid stale closure issues
    // This is critical when the user makes sequential edits (e.g., wattage then lumens)
    // before React has re-rendered with the updated state from the previous edit.
    const currentBatchFiles = getStoreState().batchFiles;
    const batchFile = currentBatchFiles[rowIndex];
    if (!batchFile) return;
    
    console.log('updateCell', rowIndex, field, value, 'autoAdjustWattage:', autoAdjustWattage);
    console.log('  Current file state - wattage:', batchFile.photometricData.inputWatts, 'lumens:', batchFile.photometricData.totalLumens);
    
    // Clear the input override for this field since we're committing the value
    // This ensures the computed value from batchFiles is shown after update
    setRowStates(prev => {
        const newState = { ...prev };
        if (newState[batchFile.id]?.inputOverrides) {
            const newOverrides = { ...newState[batchFile.id].inputOverrides };
            delete newOverrides[field];
            newState[batchFile.id] = { ...newState[batchFile.id], inputOverrides: newOverrides };
        }
        return newState;
    });
    
    // Create clone from the LATEST state
    const fileClone: BatchFile = JSON.parse(JSON.stringify(batchFile));
    const iesFile = new IESFile(fileClone);
    
    // Apply logic
    if (field === 'filename') {
        let newName = value.trim();
        iesFile.fileName = newName;
    } else if (field === 'wattage') {
        const val = parseFloat(value);
        if (!isNaN(val) && val > 0) {
            console.log('  Calling updateWattage with:', val, 'current wattage:', iesFile.photometricData.inputWatts);
            iesFile.updateWattage(val, true);
            console.log('  After updateWattage - lumens:', iesFile.photometricData.totalLumens, 'first candela:', iesFile.photometricData.candelaValues[0]?.[0]);
        }
    } else if (field === 'lumens') {
        const val = parseFloat(value);
        if (!isNaN(val) && val > 0) {
            console.log('  Calling updateLumens with:', val, 'current lumens:', iesFile.photometricData.totalLumens, 'first candela:', iesFile.photometricData.candelaValues[0]?.[0]);
            iesFile.updateLumens(val, autoAdjustWattage);
            console.log('  After updateLumens - lumens:', iesFile.photometricData.totalLumens, 'first candela:', iesFile.photometricData.candelaValues[0]?.[0]);
        }
    } else if (field === 'length' || field === 'width' || field === 'height') {
        const val = parseFloat(value);
        if (!isNaN(val) && val > 0) {
             const rowState = rowStates[batchFile.id];
             const displayUnit = rowState?.unit || 'meters';
             const fileUnit = iesFile.photometricData.unitsType === 1 ? 'feet' : 'meters';
             
             const feetToMeters = (f: number) => f / 3.28084;
             const metersToFeet = (m: number) => m * 3.28084;
             
             const toFileUnit = (v: number) => {
                 if (displayUnit === fileUnit) return v;
                 if (displayUnit === 'feet' && fileUnit === 'meters') return feetToMeters(v);
                 if (displayUnit === 'meters' && fileUnit === 'feet') return metersToFeet(v);
                 return v;
             };
             
             const valInFileUnits = toFileUnit(val);
             
             if (field === 'length') iesFile.updateDimensions(valInFileUnits, undefined, undefined);
             else if (field === 'width') iesFile.updateDimensions(undefined, valInFileUnits, undefined);
             else if (field === 'height') iesFile.updateDimensions(undefined, undefined, valInFileUnits);
        }
    } else {
        // Metadata fields
        const minimalRow: Partial<CSVRow> = {};
        minimalRow[field] = value;
        csvHandler.applyRow(iesFile, minimalRow as CSVRow, autoAdjustWattage);
    }
    
    // Use the LATEST batchFiles for the map operation
    const updatedFiles = currentBatchFiles.map(f => f.id === batchFile.id ? fileClone : f);
    addBatchFiles(updatedFiles);
  };
  
  // Method to clear input overrides (e.g. onBlur)
  // But since we don't have onBlur event from Table easily without modifying Table props...
  // We can just rely on the fact that valid numeric updates to batchFile will eventually result in a matching computed value.
  // E.g. User types "2", updateWattage(2). Computed "2.00".
  // "2" vs "2.00". Input displays "2".
  // If user blurs, we might want to clear override to show "2.00".
  // We can export a clearOverride function.
  
  const clearInputOverride = (rowIndex: number, field: keyof CSVRow) => {
      // Use getState() to get the LATEST batchFiles
      const currentBatchFiles = getStoreState().batchFiles;
      const batchFile = currentBatchFiles[rowIndex];
      if (!batchFile) return;
      
      setRowStates(prev => {
          const newState = { ...prev };
          if (newState[batchFile.id]?.inputOverrides) {
              const newOverrides = { ...newState[batchFile.id].inputOverrides };
              delete newOverrides[field];
              newState[batchFile.id] = { ...newState[batchFile.id], inputOverrides: newOverrides };
          }
          return newState;
      });
  };

  const updateRowUnit = (rowIndex: number, newUnit: 'meters' | 'feet') => {
      // Use getState() to get the LATEST batchFiles
      const currentBatchFiles = getStoreState().batchFiles;
      const batchFile = currentBatchFiles[rowIndex];
      if (!batchFile) return;
      setRowStates(prev => ({
          ...prev,
          [batchFile.id]: {
              ...prev[batchFile.id],
              unit: newUnit
          }
      }));
  };

  const convertAllToUnit = (targetUnit: 'meters' | 'feet') => {
    // Use getState() to get the LATEST batchFiles to avoid stale closure issues
    const currentBatchFiles = getStoreState().batchFiles;
    const updatedFiles: BatchFile[] = [];
    
    currentBatchFiles.forEach(file => {
        const fileClone = JSON.parse(JSON.stringify(file));
        const iesFile = new IESFile(fileClone);
        iesFile.convertUnits(targetUnit);
        updatedFiles.push(fileClone);
    });
    
    // Update row preferences using functional update
    setRowStates(prev => {
        const newRowStates = { ...prev };
        currentBatchFiles.forEach(file => {
            newRowStates[file.id] = { 
                ...(newRowStates[file.id] || { inputOverrides: {} }), 
                unit: targetUnit 
            };
        });
        return newRowStates;
    });
    
    addBatchFiles(updatedFiles);
  };
  
  const swapLengthWidth = () => {
    // Use getState() to get the LATEST batchFiles to avoid stale closure issues
    const currentBatchFiles = getStoreState().batchFiles;
    const updatedFiles: BatchFile[] = [];
    
    currentBatchFiles.forEach(file => {
        const fileClone = JSON.parse(JSON.stringify(file));
        const iesFile = new IESFile(fileClone);
        
        const oldLength = iesFile.photometricData.length;
        const oldWidth = iesFile.photometricData.width;
        
        iesFile.data.photometricData.length = oldWidth;
        iesFile.data.photometricData.width = oldLength;
        iesFile.data.metadata.luminousOpeningLength = oldWidth;
        iesFile.data.metadata.luminousOpeningWidth = oldLength;
        
        updatedFiles.push(fileClone);
    });
    addBatchFiles(updatedFiles);
  };
  
  const bulkEdit = (field: keyof CSVRow, value: string, autoAdjustWattage: boolean) => {
      // Use getState() to get the LATEST batchFiles to avoid stale closure issues
      const currentBatchFiles = getStoreState().batchFiles;
      const updatedFiles: BatchFile[] = [];
      
      currentBatchFiles.forEach(file => {
        const fileClone = JSON.parse(JSON.stringify(file));
        const iesFile = new IESFile(fileClone);
        
        // Minimal row apply
        const minimalRow: Partial<CSVRow> = {};
        minimalRow[field] = value;
        
        // Special handling for numeric fields to ensure we use current file unit or row unit preference?
        // Bulk edit usually applies the raw value directly or interpreted via row preference.
        // If row units differ, applying "1.0" length means different things.
        // Simplest: Apply value assuming File's native unit, or assume user means Meters/Feet consistently?
        // Let's assume user inputs value consistent with the column display?
        // But column display might mix units.
        // Let's assume input value is intended for the PREFERRED unit of that row.
        
        // Actually, updateCell logic above handles unit conversion.
        // We should replicate that.
        
        if (field === 'length' || field === 'width' || field === 'height') {
             const val = parseFloat(value);
             if (!isNaN(val) && val > 0) {
                 const rowState = rowStates[file.id];
                 const displayUnit = rowState?.unit || 'meters';
                 const fileUnit = iesFile.photometricData.unitsType === 1 ? 'feet' : 'meters';
                 
                 const feetToMeters = (f: number) => f / 3.28084;
                 const metersToFeet = (m: number) => m * 3.28084;
                 
                 const toFileUnit = (v: number) => {
                     if (displayUnit === fileUnit) return v;
                     if (displayUnit === 'feet' && fileUnit === 'meters') return feetToMeters(v);
                     if (displayUnit === 'meters' && fileUnit === 'feet') return metersToFeet(v);
                     return v;
                 };
                 
                 const valInFileUnits = toFileUnit(val);
                 
                 if (field === 'length') iesFile.updateDimensions(valInFileUnits, undefined, undefined);
                 else if (field === 'width') iesFile.updateDimensions(undefined, valInFileUnits, undefined);
                 else if (field === 'height') iesFile.updateDimensions(undefined, undefined, valInFileUnits);
            }
        } else if (field === 'filename') {
             let newName = value.trim();
             if (newName && !newName.toLowerCase().endsWith('.ies')) newName += '.ies';
             if (newName) iesFile.fileName = newName;
        } else if (field === 'wattage') {
            const val = parseFloat(value);
            if (!isNaN(val) && val > 0) iesFile.updateWattage(val, true);
        } else if (field === 'lumens') {
            const val = parseFloat(value);
            if (!isNaN(val) && val > 0) iesFile.updateLumens(val, autoAdjustWattage);
        } else {
             csvHandler.applyRow(iesFile, minimalRow as CSVRow, autoAdjustWattage);
        }
        
        updatedFiles.push(fileClone);
      });
      
      addBatchFiles(updatedFiles);
  };
  
  return {
    csvData,
    csvErrors,
    setCsvErrors,
    loadIESFiles,
    parseCSVFile,
    applyCSVUpdates,
    updateCell,
    updateRowUnit,
    convertAllToUnit,
    swapLengthWidth,
    bulkEdit,
    clearInputOverride
  };
}
