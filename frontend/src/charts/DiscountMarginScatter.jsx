import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { formatCurrency, formatNumber, formatPercent } from '../utils/format';

export default function DiscountMarginScatter({ products = [], onSelectProduct }) {
  if (!products || products.length === 0) return null;

  const data = products.map(p => ({
    name: p.product_name,
    discount_pct: p.discount_pct || 0,
    margin_pct: p.gross_margin_pct || 0,
    units: p.sale_units || p.net_units || 0,
    sales: p.net_sales_incl_gst || 0
  }));

  const avgDiscount = 22.0;
  const avgMargin = 66.0;

  return (
    <div className="card p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 leading-tight">
              Discount % vs. Margin % Tradeoff
            </h3>
            <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.2 rounded">
              Product Efficiency
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Discount depth (x-axis) vs Gross Margin % (y-axis) · Bubble size proportional to sales units
          </p>
        </div>

        <div className="text-xs text-slate-400">
          Top-Left quadrant represents optimal profitability
        </div>
      </div>

      <div className="relative h-64">
        {/* Quadrant Labels */}
        <div className="absolute top-2 left-12 text-[10px] font-bold text-emerald-400 pointer-events-none uppercase tracking-wider">
          Margin Champions (Low Disc, High GM) ★
        </div>
        <div className="absolute top-2 right-4 text-[10px] font-bold text-indigo-300 pointer-events-none uppercase tracking-wider">
          Promotional Drivers (High Disc, High GM)
        </div>
        <div className="absolute bottom-6 left-12 text-[10px] font-bold text-slate-300 pointer-events-none uppercase tracking-wider">
          Core Staples
        </div>
        <div className="absolute bottom-6 right-4 text-[10px] font-bold text-rose-300 pointer-events-none uppercase tracking-wider">
          Erosion Risk (High Disc, Low GM) ⚠️
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
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <YAxis
              type="number"
              dataKey="margin_pct"
              name="Margin %"
              unit="%"
              domain={[40, 85]}
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <ZAxis type="number" dataKey="units" range={[40, 350]} />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-slate-900 text-white rounded-lg p-2.5 shadow-xl text-xs space-y-1">
                    <div className="font-bold text-indigo-300 text-[13px]">{d.name}</div>
                    <div className="pt-1 border-t border-slate-800 grid grid-cols-2 gap-x-3 gap-y-0.5">
                      <span>Discount: <strong className="text-white">{d.discount_pct}%</strong></span>
                      <span>Gross Margin: <strong className="text-emerald-400">{d.margin_pct}%</strong></span>
                      <span>Units Sold: <strong className="text-white">{formatNumber(d.units)}</strong></span>
                      <span>Net Sales: <strong className="text-white">{formatCurrency(d.sales)}</strong></span>
                    </div>
                  </div>
                );
              }}
            />
            <ReferenceLine x={avgDiscount} stroke="#cbd5e1" strokeDasharray="3 3" />
            <ReferenceLine y={avgMargin} stroke="#cbd5e1" strokeDasharray="3 3" />
            <Scatter name="Products" data={data} fill="#6366f1" fillOpacity={0.75} onClick={(e) => onSelectProduct && onSelectProduct(e.name)} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
