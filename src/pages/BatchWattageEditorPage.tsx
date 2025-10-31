import { useState } from 'react';
import { Upload, Download } from 'lucide-react';
import { useIESFileStore, type BatchFile } from '../store/iesFileStore';
import { iesParser } from '../services/iesParser';
import { iesGenerator } from '../services/iesGenerator';
import { photometricCalculator } from '../services/calculator';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { BatchActionBar } from '../components/common/BatchActionBar';

interface WattageRow {
  filename: string;
  originalWattage: number;
  newWattage: string;
  originalLumens: number;
  newLumens: string;
  previewWattage: number;
  previewLumens: number;
  previewEfficacy: number;
}

export function BatchWattageEditorPage() {
  const { batchFiles, addBatchFiles, clearBatchFiles } = useIESFileStore();
  const [wattageData, setWattageData] = useState<WattageRow[]>([]);
  const [editingCell, setEditingCell] = useState<{ row: number; field: 'wattage' | 'lumens' } | null>(null);
  const [autoAdjustWattage, setAutoAdjustWattage] = useState(true);
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
          newLumens: originalLumens.toFixed(0),
          previewWattage: originalWattage,
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

  const updateWattagePreview = (row: WattageRow, newWattage: string): WattageRow => {
    const wattage = parseFloat(newWattage);
    if (isNaN(wattage) || wattage <= 0) {
      return { ...row, newWattage, previewWattage: row.originalWattage };
    }

    const originalEfficacy = row.originalLumens / row.originalWattage;
    const previewLumens = wattage * originalEfficacy;

    return {
      ...row,
      newWattage,
      newLumens: previewLumens.toFixed(0),
      previewWattage: wattage,
      previewLumens,
      previewEfficacy: originalEfficacy
    };
  };

  const updateLumensPreview = (row: WattageRow, newLumens: string): WattageRow => {
    const lumens = parseFloat(newLumens);
    if (isNaN(lumens) || lumens <= 0) {
      return { ...row, newLumens, previewLumens: row.originalLumens };
    }

    const previewWattage = autoAdjustWattage
      ? (lumens / row.originalLumens) * row.originalWattage
      : row.originalWattage;
    
    const previewEfficacy = lumens / previewWattage;

    return {
      ...row,
      newLumens,
      newWattage: previewWattage.toFixed(2),
      previewWattage,
      previewLumens: lumens,
      previewEfficacy
    };
  };

  const updateWattage = (rowIndex: number, value: string) => {
    const newData = [...wattageData];
    newData[rowIndex] = updateWattagePreview(newData[rowIndex], value);
    setWattageData(newData);
  };

  const updateLumens = (rowIndex: number, value: string) => {
    const newData = [...wattageData];
    newData[rowIndex] = updateLumensPreview(newData[rowIndex], value);
    setWattageData(newData);
  };

  const exportCSV = () => {
    const headers = ['filename', 'wattage', 'lumens'];
    const rows = wattageData.map(row => [
      row.filename,
      row.newWattage,
      row.newLumens
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'batch_editing_template.csv');
  };

  const downloadProcessedFiles = async () => {
    if (batchFiles.length === 0) return;

    setProcessing(true);
    try {
      const zip = new JSZip();

      for (const file of batchFiles) {
        const wattageRow = wattageData.find(row => row.filename === file.fileName);
        if (!wattageRow) continue;

        let updatedFile = { ...file };
        
        const newLumens = parseFloat(wattageRow.newLumens);
        const lumensChanged = !isNaN(newLumens) && Math.abs(newLumens - file.photometricData.totalLumens) > 0.1;
        
        const newWattage = parseFloat(wattageRow.newWattage);
        const wattageChanged = !isNaN(newWattage) && Math.abs(newWattage - file.photometricData.inputWatts) > 0.01;

        if (lumensChanged) {
          const result = photometricCalculator.scaleByLumens(
            updatedFile.photometricData,
            newLumens,
            autoAdjustWattage
          );
          updatedFile.photometricData = result.scaledPhotometricData;
        } else if (wattageChanged) {
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
      saveAs(blob, 'batch_edited_ies_files.zip');
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

  const actionButtons = [
    {
      icon: <Download className="w-4 h-4" />,
      label: 'Export CSV',
      onClick: exportCSV,
      variant: 'secondary' as const,
      disabled: wattageData.length === 0
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
        <h1 className="text-3xl font-bold text-gray-900">Batch Wattage/Lumen Editor</h1>
        <p className="text-gray-600 mt-1">
          Update wattage or lumens for multiple IES files with automatic photometric scaling
        </p>
        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>How it works:</strong> Edit either wattage or lumens. When lumens changes, candela values are
            scaled proportionally. Enable auto-adjust to also scale wattage and maintain efficacy (lm/W).
          </p>
        </div>
      </div>

      {/* Compact File Upload Section */}
      {wattageData.length === 0 && (
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
                Upload multiple IES files with wattage data
              </p>
            </div>
          </label>
        </div>
      )}

      {/* Action Bar */}
      {wattageData.length > 0 && (
        <BatchActionBar
          actions={actionButtons}
          onClear={clearAll}
          fileCount={batchFiles.length}
        />
      )}

      {/* Wattage Editor Table - Main Content */}
      {wattageData.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm ">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Wattage & Lumens Editor</h2>
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <input
                type="checkbox"
                id="autoAdjustWattage"
                checked={autoAdjustWattage}
                onChange={(e) => {
                  setAutoAdjustWattage(e.target.checked);
                  const updatedData = wattageData.map(row =>
                    updateLumensPreview(row, row.newLumens)
                  );
                  setWattageData(updatedData);
                }}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="autoAdjustWattage" className="text-sm text-gray-700 cursor-pointer font-medium">
                Auto-adjust wattage when editing lumens
              </label>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Filename</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Original Wattage (W)</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">New Wattage (W)</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Original Lumens (lm)</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">New Lumens (lm)</th>
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
                  const wattageChanged = parseFloat(row.newWattage) !== row.originalWattage;
                  const lumensChanged = parseFloat(row.newLumens) !== row.originalLumens;
                  const hasChanged = wattageChanged || lumensChanged;
                  return (
                    <tr key={rowIndex} className={hasChanged ? 'bg-blue-50' : ''}>
                      <td className="px-4 py-2 text-sm text-gray-900">{row.filename}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{row.originalWattage.toFixed(2)}</td>
                      <td className="px-4 py-2">
                        {editingCell?.row === rowIndex && editingCell?.field === 'wattage' ? (
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
                            onClick={() => setEditingCell({ row: rowIndex, field: 'wattage' })}
                            className={`px-2 py-1 min-h-[28px] cursor-pointer hover:bg-gray-50 rounded text-sm ${
                              wattageChanged ? 'font-medium text-blue-700' : 'text-gray-900'
                            }`}
                          >
                            {parseFloat(row.newWattage).toFixed(2)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">{row.originalLumens.toFixed(0)}</td>
                      <td className="px-4 py-2">
                        {editingCell?.row === rowIndex && editingCell?.field === 'lumens' ? (
                          <input
                            type="number"
                            step="1"
                            value={row.newLumens}
                            onChange={(e) => updateLumens(rowIndex, e.target.value)}
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
                            onClick={() => setEditingCell({ row: rowIndex, field: 'lumens' })}
                            className={`px-2 py-1 min-h-[28px] cursor-pointer hover:bg-gray-50 rounded text-sm ${
                              lumensChanged ? 'font-medium text-blue-700' : 'text-gray-900'
                            }`}
                          >
                            {parseFloat(row.newLumens).toFixed(0)}
                          </div>
                        )}
                      </td>
                      <td className={`px-4 py-2 text-sm bg-blue-50 border-l-2 border-blue-300 ${lumensChanged ? 'font-medium text-blue-700' : 'text-gray-600'}`}>
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