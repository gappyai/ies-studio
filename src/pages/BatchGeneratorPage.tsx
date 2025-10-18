import { useState } from 'react';
import { Download, FileText, Folder, Upload } from 'lucide-react';
import { useIESFileStore } from '../store/iesFileStore';
import { iesGenerator } from '../services/iesGenerator';
import { iesParser } from '../services/iesParser';
import { photometricCalculator } from '../services/calculator';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface VariantConfig {
  cct: number;
  cctMultiplier: number;
  name: string;
  folder: string;
  // Preview values
  previewLumens: number;
  previewWattage: number;
  previewEfficacy: number;
}

export function BatchGeneratorPage() {
  const { currentFile, editedData, setCurrentFile, setCalculatedProperties } = useIESFileStore();
  const [ccts, setCcts] = useState<string>('2700,3000,4000,5000,6500');
  const [cctMultipliers, setCctMultipliers] = useState<string>('0.88,0.92,1.0,1.05,1.12');
  const [namingPattern, setNamingPattern] = useState('{base}_{cct}K');
  const [productCodePattern, setProductCodePattern] = useState('RO40G{cct}');
  const [variants, setVariants] = useState<VariantConfig[]>([]);
  const [generating, setGenerating] = useState(false);
  const [useCCTMultiplier, setUseCCTMultiplier] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (file: File) => {
    setError(null);
    
    if (!file.name.toLowerCase().endsWith('.ies')) {
      setError('Please select a valid .ies file');
      return;
    }

    try {
      const content = await file.text();
      const parsedFile = iesParser.parse(content, file.name, file.size);
      const calculated = photometricCalculator.calculateProperties(parsedFile.photometricData);
      
      setCurrentFile(parsedFile);
      setCalculatedProperties(calculated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse IES file');
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

  if (!currentFile) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              CCT Batch Generator
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Generate multiple IES file variants with different CCT values
            </p>
            
            {/* Primary File Selection Button */}
            <div className="mb-8">
              <label className="inline-block">
                <input
                  type="file"
                  accept=".ies,.IES"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <span className="px-8 py-4 bg-primary text-white rounded-lg cursor-pointer hover:bg-blue-600 transition-colors inline-flex items-center gap-3 text-lg font-medium">
                  <Upload className="w-6 h-6" />
                  Select Base IES File
                </span>
              </label>
            </div>

            {/* Drag and Drop Area */}
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors max-w-2xl mx-auto ${
                isDragging
                  ? 'border-primary bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Or drop your base IES file here
              </h3>
              <p className="text-sm text-gray-600">
                This file will be used as the template for generating variants
              </p>
            </div>
          </div>

          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 max-w-2xl mx-auto">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Merge current file with any edits
  const workingFile = Object.keys(editedData).length > 0
    ? { ...currentFile, metadata: { ...currentFile.metadata, ...editedData } }
    : currentFile;

  const generateVariants = () => {
    const newVariants: VariantConfig[] = [];
    const baseName = currentFile.fileName.replace(/\.(ies|IES)$/i, '');
    
    const cctArray = ccts.split(',').map(c => parseInt(c.trim())).filter(c => !isNaN(c));
    const multiplierArray = useCCTMultiplier
      ? cctMultipliers.split(',').map(m => parseFloat(m.trim())).filter(m => !isNaN(m))
      : cctArray.map(() => 1.0);
    
    // Ensure multipliers match CCTs count
    if (useCCTMultiplier && multiplierArray.length !== cctArray.length) {
      alert(`CCT count (${cctArray.length}) must match multiplier count (${multiplierArray.length})`);
      return;
    }
    
    for (let i = 0; i < cctArray.length; i++) {
      const cct = cctArray[i];
      const multiplier = multiplierArray[i] || 1.0;
      
      // Calculate preview photometric values
      let previewData = { ...workingFile.photometricData };
      
      // Apply CCT multiplier
      if (useCCTMultiplier && multiplier !== 1.0) {
        const scaled = photometricCalculator.scaleByCCT(previewData, multiplier);
        previewData = scaled.scaledPhotometricData;
      }
      
      const name = namingPattern
        .replace('{base}', baseName)
        .replace('{cct}', cct.toString());
      
      const folder = `${cct}K`;
      
      newVariants.push({
        cct,
        cctMultiplier: multiplier,
        name: `${name}.ies`,
        folder,
        previewLumens: previewData.totalLumens,
        previewWattage: previewData.inputWatts,
        previewEfficacy: photometricCalculator.calculateEfficacy(
          previewData.totalLumens,
          previewData.inputWatts
        )
      });
    }
    
    setVariants(newVariants);
  };

  const downloadVariants = async () => {
    setGenerating(true);
    try {
      const zip = new JSZip();
      
      for (const variant of variants) {
        let variantPhotometricData = { ...workingFile.photometricData };
        
        // Apply CCT multiplier if enabled
        if (useCCTMultiplier && variant.cctMultiplier !== 1.0) {
          const scaled = photometricCalculator.scaleByCCT(variantPhotometricData, variant.cctMultiplier);
          variantPhotometricData = scaled.scaledPhotometricData;
        }
        
        // Create variant file with updated photometric data
        const variantFile = {
          ...workingFile,
          fileName: variant.name,
          photometricData: variantPhotometricData,
          metadata: {
            ...workingFile.metadata,
            colorTemperature: variant.cct
          }
        };
        
        // Update product code if pattern provided
        if (productCodePattern) {
          const productCode = productCodePattern
            .replace('{cct}', Math.round(variant.cct / 100).toString());
          variantFile.metadata.luminaireCatalogNumber = productCode;
        }
        
        const content = iesGenerator.generate(variantFile);
        
        // Create folder structure in ZIP
        zip.folder(variant.folder)?.file(variant.name, content);
      }
      
      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, 'ies_variants_by_cct.zip');
    } catch (error) {
      alert('Error generating files: ' + (error as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  // Group variants by folder for preview
  const variantsByFolder = variants.reduce((acc, variant) => {
    if (!acc[variant.folder]) {
      acc[variant.folder] = [];
    }
    acc[variant.folder].push(variant);
    return acc;
  }, {} as Record<string, VariantConfig[]>);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">CCT Batch Generator</h1>
      <p className="text-gray-600 mb-8">
        Generate multiple IES file variants with different CCT values and optional lumen multipliers
      </p>
      <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg max-w-4xl">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> This tool generates variants with different CCT values only.
          For length scaling, use the Batch Length Editor. For wattage changes, use the Batch Wattage Editor.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Base File</h2>
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <FileText className="w-10 h-10 text-primary" />
              <div className="flex-1">
                <p className="font-medium text-gray-900">{currentFile.fileName}</p>
                <p className="text-sm text-gray-600">
                  {currentFile.photometricData.totalLumens.toFixed(0)} lumens (fixed)
                </p>
                {Object.keys(editedData).length > 0 && (
                  <p className="text-xs text-blue-600 mt-1">✓ Includes your edits</p>
                )}
              </div>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".ies,.IES"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <span className="text-xs text-blue-600 hover:text-blue-800 underline whitespace-nowrap">
                  Change File
                </span>
              </label>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">CCT Values (Kelvin)</h2>
            <p className="text-sm text-gray-600 mb-3">Comma-separated color temperatures</p>
            <input
              type="text"
              value={ccts}
              onChange={(e) => setCcts(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm"
              placeholder="2700,3000,4000,5000,6500"
            />
            <p className="text-xs text-gray-500 mt-2">
              Example: 2700,3000,4000,5000,6500
            </p>
            
            <div className="mt-4">
              <label className="flex items-center gap-2 text-sm text-gray-700 mb-2">
                <input
                  type="checkbox"
                  checked={useCCTMultiplier}
                  onChange={(e) => setUseCCTMultiplier(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Apply CCT Multipliers (Type 2)
              </label>
              
              {useCCTMultiplier && (
                <>
                  <p className="text-sm text-gray-600 mb-2">Lumen multipliers (must match CCT count)</p>
                  <input
                    type="text"
                    value={cctMultipliers}
                    onChange={(e) => setCctMultipliers(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm"
                    placeholder="0.88,0.92,1.0,1.05,1.12"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Lower CCT = lower multiplier (e.g., 3000K = 0.92)
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">File Naming</h2>
            <p className="text-sm text-gray-600 mb-3">
              Use {'{base}'} and {'{cct}'}
            </p>
            <input
              type="text"
              value={namingPattern}
              onChange={(e) => setNamingPattern(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm mb-4"
              placeholder="e.g., {base}_{cct}K_{length}mm"
            />
            
            <label className="block text-sm font-medium text-gray-700 mb-1 mt-4">
              Product Code Pattern (optional)
            </label>
            <p className="text-xs text-gray-600 mb-2">
              Updates [LUMCAT] field. Use {'{cct}'}
            </p>
            <input
              type="text"
              value={productCodePattern}
              onChange={(e) => setProductCodePattern(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm"
              placeholder="e.g., RO40G{cct}{length}S"
            />
          </div>

          <button
            onClick={generateVariants}
            className="w-full px-6 py-3 bg-primary text-white rounded-lg hover:bg-blue-600 font-medium"
          >
            Generate Preview
          </button>
        </div>

        {/* Preview */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Preview ({variants.length} files)
            </h2>
            {variants.length > 0 && (
              <button
                onClick={downloadVariants}
                disabled={generating}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                {generating ? 'Generating...' : 'Download ZIP'}
              </button>
            )}
          </div>

          {variants.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileText className="w-16 h-16 mx-auto mb-3 opacity-50" />
              <p>Configure parameters and click "Generate Preview"</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[700px] overflow-y-auto">
              {Object.entries(variantsByFolder).map(([folder, folderVariants]) => (
                <div key={folder} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-4 py-2 flex items-center gap-2">
                    <Folder className="w-4 h-4 text-gray-600" />
                    <span className="font-medium text-gray-900">{folder}/</span>
                    <span className="text-sm text-gray-600">({folderVariants.length} files)</span>
                  </div>
                  <div className="p-2 space-y-1">
                    {folderVariants.map((variant, index) => (
                      <div
                        key={index}
                        className="p-3 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2 flex-1">
                            <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span className="font-mono text-xs text-gray-900 truncate">
                              {variant.name}
                            </span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs ml-6">
                          <div className="text-gray-600 col-span-2">
                            <span className="font-medium">CCT:</span> {variant.cct}K
                            {variant.cctMultiplier !== 1.0 && (
                              <span className="text-blue-600 ml-1">(Multiplier: ×{variant.cctMultiplier})</span>
                            )}
                          </div>
                          <div className="text-gray-600">
                            <span className="font-medium">Output:</span> {variant.previewLumens.toFixed(0)} lm
                          </div>
                          <div className="text-gray-600">
                            <span className="font-medium">Power:</span> {variant.previewWattage.toFixed(1)}W
                          </div>
                          <div className="text-gray-600 col-span-2">
                            <span className="font-medium">Efficacy:</span> {variant.previewEfficacy.toFixed(1)} lm/W
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}