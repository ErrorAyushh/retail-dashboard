import { useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Legend
} from 'recharts';
import { formatCurrency, formatNumber, formatDate } from '../utils/format';

export default function ReturnTrendChart({ data = [] }) {
  const [metricMode, setMetricMode] = useState('rate'); // 'rate' | 'value'

  if (!data || data.length === 0) return null;

  return (
    <div className="card p-5 space-y-3.5 bg-white border border-slate-200/90">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 leading-tight">
              Daily Return & Exchange Trajectory
            </h3>
            <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
              Network Benchmark: 2.39%
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {metricMode === 'rate'
              ? 'Daily return rate (% of gross forward sales) compared against the 2.39% offline benchmark'
              : 'Daily value of merchandise returned and exchanged at store POS'}
          </p>
        </div>

        <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs font-semibold">
          <button
            onClick={() => setMetricMode('rate')}
            className={`px-3 py-1 rounded-md transition-all ${
              metricMode === 'rate' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Return Rate %
          </button>
          <button
            onClick={() => setMetricMode('value')}
            className={`px-3 py-1 rounded-md transition-all ${
              metricMode === 'value' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Return & Exchange Value ₹
          </button>
        </div>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 15, right: 15, bottom: 5, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="bill_date"
              tickFormatter={(v) => formatDate(v)}
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
            />
            {metricMode === 'rate' ? (
              <>
                <YAxis
                  domain={[0, 'dataMax + 1']}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <ReferenceLine
                  y={2.39}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: 'Network Avg 2.39%',
                    fill: '#dc2626',
                    fontSize: 10.5,
                    position: 'top',
                    fontWeight: 600
                  }}
                />
                <Tooltip
                  formatter={(val, name) => [
                    name === 'return_rate' ? `${val}%` : formatCurrency(val),
                    name === 'return_rate' ? 'Return Rate' : 'Gross Sales'
                  ]}
                  labelFormatter={(lbl) => formatDate(lbl)}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '10px', fontSize: '11px' }} />
                <Area
                  type="monotone"
                  dataKey="return_rate"
                  name="Return Rate %"
                  stroke="#dc2626"
                  strokeWidth={2.5}
                  fill="#fee2e2"
                  fillOpacity={0.4}
                />
              </>
            ) : (
              <>
                <YAxis
                  tickFormatter={(v) => formatCurrency(v, { compact: true })}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(val, name) => [formatCurrency(val), name]}
                  labelFormatter={(lbl) => formatDate(lbl)}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '10px', fontSize: '11px' }} />
                <Area
                  type="monotone"
                  dataKey="return_amount"
                  name="Return Value"
                  stroke="#dc2626"
                  strokeWidth={2}
                  fill="#fee2e2"
                  fillOpacity={0.4}
                />
                <Line
                  type="monotone"
                  dataKey="exchange_amount"
                  name="Exchange Value"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={false}
                />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
