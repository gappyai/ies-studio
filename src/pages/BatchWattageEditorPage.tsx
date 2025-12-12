import { useState } from 'react';
import { Upload, Download } from 'lucide-react';
import { useIESFileStore, type BatchFile } from '../store/iesFileStore';
import { csvService, type CSVRow } from '../services/csvService';
import { IESFile } from '../models/IESFile';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { BatchActionBar } from '../components/common/BatchActionBar';
import { CSVPreviewDialog } from '../components/common/CSVPreviewDialog';

interface WattageRow {
  filename: string;
  originalWattage: number;
  newWattage: string;
  originalLumens: number;
  previewWattage: number;
  previewLumens: number;
  previewEfficacy: number;
}

export function BatchWattageEditorPage() {
  const { batchFiles, addBatchFiles, clearBatchFiles } = useIESFileStore();
  const [wattageData, setWattageData] = useState<WattageRow[]>([]);
  const [editingCell, setEditingCell] = useState<{ row: number; field: 'wattage' } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [showCSVPreview, setShowCSVPreview] = useState(false);
  const [pendingCSVData, setPendingCSVData] = useState<CSVRow[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);

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
        const iesFile = IESFile.parse(content, file.name);
        
        const batchFile: BatchFile = {
          ...iesFile.data,
          id: `${file.name}-${Date.now()}-${i}`,
          metadataUpdates: {}
        };

        newBatchFiles.push(batchFile);

        const originalWattage = iesFile.photometricData.inputWatts;
        const originalLumens = iesFile.photometricData.totalLumens;
        const efficacy = originalWattage > 0 ? originalLumens / originalWattage : 0;

        newWattageData.push({
          filename: file.name,
          originalWattage,
          newWattage: originalWattage.toFixed(2),
          originalLumens,
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

  const handleCSVUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

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

  const calculatePreview = (file: BatchFile, newWattageVal: string): { previewLumens: number, previewWattage: number, previewEfficacy: number } => {
      const newWattage = parseFloat(newWattageVal);
      if (isNaN(newWattage) || newWattage <= 0) {
          return {
              previewWattage: file.photometricData.inputWatts,
              previewLumens: file.photometricData.totalLumens,
              previewEfficacy: file.photometricData.inputWatts > 0 ? file.photometricData.totalLumens / file.photometricData.inputWatts : 0
          };
      }

      const iesFile = new IESFile(JSON.parse(JSON.stringify(file)));
      iesFile.updateWattage(newWattage, true);
      
      const p = iesFile.photometricData;
      return {
          previewWattage: p.inputWatts,
          previewLumens: p.totalLumens,
          previewEfficacy: p.inputWatts > 0 ? p.totalLumens / p.inputWatts : 0
      };
  };

  const applyCSVData = () => {
    const updatedData = pendingCSVData.map(newRow => {
      const rowIndex = wattageData.findIndex(r => r.filename === newRow.filename);
      if (rowIndex === -1) return null;
      
      const existingRow = wattageData[rowIndex];
      const batchFile = batchFiles[rowIndex];
      if (!batchFile) return null;

      const wattageValue = newRow.wattage || '';
      const newWattage = wattageValue.trim() !== '' ? wattageValue : existingRow.newWattage;

      const preview = calculatePreview(batchFile, newWattage);

      return {
          ...existingRow,
          newWattage,
          ...preview
      };
    }).filter((row): row is WattageRow => row !== null);
    
    // Merge updates
    const newWattageData = [...wattageData];
    updatedData.forEach(row => {
        const index = newWattageData.findIndex(r => r.filename === row.filename);
        if (index !== -1) newWattageData[index] = row;
    });
    
    setWattageData(newWattageData);
    setPendingCSVData([]);
  };

  const updateWattage = (rowIndex: number, value: string) => {
    const batchFile = batchFiles[rowIndex];
    if (!batchFile) return;

    const preview = calculatePreview(batchFile, value);
    const newData = [...wattageData];
    newData[rowIndex] = {
        ...newData[rowIndex],
        newWattage: value,
        ...preview
    };
    setWattageData(newData);
  };

  const exportCSV = () => {
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

      for (let i = 0; i < batchFiles.length; i++) {
        const file = batchFiles[i];
        const wattageRow = wattageData[i];
        if (!wattageRow) continue;

        const newWattage = parseFloat(wattageRow.newWattage);
        const iesFile = new IESFile(JSON.parse(JSON.stringify(file)));
        
        if (!isNaN(newWattage) && newWattage > 0) {
            iesFile.updateWattage(newWattage, true);
        }

        const iesContent = iesFile.write();
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
      icon: <Upload className="w-4 h-4" />,
      label: 'Upload CSV',
      onClick: () => document.getElementById('csv-upload')?.click(),
      variant: 'secondary' as const,
      disabled: wattageData.length === 0
    },
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

  const csvHeaders: (keyof CSVRow)[] = ['filename', 'wattage'];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Batch Wattage Editor</h1>
        <p className="text-gray-600 mt-1">
          Update wattage for multiple IES files with automatic photometric scaling
        </p>
        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>How it works:</strong> Edit wattage values. Lumens and candela values are scaled proportionally 
            to maintain constant efficacy (lm/W).
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

      {/* Hidden CSV Upload Input */}
      <input
        id="csv-upload"
        type="file"
        accept=".csv"
        onChange={handleCSVUpload}
        className="hidden"
      />

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
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Wattage Editor</h2>
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Original Wattage (W)</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">New Wattage (W)</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Original Lumens (lm)</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase bg-blue-50 border-l-2 border-blue-300">
                    <div className="flex items-center gap-1">
                      <span>Preview Lumens (lm)</span>
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
                  return (
                    <tr key={rowIndex} className={wattageChanged ? 'bg-blue-50' : ''}>
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
                      <td className={`px-4 py-2 text-sm bg-blue-50 border-l-2 border-blue-300 ${wattageChanged ? 'font-medium text-blue-700' : 'text-gray-600'}`}>
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

      {/* CSV Preview Dialog */}
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
    </div>
  );
}
