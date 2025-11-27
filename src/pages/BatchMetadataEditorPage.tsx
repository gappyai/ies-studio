import { useState } from 'react';
import { Upload, Download, Settings, ArrowLeftRight, Gauge } from 'lucide-react';
import { useIESFileStore, type BatchFile, type CSVMetadata } from '../store/iesFileStore';
import { iesParser } from '../services/iesParser';
import { iesGenerator } from '../services/iesGenerator';
import { csvService, type CSVRow } from '../services/csvService';
import { photometricCalculator } from '../services/calculator';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { BatchActionBar } from '../components/common/BatchActionBar';
import { CSVPreviewDialog } from '../components/common/CSVPreviewDialog';
import { DownloadSettingsDialog } from '../components/common/DownloadSettingsDialog';
import { BulkEditColumnDialog } from '../components/common/BulkEditColumnDialog';
import { Toast } from '../components/common/Toast';
import type { IESMetadata } from '../types/ies.types';

// Extended CSV row with unit information and original dimensions
interface ExtendedCSVRow extends CSVRow {
  unit?: 'meters' | 'feet';
  originalLength?: number;
  originalWidth?: number;
  originalHeight?: number;
  originalWattage?: number;
  originalLumens?: number;
  update_file_name?: string;
}

export function BatchMetadataEditorPage() {
  const { batchFiles, csvMetadata, addBatchFiles, clearBatchFiles, setCSVMetadata } = useIESFileStore();
  const [csvData, setCsvData] = useState<ExtendedCSVRow[]>([]);
  const [editingCell, setEditingCell] = useState<{row: number, field: keyof CSVRow} | null>(null);
  const [processing, setProcessing] = useState(false);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [useOriginalFilename, setUseOriginalFilename] = useState(false);
  const [catalogNumberSource, setCatalogNumberSource] = useState<'luminaire' | 'lamp'>('luminaire');
  const [catalogNumberPrefix, setCatalogNumberPrefix] = useState<string>('_IES');
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showCSVPreview, setShowCSVPreview] = useState(false);
  const [pendingCSVData, setPendingCSVData] = useState<CSVRow[]>([]);
  const [bulkEditColumn, setBulkEditColumn] = useState<keyof CSVRow | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'info' | 'error'>('info');
  const [autoAdjustWattage, setAutoAdjustWattage] = useState(false);
  
  // Headers for table display (update_file_name is not shown in UI, only in CSV)
  const csvHeaders: (keyof CSVRow)[] = [
    'filename',
    'manufacturer',
    'luminaireCatalogNumber',
    'lampCatalogNumber',
    'test',
    'testLab',
    'testDate',
    'issueDate',
    'lampPosition',
    'other',
    'nearField',
    'cct',
    'wattage',
    'lumens',
    'length',
    'width',
    'height'
  ];

  const metersToFeet = (meters: number) => meters * 3.28084;
  const feetToMeters = (feet: number) => feet / 3.28084;

  // Helper function to merge metadata
  // If a field is explicitly provided in updates (even if empty string), it overrides the original
  // If a field is not provided in updates, the original value is preserved
  const mergeMetadata = (
    original: IESMetadata,
    updates: Partial<IESMetadata>
  ): IESMetadata => {
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
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setProcessing(true);
    const newBatchFiles: BatchFile[] = [];
    const newCsvData: ExtendedCSVRow[] = [];

    try {
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
      setCsvData(newCsvData);
    } catch (error) {
      alert('Error processing files: ' + (error as Error).message);
    } finally {
      setProcessing(false);
    }
  };

  const handleCSVUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset input so the same file can be selected again
    event.target.value = '';

    const reader = new FileReader();
    reader.onload = (e) => {
      const csvContent = e.target?.result as string;
      const parsedData = csvService.parseCSV(csvContent);
      
      const validation = csvService.validateCSV(parsedData);
      if (!validation.isValid) {
        setCsvErrors(validation.errors);
        alert('CSV validation errors:\n' + validation.errors.join('\n'));
        return;
      }
      
      setCsvErrors([]);
      setPendingCSVData(parsedData);
      setShowCSVPreview(true);
    };
    reader.readAsText(file);
  };

  const applyCSVData = () => {
    // Parse unit from CSV or use existing or default to meters
    const updatedData = pendingCSVData.map(newRow => {
      const existingRow = csvData.find(r => r.filename === newRow.filename);
      
      // Determine unit from CSV data or existing data
      let unit: 'meters' | 'feet' = 'meters';
      if (newRow.unit) {
        // Normalize unit value from CSV
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
        // Ensure .ies extension
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
    
    // Update batch files with wattage and lumens changes
    // First pass: update wattage (which auto-adjusts lumens)
    // Second pass: update lumens if it was changed from original
    const updatedFiles = batchFiles.map((file, index) => {
      // Match by original filename (before update_file_name changes it)
      const csvRow = updatedData.find(r => {
        const matchFilename = (r as any)._originalFilename || r.filename;
        const originalFilename = csvData[index]?.filename || file.fileName;
        return matchFilename === originalFilename || matchFilename === file.fileName;
      }) || updatedData[index];
      
      if (!csvRow) return file;
      
      let updatedFile = { ...file };
      
      // Store original CSV values before any modifications
      const csvWattage = csvRow.wattage ? parseFloat(csvRow.wattage) : NaN;
      const csvLumens = csvRow.lumens ? parseFloat(csvRow.lumens) : NaN;
      
      // Check if wattage changed from original
      const wattageChanged = !isNaN(csvWattage) && csvRow.originalWattage !== undefined &&
        Math.abs(csvWattage - csvRow.originalWattage) > 0.01;
      
      // Check if lumens changed from original (using CSV value, not auto-adjusted)
      const lumensChanged = !isNaN(csvLumens) && csvRow.originalLumens !== undefined &&
        Math.abs(csvLumens - csvRow.originalLumens) > 0.1;
      
      // Apply wattage change first (auto-adjusts lumens and candela)
      if (wattageChanged) {
        const result = photometricCalculator.scaleByWattage(
          updatedFile.photometricData,
          csvWattage
        );
        updatedFile.photometricData = result.scaledPhotometricData;
      }
      
      // Apply lumens change second (only if it was explicitly changed from original)
      // This allows overriding the auto-adjusted lumens from wattage change
      if (lumensChanged) {
        const result = photometricCalculator.scaleByLumens(
          updatedFile.photometricData,
          csvLumens,
          autoAdjustWattage
        );
        updatedFile.photometricData = result.scaledPhotometricData;
      }
      
      // Update CSV data with final values for UI display
      const rowIndex = updatedData.findIndex(r => {
        const matchFilename = (r as any)._originalFilename || r.filename;
        const originalFilename = csvData[index]?.filename || file.fileName;
        return matchFilename === originalFilename || matchFilename === file.fileName;
      });
      
      if (rowIndex !== -1) {
        // Update wattage if it was changed
        if (wattageChanged) {
          updatedData[rowIndex].wattage = updatedFile.photometricData.inputWatts.toFixed(2);
        }
        // Update lumens with final value (either from CSV or auto-adjusted)
        if (lumensChanged) {
          updatedData[rowIndex].lumens = updatedFile.photometricData.totalLumens.toFixed(0);
        } else if (wattageChanged) {
          // If only wattage changed, show auto-adjusted lumens
          updatedData[rowIndex].lumens = updatedFile.photometricData.totalLumens.toFixed(0);
        }
      }
      
      return updatedFile;
    });
    
    addBatchFiles(updatedFiles);
    // Remove temporary _originalFilename property before setting CSV data
    const cleanedData = updatedData.map(({ _originalFilename, ...row }) => row);
    setCsvData(cleanedData);
    
    const metadata: CSVMetadata = {};
    cleanedData.forEach(row => {
      // Include all fields from CSV, even if empty (to allow clearing fields)
      const rowMetadata: Partial<IESMetadata> = {};
      
      // Include fields if they exist in the row (even if empty string)
      // Use !== undefined to check if field was in CSV (even if empty string)
      if (row.manufacturer !== undefined) {
        rowMetadata.manufacturer = row.manufacturer;
      }
      if (row.luminaireCatalogNumber !== undefined) {
        rowMetadata.luminaireCatalogNumber = row.luminaireCatalogNumber;
      }
      if (row.lampCatalogNumber !== undefined) {
        rowMetadata.lampCatalogNumber = row.lampCatalogNumber;
      }
      if (row.test !== undefined) {
        rowMetadata.test = row.test;
      }
      if (row.testLab !== undefined) {
        rowMetadata.testLab = row.testLab;
      }
      if (row.testDate !== undefined) {
        rowMetadata.testDate = row.testDate;
      }
      if (row.issueDate !== undefined) {
        rowMetadata.issueDate = row.issueDate;
      }
      if (row.lampPosition !== undefined) {
        rowMetadata.lampPosition = row.lampPosition;
      }
      if (row.other !== undefined) {
        rowMetadata.other = row.other;
      }
      if (row.nearField !== undefined) {
        rowMetadata.nearField = row.nearField;
      }
      
      // Always add to metadata if there are any fields (even if empty)
      if (Object.keys(rowMetadata).length > 0) {
        metadata[row.filename] = rowMetadata;
      }
    });
    setCSVMetadata(metadata);
    setPendingCSVData([]);
  };

  const exportCSV = () => {
    // Create CSV with all columns including wattage, lumens, and update_file_name
    const headers = ['filename', 'manufacturer', 'luminaireCatalogNumber', 'lampCatalogNumber', 'test', 'testLab', 'testDate', 'issueDate', 'lampPosition', 'other', 'nearField', 'cct', 'wattage', 'lumens', 'length', 'width', 'height', 'unit', 'update_file_name'];
    
    const displayHeaders = headers.map(header => {
      if (header === 'cct') return 'cct (K)';
      if (header === 'update_file_name') return 'update_file_name';
      return header;
    });
    
    const csvRows = csvData.map(row => {
      return headers.map(header => {
        const value = (header === 'update_file_name' ? (row as any).update_file_name : row[header as keyof CSVRow]) || '';
        // Escape commas and quotes in values
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',');
    });
    
    const csvContent = [displayHeaders.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'batch_metadata_template.csv');
  };

  const updateCell = (rowIndex: number, field: keyof CSVRow, value: string) => {
    const newCsvData = [...csvData];
    const row = newCsvData[rowIndex];
    // Match by index since files and csvData are in the same order
    const batchFile = batchFiles[rowIndex];
    
    // Handle filename update - filename column is directly editable
    if (field === 'filename') {
      let newFilename = value.trim();
      if (newFilename && !newFilename.toLowerCase().endsWith('.ies')) {
        newFilename = `${newFilename}.ies`;
      }
      newCsvData[rowIndex] = { ...newCsvData[rowIndex], filename: newFilename || row.filename };
      setCsvData(newCsvData);
      updateMetadataFromCSV(newCsvData);
      return;
    }
    
    // Handle wattage changes
    if (field === 'wattage') {
      const newWattage = parseFloat(value);
      if (!isNaN(newWattage) && newWattage > 0 && batchFile && row.originalWattage !== undefined) {
        // Scale photometric data by wattage (auto-adjusts lumens and candela)
        const result = photometricCalculator.scaleByWattage(
          batchFile.photometricData,
          newWattage
        );
        
        // Update the batch file in the store
        const updatedFiles = batchFiles.map(f => {
          if (f.id === batchFile.id) {
            return {
              ...f,
              photometricData: result.scaledPhotometricData
            };
          }
          return f;
        });
        addBatchFiles(updatedFiles);
        
        // Update lumens in CSV to reflect auto-adjusted value
        const updatedRow = { ...row, wattage: value, lumens: result.scaledPhotometricData.totalLumens.toFixed(0) };
        newCsvData[rowIndex] = updatedRow;
        setCsvData(newCsvData);
        
        // Update metadata
        updateMetadataFromCSV(newCsvData);
        return;
      }
    }
    
    // Handle lumens changes
    if (field === 'lumens') {
      const newLumens = parseFloat(value);
      if (!isNaN(newLumens) && newLumens > 0 && batchFile && row.originalLumens !== undefined) {
        // Scale photometric data by lumens
        const result = photometricCalculator.scaleByLumens(
          batchFile.photometricData,
          newLumens,
          autoAdjustWattage
        );
        
        // Update the batch file in the store
        const updatedFiles = batchFiles.map(f => {
          if (f.id === batchFile.id) {
            return {
              ...f,
              photometricData: result.scaledPhotometricData
            };
          }
          return f;
        });
        addBatchFiles(updatedFiles);
        
        // Update wattage in CSV if auto-adjust is enabled
        const updatedRow = { ...row, lumens: value };
        if (autoAdjustWattage) {
          updatedRow.wattage = result.scaledPhotometricData.inputWatts.toFixed(2);
        }
        newCsvData[rowIndex] = updatedRow;
        setCsvData(newCsvData);
        
        // Update metadata
        updateMetadataFromCSV(newCsvData);
        return;
      }
    }
    
    // Handle dimension changes with photometric scaling
    if (field === 'length' || field === 'width' || field === 'height') {
      const newValue = parseFloat(value);
      if (!isNaN(newValue) && newValue > 0 && batchFile && row.originalLength !== undefined) {
        // Convert to meters if needed (for scaling calculation)
        const rowUnit = row.unit || 'meters';
        const targetUnit = batchFile.photometricData.unitsType === 1 ? 'feet' : 'meters';
        const needsConversion = rowUnit !== targetUnit;
        const convertFunc = needsConversion ? 
          (rowUnit === 'feet' ? feetToMeters : metersToFeet) : 
          (val: number) => val;
        
        const newValueInMeters = convertFunc(newValue);
        
        // Determine which dimension changed
        const dimension: 'length' | 'width' | 'height' = 
          field === 'length' ? 'length' :
          field === 'width' ? 'width' : 'height';
        
        // Scale photometric data if dimension changed
        // scaleByDimension will scale from current state to target value
        // We need to convert target value to the file's unit system
        const targetDimensionValue = targetUnit === 'feet' ? metersToFeet(newValueInMeters) : newValueInMeters;
        
        const result = photometricCalculator.scaleByDimension(
          batchFile.photometricData,
          targetDimensionValue,
          dimension
        );
        
        // Update the batch file in the store
        const updatedFiles = batchFiles.map(f => {
          if (f.id === batchFile.id) {
            return {
              ...f,
              photometricData: result.scaledPhotometricData
            };
          }
          return f;
        });
        addBatchFiles(updatedFiles);
      }
    }
    
    newCsvData[rowIndex] = { ...newCsvData[rowIndex], [field]: value };
    setCsvData(newCsvData);
    updateMetadataFromCSV(newCsvData);
  };
  
  const updateMetadataFromCSV = (data: ExtendedCSVRow[]) => {
    const metadata: CSVMetadata = {};
    data.forEach(row => {
      // Include all fields from CSV, even if empty (to allow clearing fields)
      const rowMetadata: Partial<IESMetadata> = {};
      
      // Include fields if they exist in the row (even if empty string)
      // This allows CSV to explicitly set empty values to clear metadata
      // Use !== undefined to check if field was in CSV (even if empty string)
      if (row.manufacturer !== undefined) {
        rowMetadata.manufacturer = row.manufacturer;
      }
      if (row.luminaireCatalogNumber !== undefined) {
        rowMetadata.luminaireCatalogNumber = row.luminaireCatalogNumber;
      }
      if (row.lampCatalogNumber !== undefined) {
        rowMetadata.lampCatalogNumber = row.lampCatalogNumber;
      }
      if (row.test !== undefined) {
        rowMetadata.test = row.test;
      }
      if (row.testLab !== undefined) {
        rowMetadata.testLab = row.testLab;
      }
      if (row.testDate !== undefined) {
        rowMetadata.testDate = row.testDate;
      }
      if (row.issueDate !== undefined) {
        rowMetadata.issueDate = row.issueDate;
      }
      if (row.lampPosition !== undefined) {
        rowMetadata.lampPosition = row.lampPosition;
      }
      if (row.other !== undefined) {
        rowMetadata.other = row.other;
      }
      if (row.nearField !== undefined) {
        rowMetadata.nearField = row.nearField;
      }
      
      // Always add to metadata if there are any fields (even if empty)
      // This ensures CSV data is applied even when clearing fields
      if (Object.keys(rowMetadata).length > 0) {
        metadata[row.filename] = rowMetadata;
      }
    });
    setCSVMetadata(metadata);
  };

  const updateRowUnit = (rowIndex: number, newUnit: 'meters' | 'feet') => {
    const row = csvData[rowIndex];
    if (!row || row.unit === newUnit) return;

    const convertFunc = newUnit === 'feet' ? metersToFeet : feetToMeters;
    
    const newCsvData = [...csvData];
    newCsvData[rowIndex] = {
      ...row,
      unit: newUnit,
      length: row.length ? convertFunc(parseFloat(row.length)).toFixed(3) : row.length,
      width: row.width ? convertFunc(parseFloat(row.width)).toFixed(3) : row.width,
      height: row.height ? convertFunc(parseFloat(row.height)).toFixed(3) : row.height
    };
    
    setCsvData(newCsvData);
  };

  const convertAllToUnit = (targetUnit: 'meters' | 'feet') => {
    const newUnitsType = targetUnit === 'feet' ? 1 : 2;
    const convertFunc = targetUnit === 'feet' ? metersToFeet : feetToMeters;
    
    // Update CSV data
    const newCsvData = csvData.map(row => {
      if (row.unit === targetUnit) return row;
      
      return {
        ...row,
        unit: targetUnit,
        length: row.length ? convertFunc(parseFloat(row.length)).toFixed(3) : row.length,
        width: row.width ? convertFunc(parseFloat(row.width)).toFixed(3) : row.width,
        height: row.height ? convertFunc(parseFloat(row.height)).toFixed(3) : row.height,
        // Update original dimensions too
        originalLength: row.originalLength !== undefined ? convertFunc(row.originalLength) : undefined,
        originalWidth: row.originalWidth !== undefined ? convertFunc(row.originalWidth) : undefined,
        originalHeight: row.originalHeight !== undefined ? convertFunc(row.originalHeight) : undefined
      };
    });
    
    // Update batch files to change unitsType and dimensions
    // Match by index since files and csvData are in the same order
    const updatedFiles = batchFiles.map((file, index) => {
      const csvRow = csvData[index];
      if (!csvRow) return file;
      
      return {
        ...file,
        photometricData: {
          ...file.photometricData,
          unitsType: newUnitsType,
          width: convertFunc(file.photometricData.width),
          length: convertFunc(file.photometricData.length),
          height: convertFunc(file.photometricData.height)
        }
      };
    });
    
    addBatchFiles(updatedFiles);
    setCsvData(newCsvData);
  };

  const handleBulkEdit = (field: keyof CSVRow, value: string) => {
    const newCsvData = csvData.map((row, index) => {
      const updatedRow = { ...row, [field]: value };
      
      // Handle filename - ensure .ies extension
      if (field === 'filename' && value.trim() !== '') {
        let newFilename = value.trim();
        if (!newFilename.toLowerCase().endsWith('.ies')) {
          newFilename = `${newFilename}.ies`;
        }
        updatedRow.filename = newFilename;
      }
      
      // Handle wattage bulk edit - update photometric data
      if (field === 'wattage') {
        const newWattage = parseFloat(value);
        if (!isNaN(newWattage) && newWattage > 0 && batchFiles[index] && row.originalWattage !== undefined) {
          const result = photometricCalculator.scaleByWattage(
            batchFiles[index].photometricData,
            newWattage
          );
          
          // Update batch file
          const updatedFiles = [...batchFiles];
          updatedFiles[index] = {
            ...updatedFiles[index],
            photometricData: result.scaledPhotometricData
          };
          addBatchFiles(updatedFiles);
          
          // Update lumens to reflect auto-adjusted value
          updatedRow.lumens = result.scaledPhotometricData.totalLumens.toFixed(0);
        }
      }
      
      // Handle lumens bulk edit - update photometric data
      if (field === 'lumens') {
        const newLumens = parseFloat(value);
        if (!isNaN(newLumens) && newLumens > 0 && batchFiles[index] && row.originalLumens !== undefined) {
          const result = photometricCalculator.scaleByLumens(
            batchFiles[index].photometricData,
            newLumens,
            autoAdjustWattage
          );
          
          // Update batch file
          const updatedFiles = [...batchFiles];
          updatedFiles[index] = {
            ...updatedFiles[index],
            photometricData: result.scaledPhotometricData
          };
          addBatchFiles(updatedFiles);
          
          // Update wattage if auto-adjust is enabled
          if (autoAdjustWattage) {
            updatedRow.wattage = result.scaledPhotometricData.inputWatts.toFixed(2);
          }
        }
      }
      
      return updatedRow;
    });
    
    setCsvData(newCsvData);
    updateMetadataFromCSV(newCsvData);
  };

  const showToastMessage = (message: string, type: 'success' | 'info' | 'error' = 'info') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
  };

  const downloadProcessedFiles = async () => {
    if (batchFiles.length === 0) return;

    setProcessing(true);
    const missingCatalogNumbers: string[] = [];
    
    try {
      const zip = new JSZip();
      const prefix = catalogNumberPrefix || '_IES';

      for (let i = 0; i < batchFiles.length; i++) {
        const file = batchFiles[i];
        let updatedFile = { ...file };
        
        // Match by index since files and csvData are in the same order
        // This works even if user has edited the filename in the table
        const csvRow = csvData[i];
        
        // Build metadata from CSV row (this is what's shown in the UI)
        const csvRowMetadata: Partial<IESMetadata> = {};
        if (csvRow) {
          // Include all metadata fields from CSV row if they exist (even if empty)
          if (csvRow.manufacturer !== undefined) {
            csvRowMetadata.manufacturer = csvRow.manufacturer;
          }
          if (csvRow.luminaireCatalogNumber !== undefined) {
            csvRowMetadata.luminaireCatalogNumber = csvRow.luminaireCatalogNumber;
          }
          if (csvRow.lampCatalogNumber !== undefined) {
            csvRowMetadata.lampCatalogNumber = csvRow.lampCatalogNumber;
          }
          if (csvRow.test !== undefined) {
            csvRowMetadata.test = csvRow.test;
          }
          if (csvRow.testLab !== undefined) {
            csvRowMetadata.testLab = csvRow.testLab;
          }
          if (csvRow.testDate !== undefined) {
            csvRowMetadata.testDate = csvRow.testDate;
          }
          if (csvRow.issueDate !== undefined) {
            csvRowMetadata.issueDate = csvRow.issueDate;
          }
          if (csvRow.lampPosition !== undefined) {
            csvRowMetadata.lampPosition = csvRow.lampPosition;
          }
          if (csvRow.other !== undefined) {
            csvRowMetadata.other = csvRow.other;
          }
          if (csvRow.nearField !== undefined) {
            csvRowMetadata.nearField = csvRow.nearField.trim();
          }
          
          // Handle CCT - only set if it's a valid number
          if (csvRow.cct && csvRow.cct.trim() !== '') {
            const cct = parseFloat(csvRow.cct);
            if (!isNaN(cct)) {
              csvRowMetadata.colorTemperature = cct;
            }
          }
        }
        
        // Merge metadata: original -> csvMetadata (from store) -> csvRowMetadata (from UI) -> file.metadataUpdates
        updatedFile.metadata = mergeMetadata(
          file.metadata,
          {
            ...(csvMetadata[file.fileName] || {}),
            ...csvRowMetadata, // This is the current state from UI, should override store
            ...(file.metadataUpdates || {})
          }
        );
        
        // Handle wattage, lumens, and dimensions from CSV row if present
        if (csvRow) {
          // Handle wattage and lumens changes
          // Check if wattage changed from original
          const newWattage = csvRow.wattage ? parseFloat(csvRow.wattage) : NaN;
          const wattageChanged = !isNaN(newWattage) && csvRow.originalWattage !== undefined &&
            Math.abs(newWattage - csvRow.originalWattage) > 0.01;
          
          // Check if lumens changed from original
          const newLumens = csvRow.lumens ? parseFloat(csvRow.lumens) : NaN;
          const lumensChanged = !isNaN(newLumens) && csvRow.originalLumens !== undefined &&
            Math.abs(newLumens - csvRow.originalLumens) > 0.1;
          
          // Apply wattage change first (auto-adjusts lumens and candela)
          if (wattageChanged) {
            const result = photometricCalculator.scaleByWattage(
              updatedFile.photometricData,
              newWattage
            );
            updatedFile.photometricData = result.scaledPhotometricData;
          }
          
          // Apply lumens change second (only if it was explicitly changed from original)
          // This allows overriding the auto-adjusted lumens from wattage change
          if (lumensChanged) {
            const result = photometricCalculator.scaleByLumens(
              updatedFile.photometricData,
              newLumens,
              autoAdjustWattage
            );
            updatedFile.photometricData = result.scaledPhotometricData;
          }
          
          // Convert dimensions based on row's unit
          const targetUnit = updatedFile.photometricData.unitsType === 1 ? 'feet' : 'meters';
          const needsConversion = csvRow.unit !== targetUnit;
          const convertFunc = needsConversion ? 
            (csvRow.unit === 'feet' ? feetToMeters : metersToFeet) : 
            (val: number) => val;
          
          // Track which dimensions changed for scaling (compare CSV value against current file state)
          // If updateCell already scaled the file, the file state matches CSV, so no additional scaling
          let lengthChanged = false;
          let widthChanged = false;
          let heightChanged = false;
          let newLength = updatedFile.photometricData.length;
          let newWidth = updatedFile.photometricData.width;
          let newHeight = updatedFile.photometricData.height;
          
          if (csvRow.length && csvRow.length.trim() !== '') {
            const length = parseFloat(csvRow.length);
            if (!isNaN(length)) {
              const convertedLength = convertFunc(length);
              lengthChanged = Math.abs(convertedLength - updatedFile.photometricData.length) > 0.001;
              newLength = convertedLength;
            }
          }
          
          if (csvRow.width && csvRow.width.trim() !== '') {
            const width = parseFloat(csvRow.width);
            if (!isNaN(width)) {
              const convertedWidth = convertFunc(width);
              widthChanged = Math.abs(convertedWidth - updatedFile.photometricData.width) > 0.001;
              newWidth = convertedWidth;
            }
          }
          
          if (csvRow.height && csvRow.height.trim() !== '') {
            const height = parseFloat(csvRow.height);
            if (!isNaN(height)) {
              const convertedHeight = convertFunc(height);
              heightChanged = Math.abs(convertedHeight - updatedFile.photometricData.height) > 0.001;
              newHeight = convertedHeight;
            }
          }
          
          // Apply scaling if dimensions changed (prioritize length, then width, then height)
          // scaleByDimension will scale proportionally from the current state
          if (lengthChanged) {
            const result = photometricCalculator.scaleByDimension(
              updatedFile.photometricData,
              newLength,
              'length'
            );
            updatedFile.photometricData = result.scaledPhotometricData;
          } else if (widthChanged) {
            const result = photometricCalculator.scaleByDimension(
              updatedFile.photometricData,
              newWidth,
              'width'
            );
            updatedFile.photometricData = result.scaledPhotometricData;
          } else if (heightChanged) {
            const result = photometricCalculator.scaleByDimension(
              updatedFile.photometricData,
              newHeight,
              'height'
            );
            updatedFile.photometricData = result.scaledPhotometricData;
          } else {
            // Just update dimensions without scaling (in case of unit conversion only)
            updatedFile.photometricData.length = newLength;
            updatedFile.photometricData.width = newWidth;
            updatedFile.photometricData.height = newHeight;
          }
        }

        const iesContent = iesGenerator.generate(updatedFile);
        
        let newFilename = file.fileName;
        
        if (useOriginalFilename) {
          // Use filename from table (which can be manually edited)
          if (csvRow) {
            newFilename = csvRow.filename;
            // Ensure .ies extension
            if (!newFilename.toLowerCase().endsWith('.ies')) {
              newFilename = `${newFilename}.ies`;
            }
          }
        } else {
          // Try to get catalog number based on source preference
          let catalogNumber: string | undefined;
          
          if (catalogNumberSource === 'luminaire') {
            catalogNumber = updatedFile.metadata.luminaireCatalogNumber?.trim();
            // Fallback to lamp catalog number if luminaire is not available
            if (!catalogNumber || catalogNumber === '') {
              catalogNumber = updatedFile.metadata.lampCatalogNumber?.trim();
            }
          } else {
            catalogNumber = updatedFile.metadata.lampCatalogNumber?.trim();
            // Fallback to luminaire catalog number if lamp is not available
            if (!catalogNumber || catalogNumber === '') {
              catalogNumber = updatedFile.metadata.luminaireCatalogNumber?.trim();
            }
          }
          
          if (catalogNumber && catalogNumber !== '') {
            // Remove .ies extension if present, then add prefix and .ies
            const cleanCatalogNumber = catalogNumber.replace(/\.ies$/i, '');
            newFilename = `${cleanCatalogNumber}${prefix}.ies`;
          } else {
            // No catalog number available - use original filename and track for toast
            newFilename = file.fileName;
            const displayName = csvRow?.filename || file.fileName;
            missingCatalogNumbers.push(displayName);
          }
        }

        zip.file(newFilename, iesContent);
      }

      // Show toast if any files are missing catalog numbers
      if (missingCatalogNumbers.length > 0) {
        const fileList = missingCatalogNumbers.length <= 5 
          ? missingCatalogNumbers.join(', ')
          : `${missingCatalogNumbers.slice(0, 5).join(', ')} and ${missingCatalogNumbers.length - 5} more`;
        showToastMessage(
          `Warning: ${missingCatalogNumbers.length} file(s) missing catalog number. Using original filename: ${fileList}`,
          'error'
        );
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, 'processed_ies_files.zip');
      
      if (missingCatalogNumbers.length === 0) {
        showToastMessage('Files downloaded successfully', 'success');
      }
    } catch (error) {
      alert('Error processing files: ' + (error as Error).message);
    } finally {
      setProcessing(false);
    }
  };

  const swapLengthWidth = () => {
    const updatedCsvData = csvData.map(row => ({
      ...row,
      length: row.width,
      width: row.length
    }));

    setCsvData(updatedCsvData);
  };

  const clearAll = () => {
    clearBatchFiles();
    setCsvData([]);
  };

  const getColumnDisplayName = (header: keyof CSVRow): string => {
    let displayHeader = header.replace(/([A-Z])/g, ' $1').trim();
    if (header === 'cct') {
      displayHeader = 'CCT (K)';
    } else if (header === 'nearField') {
      displayHeader = 'Near Field Type';
    } else if (header === 'wattage') {
      displayHeader = 'Wattage (W)';
    } else if (header === 'lumens') {
      displayHeader = 'Lumens (lm)';
    }
    return displayHeader;
  };

  const actionButtons = [
    {
      icon: <Upload className="w-4 h-4" />,
      label: 'Upload CSV',
      onClick: () => document.getElementById('csv-upload')?.click(),
      variant: 'secondary' as const,
      disabled: csvData.length === 0
    },
    {
      icon: <Download className="w-4 h-4" />,
      label: 'Export CSV',
      onClick: exportCSV,
      variant: 'secondary' as const,
      disabled: csvData.length === 0
    },
    {
      icon: <Gauge className="w-4 h-4" />,
      label: 'Convert All to Meters',
      onClick: () => convertAllToUnit('meters'),
      variant: 'secondary' as const,
      disabled: csvData.length === 0
    },
    {
      icon: <Gauge className="w-4 h-4" />,
      label: 'Convert All to Feet',
      onClick: () => convertAllToUnit('feet'),
      variant: 'secondary' as const,
      disabled: csvData.length === 0
    },
    {
      icon: <Settings className="w-4 h-4" />,
      label: 'Download Settings',
      onClick: () => setShowSettingsDialog(true),
      variant: 'secondary' as const,
      disabled: csvData.length === 0
    },
    {
      icon: <ArrowLeftRight className="w-4 h-4" />,
      label: 'Swap Length ⇄ Width',
      onClick: swapLengthWidth,
      variant: 'secondary' as const,
      disabled: csvData.length === 0
    },
    {
      icon: <Download className="w-4 h-4" />,
      label: 'Download Files',
      onClick: downloadProcessedFiles,
      variant: 'primary' as const,
      disabled: processing || batchFiles.length === 0
    }
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Batch Metadata Editor</h1>
        <p className="text-gray-600 mt-1">
          Update metadata, wattage, lumens, and dimensions for multiple IES files with automatic photometric scaling.
        </p>
        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>How it works:</strong> Editing wattage auto-adjusts lumens and candela values. Editing lumens scales candela values. Enable "Auto-adjust wattage" to also scale wattage when editing lumens.
          </p>
        </div>
      </div>

      {/* Compact File Upload Section */}
      {csvData.length === 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload IES Files</h2>
          <label className="block">
            <input
              type="file"
              multiple
              accept=".ies,.IES"
              onChange={handleFileUpload}
              className="hidden"
              disabled={processing}
            />
            <div className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              processing ? 'border-gray-300 bg-gray-50' : 'border-gray-300 hover:border-gray-400 cursor-pointer'
            }`}>
              <Upload className={`w-12 h-12 mx-auto mb-4 ${processing ? 'text-gray-400' : 'text-gray-600'}`} />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {processing ? 'Processing files...' : 'Drop IES files here or click to upload'}
              </h3>
              <p className="text-sm text-gray-600">
                Supports up to 1000 files. Upload multiple IES files for batch processing.
              </p>
            </div>
          </label>
        </div>
      )}

      {/* Hidden CSV Upload Input */}
      <input
        id="csv-upload"
        type="file"
        accept=".csv"
        onChange={handleCSVUpload}
        className="hidden"
      />

      {/* Action Bar */}
      {csvData.length > 0 && (
        <BatchActionBar
          actions={actionButtons}
          onClear={clearAll}
          fileCount={batchFiles.length}
        />
      )}

      {/* CSV Editor - Main Content */}
      {csvData.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Metadata Editor</h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <input
                  type="checkbox"
                  id="autoAdjustWattage"
                  checked={autoAdjustWattage}
                  onChange={(e) => {
                    setAutoAdjustWattage(e.target.checked);
                    // Re-apply lumens changes if any exist
                    const updatedData = csvData.map((row, index) => {
                      if (row.lumens && batchFiles[index] && row.originalLumens !== undefined) {
                        const newLumens = parseFloat(row.lumens);
                        if (!isNaN(newLumens) && newLumens > 0) {
                          const result = photometricCalculator.scaleByLumens(
                            batchFiles[index].photometricData,
                            newLumens,
                            e.target.checked
                          );
                          
                          const updatedFiles = [...batchFiles];
                          updatedFiles[index] = {
                            ...updatedFiles[index],
                            photometricData: result.scaledPhotometricData
                          };
                          addBatchFiles(updatedFiles);
                          
                          const updatedRow = { ...row };
                          if (e.target.checked) {
                            updatedRow.wattage = result.scaledPhotometricData.inputWatts.toFixed(2);
                          }
                          return updatedRow;
                        }
                      }
                      return row;
                    });
                    setCsvData(updatedData);
                  }}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="autoAdjustWattage" className="text-sm text-gray-700 cursor-pointer font-medium">
                  Auto-adjust wattage when editing lumens
                </label>
              </div>
              <p className="text-xs text-gray-500">Click column headers to set value for all rows</p>
            </div>
          </div>
          
          {csvErrors.length > 0 && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="text-sm font-medium text-red-800 mb-2">CSV Validation Errors:</h3>
              <ul className="text-sm text-red-700 list-disc list-inside">
                {csvErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {csvHeaders.map((header) => {
                    const displayHeader = getColumnDisplayName(header);
                    const isDimensionField = header === 'length' || header === 'width' || header === 'height';
                    
                    return (
                      <th
                        key={header}
                        onClick={() => header !== 'filename' && setBulkEditColumn(header)}
                        className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                          header !== 'filename' ? 'cursor-pointer hover:bg-gray-100' : ''
                        }`}
                        title={header !== 'filename' ? 'Click to set value for all rows' : ''}
                      >
                        {isDimensionField ? displayHeader.replace(/\s*\(.*\)/, '') : displayHeader}
                      </th>
                    );
                  })}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unit
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {csvData.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {csvHeaders.map((header) => {
                      const isWattage = header === 'wattage';
                      const isLumens = header === 'lumens';
                      const wattageChanged = isWattage && row.originalWattage !== undefined && 
                        Math.abs(parseFloat(row.wattage || '0') - row.originalWattage) > 0.01;
                      const lumensChanged = isLumens && row.originalLumens !== undefined && 
                        Math.abs(parseFloat(row.lumens || '0') - row.originalLumens) > 0.1;
                      
                      return (
                        <td key={header} className={`px-4 py-2 ${(wattageChanged || lumensChanged) ? 'bg-blue-50' : ''}`}>
                          {editingCell?.row === rowIndex && editingCell?.field === header ? (
                            header === 'nearField' ? (
                              <select
                                value={row[header] || ''}
                                onChange={(e) => updateCell(rowIndex, header, e.target.value)}
                                onBlur={() => setEditingCell(null)}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                autoFocus
                              >
                                <option value="">None</option>
                                <option value="1">1 - Point</option>
                                <option value="2">2 - Linear</option>
                                <option value="3">3 - Area</option>
                              </select>
                            ) : isWattage || isLumens ? (
                              <input
                                type="number"
                                step={isWattage ? "0.01" : "1"}
                                value={row[header] || ''}
                                onChange={(e) => updateCell(rowIndex, header, e.target.value)}
                                onBlur={() => setEditingCell(null)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    setEditingCell(null);
                                  }
                                }}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                autoFocus
                              />
                            ) : (
                              <input
                                type="text"
                                value={row[header] || ''}
                                onChange={(e) => updateCell(rowIndex, header, e.target.value)}
                                onBlur={() => setEditingCell(null)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    setEditingCell(null);
                                  }
                                }}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                autoFocus
                              />
                            )
                          ) : (
                            <div
                              onClick={() => setEditingCell({row: rowIndex, field: header})}
                              className={`px-2 py-1 min-h-[28px] cursor-pointer hover:bg-gray-50 rounded text-sm ${
                                wattageChanged || lumensChanged ? 'font-medium text-blue-700' : ''
                              }`}
                            >
                              {row[header] || '-'}
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-2">
                      <select
                        value={row.unit || 'meters'}
                        onChange={(e) => updateRowUnit(rowIndex, e.target.value as 'meters' | 'feet')}
                        className="px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="meters">m</option>
                        <option value="feet">ft</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <DownloadSettingsDialog
        isOpen={showSettingsDialog}
        onClose={() => setShowSettingsDialog(false)}
        useOriginalFilename={useOriginalFilename}
        setUseOriginalFilename={setUseOriginalFilename}
        catalogNumberSource={catalogNumberSource}
        setCatalogNumberSource={setCatalogNumberSource}
        catalogNumberPrefix={catalogNumberPrefix}
        setCatalogNumberPrefix={setCatalogNumberPrefix}
      />

      <CSVPreviewDialog
        isOpen={showCSVPreview}
        onClose={() => {
          setShowCSVPreview(false);
          setPendingCSVData([]);
        }}
        onConfirm={applyCSVData}
        csvData={pendingCSVData}
        title="Preview CSV Data"
        headers={[...csvHeaders, 'update_file_name'] as (keyof CSVRow | 'update_file_name')[]}
      />

      <BulkEditColumnDialog
        isOpen={bulkEditColumn !== null}
        onClose={() => setBulkEditColumn(null)}
        onApply={(value) => bulkEditColumn && handleBulkEdit(bulkEditColumn, value)}
        columnName={bulkEditColumn ? getColumnDisplayName(bulkEditColumn) : ''}
        rowCount={csvData.length}
      />

      {/* Toast Notification */}
      {showToast && (
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  );
}