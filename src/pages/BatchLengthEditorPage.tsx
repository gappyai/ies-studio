import { useState } from 'react';
import { Upload, Download, FileText, Trash2, Info } from 'lucide-react';
import { useIESFileStore, type BatchFile } from '../store/iesFileStore';
import { iesParser } from '../services/iesParser';
import { iesGenerator } from '../services/iesGenerator';
import { photometricCalculator } from '../services/calculator';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

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

  const determineScalingDimension = (length: number, width: number, height: number): 'length' | 'width' | 'height' => {
    const max = Math.max(length, width, height);
    if (max === length) return 'length';
    if (max === width) return 'width';
    return 'height';
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
        const scalingDimension = determineScalingDimension(originalLength, originalWidth, originalHeight);

        // Get the actual scaling dimension value
        const scalingDimensionValue = scalingDimension === 'length' ? originalLength :
                                       scalingDimension === 'width' ? originalWidth :
                                       originalHeight;

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

      const updatedData = [...lengthData];
      
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const values = lines[i].split(',').map(v => v.trim());
        const filename = values[filenameIndex];
        const targetLength = values[lengthIndex];
        
        const rowIndex = updatedData.findIndex(row => row.filename === filename);
        if (rowIndex !== -1 && targetLength && !isNaN(parseFloat(targetLength))) {
          const batchFile = batchFiles.find(f => f.fileName === filename);
          if (batchFile) {
            updatedData[rowIndex] = updateLengthPreview(
              updatedData[rowIndex], 
              targetLength,
              batchFile.photometricData
            );
          }
        }
      }
      
      setLengthData(updatedData);
    };
    reader.readAsText(file);
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

    // Determine which dimension to use as the scaling reference
    const scalingDimension = row.scalingDimension;
    const originalScalingValue = scalingDimension === 'length' ? row.originalLength :
                                 scalingDimension === 'width' ? row.originalWidth :
                                 row.originalHeight;
    
    const scaleFactor = newLength / originalScalingValue;

    // For linear LED fixtures: Only scale the longest dimension, others stay the same
    const previewLength = scalingDimension === 'length' ? newLength : row.originalLength;
    const previewWidth = scalingDimension === 'width' ? newLength : row.originalWidth;
    const previewHeight = scalingDimension === 'height' ? newLength : row.originalHeight;

    // Calculate scaled photometric values using the correct dimension
    const scaled = photometricCalculator.scaleByDimension(
      photometricData,
      newLength,  // Already in meters
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
    const headers = ['filename', 'originalLength', 'targetLength', 'scalingDimension', 'scaleFactor', 'previewWattage', 'previewLumens'];
    const rows = lengthData.map(row => [
      row.filename,
      row.originalLength.toFixed(4),
      row.targetLength,
      row.scalingDimension,
      row.scaleFactor.toFixed(4),
      row.previewWattage.toFixed(2),
      row.previewLumens.toFixed(0)
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
        
        // Apply dimension scaling with photometric calculations
        const result = photometricCalculator.scaleByDimension(
          updatedFile.photometricData,
          targetLength,  // Already in meters
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

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
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
                  <li>The longest dimension is automatically detected and used for scaling</li>
                  <li>Only the longest dimension changes; other dimensions remain the same</li>
                  <li>Wattage and lumens scale LINEARLY (1m → 2m means 2× power and output)</li>
                  <li>All candela values scale linearly with the length</li>
                  <li>Example: 1m 10W 1000lm → 2m 20W 2000lm (doubling, not quadrupling)</li>
                </ul>
              </div>
            </div>
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
                Upload multiple IES files with length data
              </p>
            </div>
          </label>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload CSV with Target Lengths</h2>
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
                Upload CSV with target lengths
              </h3>
              <p className="text-sm text-gray-600">
                CSV with columns: filename, targetLength (in meters)
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Quick Actions */}
      {lengthData.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Download className="w-4 h-4" />
              Export CSV Template
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
            {batchFiles.map((file, index) => {
              const lengthRow = lengthData[index];
              const originalValue = lengthRow ? (
                lengthRow.scalingDimension === 'length' ? lengthRow.originalLength :
                lengthRow.scalingDimension === 'width' ? lengthRow.originalWidth :
                lengthRow.originalHeight
              ) : 0;
              const hasChanged = lengthRow && parseFloat(lengthRow.targetLength) !== originalValue;
              return (
                <div key={file.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <FileText className="w-5 h-5 text-gray-600" />
                    <span className="font-medium text-sm text-gray-900 truncate">{file.fileName}</span>
                  </div>
                  {lengthRow && (
                    <div className="text-xs text-gray-600">
                      <p className="font-medium text-gray-700 mb-1">
                        Scaling by: <span className="text-blue-600">{lengthRow.scalingDimension}</span>
                      </p>
                      <p>Original: {(lengthRow.scalingDimension === 'length' ? lengthRow.originalLength :
                                     lengthRow.scalingDimension === 'width' ? lengthRow.originalWidth :
                                     lengthRow.originalHeight).toFixed(3)}m</p>
                      <p>{file.photometricData.inputWatts.toFixed(1)}W, {file.photometricData.totalLumens.toFixed(0)} lm</p>
                      {hasChanged && (
                        <>
                          <p className="text-blue-600 font-medium mt-1">
                            New: {parseFloat(lengthRow.targetLength).toFixed(3)}m (×{lengthRow.scaleFactor.toFixed(2)})
                          </p>
                          <p className="text-blue-600">
                            {lengthRow.previewWattage.toFixed(1)}W, {lengthRow.previewLumens.toFixed(0)} lm
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Length Editor Table */}
      {lengthData.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Length Editor</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Filename</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scaling Dimension</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Original (m)</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target (m)</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scale Factor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Preview Dims (m)</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Preview Power</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Preview Lumens</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {lengthData.map((row, rowIndex) => {
                  const originalValue = row.scalingDimension === 'length' ? row.originalLength :
                                       row.scalingDimension === 'width' ? row.originalWidth :
                                       row.originalHeight;
                  const hasChanged = parseFloat(row.targetLength) !== originalValue;
                  return (
                    <tr key={rowIndex} className={hasChanged ? 'bg-blue-50' : ''}>
                      <td className="px-4 py-2 text-sm text-gray-900">{row.filename}</td>
                      <td className="px-4 py-2 text-sm">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                          {row.scalingDimension}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">
                        {(row.scalingDimension === 'length' ? row.originalLength :
                          row.scalingDimension === 'width' ? row.originalWidth :
                          row.originalHeight).toFixed(4)}
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
                            {parseFloat(row.targetLength).toFixed(4)}
                          </div>
                        )}
                      </td>
                      <td className={`px-4 py-2 text-sm ${hasChanged ? 'font-medium text-blue-700' : 'text-gray-600'}`}>
                        {row.scaleFactor.toFixed(4)}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-600">
                        L: {row.previewLength.toFixed(3)}<br/>
                        W: {row.previewWidth.toFixed(3)}<br/>
                        H: {row.previewHeight.toFixed(3)}
                      </td>
                      <td className={`px-4 py-2 text-sm ${hasChanged ? 'font-medium text-blue-700' : 'text-gray-600'}`}>
                        {row.previewWattage.toFixed(2)} W
                      </td>
                      <td className={`px-4 py-2 text-sm ${hasChanged ? 'font-medium text-blue-700' : 'text-gray-600'}`}>
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
    </div>
  );
}