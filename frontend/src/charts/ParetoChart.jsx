import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { formatCurrency, formatPercent, formatStoreName } from '../utils/format';
import { Award, Info } from 'lucide-react';

export default function ParetoChart({ stores = [], storesFor80 = 0 }) {
  if (!stores || stores.length === 0) return null;

  const totalStores = stores.length;

  return (
    <div className="card p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 leading-tight">
              Store Concentration (Pareto 80/20 Analysis)
            </h3>
            {storesFor80 > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                <Award size={12} />
                {storesFor80} of {totalStores} stores make 80% of sales
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Individual store sales volume alongside cumulative share of network revenue
          </p>
        </div>
      </div>

      <div className="h-64 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={stores} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="rank"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              interval={4}
            />
            {/* Left Axis: Net Sales */}
            <YAxis
              yAxisId="left"
              tickFormatter={(v) => formatCurrency(v, { compact: true })}
              tick={{ fontSize: 10, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
            />
            {/* Right Axis: Cumulative % */}
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
              formatter={(val, name) => {
                if (name === 'Net Sales') return [formatCurrency(val), name];
                return [`${val}%`, 'Cumulative Share'];
              }}
              labelFormatter={(rank, items) => {
                const store = items?.[0]?.payload;
                return store ? `#${rank} ${formatStoreName(store.store_name)} (${store.store_type})` : `Rank #${rank}`;
              }}
              contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0' }}
            />
            <ReferenceLine yAxisId="right" y={80} stroke="#dc2626" strokeDasharray="3 3" label={{ value: '80% Line', fill: '#dc2626', fontSize: 10, position: 'insideTopRight' }} />
            <Bar yAxisId="left" dataKey="net_sales" name="Net Sales" fill="#e0e7ff" radius={[4, 4, 0, 0]} maxBarSize={16} />
            <Line yAxisId="right" type="monotone" dataKey="cum_share_pct" name="Cumulative Share" stroke="#4f46e5" strokeWidth={2.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100">
        <span>Ranked 1 to {totalStores} by Net Sales</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-indigo-200" /> Store Sales</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-1 rounded bg-indigo-600" /> Cumulative %</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 border-t border-dashed border-rose-500" /> 80% Benchmark</span>
        </span>
      </div>
    </div>
  );
}
