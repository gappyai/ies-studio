import { FileText, Box, Grid, BarChart3, Settings } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const navigationItems = [
  { path: '/', icon: FileText, label: 'File Editor', exact: true },
  { path: '/batch', icon: Settings, label: 'Batch Metadata' },
  { path: '/batch-generator', icon: Grid, label: 'Batch Generator' },
  { path: '/charts', icon: BarChart3, label: 'Charts' },
  { path: '/3d', icon: Box, label: '3D View' },
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