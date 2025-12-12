import { useState } from 'react';
import { Upload, Download } from 'lucide-react';
import { useIESFileStore, type BatchFile } from '../store/iesFileStore';
import { csvService, type CSVRow } from '../services/csvService';
import { IESFile } from '../models/IESFile';
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

  const calculatePreview = (file: BatchFile, newLumensVal: string, adjustWattage: boolean): { previewLumens: number, previewWattage: number, previewEfficacy: number } => {
      const newLumens = parseFloat(newLumensVal);
      if (isNaN(newLumens) || newLumens <= 0) {
          return {
              previewLumens: file.photometricData.totalLumens,
              previewWattage: file.photometricData.inputWatts,
              previewEfficacy: file.photometricData.inputWatts > 0 ? file.photometricData.totalLumens / file.photometricData.inputWatts : 0
          };
      }

      const iesFile = new IESFile(JSON.parse(JSON.stringify(file)));
      iesFile.updateLumens(newLumens, adjustWattage);
      
      const p = iesFile.photometricData;
      return {
          previewLumens: p.totalLumens,
          previewWattage: p.inputWatts,
          previewEfficacy: p.inputWatts > 0 ? p.totalLumens / p.inputWatts : 0
      };
  };

  const applyCSVData = () => {
    const updatedData = pendingCSVData.map(newRow => {
      const rowIndex = lumensData.findIndex(r => r.filename === newRow.filename);
      if (rowIndex === -1) return null;
      
      const existingRow = lumensData[rowIndex];
      const batchFile = batchFiles[rowIndex];
      if (!batchFile) return null;

      const lumensValue = newRow.lumens || newRow.wattage || ''; // Support both lumens and wattage field names
      const newLumens = lumensValue.trim() !== '' ? lumensValue : existingRow.newLumens;

      const preview = calculatePreview(batchFile, newLumens, autoAdjustWattage);

      return {
          ...existingRow,
          newLumens,
          ...preview
      };
    }).filter((row): row is LumensRow => row !== null);
    
    // We need to merge updated rows into lumensData, keeping others
    const newLumensData = [...lumensData];
    updatedData.forEach(row => {
        const index = newLumensData.findIndex(r => r.filename === row.filename);
        if (index !== -1) newLumensData[index] = row;
    });
    
    setLumensData(newLumensData);
    setPendingCSVData([]);
  };

  const updateLumens = (rowIndex: number, value: string) => {
    const batchFile = batchFiles[rowIndex];
    if (!batchFile) return;

    const preview = calculatePreview(batchFile, value, autoAdjustWattage);
    const newData = [...lumensData];
    newData[rowIndex] = {
        ...newData[rowIndex],
        newLumens: value,
        ...preview
    };
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

      for (let i = 0; i < batchFiles.length; i++) {
        const file = batchFiles[i];
        const lumensRow = lumensData[i];
        if (!lumensRow) continue;

        const newLumens = parseFloat(lumensRow.newLumens);
        const iesFile = new IESFile(JSON.parse(JSON.stringify(file)));
        
        if (!isNaN(newLumens) && newLumens > 0) {
            // Apply update using IESFile logic (same as preview)
            iesFile.updateLumens(newLumens, autoAdjustWattage);
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
    setLumensData([]);
  };

  // Re-calculate all previews when autoAdjustWattage changes
  const handleAutoAdjustChange = (checked: boolean) => {
      setAutoAdjustWattage(checked);
      const newData = lumensData.map((row, index) => {
          const batchFile = batchFiles[index];
          if (!batchFile) return row;
          const preview = calculatePreview(batchFile, row.newLumens, checked);
          return { ...row, ...preview };
      });
      setLumensData(newData);
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
                onChange={(e) => handleAutoAdjustChange(e.target.checked)}
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
