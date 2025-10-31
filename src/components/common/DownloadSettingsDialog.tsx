import { X } from 'lucide-react';

interface DownloadSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  useOriginalFilename: boolean;
  setUseOriginalFilename: (value: boolean) => void;
  catalogNumberSource: 'luminaire' | 'lamp';
  setCatalogNumberSource: (value: 'luminaire' | 'lamp') => void;
}

export function DownloadSettingsDialog({
  isOpen,
  onClose,
  useOriginalFilename,
  setUseOriginalFilename,
  catalogNumberSource,
  setCatalogNumberSource
}: DownloadSettingsDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Download Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Output Filename</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  checked={!useOriginalFilename}
                  onChange={() => setUseOriginalFilename(false)}
                  className="text-blue-600 focus:ring-blue-500"
                />
                Use Catalog Number (fallback to original if not available)
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  checked={useOriginalFilename}
                  onChange={() => setUseOriginalFilename(true)}
                  className="text-blue-600 focus:ring-blue-500"
                />
                Use Original Filename
              </label>
            </div>
            
            {!useOriginalFilename && (
              <div className="mt-4 ml-6 space-y-2">
                <p className="text-xs text-gray-600 mb-2">Which catalog number to use:</p>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    checked={catalogNumberSource === 'luminaire'}
                    onChange={() => setCatalogNumberSource('luminaire')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  Luminaire Catalog Number (preferred)
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    checked={catalogNumberSource === 'lamp'}
                    onChange={() => setCatalogNumberSource('lamp')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  Lamp Catalog Number (fallback)
                </label>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}