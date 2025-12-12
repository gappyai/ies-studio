import { useState } from 'react';
import { Upload, Download, Settings, ArrowLeftRight, Gauge } from 'lucide-react';
import { useIESFileStore, type BatchFile } from '../store/iesFileStore';
import type { CSVRow } from '../services/csvService';
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
import { IESFile } from '../models/IESFile';
import { csvHandler } from '../services/CSVHandler';

export function BatchMetadataEditorPage() {
  const { batchFiles, clearBatchFiles, addBatchFiles } = useIESFileStore();
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
    // clearInputOverride is available but unused
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setProcessing(true);
    setCsvErrors([]); // Clear any previous CSV errors when adding new files
    try {
      const fileArray = Array.from(files);
      await loadIESFiles(fileArray);
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
    // We store the file reference before resetting
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
    applyCSVUpdates(pendingCSVData, autoAdjustWattage);
    setPendingCSVData([]);
  };

  const exportCSV = () => {
    // Use csvHandler to generate CSV
    const csvContent = csvHandler.generate(csvData);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'batch_metadata_template.csv');
  };

  const handleCellUpdate = (rowIndex: number, field: keyof CSVRow, value: string) => {
    updateCell(rowIndex, field, value, autoAdjustWattage);
  };

  const handleBulkEdit = (field: keyof CSVRow, value: string) => {
    bulkEdit(field, value, autoAdjustWattage);
  };

  const clearAll = () => {
    clearBatchFiles();
    setCsvErrors([]);
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
        const iesFile = new IESFile(file); // Use model wrapper

        // NOTE: file.metadata and file.photometricData are already updated by useCSVData hook

        // Determine filename
        let newFilename = file.fileName;
        const csvRow = csvData[i];

        if (useOriginalFilename) {
          // Use filename from table (which can be manually edited)
          if (csvRow) {
            newFilename = csvRow.filename;
            if (!newFilename.toLowerCase().endsWith('.ies')) {
              newFilename = `${newFilename}.ies`;
            }
          }
        } else {
          // Try to get catalog number based on source preference
          let catalogNumber: string | undefined;

          if (catalogNumberSource === 'luminaire') {
            catalogNumber = iesFile.metadata.luminaireCatalogNumber?.trim();
            if (!catalogNumber || catalogNumber === '') {
              catalogNumber = iesFile.metadata.lampCatalogNumber?.trim();
            }
          } else {
            catalogNumber = iesFile.metadata.lampCatalogNumber?.trim();
            if (!catalogNumber || catalogNumber === '') {
              catalogNumber = iesFile.metadata.luminaireCatalogNumber?.trim();
            }
          }

          if (catalogNumber && catalogNumber !== '') {
            const cleanCatalogNumber = catalogNumber.replace(/\.ies$/i, '');
            newFilename = `${cleanCatalogNumber}${prefix}.ies`;
          } else {
            newFilename = file.fileName;
            const displayName = csvRow?.filename || file.fileName;
            missingCatalogNumbers.push(displayName);
          }
        }

        // iesFile.write() generates content using updated data
        const iesContent = iesFile.write();
        zip.file(newFilename, iesContent);
      }

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
                    const newValue = e.target.checked;
                    setAutoAdjustWattage(newValue);

                    // Re-apply lumens calculation if toggled
                    const updatedFiles = batchFiles.map(file => {
                      const fileClone = JSON.parse(JSON.stringify(file));
                      const iesFile = new IESFile(fileClone);
                      // Re-trigger update based on current lumens to satisfy autoAdjustWattage preference
                      iesFile.updateLumens(iesFile.photometricData.totalLumens, newValue);
                      return fileClone;
                    });

                    addBatchFiles(updatedFiles);
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
