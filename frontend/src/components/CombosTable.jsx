import { formatCurrency, formatNumber } from '../utils/format';
import { ShoppingBag, Sparkles, ArrowRight } from 'lucide-react';

export default function CombosTable({ combos = [] }) {
  if (!combos || combos.length === 0) return null;

  return (
    <div className="card p-5 space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 leading-tight">
              Best Product Combos (Market Basket Analysis)
            </h3>
            <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.2 rounded">
              Bills with 2+ Distinct Items
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Top pairs frequently purchased together in a single invoice across stores
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {combos.slice(0, 10).map((c, idx) => (
          <div
            key={`${c.item_a}-${c.item_b}`}
            className="p-3 rounded-xl border border-slate-200/90 bg-slate-50/50 hover:bg-indigo-50/30 hover:border-indigo-200 transition-all flex items-center justify-between gap-3 text-xs"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-5 text-[11px] font-bold text-slate-400">#{idx + 1}</span>
              <div className="min-w-0">
                <div className="font-bold text-slate-900 truncate flex items-center gap-1.5">
                  <span className="truncate">{c.item_a}</span>
                  <span className="text-indigo-600 font-extrabold">+</span>
                  <span className="truncate">{c.item_b}</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Joint combo value: <strong>{formatCurrency(c.total_combo_sales)}</strong>
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="inline-flex items-center gap-1 text-[11.5px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                <ShoppingBag size={12} />
                {formatNumber(c.support_bills)} bills
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
