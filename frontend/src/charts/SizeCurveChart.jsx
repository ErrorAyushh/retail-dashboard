import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend
} from 'recharts';
import { formatNumber } from '../utils/format';

export default function SizeCurveChart({ data = [], height = 280 }) {
  // Aggregate by size and gender
  const { sizes, chartData } = (() => {
    const sizeMap = {};
    const genderSet = new Set();

    data.forEach((d) => {
      const s = String(d.size || 'Other');
      const g = String(d.gender || 'Unspecified');
      genderSet.add(g);
      if (!sizeMap[s]) sizeMap[s] = { size: s };
      sizeMap[s][g] = (sizeMap[s][g] || 0) + (d.units || 0);
    });

    // Sort sizes numerically if possible
    const sortedSizes = Object.keys(sizeMap).sort((a, b) => {
      const na = parseFloat(a);
      const nb = parseFloat(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });

    return {
      sizes: sortedSizes,
      chartData: sortedSizes.map((s) => sizeMap[s]),
    };
  })();

  const GENDER_COLORS = {
    Men: '#4f46e5',
    Women: '#ec4899',
    Unisex: '#06b6d4',
    Unspecified: '#9ca3af',
  };

  return (
    <div className="card p-5 space-y-3">
      <div>
        <h3 className="text-[15px] font-semibold text-gray-900 leading-tight">Footwear Size Curve</h3>
        <p className="text-[12px] text-gray-400 mt-0.5">Physical units sold across UK sizes segmented by gender</p>
      </div>

      <div style={{ height, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
            <XAxis
              dataKey="size"
              stroke="#9ca3af"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
            />
            <YAxis
              stroke="#9ca3af"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatNumber(v)}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                return (
                  <div className="bg-gray-900 text-white rounded-lg p-2.5 shadow-xl text-[12px] space-y-1">
                    <div className="font-bold text-gray-200">UK Size {label}</div>
                    {payload.map((p) => (
                      <div key={p.dataKey} className="flex items-center justify-between gap-4 text-[11px]">
                        <span style={{ color: p.color }}>{p.dataKey}:</span>
                        <span className="font-medium text-white">{formatNumber(p.value)} units</span>
                      </div>
                    ))}
                  </div>
                );
              }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{ fontSize: 11, paddingBottom: 8 }}
            />
            {['Men', 'Women', 'Unisex'].map((g) => (
              <Bar key={g} dataKey={g} fill={GENDER_COLORS[g]} radius={[2, 2, 0, 0]} stackId="a" />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
