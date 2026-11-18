import { useState, useMemo } from 'react';
import { formatCurrency, formatStoreName, isFranchiseStore } from '../utils/format';
import { Search, Calendar, DollarSign, Percent, TrendingUp, Info } from 'lucide-react';

function getWeekday(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { weekday: 'short' }); // "Mon", "Tue", etc.
}

function getFormattedDayMonth(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); // "10 Nov"
}

function getFullDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
}

function isWeekend(dateStr) {
  if (!dateStr) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay();
  return day === 0 || day === 6; // Sun = 0, Sat = 6
}

export default function StoreDayHeatmap({ data, onSelectStore }) {
  const [search, setSearch] = useState('');
  const [displayMode, setDisplayMode] = useState('sales'); // 'sales' | 'index'
  const [hoveredCell, setHoveredCell] = useState(null);

  const dates = data?.dates || [];
  const rawStores = data?.stores || [];

  const filteredStores = useMemo(() => {
    if (!search.trim()) return rawStores;
    const q = search.toLowerCase();
    return rawStores.filter(s =>
      s.store_name.toLowerCase().includes(q) ||
      formatStoreName(s.store_name).toLowerCase().includes(q)
    );
  }, [rawStores, search]);

  // Daily totals across all displayed stores
  const dailyTotals = useMemo(() => {
    const totals = {};
    for (const d of dates) {
      totals[d] = 0;
    }
    for (const s of filteredStores) {
      for (const c of s.cells || []) {
        if (totals[c.date] !== undefined) {
          totals[c.date] += (c.sales || 0);
        }
      }
    }
    return totals;
  }, [dates, filteredStores]);

  // Find max sales across all cells for continuous gradient legend
  const maxSales = useMemo(() => {
    let maxVal = 1;
    for (const s of rawStores) {
      for (const c of s.cells || []) {
        if (c.sales > maxVal) maxVal = c.sales;
      }
    }
    return maxVal;
  }, [rawStores]);

  // Color generator replicating reference heatmap style
  const getStoreCellColor = (sales, ratio) => {
    if (!sales || sales <= 0) {
      return 'bg-slate-100/70 text-slate-400 border-slate-200/60';
    }
    const salesRatio = sales / Math.max(maxSales, 1);
    if (salesRatio >= 0.70 || ratio >= 1.8) {
      return 'bg-[#15803d] text-white border-emerald-600 font-bold hover:brightness-110';
    }
    if (salesRatio >= 0.45 || ratio >= 1.3) {
      return 'bg-[#86efac] text-emerald-950 border-emerald-300 font-bold hover:brightness-105';
    }
    if (salesRatio >= 0.20 || ratio >= 0.8) {
      return 'bg-[#fef08a] text-amber-950 border-amber-200 font-medium hover:brightness-105';
    }
    if (salesRatio >= 0.08) {
      return 'bg-[#fed7aa] text-amber-950 border-amber-200 font-medium hover:brightness-105';
    }
    return 'bg-[#fee2e2] text-rose-950 border-rose-200 font-medium hover:brightness-105';
  };

  if (!dates.length || !rawStores.length) return null;

  return (
    <div className="card p-4 sm:p-5 space-y-4 bg-white border border-slate-200">
      {/* Top Header Bar matching reference image */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold shadow-2xs">
            <span>🔥</span>
            <span>Store Monthly DRR Heatmap</span>
          </div>

          <span className="text-xs text-slate-500 font-medium">
            Month: <strong className="text-slate-800 font-bold">November 2026</strong>
          </span>
        </div>

        {/* Display Mode Toggle */}
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold">
            <button
              onClick={() => setDisplayMode('sales')}
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-md transition-all ${
                displayMode === 'sales'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <DollarSign size={13} />
              <span>Net Sales (₹)</span>
            </button>
            <button
              onClick={() => setDisplayMode('index')}
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-md transition-all ${
                displayMode === 'index'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Percent size={13} />
              <span>Index (vs Avg)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Second Toolbar: Search box & Heat Gradient Scale Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Filter stores in heatmap..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-8.5 pl-8.5 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-indigo-500"
          />
        </div>

        {/* Counter and Continuous Heat Scale Legend */}
        <div className="flex items-center gap-4 text-xs text-slate-600">
          <span className="font-semibold text-slate-700">
            <strong>{filteredStores.length}</strong> / {rawStores.length} stores
          </span>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 font-medium">₹0</span>
            <div
              className="w-28 h-3 rounded-full border border-slate-200/80 shadow-2xs"
              style={{
                background: 'linear-gradient(to right, #fee2e2, #fed7aa, #fef08a, #86efac, #15803d)'
              }}
            />
            <span className="text-[11px] font-bold text-slate-800">
              {formatCurrency(maxSales)}
            </span>
          </div>
        </div>
      </div>

      {/* Grid Container */}
      <div className="overflow-x-auto max-h-[580px] border border-slate-200 rounded-xl bg-white shadow-xs">
        <table className="min-w-full text-left border-separate border-spacing-0">
          <thead className="sticky top-0 bg-slate-50 z-40 shadow-xs">
            <tr>
              <th
                className="sticky left-0 bg-slate-50 z-50 px-3.5 py-3 font-bold text-slate-700 text-xs uppercase tracking-wider w-[230px] min-w-[230px] max-w-[230px] border-b border-r border-slate-200"
                style={{ left: 0 }}
              >
                Store Name
              </th>
              <th
                className="sticky z-50 px-3 py-3 font-bold text-slate-700 text-right text-xs uppercase tracking-wider w-[85px] min-w-[85px] max-w-[85px] border-b border-r border-slate-200 bg-slate-50"
                style={{ left: '230px' }}
              >
                Total
              </th>
              <th
                className="sticky z-50 px-3 py-3 font-bold text-slate-700 text-right text-xs uppercase tracking-wider w-[85px] min-w-[85px] max-w-[85px] border-b border-r-2 border-slate-300 bg-slate-50 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.08)]"
                style={{ left: '315px' }}
              >
                Avg DRR
              </th>
              {dates.map(d => {
                const weekday = getWeekday(d);
                const weekend = isWeekend(d);
                const dayMonth = getFormattedDayMonth(d);
                return (
                  <th
                    key={d}
                    className={`px-2 py-2 text-center min-w-[76px] border-b border-r border-slate-200 select-none ${
                      weekend ? 'bg-indigo-50/70' : 'bg-slate-50'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span className={`text-[11px] font-bold uppercase tracking-wider ${
                        weekend ? 'text-indigo-700 bg-indigo-100/80 px-1.5 rounded' : 'text-slate-400'
                      }`}>
                        {weekday}
                      </span>
                      <span className="font-bold text-slate-800 text-[12px] tabular-nums">
                        {dayMonth}
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filteredStores.map(s => {
              const cleanName = formatStoreName(s.store_name);
              const isFran = isFranchiseStore(s.store_name);
              return (
                <tr key={s.store_name} className="hover:bg-slate-50/60 group">
                  {/* Store Name (Sticky Left) */}
                  <td
                    onClick={() => onSelectStore && onSelectStore(s.store_name)}
                    className="sticky left-0 bg-white group-hover:bg-slate-50 z-30 px-3.5 py-2.5 font-medium text-slate-800 truncate border-b border-r border-slate-200 cursor-pointer hover:text-indigo-600 transition-colors w-[230px] min-w-[230px] max-w-[230px]"
                    style={{ left: 0 }}
                    title={`Click to inspect store analytics for ${cleanName}`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="truncate font-semibold text-[13px] text-slate-900">{cleanName}</span>
                      <span className={`text-[10.5px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                        isFran ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-indigo-50 text-indigo-700'
                      }`}>
                        {isFran ? 'Fran' : 'Own'}
                      </span>
                    </div>
                  </td>

                  {/* Total Sales (Sticky Left) */}
                  <td
                    className="sticky z-30 px-3 py-2.5 text-right border-b border-r border-slate-200 tabular-nums font-bold text-slate-900 text-xs bg-white group-hover:bg-slate-50 w-[85px] min-w-[85px] max-w-[85px]"
                    style={{ left: '230px' }}
                  >
                    {formatCurrency(s.total_sales)}
                  </td>

                  {/* Daily Average Column (Sticky Left) */}
                  <td
                    className="sticky z-30 px-3 py-2.5 text-right border-b border-r-2 border-slate-300 tabular-nums font-bold text-slate-900 text-xs bg-white group-hover:bg-slate-50 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.08)] w-[85px] min-w-[85px] max-w-[85px]"
                    style={{ left: '315px' }}
                  >
                    {formatCurrency(s.avg_sales)}
                  </td>

                  {/* Day Cells */}
                  {s.cells.map(c => {
                    const ratio = c.ratio || 0;
                    const sales = c.sales || 0;
                    const bgClasses = getStoreCellColor(sales, ratio);

                    return (
                      <td
                        key={c.date}
                        onMouseEnter={() => setHoveredCell({
                          store: cleanName,
                          date: c.date,
                          sales,
                          avg: s.avg_sales,
                          ratio
                        })}
                        onMouseLeave={() => setHoveredCell(null)}
                        className={`p-1.5 text-center transition-all cursor-pointer border-b border-r text-[12px] tabular-nums ${bgClasses}`}
                      >
                        {displayMode === 'sales' ? (
                          sales > 0 ? (
                            <span className="font-semibold block">{formatCurrency(sales)}</span>
                          ) : (
                            <span className="text-slate-300 font-normal">—</span>
                          )
                        ) : (
                          sales > 0 ? (
                            <span className="font-semibold block">{ratio.toFixed(1)}x</span>
                          ) : (
                            <span className="text-slate-300 font-normal">0x</span>
                          )
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>

          {/* Network Totals Row */}
          <tfoot>
            <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300 text-xs">
              <td
                className="sticky left-0 bg-slate-100 z-30 px-3.5 py-3 font-bold border-r border-slate-300 w-[230px] min-w-[230px] max-w-[230px]"
                style={{ left: 0 }}
              >
                Network Total ({filteredStores.length} stores)
              </td>
              <td
                className="sticky z-30 px-3 py-3 text-right border-r border-slate-300 tabular-nums bg-slate-100 w-[85px] min-w-[85px] max-w-[85px]"
                style={{ left: '230px' }}
              >
                {formatCurrency(filteredStores.reduce((acc, s) => acc + (s.total_sales || 0), 0))}
              </td>
              <td
                className="sticky z-30 px-3 py-3 text-right border-r-2 border-slate-300 tabular-nums bg-slate-100 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.08)] w-[85px] min-w-[85px] max-w-[85px]"
                style={{ left: '315px' }}
              >
                {formatCurrency(Object.values(dailyTotals).reduce((a, b) => a + b, 0) / Math.max(dates.length, 1))}
              </td>
              {dates.map(d => (
                <td key={d} className="px-2 py-3 text-center border-r border-slate-300 tabular-nums text-xs font-bold text-slate-900">
                  {formatCurrency(dailyTotals[d] || 0)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Hover tooltip bar */}
      {hoveredCell && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs animate-fade-in shadow-lg">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-sm">{hoveredCell.store}</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-300 flex items-center gap-1">
              <Calendar size={13} className="text-slate-400" />
              {getFullDate(hoveredCell.date)}
            </span>
          </div>
          <div className="flex items-center gap-4 tabular-nums">
            <span>
              Net Sales: <strong className="text-emerald-400 font-bold">{formatCurrency(hoveredCell.sales)}</strong>
            </span>
            <span className="text-slate-500">|</span>
            <span>
              Daily Avg: <strong className="text-slate-300">{formatCurrency(hoveredCell.avg)}</strong>
            </span>
            <span className="text-slate-500">|</span>
            <span className={`px-2 py-0.5 rounded font-bold ${
              hoveredCell.ratio >= 1.3
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                : hoveredCell.ratio >= 0.8
                ? 'bg-slate-800 text-slate-200'
                : 'bg-rose-950 text-rose-300 border border-rose-800'
            }`}>
              {hoveredCell.sales > 0
                ? `${hoveredCell.ratio}x Baseline (${hoveredCell.ratio >= 1.0 ? '+' : ''}${Math.round((hoveredCell.ratio - 1) * 100)}%)`
                : 'No Sales (Dormant)'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
