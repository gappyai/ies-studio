import { useState } from 'react';
import { Download, FileText, Folder } from 'lucide-react';
import { useIESFileStore } from '../store/iesFileStore';
import { iesGenerator } from '../services/iesGenerator';
import { photometricCalculator } from '../services/calculator';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface VariantConfig {
  length: number;
  cct: number;
  cctMultiplier: number;
  wattage?: number;
  name: string;
  folder: string;
  // Preview values
  previewWattage: number;
  previewLumens: number;
  previewEfficacy: number;
}

export function BatchGeneratorPage() {
  const { currentFile, editedData } = useIESFileStore();
  const [ccts, setCcts] = useState<string>('2700,3000,4000,5000,6500');
  const [cctMultipliers, setCctMultipliers] = useState<string>('0.88,0.92,1.0,1.05,1.12');
  const [lengths, setLengths] = useState<string>('0.5,1.0,1.5,2.0');
  const [wattages, setWattages] = useState<string>('');
  const [namingPattern, setNamingPattern] = useState('{base}_{cct}K_{length}m');
  const [productCodePattern, setProductCodePattern] = useState('RO40G{cct}{length}S');
  const [variants, setVariants] = useState<VariantConfig[]>([]);
  const [generating, setGenerating] = useState(false);
  const [useCCTMultiplier, setUseCCTMultiplier] = useState(true);
  const [useWattageScaling, setUseWattageScaling] = useState(false);

  if (!currentFile) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">No file loaded</p>
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
    const lengthArray = lengths.split(',').map(l => parseFloat(l.trim())).filter(l => !isNaN(l));
    const wattageArray = useWattageScaling && wattages
      ? wattages.split(',').map(w => parseFloat(w.trim())).filter(w => !isNaN(w))
      : [];
    
    // Ensure multipliers match CCTs count
    if (useCCTMultiplier && multiplierArray.length !== cctArray.length) {
      alert(`CCT count (${cctArray.length}) must match multiplier count (${multiplierArray.length})`);
      return;
    }
    
    for (let i = 0; i < cctArray.length; i++) {
      const cct = cctArray[i];
      const multiplier = multiplierArray[i] || 1.0;
      
      for (const lengthM of lengthArray) {
        // Calculate preview photometric values
        let previewData = { ...workingFile.photometricData };
        
        // Apply CCT multiplier
        if (useCCTMultiplier && multiplier !== 1.0) {
          const scaled = photometricCalculator.scaleByCCT(previewData, multiplier);
          previewData = scaled.scaledPhotometricData;
        }
        
        // Apply length scaling (convert m to mm for calculator)
        const lengthResult = photometricCalculator.scaleByLength(
          previewData,
          lengthM * 1000,
          workingFile.photometricData.unitsType
        );
        previewData = lengthResult.scaledPhotometricData;
        
        if (wattageArray.length > 0) {
          // If wattages specified, create variant for each wattage
          for (const wattage of wattageArray) {
            // Apply wattage scaling to preview
            const wattageResult = photometricCalculator.scaleByWattage(previewData, wattage);
            const finalPreviewData = wattageResult.scaledPhotometricData;
            
            const name = namingPattern
              .replace('{base}', baseName)
              .replace('{cct}', cct.toString())
              .replace('{length}', lengthM.toString())
              .replace('{wattage}', wattage.toString());
            
            const folder = `${cct}K/${lengthM}m/${wattage}W`;
            
            newVariants.push({
              length: lengthM,
              cct,
              cctMultiplier: multiplier,
              wattage,
              name: `${name}.ies`,
              folder,
              previewWattage: finalPreviewData.inputWatts,
              previewLumens: finalPreviewData.totalLumens,
              previewEfficacy: photometricCalculator.calculateEfficacy(
                finalPreviewData.totalLumens,
                finalPreviewData.inputWatts
              )
            });
          }
        } else {
          const name = namingPattern
            .replace('{base}', baseName)
            .replace('{cct}', cct.toString())
            .replace('{length}', lengthM.toString());
          
          const folder = `${cct}K/${lengthM}m`;
          
          newVariants.push({
            length: lengthM,
            cct,
            cctMultiplier: multiplier,
            name: `${name}.ies`,
            folder,
            previewWattage: previewData.inputWatts,
            previewLumens: previewData.totalLumens,
            previewEfficacy: photometricCalculator.calculateEfficacy(
              previewData.totalLumens,
              previewData.inputWatts
            )
          });
        }
      }
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
        
        // Apply length scaling (convert m to mm for calculator)
        const lengthResult = photometricCalculator.scaleByLength(
          variantPhotometricData,
          variant.length * 1000,
          workingFile.photometricData.unitsType
        );
        variantPhotometricData = lengthResult.scaledPhotometricData;
        
        // Apply wattage scaling if specified
        if (variant.wattage) {
          const wattageResult = photometricCalculator.scaleByWattage(variantPhotometricData, variant.wattage);
          variantPhotometricData = wattageResult.scaledPhotometricData;
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
            .replace('{cct}', Math.round(variant.cct / 100).toString())
            .replace('{length}', variant.length.toString())
            .replace('{wattage}', variant.wattage?.toString() || '');
          variantFile.metadata.luminaireCatalogNumber = productCode;
        }
        
        const content = iesGenerator.generate(variantFile);
        
        // Create folder structure in ZIP
        zip.folder(variant.folder)?.file(variant.name, content);
      }
      
      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, 'ies_variants_by_cct_length.zip');
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
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Batch Generator</h1>
      <p className="text-gray-600 mb-8">
        Generate multiple IES file variants organized by CCT and length
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Base File</h2>
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <FileText className="w-10 h-10 text-primary" />
              <div>
                <p className="font-medium text-gray-900">{currentFile.fileName}</p>
                <p className="text-sm text-gray-600">
                  {currentFile.photometricData.totalLumens.toFixed(0)} lumens (fixed)
                </p>
                {Object.keys(editedData).length > 0 && (
                  <p className="text-xs text-blue-600 mt-1">✓ Includes your edits</p>
                )}
              </div>
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
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Lengths (meters)</h2>
            <p className="text-sm text-gray-600 mb-3">Comma-separated lengths in meters</p>
            <input
              type="text"
              value={lengths}
              onChange={(e) => setLengths(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm"
              placeholder="0.5,1.0,1.5,2.0"
            />
            <p className="text-xs text-gray-500 mt-2">
              Example: 0.5,1.0,1.5,2.0
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Wattage Options (Type 3)</h2>
            <label className="flex items-center gap-2 text-sm text-gray-700 mb-2">
              <input
                type="checkbox"
                checked={useWattageScaling}
                onChange={(e) => setUseWattageScaling(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Generate Wattage Variants
            </label>
            
            {useWattageScaling && (
              <>
                <p className="text-sm text-gray-600 mb-2">Comma-separated wattage values</p>
                <input
                  type="text"
                  value={wattages}
                  onChange={(e) => setWattages(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm"
                  placeholder="30,40,50,60"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Example: 30,40,50,60
                </p>
              </>
            )}
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">File Naming</h2>
            <p className="text-sm text-gray-600 mb-3">
              Use {'{base}'}, {'{cct}'}, {'{length}'}, {'{wattage}'}
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
              Updates [LUMCAT] field. Use {'{cct}'}, {'{length}'}, {'{wattage}'}
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
                          <div className="text-gray-600">
                            <span className="font-medium">CCT:</span> {variant.cct}K
                            {variant.cctMultiplier !== 1.0 && (
                              <span className="text-blue-600 ml-1">(×{variant.cctMultiplier})</span>
                            )}
                          </div>
                          <div className="text-gray-600">
                            <span className="font-medium">Length:</span> {variant.length}m
                          </div>
                          <div className="text-gray-600">
                            <span className="font-medium">Power:</span> {variant.previewWattage.toFixed(1)}W
                          </div>
                          <div className="text-gray-600">
                            <span className="font-medium">Output:</span> {variant.previewLumens.toFixed(0)} lm
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