import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell
} from 'recharts';
import { formatCurrency } from '../utils/format';

export default function DayOfWeekBar({ data = [], height = 260 }) {
  if (!data || data.length === 0) return null;

  const maxVal = Math.max(...data.map((d) => d.avg_sales || 0));

  return (
    <div className="card p-5 space-y-3">
      <div>
        <h3 className="text-[15px] font-semibold text-gray-900 leading-tight">Average Net Sales by Weekday</h3>
        <p className="text-[12px] text-gray-400 mt-0.5">Average daily sales generated on each day of the week</p>
      </div>

      <div style={{ height, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
            <XAxis
              dataKey="day_short"
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
              tickFormatter={(v) => formatCurrency(v)}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-gray-900 text-white rounded-lg p-2.5 shadow-xl text-[12px]">
                    <div className="font-semibold text-gray-200">{d.day_name}</div>
                    <div className="text-[14px] font-bold text-white mt-1">
                      {formatCurrency(d.avg_sales, { compact: false })}
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      Sampled over {d.days_count} days
                    </div>
                  </div>
                );
              }}
            />
            <Bar dataKey="avg_sales" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => {
                const isPeak = entry.avg_sales === maxVal;
                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={isPeak ? '#4f46e5' : '#818cf8'}
                    opacity={isPeak ? 1 : 0.8}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
