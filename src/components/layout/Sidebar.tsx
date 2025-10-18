import { FileText, Settings, Zap, Ruler, Palette } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const navigationItems = [
  { path: '/', icon: FileText, label: 'File Editor', exact: true },
  { path: '/batch-metadata', icon: Settings, label: 'Batch Metadata' },
  { path: '/batch-wattage', icon: Zap, label: 'Batch Wattage' },
  { path: '/batch-length', icon: Ruler, label: 'Batch Length' },
  { path: '/batch-cct', icon: Palette, label: 'Batch CCT' },
];

export function Sidebar() {
  return (
    <aside className="w-20 bg-gray-800 flex flex-col items-center py-6 space-y-8">
      {navigationItems.map((item) => {
        const Icon = item.icon;
        
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center space-y-1 w-16 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-primary text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`
            }
          >
            <Icon className="w-6 h-6" />
            <span className="text-xs font-medium text-center">{item.label}</span>
          </NavLink>
        );
      })}
    </aside>
  );
}