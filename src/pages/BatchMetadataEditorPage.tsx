import { useState, useEffect } from 'react';
import { Upload, Download, FileText, Settings, Trash2, ArrowLeftRight } from 'lucide-react';
import { useIESFileStore, type BatchFile, type CSVMetadata } from '../store/iesFileStore';
import { iesParser } from '../services/iesParser';
import { iesGenerator } from '../services/iesGenerator';
import { csvService, type CSVRow } from '../services/csvService';
import { photometricCalculator } from '../services/calculator';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export function BatchMetadataEditorPage() {
  const { batchFiles, csvMetadata, addBatchFiles, clearBatchFiles, setCSVMetadata } = useIESFileStore();
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [editingCell, setEditingCell] = useState<{row: number, field: keyof CSVRow} | null>(null);
  const [processing, setProcessing] = useState(false);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);

  // CSV headers (including photometric fields by default)
  const [includePhotometric] = useState(true);
  
  const csvHeaders: (keyof CSVRow)[] = includePhotometric
    ? [
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
        'wattage',
        'cct',
        'cctMultiplier',
        'length',
        'width',
        'height'
      ]
    : [
        'filename',
        'manufacturer',
        'luminaireCatalogNumber',
        'lampCatalogNumber',
        'test',
        'testLab',
        'testDate',
        'issueDate',
        'lampPosition',
        'other'
      ];

  // Sync photometric data from files to table when checkbox is toggled
  useEffect(() => {
    if (includePhotometric && batchFiles.length > 0) {
      const updatedCsvData = csvData.map(row => {
        const file = batchFiles.find(f => f.fileName === row.filename);
        if (file) {
          return {
            ...row,
            wattage: row.wattage || file.photometricData.inputWatts.toFixed(2),
            cct: row.cct || (file.metadata.colorTemperature?.toString() || ''),
            cctMultiplier: row.cctMultiplier || '1.0',
            length: row.length || file.photometricData.length.toFixed(4), // Keep in meters
            width: row.width || file.photometricData.width.toFixed(4),
            height: row.height || file.photometricData.height.toFixed(4)
          };
        }
        return row;
      });
      setCsvData(updatedCsvData);
    }
  }, [includePhotometric, batchFiles.length]);

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

        // Create CSV row from existing metadata and photometric data
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
          // Photometric fields (always populated, shown when includePhotometric is true)
          wattage: parsedFile.photometricData.inputWatts.toFixed(2),
          cct: parsedFile.metadata.colorTemperature?.toString() || '',
          cctMultiplier: '1.0',
          length: parsedFile.photometricData.length.toFixed(4), // Keep in meters
          width: parsedFile.photometricData.width.toFixed(4),
          height: parsedFile.photometricData.height.toFixed(4)
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
          other: row.other
        };
      });
      setCSVMetadata(metadata);
    };
    reader.readAsText(file);
  };

  const exportCSV = () => {
    const csvContent = csvService.exportCSV(csvData, includePhotometric);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'batch_metadata_template.csv');
  };

  const batchSwapDimensions = () => {
    if (csvData.length === 0) {
      alert('No files loaded');
      return;
    }

    if (!confirm(`Swap width and length for all ${csvData.length} files?`)) {
      return;
    }

    // Update the CSV table data - swap width and length
    const updatedCsvData = csvData.map(row => {
      const temp = row.width;
      return {
        ...row,
        width: row.length,
        length: temp
      };
    });

    setCsvData(updatedCsvData);
    alert('Dimensions swapped in table. Changes will be applied on download.');
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
        other: row.other
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
        other: row.other
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

        // Apply photometric updates from CSV table (single source of truth)
        const csvRow = csvData.find(row => row.filename === file.fileName);
        if (csvRow) {
          // Apply dimension updates (already in meters)
          if (csvRow.width) {
            const widthM = parseFloat(csvRow.width);
            if (!isNaN(widthM)) {
              updatedFile.photometricData.width = widthM;
            }
          }
          if (csvRow.length) {
            const lengthM = parseFloat(csvRow.length);
            if (!isNaN(lengthM)) {
              updatedFile.photometricData.length = lengthM;
            }
          }
          if (csvRow.height) {
            const heightM = parseFloat(csvRow.height);
            if (!isNaN(heightM)) {
              updatedFile.photometricData.height = heightM;
            }
          }

          // Apply wattage scaling (if different from original)
          if (csvRow.wattage) {
            const newWattage = parseFloat(csvRow.wattage);
            const originalWattage = file.photometricData.inputWatts;
            if (!isNaN(newWattage) && newWattage > 0 && Math.abs(newWattage - originalWattage) > 0.01) {
              const result = photometricCalculator.scaleByWattage(updatedFile.photometricData, newWattage);
              updatedFile.photometricData = result.scaledPhotometricData;
            }
          }

          // Apply CCT metadata
          if (csvRow.cct) {
            const cct = parseFloat(csvRow.cct);
            if (!isNaN(cct)) {
              updatedFile.metadata.colorTemperature = cct;
            }
          }
          
          // Apply CCT multiplier scaling
          if (csvRow.cctMultiplier) {
            const multiplier = parseFloat(csvRow.cctMultiplier);
            if (!isNaN(multiplier) && multiplier > 0 && Math.abs(multiplier - 1.0) > 0.001) {
              const result = photometricCalculator.scaleByCCT(updatedFile.photometricData, multiplier);
              updatedFile.photometricData = result.scaledPhotometricData;
            }
          }
        }

        // Generate new IES content
        const iesContent = iesGenerator.generate(updatedFile);
        
        // Create new filename with LEDFlex naming if manufacturer is LEDFLEX
        let newFilename = file.fileName;
        if (updatedFile.metadata.manufacturer === 'LEDFLEX' && updatedFile.metadata.luminaireCatalogNumber) {
          newFilename = `${updatedFile.metadata.luminaireCatalogNumber}.ies`;
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
            Upload multiple IES files and update metadata using CSV or inline editing
          </p>
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
                CSV with filename, manufacturer, luminaireCatalogNumber, lampCatalogNumber, test, testLab, testDate, issueDate, lampPosition, other
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Quick Actions */}
      {csvData.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
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

      {/* File List */}
      {batchFiles.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Uploaded Files ({batchFiles.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {batchFiles.map((file) => (
              <div key={file.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="w-5 h-5 text-gray-600" />
                  <span className="font-medium text-sm text-gray-900 truncate">{file.fileName}</span>
                </div>
                <div className="text-xs text-gray-600">
                  <p>{file.photometricData.totalLumens.toFixed(0)} lumens</p>
                  <p>{file.metadata.manufacturer || 'No manufacturer'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CSV Editor */}
      {csvData.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Metadata Editor</h2>
            <button
              onClick={batchSwapDimensions}
              disabled={batchFiles.length === 0}
              className="flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-50"
            >
              <ArrowLeftRight className="w-4 h-4" />
              Swap Width ↔ Length
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {csvHeaders.map((header) => {
                    // Add unit labels for dimension fields
                    let displayHeader = header.replace(/([A-Z])/g, ' $1').trim();
                    if (header === 'length' || header === 'width' || header === 'height') {
                      displayHeader += ' (m)';
                    } else if (header === 'wattage') {
                      displayHeader += ' (W)';
                    } else if (header === 'cct') {
                      displayHeader += ' (K)';
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
                    {csvHeaders.map((header) => (
                      <td key={header} className="px-4 py-2">
                        {editingCell?.row === rowIndex && editingCell?.field === header ? (
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
                        ) : (
                          <div
                            onClick={() => setEditingCell({row: rowIndex, field: header})}
                            className="px-2 py-1 min-h-[28px] cursor-pointer hover:bg-gray-50 rounded text-sm"
                          >
                            {row[header] || '-'}
                          </div>
                        )}
                      </td>
                    ))}
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