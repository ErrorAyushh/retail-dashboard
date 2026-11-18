import { useState, useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Store, 
  Package, 
  Percent, 
  Menu
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import CommandPalette from '../components/CommandPalette';

export default function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Global Ctrl+K / Cmd+K shortcut listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-900">
      {/* Desktop Persistent Sidebar */}
      <div className="hidden md:block shrink-0 h-full">
        <Sidebar 
          collapsed={collapsed} 
          onToggleCollapse={() => setCollapsed(c => !c)} 
          onNavigate={() => {}} 
        />
      </div>

      {/* Mobile Drawer Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden animate-fade-in">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 shadow-2xl">
            <Sidebar 
              collapsed={false} 
              onToggleCollapse={() => setMobileOpen(false)} 
              onNavigate={() => setMobileOpen(false)} 
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden pb-14 md:pb-0">
        <div className="flex-1 min-w-0 overflow-y-auto">
          <Outlet 
            context={{ 
              onToggleSidebar: () => setMobileOpen(true),
              onOpenCommandPalette: () => setCommandPaletteOpen(true)
            }} 
          />
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar (Phone 390px friendly) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 md:hidden flex items-center justify-around h-14 px-2">
        <NavLink
          to="/overview"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center w-14 h-full text-[10px] font-medium transition-colors ${
              isActive ? 'text-indigo-600' : 'text-slate-500'
            }`
          }
        >
          <LayoutDashboard size={18} />
          <span className="mt-0.5">Overview</span>
        </NavLink>

        <NavLink
          to="/stores"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center w-14 h-full text-[10px] font-medium transition-colors ${
              isActive ? 'text-indigo-600' : 'text-slate-500'
            }`
          }
        >
          <Store size={18} />
          <span className="mt-0.5">Stores</span>
        </NavLink>

        <NavLink
          to="/products"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center w-14 h-full text-[10px] font-medium transition-colors ${
              isActive ? 'text-indigo-600' : 'text-slate-500'
            }`
          }
        >
          <Package size={18} />
          <span className="mt-0.5">Products</span>
        </NavLink>

        <NavLink
          to="/discounts"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center w-14 h-full text-[10px] font-medium transition-colors ${
              isActive ? 'text-indigo-600' : 'text-slate-500'
            }`
          }
        >
          <Percent size={18} />
          <span className="mt-0.5">Discounts</span>
        </NavLink>

        <button
          onClick={() => setMobileOpen(true)}
          className="flex flex-col items-center justify-center w-14 h-full text-[10px] font-medium text-slate-500"
        >
          <Menu size={18} />
          <span className="mt-0.5">More</span>
        </button>
      </nav>

      {/* Command Palette Modal */}
      <CommandPalette 
        isOpen={commandPaletteOpen} 
        onClose={() => setCommandPaletteOpen(false)} 
      />
    </div>
  );
}
