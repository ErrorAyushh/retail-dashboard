import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { formatCurrency, formatNumber } from '../utils/format';
import { Tag } from 'lucide-react';

export default function PriceBandChart({ data = [] }) {
  if (!data || data.length === 0) return null;

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 leading-tight">
            MRP Price-Band Distribution
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Breakdown of revenue across product price points
          </p>
        </div>
      </div>

      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="price_band" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => formatCurrency(v, { compact: true })} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(val, name) => [
                name === 'net_sales' ? formatCurrency(val) : formatNumber(val),
                name === 'net_sales' ? 'Net Sales' : 'Units Sold'
              ]}
              contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0' }}
            />
            <Bar dataKey="net_sales" name="net_sales" fill="#4f46e5" radius={[6, 6, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
