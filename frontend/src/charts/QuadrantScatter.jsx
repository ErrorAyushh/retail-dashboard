import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { formatCurrency, formatStoreName } from '../utils/format';
import { Layers } from 'lucide-react';

export default function QuadrantScatter({ stores = [], avgAov = 3500, avgUpt = 1.3, onSelectStore }) {
  if (!stores || stores.length === 0) return null;

  const data = stores.map(s => ({
    store_name: s.store_name,
    clean_name: formatStoreName(s.store_name),
    store_type: s.store_type,
    aov: s.aov || 0,
    upt: s.upt || 0,
    bills: s.bills || 0,
    net_sales: s.net_sales_incl_gst || 0
  }));

  const ownStores = data.filter(s => s.store_type === 'Own store');
  const franStores = data.filter(s => s.store_type === 'Franchise');

  return (
    <div className="card p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 leading-tight">
              Store Efficiency Matrix (AOV vs UPT)
            </h3>
            <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.2 rounded">
              Quadrant Scatter
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Average Order Value (x-axis) vs Units Per Bill (y-axis) · Bubble size proportional to bill count
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-medium">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-indigo-600" /> Own Stores</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-teal-500" /> Franchise</span>
        </div>
      </div>

      <div className="relative h-72">
        {/* Quadrant Watermark Labels */}
        <div className="absolute top-2 left-12 text-[10.5px] font-bold text-slate-300 pointer-events-none uppercase tracking-wider">
          Multi-Item Volume Drivers
        </div>
        <div className="absolute top-2 right-4 text-[10.5px] font-bold text-indigo-300 pointer-events-none uppercase tracking-wider">
          High-Value Basket Builders ★
        </div>
        <div className="absolute bottom-6 left-12 text-[10.5px] font-bold text-rose-300 pointer-events-none uppercase tracking-wider">
          Underperformers
        </div>
        <div className="absolute bottom-6 right-4 text-[10.5px] font-bold text-slate-300 pointer-events-none uppercase tracking-wider">
          Premium Ticket Shoppers
        </div>

        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 10, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              type="number"
              dataKey="aov"
              name="AOV"
              unit="₹"
              tickFormatter={(v) => `₹${(v / 1000).toFixed(1)}k`}
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <YAxis
              type="number"
              dataKey="upt"
              name="UPT"
              domain={['auto', 'auto']}
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <ZAxis type="number" dataKey="bills" range={[50, 450]} />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-slate-900 text-white rounded-lg p-2.5 shadow-xl text-xs space-y-1">
                    <div className="font-bold text-indigo-300 text-[13px]">{d.clean_name}</div>
                    <div className="text-slate-400 text-[11px]">{d.store_type}</div>
                    <div className="pt-1 border-t border-slate-800 grid grid-cols-2 gap-x-3 gap-y-0.5">
                      <span>AOV: <strong className="text-white">{formatCurrency(d.aov, { compact: false })}</strong></span>
                      <span>UPT: <strong className="text-white">{d.upt.toFixed(2)}</strong></span>
                      <span>Bills: <strong className="text-white">{d.bills}</strong></span>
                      <span>Sales: <strong className="text-white">{formatCurrency(d.net_sales)}</strong></span>
                    </div>
                  </div>
                );
              }}
            />
            <ReferenceLine x={avgAov} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: `Avg AOV (₹${Math.round(avgAov)})`, fontSize: 10, fill: '#94a3b8', position: 'insideTopLeft' }} />
            <ReferenceLine y={avgUpt} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: `Avg UPT (${avgUpt})`, fontSize: 10, fill: '#94a3b8', position: 'insideBottomRight' }} />
            
            <Scatter name="Own Stores" data={ownStores} fill="#4f46e5" fillOpacity={0.75} onClick={(e) => onSelectStore && onSelectStore(e.store_name)} />
            <Scatter name="Franchise" data={franStores} fill="#0d9488" fillOpacity={0.75} onClick={(e) => onSelectStore && onSelectStore(e.store_name)} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
