import React, { useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Cell,
  Legend
} from 'recharts';
import { formatCurrency, formatPercent, formatNumber, formatStoreName } from '../utils/format';
import { TrendingUp, BarChart3, Grid, Building2, Store, Search } from 'lucide-react';

/**
 * Pareto 80/20 Chart for States
 * Bars = Net Sales, Line = Cumulative Share %, Reference line = 80%
 */
export function StateParetoChart({ states = [], networkTotalSales = 0 }) {
  const data = React.useMemo(() => {
    let cum = 0;
    const sorted = [...states].sort((a, b) => b.net_sales_incl_gst - a.net_sales_incl_gst);
    return sorted.map((s) => {
      cum += s.net_sales_incl_gst;
      const cumPct = networkTotalSales > 0 ? (cum / networkTotalSales) * 100 : 0;
      return {
        state: s.state,
        sales: s.net_sales_incl_gst,
        sharePct: s.share_pct,
        cumPct: Math.round(cumPct * 10) / 10,
        storesCount: s.stores_count
      };
    });
  }, [states, networkTotalSales]);

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-xs font-bold text-slate-800 tracking-tight flex items-center gap-1.5">
            <BarChart3 size={14} className="text-indigo-600" />
            State Revenue Pareto (80/20 Rule)
          </h4>
          <p className="text-[11px] text-slate-500">
            States sorted by net sales with cumulative % curve and 80% concentration threshold
          </p>
        </div>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 20, bottom: 25, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="state"
              tick={{ fontSize: 10, fill: '#64748b' }}
              angle={-35}
              textAnchor="end"
              interval={0}
              height={45}
            />
            <YAxis
              yAxisId="left"
              tickFormatter={(v) => formatCurrency(v)}
              tick={{ fontSize: 10, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 10, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value, name) => {
                if (name === 'Net Sales') return [formatCurrency(value), name];
                if (name === 'Cumulative Share') return [`${value}%`, name];
                return [value, name];
              }}
              contentStyle={{
                backgroundColor: '#0f172a',
                borderRadius: '8px',
                border: 'none',
                color: '#fff',
                fontSize: '11px',
              }}
            />
            <ReferenceLine
              yAxisId="right"
              y={80}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              label={{ value: '80% Threshold', position: 'insideTopRight', fill: '#d97706', fontSize: 10 }}
            />
            <Bar yAxisId="left" dataKey="sales" name="Net Sales" fill="#4f46e5" radius={[4, 4, 0, 0]} maxBarSize={32} />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="cumPct"
              name="Cumulative Share"
              stroke="#059669"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#059669' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * Sales Per Store By State vs Network Average
 */
export function StateSalesPerStoreChart({ states = [], networkAvgSPS = 0 }) {
  const data = React.useMemo(() => {
    return [...states]
      .sort((a, b) => b.sales_per_store - a.sales_per_store)
      .map((s) => ({
        state: s.state,
        sps: s.sales_per_store,
        storesCount: s.stores_count,
        aboveAvg: s.sales_per_store >= networkAvgSPS,
      }));
  }, [states, networkAvgSPS]);

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-xs font-bold text-slate-800 tracking-tight flex items-center gap-1.5">
            <TrendingUp size={14} className="text-emerald-600" />
            Store Productivity (Sales per Store by State)
          </h4>
          <p className="text-[11px] text-slate-500">
            Average revenue per store compared to network benchmark (₹{networkAvgSPS.toLocaleString('en-IN')})
          </p>
        </div>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 15, bottom: 25, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="state"
              tick={{ fontSize: 10, fill: '#64748b' }}
              angle={-35}
              textAnchor="end"
              interval={0}
              height={45}
            />
            <YAxis
              tickFormatter={(v) => formatCurrency(v)}
              tick={{ fontSize: 10, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value) => [formatCurrency(value), 'Sales per Store']}
              contentStyle={{
                backgroundColor: '#0f172a',
                borderRadius: '8px',
                border: 'none',
                color: '#fff',
                fontSize: '11px',
              }}
            />
            <ReferenceLine
              y={networkAvgSPS}
              stroke="#ef4444"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: `Network Avg: ${formatCurrency(networkAvgSPS)}`,
                position: 'insideTopLeft',
                fill: '#dc2626',
                fontSize: 10,
              }}
            />
            <Bar dataKey="sps" radius={[4, 4, 0, 0]} maxBarSize={32}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.aboveAvg ? '#10b981' : '#94a3b8'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * Stacked Own vs Franchise Sales by State
 */
export function StateOwnFranchiseStackedChart({ states = [], stores = [] }) {
  const data = React.useMemo(() => {
    const map = {};
    stores.forEach((st) => {
      const sName = st.state;
      if (!map[sName]) {
        map[sName] = { state: sName, ownSales: 0, franSales: 0, total: 0 };
      }
      if (st.store_type?.toLowerCase().includes('own')) {
        map[sName].ownSales += st.net_sales_incl_gst;
      } else {
        map[sName].franSales += st.net_sales_incl_gst;
      }
      map[sName].total += st.net_sales_incl_gst;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [stores]);

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-xs font-bold text-slate-800 tracking-tight flex items-center gap-1.5">
            <Building2 size={14} className="text-indigo-600" />
            Own vs Franchise Sales Split by State
          </h4>
          <p className="text-[11px] text-slate-500">
            Breakdown of company-operated vs franchise retail partner sales
          </p>
        </div>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 15, bottom: 25, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="state"
              tick={{ fontSize: 10, fill: '#64748b' }}
              angle={-35}
              textAnchor="end"
              interval={0}
              height={45}
            />
            <YAxis
              tickFormatter={(v) => formatCurrency(v)}
              tick={{ fontSize: 10, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value, name) => [formatCurrency(value), name]}
              contentStyle={{
                backgroundColor: '#0f172a',
                borderRadius: '8px',
                border: 'none',
                color: '#fff',
                fontSize: '11px',
              }}
            />
            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
            <Bar dataKey="ownSales" name="Own Stores" stackId="a" fill="#4f46e5" radius={[0, 0, 0, 0]} maxBarSize={32} />
            <Bar dataKey="franSales" name="Franchise Stores" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * State x Week Heatmap Grid
 * Displays trading momentum across states over trailing weeks
 */
export function StateWeekHeatmap({ heatmapData }) {
  const [search, setSearch] = useState('');

  if (!heatmapData || !heatmapData.rows || !heatmapData.rows.length) {
    return null;
  }

  const { weeks = [], week_metadata = [], rows = [] } = heatmapData;

  // Filter rows by state or zone
  const filteredRows = rows.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.state.toLowerCase().includes(q) ||
      (r.zone && r.zone.toLowerCase().includes(q))
    );
  });

  // Find max sales across all cells for color intensity
  let maxCellSales = 1;
  rows.forEach((r) => {
    Object.values(r.weeks || {}).forEach((val) => {
      if (val > maxCellSales) maxCellSales = val;
    });
  });

  // Calculate network totals per week across all filtered rows
  const weekTotals = {};
  weeks.forEach((w) => {
    weekTotals[w] = 0;
  });
  let grandTotal = 0;
  filteredRows.forEach((r) => {
    grandTotal += (r.total_sales || 0);
    weeks.forEach((w) => {
      weekTotals[w] += (r.weeks?.[w] || 0);
    });
  });
  const grandAvg = weeks.length ? grandTotal / weeks.length : 0;

  // Color generator matching reference heatmap palette
  const getCellColor = (val) => {
    if (!val || val <= 0) {
      return 'bg-slate-100/70 text-slate-400 border border-slate-200/50';
    }
    const ratio = val / maxCellSales;
    if (ratio >= 0.70) {
      return 'bg-[#15803d] text-white font-bold border border-emerald-600 shadow-2xs';
    }
    if (ratio >= 0.45) {
      return 'bg-[#86efac] text-emerald-950 font-bold border border-emerald-300';
    }
    if (ratio >= 0.20) {
      return 'bg-[#fef08a] text-amber-950 font-semibold border border-amber-200';
    }
    if (ratio >= 0.08) {
      return 'bg-[#fed7aa] text-amber-950 font-medium border border-amber-200';
    }
    return 'bg-[#fee2e2] text-rose-950 font-medium border border-rose-200';
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
      {/* Top Header Bar matching reference image */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold shadow-2xs">
            <span>🔥</span>
            <span>State × Week Heatmap</span>
          </div>

          <span className="text-xs text-slate-500 font-medium">
            Weekly trading momentum across states
          </span>
        </div>

        {/* Continuous Heat Scale Legend */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[11px] text-slate-500 font-medium">₹0</span>
          <div
            className="w-28 h-3 rounded-full border border-slate-200/80 shadow-2xs"
            style={{
              background: 'linear-gradient(to right, #fee2e2, #fed7aa, #fef08a, #86efac, #15803d)'
            }}
          />
          <span className="text-[11px] font-bold text-slate-800">
            {formatCurrency(maxCellSales)}
          </span>
        </div>
      </div>

      {/* Filter and stats row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Filter states in heatmap..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-8.5 pl-8.5 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-indigo-500"
          />
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Showing <strong>{filteredRows.length}</strong> of {rows.length} states
        </div>
      </div>

      {/* Heatmap Table */}
      <div className="overflow-x-auto scrollbar-thin border border-slate-200 rounded-xl bg-white">
        <table className="w-full text-left border-separate border-spacing-0">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 text-xs font-bold uppercase tracking-wider">
              <th className="py-3 px-3.5 min-w-[140px] border-b border-r border-slate-200 sticky left-0 bg-slate-50 z-20">
                State
              </th>
              <th className="py-3 px-3 min-w-[95px] border-b border-r border-slate-200">
                Zone
              </th>
              <th className="py-3 px-3 text-right min-w-[95px] border-b border-r border-slate-200">
                Total
              </th>
              <th className="py-3 px-3 text-right min-w-[95px] border-b border-r-2 border-slate-300">
                Avg / Wk
              </th>
              {weeks.map((w, idx) => {
                const meta = week_metadata.find((m) => m.week_key === w);
                return (
                  <th
                    key={w}
                    className="py-2.5 px-2 text-center w-[84px] min-w-[84px] max-w-[84px] border-b border-r border-slate-200"
                  >
                    <div className="text-xs font-bold text-slate-800">
                      {meta?.label || `W${idx + 1}`}
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium mt-0.5 whitespace-nowrap">
                      {meta?.date_range || w.slice(5)}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100 text-xs">
            {filteredRows.map((r) => (
              <tr key={r.state} className="hover:bg-slate-50/70 transition-colors">
                <td className="py-2.5 px-3.5 font-bold text-[13px] text-slate-900 border-b border-r border-slate-200 sticky left-0 bg-white hover:bg-slate-50/70 z-10">
                  {r.state}
                </td>
                <td className="py-2.5 px-3 text-slate-500 font-medium text-xs border-b border-r border-slate-200">
                  {r.zone}
                </td>
                <td className="py-2.5 px-3 font-bold text-slate-900 text-right text-xs tabular-nums border-b border-r border-slate-200">
                  {formatCurrency(r.total_sales)}
                </td>
                <td className="py-2.5 px-3 font-semibold text-slate-700 text-right text-xs tabular-nums border-b border-r-2 border-slate-300">
                  {formatCurrency(r.avg_weekly_sales)}
                </td>
                {weeks.map((w) => {
                  const val = r.weeks?.[w] || 0;
                  const meta = week_metadata.find((m) => m.week_key === w);
                  const titleStr = `${r.state} (${meta?.label || w} · ${meta?.date_range || ''}): ${formatCurrency(val)}`;
                  return (
                    <td
                      key={w}
                      className="p-1 text-center w-[84px] min-w-[84px] max-w-[84px] border-b border-r border-slate-200/60"
                    >
                      <div
                        className={`py-1.5 px-1 rounded-md text-[11.5px] font-semibold tabular-nums cursor-default ${getCellColor(
                          val
                        )}`}
                        title={titleStr}
                      >
                        {val > 0 ? formatCurrency(val) : '—'}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50/90 font-bold text-slate-900 border-t-2 border-slate-300 text-xs">
              <td className="py-3 px-3.5 border-r border-slate-200 sticky left-0 bg-slate-50/90 z-10">
                Network Total
              </td>
              <td className="py-3 px-3 text-slate-500 border-r border-slate-200">
                All Zones
              </td>
              <td className="py-3 px-3 text-right tabular-nums border-r border-slate-200 text-indigo-700">
                {formatCurrency(grandTotal)}
              </td>
              <td className="py-3 px-3 text-right tabular-nums border-r-2 border-slate-300 text-indigo-700">
                {formatCurrency(grandAvg)}
              </td>
              {weeks.map((w) => (
                <td
                  key={w}
                  className="py-3 px-1 text-center w-[84px] min-w-[84px] max-w-[84px] border-r border-slate-200 tabular-nums text-slate-900 font-bold"
                >
                  {formatCurrency(weekTotals[w] || 0)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/**
 * Multi-Store City Comparison Bar/Dot Plot
 * For cities with 2+ stores (Hyderabad, Ahmedabad, Mumbai, Bengaluru, Delhi, Jaipur, Patna, Surat)
 */
export function MultiStoreCityComparison({ cities = [], onSelectStore }) {
  const [selectedCityName, setSelectedCityName] = useState(
    cities.length ? cities[0].city : 'Hyderabad'
  );

  const activeCity = cities.find((c) => c.city === selectedCityName) || cities[0];

  if (!cities.length || !activeCity) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h4 className="text-xs font-bold text-slate-800 tracking-tight flex items-center gap-1.5">
            <Store size={14} className="text-indigo-600" />
            Intra-City Store Comparison ({activeCity.city})
          </h4>
          <p className="text-[11px] text-slate-500">
            Compare stores against city benchmark average of {formatCurrency(activeCity.city_avg)}
          </p>
        </div>

        {/* City Switcher Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-1 max-w-full">
          {cities.map((c) => (
            <button
              key={c.city}
              type="button"
              onClick={() => setSelectedCityName(c.city)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                c.city === selectedCityName
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
              }`}
            >
              {c.city} ({c.stores_count})
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {activeCity.stores.map((st) => {
          const isAbove = st.variance_pct >= 0;
          const barWidth = Math.min(100, Math.max(10, Math.abs(st.variance_pct) * 1.2));

          return (
            <div
              key={st.store_name}
              onClick={() => onSelectStore?.(st.store_name)}
              className="p-2.5 rounded-lg border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/20 cursor-pointer transition-all"
            >
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">{st.display_name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                      st.store_type?.toLowerCase().includes('own')
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/60'
                        : 'bg-amber-50 text-amber-700 border border-amber-200/60'
                    }`}
                  >
                    {st.store_type}
                  </span>
                  {st.is_new && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      New
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-slate-800">{formatCurrency(st.net_sales_incl_gst)}</span>
                  <span
                    className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                      isAbove ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {isAbove ? '+' : ''}
                    {st.variance_pct}% vs avg
                  </span>
                </div>
              </div>

              {/* Benchmark comparison bar */}
              <div className="relative w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${isAbove ? 'bg-emerald-500' : 'bg-rose-500'}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
