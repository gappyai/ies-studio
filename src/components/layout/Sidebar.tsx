import { Home, Edit, Box, Grid, Download } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useIESFileStore } from '../../store/iesFileStore';

const navigationItems = [
  { path: '/', icon: Home, label: 'Home', exact: true },
  { path: '/overview', icon: Grid, label: 'Overview' },
  { path: '/edit', icon: Edit, label: 'Edit' },
  { path: '/3d', icon: Box, label: '3D View' },
  { path: '/batch', icon: Grid, label: 'Batch Generator' },
  { path: '/export', icon: Download, label: 'Export' },
];

export function Sidebar() {
  const currentFile = useIESFileStore((state) => state.currentFile);

  return (
    <aside className="w-20 bg-gray-800 flex flex-col items-center py-6 space-y-8">
      {navigationItems.map((item) => {
        const Icon = item.icon;
        const isDisabled = !currentFile && !item.exact;
        
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center space-y-1 w-16 py-3 rounded-lg transition-colors ${
                isDisabled
                  ? 'opacity-40 cursor-not-allowed pointer-events-none'
                  : isActive
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