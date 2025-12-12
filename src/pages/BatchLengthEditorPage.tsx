import { useState } from 'react';
import { Upload, Download, Info } from 'lucide-react';
import { useIESFileStore, type BatchFile } from '../store/iesFileStore';
import { type CSVRow } from '../services/csvService';
import { IESFile } from '../models/IESFile';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { BatchActionBar } from '../components/common/BatchActionBar';
import { CSVPreviewDialog } from '../components/common/CSVPreviewDialog';

interface LengthRow {
  filename: string;
  originalLength: number;
  originalWidth: number;
  originalHeight: number;
  targetLength: string;
  scalingDimension: 'length' | 'width' | 'height';
  scaleFactor: number;
  previewLength: number;
  previewWidth: number;
  previewHeight: number;
  previewWattage: number;
  previewLumens: number;
}

export function BatchLengthEditorPage() {
  const { batchFiles, addBatchFiles, clearBatchFiles } = useIESFileStore();
  const [lengthData, setLengthData] = useState<LengthRow[]>([]);
  const [editingCell, setEditingCell] = useState<number | null>(null);
  const [processing, setProcessing] = useState(false);
  const [showCSVPreview, setShowCSVPreview] = useState(false);
  const [pendingCSVData, setPendingCSVData] = useState<Array<{filename: string; targetLength: string; scalingDimension?: string}>>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);

  const currentUnitsType = batchFiles.length > 0 ? batchFiles[0].photometricData.unitsType : 2;
  const useImperial = currentUnitsType === 1;

  const metersToFeet = (meters: number) => meters * 3.28084;
  const feetToMeters = (feet: number) => feet / 3.28084;

  const handleUnitToggle = () => {
    const targetUnit = useImperial ? 'meters' : 'feet';
    const convertFunc = useImperial ? feetToMeters : metersToFeet;
    
    // Update batch files using IESFile logic
    const updatedFiles = batchFiles.map(file => {
      const fileClone = JSON.parse(JSON.stringify(file));
      const iesFile = new IESFile(fileClone);
      iesFile.convertUnits(targetUnit);
      return fileClone;
    });
    
    // Update UI state
    const updatedLengthData = lengthData.map(row => ({
      ...row,
      originalLength: convertFunc(row.originalLength),
      originalWidth: convertFunc(row.originalWidth),
      originalHeight: convertFunc(row.originalHeight),
      targetLength: convertFunc(parseFloat(row.targetLength)).toFixed(4),
      previewLength: convertFunc(row.previewLength),
      previewWidth: convertFunc(row.previewWidth),
      previewHeight: convertFunc(row.previewHeight)
    }));
    
    addBatchFiles(updatedFiles);
    setLengthData(updatedLengthData);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setProcessing(true);
    const newBatchFiles: BatchFile[] = [];
    const newLengthData: LengthRow[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.name.toLowerCase().endsWith('.ies')) continue;

        const content = await file.text();
        const iesFile = IESFile.parse(content, file.name);
        
        const batchFile: BatchFile = {
          ...iesFile.data,
          id: `${file.name}-${Date.now()}-${i}`,
          metadataUpdates: {}
        };

        newBatchFiles.push(batchFile);

        const originalLength = iesFile.photometricData.length;
        const originalWidth = iesFile.photometricData.width;
        const originalHeight = iesFile.photometricData.height;
        const scalingDimension = 'length';

        const scalingDimensionValue = originalLength;

        newLengthData.push({
          filename: file.name,
          originalLength,
          originalWidth,
          originalHeight,
          targetLength: scalingDimensionValue.toFixed(4),
          scalingDimension,
          scaleFactor: 1.0,
          previewLength: originalLength,
          previewWidth: originalWidth,
          previewHeight: originalHeight,
          previewWattage: iesFile.photometricData.inputWatts,
          previewLumens: iesFile.photometricData.totalLumens
        });
      }

      addBatchFiles(newBatchFiles);
      setLengthData(newLengthData);
    } catch (error) {
      alert('Error processing files: ' + (error as Error).message);
    } finally {
      setProcessing(false);
    }
  };

  const calculatePreview = (file: BatchFile, row: LengthRow, targetLengthVal: string): Partial<LengthRow> => {
      const newLength = parseFloat(targetLengthVal);
      if (isNaN(newLength) || newLength <= 0) {
          return { targetLength: targetLengthVal };
      }

      // We need to apply scaling to a clone to get preview values
      const iesFile = new IESFile(JSON.parse(JSON.stringify(file)));
      
      const dimension = row.scalingDimension;
      
      // IESFile.updateDimensions takes values in FILE units.
      // The UI values are in currentUnitsType (file units).
      // So no conversion needed here if we assume batchFile is up to date with UI unit state.
      
      if (dimension === 'length') iesFile.updateDimensions(newLength, undefined, undefined);
      else if (dimension === 'width') iesFile.updateDimensions(undefined, newLength, undefined);
      else if (dimension === 'height') iesFile.updateDimensions(undefined, undefined, newLength);
      
      const p = iesFile.photometricData;
      
      const originalScalingValue = dimension === 'length' ? row.originalLength :
                                   dimension === 'width' ? row.originalWidth : row.originalHeight;
      
      const scaleFactor = originalScalingValue > 0 ? newLength / originalScalingValue : 1;

      return {
          targetLength: targetLengthVal,
          scaleFactor,
          previewLength: p.length,
          previewWidth: p.width,
          previewHeight: p.height,
          previewWattage: p.inputWatts,
          previewLumens: p.totalLumens
      };
  };

  const updateScalingDimension = (rowIndex: number, dimension: 'length' | 'width') => {
    const batchFile = batchFiles[rowIndex];
    if (!batchFile) return;

    const newData = [...lengthData];
    const row = newData[rowIndex];
    
    const newScalingValue = dimension === 'length'
      ? row.originalLength
      : row.originalWidth;
    
    // Reset target to original of new dimension
    const updatedRow = {
      ...row,
      scalingDimension: dimension,
      targetLength: newScalingValue.toFixed(3),
      scaleFactor: 1.0,
      previewLength: row.originalLength,
      previewWidth: row.originalWidth,
      previewHeight: row.originalHeight,
      previewWattage: batchFile.photometricData.inputWatts,
      previewLumens: batchFile.photometricData.totalLumens
    };
    
    newData[rowIndex] = updatedRow;
    setLengthData(newData);
  };

  const updateLength = (rowIndex: number, value: string) => {
    const batchFile = batchFiles[rowIndex];
    if (!batchFile) return;

    const preview = calculatePreview(batchFile, lengthData[rowIndex], value);
    const newData = [...lengthData];
    newData[rowIndex] = { ...newData[rowIndex], ...preview };
    setLengthData(newData);
  };

  const handleCSVUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    event.target.value = '';

    const reader = new FileReader();
    reader.onload = (e) => {
      const csvContent = e.target?.result as string;
      const parsedData = parseLengthCSV(csvContent);
      
      const validation = validateLengthCSV(parsedData);
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

  // Parse CSV specifically for length editor (filename, targetLength, optional scalingDimension)
  const parseLengthCSV = (content: string): Array<{filename: string; targetLength: string; scalingDimension?: string}> => {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = smartSplitCSVLine(lines[0]).map(h => h.trim().toLowerCase());
    const rows: Array<{filename: string; targetLength: string; scalingDimension?: string}> = [];

    // Map headers
    const filenameIndex = headers.findIndex(h => h === 'filename' || h === 'file name');
    const targetLengthIndex = headers.findIndex(h => 
      h === 'targetlength' || h === 'target length' || h === 'target_length' || h === 'length'
    );
    const scalingDimensionIndex = headers.findIndex(h => 
      h === 'scalingdimension' || h === 'scaling dimension' || h === 'scaling_dimension' || 
      h === 'dimension' || h === 'dimension to scale'
    );

    for (let i = 1; i < lines.length; i++) {
      const values = smartSplitCSVLine(lines[i]);
      const filename = filenameIndex >= 0 && filenameIndex < values.length ? values[filenameIndex].trim() : '';
      const targetLength = targetLengthIndex >= 0 && targetLengthIndex < values.length ? values[targetLengthIndex].trim() : '';
      const scalingDimension = scalingDimensionIndex >= 0 && scalingDimensionIndex < values.length ? values[scalingDimensionIndex].trim() : undefined;

      if (filename && targetLength) {
        rows.push({
          filename,
          targetLength,
          scalingDimension: scalingDimension ? scalingDimension.toLowerCase() : undefined
        });
      }
    }

    return rows;
  };

  // Simple CSV line splitter supporting quotes and escaped quotes
  const smartSplitCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const next = line[i + 1];
      if (char === '"') {
        if (inQuotes && next === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  const validateLengthCSV = (rows: Array<{filename: string; targetLength: string; scalingDimension?: string}>): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (rows.length === 0) {
      errors.push('No data rows found');
      return { isValid: false, errors };
    }

    rows.forEach((row, index) => {
      // Check if filename exists in lengthData
      const existingRow = lengthData.find(r => r.filename === row.filename);
      if (!existingRow) {
        errors.push(`Row ${index + 2}: Filename "${row.filename}" not found in uploaded files`);
      }

      // Validate targetLength
      if (!row.targetLength || row.targetLength.trim() === '') {
        errors.push(`Row ${index + 2}: Missing targetLength value`);
      } else {
        const targetLength = parseFloat(row.targetLength);
        if (isNaN(targetLength) || targetLength <= 0) {
          errors.push(`Row ${index + 2}: Invalid targetLength value "${row.targetLength}"`);
        }
      }

      // Validate scalingDimension if provided
      if (row.scalingDimension && row.scalingDimension !== 'length' && row.scalingDimension !== 'width') {
        errors.push(`Row ${index + 2}: Invalid scalingDimension "${row.scalingDimension}" (must be "length" or "width")`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  };

  const applyCSVData = () => {
    const newLengthData = [...lengthData];

    pendingCSVData.forEach((csvRow) => {
      const rowIndex = newLengthData.findIndex(r => r.filename === csvRow.filename);
      if (rowIndex < 0) return;

      const row = newLengthData[rowIndex];
      const batchFile = batchFiles[rowIndex];
      if (!batchFile) return;

      // Update scaling dimension if provided
      let scalingDimension = row.scalingDimension;
      if (csvRow.scalingDimension) {
        if (csvRow.scalingDimension === 'length' || csvRow.scalingDimension === 'width') {
          scalingDimension = csvRow.scalingDimension as 'length' | 'width';
        }
      }

      // Update target length
      const targetLength = csvRow.targetLength.trim();

      const preview = calculatePreview(
          batchFile,
          { ...row, scalingDimension },
          targetLength
      );

      newLengthData[rowIndex] = { ...row, scalingDimension, ...preview };
    });

    setLengthData(newLengthData);
    setPendingCSVData([]);
  };

  const exportCSV = () => {
    const headers = ['filename', 'targetLength'];
    const rows = lengthData.map(row => [
      row.filename,
      row.targetLength
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'batch_length_template.csv');
  };

  const downloadProcessedFiles = async () => {
    if (batchFiles.length === 0) return;

    setProcessing(true);
    try {
      const zip = new JSZip();

      for (let i = 0; i < batchFiles.length; i++) {
        const file = batchFiles[i];
        const lengthRow = lengthData[i];
        if (!lengthRow) continue;

        const targetLength = parseFloat(lengthRow.targetLength);
        if (isNaN(targetLength) || targetLength <= 0) continue;

        const iesFile = new IESFile(JSON.parse(JSON.stringify(file)));
        const dimension = lengthRow.scalingDimension;
        
        // Apply scaling
        if (dimension === 'length') iesFile.updateDimensions(targetLength, undefined, undefined);
        else if (dimension === 'width') iesFile.updateDimensions(undefined, targetLength, undefined);
        else if (dimension === 'height') iesFile.updateDimensions(undefined, undefined, targetLength);

        const iesContent = iesFile.write();
        zip.file(file.fileName, iesContent);
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, 'length_scaled_ies_files.zip');
    } catch (error) {
      alert('Error processing files: ' + (error as Error).message);
    } finally {
      setProcessing(false);
    }
  };

  const clearAll = () => {
    clearBatchFiles();
    setLengthData([]);
  };

  const actionButtons = [
    {
      icon: <Upload className="w-4 h-4" />,
      label: 'Upload CSV',
      onClick: () => document.getElementById('csv-upload')?.click(),
      variant: 'secondary' as const,
      disabled: lengthData.length === 0
    },
    {
      icon: <Download className="w-4 h-4" />,
      label: 'Export CSV',
      onClick: exportCSV,
      variant: 'secondary' as const,
      disabled: lengthData.length === 0
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
        <h1 className="text-3xl font-bold text-gray-900">Batch Length Editor</h1>
        <p className="text-gray-600 mt-1">
          Update length for multiple IES files with automatic photometric scaling
        </p>
        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">How scaling works for linear LED fixtures:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Select the dimension to scale (Length or Width) using the dropdown</li>
                <li>Only the selected dimension changes; other dimensions remain the same</li>
                <li>Wattage and lumens scale LINEARLY (1m → 2m means 2× power and output)</li>
                <li>All candela values scale linearly with the selected dimension</li>
                <li>Example: 1m 10W 1000lm → 2m 20W 2000lm (doubling, not quadrupling)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Compact File Upload Section */}
      {lengthData.length === 0 && (
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
                Upload multiple IES files with length data
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
      {lengthData.length > 0 && (
        <BatchActionBar
          actions={actionButtons}
          onClear={clearAll}
          fileCount={batchFiles.length}
        />
      )}

      {/* Length Editor Table - Main Content */}
      {lengthData.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm ">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Length Editor</h2>
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Filename</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dimension to Scale</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Original ({useImperial ? 'ft' : 'm'})
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Target ({useImperial ? 'ft' : 'm'})
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase bg-blue-50 border-l-2 border-blue-300">
                    <div className="flex items-center gap-1">
                      <span>Scale Factor</span>
                      <span className="text-blue-600">📊</span>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase bg-blue-50">
                    <div className="flex items-center gap-1">
                      <span>Preview Dims ({useImperial ? 'ft' : 'm'})</span>
                      <span className="text-blue-600">📊</span>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase bg-blue-50">
                    <div className="flex items-center gap-1">
                      <span>Preview Power</span>
                      <span className="text-blue-600">📊</span>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase bg-blue-50">
                    <div className="flex items-center gap-1">
                      <span>Preview Lumens</span>
                      <span className="text-blue-600">📊</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {lengthData.map((row, rowIndex) => {
                  const originalValue = row.scalingDimension === 'length' ? row.originalLength : row.originalWidth;
                  const hasChanged = parseFloat(row.targetLength) !== originalValue;
                  return (
                    <tr key={rowIndex} className={hasChanged ? 'bg-blue-50' : ''}>
                      <td className="px-4 py-2 text-sm text-gray-900">{row.filename}</td>
                      <td className="px-4 py-2 text-sm">
                        <select
                          value={row.scalingDimension}
                          onChange={(e) => updateScalingDimension(rowIndex, e.target.value as 'length' | 'width')}
                          className="px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="length">Length</option>
                          <option value="width">Width</option>
                        </select>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">
                        {(row.scalingDimension === 'length' ? row.originalLength : row.originalWidth).toFixed(3)}
                      </td>
                      <td className="px-4 py-2">
                        {editingCell === rowIndex ? (
                          <input
                            type="number"
                            step="any"
                            value={row.targetLength}
                            onChange={(e) => updateLength(rowIndex, e.target.value)}
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
                            onClick={() => setEditingCell(rowIndex)}
                            className={`px-2 py-1 min-h-[28px] cursor-pointer hover:bg-gray-50 rounded text-sm ${
                              hasChanged ? 'font-medium text-blue-700' : 'text-gray-900'
                            }`}
                          >
                            {parseFloat(row.targetLength).toFixed(3)}
                          </div>
                        )}
                      </td>
                      <td className={`px-4 py-2 text-sm bg-blue-50 border-l-2 border-blue-300 ${hasChanged ? 'font-medium text-blue-700' : 'text-gray-600'}`}>
                        {row.scaleFactor.toFixed(3)}
                      </td>
                      <td className="px-4 py-2 text-xs bg-blue-50 text-gray-600">
                        L: {row.previewLength.toFixed(3)}<br/>
                        W: {row.previewWidth.toFixed(3)}<br/>
                        H: {row.previewHeight.toFixed(3)}
                      </td>
                      <td className={`px-4 py-2 text-sm bg-blue-50 ${hasChanged ? 'font-medium text-blue-700' : 'text-gray-600'}`}>
                        {row.previewWattage.toFixed(2)} W
                      </td>
                      <td className={`px-4 py-2 text-sm bg-blue-50 ${hasChanged ? 'font-medium text-blue-700' : 'text-gray-600'}`}>
                        {row.previewLumens.toFixed(0)} lm
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CSV Preview Dialog */}
      <CSVPreviewDialog
        isOpen={showCSVPreview}
        onClose={() => {
          setShowCSVPreview(false);
          setPendingCSVData([]);
        }}
        onConfirm={applyCSVData}
        csvData={pendingCSVData.map(row => ({
          filename: row.filename,
          length: row.targetLength, // Use 'length' field from CSVRow to display targetLength
          ...(row.scalingDimension && { other: row.scalingDimension }) // Use 'other' field to display scalingDimension
        } as CSVRow))}
        title="Preview Length CSV Data"
        headers={['filename', 'length', ...(pendingCSVData.some(row => row.scalingDimension) ? ['other'] : [])] as unknown as (keyof CSVRow)[]}
      />
    </div>
  );
}
