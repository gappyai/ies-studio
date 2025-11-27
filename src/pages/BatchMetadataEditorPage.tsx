import { useState } from 'react';
import { Upload, Download, Settings, ArrowLeftRight, Gauge } from 'lucide-react';
import { useIESFileStore } from '../store/iesFileStore';
import { iesGenerator } from '../services/iesGenerator';
import type { CSVRow } from '../services/csvService';
import { photometricCalculator } from '../services/calculator';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { BatchActionBar } from '../components/common/BatchActionBar';
import { CSVPreviewDialog } from '../components/common/CSVPreviewDialog';
import { DownloadSettingsDialog } from '../components/common/DownloadSettingsDialog';
import { BulkEditColumnDialog } from '../components/common/BulkEditColumnDialog';
import { Toast } from '../components/common/Toast';
import { FileUploadSection } from '../components/batch-metadata/FileUploadSection';
import { CSVEditorTable } from '../components/batch-metadata/CSVEditorTable';
import { useCSVData } from '../hooks/useCSVData';
import { applyPhotometricUpdates } from '../hooks/usePhotometricUpdates';
import { mergeMetadata, buildMetadataFromCSVRow } from '../utils/metadataUtils';

export function BatchMetadataEditorPage() {
  const { batchFiles, csvMetadata, clearBatchFiles } = useIESFileStore();
  const [processing, setProcessing] = useState(false);
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
  
  const {
    csvData,
    setCsvData,
    csvErrors,
    setCsvErrors,
    loadIESFiles,
    parseCSVFile,
    applyCSVUpdates,
    updateCell,
    updateMetadata
  } = useCSVData();
  
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setProcessing(true);
    try {
      const fileArray = Array.from(files);
      const newCsvData = await loadIESFiles(fileArray);
      setCsvData(newCsvData);
      updateMetadata(newCsvData);
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
      const { data, errors } = parseCSVFile(csvContent);
      
      if (errors.length > 0) {
        setCsvErrors(errors);
        alert('CSV validation errors:\n' + errors.join('\n'));
        return;
      }
      
      setCsvErrors([]);
      setPendingCSVData(data);
      setShowCSVPreview(true);
    };
    reader.readAsText(file);
  };

  const applyCSVData = () => {
    const updatedData = applyCSVUpdates(pendingCSVData, autoAdjustWattage);
    setCsvData(updatedData);
    updateMetadata(updatedData);
    setPendingCSVData([]);
  };

  const exportCSV = () => {
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

  const handleCellUpdate = (rowIndex: number, field: keyof CSVRow, value: string) => {
    const updatedData = updateCell(rowIndex, field, value, autoAdjustWattage);
    setCsvData(updatedData);
    updateMetadata(updatedData);
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

  const { addBatchFiles } = useIESFileStore();
  
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
      
      // Handle wattage and lumens bulk edit using unified logic
      if (field === 'wattage' || field === 'lumens') {
        const batchFile = batchFiles[index];
        if (!batchFile) return updatedRow;
        
        const newWattage = field === 'wattage' ? parseFloat(value) : undefined;
        const newLumens = field === 'lumens' ? parseFloat(value) : undefined;
        
        // Get current values - pass undefined for the field not being edited
        // to allow natural scaling (e.g. changing wattage auto-updates lumens)
        const currentWattage = field === 'wattage' ? newWattage : undefined;
        const currentLumens = field === 'lumens' ? newLumens : undefined;
        
        // Apply unified photometric updates
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
        
        // Update CSV row with final values
        updatedRow.wattage = updatedData.inputWatts.toFixed(2);
        updatedRow.lumens = updatedData.totalLumens.toFixed(0);
      }
      
      return updatedRow;
    });
    
    setCsvData(newCsvData);
    updateMetadata(newCsvData);
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
        const csvRow = csvData[i];
        
        // Build metadata from CSV row
        const csvRowMetadata = csvRow ? buildMetadataFromCSVRow(csvRow) : {};
        
        // Merge metadata: original -> csvMetadata (from store) -> csvRowMetadata (from UI) -> file.metadataUpdates
        updatedFile.metadata = mergeMetadata(
          file.metadata,
          {
            ...(csvMetadata[file.fileName] || {}),
            ...csvRowMetadata,
            ...(file.metadataUpdates || {})
          }
        );
        
        // Handle dimensions from CSV row if present (wattage and lumens are already handled in batchFiles)
        if (csvRow) {
          // Convert dimensions based on row's unit
          const targetUnit = updatedFile.photometricData.unitsType === 1 ? 'feet' : 'meters';
          const needsConversion = csvRow.unit !== targetUnit;
          const convertFunc = needsConversion ? 
            (csvRow.unit === 'feet' ? feetToMeters : metersToFeet) : 
            (val: number) => val;
          
          // Track which dimensions changed for scaling
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
        <FileUploadSection onFileUpload={handleFileUpload} processing={processing} />
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
                          const updatedPhotometric = applyPhotometricUpdates(
                            batchFiles[index].photometricData,
                            {
                              fileId: batchFiles[index].id,
                              originalWattage: row.originalWattage,
                              originalLumens: row.originalLumens,
                              newWattage: row.wattage ? parseFloat(row.wattage) : undefined,
                              newLumens: newLumens,
                              autoAdjustWattage: e.target.checked
                            }
                          );
                          
                          const updatedFiles = batchFiles.map(f => {
                            if (f.id === batchFiles[index].id) {
                              return { ...f, photometricData: updatedPhotometric };
                            }
                            return f;
                          });
                          addBatchFiles(updatedFiles);
                          
                          const updatedRow = { ...row };
                          updatedRow.wattage = updatedPhotometric.inputWatts.toFixed(2);
                          updatedRow.lumens = updatedPhotometric.totalLumens.toFixed(0);
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
          
          <CSVEditorTable
            csvData={csvData}
            csvHeaders={csvHeaders}
            onCellUpdate={handleCellUpdate}
            onUnitChange={updateRowUnit}
            onBulkEdit={(field) => setBulkEditColumn(field)}
            autoAdjustWattage={autoAdjustWattage}
          />
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
