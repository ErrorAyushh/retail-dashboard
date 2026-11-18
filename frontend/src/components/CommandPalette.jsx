import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  LayoutDashboard, 
  Store, 
  MapPin,
  Package, 
  Percent, 
  RotateCcw, 
  UserCheck, 
  Users2, 
  Activity, 
  Calendar, 
  Building2,
  X,
  ArrowRight
} from 'lucide-react';
import { useFilters } from '../context/FilterContext';
import { formatStoreName, isFranchiseStore, formatDate } from '../utils/format';

export default function CommandPalette({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const { meta, setFilter, setDatePreset } = useFilters();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Build searchable items
  const pages = [
    { id: 'page-overview', category: 'Pages', label: 'Overview', icon: LayoutDashboard, action: () => navigate('/overview') },
    { id: 'page-stores', category: 'Pages', label: 'Stores Ranking & Analysis', icon: Store, action: () => navigate('/stores') },
    { id: 'page-geography', category: 'Pages', label: 'Geography & Retail Network', icon: MapPin, action: () => navigate('/geography') },
    { id: 'page-products', category: 'Pages', label: 'Products & Size Mix', icon: Package, action: () => navigate('/products') },
    { id: 'page-discounts', category: 'Pages', label: 'Discounts & Margin Waterfall', icon: Percent, action: () => navigate('/discounts') },
    { id: 'page-returns', category: 'Pages', label: 'Returns & Exchanges', icon: RotateCcw, action: () => navigate('/returns') },
    { id: 'page-staff', category: 'Pages', label: 'Staff Leaderboard', icon: UserCheck, action: () => navigate('/staff') },
    { id: 'page-customers', category: 'Pages', label: 'Customer Insights & Frequency', icon: Users2, action: () => navigate('/customers') },
    { id: 'page-health', category: 'Pages', label: 'Data Health & Completeness', icon: Activity, action: () => navigate('/health') },
  ];

  const presets = [
    { id: 'preset-yesterday', category: 'Date Presets', label: 'Yesterday', icon: Calendar, action: () => setDatePreset('yesterday') },
    { id: 'preset-7d', category: 'Date Presets', label: '7 Days', icon: Calendar, action: () => setDatePreset('7d') },
    { id: 'preset-mtd', category: 'Date Presets', label: 'MTD', icon: Calendar, action: () => setDatePreset('mtd') },
    { id: 'preset-custom', category: 'Date Presets', label: 'Custom', icon: Calendar, action: () => setDatePreset('custom') },
  ];

  const storeTypes = [
    { id: 'type-all', category: 'Store Type', label: 'All Stores (Default)', icon: Building2, action: () => setFilter('store_type', 'All') },
    { id: 'type-own', category: 'Store Type', label: 'Own Stores Only', icon: Building2, action: () => setFilter('store_type', 'Own store') },
    { id: 'type-franchise', category: 'Store Type', label: 'Franchise Stores Only', icon: Building2, action: () => setFilter('store_type', 'Franchise') },
  ];

  const storeItems = (meta?.stores || []).map(s => {
    const rawName = s.store_name || s;
    const formatted = formatStoreName(rawName);
    const franchise = isFranchiseStore(rawName);
    return {
      id: `store-${rawName}`,
      category: 'Stores',
      label: formatted + (franchise ? ' (Franchise)' : ' (Own Store)'),
      icon: Store,
      action: () => {
        setFilter('store', [rawName]);
        navigate('/stores');
      }
    };
  });

  const allItems = [...pages, ...presets, ...storeTypes, ...storeItems];

  const filteredItems = query.trim()
    ? allItems.filter(item => item.label.toLowerCase().includes(query.toLowerCase()) || item.category.toLowerCase().includes(query.toLowerCase()))
    : allItems.slice(0, 16);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => (i + 1) % filteredItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => (i - 1 + filteredItems.length) % filteredItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-fade-in" onClick={onClose}>
      <div 
        className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden" 
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100">
          <Search size={18} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type a page, store name, or date preset..."
            className="flex-1 bg-transparent text-[14px] text-slate-800 placeholder-slate-400 focus:outline-none"
          />
          <span className="hidden sm:inline-flex items-center px-2 py-0.5 text-[11px] font-medium text-slate-400 bg-slate-100 rounded">
            ESC to close
          </span>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-600 sm:hidden">
            <X size={16} />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto py-2 px-1 divide-y divide-slate-50">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">
              No matching pages, stores, or commands found.
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg text-left transition-colors ${
                    isSelected ? 'bg-indigo-50/80 text-indigo-900' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-1.5 rounded-md ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <Icon size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium truncate">{item.label}</div>
                      <div className="text-[11px] text-slate-400">{item.category}</div>
                    </div>
                  </div>
                  {isSelected && <ArrowRight size={14} className="text-indigo-600 shrink-0" />}
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 bg-slate-50/60 text-[11px] text-slate-400">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
          </div>
          <span>Kadam Command Center</span>
        </div>
      </div>
    </div>
  );
}
