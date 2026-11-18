import React, { useEffect, useState, useMemo } from 'react';
import {
  MapPin,
  Building2,
  Store,
  TrendingUp,
  Percent,
  Layers,
  ChevronDown,
  ChevronRight,
  Info,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import PageShell from '../components/PageShell';
import IndiaGeoMap from '../charts/IndiaGeoMap';
import {
  StateOwnFranchiseStackedChart,
  StateWeekHeatmap,
  MultiStoreCityComparison,
} from '../charts/GeographyCharts';
import Sparkline from '../charts/Sparkline';
import GeographyTopProducts from '../components/GeographyTopProducts';
import StoreDrawer from '../components/StoreDrawer';
import StateDrawer from '../components/StateDrawer';
import { useFilters } from '../context/FilterContext';
import { api } from '../api/client';
import {
  formatCurrency,
  formatPercent,
  formatNumber,
  formatStoreName,
} from '../utils/format';

export default function Geography() {
  const { filterQueryObj, setFilter } = useFilters();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Map Metric selector
  const [selectedMapMetric, setSelectedMapMetric] = useState('net_sales_incl_gst');

  // Mature stores only toggle
  const [matureOnly, setMatureOnly] = useState(false);

  // Selected State / Store drawers
  const [selectedStateData, setSelectedStateData] = useState(null);
  const [selectedStoreName, setSelectedStoreName] = useState(null);

  // Expanded city rows in the City Table
  const [expandedCities, setExpandedCities] = useState(new Set());

  // Search filter inside tables
  const [tableSearch, setTableSearch] = useState('');
  const [activeTableTab, setActiveTableTab] = useState('states'); // 'states' | 'cities'

  const loadData = () => {
    setLoading(true);
    setError(null);
    api.getGeography(filterQueryObj, matureOnly)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load geography data:', err);
        setError(err.message || 'Failed to load geography data');
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, [filterQueryObj, matureOnly]);

  const toggleExpandCity = (cityName) => {
    setExpandedCities((prev) => {
      const next = new Set(prev);
      if (next.has(cityName)) next.delete(cityName);
      else next.add(cityName);
      return next;
    });
  };

  const handleSelectState = (stateName) => {
    const stObj = data?.states?.find((s) => s.state === stateName);
    if (stObj) {
      setSelectedStateData(stObj);
    }
  };

  const handleSelectCity = (cityObj) => {
    // Open the state drawer containing this city or filter by state
    const stObj = data?.states?.find((s) => s.state === cityObj.state);
    if (stObj) {
      setSelectedStateData(stObj);
    }
  };

  const handleApplyStateFilter = (stateName) => {
    setFilter('region', stateName);
  };

  const summary = data?.summary || {};
  const states = data?.states || [];
  const cities = data?.cities || [];
  const zones = data?.zones || [];
  const stores = data?.stores || [];
  const multiStoreCities = data?.multi_store_cities || [];
  const heatmapData = data?.state_week_heatmap || {};
  const insights = data?.insights || [];
  const topProducts = data?.top_products || [];

  // Filtered tables
  const filteredStates = useMemo(() => {
    if (!tableSearch) return states;
    const q = tableSearch.toLowerCase();
    return states.filter(
      (s) => s.state.toLowerCase().includes(q) || s.zone.toLowerCase().includes(q)
    );
  }, [states, tableSearch]);

  const filteredCities = useMemo(() => {
    if (!tableSearch) return cities;
    const q = tableSearch.toLowerCase();
    return cities.filter(
      (c) =>
        c.city.toLowerCase().includes(q) ||
        c.state.toLowerCase().includes(q) ||
        c.zone.toLowerCase().includes(q)
    );
  }, [cities, tableSearch]);

  return (
    <PageShell
      title="Geography & Retail Network"
      subtitle="Performance across 16 states, 34 cities, and 4 zones · Completed trading days"
      onRefresh={loadData}
    >
      {/* Top Banner Toolbar: Mature stores toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-slate-800">
            55 Stores Mapped Across India · 0 Unmapped
          </span>
          {summary.new_stores_count > 0 && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              {summary.new_stores_count} New Stores (Opened post 13 Oct)
            </span>
          )}
        </div>

        {/* Mature Stores Only Switch */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600 font-medium">Mature Stores Only</span>
          <button
            type="button"
            onClick={() => setMatureOnly((prev) => !prev)}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              matureOnly ? 'bg-indigo-600' : 'bg-slate-300'
            }`}
            title="Excludes newly opened stores (Nashik, ASRao Hyderabad, Creekside Ludhiana) from averages & rankings"
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                matureOnly ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
          <span className="text-[11px] text-slate-400">
            {matureOnly ? '(Excludes 3 new stores)' : '(All stores included)'}
          </span>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* 1. States Covered */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            States Covered
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {summary.states_covered || 16}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Across 4 macro zones</div>
        </div>

        {/* 2. Cities Covered */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Cities Covered
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {summary.cities_covered || 34}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">34 distinct retail hubs</div>
        </div>

        {/* 3. Retail Stores */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Retail Stores
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {summary.active_stores_count || 55}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            39 Own · 16 Franchise
          </div>
        </div>

        {/* 4. Net Sales */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Net Sales (incl. GST)
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {formatCurrency(summary.net_sales)}
          </div>
          <div
            className={`text-[11px] font-semibold mt-1 flex items-center gap-1 ${
              summary.sales_delta_pct >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {summary.sales_delta_pct >= 0 ? '↑' : '↓'} {Math.abs(summary.sales_delta_pct)}% vs prev
          </div>
        </div>

        {/* 5. Sales Per Store */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Sales per Store
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {formatCurrency(summary.sales_per_store)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Network store average</div>
        </div>

        {/* 6. Top State Share */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Top State Share
          </div>
          <div className="text-2xl font-black text-indigo-600 tracking-tight">
            {formatPercent(summary.top_state_share)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-medium truncate">
            {summary.top_state_name}
          </div>
        </div>
      </div>

      {/* Hero Interactive India Map Card */}
      <IndiaGeoMap
        statesData={states}
        citiesData={cities}
        selectedMetric={selectedMapMetric}
        onSelectMetric={setSelectedMapMetric}
        onSelectState={handleSelectState}
        onSelectCity={handleSelectCity}
        onSelectStore={(sName) => setSelectedStoreName(sName)}
        activeStateFilter={filterQueryObj.regions?.[0]}
      />

      {/* Top 50 Products by Geography Section */}
      <GeographyTopProducts />

      {/* Zone Cards Strip (North, West, South, Central & East) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Macro Zone Breakdown
          </h3>
          <span className="text-[11px] text-slate-400">4 Operational Zones</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {zones.map((zn) => (
            <div
              key={zn.zone}
              className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs hover:border-indigo-300 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-900">{zn.zone} Zone</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                  {zn.stores_count} stores
                </span>
              </div>
              <div className="text-xl font-black text-slate-900 tracking-tight">
                {formatCurrency(zn.net_sales_incl_gst)}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100">
                <span>{formatPercent(zn.share_pct)} share</span>
                <span>Avg: {formatCurrency(zn.sales_per_store)}</span>
                <span
                  className={`font-semibold ${
                    zn.change_pct >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {zn.change_pct >= 0 ? '↑' : '↓'} {Math.abs(zn.change_pct)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Automated Rule-Based Insights Card */}
      {insights.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Sparkles size={14} />
            </div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Computed Geographic Insights
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {insights.map((ins) => (
              <div
                key={ins.id}
                className="p-3 rounded-lg border border-slate-100 bg-slate-50/70 space-y-1"
              >
                <div className="flex items-center gap-1.5">
                  {ins.severity === 'danger' && <AlertTriangle size={13} className="text-rose-600" />}
                  {ins.severity === 'warning' && <AlertTriangle size={13} className="text-amber-600" />}
                  {ins.severity === 'success' && <CheckCircle2 size={13} className="text-emerald-600" />}
                  {ins.severity === 'info' && <Info size={13} className="text-indigo-600" />}
                  <span className="text-xs font-bold text-slate-900 leading-tight">
                    {ins.title}
                  </span>
                </div>
                <p className="text-[11.5px] text-slate-600 leading-relaxed">
                  {ins.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* State & City Performance Tables */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Table View Tabs & Search */}
        <div className="p-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveTableTab('states')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeTableTab === 'states'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              State Breakdown ({states.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTableTab('cities')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeTableTab === 'cities'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              City Hubs ({cities.length})
            </button>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder={`Search ${activeTableTab}...`}
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg pl-3 pr-8 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-48"
            />
          </div>
        </div>

        {/* State Table */}
        {activeTableTab === 'states' && (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-700 text-[11.5px] font-bold uppercase tracking-wider">
                  <th className="py-3 px-3">State</th>
                  <th className="py-3 px-2.5">Zone</th>
                  <th className="py-3 px-2.5 text-center">Stores</th>
                  <th className="py-3 px-3 text-right">Net Sales</th>
                  <th className="py-3 px-2.5 text-right">Share %</th>
                  <th className="py-3 px-3 text-right">Sales / Store</th>
                  <th className="py-3 px-2 text-right">Bills</th>
                  <th className="py-3 px-2 text-right">AOV</th>
                  <th className="py-3 px-2 text-right">UPT</th>
                  <th className="py-3 px-2 text-right">Disc %</th>
                  <th className="py-3 px-2 text-right">Margin %</th>
                  <th className="py-3 px-2 text-right">Return %</th>
                  <th className="py-3 px-3 text-center min-w-[95px]">14D Trend</th>
                  <th className="py-3 px-2.5 text-right">Growth Contrib</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[13px]">
                {filteredStates.map((st) => (
                  <tr
                    key={st.state}
                    onClick={() => handleSelectState(st.state)}
                    className="hover:bg-indigo-50/40 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-3 font-bold text-slate-900 text-[13.5px]">{st.state}</td>
                    <td className="py-2.5 px-2.5 text-slate-500 font-medium text-[12px]">{st.zone}</td>
                    <td className="py-2.5 px-2.5 text-center align-middle">
                      <div className="font-bold text-[13px] text-slate-900 leading-tight">
                        {st.stores_count}
                      </div>
                      <div className="text-[10.5px] font-medium text-slate-400 mt-0.5 leading-tight whitespace-nowrap">
                        {st.own_count}O · {st.franchise_count}F
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900 tabular-nums">
                      {formatCurrency(st.net_sales_incl_gst)}
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-semibold text-indigo-700 tabular-nums">
                      {formatPercent(st.share_pct)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-slate-800 tabular-nums">
                      {formatCurrency(st.sales_per_store)}
                    </td>
                    <td className="py-2.5 px-2 text-right text-slate-700 font-medium tabular-nums">
                      {formatNumber(st.bills)}
                    </td>
                    <td className="py-2.5 px-2 text-right text-slate-700 font-medium tabular-nums">
                      {formatCurrency(st.aov, { compact: false })}
                    </td>
                    <td className="py-2.5 px-2 text-right text-slate-700 font-medium tabular-nums">
                      {st.upt?.toFixed(2) || '—'}
                    </td>
                    <td className="py-2.5 px-2 text-right font-semibold text-amber-600 tabular-nums">
                      {formatPercent(st.discount_pct)}
                    </td>
                    <td className="py-2.5 px-2 text-right font-semibold text-emerald-600 tabular-nums">
                      {formatPercent(st.gross_margin_pct)}
                    </td>
                    <td className="py-2.5 px-2 text-right font-semibold text-rose-600 tabular-nums">
                      {formatPercent(st.return_rate)}
                    </td>
                    <td className="py-2.5 px-3 text-center align-middle">
                      <div className="h-6 w-20 mx-auto flex items-center justify-center">
                        <Sparkline data={st.sparkline} color="#4f46e5" height={24} width={80} />
                      </div>
                    </td>
                    <td className="py-2.5 px-2.5 text-right tabular-nums">
                      <span
                        className={`font-bold ${
                          st.growth_contribution >= 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {st.growth_contribution > 0 ? '+' : ''}
                        {st.growth_contribution}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* City Table with Expandable Store Rows */}
        {activeTableTab === 'cities' && (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-700 text-[11.5px] font-bold uppercase tracking-wider">
                  <th className="py-3 px-3">City Hub</th>
                  <th className="py-3 px-2.5">State</th>
                  <th className="py-3 px-2.5 text-center">Stores</th>
                  <th className="py-3 px-3 text-right">Net Sales</th>
                  <th className="py-3 px-2.5 text-right">Share %</th>
                  <th className="py-3 px-3 text-right">Sales / Store</th>
                  <th className="py-3 px-2 text-right">Bills</th>
                  <th className="py-3 px-2 text-right">AOV</th>
                  <th className="py-3 px-2 text-right">UPT</th>
                  <th className="py-3 px-2 text-right">Disc %</th>
                  <th className="py-3 px-2 text-right">Margin %</th>
                  <th className="py-3 px-2.5 text-right">Change %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[13px]">
                {filteredCities.map((ct) => {
                  const isExpanded = expandedCities.has(ct.city);
                  return (
                    <React.Fragment key={ct.city}>
                      <tr
                        onClick={() => toggleExpandCity(ct.city)}
                        className="hover:bg-indigo-50/40 cursor-pointer transition-colors"
                      >
                        <td className="py-2.5 px-3 font-bold text-slate-900 text-[13.5px] flex items-center gap-1.5">
                          {ct.stores?.length > 1 ? (
                            isExpanded ? <ChevronDown size={14} className="text-indigo-600 shrink-0" /> : <ChevronRight size={14} className="text-slate-400 shrink-0" />
                          ) : (
                            <span className="w-3.5 inline-block shrink-0" />
                          )}
                          <span>{ct.city}</span>
                        </td>
                        <td className="py-2.5 px-2.5 text-slate-500 font-medium text-[12px]">{ct.state}</td>
                        <td className="py-2.5 px-2.5 text-center align-middle">
                          <div className="font-bold text-[13px] text-slate-900 leading-tight">
                            {ct.stores_count}
                          </div>
                          <div className="text-[10.5px] font-medium text-slate-400 mt-0.5 leading-tight whitespace-nowrap">
                            {ct.own_count}O · {ct.franchise_count}F
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 tabular-nums">
                          {formatCurrency(ct.net_sales_incl_gst)}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-semibold text-indigo-700 tabular-nums">
                          {formatPercent(ct.share_pct)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-slate-800 tabular-nums">
                          {formatCurrency(ct.sales_per_store)}
                        </td>
                        <td className="py-2.5 px-2 text-right text-slate-700 font-medium tabular-nums">
                          {formatNumber(ct.bills)}
                        </td>
                        <td className="py-2.5 px-2 text-right text-slate-700 font-medium tabular-nums">
                          {formatCurrency(ct.aov, { compact: false })}
                        </td>
                        <td className="py-2.5 px-2 text-right text-slate-700 font-medium tabular-nums">
                          {ct.upt?.toFixed(2) || '—'}
                        </td>
                        <td className="py-2.5 px-2 text-right font-semibold text-amber-600 tabular-nums">
                          {formatPercent(ct.discount_pct)}
                        </td>
                        <td className="py-2.5 px-2 text-right font-semibold text-emerald-600 tabular-nums">
                          {formatPercent(ct.gross_margin_pct)}
                        </td>
                        <td className="py-2.5 px-2.5 text-right tabular-nums">
                          <span
                            className={`font-bold ${
                              ct.change_pct >= 0 ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {ct.change_pct >= 0 ? '↑' : '↓'} {Math.abs(ct.change_pct)}%
                          </span>
                        </td>
                      </tr>

                      {/* Expandable store children */}
                      {isExpanded &&
                        ct.stores?.map((st) => (
                          <tr
                            key={st.store_name}
                            onClick={() => setSelectedStoreName(st.store_name)}
                            className="bg-slate-50/70 hover:bg-indigo-50/50 cursor-pointer text-slate-700 text-[12.5px]"
                          >
                            <td className="py-2 pl-8 pr-3 font-semibold text-slate-800 flex items-center gap-2">
                              <Store size={14} className="text-slate-400" />
                              <span>{st.display_name}</span>
                              {st.is_new && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  New
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-2.5 text-[11.5px] text-slate-500 font-medium">
                              {st.store_type}
                            </td>
                            <td className="py-2 px-2.5 text-center text-[11px] text-slate-400 font-medium">
                              Store
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-slate-900 tabular-nums">
                              {formatCurrency(st.net_sales_incl_gst)}
                            </td>
                            <td className="py-2 px-2.5 text-right text-[11.5px] text-slate-400">
                              —
                            </td>
                            <td className="py-2 px-3 text-right text-slate-700 font-medium tabular-nums">
                              {formatCurrency(st.net_sales_incl_gst)}
                            </td>
                            <td className="py-2 px-2 text-right text-slate-700 font-medium tabular-nums">
                              {formatNumber(st.bills)}
                            </td>
                            <td className="py-2 px-2 text-right text-slate-700 font-medium tabular-nums">
                              {formatCurrency(st.aov, { compact: false })}
                            </td>
                            <td className="py-2 px-2 text-right text-slate-700 font-medium tabular-nums">
                              {st.upt?.toFixed(2) || '—'}
                            </td>
                            <td className="py-2 px-2 text-right font-semibold text-amber-600 tabular-nums">
                              {formatPercent(st.discount_pct)}
                            </td>
                            <td className="py-2 px-2 text-right font-semibold text-emerald-600 tabular-nums">
                              {formatPercent(st.gross_margin_pct)}
                            </td>
                            <td className="py-2 px-2.5 text-right tabular-nums">
                              <span
                                className={`font-semibold ${
                                  st.sales_delta_pct >= 0 ? 'text-emerald-700' : 'text-rose-700'
                                }`}
                              >
                                {st.sales_delta_pct > 0 ? '+' : ''}
                                {st.sales_delta_pct}%
                              </span>
                            </td>
                          </tr>
                        ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Stacked Own vs Franchise sales by state */}
        <StateOwnFranchiseStackedChart states={states} stores={stores} />

        {/* Intra-City Multi-Store Comparison */}
        <MultiStoreCityComparison
          cities={multiStoreCities}
          onSelectStore={(sName) => setSelectedStoreName(sName)}
        />
      </div>

      {/* State x Week Net Sales Heatmap */}
      <StateWeekHeatmap heatmapData={heatmapData} />

      {/* Footnotes & Caveats Checklist */}
      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 text-xs text-slate-500 space-y-1.5">
        <div className="font-bold text-slate-700 flex items-center gap-1.5">
          <Info size={14} className="text-slate-500" />
          Geography Data Caveats & Methodology
        </div>
        <ul className="list-disc pl-5 space-y-1 text-[11px] text-slate-600">
          <li>
            <strong>Approximate coordinates:</strong> Map locations represent approximate city centres from open geographic datasets, never confidential store street addresses.
          </li>
          <li>
            <strong>Franchise sell-out:</strong> Franchise numbers represent end-consumer billed retail sell-out value, not Neemans wholesale billing to partners.
          </li>
          <li>
            <strong>History window:</strong> Data history spans from 13 Oct 2026 onwards to T-1 completed days. No year-on-year comparisons or full-year seasonality assertions are implied.
          </li>
          <li>
            <strong>New stores:</strong> Stores opened post 13 Oct 2026 (Nashik, ASRao Hyderabad, Creekside Ludhiana) have shorter trading windows and lower cumulative revenue. Use the "Mature stores only" toggle to normalize productivity averages.
          </li>
        </ul>
      </div>

      {/* State Side Drawer */}
      <StateDrawer
        stateData={selectedStateData}
        isOpen={Boolean(selectedStateData)}
        onClose={() => setSelectedStateData(null)}
        onFilterState={handleApplyStateFilter}
        onSelectStore={(sName) => setSelectedStoreName(sName)}
      />

      {/* Store Scorecard Drawer */}
      <StoreDrawer
        storeName={selectedStoreName}
        filters={filterQueryObj}
        isOpen={Boolean(selectedStoreName)}
        onClose={() => setSelectedStoreName(null)}
      />
    </PageShell>
  );
}
