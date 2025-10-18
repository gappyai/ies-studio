import { Save, RotateCcw, Download, Edit3, Eye, FileText, BarChart3, Box } from 'lucide-react';

interface FileHeaderProps {
  fileName: string;
  activeTab: 'overview' | 'edit' | 'charts' | '3d';
  isDirty: boolean;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onTabChange: (tab: 'overview' | 'edit' | 'charts' | '3d') => void;
  onDownload: () => void;
  onSave: () => void;
  onReset: () => void;
}

export function FileHeader({
  fileName,
  activeTab,
  isDirty,
  onFileSelect,
  onTabChange,
  onDownload,
  onSave,
  onReset
}: FileHeaderProps) {
  return (
    <>
      {/* Header with File Info and Actions */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold text-gray-900">IES Studio</h1>
          {/* File Selection Widget */}
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
            <FileText className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-800">{fileName}</span>
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".ies,.IES"
                onChange={onFileSelect}
                className="hidden"
              />
              <span className="text-xs text-blue-600 hover:text-blue-800 underline ml-2">
                Change File
              </span>
            </label>
          </div>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={onDownload}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
          {activeTab === 'edit' && (
            <>
              <button
                onClick={onReset}
                disabled={!isDirty}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
              <button
                onClick={onSave}
                disabled={!isDirty}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => onTabChange('overview')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
            activeTab === 'overview'
              ? 'border-primary text-primary font-medium'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <Eye className="w-4 h-4" />
          Overview
        </button>
        <button
          onClick={() => onTabChange('edit')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
            activeTab === 'edit'
              ? 'border-primary text-primary font-medium'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <Edit3 className="w-4 h-4" />
          Edit
        </button>
        <button
          onClick={() => onTabChange('charts')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
            activeTab === 'charts'
              ? 'border-primary text-primary font-medium'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Charts
        </button>
        <button
          onClick={() => onTabChange('3d')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
            activeTab === '3d'
              ? 'border-primary text-primary font-medium'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <Box className="w-4 h-4" />
          3D View
        </button>
      </div>
    </>
  );
}