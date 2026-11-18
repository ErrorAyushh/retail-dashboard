import { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceArea,
  Brush
} from 'recharts';
import { formatCurrency, formatNumber, formatPercent, formatDate } from '../utils/format';
import { ArrowUp, ArrowDown, Activity, Sparkles } from 'lucide-react';

const METRIC_TABS = [
  { key: 'net_sales_incl_gst', label: 'Net Sales', format: (v) => formatCurrency(v), unit: '₹' },
  { key: 'bills', label: 'Bills', format: (v) => formatNumber(v), unit: ' bills' },
  { key: 'net_units', label: 'Units', format: (v) => formatNumber(v), unit: ' units' },
  { key: 'aov', label: 'AOV', format: (v) => formatCurrency(v, { compact: false }), unit: '₹' },
  { key: 'margin_pct', label: 'Margin %', format: (v) => formatPercent(v), unit: '%' },
  { key: 'discount_pct', label: 'Discount %', format: (v) => formatPercent(v), unit: '%' },
];

export default function TrendChart({ data = [], height = 340 }) {
  const [metricKey, setMetricKey] = useState('net_sales_incl_gst');
  const [showBrush, setShowBrush] = useState(false);

  const activeMetric = METRIC_TABS.find((m) => m.key === metricKey) || METRIC_TABS[0];

  // Process data, identify weekends, and compute peak/low
  const { chartData, peakDay, lowDay, stats } = useMemo(() => {
    if (!data.length) return { chartData: [], peakDay: null, lowDay: null, stats: { avg: 0, peak: 0, min: 0 } };

    const mapped = data.map((d) => ({
      ...d,
      dateFormatted: formatDate(d.bill_date),
      val: d[metricKey] || 0,
      isWeekend: d.is_weekend || ['Sat', 'Sun'].includes(d.day_short),
    }));

    const vals = mapped.map((d) => d.val);
    const maxVal = Math.max(...vals);
    const minVal = Math.min(...vals);
    const avg = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);

    const peak = mapped.find((d) => d.val === maxVal);
    const low = mapped.find((d) => d.val === minVal);

    return {
      chartData: mapped,
      peakDay: peak,
      lowDay: low,
      stats: { avg, peak: maxVal, min: minVal }
    };
  }, [data, metricKey]);

  return (
    <div className="card p-5 space-y-4">
      {/* Header with Title and Metric Segmented Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 leading-tight">
              Daily Trajectory & Trendline
            </h3>
            <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
              Grey bands denote weekends
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            {peakDay && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.2 rounded">
                <ArrowUp size={11} /> Peak: {formatDate(peakDay.bill_date)} ({activeMetric.format(peakDay.val)})
              </span>
            )}
            {lowDay && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.2 rounded">
                <ArrowDown size={11} /> Low: {formatDate(lowDay.bill_date)} ({activeMetric.format(lowDay.val)})
              </span>
            )}
          </div>
        </div>

        {/* Metric Segmented Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {METRIC_TABS.map((m) => (
              <button
                key={m.key}
                onClick={() => setMetricKey(m.key)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                  metricKey === m.key
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowBrush((b) => !b)}
            className={`px-2 py-1 text-xs font-medium rounded-lg border transition-colors ${
              showBrush ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
            title="Toggle zoom brush"
          >
            Zoom
          </button>
        </div>
      </div>

      {/* Trajectory Area Chart */}
      <div style={{ height, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
            <defs>
              <linearGradient id="trendAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />

            <XAxis
              dataKey="dateFormatted"
              stroke="#94a3b8"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
            />

            <YAxis
              stroke="#94a3b8"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => activeMetric.format(v)}
            />

            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-slate-900/95 backdrop-blur-md text-white rounded-xl p-3 shadow-2xl text-xs space-y-1.5 border border-slate-800">
                    <div className="text-slate-300 font-semibold flex items-center justify-between gap-4">
                      <span>{d.bill_date} ({d.day_full || d.day_short})</span>
                      {d.isWeekend && (
                        <span className="text-[10px] font-bold bg-indigo-500/30 text-indigo-300 px-1.5 py-0.2 rounded">
                          Weekend
                        </span>
                      )}
                    </div>
                    <div className="text-lg font-bold text-white tabular-nums">
                      {activeMetric.format(d.val)}
                    </div>
                    <div className="text-[11px] text-slate-400 border-t border-slate-800 pt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
                      <span>Bills: <strong className="text-slate-200">{formatNumber(d.bills)}</strong></span>
                      <span>Units: <strong className="text-slate-200">{formatNumber(d.net_units)}</strong></span>
                      <span>AOV: <strong className="text-slate-200">{formatCurrency(d.aov, { compact: false })}</strong></span>
                      <span>Margin: <strong className="text-slate-200">{d.margin_pct}%</strong></span>
                    </div>
                  </div>
                );
              }}
            />

            {/* Shaded Weekend Bands */}
            {chartData.map((d, i) =>
              d.isWeekend ? (
                <ReferenceArea
                  key={`wk-${i}`}
                  x1={d.dateFormatted}
                  x2={d.dateFormatted}
                  fill="#f1f5f9"
                  fillOpacity={0.6}
                />
              ) : null
            )}

            <Area
              type="monotone"
              dataKey="val"
              name={activeMetric.label}
              stroke="#4f46e5"
              strokeWidth={2.5}
              fill="url(#trendAreaGrad)"
            />

            {showBrush && (
              <Brush dataKey="dateFormatted" height={24} stroke="#4f46e5" fill="#f8fafc" />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Stat Bar Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 text-xs">
        <div>
          <span className="text-slate-400 font-medium">Daily Average</span>
          <div className="font-bold text-slate-800 text-sm mt-0.5">{activeMetric.format(stats.avg)}</div>
        </div>
        <div>
          <span className="text-slate-400 font-medium">Network Peak</span>
          <div className="font-bold text-emerald-700 text-sm mt-0.5">{activeMetric.format(stats.peak)}</div>
        </div>
        <div>
          <span className="text-slate-400 font-medium">Network Lowest</span>
          <div className="font-bold text-slate-700 text-sm mt-0.5">{activeMetric.format(stats.min)}</div>
        </div>
        <div>
          <span className="text-slate-400 font-medium">Selected Days</span>
          <div className="font-bold text-slate-900 text-sm mt-0.5">{chartData.length} trading days</div>
        </div>
      </div>
    </div>
  );
}
