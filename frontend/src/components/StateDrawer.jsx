import React from 'react';
import { X, MapPin, Building2, Store, TrendingUp, Percent, RotateCcw, ArrowRight } from 'lucide-react';
import { formatCurrency, formatPercent, formatNumber, formatStoreName } from '../utils/format';
import Sparkline from '../charts/Sparkline';

export default function StateDrawer({
  stateData,
  isOpen,
  onClose,
  onFilterState,
  onSelectStore,
}) {
  if (!isOpen || !stateData) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-2xs flex justify-end animate-fade-in">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700">
              <MapPin size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">
                {stateData.state}
              </h3>
              <p className="text-xs text-slate-500">
                {stateData.zone} Zone · {stateData.stores_count} {stateData.stores_count === 1 ? 'store' : 'stores'} ({stateData.own_count} Own, {stateData.franchise_count} Fran)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Top KPI Card */}
          <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 space-y-2">
            <div className="text-xs text-indigo-700 font-medium flex items-center justify-between">
              <span>Total Net Sales</span>
              <span className="font-semibold">{formatPercent(stateData.share_pct)} of Network</span>
            </div>
            <div className="text-2xl font-black text-indigo-950">
              {formatCurrency(stateData.net_sales_incl_gst)}
            </div>
            <div className="flex items-center gap-3 pt-1 text-xs border-t border-indigo-100/80">
              <span className="text-slate-600">
                Avg / Store: <strong className="text-slate-900">{formatCurrency(stateData.sales_per_store)}</strong>
              </span>
              <span
                className={`font-semibold ${
                  stateData.change_pct >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {stateData.change_pct >= 0 ? '↑' : '↓'} {Math.abs(stateData.change_pct)}% vs prev
              </span>
            </div>
          </div>

          {/* Sparkline Trend */}
          {stateData.sparkline && stateData.sparkline.length > 0 && (
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
              <div className="text-xs font-bold text-slate-800">14-Day Revenue Trend</div>
              <div className="h-14">
                <Sparkline data={stateData.sparkline} color="#4f46e5" height={50} />
              </div>
            </div>
          )}

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/60">
              <div className="text-slate-500 text-[11px]">Sale Bills</div>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {formatNumber(stateData.bills)}
              </div>
            </div>
            <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/60">
              <div className="text-slate-500 text-[11px]">AOV</div>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {formatCurrency(stateData.aov, { compact: false })}
              </div>
            </div>
            <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/60">
              <div className="text-slate-500 text-[11px]">UPT</div>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {stateData.upt?.toFixed(2) || '—'}
              </div>
            </div>
            <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/60">
              <div className="text-slate-500 text-[11px]">Discount %</div>
              <div className="text-base font-bold text-amber-600 mt-0.5">
                {formatPercent(stateData.discount_pct)}
              </div>
            </div>
            <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/60">
              <div className="text-slate-500 text-[11px]">Gross Margin %</div>
              <div className="text-base font-bold text-emerald-600 mt-0.5">
                {formatPercent(stateData.gross_margin_pct)}
              </div>
            </div>
            <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/60">
              <div className="text-slate-500 text-[11px]">Return Rate</div>
              <div className="text-base font-bold text-rose-600 mt-0.5">
                {formatPercent(stateData.return_rate)}
              </div>
            </div>
          </div>

          {/* Stores in this state */}
          <div className="space-y-2.5">
            <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
              <span>Stores in {stateData.state} ({stateData.stores?.length || 0})</span>
            </div>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
              {(stateData.stores || []).map((storeName) => (
                <div
                  key={storeName}
                  onClick={() => onSelectStore?.(storeName)}
                  className="p-3 hover:bg-indigo-50/40 cursor-pointer transition-colors flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <Store size={14} className="text-slate-400" />
                    <span className="font-semibold text-slate-900">
                      {formatStoreName(storeName)}
                    </span>
                  </div>
                  <ArrowRight size={13} className="text-slate-400" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              onFilterState?.(stateData.state);
              onClose();
            }}
            className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors text-center"
          >
            Apply as Filter
          </button>
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 border border-slate-200 hover:bg-white text-slate-700 rounded-lg text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
