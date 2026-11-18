import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
  TrendingUp,
  Download,
  Search,
  Filter,
  Layers,
  ArrowUpDown,
  Award,
  Store,
  DollarSign,
  Percent,
  AlertTriangle,
  Info,
  ChevronDown,
  Grid,
  List
} from 'lucide-react';
import { api } from '../api/client';
import { useFilters } from '../context/FilterContext';
import {
  formatCurrency,
  formatPercent,
  formatNumber,
} from '../utils/format';

export default function GeographyTopProducts() {
  const { filterQueryObj } = useFilters();

  // Controls state
  const [level, setLevel] = useState('state'); // 'zone' | 'state' | 'city' | 'store'
  const [selectedGeo, setSelectedGeo] = useState('all'); // 'all' or entity name
  const [rankBy, setRankBy] = useState('net_sales'); // 'net_sales' | 'units'
  const [topN, setTopN] = useState(50); // 10 | 25 | 50
  const [categoryMode, setCategoryMode] = useState('footwear'); // 'footwear' | 'all'
  const [storeType, setStoreType] = useState('All'); // 'All' | 'Own store' | 'Franchise'

  // Heatmap metric toggle
  const [heatmapMetric, setHeatmapMetric] = useState('share_pct'); // 'share_pct' | 'index' | 'units'
  const [activeTab, setActiveTab] = useState('table'); // 'table' | 'heatmap'

  // Table local search
  const [searchQuery, setSearchQuery] = useState('');

  // API response state
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch top products whenever global filters or controls change
  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setError(null);

    api.getGeographyTopProducts(filterQueryObj, {
      store_type: storeType,
      level,
      selected_geo: selectedGeo,
      rank_by: rankBy,
      top_n: topN,
      category_mode: categoryMode
    })
      .then((res) => {
        if (!isCancelled) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error('Failed to load geography products:', err);
          setError(err.message || 'Failed to load products');
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [filterQueryObj, storeType, level, selectedGeo, rankBy, topN, categoryMode]);

  // Handle switching level: reset selectedGeo to 'all'
  const handleLevelChange = (newLevel) => {
    setLevel(newLevel);
    setSelectedGeo('all');
  };

  // Click handler for heatmap cells: filters table to that state
  const handleHeatmapCellClick = (stateName) => {
    setLevel('state');
    setSelectedGeo(stateName);
    setActiveTab('table');
  };

  const summary = data?.summary || {};
  const pickerOptions = data?.picker_options || {};
  const products = data?.products || [];
  const heatmap = data?.heatmap || { products: [], states: [], matrix: {} };

  // Current picker list based on active level
  const currentOptions = useMemo(() => {
    if (level === 'zone') return pickerOptions.zones || [];
    if (level === 'city') return pickerOptions.cities || [];
    if (level === 'store') return pickerOptions.stores || [];
    return pickerOptions.states || [];
  }, [level, pickerOptions]);

  // Filtered products based on local search
  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products;
    const q = searchQuery.toLowerCase();
    return products.filter((p) => p.product_name?.toLowerCase().includes(q));
  }, [products, searchQuery]);

  // Export to CSV
  const exportCSV = () => {
    if (!products.length) return;
    const headers = [
      'Rank',
      'Product Name',
      'Gender',
      'Sale Units',
      'Net Sales (incl. GST)',
      'Share of Geography %',
      'Discount %',
      'Gross Margin %',
      'Stores Selling',
      'Total Stores in Geo'
    ];
    const rows = products.map((p) => [
      p.rank,
      `"${p.product_name}"`,
      p.gender || 'Unisex',
      p.sale_units,
      p.net_sales_incl_gst,
      p.share_pct,
      p.discount_pct,
      p.gross_margin_pct,
      p.stores_selling,
      p.total_geo_stores
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `kadam_top_products_${level}_${selectedGeo}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden space-y-0">
      {/* 1. Header & Controls Bar */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/70 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Package size={17} className="text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                Top {topN} Products by Geography
              </h3>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                {data?.geo_label || 'All India'}
              </span>
            </div>
            <p className="text-[11.5px] text-slate-500 mt-0.5">
              Merchandise performance grouped strictly by model · Compare volume, revenue share, and network index
            </p>
          </div>

          {/* View Tab Toggle (Table vs Heatmap) & CSV Export */}
          <div className="flex items-center gap-2">
            <div className="flex items-center p-0.5 bg-slate-200/80 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                  activeTab === 'table'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <List size={13} />
                Table
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('heatmap')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                  activeTab === 'heatmap'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Grid size={13} />
                State Heatmap
              </button>
            </div>

            <button
              type="button"
              onClick={exportCSV}
              disabled={!products.length}
              className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-2xs"
            >
              <Download size={13} />
              Export CSV
            </button>
          </div>
        </div>

        {/* Controls Toolbar: Level, Picker, Rank By, Top N, Category */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-200/60">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Level Selector: Zone | State | City | Store */}
            <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 text-xs font-semibold shadow-2xs">
              <span className="px-2 text-[11px] text-slate-400 font-medium">Level:</span>
              {['zone', 'state', 'city', 'store'].map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => handleLevelChange(lvl)}
                  className={`px-2.5 py-1 rounded capitalize transition-colors ${
                    level === lvl
                      ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>

            {/* Dynamic Entity Picker */}
            <div className="relative">
              <select
                value={selectedGeo}
                onChange={(e) => setSelectedGeo(e.target.value)}
                className="appearance-none bg-white border border-slate-200 rounded-lg pl-3 pr-8 py-1.5 text-xs font-semibold text-slate-800 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs cursor-pointer max-w-[210px] truncate"
              >
                {currentOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name} ({opt.stores_count} {opt.stores_count === 1 ? 'store' : 'stores'})
                  </option>
                ))}
              </select>
              <ChevronDown
                size={13}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
            </div>

            {/* Store Type Filter: All stores (default) | Own stores | Franchise */}
            <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 text-xs font-semibold shadow-2xs">
              <span className="px-2 text-[11px] text-slate-400 font-medium">Store:</span>
              <button
                type="button"
                onClick={() => setStoreType('All')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  storeType === 'All'
                    ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Includes all 55 retail locations (Own + Franchise in Bihar, Chhattisgarh, etc.)"
              >
                All stores
              </button>
              <button
                type="button"
                onClick={() => setStoreType('Own store')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  storeType === 'Own store'
                    ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Own retail stores only (39 stores)"
              >
                Own
              </button>
              <button
                type="button"
                onClick={() => setStoreType('Franchise')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  storeType === 'Franchise'
                    ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Franchise stores only (16 stores including Patna and Raipur)"
              >
                Franchise
              </button>
            </div>

            {/* Rank By: Net sales | Units */}
            <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 text-xs font-semibold shadow-2xs">
              <span className="px-2 text-[11px] text-slate-400 font-medium">Rank by:</span>
              <button
                type="button"
                onClick={() => setRankBy('net_sales')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  rankBy === 'net_sales'
                    ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Net Sales
              </button>
              <button
                type="button"
                onClick={() => setRankBy('units')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  rankBy === 'units'
                    ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Units
              </button>
            </div>

            {/* Top N: 10 | 25 | 50 */}
            <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 text-xs font-semibold shadow-2xs">
              <span className="px-2 text-[11px] text-slate-400 font-medium">Top:</span>
              {[10, 25, 50].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setTopN(n)}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    topN === n
                      ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Footwear Only vs All Items Toggle */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 text-xs font-semibold shadow-2xs">
              <button
                type="button"
                onClick={() => setCategoryMode('footwear')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  categoryMode === 'footwear'
                    ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Footwear only
              </button>
              <button
                type="button"
                onClick={() => setCategoryMode('all')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  categoryMode === 'all'
                    ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All items
              </button>
            </div>

            {/* Footwear rule indicator badge */}
            <div
              className="text-[10.5px] px-2 py-1 rounded bg-slate-100 text-slate-600 border border-slate-200/80 max-w-[220px] truncate"
              title={data?.footwear_rule || 'Footwear rule: Excludes 6 sock lines'}
            >
              {categoryMode === 'footwear' ? 'Rule: Excludes sock lines' : 'All: Shoes + Socks'}
            </div>
          </div>
        </div>

        {/* Low Volume Warning Banner */}
        {summary.low_volume_warning && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50/90 border border-amber-200/80 rounded-lg text-amber-800 text-xs">
            <AlertTriangle size={14} className="text-amber-600 shrink-0" />
            <span>
              <strong>Low volume, treat with caution:</strong> This geography has{' '}
              {summary.total_geo_stores} store{summary.total_geo_stores === 1 ? '' : 's'} and{' '}
              {formatNumber(summary.total_geo_units)} units sold. Sample size may skew index metrics.
            </span>
          </div>
        )}
      </div>

      {/* 2. Main Body Content (Table or Heatmap) */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-xs font-medium space-y-2">
          <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <div>Computing geographic product distributions...</div>
        </div>
      ) : activeTab === 'table' ? (
        /* TABLE VIEW */
        <div className="space-y-0">
          {/* Table Search & Count Bar */}
          <div className="px-4 py-2 bg-slate-50/40 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">
                Showing {filteredProducts.length} of {products.length} products
              </span>
              <span className="text-slate-300">|</span>
              <span>
                Sorted by {rankBy === 'net_sales' ? 'Net Sales' : 'Units'}
              </span>
            </div>
            <div className="relative">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Filter by product name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg pl-7 pr-3 py-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-52"
              />
            </div>
          </div>

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 text-xs font-bold uppercase tracking-wider">
                  <th className="py-3 px-3.5 w-14 text-center">Rank</th>
                  <th className="py-3 px-3.5 min-w-[220px]">Product</th>
                  <th className="py-3 px-3.5 text-right">Units</th>
                  <th className="py-3 px-3.5 text-right">Net Sales</th>
                  <th className="py-3 px-3.5 text-right">Share of Geo %</th>
                  <th className="py-3 px-3.5 text-right">Discount %</th>
                  <th className="py-3 px-3.5 text-right">Gross Margin %</th>
                  <th className="py-3 px-3.5 text-center">Stores Selling</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                      No sales recorded for this selection.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => {
                    return (
                      <tr key={p.product_name} className="hover:bg-slate-50/80 transition-colors">
                        {/* Rank */}
                        <td className="py-3 px-3.5 text-center font-bold text-slate-500">
                          {p.rank <= 3 ? (
                            <span
                              className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                                p.rank === 1
                                  ? 'bg-amber-100 text-amber-800'
                                  : p.rank === 2
                                  ? 'bg-slate-200 text-slate-800'
                                  : 'bg-amber-50 text-amber-900'
                              }`}
                            >
                              {p.rank}
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-slate-600">{p.rank}</span>
                          )}
                        </td>

                        {/* Product Name & Gender */}
                        <td className="py-3 px-3.5">
                          <div className="font-bold text-[13.5px] text-slate-900">{p.product_name}</div>
                          <div className="text-[11.5px] text-slate-500 font-medium mt-0.5">
                            {p.gender || 'Unisex'}
                          </div>
                        </td>

                        {/* Units */}
                        <td className="py-3 px-3.5 text-right font-semibold text-[13px] text-slate-800">
                          {formatNumber(p.sale_units)}
                        </td>

                        {/* Net Sales */}
                        <td className="py-3 px-3.5 text-right font-bold text-[13px] text-slate-900">
                          {formatCurrency(p.net_sales_incl_gst)}
                        </td>

                        {/* Share of Geography % */}
                        <td className="py-3 px-3.5 text-right font-semibold text-[13px] text-indigo-700">
                          {formatPercent(p.share_pct)}
                        </td>

                        {/* Discount % */}
                        <td className="py-3 px-3.5 text-right font-semibold text-[13px] text-amber-600">
                          {formatPercent(p.discount_pct)}
                        </td>

                        {/* Gross Margin % */}
                        <td className="py-3 px-3.5 text-right font-semibold text-[13px] text-emerald-600">
                          {formatPercent(p.gross_margin_pct)}
                        </td>

                        {/* Stores Selling */}
                        <td className="py-3 px-3.5 text-center">
                          <span className="font-semibold text-[12.5px] text-slate-800">
                            {p.stores_selling} of {p.total_geo_stores}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer: Top N Concentration */}
          <div className="p-3.5 bg-slate-50/80 border-t border-slate-200/80 flex flex-wrap items-center justify-between text-xs text-slate-600">
            <div className="font-semibold text-slate-800">
              Top {topN} = {summary.top_n_share_pct}% of this geography's net sales
              <span className="text-slate-400 font-normal ml-1.5">
                ({formatCurrency(summary.top_n_sales)} of {formatCurrency(summary.total_geo_sales)})
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              Ranked by {rankBy === 'net_sales' ? 'Net Sales' : 'Units'} · All stores in selected geography
            </div>
          </div>
        </div>
      ) : (
        /* HEATMAP VIEW */
        <div className="p-4 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 p-3 rounded-xl border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold shadow-2xs">
                <span>🔥</span>
                <span>State × Product Heatmap</span>
              </div>
              <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                Top 50 Products across 16 States
              </span>
            </div>

            {/* Gradient scale bar & Metric toggle */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[11px] text-slate-500 font-medium">Low</span>
                <div
                  className="w-24 h-3 rounded-full border border-slate-200/80 shadow-2xs"
                  style={{
                    background: 'linear-gradient(to right, #fee2e2, #fed7aa, #fef08a, #86efac, #15803d)'
                  }}
                />
                <span className="text-[11px] font-bold text-slate-800">Peak</span>
              </div>

              {/* Metric Toggle: Share % | Index | Units */}
              <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 text-xs font-semibold shadow-2xs">
                <span className="px-2 text-[11px] text-slate-400 font-medium">Metric:</span>
                <button
                  type="button"
                  onClick={() => setHeatmapMetric('share_pct')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    heatmapMetric === 'share_pct'
                      ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Share %
                </button>
                <button
                  type="button"
                  onClick={() => setHeatmapMetric('index')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    heatmapMetric === 'index'
                      ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Index
                </button>
                <button
                  type="button"
                  onClick={() => setHeatmapMetric('units')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    heatmapMetric === 'units'
                      ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Units
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto scrollbar-thin border border-slate-200 rounded-xl bg-white shadow-2xs">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 text-xs font-bold uppercase tracking-wider sticky top-0 z-20">
                  <th className="py-3 px-3.5 min-w-[210px] sticky left-0 bg-slate-50 z-30 border-b border-r border-slate-200">
                    Product (Top 50)
                  </th>
                  {heatmap.states.map((st) => {
                    const stMeta = heatmap.state_meta?.[st];
                    const isFran = stMeta?.is_franchise_only && storeType === 'Own store';
                    return (
                      <th
                        key={st}
                        className={`py-3 px-2 text-center min-w-[76px] whitespace-nowrap cursor-pointer transition-colors border-b border-r border-slate-200 ${
                          isFran ? 'text-amber-700 bg-amber-50/70 hover:bg-amber-100' : 'hover:bg-slate-100'
                        }`}
                        onClick={() => {
                          if (isFran) setStoreType('All');
                          handleHeatmapCellClick(st);
                        }}
                        title={
                          isFran
                            ? `${st} has 100% Franchise stores (${stMeta?.total_stores || 2} stores). Click to switch Store filter to 'All stores'.`
                            : `Filter table by ${st}`
                        }
                      >
                        <div className="font-bold text-slate-800 text-[12px]">{st}</div>
                        {isFran && (
                          <div className="text-[10px] font-bold text-amber-600 tracking-tight">
                            (Fran only)
                          </div>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="bg-white">
                {heatmap.products.map((pName) => (
                  <tr key={pName} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3.5 font-semibold text-[13px] text-slate-900 sticky left-0 bg-white z-20 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)] border-b border-r border-slate-200 truncate max-w-[220px]" title={pName}>
                      {pName}
                    </td>
                    {heatmap.states.map((st) => {
                      const cell = heatmap.matrix[pName]?.[st] || { units: 0, net_sales: 0, share_pct: 0, index: null };
                      const units = cell.units || 0;
                      const share = cell.share_pct || 0;
                      const indexVal = cell.index;
                      const isFranOnly = cell.is_franchise_only || (heatmap.state_meta?.[st]?.is_franchise_only && storeType === 'Own store');

                      let displayVal = '—';
                      let cellClass = 'bg-slate-100/60 text-slate-400 border-slate-200/50';

                      if (isFranOnly) {
                        displayVal = (
                          <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200/80">
                            Fran only
                          </span>
                        );
                        cellClass = 'text-amber-700 bg-amber-50/40 border-amber-200/60';
                      } else if (heatmapMetric === 'share_pct') {
                        displayVal = share > 0 ? `${share.toFixed(1)}%` : '—';
                        if (share >= 6.0) cellClass = 'bg-[#15803d] text-white font-bold border-emerald-600';
                        else if (share >= 3.5) cellClass = 'bg-[#86efac] text-emerald-950 font-bold border-emerald-300';
                        else if (share >= 1.5) cellClass = 'bg-[#fef08a] text-amber-950 font-semibold border-amber-200';
                        else if (share > 0) cellClass = 'bg-[#fed7aa] text-amber-950 font-medium border-amber-200';
                      } else if (heatmapMetric === 'index') {
                        if (indexVal !== null && indexVal !== undefined) {
                          displayVal = String(indexVal);
                          if (indexVal >= 140) cellClass = 'bg-[#15803d] text-white font-bold border-emerald-600';
                          else if (indexVal >= 115) cellClass = 'bg-[#86efac] text-emerald-950 font-bold border-emerald-300';
                          else if (indexVal <= 75) cellClass = 'bg-[#fee2e2] text-rose-950 font-semibold border-rose-200';
                          else cellClass = 'bg-[#fef08a] text-amber-950 font-semibold border-amber-200';
                        } else {
                          displayVal = '—';
                        }
                      } else {
                        // Units
                        displayVal = units > 0 ? String(units) : '—';
                        if (units >= 40) cellClass = 'bg-[#15803d] text-white font-bold border-emerald-600';
                        else if (units >= 20) cellClass = 'bg-[#86efac] text-emerald-950 font-bold border-emerald-300';
                        else if (units >= 8) cellClass = 'bg-[#fef08a] text-amber-950 font-semibold border-amber-200';
                        else if (units > 0) cellClass = 'bg-[#fed7aa] text-amber-950 font-medium border-amber-200';
                      }

                      return (
                        <td
                          key={st}
                          onClick={() => {
                            if (isFranOnly) setStoreType('All');
                            handleHeatmapCellClick(st);
                          }}
                          className={`py-2 px-1 text-center cursor-pointer transition-colors border-b border-r text-[12px] font-semibold tabular-nums hover:brightness-105 ${cellClass}`}
                          title={
                            isFranOnly
                              ? `${st} has only Franchise stores (${cell.franchise_count || 2} stores). Click to switch to 'All stores' to view sales.`
                              : `${pName} in ${st}\nUnits: ${units}\nSales: ₹${cell.net_sales?.toLocaleString()}\nShare: ${share}%\nIndex: ${indexVal !== null ? indexVal : '— (<20 units)'}\n(Click to filter table)`
                          }
                        >
                          {displayVal}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
