import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import { formatCurrency, formatNumber, formatPercent } from '../utils/format';

export default function DiscountDepthChart({ data = [] }) {
  if (!data || data.length === 0) return null;

  return (
    <div className="card p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 leading-tight">
              Discount Depth & Margin Tradeoff Curve
            </h3>
            <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
              Dual Axis
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Forward sales revenue (bars, left axis) vs. Realized Gross Margin % (line, right axis) across discount brackets
          </p>
        </div>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 15, right: 15, bottom: 5, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="bucket"
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
            />
            {/* Left Y Axis: Sales Revenue */}
            <YAxis
              yAxisId="left"
              tickFormatter={(v) => formatCurrency(v, { compact: true })}
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
            />
            {/* Right Y Axis: Gross Margin % */}
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 11, fill: '#10b981' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(val, name) => {
                if (name === 'sales_incl_gst') return [formatCurrency(val), 'Net Sales (incl. GST)'];
                if (name === 'margin_pct') return [`${val}%`, 'Gross Margin %'];
                if (name === 'units') return [formatNumber(val), 'Units Sold'];
                return [val, name];
              }}
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '12px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
              }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              wrapperStyle={{ paddingBottom: '10px', fontSize: '11.5px' }}
            />
            <Bar
              yAxisId="left"
              dataKey="sales_incl_gst"
              name="Net Sales"
              fill="#4f46e5"
              radius={[6, 6, 0, 0]}
              maxBarSize={40}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="margin_pct"
              name="Margin %"
              stroke="#10b981"
              strokeWidth={3}
              dot={{ r: 4, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }}
              activeDot={{ r: 6 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
