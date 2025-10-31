import { X, Check } from 'lucide-react';
import { useState } from 'react';

interface BulkEditColumnDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (value: string) => void;
  columnName: string;
  rowCount: number;
}

export function BulkEditColumnDialog({ 
  isOpen, 
  onClose, 
  onApply, 
  columnName,
  rowCount 
}: BulkEditColumnDialogProps) {
  const [value, setValue] = useState('');

  if (!isOpen) return null;

  const handleApply = () => {
    onApply(value);
    setValue('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Set Value for All Rows</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6">
          <p className="text-sm text-gray-600 mb-4">
            Set the value for "<strong>{columnName}</strong>" across all {rowCount} rows.
          </p>
          
          {columnName === 'Near Field Type' ? (
            <select
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            >
              <option value="">None</option>
              <option value="1">1 - Point</option>
              <option value="2">2 - Linear</option>
              <option value="3">3 - Area</option>
            </select>
          ) : (
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleApply();
                }
              }}
              placeholder={`Enter value for ${columnName}`}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
          )}
        </div>
        
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Check className="w-4 h-4" />
            Apply to All Rows
          </button>
        </div>
      </div>
    </div>
  );
}