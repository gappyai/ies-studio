import { useState } from 'react';
import { Upload, Download, FileText, Settings, Trash2, ArrowLeftRight } from 'lucide-react';
import { useIESFileStore, type BatchFile, type CSVMetadata } from '../store/iesFileStore';
import { iesParser } from '../services/iesParser';
import { iesGenerator } from '../services/iesGenerator';
import { csvService, type CSVRow } from '../services/csvService';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export function BatchMetadataEditorPage() {
  const { batchFiles, csvMetadata, addBatchFiles, clearBatchFiles, setCSVMetadata } = useIESFileStore();
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [editingCell, setEditingCell] = useState<{row: number, field: keyof CSVRow} | null>(null);
  const [processing, setProcessing] = useState(false);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [useOriginalFilename, setUseOriginalFilename] = useState(false);
  const [catalogNumberSource, setCatalogNumberSource] = useState<'luminaire' | 'lamp'>('luminaire');
  
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

  // Determine current unit from first file (all should have same unit after toggle)
  const currentUnitsType = batchFiles.length > 0 ? batchFiles[0].photometricData.unitsType : 2;
  const useImperial = currentUnitsType === 1;

  // Conversion helpers
  const metersToFeet = (meters: number) => meters * 3.28084;
  const feetToMeters = (feet: number) => feet / 3.28084;
  
  // Dimensions in CSV are stored in the current unit system
  const getDisplayValue = (valueStr: string) => {
    const value = parseFloat(valueStr);
    if (isNaN(value)) return valueStr;
    return value.toFixed(3);
  };
  
  const parseInputValue = (value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    return num.toFixed(3);
  };

  // Handle unit toggle
  const handleUnitToggle = () => {
    const newUnitsType = useImperial ? 2 : 1; // Toggle: 1=feet to 2=meters
    const convertFunc = useImperial ? feetToMeters : metersToFeet;
    
    // Update all batch files
    const updatedFiles = batchFiles.map(file => ({
      ...file,
      photometricData: {
        ...file.photometricData,
        unitsType: newUnitsType,
        width: convertFunc(file.photometricData.width),
        length: convertFunc(file.photometricData.length),
        height: convertFunc(file.photometricData.height)
      }
    }));
    
    // Update CSV data
    const updatedCsvData = csvData.map(row => ({
      ...row,
      length: row.length ? convertFunc(parseFloat(row.length)).toFixed(3) : row.length,
      width: row.width ? convertFunc(parseFloat(row.width)).toFixed(3) : row.width,
      height: row.height ? convertFunc(parseFloat(row.height)).toFixed(3) : row.height
    }));
    
    addBatchFiles(updatedFiles);
    setCsvData(updatedCsvData);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setProcessing(true);
    const newBatchFiles: BatchFile[] = [];
    const newCsvData: CSVRow[] = [];

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

        // Create CSV row from existing metadata and dimensions
        const csvRow: CSVRow = {
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
          // Store dimensions in their native units as per unitsType
          length: parsedFile.photometricData.length.toFixed(3),
          width: parsedFile.photometricData.width.toFixed(3),
          height: parsedFile.photometricData.height.toFixed(3)
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

    const reader = new FileReader();
    reader.onload = (e) => {
      const csvContent = e.target?.result as string;
      const parsedData = csvService.parseCSV(csvContent);
      
      // Validate CSV data
      const validation = csvService.validateCSV(parsedData);
      if (!validation.isValid) {
        setCsvErrors(validation.errors);
        alert('CSV validation errors:\n' + validation.errors.join('\n'));
        return;
      }
      
      setCsvErrors([]);
      setCsvData(parsedData);
      
      // Convert to metadata format for batch processing
      const metadata: CSVMetadata = {};
      parsedData.forEach(row => {
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
    reader.readAsText(file);
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

    // Update metadata
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

  const applyLEDFlexTemplate = () => {
    const newCsvData = csvService.applyLEDFlexTemplate(csvData);
    setCsvData(newCsvData);
    
    // Update metadata
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
        
        // Apply metadata updates
        updatedFile.metadata = {
          ...file.metadata,
          ...(csvMetadata[file.fileName] || {}),
          ...(file.metadataUpdates || {})
        };

        // Apply nearField from CSV if provided
        const csvRow = csvData.find(row => row.filename === file.fileName);
        if (csvRow?.nearField && csvRow.nearField.trim() !== '') {
          updatedFile.metadata.nearField = csvRow.nearField;
        }

        if (csvRow) {
          // Only update fields that are present in CSV (not empty/undefined)
          if (csvRow.cct && csvRow.cct.trim() !== '') {
            const cct = parseFloat(csvRow.cct);
            if (!isNaN(cct)) {
              updatedFile.metadata.colorTemperature = cct;
            }
          }
          
          // Update dimensions if provided (stored in current units)
          if (csvRow.length && csvRow.length.trim() !== '') {
            const length = parseFloat(csvRow.length);
            if (!isNaN(length)) {
              updatedFile.photometricData.length = length;
            }
          }
          
          if (csvRow.width && csvRow.width.trim() !== '') {
            const width = parseFloat(csvRow.width);
            if (!isNaN(width)) {
              updatedFile.photometricData.width = width;
            }
          }
          
          if (csvRow.height && csvRow.height.trim() !== '') {
            const height = parseFloat(csvRow.height);
            if (!isNaN(height)) {
              updatedFile.photometricData.height = height;
            }
          }
        }

        // Generate new IES content
        const iesContent = iesGenerator.generate(updatedFile);
        
        // Determine output filename based on settings
        let newFilename = file.fileName;
        
        if (!useOriginalFilename) {
          // Use catalog number for filename with fallback to original
          const catalogNumber = catalogNumberSource === 'luminaire'
            ? updatedFile.metadata.luminaireCatalogNumber
            : updatedFile.metadata.lampCatalogNumber;
          
          if (catalogNumber && catalogNumber.trim() !== '') {
            newFilename = catalogNumber.endsWith('.ies') ? catalogNumber : `${catalogNumber}.ies`;
          }
          // If no catalog number exists, keep original filename as fallback
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
    // Swap length and width in both batchFiles and csvData
    const updatedBatchFiles = batchFiles.map(file => ({
      ...file,
      photometricData: {
        ...file.photometricData,
        length: file.photometricData.width,
        width: file.photometricData.length
      },
      metadata: {
        ...file.metadata,
        luminousOpeningLength: file.metadata.luminousOpeningWidth,
        luminousOpeningWidth: file.metadata.luminousOpeningLength
      }
    }));

    const updatedCsvData = csvData.map(row => ({
      ...row,
      length: row.width,
      width: row.length
    }));

    addBatchFiles(updatedBatchFiles);
    setCsvData(updatedCsvData);
  };

  const clearAll = () => {
    clearBatchFiles();
    setCsvData([]);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
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
        <button
          onClick={clearAll}
          className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
        >
          <Trash2 className="w-4 h-4" />
          Clear All
        </button>
      </div>

      {/* Upload Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm">
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

        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload CSV Template</h2>
          <label className="block">
            <input
              type="file"
              accept=".csv"
              onChange={handleCSVUpload}
              className="hidden"
            />
            <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-gray-400 cursor-pointer">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Upload CSV metadata file
              </h3>
              <p className="text-sm text-gray-600">
                CSV with all fields shown in the table. Dimensions must match current unit setting.
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Download Settings */}
      {csvData.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Download Settings</h2>
          
          {/* Filename Options */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Output Filename</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  checked={!useOriginalFilename}
                  onChange={() => setUseOriginalFilename(false)}
                  className="text-blue-600 focus:ring-blue-500"
                />
                Use Catalog Number (fallback to original if not available)
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  checked={useOriginalFilename}
                  onChange={() => setUseOriginalFilename(true)}
                  className="text-blue-600 focus:ring-blue-500"
                />
                Use Original Filename
              </label>
            </div>
            
            {!useOriginalFilename && (
              <div className="mt-3 ml-6 space-y-2">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    checked={catalogNumberSource === 'luminaire'}
                    onChange={() => setCatalogNumberSource('luminaire')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  Luminaire Catalog Number (preferred)
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    checked={catalogNumberSource === 'lamp'}
                    onChange={() => setCatalogNumberSource('lamp')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  Lamp Catalog Number (fallback)
                </label>
              </div>
            )}
          </div>
          
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h3>
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
          
          <div className="flex flex-wrap gap-4">
            <button
              onClick={applyLEDFlexTemplate}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Settings className="w-4 h-4" />
              Apply LEDFlex Template
            </button>
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={downloadProcessedFiles}
              disabled={processing || batchFiles.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              {processing ? 'Processing...' : 'Download Processed Files'}
            </button>
          </div>
        </div>
      )}

      {/* CSV Editor */}
      {csvData.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Metadata Editor</h2>
            <div className="flex items-center gap-4">
              {/* Unit Toggle */}
              <div className="flex items-center gap-2 text-sm">
                <span className={!useImperial ? 'font-semibold text-blue-600' : 'text-gray-600'}>Meters</span>
                <button
                  onClick={handleUnitToggle}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    useImperial ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                  title={`Switch to ${useImperial ? 'meters' : 'feet'} and convert all dimensions`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      useImperial ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className={useImperial ? 'font-semibold text-blue-600' : 'text-gray-600'}>Feet</span>
              </div>
              
              {/* Swap Button */}
              <button
                onClick={swapLengthWidth}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                title="Swap Length and Width values for all files"
              >
                <ArrowLeftRight className="w-4 h-4" />
                Swap Length ⇄ Width
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {csvHeaders.map((header) => {
                    let displayHeader = header.replace(/([A-Z])/g, ' $1').trim();
                    // Add unit labels for dimension and CCT fields
                    if (header === 'length' || header === 'width' || header === 'height') {
                      displayHeader += useImperial ? ' (ft)' : ' (m)';
                    } else if (header === 'cct') {
                      displayHeader = 'CCT (K)';
                    } else if (header === 'nearField') {
                      displayHeader = 'Near Field Type';
                    }
                    return (
                      <th
                        key={header}
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {displayHeader}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {csvData.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {csvHeaders.map((header) => {
                      const isDimensionField = header === 'length' || header === 'width' || header === 'height';
                      const displayValue = isDimensionField && row[header] ? getDisplayValue(row[header]) : row[header];
                      
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
                                value={isDimensionField ? getDisplayValue(row[header] || '0') : (row[header] || '')}
                                onChange={(e) => {
                                  const newValue = isDimensionField ? parseInputValue(e.target.value) : e.target.value;
                                  updateCell(rowIndex, header, newValue);
                                }}
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
                              {displayValue || '-'}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}