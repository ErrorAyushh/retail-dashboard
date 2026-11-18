import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { formatCurrency, formatNumber, formatPercent } from '../utils/format';

export default function StaffScatterChart({ staff = [] }) {
  if (!staff || staff.length === 0) return null;

  const data = staff.map((s, idx) => ({
    name: s.salesman_name,
    upt: s.upt || 1.0,
    discount_pct: s.discount_pct || 0,
    sales: s.net_sales_incl_gst || 0,
    bills: s.bills || 0,
    aov: s.aov || 0,
    rank: idx + 1,
  }));

  const avgUpt = 1.35;
  const avgDiscount = 22.0;

  return (
    <div className="card p-5 space-y-3 bg-white border border-slate-200/90">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 leading-tight">
              Staff Productivity Matrix: Basket Size (UPT) vs. Discount Depth
            </h3>
            <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
              Sales Efficiency
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            X-axis: Discount % · Y-axis: Units Per Transaction (UPT) · Bubble size: Net Sales revenue
          </p>
        </div>
        <div className="text-xs text-slate-400">
          Top-Left quadrant represents optimal retail selling discipline
        </div>
      </div>

      <div className="relative h-64">
        {/* Quadrant Watermarks */}
        <div className="absolute top-2 left-12 text-[10px] font-bold text-emerald-500 pointer-events-none uppercase tracking-wider">
          Basket Builders (High UPT, Low Discount) ★
        </div>
        <div className="absolute top-2 right-4 text-[10px] font-bold text-indigo-400 pointer-events-none uppercase tracking-wider">
          Promotional Closers (High UPT, High Discount)
        </div>
        <div className="absolute bottom-6 left-12 text-[10px] font-bold text-slate-300 pointer-events-none uppercase tracking-wider">
          Standard Cashiers
        </div>
        <div className="absolute bottom-6 right-4 text-[10px] font-bold text-rose-400 pointer-events-none uppercase tracking-wider">
          Discount Reliant ⚠️
        </div>

        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 10, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              type="number"
              dataKey="discount_pct"
              name="Discount %"
              unit="%"
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="number"
              dataKey="upt"
              name="UPT"
              domain={[1, 'dataMax + 0.2']}
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
            />
            <ZAxis type="number" dataKey="sales" range={[40, 450]} />
            <ReferenceLine x={avgDiscount} stroke="#cbd5e1" strokeDasharray="3 3" />
            <ReferenceLine y={avgUpt} stroke="#cbd5e1" strokeDasharray="3 3" />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-slate-900 text-white rounded-xl p-3 shadow-xl text-xs space-y-1.5 border border-slate-700">
                    <div className="font-bold text-indigo-300 flex items-center justify-between gap-3">
                      <span>{d.name}</span>
                      <span className="text-[10px] text-slate-400">Rank #{d.rank}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1 text-[11px]">
                      <div>UPT: <strong className="text-white">{d.upt.toFixed(2)}</strong></div>
                      <div>Discount: <strong className="text-white">{d.discount_pct}%</strong></div>
                      <div>Net Sales: <strong className="text-emerald-400">{formatCurrency(d.sales)}</strong></div>
                      <div>AOV: <strong className="text-white">{formatCurrency(d.aov)}</strong></div>
                    </div>
                  </div>
                );
              }}
            />
            <Scatter name="Staff" data={data} fill="#4f46e5" fillOpacity={0.7} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
