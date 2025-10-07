import { FileText } from 'lucide-react';

export function Header() {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200 h-16 flex items-center px-6">
      <div className="flex items-center space-x-3">
        <FileText className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-xl font-bold text-gray-900">IES Studio</h1>
          <p className="text-xs text-gray-500">Photometric File Editor</p>
        </div>
      </div>
    </header>
  );
}