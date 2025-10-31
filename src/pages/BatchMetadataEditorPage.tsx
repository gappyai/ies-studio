import { useState } from 'react';
import { Upload, Download, Settings, ArrowLeftRight, Gauge } from 'lucide-react';
import { useIESFileStore, type BatchFile, type CSVMetadata } from '../store/iesFileStore';
import { iesParser } from '../services/iesParser';
import { iesGenerator } from '../services/iesGenerator';
import { csvService, type CSVRow } from '../services/csvService';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { BatchActionBar } from '../components/common/BatchActionBar';
import { CSVPreviewDialog } from '../components/common/CSVPreviewDialog';
import { DownloadSettingsDialog } from '../components/common/DownloadSettingsDialog';
import { BulkEditColumnDialog } from '../components/common/BulkEditColumnDialog';

// Extended CSV row with unit information
interface ExtendedCSVRow extends CSVRow {
  unit?: 'meters' | 'feet';
}

export function BatchMetadataEditorPage() {
  const { batchFiles, csvMetadata, addBatchFiles, clearBatchFiles, setCSVMetadata } = useIESFileStore();
  const [csvData, setCsvData] = useState<ExtendedCSVRow[]>([]);
  const [editingCell, setEditingCell] = useState<{row: number, field: keyof CSVRow} | null>(null);
  const [processing, setProcessing] = useState(false);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [useOriginalFilename, setUseOriginalFilename] = useState(false);
  const [catalogNumberSource, setCatalogNumberSource] = useState<'luminaire' | 'lamp'>('luminaire');
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showCSVPreview, setShowCSVPreview] = useState(false);
  const [pendingCSVData, setPendingCSVData] = useState<CSVRow[]>([]);
  const [bulkEditColumn, setBulkEditColumn] = useState<keyof CSVRow | null>(null);
  
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
          length: parsedFile.photometricData.length.toFixed(3),
          width: parsedFile.photometricData.width.toFixed(3),
          height: parsedFile.photometricData.height.toFixed(3),
          unit
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
      
      return {
        ...newRow,
        unit
      } as ExtendedCSVRow;
    });
    
    setCsvData(updatedData);
    
    const metadata: CSVMetadata = {};
    updatedData.forEach(row => {
      metadata[row.filename] = {
        manufacturer: row.manufacturer,
        luminaireCatalogNumber: row.luminaireCatalogNumber,
        lampCatalogNumber: row.lampCatalogNumber,
        test: row.test,
        testLab: row.testLab,
        testDate: row.testDate,
        issueDate: row.issueDate,
        lampPosition: row.lampPosition,
        other: row.other,
        nearField: row.nearField
      };
    });
    setCSVMetadata(metadata);
    setPendingCSVData([]);
  };

  const exportCSV = () => {
    const csvContent = csvService.exportCSV(csvData, true);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'batch_metadata_template.csv');
  };

  const updateCell = (rowIndex: number, field: keyof CSVRow, value: string) => {
    const newCsvData = [...csvData];
    newCsvData[rowIndex] = { ...newCsvData[rowIndex], [field]: value };
    setCsvData(newCsvData);

    const metadata: CSVMetadata = {};
    newCsvData.forEach(row => {
      metadata[row.filename] = {
        manufacturer: row.manufacturer,
        luminaireCatalogNumber: row.luminaireCatalogNumber,
        lampCatalogNumber: row.lampCatalogNumber,
        test: row.test,
        testLab: row.testLab,
        testDate: row.testDate,
        issueDate: row.issueDate,
        lampPosition: row.lampPosition,
        other: row.other,
        nearField: row.nearField
      };
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
    const newCsvData = csvData.map(row => {
      if (row.unit === targetUnit) return row;
      
      const convertFunc = targetUnit === 'feet' ? metersToFeet : feetToMeters;
      return {
        ...row,
        unit: targetUnit,
        length: row.length ? convertFunc(parseFloat(row.length)).toFixed(3) : row.length,
        width: row.width ? convertFunc(parseFloat(row.width)).toFixed(3) : row.width,
        height: row.height ? convertFunc(parseFloat(row.height)).toFixed(3) : row.height
      };
    });
    
    setCsvData(newCsvData);
  };

  const handleBulkEdit = (field: keyof CSVRow, value: string) => {
    const newCsvData = csvData.map(row => ({
      ...row,
      [field]: value
    }));
    setCsvData(newCsvData);

    // Update metadata if applicable
    const metadata: CSVMetadata = {};
    newCsvData.forEach(row => {
      metadata[row.filename] = {
        manufacturer: row.manufacturer,
        luminaireCatalogNumber: row.luminaireCatalogNumber,
        lampCatalogNumber: row.lampCatalogNumber,
        test: row.test,
        testLab: row.testLab,
        testDate: row.testDate,
        issueDate: row.issueDate,
        lampPosition: row.lampPosition,
        other: row.other,
        nearField: row.nearField
      };
    });
    setCSVMetadata(metadata);
  };

  const downloadProcessedFiles = async () => {
    if (batchFiles.length === 0) return;

    setProcessing(true);
    try {
      const zip = new JSZip();

      for (const file of batchFiles) {
        let updatedFile = { ...file };
        
        updatedFile.metadata = {
          ...file.metadata,
          ...(csvMetadata[file.fileName] || {}),
          ...(file.metadataUpdates || {})
        };

        const csvRow = csvData.find(row => row.filename === file.fileName);
        if (csvRow?.nearField && csvRow.nearField.trim() !== '') {
          updatedFile.metadata.nearField = csvRow.nearField;
        }

        if (csvRow) {
          if (csvRow.cct && csvRow.cct.trim() !== '') {
            const cct = parseFloat(csvRow.cct);
            if (!isNaN(cct)) {
              updatedFile.metadata.colorTemperature = cct;
            }
          }
          
          // Convert dimensions based on row's unit
          const targetUnit = updatedFile.photometricData.unitsType === 1 ? 'feet' : 'meters';
          const needsConversion = csvRow.unit !== targetUnit;
          const convertFunc = needsConversion ? 
            (csvRow.unit === 'feet' ? feetToMeters : metersToFeet) : 
            (val: number) => val;
          
          if (csvRow.length && csvRow.length.trim() !== '') {
            const length = parseFloat(csvRow.length);
            if (!isNaN(length)) {
              updatedFile.photometricData.length = convertFunc(length);
            }
          }
          
          if (csvRow.width && csvRow.width.trim() !== '') {
            const width = parseFloat(csvRow.width);
            if (!isNaN(width)) {
              updatedFile.photometricData.width = convertFunc(width);
            }
          }
          
          if (csvRow.height && csvRow.height.trim() !== '') {
            const height = parseFloat(csvRow.height);
            if (!isNaN(height)) {
              updatedFile.photometricData.height = convertFunc(height);
            }
          }
        }

        const iesContent = iesGenerator.generate(updatedFile);
        
        let newFilename = file.fileName;
        
        if (!useOriginalFilename) {
          const catalogNumber = catalogNumberSource === 'luminaire'
            ? updatedFile.metadata.luminaireCatalogNumber
            : updatedFile.metadata.lampCatalogNumber;
          
          if (catalogNumber && catalogNumber.trim() !== '') {
            newFilename = catalogNumber.endsWith('.ies') ? catalogNumber : `${catalogNumber}.ies`;
          }
        }

        zip.file(newFilename, iesContent);
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, 'processed_ies_files.zip');
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
          Update metadata for multiple IES files. Metadata values will be set as-is without any scaling.
        </p>
        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> This page only edits metadata fields. Use separate pages for wattage or length edits which require photometric calculations.
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
            <p className="text-xs text-gray-500">Click column headers to set value for all rows</p>
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
                      return (
                        <td key={header} className="px-4 py-2">
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
                              className="px-2 py-1 min-h-[28px] cursor-pointer hover:bg-gray-50 rounded text-sm"
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
        headers={csvHeaders}
      />

      <BulkEditColumnDialog
        isOpen={bulkEditColumn !== null}
        onClose={() => setBulkEditColumn(null)}
        onApply={(value) => bulkEditColumn && handleBulkEdit(bulkEditColumn, value)}
        columnName={bulkEditColumn ? getColumnDisplayName(bulkEditColumn) : ''}
        rowCount={csvData.length}
      />
    </div>
  );
}