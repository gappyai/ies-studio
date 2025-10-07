import { useState, useEffect } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { useIESFileStore } from '../store/iesFileStore';
import type { IESMetadata, PhotometricData } from '../types/ies.types';

export function EditPage() {
  const {
    currentFile,
    editedData,
    editedPhotometricData,
    updateMetadata,
    updatePhotometricData,
    applyEdits,
    resetEdits,
    isDirty
  } = useIESFileStore();
  const [localData, setLocalData] = useState<Partial<IESMetadata>>({});
  const [localPhotometricData, setLocalPhotometricData] = useState<Partial<PhotometricData>>({});

  useEffect(() => {
    if (currentFile) {
      setLocalData({ ...currentFile.metadata, ...editedData });
      setLocalPhotometricData({ ...currentFile.photometricData, ...editedPhotometricData });
    }
  }, [currentFile, editedData, editedPhotometricData]);

  if (!currentFile) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">No file loaded</p>
      </div>
    );
  }

  const handleChange = (key: keyof IESMetadata, value: any) => {
    setLocalData(prev => ({ ...prev, [key]: value }));
    updateMetadata(key, value);
  };

  const handlePhotometricChange = (key: keyof PhotometricData, value: any) => {
    setLocalPhotometricData(prev => ({ ...prev, [key]: value }));
    updatePhotometricData(key, value);
  };

  const handleSave = () => {
    applyEdits();
    alert('Changes saved successfully! Your edits will be applied to exports and batch generation.');
  };

  const handleReset = () => {
    resetEdits();
    setLocalData(currentFile.metadata);
    setLocalPhotometricData(currentFile.photometricData);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Edit Luminaire</h1>
        <div className="flex gap-3">
          <button
            onClick={handleReset}
            disabled={!isDirty}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={!isDirty}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Luminaire Information */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Test Information</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Test
                </label>
                <input
                  type="text"
                  value={localData.test || ''}
                  onChange={(e) => handleChange('test', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Test Lab
                </label>
                <input
                  type="text"
                  value={localData.testLab || ''}
                  onChange={(e) => handleChange('testLab', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Test Date
                </label>
                <input
                  type="text"
                  value={localData.testDate || ''}
                  onChange={(e) => handleChange('testDate', e.target.value)}
                  placeholder="MM/DD/YYYY"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Issue Date
                </label>
                <input
                  type="text"
                  value={localData.issueDate || ''}
                  onChange={(e) => handleChange('issueDate', e.target.value)}
                  placeholder="MM/DD/YYYY HH:MM:SS"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lamp Position
                </label>
                <input
                  type="text"
                  value={localData.lampPosition || ''}
                  onChange={(e) => handleChange('lampPosition', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Other
                </label>
                <input
                  type="text"
                  value={localData.other || ''}
                  onChange={(e) => handleChange('other', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Luminaire Information</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Manufacturer
                </label>
                <input
                  type="text"
                  value={localData.manufacturer || ''}
                  onChange={(e) => handleChange('manufacturer', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Luminaire Description
                </label>
                <input
                  type="text"
                  value={localData.luminaireDescription || ''}
                  onChange={(e) => handleChange('luminaireDescription', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Luminaire Catalog Number
                </label>
                <input
                  type="text"
                  value={localData.luminaireCatalogNumber || ''}
                  onChange={(e) => handleChange('luminaireCatalogNumber', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lamp Catalog Number
                </label>
                <input
                  type="text"
                  value={localData.lampCatalogNumber || ''}
                  onChange={(e) => handleChange('lampCatalogNumber', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ballast Description
                </label>
                <input
                  type="text"
                  value={localData.ballastDescription || ''}
                  onChange={(e) => handleChange('ballastDescription', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ballast Catalog Number
                </label>
                <input
                  type="text"
                  value={localData.ballastCatalogNumber || ''}
                  onChange={(e) => handleChange('ballastCatalogNumber', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Photometric Properties</h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Color Temperature (K)
                  </label>
                  <input
                    type="number"
                    value={localData.colorTemperature || ''}
                    onChange={(e) => handleChange('colorTemperature', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    CRI
                  </label>
                  <input
                    type="number"
                    value={localData.colorRenderingIndex || ''}
                    onChange={(e) => handleChange('colorRenderingIndex', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    min="0"
                    max="100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Input Watts
                </label>
                <input
                  type="number"
                  value={localPhotometricData.inputWatts || ''}
                  onChange={(e) => handlePhotometricChange('inputWatts', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  min="0"
                  step="0.1"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Dimensions */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Luminous Dimensions</h2>
            <p className="text-sm text-gray-600 mb-4">The size of the light-emitting area (in meters)</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Width (m)
                </label>
                <input
                  type="number"
                  value={localPhotometricData.width ?? currentFile?.photometricData.width ?? 0}
                  onChange={(e) => handlePhotometricChange('width', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  step="0.01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Length (m)
                </label>
                <input
                  type="number"
                  value={localPhotometricData.length ?? currentFile?.photometricData.length ?? 0}
                  onChange={(e) => handlePhotometricChange('length', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  step="0.01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Height (m)
                </label>
                <input
                  type="number"
                  value={localPhotometricData.height ?? currentFile?.photometricData.height ?? 0}
                  onChange={(e) => handlePhotometricChange('height', parseFloat(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  step="0.01"
                />
              </div>
            </div>
          </div>


          {isDirty && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Unsaved changes:</strong> Click "Save Changes" to apply your edits.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}