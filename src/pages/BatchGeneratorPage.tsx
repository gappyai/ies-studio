import { useState } from 'react';
import { Download, Upload, Plus, Trash2 } from 'lucide-react';
import { useIESFileStore } from '../store/iesFileStore';
import { iesGenerator } from '../services/iesGenerator';
import { iesParser } from '../services/iesParser';
import { photometricCalculator } from '../services/calculator';
import { csvService, type CSVRow } from '../services/csvService';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { BatchActionBar } from '../components/common/BatchActionBar';
import { AddCCTVariantDialog } from '../components/common/AddCCTVariantDialog';
import { CSVPreviewDialog } from '../components/common/CSVPreviewDialog';

interface CCTVariant {
  id: string;
  filename: string;
  cct: number;
  multiplier: number;
  previewLumens: number;
  lampCatalogNumber: string;
  luminaireCatalogNumber: string;
}

export function BatchGeneratorPage() {
  const { currentFile, editedData, setCurrentFile, setCalculatedProperties } = useIESFileStore();
  const [variants, setVariants] = useState<CCTVariant[]>([]);
  const [generating, setGenerating] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingCell, setEditingCell] = useState<{id: string, field: 'filename' | 'cct' | 'multiplier' | 'catalogNumber'} | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [showCSVPreview, setShowCSVPreview] = useState(false);
  const [pendingCSVData, setPendingCSVData] = useState<CSVRow[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);

  const handleFileUpload = async (file: File) => {
    setError(null);
    
    if (!file.name.toLowerCase().endsWith('.ies')) {
      setError('Please select a valid .ies file');
      return;
    }

    try {
      setProcessing(true);
      const content = await file.text();
      const parsedFile = iesParser.parse(content, file.name, file.size);
      const calculated = photometricCalculator.calculateProperties(parsedFile.photometricData);
      
      setCurrentFile(parsedFile);
      setCalculatedProperties(calculated);
      
      // Start with empty variants table
      setVariants([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse IES file');
    } finally {
      setProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  // Helper function to generate unique filename
  const generateUniqueFilename = (baseFilename: string, existingVariants: CCTVariant[], excludeId?: string): string => {
    const usedFilenames = new Set(
      existingVariants
        .filter(v => !excludeId || v.id !== excludeId)
        .map(v => v.filename.toLowerCase())
    );
    
    let candidate = baseFilename;
    let counter = 1;
    
    while (usedFilenames.has(candidate.toLowerCase())) {
      // Insert _N before .ies extension
      const nameWithoutExt = baseFilename.replace(/\.(ies|IES)$/i, '');
      const ext = baseFilename.match(/\.(ies|IES)$/i)?.[0] || '.ies';
      candidate = `${nameWithoutExt}_${counter}${ext}`;
      counter++;
    }
    
    return candidate;
  };

  const addVariant = (newVariants: Array<{ cct: number; multiplier: number }>) => {
    if (!currentFile) return;
    
    const baseName = currentFile.fileName.replace(/\.(ies|IES)$/i, '');
    const updatedVariants = [...variants];
    
    const variantsToAdd: CCTVariant[] = newVariants.map((variant, index) => {
      const previewLumens = currentFile.photometricData.totalLumens * variant.multiplier;
      const baseFilename = `${baseName}_${variant.cct}.ies`;
      const uniqueFilename = generateUniqueFilename(baseFilename, updatedVariants);
      
      return {
        id: `${Date.now()}-${index}`,
        filename: uniqueFilename,
        cct: variant.cct,
        multiplier: variant.multiplier,
        previewLumens,
        lampCatalogNumber: '',
        luminaireCatalogNumber: ''
      };
    });
    
    setVariants([...updatedVariants, ...variantsToAdd]);
  };

  const updateVariant = (id: string, field: 'filename' | 'cct' | 'multiplier' | 'catalogNumber', value: string) => {
    if (!currentFile) return;
    
    const baseName = currentFile.fileName.replace(/\.(ies|IES)$/i, '');
    
    setVariants(variants.map(variant => {
      if (variant.id !== id) return variant;
      
      const updated = { ...variant };
      
      if (field === 'filename') {
        updated.filename = value;
      } else if (field === 'cct') {
        const cctValue = parseInt(value);
        if (!isNaN(cctValue) && cctValue > 0) {
          updated.cct = cctValue;
          // If no catalog number, regenerate default filename with uniqueness
          if (!updated.luminaireCatalogNumber || updated.luminaireCatalogNumber.trim() === '') {
            const baseFilename = `${baseName}_${cctValue}.ies`;
            updated.filename = generateUniqueFilename(baseFilename, variants, id);
          }
        }
      } else if (field === 'multiplier') {
        const multiplierValue = parseFloat(value);
        if (!isNaN(multiplierValue) && multiplierValue > 0) {
          updated.multiplier = multiplierValue;
          updated.previewLumens = currentFile.photometricData.totalLumens * multiplierValue;
        }
      } else if (field === 'catalogNumber') {
        // Set both lamp and luminaire catalog numbers to the same value
        updated.lampCatalogNumber = value;
        updated.luminaireCatalogNumber = value;
        // Auto-update filename if catalog number is provided
        if (value.trim() !== '') {
          const catalogFilename = value.endsWith('.ies') ? value : `${value}.ies`;
          updated.filename = generateUniqueFilename(catalogFilename, variants, id);
        } else {
          // If catalog number is cleared, regenerate default filename
          const baseFilename = `${baseName}_${updated.cct}.ies`;
          updated.filename = generateUniqueFilename(baseFilename, variants, id);
        }
      }
      
      return updated;
    }));
  };

  const removeVariant = (id: string) => {
    setVariants(variants.filter(v => v.id !== id));
  };

  const downloadVariants = async () => {
    if (!currentFile || variants.length === 0) return;
    
    setGenerating(true);
    try {
      // Merge current file with any edits
      const workingFile = Object.keys(editedData).length > 0
        ? { ...currentFile, metadata: { ...currentFile.metadata, ...editedData } }
        : currentFile;
      
      const zip = new JSZip();
      const usedFilenames = new Set<string>();
      
      for (const variant of variants) {
        let variantPhotometricData = { ...workingFile.photometricData };
        
        // Apply CCT multiplier
        if (variant.multiplier !== 1.0) {
          const scaled = photometricCalculator.scaleByCCT(variantPhotometricData, variant.multiplier);
          variantPhotometricData = scaled.scaledPhotometricData;
        }
        
        // Ensure unique filename in zip (safety check in case user manually edited to duplicate)
        let zipFilename = variant.filename;
        let counter = 1;
        while (usedFilenames.has(zipFilename.toLowerCase())) {
          const nameWithoutExt = variant.filename.replace(/\.(ies|IES)$/i, '');
          const ext = variant.filename.match(/\.(ies|IES)$/i)?.[0] || '.ies';
          zipFilename = `${nameWithoutExt}_${counter}${ext}`;
          counter++;
        }
        usedFilenames.add(zipFilename.toLowerCase());
        
        // Create variant file with updated photometric data
        const variantFile = {
          ...workingFile,
          fileName: zipFilename,
          photometricData: variantPhotometricData,
          metadata: {
            ...workingFile.metadata,
            colorTemperature: variant.cct,
            lampCatalogNumber: variant.lampCatalogNumber || workingFile.metadata.lampCatalogNumber,
            luminaireCatalogNumber: variant.luminaireCatalogNumber || workingFile.metadata.luminaireCatalogNumber
          }
        };
        
        const content = iesGenerator.generate(variantFile);
        zip.file(zipFilename, content);
      }
      
      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, 'ies_cct_variants.zip');
    } catch (error) {
      alert('Error generating files: ' + (error as Error).message);
    } finally {
      setGenerating(false);
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
      let parsedData = csvService.parseCSV(csvContent);
      // Fallback: allow rows without filename for CCT variants CSV
      if (parsedData.length === 0) {
        parsedData = parseCCTVariantsCSV(csvContent);
      }
      
      // Validate CSV data for CCT variants
      const validation = validateCCTCSV(parsedData);
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

  // Lenient CSV parser for CCT variants: accepts rows without filename
  const parseCCTVariantsCSV = (content: string): CSVRow[] => {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    const headers = smartSplitCSVLine(lines[0]).map(h => h.trim().toLowerCase());
    const mapHeader = (h: string): keyof CSVRow | null => {
      const key = h.replace(/\s+/g, ' ').trim();
      if (key === 'cct' || key === 'cct (k)' || key === 'colortemperature' || key === 'color temperature') return 'cct';
      if (key === 'multiplier' || key === 'cctmultiplier' || key === 'cct multiplier') return 'cctMultiplier';
      if (key === 'catalog number' || key === 'luminairecatalognumber' || key === 'lumcat') return 'luminaireCatalogNumber';
      if (key === 'filename' || key === 'file name') return 'filename';
      return null;
    };

    const mappedHeaders = headers.map(mapHeader);
    const rows: CSVRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = smartSplitCSVLine(lines[i]);
      const row: Partial<CSVRow> = {};
      mappedHeaders.forEach((mh, idx) => {
        if (!mh) return;
        if (idx < values.length) {
          row[mh] = values[idx].trim();
        }
      });
      // Accept row if it has at least CCT or Catalog Number
      if ((row.cct && row.cct !== '') || (row.luminaireCatalogNumber && row.luminaireCatalogNumber !== '') || (row.filename && row.filename !== '')) {
        rows.push(row as CSVRow);
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

  const validateCCTCSV = (rows: CSVRow[]): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (rows.length === 0) {
      errors.push('No data rows found');
      return { isValid: false, errors };
    }

    rows.forEach((row, index) => {
      if (!row.cct || row.cct.trim() === '') {
        errors.push(`Row ${index + 2}: Missing CCT value`);
      } else {
        const cct = parseFloat(row.cct);
        if (isNaN(cct) || cct <= 0) {
          errors.push(`Row ${index + 2}: Invalid CCT value "${row.cct}"`);
        }
      }

      // Check for multiplier (csvService maps 'multiplier' column to 'cctMultiplier')
      if (row.cctMultiplier && row.cctMultiplier.trim() !== '') {
        const multValue = parseFloat(row.cctMultiplier);
        if (isNaN(multValue) || multValue <= 0) {
          errors.push(`Row ${index + 2}: Invalid multiplier value "${row.cctMultiplier}"`);
        }
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  };

  const applyCSVData = () => {
    if (!currentFile) return;

    const baseName = currentFile.fileName.replace(/\.(ies|IES)$/i, '');
    const updatedVariants = [...variants];

    pendingCSVData.forEach((csvRow, index) => {
      const cct = parseFloat(csvRow.cct || '0');
      if (isNaN(cct) || cct <= 0) return;
      
      // Get multiplier from CSV (csvService maps 'multiplier' column to 'cctMultiplier')
      const multiplierStr = csvRow.cctMultiplier || '1.0';
      const multiplier = parseFloat(multiplierStr) || 1.0;
      const previewLumens = currentFile.photometricData.totalLumens * multiplier;

      // Get catalog number (csvService maps 'lumcat' -> 'luminaireCatalogNumber')
      // We use the same value for both luminaire and lamp catalog numbers
      const catalogNumber = csvRow.luminaireCatalogNumber || '';
      const luminaireCatalogNumber = catalogNumber;
      const lampCatalogNumber = catalogNumber;
      
      // Generate filename - prefer CSV filename, then catalog number, then default
      let filename = csvRow.filename || '';
      if (!filename && luminaireCatalogNumber) {
        filename = luminaireCatalogNumber.endsWith('.ies') 
          ? luminaireCatalogNumber 
          : `${luminaireCatalogNumber}.ies`;
      }
      
      // For default filenames (no CSV filename and no catalog number), ensure uniqueness
      if (!filename) {
        const baseFilename = `${baseName}_${cct}.ies`;
        filename = generateUniqueFilename(baseFilename, updatedVariants);
      } else {
        // Even if filename is provided, ensure it's unique
        filename = generateUniqueFilename(filename, updatedVariants);
      }

      const variantData: CCTVariant = {
        id: `${Date.now()}-${index}-${cct}`,
        filename,
        cct,
        multiplier,
        previewLumens,
        lampCatalogNumber,
        luminaireCatalogNumber
      };

      // Always add new variant (allow duplicate CCTs)
      updatedVariants.push(variantData);
    });

    setVariants(updatedVariants);
    setPendingCSVData([]);
  };

  const exportCSV = () => {
    const displayHeaders = ['CCT (K)', 'Catalog Number', 'Filename', 'Multiplier'];
    
    let csvContent = displayHeaders.join(',') + '\n';
    
    if (variants.length > 0) {
      const rows = variants.map(variant => [
        variant.cct.toString(),
        variant.luminaireCatalogNumber || '',
        variant.filename,
        variant.multiplier.toFixed(2)
      ]);
      
      csvContent += rows.map(row => 
        row.map(val => {
          // Escape commas and quotes
          if (val.includes(',') || val.includes('"') || val.includes('\n')) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        }).join(',')
      ).join('\n');
    }
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'cct_variants.csv');
  };

  const clearAll = () => {
    setVariants([]);
    setError(null);
    // Reload the page to reset the file
    window.location.reload();
  };

  if (!currentFile) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">CCT Batch Generator</h1>
            <p className="text-gray-600 mt-1">
              Generate multiple IES file variants with different CCT values and lumen multipliers
            </p>
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Upload a base IES file to generate variants with different CCT values.
              </p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload Base IES File</h2>
            <label className="block">
              <input
                type="file"
                accept=".ies,.IES"
                onChange={handleFileSelect}
                className="hidden"
                disabled={processing}
              />
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50'
                    : processing
                    ? 'border-gray-300 bg-gray-50'
                    : 'border-gray-300 hover:border-gray-400 cursor-pointer'
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
              >
                <Upload className={`w-12 h-12 mx-auto mb-4 ${processing ? 'text-gray-400' : 'text-gray-600'}`} />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {processing ? 'Processing file...' : 'Drop IES file here or click to upload'}
                </h3>
                <p className="text-sm text-gray-600">
                  This file will be used as the base for generating CCT variants
                </p>
              </div>
            </label>
          </div>

          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  const actionButtons = [
    {
      icon: <Plus className="w-4 h-4" />,
      label: 'Add Variant',
      onClick: () => setShowAddDialog(true),
      variant: 'secondary' as const,
      disabled: false
    },
    {
      icon: <Upload className="w-4 h-4" />,
      label: 'Upload CSV',
      onClick: () => document.getElementById('csv-upload')?.click(),
      variant: 'secondary' as const,
      disabled: !currentFile
    },
    {
      icon: <Download className="w-4 h-4" />,
      label: 'Export CSV',
      onClick: exportCSV,
      variant: 'secondary' as const,
      disabled: false
    },
    {
      icon: <Download className="w-4 h-4" />,
      label: 'Download Files',
      onClick: downloadVariants,
      variant: 'primary' as const,
      disabled: generating || variants.length === 0
    }
  ];

  const csvHeaders: (keyof CSVRow)[] = ['cct', 'luminaireCatalogNumber', 'filename', 'cctMultiplier'];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">CCT Batch Generator</h1>
        <p className="text-gray-600 mt-1">
          Generate multiple IES file variants with different CCT values and lumen multipliers
        </p>
        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
          <p className="text-sm text-blue-800">
            <strong>Base File:</strong> {currentFile.fileName} ({currentFile.photometricData.totalLumens.toFixed(0)} lumens)
            {Object.keys(editedData).length > 0 && <span className="ml-2">✓ Includes your edits</span>}
          </p>
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".ies,.IES"
              onChange={handleFileSelect}
              className="hidden"
            />
            <span className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-blue-700 bg-white border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors">
              <Upload className="w-3 h-3" />
              Change File
            </span>
          </label>
        </div>
      </div>

      {/* Hidden CSV Upload Input */}
      <input
        id="csv-upload"
        type="file"
        accept=".csv"
        onChange={handleCSVUpload}
        className="hidden"
      />

      {/* Action Bar */}
      {currentFile && (
        <BatchActionBar
          actions={actionButtons}
          onClear={clearAll}
          fileCount={variants.length}
        />
      )}

      {/* Variants Table */}
      {variants.length > 0 ? (
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">CCT Variants</h2>
            <p className="text-xs text-gray-500">Click cells to edit</p>
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    CCT (K)
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Catalog Number
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Output Filename
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Multiplier
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-blue-50 border-l-2 border-blue-300">
                    <div className="flex items-center gap-1">
                      <span>Preview Lumens</span>
                      <span className="text-blue-600">📊</span>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {variants.map((variant) => (
                  <tr key={variant.id}>
                    <td className="px-4 py-2">
                      {editingCell?.id === variant.id && editingCell?.field === 'cct' ? (
                        <input
                          type="number"
                          value={variant.cct}
                          onChange={(e) => updateVariant(variant.id, 'cct', e.target.value)}
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
                          onClick={() => setEditingCell({id: variant.id, field: 'cct'})}
                          className="px-2 py-1 min-h-[28px] cursor-pointer hover:bg-gray-50 rounded text-sm"
                        >
                          {variant.cct}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {editingCell?.id === variant.id && editingCell?.field === 'catalogNumber' ? (
                        <input
                          type="text"
                          value={variant.luminaireCatalogNumber}
                          onChange={(e) => updateVariant(variant.id, 'catalogNumber', e.target.value)}
                          onBlur={() => setEditingCell(null)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              setEditingCell(null);
                            }
                          }}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm font-mono"
                          autoFocus
                        />
                      ) : (
                        <div
                          onClick={() => setEditingCell({id: variant.id, field: 'catalogNumber'})}
                          className="px-2 py-1 min-h-[28px] cursor-pointer hover:bg-gray-50 rounded text-sm font-mono"
                        >
                          {variant.luminaireCatalogNumber || '-'}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {editingCell?.id === variant.id && editingCell?.field === 'filename' ? (
                        <input
                          type="text"
                          value={variant.filename}
                          onChange={(e) => updateVariant(variant.id, 'filename', e.target.value)}
                          onBlur={() => setEditingCell(null)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              setEditingCell(null);
                            }
                          }}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm font-mono"
                          autoFocus
                        />
                      ) : (
                        <div
                          onClick={() => setEditingCell({id: variant.id, field: 'filename'})}
                          className="px-2 py-1 min-h-[28px] cursor-pointer hover:bg-gray-50 rounded text-sm font-mono"
                        >
                          {variant.filename}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {editingCell?.id === variant.id && editingCell?.field === 'multiplier' ? (
                        <input
                          type="number"
                          step="0.01"
                          value={variant.multiplier}
                          onChange={(e) => updateVariant(variant.id, 'multiplier', e.target.value)}
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
                          onClick={() => setEditingCell({id: variant.id, field: 'multiplier'})}
                          className="px-2 py-1 min-h-[28px] cursor-pointer hover:bg-gray-50 rounded text-sm"
                        >
                          {variant.multiplier.toFixed(2)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900 bg-blue-50 border-l-2 border-blue-300">
                      {variant.previewLumens.toFixed(0)} lm
                    </td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => removeVariant(variant.id)}
                        className="text-red-600 hover:text-red-800 transition-colors"
                        title="Remove variant"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white p-12 rounded-lg shadow-sm text-center">
          <p className="text-gray-500 mb-4">No variants added yet</p>
          <button
            onClick={() => setShowAddDialog(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add Your First Variant
          </button>
        </div>
      )}

      {/* Add Variant Dialog */}
      <AddCCTVariantDialog
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onAdd={addVariant}
      />

      {/* CSV Preview Dialog */}
      <CSVPreviewDialog
        isOpen={showCSVPreview}
        onClose={() => {
          setShowCSVPreview(false);
          setPendingCSVData([]);
        }}
        onConfirm={applyCSVData}
        csvData={pendingCSVData}
        title="Preview CCT Variants CSV"
        headers={csvHeaders}
      />
    </div>
  );
}