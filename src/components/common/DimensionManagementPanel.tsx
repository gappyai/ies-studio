import { ArrowLeftRight } from 'lucide-react';
import { photometricCalculator } from '../../services/calculator';
import type { PhotometricData } from '../../types/ies.types';

interface DimensionManagementPanelProps {
  currentPhotometricData: PhotometricData;
  onPhotometricUpdate: (key: keyof PhotometricData, value: any) => void;
}

export function DimensionManagementPanel({
  currentPhotometricData,
  onPhotometricUpdate
}: DimensionManagementPanelProps) {
  const handleDimensionSwap = () => {
    if (confirm('Swap width and length dimensions? This will exchange the W and L values.')) {
      const swapped = photometricCalculator.swapDimensions(currentPhotometricData);
      onPhotometricUpdate('width', swapped.width);
      onPhotometricUpdate('length', swapped.length);
      alert('Dimensions swapped successfully');
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Dimension Management (Type 5)</h2>
      <button
        onClick={handleDimensionSwap}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <ArrowLeftRight className="w-5 h-5" />
        Swap Width ↔ Length
      </button>
      <p className="text-xs text-gray-600 mt-2 text-center">
        Exchange W and L values (useful for orientation changes)
      </p>
      <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm">
        <p className="text-gray-700">
          <strong>Current dimensions:</strong>
        </p>
        <p className="text-gray-600 mt-1">
          Width: {currentPhotometricData.width.toFixed(3)} m
        </p>
        <p className="text-gray-600">
          Length: {currentPhotometricData.length.toFixed(3)} m
        </p>
        <p className="text-gray-600">
          Height: {currentPhotometricData.height.toFixed(3)} m
        </p>
      </div>
    </div>
  );
}