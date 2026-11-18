import { useState, useMemo } from 'react';
import { ResponsiveContainer, Treemap, Tooltip } from 'recharts';
import { formatCurrency, formatPercent, formatNumber } from '../utils/format';
import { Package, Info } from 'lucide-react';

export default function ProductTreemap({ products = [], onSelectProduct }) {
  if (!products || products.length === 0) return null;

  // Take top 25 products for clean treemap readability
  const data = useMemo(() => {
    return products.slice(0, 25).map(p => ({
      name: p.product_name,
      size: p.net_sales_incl_gst || 0,
      margin_pct: p.gross_margin_pct || 0,
      units: p.sale_units || p.net_units || 0,
      dept: p.department || 'Footwear',
      gender: p.gender || 'Unisex'
    }));
  }, [products]);

  // Color generator based on margin % (higher margin = deeper indigo/emerald)
  const getColor = (marginPct) => {
    if (marginPct >= 70) return '#059669'; // Emerald-600 (High margin)
    if (marginPct >= 65) return '#4f46e5'; // Indigo-600
    if (marginPct >= 60) return '#6366f1'; // Indigo-500
    if (marginPct >= 50) return '#0284c7'; // Sky-600
    return '#d97706'; // Amber-600 (Lower margin)
  };

  const CustomizedContent = (props) => {
    const { x, y, width, height, index, name, margin_pct, size } = props;
    if (width < 38 || height < 28) return null;

    const bg = getColor(margin_pct);

    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          style={{
            fill: bg,
            stroke: '#ffffff',
            strokeWidth: 2,
            strokeOpacity: 1,
            cursor: 'pointer',
            rx: 6,
            ry: 6
          }}
          onClick={() => onSelectProduct && onSelectProduct(name)}
        />
        {width > 65 && height > 35 && (
          <text
            x={x + 8}
            y={y + 18}
            fill="#ffffff"
            fontSize={width > 120 ? 11 : 10}
            fontWeight={600}
            pointerEvents="none"
          >
            {name.length > (width / 8) ? name.slice(0, Math.floor(width / 8)) + '…' : name}
          </text>
        )}
        {width > 75 && height > 50 && (
          <text
            x={x + 8}
            y={y + 34}
            fill="#e0e7ff"
            fontSize={10}
            fontWeight={500}
            pointerEvents="none"
          >
            {formatCurrency(size)} · {margin_pct}% GM
          </text>
        )}
      </g>
    );
  };

  return (
    <div className="card p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 leading-tight">
              Product Revenue Treemap
            </h3>
            <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.2 rounded">
              Top 25 Products
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Tile area represents Net Sales volume · Color reflects Gross Margin % (Green = High GM, Amber = Lower GM)
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-600" /> &gt;70% Margin</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-indigo-600" /> 60-70% Margin</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-600" /> &lt;60% Margin</span>
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={data}
            dataKey="size"
            aspectRatio={4 / 3}
            stroke="#ffffff"
            content={<CustomizedContent />}
          >
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-slate-900 text-white rounded-lg p-2.5 shadow-xl text-xs space-y-1">
                    <div className="font-bold text-white text-[13px]">{d.name}</div>
                    <div className="text-slate-400 text-[11px]">{d.dept} · {d.gender}</div>
                    <div className="pt-1 border-t border-slate-800 grid grid-cols-2 gap-x-3 gap-y-0.5">
                      <span>Net Sales: <strong className="text-white">{formatCurrency(d.size)}</strong></span>
                      <span>Gross Margin: <strong className="text-emerald-400">{d.margin_pct}%</strong></span>
                      <span>Units Sold: <strong className="text-white">{formatNumber(d.units)}</strong></span>
                    </div>
                  </div>
                );
              }}
            />
          </Treemap>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
