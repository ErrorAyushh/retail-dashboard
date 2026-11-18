import { useState, useRef, useEffect, useMemo } from 'react';
import { SlidersHorizontal, X, Search, Store, MapPin, Layers, User, RotateCcw, Building2, Tag, ChevronDown, Check, Calendar } from 'lucide-react';
import { useFilters, DATE_PRESETS, STORE_TYPE_OPTIONS } from '../context/FilterContext';
import { formatStoreName, formatDate } from '../utils/format';
import Dropdown from './Dropdown';

export default function FilterBar() {
  const {
    meta,
    datePreset,
    startDate,
    endDate,
    storeType,
    regions,
    stores,
    genders,
    departments,
    productSearch,
    setDatePreset,
    setCustomDates,
    setFilter,
    resetFilters,
  } = useFilters();

  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customStart, setCustomStart] = useState(startDate || '');
  const [customEnd, setCustomEnd] = useState(endDate || '');
  const dateDropdownRef = useRef(null);

  const [storeSearchOpen, setStoreSearchOpen] = useState(false);
  const [storeSearchQuery, setStoreSearchQuery] = useState('');

  useEffect(() => {
    function onDocClick(e) {
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(e.target)) {
        setDateDropdownOpen(false);
        setShowCustomPicker(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (startDate) setCustomStart(startDate);
    if (endDate) setCustomEnd(endDate);
  }, [startDate, endDate]);

  const dateTriggerLabel = useMemo(() => {
    if (datePreset === 'yesterday') return 'Yesterday';
    if (datePreset === '7d' || datePreset === 'last7') return '7 Days';
    if (datePreset === 'mtd') return 'MTD';
    if (datePreset === 'custom') {
      return startDate && endDate ? `${formatDate(startDate)} – ${formatDate(endDate)}` : 'Custom';
    }
    return 'Yesterday';
  }, [datePreset, startDate, endDate]);

  const canonicalRegionMap = useMemo(() => ({
    'ANDHRA PRADESH': 'Andhra Pradesh',
    'BIHAR': 'Bihar',
    'CHHATTISGARH': 'Chhattisgarh',
    'DELHI': 'Delhi',
    'GOA': 'Goa',
    'GUJARAT': 'Gujarat',
    'HARYANA': 'Haryana',
    'KARANATAKA': 'Karnataka',
    'KARNATAKA': 'Karnataka',
    'KERALA': 'Kerala',
    'MADHYA PRADESH': 'Madhya Pradesh',
    'MAHARASHTRA': 'Maharashtra',
    'PUNJAB': 'Punjab',
    'RAJASTHAN': 'Rajasthan',
    'TELANGANA': 'Telangana',
    'UTTAR PRADESH': 'Uttar Pradesh',
    'UTTARAKHAND': 'Uttarakhand',
    'WEST BENGAL': 'West Bengal',
  }), []);

  const normalizeRegion = (r) => {
    if (!r) return '';
    const upper = r.trim().toUpperCase();
    return canonicalRegionMap[upper] || (r.charAt(0).toUpperCase() + r.slice(1).toLowerCase());
  };

  // Region options: normalized, deduplicated, and sorted alphabetically
  const regionOptions = useMemo(() => {
    const raw = meta.regions || [];
    const set = new Set();
    const cleanList = [];
    raw.forEach((r) => {
      const norm = normalizeRegion(r);
      if (norm && !set.has(norm)) {
        set.add(norm);
        cleanList.push(norm);
      }
    });
    cleanList.sort((a, b) => a.localeCompare(b));
    return [
      { value: 'all', label: 'All Regions' },
      ...cleanList.map((r) => ({ value: r, label: r })),
    ];
  }, [meta.regions, canonicalRegionMap]);

  // Gender options
  const genderOptions = [
    { value: 'all', label: 'All Genders' },
    ...(meta.genders || []).map((g) => ({ value: g, label: g })),
  ];

  // Department options
  const deptOptions = [
    { value: 'all', label: 'All Departments' },
    ...(meta.departments || []).map((d) => ({ value: d, label: d })),
  ];

  // Available store list filtered by selected store_type and region
  const availableStores = (meta.stores || []).filter((s) => {
    if (storeType !== 'All' && s.store_type !== storeType) return false;
    const storeReg = normalizeRegion(s.region);
    if (regions.length > 0 && !regions.some(r => normalizeRegion(r) === storeReg)) return false;
    if (storeSearchQuery.trim()) {
      const q = storeSearchQuery.toLowerCase();
      const cleanName = formatStoreName(s.store_name).toLowerCase();
      return (
        s.store_name.toLowerCase().includes(q) ||
        cleanName.includes(q) ||
        (s.store_code && s.store_code.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleToggleStore = (storeName) => {
    const next = stores.includes(storeName)
      ? stores.filter((s) => s !== storeName)
      : [...stores, storeName];
    setFilter('store', next);
  };

  // Compile active chips for display
  const activeChips = [];
  if (datePreset === 'custom' && startDate && endDate) {
    activeChips.push({
      id: 'custom_dates',
      label: `Range: ${formatDate(startDate)} – ${formatDate(endDate)}`,
      onRemove: () => setDatePreset('7d')
    });
  }
  if (storeType && storeType !== 'All') {
    activeChips.push({
      id: 'store_type',
      label: `Type: ${storeType}`,
      onRemove: () => setFilter('store_type', 'All')
    });
  }
  regions.forEach((r) => {
    activeChips.push({
      id: `region-${r}`,
      label: `Region: ${r}`,
      onRemove: () => setFilter('region', regions.filter(x => x !== r))
    });
  });
  stores.forEach((s) => {
    activeChips.push({
      id: `store-${s}`,
      label: `Store: ${formatStoreName(s)}`,
      onRemove: () => setFilter('store', stores.filter(x => x !== s))
    });
  });
  genders.forEach((g) => {
    activeChips.push({
      id: `gender-${g}`,
      label: `Gender: ${g}`,
      onRemove: () => setFilter('gender', genders.filter(x => x !== g))
    });
  });
  departments.forEach((d) => {
    activeChips.push({
      id: `dept-${d}`,
      label: `Dept: ${d}`,
      onRemove: () => setFilter('department', departments.filter(x => x !== d))
    });
  });
  if (productSearch) {
    activeChips.push({
      id: 'search',
      label: `SKU: "${productSearch}"`,
      onRemove: () => setFilter('product', '')
    });
  }

  return (
    <div className="space-y-2">
      {/* Primary Inline Filter Bar as in Image 1 */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Date Filter Dropdown (Yesterday, 7 Days, MTD, Custom) */}
        <div className="relative" ref={dateDropdownRef}>
          <button
            type="button"
            onClick={() => setDateDropdownOpen((prev) => !prev)}
            className={`inline-flex items-center justify-between gap-1.5 h-8 px-2.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
              datePreset
                ? 'border-sky-300 bg-sky-50/70 text-sky-800'
                : 'border-slate-200/90 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <span className="flex items-center gap-1.5 truncate">
              <Calendar size={13} className="text-sky-600" />
              <span className="truncate">{dateTriggerLabel}</span>
            </span>
            <ChevronDown size={13} className={`shrink-0 text-slate-400 transition-transform ${dateDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {dateDropdownOpen && (
            <div className="absolute left-0 mt-1 w-64 bg-white rounded-xl border border-slate-200 shadow-xl p-2 z-50 animate-fade-in text-xs">
              <div className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setDatePreset('yesterday');
                    setDateDropdownOpen(false);
                    setShowCustomPicker(false);
                  }}
                  className={`w-full px-2.5 py-1.5 text-left rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                    datePreset === 'yesterday'
                      ? 'bg-indigo-50 text-indigo-700 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>Yesterday</span>
                  {datePreset === 'yesterday' && <Check size={14} className="text-indigo-600 shrink-0" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDatePreset('7d');
                    setDateDropdownOpen(false);
                    setShowCustomPicker(false);
                  }}
                  className={`w-full px-2.5 py-1.5 text-left rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                    (datePreset === '7d' || datePreset === 'last7')
                      ? 'bg-indigo-50 text-indigo-700 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>7 Days</span>
                  {(datePreset === '7d' || datePreset === 'last7') && <Check size={14} className="text-indigo-600 shrink-0" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDatePreset('mtd');
                    setDateDropdownOpen(false);
                    setShowCustomPicker(false);
                  }}
                  className={`w-full px-2.5 py-1.5 text-left rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                    datePreset === 'mtd'
                      ? 'bg-indigo-50 text-indigo-700 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>MTD</span>
                  {datePreset === 'mtd' && <Check size={14} className="text-indigo-600 shrink-0" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowCustomPicker(true);
                  }}
                  className={`w-full px-2.5 py-1.5 text-left rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                    datePreset === 'custom'
                      ? 'bg-indigo-50 text-indigo-700 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>Custom</span>
                  {datePreset === 'custom' && <Check size={14} className="text-indigo-600 shrink-0" />}
                </button>
              </div>

              {(showCustomPicker || datePreset === 'custom') && (
                <div className="mt-2 pt-2 border-t border-slate-100 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={customStart}
                        min={meta?.min_date}
                        max={customEnd || meta?.max_date}
                        onChange={(e) => setCustomStart(e.target.value)}
                        className="w-full text-xs px-2 py-1 bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={customEnd}
                        min={customStart || meta?.min_date}
                        max={meta?.max_date}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className="w-full text-xs px-2 py-1 bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:border-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!customStart || !customEnd}
                    onClick={() => {
                      if (customStart && customEnd) {
                        setCustomDates(customStart, customEnd);
                        setDateDropdownOpen(false);
                      }
                    }}
                    className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-md text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Apply Range
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Ownership Toggle Buttons */}
        <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50 text-[12px]">
          <button
            onClick={() => setFilter('store_type', 'Own store')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              storeType === 'Own store' ? 'bg-white text-indigo-700 shadow-xs' : 'text-gray-600'
            }`}
          >
            Own stores
          </button>
          <button
            onClick={() => setFilter('store_type', 'Franchise')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              storeType === 'Franchise' ? 'bg-white text-indigo-700 shadow-xs' : 'text-gray-600'
            }`}
          >
            Franchise
          </button>
          <button
            onClick={() => setFilter('store_type', 'All')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              storeType === 'All' ? 'bg-white text-indigo-700 shadow-xs' : 'text-gray-600'
            }`}
          >
            All stores
          </button>
        </div>

        {/* Region Dropdown */}
        <Dropdown
          label={regions.length === 0 ? 'All Regions' : regions.length === 1 ? regions[0] : `${regions.length} Regions`}
          value={regions.length === 1 ? regions[0] : regions.length > 1 ? 'multiple' : 'all'}
          options={regionOptions}
          onChange={(val) => {
            if (val === 'all') setFilter('region', []);
            else setFilter('region', [val]);
          }}
        />

        {/* Store Search Dropdown */}
        <div className="relative">
          <button
            onClick={() => setStoreSearchOpen(!storeSearchOpen)}
            className={`inline-flex items-center justify-between gap-1.5 h-9 px-3 rounded-lg border text-[13px] font-medium transition-all ${
              stores.length > 0
                ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span>{stores.length === 0 ? 'All Stores' : `${stores.length} Stores`}</span>
            <ChevronDown size={14} className="text-gray-400" />
          </button>

          {storeSearchOpen && (
            <div className="absolute left-0 mt-1 w-72 bg-white rounded-lg border border-gray-200 shadow-lg p-2 z-40 animate-fade-in space-y-2">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search stores..."
                  value={storeSearchQuery}
                  onChange={(e) => setStoreSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-gray-50 border border-gray-200 rounded-md outline-none focus:border-indigo-500 focus:bg-white"
                  autoFocus
                />
              </div>

              <div className="max-h-56 overflow-y-auto space-y-0.5 text-[12px]">
                {availableStores.map((s) => {
                  const selected = stores.includes(s.store_name);
                  const cleanName = formatStoreName(s.store_name);
                  const isFranchise = s.store_type === 'Franchise';
                  return (
                    <div
                      key={s.store_name}
                      onClick={() => handleToggleStore(s.store_name)}
                      className={`px-2.5 py-1.5 rounded-md flex items-center justify-between cursor-pointer ${
                        selected ? 'bg-indigo-50 text-indigo-700 font-medium' : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="truncate flex items-center gap-1">
                          <span className="truncate">{cleanName}</span>
                          {isFranchise && (
                            <span className="text-[10px] text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
                              F
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-400">{normalizeRegion(s.region)}</div>
                      </div>
                      {selected && <Check size={14} className="text-indigo-600 shrink-0" />}
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px]">
                <button
                  onClick={() => setFilter('store', [])}
                  className="text-gray-500 hover:text-gray-800"
                >
                  Clear selection
                </button>
                <button
                  onClick={() => setStoreSearchOpen(false)}
                  className="text-indigo-600 font-semibold hover:underline"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Gender Dropdown */}
        <Dropdown
          label={genders.length === 0 ? 'All Genders' : genders.length === 1 ? genders[0] : `${genders.length} Genders`}
          value={genders.length === 1 ? genders[0] : genders.length > 1 ? 'multiple' : 'all'}
          options={genderOptions}
          onChange={(val) => {
            if (val === 'all') setFilter('gender', []);
            else setFilter('gender', [val]);
          }}
        />

        {/* Department Dropdown */}
        <Dropdown
          label={departments.length === 0 ? 'All Departments' : departments.length === 1 ? departments[0] : `${departments.length} Depts`}
          value={departments.length === 1 ? departments[0] : departments.length > 1 ? 'multiple' : 'all'}
          options={deptOptions}
          onChange={(val) => {
            if (val === 'all') setFilter('department', []);
            else setFilter('department', [val]);
          }}
        />

        {/* SKU Search */}
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search product..."
            value={productSearch}
            onChange={(e) => setFilter('product', e.target.value)}
            className="h-9 pl-8 pr-3 text-[12.5px] bg-white border border-gray-200 rounded-lg outline-none focus:border-indigo-500 w-36 sm:w-44"
          />
        </div>
      </div>

      {/* Active Filter Chips Strip */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] text-gray-400 font-semibold mr-1 uppercase tracking-wider">
            Active Filters:
          </span>
          {activeChips.map((chip) => (
            <span
              key={chip.id}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full"
            >
              <span>{chip.label}</span>
              <button
                onClick={chip.onRemove}
                className="hover:text-rose-600 rounded-full p-0.5"
                title="Remove filter"
              >
                <X size={11} />
              </button>
            </span>
          ))}

          <button
            onClick={resetFilters}
            className="text-[11px] font-bold text-gray-400 hover:text-rose-600 ml-2 transition-colors cursor-pointer"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
