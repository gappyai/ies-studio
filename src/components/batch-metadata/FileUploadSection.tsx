import { Upload } from 'lucide-react';

interface FileUploadSectionProps {
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  processing: boolean;
}

export function FileUploadSection({ onFileUpload, processing }: FileUploadSectionProps) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload IES Files</h2>
      <label className="block">
        <input
          type="file"
          multiple
          accept=".ies,.IES"
          onChange={onFileUpload}
          className="hidden"
          disabled={processing}
        />
        <div className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          processing ? 'border-gray-300 bg-gray-50' : 'border-gray-300 hover:border-gray-400 cursor-pointer'
        }`}>
          <Upload className={`w-12 h-12 mx-auto mb-4 ${processing ? 'text-gray-400' : 'text-gray-600'}`} />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {processing ? 'Processing files...' : 'Drop IES files here or click to upload'}
          </h3>
          <p className="text-sm text-gray-600">
            Supports up to 1000 files. Upload multiple IES files for batch processing.
          </p>
        </div>
      </label>
    </div>
  );
}

