import React, { useState, useMemo } from 'react';
import mapPathsData from '../assets/india_states_paths.json';
import { formatCurrency, formatPercent, formatNumber } from '../utils/format';
import { Layers, MapPin, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

// Projection parameters matching generated SVG paths
const { min_lon, max_lon, min_lat, max_lat, width, height, pad_x, pad_y } = mapPathsData.projection;
const scale_x = (width - 2 * pad_x) / (max_lon - min_lon);
const scale_y = (height - 2 * pad_y) / (max_lat - min_lat);

export function projectLatLng(lat, lng) {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return [0, 0];
  const x = pad_x + (lng - min_lon) * scale_x;
  const y = height - (pad_y + (lat - min_lat) * scale_y);
  return [round1(x), round1(y)];
}

function round1(val) {
  return Math.round(val * 10) / 10;
}

const METRIC_CONFIG = {
  net_sales_incl_gst: {
    label: 'Net Sales',
    formatter: (v) => formatCurrency(v),
    colorScale: ['#e0e7ff', '#818cf8', '#4f46e5', '#3730a3'],
    bubbleColor: '#4f46e5',
  },
  bills: {
    label: 'Bills',
    formatter: (v) => formatNumber(v),
    colorScale: ['#f3e8ff', '#c084fc', '#9333ea', '#6b21a8'],
    bubbleColor: '#9333ea',
  },
  aov: {
    label: 'AOV',
    formatter: (v) => formatCurrency(v, { compact: false }),
    colorScale: ['#d1fae5', '#34d399', '#059669', '#065f46'],
    bubbleColor: '#059669',
  },
  upt: {
    label: 'UPT',
    formatter: (v) => (v ? v.toFixed(2) : '—'),
    colorScale: ['#cffafe', '#22d3ee', '#0891b2', '#155e75'],
    bubbleColor: '#0891b2',
  },
  sale_units: {
    label: 'Units',
    formatter: (v) => formatNumber(v),
    colorScale: ['#e0f2fe', '#38bdf8', '#0284c7', '#0369a1'],
    bubbleColor: '#0284c7',
  },
  discount_pct: {
    label: 'Discount %',
    formatter: (v) => formatPercent(v),
    colorScale: ['#fef3c7', '#fbbf24', '#f59e0b', '#b45309'],
    bubbleColor: '#f59e0b',
  },
  gross_margin_pct: {
    label: 'Gross Margin %',
    formatter: (v) => formatPercent(v),
    colorScale: ['#dcfce7', '#4ade80', '#16a34a', '#14532d'],
    bubbleColor: '#16a34a',
  },
  return_rate: {
    label: 'Return Rate',
    formatter: (v) => formatPercent(v),
    colorScale: ['#fee2e2', '#f87171', '#dc2626', '#991b1b'],
    bubbleColor: '#dc2626',
  },
  sales_per_store: {
    label: 'Sales per Store',
    formatter: (v) => formatCurrency(v),
    colorScale: ['#ede9fe', '#a78bfa', '#7c3aed', '#5b21b6'],
    bubbleColor: '#7c3aed',
  },
};

export default function IndiaGeoMap({
  statesData = [],
  citiesData = [],
  selectedMetric = 'net_sales_incl_gst',
  onSelectMetric,
  onSelectState,
  onSelectCity,
  onSelectStore,
  activeStateFilter = null,
}) {
  const [mapMode, setMapMode] = useState('choropleth'); // 'choropleth' | 'bubbles'
  const [hoveredTarget, setHoveredTarget] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const metricConfig = METRIC_CONFIG[selectedMetric] || METRIC_CONFIG.net_sales_incl_gst;

  // Build state lookup map
  const stateLookup = useMemo(() => {
    const map = {};
    statesData.forEach((st) => {
      map[st.state] = st;
      // Also map common variations
      if (st.state === 'Uttarakhand') map['Uttaranchal'] = st;
      if (st.state === 'Odisha') map['Orissa'] = st;
    });
    return map;
  }, [statesData]);

  // Compute min & max of selected metric across active states
  const { minVal, maxVal } = useMemo(() => {
    const values = statesData
      .map((s) => s[selectedMetric])
      .filter((v) => typeof v === 'number' && !isNaN(v) && v > 0);
    if (!values.length) return { minVal: 0, maxVal: 1 };
    return {
      minVal: Math.min(...values),
      maxVal: Math.max(...values),
    };
  }, [statesData, selectedMetric]);

  // Interpolate color on a 4-stop gradient
  const getColor = (val) => {
    if (val === undefined || val === null || val <= 0 || maxVal === minVal) {
      return '#f1f5f9'; // slate-100 for unmapped / 0-store states
    }
    const ratio = Math.max(0, Math.min(1, (val - minVal) / (maxVal - minVal)));
    const stops = metricConfig.colorScale;
    if (ratio < 0.33) return stops[0];
    if (ratio < 0.66) return stops[1];
    if (ratio < 0.88) return stops[2];
    return stops[3];
  };

  // Bubble max sales for radius calculation
  const maxCitySales = useMemo(() => {
    const sales = citiesData.map((c) => c.net_sales_incl_gst || 0);
    return Math.max(...sales, 1);
  }, [citiesData]);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({
      x: e.clientX - rect.left + 15,
      y: e.clientY - rect.top - 20,
    });
  };

  const resetZoom = () => {
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
      {/* Map Header Toolbar */}
      <div className="px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <MapPin size={16} />
          </div>
          <div>
            <h3 className="text-[14px] font-bold text-slate-900 tracking-tight flex items-center gap-2">
              National Geography Distribution
              {activeStateFilter && (
                <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-100/60 px-2 py-0.5 rounded-full border border-indigo-200">
                  {activeStateFilter} selected
                </span>
              )}
            </h3>
            <p className="text-[11.5px] text-slate-500">
              Choropleth by state and city retail hubs · Hover for store details
            </p>
          </div>
        </div>

        {/* Controls: Mode Toggle & Metric Selector */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Mode toggle */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setMapMode('choropleth')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                mapMode === 'choropleth'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              State Choropleth
            </button>
            <button
              type="button"
              onClick={() => setMapMode('bubbles')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                mapMode === 'bubbles'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              City Bubbles
            </button>
          </div>

          {/* Metric Selector */}
          <div className="relative">
            <select
              value={selectedMetric}
              onChange={(e) => onSelectMetric?.(e.target.value)}
              className="appearance-none bg-white border border-slate-200 rounded-lg px-3 py-1.5 pr-8 text-xs font-semibold text-slate-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="net_sales_incl_gst">Metric: Net Sales</option>
              <option value="bills">Metric: Bills</option>
              <option value="aov">Metric: AOV</option>
              <option value="upt">Metric: UPT</option>
              <option value="sale_units">Metric: Sale Units</option>
              <option value="discount_pct">Metric: Discount %</option>
              <option value="gross_margin_pct">Metric: Gross Margin %</option>
              <option value="return_rate">Metric: Return Rate</option>
              <option value="sales_per_store">Metric: Sales per Store</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Zoom controls */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-white shadow-2xs overflow-hidden">
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.25))}
              className="p-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-r border-slate-200"
              title="Zoom In"
            >
              <ZoomIn size={14} />
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(0.75, z - 0.25))}
              className="p-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-r border-slate-200"
              title="Zoom Out"
            >
              <ZoomOut size={14} />
            </button>
            <button
              type="button"
              onClick={resetZoom}
              className="p-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              title="Reset View"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Map Canvas Area */}
      <div
        className="relative w-full overflow-hidden bg-slate-50/30 flex items-center justify-center select-none"
        style={{ minHeight: '520px' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredTarget(null)}
      >
        <svg
          viewBox={mapPathsData.viewBox}
          className="w-full h-auto max-h-[640px] drop-shadow-xs transition-transform duration-150 ease-out"
          style={{
            transform: `scale(${zoomLevel}) translate(${pan.x}px, ${pan.y}px)`,
            transformOrigin: 'center center',
          }}
        >
          {/* Base States Layer */}
          <g className="states-layer">
            {mapPathsData.states.map((stObj) => {
              const stateName = stObj.state;
              const stData = stateLookup[stateName];
              const isCovered = Boolean(stData && stData.stores_count > 0);
              const metricVal = stData ? stData[selectedMetric] : 0;
              const isSelected = activeStateFilter === stateName;

              let fillColor = '#f8fafc'; // Default empty state
              if (mapMode === 'choropleth') {
                fillColor = isCovered ? getColor(metricVal) : '#f1f5f9';
              } else {
                // Bubbles mode background
                fillColor = isCovered ? '#e2e8f0' : '#f8fafc';
              }

              return (
                <path
                  key={stateName}
                  d={stObj.d}
                  fill={fillColor}
                  stroke={isSelected ? '#312e81' : isCovered ? '#94a3b8' : '#cbd5e1'}
                  strokeWidth={isSelected ? '2.5' : isCovered ? '1.2' : '0.6'}
                  className={`transition-colors duration-150 ${
                    isCovered ? 'cursor-pointer hover:opacity-90' : 'cursor-default'
                  }`}
                  onMouseEnter={() => {
                    if (isCovered) {
                      setHoveredTarget({
                        type: 'state',
                        data: stData,
                      });
                    }
                  }}
                  onClick={() => {
                    if (isCovered) onSelectState?.(stateName);
                  }}
                />
              );
            })}
          </g>

          {/* City Bubbles Layer (When in 'bubbles' mode) */}
          {mapMode === 'bubbles' && (
            <g className="city-bubbles-layer">
              {citiesData.map((city) => {
                const [cx, cy] = projectLatLng(city.lat, city.lng);
                if (cx === 0 && cy === 0) return null;

                const sales = city.net_sales_incl_gst || 0;
                // Radius scale between 7px and 26px
                const radius = Math.max(7, Math.min(26, 7 + Math.sqrt(sales / maxCitySales) * 19));
                const isSelected = activeStateFilter === city.state;
                const isOwnOnly = city.own_count > 0 && city.franchise_count === 0;
                const isFranchiseOnly = city.franchise_count > 0 && city.own_count === 0;

                return (
                  <g
                    key={city.city}
                    className="cursor-pointer transition-transform hover:scale-110"
                    onMouseEnter={() => {
                      setHoveredTarget({
                        type: 'city',
                        data: city,
                      });
                    }}
                    onClick={() => onSelectCity?.(city)}
                  >
                    {/* Pulsing glow under high volume cities */}
                    {sales > maxCitySales * 0.4 && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={radius + 4}
                        fill={metricConfig.bubbleColor}
                        opacity="0.18"
                        className="animate-pulse"
                      />
                    )}

                    {/* Main City Bubble */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={radius}
                      fill={metricConfig.bubbleColor}
                      opacity={isSelected ? '0.95' : '0.82'}
                      stroke={isFranchiseOnly ? '#f59e0b' : '#ffffff'}
                      strokeWidth={isFranchiseOnly ? '2.5' : '2'}
                      strokeDasharray={isFranchiseOnly ? '3,2' : undefined}
                    />

                    {/* Own vs Franchise visual indicator */}
                    {!isOwnOnly && !isFranchiseOnly && (
                      /* Mixed City ring */
                      <circle
                        cx={cx}
                        cy={cy}
                        r={radius - 3}
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="1.5"
                        strokeDasharray="2,2"
                      />
                    )}

                    {/* Store count number label inside bubble */}
                    {radius >= 12 && (
                      <text
                        x={cx}
                        y={cy + 3.5}
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="9.5"
                        fontWeight="700"
                        className="pointer-events-none"
                      >
                        {city.stores_count}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          )}
        </svg>

        {/* Legend Panel Bottom Left */}
        <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-xs border border-slate-200/90 rounded-lg p-2.5 shadow-md text-xs z-10 max-w-[240px]">
          <div className="font-bold text-slate-800 text-[11px] mb-1.5 flex items-center justify-between">
            <span>{metricConfig.label} Scale</span>
            <span className="text-[10px] text-slate-400 font-normal">Active States</span>
          </div>

          {mapMode === 'choropleth' ? (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <div
                  className="h-2.5 flex-1 rounded"
                  style={{
                    background: `linear-gradient(to right, ${metricConfig.colorScale.join(', ')})`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-medium text-slate-500">
                <span>{metricConfig.formatter(minVal)}</span>
                <span>{metricConfig.formatter(maxVal)}</span>
              </div>
              <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100 text-[10px] text-slate-400">
                <span className="w-2.5 h-2.5 rounded bg-slate-100 border border-slate-200" />
                <span>No retail store presence</span>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 text-[10.5px]">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-indigo-600 border border-white" />
                <span className="text-slate-700">Own Stores Only</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-amber-500 border-2 border-dashed border-white" />
                <span className="text-slate-700">Franchise Only</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-indigo-600 border-2 border-white ring-1 ring-amber-400" />
                <span className="text-slate-700">Mixed (Own + Franchise)</span>
              </div>
              <p className="text-[9.5px] text-slate-400 pt-0.5 border-t border-slate-100">
                Bubble radius is proportional to Net Sales
              </p>
            </div>
          )}
        </div>

        {/* Hover Tooltip Popup */}
        {hoveredTarget && (
          <div
            className="absolute z-20 pointer-events-none bg-slate-900/95 backdrop-blur-md text-white rounded-lg p-3 shadow-xl border border-slate-700/60 max-w-[260px] text-xs transition-opacity duration-150"
            style={{
              left: `${Math.min(tooltipPos.x, width - 200)}px`,
              top: `${Math.max(10, tooltipPos.y - 100)}px`,
            }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-700 pb-1.5 mb-2">
              <div>
                <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider block">
                  {hoveredTarget.type === 'state' ? 'State' : 'City Hub'}
                </span>
                <span className="font-bold text-sm text-white">
                  {hoveredTarget.type === 'state'
                    ? hoveredTarget.data.state
                    : `${hoveredTarget.data.city}, ${hoveredTarget.data.state}`}
                </span>
              </div>
              <span className="text-[11px] font-semibold px-2 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700">
                {hoveredTarget.data.stores_count} {hoveredTarget.data.stores_count === 1 ? 'store' : 'stores'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
              <div>
                <span className="text-slate-400 block text-[10px]">Net Sales</span>
                <span className="font-semibold text-white">
                  {formatCurrency(hoveredTarget.data.net_sales_incl_gst)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Network Share</span>
                <span className="font-semibold text-indigo-300">
                  {formatPercent(hoveredTarget.data.share_pct)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">AOV</span>
                <span className="font-semibold text-white">
                  {formatCurrency(hoveredTarget.data.aov, { compact: false })}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Discount %</span>
                <span className="font-semibold text-amber-400">
                  {formatPercent(hoveredTarget.data.discount_pct)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Gross Margin</span>
                <span className="font-semibold text-emerald-400">
                  {formatPercent(hoveredTarget.data.gross_margin_pct)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Period Change</span>
                <span
                  className={`font-semibold ${
                    hoveredTarget.data.change_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {hoveredTarget.data.change_pct >= 0 ? '↑' : '↓'}{' '}
                  {Math.abs(hoveredTarget.data.change_pct).toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="mt-2 pt-1.5 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
              <span>
                {hoveredTarget.data.own_count} Own · {hoveredTarget.data.franchise_count} Fran
              </span>
              <span className="text-indigo-400">Click to filter</span>
            </div>
          </div>
        )}
      </div>

      {/* Map Footnote Banner */}
      <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 text-[11px] text-slate-500 flex items-center justify-between">
        <span>* Bubble coordinates denote approximate city centres, not store addresses.</span>
        <span className="text-slate-400">India administrative boundaries (ODbL)</span>
      </div>
    </div>
  );
}
