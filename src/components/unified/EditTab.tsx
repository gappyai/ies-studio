import type { IESFileData, IESMetadata, PhotometricData } from '../../types/ies.types';
import { IntegratedPhotometricEditor } from '../common/IntegratedPhotometricEditor';

interface EditTabProps {
  currentFile: IESFileData;
  localData: Partial<IESMetadata>;
  localPhotometricData: Partial<PhotometricData>;
  isDirty: boolean;
  onMetadataChange: (key: keyof IESMetadata, value: any) => void;
  onPhotometricChange: (key: keyof PhotometricData, value: any) => void;
  onBulkPhotometricUpdate: (updates: Partial<PhotometricData>) => void;
  onToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
}

export function EditTab({
  currentFile,
  localData,
  localPhotometricData,
  isDirty,
  onMetadataChange,
  onPhotometricChange,
  onBulkPhotometricUpdate,
  onToast
}: EditTabProps) {
  return (
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
                onChange={(e) => onMetadataChange('test', e.target.value)}
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
                onChange={(e) => onMetadataChange('testLab', e.target.value)}
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
                onChange={(e) => onMetadataChange('testDate', e.target.value)}
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
                onChange={(e) => onMetadataChange('issueDate', e.target.value)}
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
                onChange={(e) => onMetadataChange('lampPosition', e.target.value)}
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
                onChange={(e) => onMetadataChange('other', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Near Field Type
              </label>
              <select
                value={localData.nearField || ''}
                onChange={(e) => onMetadataChange('nearField', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="">None</option>
                <option value="1">1 - Point Source</option>
                <option value="2">2 - Linear Source</option>
                <option value="3">3 - Rectangular/Area Source</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Dimensions will be automatically used from the photometric data
              </p>
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
                onChange={(e) => onMetadataChange('manufacturer', e.target.value)}
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
                onChange={(e) => onMetadataChange('luminaireDescription', e.target.value)}
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
                onChange={(e) => onMetadataChange('luminaireCatalogNumber', e.target.value)}
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
                onChange={(e) => onMetadataChange('lampCatalogNumber', e.target.value)}
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
                onChange={(e) => onMetadataChange('ballastDescription', e.target.value)}
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
                onChange={(e) => onMetadataChange('ballastCatalogNumber', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Light Properties</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CRI (Color Rendering Index)
              </label>
              <input
                type="number"
                value={localData.colorRenderingIndex || ''}
                onChange={(e) => onMetadataChange('colorRenderingIndex', parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                min="0"
                max="100"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Right Column - Integrated Photometric Editor */}
      <div className="space-y-6">
        <IntegratedPhotometricEditor
          currentPhotometricData={{ ...currentFile.photometricData, ...localPhotometricData }}
          originalColorTemperature={currentFile.metadata.colorTemperature}
          onPhotometricUpdate={onPhotometricChange}
          onBulkUpdate={onBulkPhotometricUpdate}
          onCCTUpdate={(cct) => onMetadataChange('colorTemperature', cct)}
          onToast={onToast}
        />

        {isDirty && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Unsaved changes:</strong> Click "Save Changes" to apply your edits.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}