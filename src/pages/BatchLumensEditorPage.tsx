import { useState } from 'react';
import { Upload, Download } from 'lucide-react';
import { useIESFileStore, type BatchFile } from '../store/iesFileStore';
import { iesParser } from '../services/iesParser';
import { iesGenerator } from '../services/iesGenerator';
import { photometricCalculator } from '../services/calculator';
import { csvService, type CSVRow } from '../services/csvService';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { BatchActionBar } from '../components/common/BatchActionBar';
import { CSVPreviewDialog } from '../components/common/CSVPreviewDialog';

interface LumensRow {
  filename: string;
  originalLumens: number;
  newLumens: string;
  originalWattage: number;
  previewLumens: number;
  previewWattage: number;
  previewEfficacy: number;
}

export function BatchLumensEditorPage() {
  const { batchFiles, addBatchFiles, clearBatchFiles } = useIESFileStore();
  const [lumensData, setLumensData] = useState<LumensRow[]>([]);
  const [editingCell, setEditingCell] = useState<{ row: number; field: 'lumens' } | null>(null);
  const [autoAdjustWattage, setAutoAdjustWattage] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showCSVPreview, setShowCSVPreview] = useState(false);
  const [pendingCSVData, setPendingCSVData] = useState<CSVRow[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setProcessing(true);
    const newBatchFiles: BatchFile[] = [];
    const newLumensData: LumensRow[] = [];

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

        newLumensData.push({
          filename: file.name,
          originalLumens,
          newLumens: originalLumens.toFixed(0),
          originalWattage,
          previewLumens: originalLumens,
          previewWattage: originalWattage,
          previewEfficacy: efficacy
        });
      }

      addBatchFiles(newBatchFiles);
      setLumensData(newLumensData);
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
    const updatedData = pendingCSVData.map(newRow => {
      const existingRow = lumensData.find(r => r.filename === newRow.filename);
      if (!existingRow) return null;

      const lumensValue = newRow.lumens || newRow.wattage || ''; // Support both lumens and wattage field names
      const newLumens = lumensValue.trim() !== '' ? lumensValue : existingRow.newLumens;

      return updateLumensPreview(existingRow, newLumens);
    }).filter((row): row is LumensRow => row !== null);
    
    setLumensData(updatedData);
    setPendingCSVData([]);
  };

  const updateLumensPreview = (row: LumensRow, newLumens: string): LumensRow => {
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
      previewWattage,
      previewLumens: lumens,
      previewEfficacy
    };
  };

  const updateLumens = (rowIndex: number, value: string) => {
    const newData = [...lumensData];
    newData[rowIndex] = updateLumensPreview(newData[rowIndex], value);
    setLumensData(newData);
  };

  const exportCSV = () => {
    const headers = ['filename', 'lumens'];
    const rows = lumensData.map(row => [
      row.filename,
      row.newLumens
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'batch_lumens_template.csv');
  };

  const downloadProcessedFiles = async () => {
    if (batchFiles.length === 0) return;

    setProcessing(true);
    try {
      const zip = new JSZip();

      for (const file of batchFiles) {
        const lumensRow = lumensData.find(row => row.filename === file.fileName);
        if (!lumensRow) continue;

        let updatedFile = { ...file };
        
        const newLumens = parseFloat(lumensRow.newLumens);
        const lumensChanged = !isNaN(newLumens) && Math.abs(newLumens - file.photometricData.totalLumens) > 0.1;

        if (lumensChanged) {
          const result = photometricCalculator.scaleByLumens(
            updatedFile.photometricData,
            newLumens,
            autoAdjustWattage
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
    setLumensData([]);
  };

  const actionButtons = [
    {
      icon: <Upload className="w-4 h-4" />,
      label: 'Upload CSV',
      onClick: () => document.getElementById('csv-upload')?.click(),
      variant: 'secondary' as const,
      disabled: lumensData.length === 0
    },
    {
      icon: <Download className="w-4 h-4" />,
      label: 'Export CSV',
      onClick: exportCSV,
      variant: 'secondary' as const,
      disabled: lumensData.length === 0
    },
    {
      icon: <Download className="w-4 h-4" />,
      label: 'Download Files',
      onClick: downloadProcessedFiles,
      variant: 'primary' as const,
      disabled: processing || batchFiles.length === 0
    }
  ];

  const csvHeaders: (keyof CSVRow)[] = ['filename', 'lumens'];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Batch Lumens Editor</h1>
        <p className="text-gray-600 mt-1">
          Update lumens for multiple IES files with automatic photometric scaling
        </p>
        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>How it works:</strong> Edit lumens values. Candela values are scaled proportionally. 
            Enable auto-adjust wattage to also scale wattage and maintain efficacy (lm/W).
          </p>
        </div>
      </div>

      {/* Compact File Upload Section */}
      {lumensData.length === 0 && (
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
                Upload multiple IES files with lumens data
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
      {lumensData.length > 0 && (
        <BatchActionBar
          actions={actionButtons}
          onClear={clearAll}
          fileCount={batchFiles.length}
        />
      )}

      {/* Lumens Editor Table - Main Content */}
      {lumensData.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Lumens Editor</h2>
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <input
                type="checkbox"
                id="autoAdjustWattage"
                checked={autoAdjustWattage}
                onChange={(e) => {
                  setAutoAdjustWattage(e.target.checked);
                  const updatedData = lumensData.map(row =>
                    updateLumensPreview(row, row.newLumens)
                  );
                  setLumensData(updatedData);
                }}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="autoAdjustWattage" className="text-sm text-gray-700 cursor-pointer font-medium">
                Auto-adjust wattage to maintain efficacy
              </label>
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Original Lumens (lm)</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">New Lumens (lm)</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Original Wattage (W)</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase bg-blue-50 border-l-2 border-blue-300">
                    <div className="flex items-center gap-1">
                      <span>Preview Wattage (W)</span>
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
                {lumensData.map((row, rowIndex) => {
                  const lumensChanged = parseFloat(row.newLumens) !== row.originalLumens;
                  return (
                    <tr key={rowIndex} className={lumensChanged ? 'bg-blue-50' : ''}>
                      <td className="px-4 py-2 text-sm text-gray-900">{row.filename}</td>
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
                      <td className="px-4 py-2 text-sm text-gray-600">{row.originalWattage.toFixed(2)}</td>
                      <td className={`px-4 py-2 text-sm bg-blue-50 border-l-2 border-blue-300 ${lumensChanged ? 'font-medium text-blue-700' : 'text-gray-600'}`}>
                        {row.previewWattage.toFixed(2)}
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
