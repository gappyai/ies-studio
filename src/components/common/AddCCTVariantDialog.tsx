import { X, Check } from 'lucide-react';
import { useState } from 'react';

interface AddCCTVariantDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (variants: Array<{ cct: number; multiplier: number }>) => void;
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
    // Split by comma and trim whitespace
    const cctValues = cct.split(',').map(v => v.trim()).filter(v => v !== '');
    const multiplierValues = multiplier.split(',').map(v => v.trim()).filter(v => v !== '');
    
    if (cctValues.length === 0) {
      alert('Please enter at least one CCT value');
      return;
    }
    
    if (multiplierValues.length === 0) {
      alert('Please enter at least one multiplier value');
      return;
    }
    
    // Parse CCT values
    const parsedCCTs = cctValues.map(v => parseInt(v));
    if (parsedCCTs.some(v => isNaN(v) || v <= 0)) {
      alert('Please enter valid CCT values (positive numbers)');
      return;
    }
    
    // Parse multiplier values
    const parsedMultipliers = multiplierValues.map(v => parseFloat(v));
    if (parsedMultipliers.some(v => isNaN(v) || v <= 0)) {
      alert('Please enter valid multiplier values (positive numbers)');
      return;
    }
    
    // Create combinations of CCT and multipliers
    const variants: Array<{ cct: number; multiplier: number }> = [];
    
    // If both have multiple values, create all combinations
    // If one has single value, pair it with all values from the other
    if (parsedCCTs.length === parsedMultipliers.length) {
      // Pair them one-to-one
      for (let i = 0; i < parsedCCTs.length; i++) {
        variants.push({
          cct: parsedCCTs[i],
          multiplier: parsedMultipliers[i]
        });
      }
    } else if (parsedMultipliers.length === 1) {
      // Single multiplier, multiple CCTs
      parsedCCTs.forEach(cctVal => {
        variants.push({
          cct: cctVal,
          multiplier: parsedMultipliers[0]
        });
      });
    } else if (parsedCCTs.length === 1) {
      // Single CCT, multiple multipliers
      parsedMultipliers.forEach(multVal => {
        variants.push({
          cct: parsedCCTs[0],
          multiplier: multVal
        });
      });
    } else {
      alert('Number of CCT values must match number of multiplier values, or one of them must be a single value');
      return;
    }
    
    onAdd(variants);
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
              type="text"
              value={cct}
              onChange={(e) => setCct(e.target.value)}
              placeholder="e.g., 3000 or 3000,5000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1">
              Single: 3000 | Multiple (comma-separated): 3000, 5000, 6500
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Lumen Multiplier
            </label>
            <input
              type="text"
              value={multiplier}
              onChange={(e) => setMultiplier(e.target.value)}
              placeholder="e.g., 1.0 or 0.8,1.2"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Single: 1.0 | Multiple (comma-separated): 0.8, 1.0, 1.2
            </p>
          </div>
          
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-800">
              <strong>Tip:</strong> Enter comma-separated values to add multiple variants at once.
              Equal counts pair one-to-one, or use one value with multiple of the other.
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