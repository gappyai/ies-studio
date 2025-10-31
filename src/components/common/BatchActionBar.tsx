import { Download, Upload, Settings, Trash2, ArrowLeftRight, FileText } from 'lucide-react';
import type { ReactNode } from 'react';

interface ActionButton {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  tooltip?: string;
}

interface BatchActionBarProps {
  actions: ActionButton[];
  onClear: () => void;
  fileCount?: number;
}

export function BatchActionBar({ actions, onClear, fileCount }: BatchActionBarProps) {
  const getButtonClasses = (variant: string = 'secondary', disabled: boolean = false) => {
    const base = 'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-medium';
    
    if (disabled) {
      return `${base} bg-gray-100 text-gray-400 cursor-not-allowed`;
    }
    
    switch (variant) {
      case 'primary':
        return `${base} bg-blue-600 text-white hover:bg-blue-700`;
      case 'danger':
        return `${base} bg-red-50 text-red-600 hover:bg-red-100 border border-red-300`;
      default:
        return `${base} bg-white text-gray-700 hover:bg-gray-50 border border-gray-300`;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Actions</h3>
          {fileCount !== undefined && (
            <p className="text-xs text-gray-600 mt-0.5">{fileCount} file{fileCount !== 1 ? 's' : ''} loaded</p>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {actions.map((action, index) => (
            <button
              key={index}
              onClick={action.onClick}
              disabled={action.disabled}
              className={getButtonClasses(action.variant, action.disabled)}
              title={action.tooltip}
            >
              {action.icon}
              <span>{action.label}</span>
            </button>
          ))}
          
          <button
            onClick={onClear}
            className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 border border-red-300"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear All</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export { Download, Upload, Settings, Trash2, ArrowLeftRight, FileText };