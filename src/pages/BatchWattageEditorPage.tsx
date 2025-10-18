import { useState } from 'react';
import { Upload, Download, FileText, Trash2 } from 'lucide-react';
import { useIESFileStore, type BatchFile } from '../store/iesFileStore';
import { iesParser } from '../services/iesParser';
import { iesGenerator } from '../services/iesGenerator';
import { photometricCalculator } from '../services/calculator';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface WattageRow {
  filename: string;
  originalWattage: number;
  newWattage: string;
  originalLumens: number;
  previewLumens: number;
  previewEfficacy: number;
}

export function BatchWattageEditorPage() {
  const { batchFiles, addBatchFiles, clearBatchFiles } = useIESFileStore();
  const [wattageData, setWattageData] = useState<WattageRow[]>([]);
  const [editingCell, setEditingCell] = useState<number | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setProcessing(true);
    const newBatchFiles: BatchFile[] = [];
    const newWattageData: WattageRow[] = [];

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

        const originalWattage = parsedFile.photometricData.inputWatts;
        const originalLumens = parsedFile.photometricData.totalLumens;
        const efficacy = photometricCalculator.calculateEfficacy(originalLumens, originalWattage);

        newWattageData.push({
          filename: file.name,
          originalWattage,
          newWattage: originalWattage.toFixed(2),
          originalLumens,
          previewLumens: originalLumens,
          previewEfficacy: efficacy
        });
      }

      addBatchFiles(newBatchFiles);
      setWattageData(newWattageData);
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
      const wattageIndex = headers.indexOf('wattage');
      
      if (filenameIndex === -1 || wattageIndex === -1) {
        alert('CSV must contain "filename" and "wattage" columns');
        return;
      }

      const updatedData = [...wattageData];
      
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const values = lines[i].split(',').map(v => v.trim());
        const filename = values[filenameIndex];
        const wattage = values[wattageIndex];
        
        const rowIndex = updatedData.findIndex(row => row.filename === filename);
        if (rowIndex !== -1 && wattage && !isNaN(parseFloat(wattage))) {
          updatedData[rowIndex] = updateWattagePreview(updatedData[rowIndex], wattage);
        }
      }
      
      setWattageData(updatedData);
    };
    reader.readAsText(file);
  };

  const updateWattagePreview = (row: WattageRow, newWattage: string): WattageRow => {
    const wattage = parseFloat(newWattage);
    if (isNaN(wattage) || wattage <= 0) {
      return { ...row, newWattage };
    }

    // Calculate new lumens maintaining same efficacy
    const originalEfficacy = row.originalLumens / row.originalWattage;
    const previewLumens = wattage * originalEfficacy;

    return {
      ...row,
      newWattage,
      previewLumens,
      previewEfficacy: originalEfficacy
    };
  };

  const updateWattage = (rowIndex: number, value: string) => {
    const newData = [...wattageData];
    newData[rowIndex] = updateWattagePreview(newData[rowIndex], value);
    setWattageData(newData);
  };

  const exportCSV = () => {
    // Only export input columns, not calculated preview values
    const headers = ['filename', 'wattage'];
    const rows = wattageData.map(row => [
      row.filename,
      row.newWattage
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'batch_wattage_template.csv');
  };

  const downloadProcessedFiles = async () => {
    if (batchFiles.length === 0) return;

    setProcessing(true);
    try {
      const zip = new JSZip();

      for (const file of batchFiles) {
        const wattageRow = wattageData.find(row => row.filename === file.fileName);
        if (!wattageRow) continue;

        const newWattage = parseFloat(wattageRow.newWattage);
        if (isNaN(newWattage) || newWattage <= 0) continue;

        let updatedFile = { ...file };
        
        // Apply wattage scaling
        if (Math.abs(newWattage - file.photometricData.inputWatts) > 0.01) {
          const result = photometricCalculator.scaleByWattage(
            updatedFile.photometricData, 
            newWattage
          );
          updatedFile.photometricData = result.scaledPhotometricData;
        }

        const iesContent = iesGenerator.generate(updatedFile);
        zip.file(file.fileName, iesContent);
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, 'wattage_scaled_ies_files.zip');
    } catch (error) {
      alert('Error processing files: ' + (error as Error).message);
    } finally {
      setProcessing(false);
    }
  };

  const clearAll = () => {
    clearBatchFiles();
    setWattageData([]);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Batch Wattage Editor</h1>
          <p className="text-gray-600 mt-1">
            Update wattage for multiple IES files with automatic photometric scaling
          </p>
          <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>How it works:</strong> When wattage changes, all candela values and total lumens are scaled 
              proportionally while maintaining the same efficacy (lm/W).
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
                Upload multiple IES files with wattage data
              </p>
            </div>
          </label>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload CSV with Wattages</h2>
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
                Upload CSV with new wattages
              </h3>
              <p className="text-sm text-gray-600">
                CSV with columns: filename, wattage
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Quick Actions */}
      {wattageData.length > 0 && (
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
            {batchFiles.map((file) => {
              const wattageRow = wattageData.find(row => row.filename === file.fileName);
              return (
                <div key={file.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <FileText className="w-5 h-5 text-gray-600" />
                    <span className="font-medium text-sm text-gray-900 truncate">{file.fileName}</span>
                  </div>
                  <div className="text-xs text-gray-600">
                    <p>Original: {file.photometricData.inputWatts.toFixed(1)}W, {file.photometricData.totalLumens.toFixed(0)} lm</p>
                    {wattageRow && parseFloat(wattageRow.newWattage) !== wattageRow.originalWattage && (
                      <p className="text-blue-600 font-medium mt-1">
                        New: {parseFloat(wattageRow.newWattage).toFixed(1)}W, {wattageRow.previewLumens.toFixed(0)} lm
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Wattage Editor Table */}
      {wattageData.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Wattage Editor</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Filename</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Original Wattage (W)</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">New Wattage (W)</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Original Lumens</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase bg-blue-50 border-l-2 border-blue-300">
                    <div className="flex items-center gap-1">
                      <span>Preview Lumens</span>
                      <span className="text-blue-600">📊</span>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase bg-blue-50">
                    <div className="flex items-center gap-1">
                      <span>Efficacy (lm/W)</span>
                      <span className="text-blue-600">📊</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {wattageData.map((row, rowIndex) => {
                  const hasChanged = parseFloat(row.newWattage) !== row.originalWattage;
                  return (
                    <tr key={rowIndex} className={hasChanged ? 'bg-blue-50' : ''}>
                      <td className="px-4 py-2 text-sm text-gray-900">{row.filename}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{row.originalWattage.toFixed(2)}</td>
                      <td className="px-4 py-2">
                        {editingCell === rowIndex ? (
                          <input
                            type="number"
                            step="0.01"
                            value={row.newWattage}
                            onChange={(e) => updateWattage(rowIndex, e.target.value)}
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
                            {parseFloat(row.newWattage).toFixed(2)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">{row.originalLumens.toFixed(0)}</td>
                      <td className={`px-4 py-2 text-sm bg-blue-50 border-l-2 border-blue-300 ${hasChanged ? 'font-medium text-blue-700' : 'text-gray-600'}`}>
                        {row.previewLumens.toFixed(0)}
                      </td>
                      <td className="px-4 py-2 text-sm bg-blue-50 text-gray-600">{row.previewEfficacy.toFixed(1)}</td>
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