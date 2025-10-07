import { Download, Copy, FileText } from 'lucide-react';
import { useState } from 'react';
import { useIESFileStore } from '../store/iesFileStore';
import { iesGenerator } from '../services/iesGenerator';
import { saveAs } from 'file-saver';

export function ExportPage() {
  const { currentFile, editedData, isDirty } = useIESFileStore();
  const [copied, setCopied] = useState(false);

  if (!currentFile) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">No file loaded</p>
      </div>
    );
  }

  // Use current file (which includes saved edits)
  const iesContent = iesGenerator.generate(currentFile);

  const handleDownloadEdited = () => {
    const blob = new Blob([iesContent], { type: 'text/plain;charset=utf-8' });
    const filename = currentFile.fileName.replace(/\.(ies|IES)$/, '_edited.ies');
    saveAs(blob, filename);
  };

  const handleDownloadOriginal = () => {
    const blob = new Blob([currentFile.rawContent], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, currentFile.fileName);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(iesContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      alert('Failed to copy to clipboard');
    }
  };

  const hasUnsavedEdits = isDirty && Object.keys(editedData).length > 0;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Export</h1>
      <p className="text-gray-600 mb-8">
        Download your IES file or copy the content
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Download Options */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Download Options</h2>
          
          <div className="space-y-4">
            <button
              onClick={handleDownloadEdited}
              className="w-full flex items-center justify-between p-4 border-2 border-primary rounded-lg hover:bg-blue-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Download className="w-6 h-6 text-primary" />
                <div className="text-left">
                  <p className="font-semibold text-gray-900">Download Current Version</p>
                  <p className="text-sm text-gray-600">
                    Includes all saved changes
                  </p>
                </div>
              </div>
              <FileText className="w-5 h-5 text-gray-400" />
            </button>

            <button
              onClick={handleCopy}
              className="w-full flex items-center justify-between p-4 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Copy className="w-6 h-6 text-gray-600" />
                <div className="text-left">
                  <p className="font-semibold text-gray-900">Copy to Clipboard</p>
                  <p className="text-sm text-gray-600">
                    Copy IES content as text
                  </p>
                </div>
              </div>
              {copied && (
                <span className="text-sm font-medium text-green-600">Copied!</span>
              )}
            </button>
          </div>

          {hasUnsavedEdits && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <strong>Warning:</strong> You have unsaved edits. Save them in the Edit page to include in exports.
              </p>
            </div>
          )}
        </div>

        {/* File Information */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">File Information</h2>
          
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">Filename</p>
              <p className="font-mono text-sm font-medium text-gray-900">
                {currentFile.fileName}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-600">File Size</p>
              <p className="font-medium text-gray-900">
                {(iesContent.length / 1024).toFixed(2)} KB
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-600">Format</p>
              <p className="font-medium text-gray-900">{currentFile.metadata.format}</p>
            </div>

            <div>
              <p className="text-sm text-gray-600">Upload Date</p>
              <p className="font-medium text-gray-900">
                {currentFile.uploadDate.toLocaleString()}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-600">Total Lumens</p>
              <p className="font-medium text-gray-900">
                {currentFile.photometricData.totalLumens.toFixed(0)} lm
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-600">Number of Angles</p>
              <p className="font-medium text-gray-900">
                {currentFile.photometricData.numberOfVerticalAngles} vertical × {' '}
                {currentFile.photometricData.numberOfHorizontalAngles} horizontal
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">File Preview</h2>
        <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto max-h-96 font-mono text-sm">
          <pre>{iesContent}</pre>
        </div>
      </div>
    </div>
  );
}