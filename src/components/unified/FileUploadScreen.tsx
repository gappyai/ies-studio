import { Upload, FileText, Settings, Grid, BarChart3 } from 'lucide-react';

interface FileUploadScreenProps {
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (e: React.DragEvent) => void;
  isDragging: boolean;
  setIsDragging: (dragging: boolean) => void;
  error: string | null;
}

export function FileUploadScreen({
  onFileSelect,
  onDrop,
  isDragging,
  setIsDragging,
  error
}: FileUploadScreenProps) {
  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            IES Studio
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Professional IES file editing and batch processing tool
          </p>
          
          {/* Primary File Selection Button */}
          <div className="mb-8">
            <label className="inline-block">
              <input
                type="file"
                accept=".ies,.IES"
                onChange={onFileSelect}
                className="hidden"
              />
              <span className="px-8 py-4 bg-primary text-white rounded-lg cursor-pointer hover:bg-blue-600 transition-colors inline-flex items-center gap-3 text-lg font-medium">
                <Upload className="w-6 h-6" />
                Select IES File
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
            onDrop={onDrop}
          >
            <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Or drop your IES file here
            </h3>
            <p className="text-sm text-gray-600">
              Supports .ies and .IES formats
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 max-w-2xl mx-auto">
            {error}
          </div>
        )}

        {/* Feature Cards */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="text-center p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <FileText className="w-10 h-10 mx-auto mb-3 text-primary" />
            <h4 className="font-semibold text-gray-900 mb-2">View & Edit</h4>
            <p className="text-sm text-gray-600">Analyze photometric data and edit metadata</p>
          </div>
          <div className="text-center p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <Settings className="w-10 h-10 mx-auto mb-3 text-primary" />
            <h4 className="font-semibold text-gray-900 mb-2">Batch Process</h4>
            <p className="text-sm text-gray-600">Update metadata for multiple files at once</p>
          </div>
          <div className="text-center p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <Grid className="w-10 h-10 mx-auto mb-3 text-primary" />
            <h4 className="font-semibold text-gray-900 mb-2">Generate Variants</h4>
            <p className="text-sm text-gray-600">Create multiple IES file variants</p>
          </div>
          <div className="text-center p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <BarChart3 className="w-10 h-10 mx-auto mb-3 text-primary" />
            <h4 className="font-semibold text-gray-900 mb-2">Visualize</h4>
            <p className="text-sm text-gray-600">Charts and 3D photometric visualization</p>
          </div>
        </div>
      </div>
    </div>
  );
}