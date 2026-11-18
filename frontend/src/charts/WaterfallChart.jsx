import { useState } from 'react';
import { formatCurrency, formatPercent } from '../utils/format';
import { ArrowDownRight, ArrowUpRight, Minus, Plus } from 'lucide-react';

export default function WaterfallChart({ netWaterfall = [], priceWaterfall = [] }) {
  const [activeTab, setActiveTab] = useState('price'); // 'price' | 'net'

  const activeData = activeTab === 'price' ? priceWaterfall : netWaterfall;

  return (
    <div className="card p-5 space-y-4">
      {/* Tab toggle and Title */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 leading-tight">
            {activeTab === 'price' ? 'Price Realization Waterfall' : 'Net Sales Revenue Bridge'}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {activeTab === 'price'
              ? 'Tracking value retention from Maximum Retail Price (MRP) down to Gross Margin'
              : 'Forward sales minus returned merchandise plus exchange receipts'}
          </p>
        </div>

        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          <button
            onClick={() => setActiveTab('price')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'price' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Price Waterfall (MRP → GM)
          </button>
          <button
            onClick={() => setActiveTab('net')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'net' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Net Sales Bridge
          </button>
        </div>
      </div>

      {/* Waterfall Visual Bars */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 pt-2">
        {activeData.map((step, idx) => {
          const isTotal = step.type === 'total';
          const isSubtotal = step.type === 'subtotal';
          const isNegative = step.amount < 0 || step.type === 'negative';
          const absAmount = Math.abs(step.amount);

          return (
            <div
              key={step.name}
              className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                isTotal
                  ? 'bg-indigo-50/80 border-indigo-200 ring-1 ring-indigo-400/40'
                  : isSubtotal
                  ? 'bg-slate-50 border-slate-200'
                  : isNegative
                  ? 'bg-rose-50/50 border-rose-200/60'
                  : 'bg-emerald-50/50 border-emerald-200/60'
              }`}
            >
              <div>
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-tight">
                  <span className="truncate">{step.name}</span>
                  {isNegative ? (
                    <Minus size={12} className="text-rose-500 shrink-0" />
                  ) : isTotal || isSubtotal ? (
                    <span className="text-[10px] text-indigo-600 font-bold">=</span>
                  ) : (
                    <Plus size={12} className="text-emerald-500 shrink-0" />
                  )}
                </div>

                <div
                  className={`text-base font-bold tabular-nums mt-1.5 ${
                    isTotal
                      ? 'text-indigo-900 text-lg'
                      : isNegative
                      ? 'text-rose-700'
                      : 'text-slate-900'
                  }`}
                >
                  {isNegative ? '-' : ''}
                  {formatCurrency(absAmount)}
                </div>
              </div>

              <div className="text-[10.5px] text-slate-400 mt-3 pt-1 border-t border-slate-200/40 flex items-center justify-between">
                <span>Step {idx + 1}</span>
                <span className="font-medium text-slate-500">
                  {isTotal ? 'Net Result' : isSubtotal ? 'Subtotal' : isNegative ? 'Deduction' : 'Addition'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
