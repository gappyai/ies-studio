import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText } from 'lucide-react';
import { useIESFileStore } from '../store/iesFileStore';
import { iesParser } from '../services/iesParser';
import { photometricCalculator } from '../services/calculator';

export function HomePage() {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { setCurrentFile, setCalculatedProperties } = useIESFileStore();

  const handleFile = async (file: File) => {
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
      navigate('/overview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse IES file');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-full p-8">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Welcome to IES Studio
          </h1>
          <p className="text-lg text-gray-600">
            Upload an IES photometric file to get started
          </p>
        </div>

        <div
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
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
          <Upload className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Drop your IES file here
          </h3>
          <p className="text-gray-600 mb-4">or</p>
          <label className="inline-block">
            <input
              type="file"
              accept=".ies,.IES"
              onChange={handleFileSelect}
              className="hidden"
            />
            <span className="px-6 py-3 bg-primary text-white rounded-lg cursor-pointer hover:bg-blue-600 transition-colors inline-block">
              Browse Files
            </span>
          </label>
          <p className="text-sm text-gray-500 mt-4">
            Supported formats: .ies, .IES
          </p>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <div className="mt-12 grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-white rounded-lg shadow-sm">
            <FileText className="w-8 h-8 mx-auto mb-2 text-primary" />
            <h4 className="font-semibold text-gray-900">View</h4>
            <p className="text-sm text-gray-600">Analyze photometric data</p>
          </div>
          <div className="text-center p-4 bg-white rounded-lg shadow-sm">
            <FileText className="w-8 h-8 mx-auto mb-2 text-primary" />
            <h4 className="font-semibold text-gray-900">Edit</h4>
            <p className="text-sm text-gray-600">Modify file properties</p>
          </div>
          <div className="text-center p-4 bg-white rounded-lg shadow-sm">
            <FileText className="w-8 h-8 mx-auto mb-2 text-primary" />
            <h4 className="font-semibold text-gray-900">Generate</h4>
            <p className="text-sm text-gray-600">Create batch variants</p>
          </div>
        </div>
      </div>
    </div>
  );
}