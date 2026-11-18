import { Calendar, Check } from 'lucide-react';
import Sparkline from '../charts/Sparkline';
import ChangeBadge from './ChangeBadge';
import { formatCurrency, formatNumber, formatDate } from '../utils/format';
import { useFilters } from '../context/FilterContext';

export default function HeroStrip({ items = [] }) {
  const { setDatePreset, datePreset, meta } = useFilters();

  if (!items || items.length === 0) return null;

  const minLabel = meta?.min_date ? formatDate(meta.min_date) : '13 Oct';
  const maxLabel = meta?.max_date ? formatDate(meta.max_date, { year: 'numeric' }) : 'T-1';

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <Calendar size={13} className="text-indigo-600" />
          <span>Retail Horizon Snapshot</span>
        </h2>
        <span className="text-[11px] text-slate-400 font-medium">Completed days · {minLabel} – {maxLabel}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {items.map((item) => {
          const isActive = datePreset === item.id;
          return (
            <div
              key={item.id}
              onClick={() => setDatePreset(item.id)}
              className={`card p-4.5 flex flex-col justify-between transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'border-indigo-600 bg-gradient-to-b from-indigo-50/40 via-white to-white ring-2 ring-indigo-500/20 shadow-xs'
                  : 'bg-white hover:border-slate-300 hover:shadow-xs'
              }`}
              title={`Click to filter dashboard to ${item.label}`}
            >
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    {item.label}
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">{item.period_label}</span>
                </div>

                <div className="flex items-baseline justify-between gap-2 my-1.5">
                  <div className="text-2xl font-black text-slate-900 tabular-nums tracking-tight">
                    {formatCurrency(item.net_sales)}
                  </div>
                  {item.sparkline && item.sparkline.length > 1 && (
                    <div className="w-16 h-7 shrink-0 opacity-75">
                      <Sparkline data={item.sparkline} color={isActive ? '#4f46e5' : '#64748b'} height={26} />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-2.5 mt-1 border-t border-slate-100 flex-wrap gap-1">
                <div className="text-[11.5px] text-slate-500 font-medium">
                  <strong>{formatNumber(item.bills)}</strong> bills · AOV <strong>{formatCurrency(item.aov, { compact: false })}</strong>
                </div>

                {item.prev_sales !== null && item.prev_sales !== undefined && (
                  <ChangeBadge current={item.net_sales} previous={item.prev_sales} kind="percent" size="xs" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
