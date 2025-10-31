import { useState } from 'react';
import { Download, Upload, Plus, Trash2 } from 'lucide-react';
import { useIESFileStore } from '../store/iesFileStore';
import { iesGenerator } from '../services/iesGenerator';
import { iesParser } from '../services/iesParser';
import { photometricCalculator } from '../services/calculator';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { BatchActionBar } from '../components/common/BatchActionBar';
import { AddCCTVariantDialog } from '../components/common/AddCCTVariantDialog';

interface CCTVariant {
  id: string;
  filename: string;
  cct: number;
  multiplier: number;
  previewLumens: number;
}

export function BatchGeneratorPage() {
  const { currentFile, editedData, setCurrentFile, setCalculatedProperties } = useIESFileStore();
  const [variants, setVariants] = useState<CCTVariant[]>([]);
  const [generating, setGenerating] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingCell, setEditingCell] = useState<{id: string, field: 'filename' | 'cct' | 'multiplier'} | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

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
      
      // Auto-generate default variants
      const baseName = file.name.replace(/\.(ies|IES)$/i, '');
      const defaultCCTs = [2700, 3000, 4000, 5000, 6500];
      const defaultMultipliers = [0.88, 0.92, 1.0, 1.05, 1.12];
      
      const defaultVariants: CCTVariant[] = defaultCCTs.map((cct, index) => {
        const multiplier = defaultMultipliers[index];
        const previewLumens = parsedFile.photometricData.totalLumens * multiplier;
        
        return {
          id: `${Date.now()}-${index}`,
          filename: `${baseName}_${cct}.ies`,
          cct,
          multiplier,
          previewLumens
        };
      });
      
      setVariants(defaultVariants);
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

  const addVariant = (cct: number, multiplier: number) => {
    if (!currentFile) return;
    
    const baseName = currentFile.fileName.replace(/\.(ies|IES)$/i, '');
    const previewLumens = currentFile.photometricData.totalLumens * multiplier;
    
    const newVariant: CCTVariant = {
      id: `${Date.now()}`,
      filename: `${baseName}_${cct}.ies`,
      cct,
      multiplier,
      previewLumens
    };
    
    setVariants([...variants, newVariant]);
  };

  const updateVariant = (id: string, field: 'filename' | 'cct' | 'multiplier', value: string) => {
    if (!currentFile) return;
    
    setVariants(variants.map(variant => {
      if (variant.id !== id) return variant;
      
      const updated = { ...variant };
      
      if (field === 'filename') {
        updated.filename = value;
      } else if (field === 'cct') {
        const cctValue = parseInt(value);
        if (!isNaN(cctValue) && cctValue > 0) {
          updated.cct = cctValue;
        }
      } else if (field === 'multiplier') {
        const multiplierValue = parseFloat(value);
        if (!isNaN(multiplierValue) && multiplierValue > 0) {
          updated.multiplier = multiplierValue;
          updated.previewLumens = currentFile.photometricData.totalLumens * multiplierValue;
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
      
      for (const variant of variants) {
        let variantPhotometricData = { ...workingFile.photometricData };
        
        // Apply CCT multiplier
        if (variant.multiplier !== 1.0) {
          const scaled = photometricCalculator.scaleByCCT(variantPhotometricData, variant.multiplier);
          variantPhotometricData = scaled.scaledPhotometricData;
        }
        
        // Create variant file with updated photometric data
        const variantFile = {
          ...workingFile,
          fileName: variant.filename,
          photometricData: variantPhotometricData,
          metadata: {
            ...workingFile.metadata,
            colorTemperature: variant.cct
          }
        };
        
        const content = iesGenerator.generate(variantFile);
        zip.file(variant.filename, content);
      }
      
      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, 'ies_cct_variants.zip');
    } catch (error) {
      alert('Error generating files: ' + (error as Error).message);
    } finally {
      setGenerating(false);
    }
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
      icon: <Download className="w-4 h-4" />,
      label: 'Download Files',
      onClick: downloadVariants,
      variant: 'primary' as const,
      disabled: generating || variants.length === 0
    }
  ];

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

      {/* Action Bar */}
      {variants.length > 0 && (
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
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Output Filename
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    CCT (K)
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
    </div>
  );
}