import { 
  TrendingUp, 
  Receipt, 
  ShoppingBag, 
  CreditCard, 
  Package, 
  Percent, 
  RotateCcw, 
  Tag, 
  ArrowUpRight,
  ShieldCheck,
  ArrowRightLeft
} from 'lucide-react';
import ChangeBadge from './ChangeBadge';
import InfoTip from './InfoTip';
import Sparkline from '../charts/Sparkline';

// Visual icon & accent color mapper based on metric key
const METRIC_THEMES = {
  net_sales_incl_gst: { icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50/80', border: 'border-indigo-100' },
  gross_sales: { icon: Receipt, color: 'text-sky-600', bg: 'bg-sky-50/80', border: 'border-sky-100' },
  bills: { icon: ShoppingBag, color: 'text-blue-600', bg: 'bg-blue-50/80', border: 'border-blue-100' },
  aov: { icon: CreditCard, color: 'text-amber-600', bg: 'bg-amber-50/80', border: 'border-amber-100' },
  upt: { icon: Package, color: 'text-purple-600', bg: 'bg-purple-50/80', border: 'border-purple-100' },
  discount_pct: { icon: Tag, color: 'text-orange-600', bg: 'bg-orange-50/80', border: 'border-orange-100' },
  gross_margin: { icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50/80', border: 'border-emerald-100' },
  gross_margin_pct: { icon: Percent, color: 'text-emerald-600', bg: 'bg-emerald-50/80', border: 'border-emerald-100' },
  returns: { icon: RotateCcw, color: 'text-rose-600', bg: 'bg-rose-50/80', border: 'border-rose-100' },
  exchanges: { icon: ArrowRightLeft, color: 'text-indigo-600', bg: 'bg-indigo-50/80', border: 'border-indigo-100' },
};

export default function MetricCard({
  metricKey,
  label,
  value,
  previous,
  current,
  changeKind = 'percent',
  term,
  sub,
  invert,
  footnote,
  sparklineData,
  isNegativeRed = true,
  onClick,
  size = 'md'
}) {
  const isNeg = typeof current === 'number' && current < 0;
  const theme = METRIC_THEMES[metricKey] || { icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50/80', border: 'border-indigo-100' };
  const Icon = theme.icon;

  return (
    <div
      onClick={onClick}
      className={`card p-4.5 flex flex-col justify-between gap-2.5 min-w-0 transition-all duration-200 group ${
        onClick
          ? 'cursor-pointer hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5'
          : 'hover:shadow-xs'
      }`}
    >
      {/* Header Row: Icon Badge + Label on Left, InfoTip/Arrow on Right */}
      <div className="flex items-center justify-between gap-1 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-7 h-7 rounded-lg ${theme.bg} ${theme.border} border flex items-center justify-center shrink-0 shadow-2xs`}>
            <Icon size={14} className={theme.color} />
          </div>
          <span className="font-semibold text-slate-600 truncate group-hover:text-slate-900 transition-colors">
            {label}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {term && <InfoTip term={term} />}
          {onClick && (
            <ArrowUpRight
              size={14}
              className="text-slate-300 group-hover:text-indigo-600 transition-colors"
            />
          )}
        </div>
      </div>

      {/* Main Metric Value & Sparkline */}
      <div className="flex items-baseline justify-between gap-2 my-0.5">
        <div
          className={`font-black tabular-nums tracking-tight ${
            isNeg && isNegativeRed ? 'text-rose-600' : 'text-slate-900'
          } ${size === 'lg' ? 'text-[26px]' : 'text-[23px]'}`}
        >
          {value}
        </div>

        {sparklineData && sparklineData.length > 1 && (
          <div className="w-16 h-7 shrink-0 opacity-75 group-hover:opacity-100 transition-opacity">
            <Sparkline data={sparklineData} color={invert ? '#f97316' : '#4f46e5'} height={26} />
          </div>
        )}
      </div>

      {/* Footer: ChangeBadge + Subtext */}
      <div className="flex items-center justify-between gap-2 text-xs pt-1 border-t border-slate-100/80 flex-wrap">
        <div className="flex items-center gap-1.5 min-w-0">
          {current !== undefined && previous !== undefined && (
            <ChangeBadge current={current} previous={previous} kind={changeKind} invert={invert} size="xs" />
          )}
          {sub && (
            <span className="text-[11px] text-slate-400 font-medium truncate">
              {sub}
            </span>
          )}
        </div>
      </div>

      {footnote && (
        <div className="text-[10px] text-slate-400 italic mt-0.5 leading-tight">
          {footnote}
        </div>
      )}
    </div>
  );
}
