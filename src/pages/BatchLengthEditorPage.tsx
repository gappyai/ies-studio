import { useState } from 'react';
import { Upload, Download, FileText, Info } from 'lucide-react';
import { useIESFileStore, type BatchFile } from '../store/iesFileStore';
import { iesParser } from '../services/iesParser';
import { iesGenerator } from '../services/iesGenerator';
import { photometricCalculator } from '../services/calculator';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { BatchActionBar } from '../components/common/BatchActionBar';

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

interface CSVPreviewData {
  filename: string;
  targetLength: string;
}

export function BatchLengthEditorPage() {
  const { batchFiles, addBatchFiles, clearBatchFiles } = useIESFileStore();
  const [lengthData, setLengthData] = useState<LengthRow[]>([]);
  const [editingCell, setEditingCell] = useState<number | null>(null);
  const [processing, setProcessing] = useState(false);
  const [showCSVPreview, setShowCSVPreview] = useState(false);
  const [pendingCSVData, setPendingCSVData] = useState<CSVPreviewData[]>([]);

  const currentUnitsType = batchFiles.length > 0 ? batchFiles[0].photometricData.unitsType : 2;
  const useImperial = currentUnitsType === 1;

  const metersToFeet = (meters: number) => meters * 3.28084;
  const feetToMeters = (feet: number) => feet / 3.28084;

  const handleUnitToggle = () => {
    const newUnitsType = useImperial ? 2 : 1;
    const convertFunc = useImperial ? feetToMeters : metersToFeet;
    
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
        const parsedFile = iesParser.parse(content, file.name, file.size);
        
        const batchFile: BatchFile = {
          ...parsedFile,
          id: `${file.name}-${Date.now()}-${i}`,
          metadataUpdates: {}
        };

        newBatchFiles.push(batchFile);

        const originalLength = parsedFile.photometricData.length;
        const originalWidth = parsedFile.photometricData.width;
        const originalHeight = parsedFile.photometricData.height;
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
          previewWattage: parsedFile.photometricData.inputWatts,
          previewLumens: parsedFile.photometricData.totalLumens
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

  const handleCSVUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const csvContent = e.target?.result as string;
      const lines = csvContent.split('\n');
      const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
      
      const filenameIndex = headers.indexOf('filename');
      const lengthIndex = headers.indexOf('targetlength');
      
      if (filenameIndex === -1 || lengthIndex === -1) {
        alert('CSV must contain "filename" and "targetLength" columns');
        return;
      }

      const csvData: CSVPreviewData[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const values = lines[i].split(',').map(v => v.trim());
        const filename = values[filenameIndex];
        const targetLength = values[lengthIndex];
        
        if (filename && targetLength) {
          csvData.push({ filename, targetLength });
        }
      }
      
      setPendingCSVData(csvData);
      setShowCSVPreview(true);
    };
    reader.readAsText(file);
  };

  const applyCSVData = () => {
    const updatedData = [...lengthData];
    
    for (const csvRow of pendingCSVData) {
      const rowIndex = updatedData.findIndex(row => row.filename === csvRow.filename);
      if (rowIndex !== -1 && csvRow.targetLength && !isNaN(parseFloat(csvRow.targetLength))) {
        const batchFile = batchFiles.find(f => f.fileName === csvRow.filename);
        if (batchFile) {
          updatedData[rowIndex] = updateLengthPreview(
            updatedData[rowIndex], 
            csvRow.targetLength,
            batchFile.photometricData
          );
        }
      }
    }
    
    setLengthData(updatedData);
    setPendingCSVData([]);
  };

  const updateLengthPreview = (
    row: LengthRow, 
    targetLength: string,
    photometricData: any
  ): LengthRow => {
    const newLength = parseFloat(targetLength);
    if (isNaN(newLength) || newLength <= 0) {
      return { ...row, targetLength };
    }

    const scalingDimension = row.scalingDimension;
    const originalScalingValue = scalingDimension === 'length' ? row.originalLength :
                                 scalingDimension === 'width' ? row.originalWidth :
                                 row.originalHeight;
    
    const scaleFactor = newLength / originalScalingValue;

    const previewLength = scalingDimension === 'length' ? newLength : row.originalLength;
    const previewWidth = scalingDimension === 'width' ? newLength : row.originalWidth;
    const previewHeight = scalingDimension === 'height' ? newLength : row.originalHeight;

    const scaled = photometricCalculator.scaleByDimension(
      photometricData,
      newLength,
      scalingDimension
    );

    return {
      ...row,
      targetLength,
      scaleFactor,
      previewLength,
      previewWidth,
      previewHeight,
      previewWattage: scaled.scaledPhotometricData.inputWatts,
      previewLumens: scaled.scaledPhotometricData.totalLumens
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
    
    newData[rowIndex] = {
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
    
    setLengthData(newData);
  };

  const updateLength = (rowIndex: number, value: string) => {
    const batchFile = batchFiles[rowIndex];
    if (!batchFile) return;

    const newData = [...lengthData];
    newData[rowIndex] = updateLengthPreview(
      newData[rowIndex], 
      value,
      batchFile.photometricData
    );
    setLengthData(newData);
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

        let updatedFile = { ...file };
        
        const result = photometricCalculator.scaleByDimension(
          updatedFile.photometricData,
          targetLength,
          lengthRow.scalingDimension
        );
        
        updatedFile.photometricData = result.scaledPhotometricData;

        const iesContent = iesGenerator.generate(updatedFile);
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
                            step="0.0001"
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
      {showCSVPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Preview CSV Data</h2>
              <button
                onClick={() => {
                  setShowCSVPreview(false);
                  setPendingCSVData([]);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                ×
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-6">
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  Preview of {pendingCSVData.length} row{pendingCSVData.length !== 1 ? 's' : ''} from CSV. 
                  Review the data and click "Apply Changes" to update your files.
                </p>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Filename</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target Length</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {pendingCSVData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm text-gray-900">{row.filename}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{row.targetLength}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowCSVPreview(false);
                  setPendingCSVData([]);
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  applyCSVData();
                  setShowCSVPreview(false);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Apply Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}