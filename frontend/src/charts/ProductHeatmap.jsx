import { useState, useMemo, useEffect } from 'react';
import { formatCurrency, formatNumber } from '../utils/format';
import { Search, Flame, RefreshCw, Eye, Sparkles } from 'lucide-react';
import { api } from '../api/client';
import { useFilters } from '../context/FilterContext';

export default function ProductHeatmap({ onSelectProduct }) {
  const { filterQueryObj } = useFilters();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [viewMetric, setViewMetric] = useState('units'); // 'units' | 'sales'
  const [groupBy, setGroupBy] = useState('product'); // 'product' | 'sku'

  const loadHeatmapData = () => {
    setLoading(true);
    setError(null);
    api.getProductHeatmap(filterQueryObj, groupBy)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load product heatmap:', err);
        setError(err.message || 'Failed to load heatmap data');
        setLoading(false);
      });
  };

  useEffect(() => {
    loadHeatmapData();
  }, [filterQueryObj, groupBy]);

  const daysInMonth = data?.days_in_month || 30;
  const completedDays = data?.completed_days || 17;
  const rawProducts = data?.products || [];
  const maxDayUnits = data?.max_day_units || 1;
  const maxDaySales = data?.max_day_sales || 1;

  // Filter products by search
  const filteredProducts = useMemo(() => {
    if (!search.trim()) return rawProducts;
    const q = search.toLowerCase();
    return rawProducts.filter(p =>
      p.product_name?.toLowerCase().includes(q) ||
      p.product_code?.toLowerCase().includes(q) ||
      p.department?.toLowerCase().includes(q)
    );
  }, [rawProducts, search]);

  // Color generator replicating the reference image's heat scale:
  // Light pink (0) -> Light peach -> Yellow -> Mint green -> Deep green (peak)
  const getCellColor = (val, maxVal, isFuture) => {
    if (isFuture) {
      return 'bg-[#fef2f2] text-transparent'; // Muted future day shading
    }
    if (!val || val <= 0) {
      return 'bg-[#fce7e7] text-rose-300'; // 0 units
    }

    const ratio = val / Math.max(maxVal, 1);

    if (ratio >= 0.70) {
      return 'bg-[#15803d] text-white font-bold'; // Deep dark green (like 459 in photo)
    }
    if (ratio >= 0.50) {
      return 'bg-[#4ade80] text-emerald-950 font-semibold'; // Vibrant light green
    }
    if (ratio >= 0.35) {
      return 'bg-[#86efac] text-emerald-950 font-medium'; // Mint green
    }
    if (ratio >= 0.20) {
      return 'bg-[#fef08a] text-amber-950 font-medium'; // Yellow
    }
    if (ratio >= 0.10) {
      return 'bg-[#fed7aa] text-amber-950 font-medium'; // Peach / light orange
    }
    return 'bg-[#fee2e2] text-amber-900 font-medium'; // Soft peach / low volume
  };

  const dayNumbers = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="card p-5 space-y-4">
      {/* Top Header Bar matching reference image */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold shadow-2xs">
            <span>🔥</span>
            <span>Monthly DRR Heatmap</span>
          </div>

          <span className="text-xs text-slate-500 font-medium">
            Month: <strong className="text-slate-800 font-bold">{data?.month_name || 'November 2026'}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Product vs SKU Toggle */}
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
            <button
              onClick={() => setGroupBy('product')}
              className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                groupBy === 'product' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Product
            </button>
            <button
              onClick={() => setGroupBy('sku')}
              className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                groupBy === 'sku' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              SKU
            </button>
          </div>

          {/* Metric Toggle: Units vs Net Sales */}
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
            <button
              onClick={() => setViewMetric('units')}
              className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                viewMetric === 'units' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Units
            </button>
            <button
              onClick={() => setViewMetric('sales')}
              className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                viewMetric === 'sales' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Net Sales (₹)
            </button>
          </div>

          <button
            onClick={loadHeatmapData}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
            title="Refresh heatmap data"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Second Toolbar: Search box & Heat Gradient Scale Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Filter products in heatmap..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-8.5 pl-8.5 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-indigo-500"
          />
        </div>

        {/* Counter and Continuous Heat Scale Legend */}
        <div className="flex items-center gap-4 text-xs text-slate-600">
          <span className="font-semibold text-slate-700">
            <strong>{filteredProducts.length}</strong> / {rawProducts.length} products
          </span>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 font-medium">
              0 {viewMetric === 'units' ? 'units' : '₹'}
            </span>
            {/* Heatmap gradient bar matching the reference image */}
            <div
              className="w-28 h-3 rounded-full border border-slate-200/80 shadow-2xs"
              style={{
                background: 'linear-gradient(to right, #fee2e2, #fed7aa, #fef08a, #86efac, #15803d)'
              }}
            />
            <span className="text-[11px] font-bold text-slate-800">
              {viewMetric === 'units'
                ? `${formatNumber(maxDayUnits)} units`
                : formatCurrency(maxDaySales)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Heatmap Table with Sticky Left Columns & Sticky Header */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-slate-400 text-xs gap-2">
          <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span>Generating product daily performance matrix...</span>
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs space-y-2">
          <p className="font-bold">Failed to load product heatmap</p>
          <p>{error}</p>
          <button
            onClick={loadHeatmapData}
            className="px-3 py-1 bg-rose-600 text-white rounded font-medium cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs bg-white">
          <div className="max-h-[660px] overflow-auto">
            <table
              className="border-separate border-spacing-0 text-slate-700 table-fixed"
              style={{
                width: `${415 + dayNumbers.length * 40}px`,
                minWidth: `${415 + dayNumbers.length * 40}px`
              }}
            >
              <colgroup>
                <col style={{ width: '250px', minWidth: '250px', maxWidth: '250px' }} />
                <col style={{ width: '80px', minWidth: '80px', maxWidth: '80px' }} />
                <col style={{ width: '85px', minWidth: '85px', maxWidth: '85px' }} />
                {dayNumbers.map((d) => (
                  <col key={d} style={{ width: '40px', minWidth: '40px', maxWidth: '40px' }} />
                ))}
              </colgroup>

              <thead>
                <tr className="bg-slate-50 text-slate-600 uppercase font-bold sticky top-0 z-40">
                  {/* Sticky 1: Product Name */}
                  <th
                    className="sticky left-0 z-50 bg-slate-50 text-left px-3.5 py-3 border-b border-r border-slate-200 text-xs font-bold text-slate-700 tracking-wider"
                    style={{ left: 0, width: '250px' }}
                  >
                    Product Name
                  </th>

                  {/* Sticky 2: Total */}
                  <th
                    className="sticky z-50 bg-slate-50 text-right px-3 py-3 border-b border-r border-slate-200 text-xs font-bold text-slate-700 tracking-wider"
                    style={{ left: '250px', width: '80px' }}
                  >
                    Total
                  </th>

                  {/* Sticky 3: Avg DRR */}
                  <th
                    className="sticky z-50 bg-slate-50 text-right px-3 py-3 border-b border-r-2 border-slate-300 text-xs font-bold text-slate-700 tracking-wider shadow-[4px_0_6px_-2px_rgba(0,0,0,0.08)]"
                    style={{ left: '330px', width: '85px' }}
                  >
                    Avg DRR
                  </th>

                  {/* Days 1 to N */}
                  {dayNumbers.map((d) => {
                    const isFuture = d > completedDays;
                    return (
                      <th
                        key={d}
                        className={`text-center py-3 px-1 border-b border-r border-slate-200 text-xs font-bold ${
                          isFuture ? 'text-slate-300 bg-rose-50/40' : 'text-slate-700 bg-slate-50'
                        }`}
                        style={{ width: '40px' }}
                        title={isFuture ? `Day ${d} (Future / Incomplete)` : `Day ${d}`}
                      >
                        {d}
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody className="bg-white">
                {filteredProducts.map((p, rowIdx) => {
                  const totVal = viewMetric === 'units' ? p.total_units : p.total_sales;
                  const avgVal = viewMetric === 'units' ? p.avg_drr : p.avg_sales_drr;

                  return (
                    <tr
                      key={`${p.key}_${rowIdx}`}
                      className="group hover:bg-slate-50/80 transition-colors"
                    >
                      {/* Sticky 1: Product Name */}
                      <td
                        onClick={() => onSelectProduct && onSelectProduct(p.product_name)}
                        className="sticky left-0 z-30 bg-white group-hover:bg-slate-50 px-3.5 py-2.5 border-b border-r border-slate-200 cursor-pointer hover:text-indigo-600 transition-colors"
                        style={{ left: 0, width: '250px' }}
                        title={`Click to view size matrix for ${p.product_name}`}
                      >
                        <div className="truncate font-semibold text-[13px] text-slate-900 flex items-center justify-between gap-1">
                          <span className="truncate">{p.product_name}</span>
                          {groupBy === 'sku' && p.product_code && (
                            <span className="text-[10px] text-slate-400 font-mono font-normal shrink-0">
                              {p.product_code}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Sticky 2: Total */}
                      <td
                        className="sticky z-30 bg-white group-hover:bg-slate-50 px-3 py-2.5 text-right font-bold text-slate-900 tabular-nums border-b border-r border-slate-200 text-xs"
                        style={{ left: '250px', width: '80px' }}
                      >
                        {viewMetric === 'units' ? formatNumber(totVal) : formatCurrency(totVal)}
                      </td>

                      {/* Sticky 3: Avg DRR */}
                      <td
                        className="sticky z-30 bg-white group-hover:bg-slate-50 px-3 py-2.5 text-right font-bold text-slate-900 tabular-nums border-b border-r-2 border-slate-300 text-xs shadow-[4px_0_6px_-2px_rgba(0,0,0,0.08)]"
                        style={{ left: '330px', width: '85px' }}
                      >
                        {viewMetric === 'units' ? avgVal.toFixed(2) : formatCurrency(avgVal)}
                      </td>

                      {/* Daily Cells: Day 1 through N */}
                      {dayNumbers.map((d) => {
                        const isFuture = d > completedDays;
                        const dayData = p.days[d];
                        const val = viewMetric === 'units' ? (dayData?.units || 0) : (dayData?.sales || 0.0);
                        const maxVal = viewMetric === 'units' ? maxDayUnits : maxDaySales;
                        const colorClass = getCellColor(val, maxVal, isFuture);

                        return (
                          <td
                            key={d}
                            className={`text-center py-2 px-0.5 text-[11.5px] tabular-nums border-b border-r border-slate-200/50 ${colorClass}`}
                            style={{ width: '40px' }}
                            title={
                              isFuture
                                ? `Day ${d}: Future date`
                                : `${p.product_name}\nDay ${d}: ${formatNumber(dayData?.units || 0)} units · ${formatCurrency(dayData?.sales || 0)}`
                            }
                          >
                            {!isFuture ? (
                              viewMetric === 'units' ? (
                                val > 0 ? val : ''
                              ) : (
                                val > 0 ? (val >= 1000 ? `${Math.round(val / 1000)}k` : Math.round(val)) : ''
                              )
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer stats summary */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 pt-1">
        <span>
          Showing <strong>all {filteredProducts.length} active products</strong> across {completedDays} completed trading days in {data?.month_name || 'November 2026'}.
        </span>
        <span className="text-[11px] text-slate-400">
          Tip: Horizontal scroll lets you inspect day 1 to {daysInMonth} with locked product names.
        </span>
      </div>
    </div>
  );
}
