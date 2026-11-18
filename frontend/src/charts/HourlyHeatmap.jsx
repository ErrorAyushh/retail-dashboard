import { useMemo, useState } from 'react';
import { formatCurrency, formatHour } from '../utils/format';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 9); // Retail hours: 9 AM to 10 PM (22)

export default function HourlyHeatmap({ data = [] }) {
  const [metric, setMetric] = useState('sales'); // 'sales' | 'bills'

  // Map into lookup table: [weekday][hour] -> { sales, bills }
  const matrix = useMemo(() => {
    const map = {};
    WEEKDAYS.forEach((w) => {
      map[w] = {};
      HOURS.forEach((h) => {
        map[w][h] = { sales: 0, bills: 0 };
      });
    });

    data.forEach((d) => {
      const w = d.weekday;
      const h = Number(d.bill_hour);
      if (map[w] && map[w][h]) {
        map[w][h].sales += d.net_sales || 0;
        map[w][h].bills += d.bills || 0;
      }
    });

    return map;
  }, [data]);

  // Find max value for color intensity scaling
  const maxVal = useMemo(() => {
    let max = 1;
    WEEKDAYS.forEach((w) => {
      HOURS.forEach((h) => {
        const val = metric === 'sales' ? matrix[w][h].sales : matrix[w][h].bills;
        if (val > max) max = val;
      });
    });
    return max;
  }, [matrix, metric]);

  const getColor = (val) => {
    if (!val || val === 0) return '#f9fafb';
    const ratio = Math.min(val / maxVal, 1);
    if (ratio < 0.15) return '#e0e7ff';
    if (ratio < 0.35) return '#c7d2fe';
    if (ratio < 0.6) return '#a5b4fc';
    if (ratio < 0.85) return '#818cf8';
    return '#4f46e5';
  };

  return (
    <div className="card p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold text-gray-900 leading-tight">Hourly Trading Heatmap</h3>
          <p className="text-[12px] text-gray-400 mt-0.5">Footfall intensity across store opening hours and days</p>
        </div>
        <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50 text-[12px]">
          <button
            onClick={() => setMetric('sales')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              metric === 'sales' ? 'bg-white text-indigo-700 shadow-xs' : 'text-gray-600'
            }`}
          >
            Net Sales
          </button>
          <button
            onClick={() => setMetric('bills')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              metric === 'bills' ? 'bg-white text-indigo-700 shadow-xs' : 'text-gray-600'
            }`}
          >
            Bills Count
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          {/* Header hours */}
          <div className="grid grid-cols-[60px_repeat(14,_1fr)] gap-1 text-[11px] font-medium text-gray-400 mb-1.5 text-center">
            <span className="text-left pl-1">Day</span>
            {HOURS.map((h) => (
              <span key={h} className="truncate">{formatHour(h).replace(' ', '')}</span>
            ))}
          </div>

          {/* Weekday rows */}
          <div className="space-y-1">
            {WEEKDAYS.map((w) => (
              <div key={w} className="grid grid-cols-[60px_repeat(14,_1fr)] gap-1 items-center">
                <span className="text-[12px] font-medium text-gray-600 text-left pl-1">{w}</span>
                {HOURS.map((h) => {
                  const cell = matrix[w][h];
                  const val = metric === 'sales' ? cell.sales : cell.bills;
                  const bg = getColor(val);
                  const isDark = val / maxVal > 0.6;
                  return (
                    <div
                      key={h}
                      className="h-8 rounded flex items-center justify-center text-[10px] font-medium transition-transform hover:scale-105 cursor-default"
                      style={{ background: bg, color: isDark ? '#ffffff' : '#374151' }}
                      title={`${w} at ${formatHour(h)}: ${
                        metric === 'sales' ? formatCurrency(val, { compact: false }) : `${val} bills`
                      }`}
                    >
                      {val > 0 ? (metric === 'sales' ? formatCurrency(val, { compact: true }) : val) : '—'}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-end gap-2 text-[11px] text-gray-400 mt-3">
            <span>Low activity</span>
            <div className="flex gap-1">
              {['#e0e7ff', '#c7d2fe', '#a5b4fc', '#818cf8', '#4f46e5'].map((c) => (
                <span key={c} className="w-3.5 h-3 rounded" style={{ background: c }} />
              ))}
            </div>
            <span>Peak trade</span>
          </div>
        </div>
      </div>
    </div>
  );
}
