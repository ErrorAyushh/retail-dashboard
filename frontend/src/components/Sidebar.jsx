import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Store,
  Package,
  Percent,
  RotateCcw,
  UserCheck,
  Users2,
  Activity,
  MapPin,
  Footprints,
  Lock,
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { to: '/overview', label: 'Overview', icon: LayoutDashboard },
  { to: '/stores', label: 'Stores', icon: Store },
  { to: '/geography', label: 'Geography', icon: MapPin },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/discounts', label: 'Discounts & Margin', icon: Percent },
  { to: '/returns', label: 'Returns & Exchanges', icon: RotateCcw },
  { to: '/staff', label: 'Staff Leaderboard', icon: UserCheck },
  { to: '/customers', label: 'Customers', icon: Users2 },
  { to: '/health', label: 'Data Health', icon: Activity },
];

export default function Sidebar({ collapsed, onToggleCollapse, onNavigate }) {
  const { user, canViewPII } = useAuth();

  return (
    <aside
      className={`h-full flex flex-col bg-white border-r border-slate-200 transition-all duration-200 select-none ${
        collapsed ? 'w-[72px]' : 'w-[250px]'
      }`}
    >
      {/* Brand Header */}
      <div className="border-b border-slate-200 px-3.5 py-3 shrink-0">
        {!collapsed ? (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-white border border-slate-200/80 p-1 flex items-center justify-center shrink-0 shadow-2xs">
              <img
                src="/neemans-logo.png"
                alt="Neeman's"
                className="h-full w-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <div className="text-[13.5px] font-bold text-slate-900 leading-tight truncate tracking-tight flex items-center gap-1.5">
                Kadam
                <span className="text-[9.5px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/70 px-1.5 py-0.2 rounded">
                  Retail
                </span>
              </div>
              <div className="text-[11px] font-medium text-slate-400 leading-tight truncate mt-0.5">
                Offline Retail · Neeman's
              </div>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <div
              className="h-9 w-9 rounded-xl bg-white border border-slate-200/80 p-1 flex items-center justify-center shadow-2xs cursor-pointer"
              title="Kadam Retail · Neeman's"
              onClick={onToggleCollapse}
            >
              <img
                src="/neemans-logo.png"
                alt="Neeman's"
                className="h-full w-full object-contain"
              />
            </div>
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 scrollbar-none">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    } ${collapsed ? 'justify-center px-2' : ''}`
                  }
                  title={collapsed ? item.label : undefined}
                >
                  <Icon size={18} className="shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Info & Status */}
      <div className="p-3 border-t border-slate-200 bg-slate-50/60 text-[11px] space-y-2.5">
        {!collapsed ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Customer Info</span>
              <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                <ShieldCheck size={12} />
                Full Info Active
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-[10px] shrink-0">
                  {user.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="text-[12px] font-medium text-slate-800 truncate leading-tight">{user.name}</div>
                  <div className="text-[10px] text-slate-400 truncate leading-tight">{user.role}</div>
                </div>
              </div>
              <button
                onClick={onToggleCollapse}
                className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
                title="Collapse sidebar"
              >
                <PanelLeftClose size={15} />
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div
              className="p-1.5 rounded-md bg-emerald-50 text-emerald-600"
              title="Full Customer Info Active"
            >
              <ShieldCheck size={14} />
            </div>
            <button
              onClick={onToggleCollapse}
              className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
              title="Expand sidebar"
            >
              <PanelLeftOpen size={16} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
