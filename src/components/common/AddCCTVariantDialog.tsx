import { X, Check } from 'lucide-react';
import { useState } from 'react';

interface AddCCTVariantDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (cct: number, multiplier: number) => void;
}

export function AddCCTVariantDialog({ 
  isOpen, 
  onClose, 
  onAdd 
}: AddCCTVariantDialogProps) {
  const [cct, setCct] = useState('');
  const [multiplier, setMultiplier] = useState('1.0');

  if (!isOpen) return null;

  const handleAdd = () => {
    const cctValue = parseInt(cct);
    const multiplierValue = parseFloat(multiplier);
    
    if (isNaN(cctValue) || cctValue <= 0) {
      alert('Please enter a valid CCT value');
      return;
    }
    
    if (isNaN(multiplierValue) || multiplierValue <= 0) {
      alert('Please enter a valid multiplier');
      return;
    }
    
    onAdd(cctValue, multiplierValue);
    setCct('');
    setMultiplier('1.0');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Add CCT Variant</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color Temperature (K)
            </label>
            <input
              type="number"
              value={cct}
              onChange={(e) => setCct(e.target.value)}
              placeholder="e.g., 3000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1">
              Common values: 2700, 3000, 4000, 5000, 6500
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Lumen Multiplier
            </label>
            <input
              type="number"
              step="0.01"
              value={multiplier}
              onChange={(e) => setMultiplier(e.target.value)}
              placeholder="e.g., 1.0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              1.0 = no change, 0.9 = 10% reduction, 1.1 = 10% increase
            </p>
          </div>
        </div>
        
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Check className="w-4 h-4" />
            Add Variant
          </button>
        </div>
      </div>
    </div>
  );
}