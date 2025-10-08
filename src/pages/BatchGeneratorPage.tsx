import { useState } from 'react';
import { Download, FileText, Folder } from 'lucide-react';
import { useIESFileStore } from '../store/iesFileStore';
import { iesGenerator } from '../services/iesGenerator';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface VariantConfig {
  length: number;
  cct: number;
  name: string;
  folder: string;
}

export function BatchGeneratorPage() {
  const { currentFile, editedData } = useIESFileStore();
  const [ccts, setCcts] = useState<string>('2700,3000,4000,5000,6500');
  const [lengths, setLengths] = useState<string>('500,1000,1500,2000');
  const [namingPattern, setNamingPattern] = useState('{base}_{cct}K_{length}mm');
  const [productCodePattern, setProductCodePattern] = useState('RO40G{cct}{length}S');
  const [variants, setVariants] = useState<VariantConfig[]>([]);
  const [generating, setGenerating] = useState(false);

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
    const lengthArray = lengths.split(',').map(l => parseInt(l.trim())).filter(l => !isNaN(l));
    
    for (const cct of cctArray) {
      for (const length of lengthArray) {
        const name = namingPattern
          .replace('{base}', baseName)
          .replace('{cct}', cct.toString())
          .replace('{length}', length.toString());
        
        const folder = `${cct}K/${length}mm`;
        
        newVariants.push({
          length,
          cct,
          name: `${name}.ies`,
          folder,
        });
      }
    }
    
    setVariants(newVariants);
  };

  const downloadVariants = async () => {
    setGenerating(true);
    try {
      const zip = new JSZip();
      
      for (const variant of variants) {
        // Convert length from mm to meters for IES file WIDTH field (width = LED strip length)
        const lengthInMeters = variant.length / 1000;
        
        const variantFile = iesGenerator.generateVariant(
          workingFile,
          workingFile.photometricData.totalLumens, // Keep original lumens
          {
            width: lengthInMeters,  // Width field represents LED strip length
            length: workingFile.photometricData.length,
            height: workingFile.photometricData.height
          },
          variant.name,
          variant.cct
        );
        
        // Update product code if pattern provided
        if (productCodePattern) {
          const productCode = productCodePattern
            .replace('{cct}', Math.round(variant.cct / 100).toString())
            .replace('{length}', variant.length.toString());
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
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Lengths (mm)</h2>
            <p className="text-sm text-gray-600 mb-3">Comma-separated lengths in millimeters</p>
            <input
              type="text"
              value={lengths}
              onChange={(e) => setLengths(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-sm"
              placeholder="500,1000,1500,2000"
            />
            <p className="text-xs text-gray-500 mt-2">
              Example: 500,1000,1500,2000
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">File Naming</h2>
            <p className="text-sm text-gray-600 mb-3">
              Use {'{base}'}, {'{cct}'}, {'{length}'}
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
              Updates [LUMCAT] field. Use {'{cct}'}, {'{length}'}
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
                        className="flex justify-between items-center p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-2 flex-1">
                          <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="font-mono text-xs text-gray-900 truncate">
                            {variant.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-600">
                          <span>{variant.cct}K</span>
                          <span>{variant.length}mm</span>
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