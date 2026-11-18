import { useState, useEffect } from 'react';
import { X, TrendingUp, Store, Package, Layers, Info } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { api } from '../api/client';
import { formatCurrency, formatNumber, formatPercent, formatDate, formatStoreName } from '../utils/format';

export default function MetricDrawer({ metricKey, filters, isOpen, onClose }) {
  const [drillData, setDrillData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && metricKey) {
      setLoading(true);
      api.getMetricDrilldown(metricKey, filters)
        .then((res) => {
          setDrillData(res);
          setLoading(false);
        })
        .catch((err) => {
          console.error('Failed to load metric drilldown:', err);
          setLoading(false);
        });
    }
  }, [isOpen, metricKey, filters]);

  if (!isOpen) return null;

  const isCurrency = ['net_sales_incl_gst', 'net_sales_ex_gst', 'gross_sales', 'returns', 'exchanges', 'gross_margin'].includes(metricKey);
  const formatter = (val) => isCurrency ? formatCurrency(val) : formatNumber(val);

  return (
    <div className="fixed inset-0 z-50 flex justify-end animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={onClose} />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-xl bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col z-10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0 bg-slate-50/70">
          <div>
            <div className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp size={14} /> Metric Deep-Dive
            </div>
            <h2 className="text-lg font-bold text-slate-900 leading-tight mt-0.5">
              {drillData?.label || metricKey}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Definition callout */}
          {drillData?.definition && (
            <div className="p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-xl text-xs text-indigo-950 flex items-start gap-2.5">
              <Info size={16} className="text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-indigo-900">Definition: </span>
                <span className="font-mono text-[11px] text-indigo-800">{drillData.definition}</span>
                {drillData.tooltip && <p className="text-slate-600 mt-1">{drillData.tooltip}</p>}
              </div>
            </div>
          )}

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <div className="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">Fetching breakdown...</span>
            </div>
          ) : (
            <>
              {/* Daily Trend Line */}
              <div>
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
                  Daily Trajectory
                </h3>
                <div className="card p-3 h-52 bg-slate-50/40">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={drillData?.daily_trend || []} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="drillGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="bill_date" tickFormatter={formatDate} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={(v) => isCurrency ? formatCurrency(v, { compact: true }) : v} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        formatter={(val) => [formatter(val), drillData?.label]}
                        labelFormatter={formatDate}
                        contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0' }}
                      />
                      <Area type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={2} fill="url(#drillGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* By Store Type Split */}
              {drillData?.by_store_type && drillData.by_store_type.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Store Type Split
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {drillData.by_store_type.map((t) => (
                      <div key={t.store_type} className="card p-3 border border-slate-200">
                        <div className="text-[11px] font-semibold text-slate-500 uppercase">{t.store_type}</div>
                        <div className="text-base font-bold text-slate-900 mt-0.5">{formatter(t.value)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top 10 Stores */}
              <div>
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Store size={14} className="text-indigo-600" /> Top Contributing Stores
                </h3>
                <div className="card divide-y divide-slate-100 overflow-hidden text-xs">
                  {(drillData?.top_stores || []).map((s, i) => (
                    <div key={s.store_name} className="flex items-center justify-between px-3.5 py-2 hover:bg-slate-50">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-slate-400 w-4 text-right">{i + 1}.</span>
                        <span className="font-medium text-slate-800 truncate">{formatStoreName(s.store_name)}</span>
                      </div>
                      <span className="font-bold text-slate-900 tabular-nums shrink-0">{formatter(s.value)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top 10 Products */}
              <div>
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Package size={14} className="text-indigo-600" /> Top Contributing Products
                </h3>
                <div className="card divide-y divide-slate-100 overflow-hidden text-xs">
                  {(drillData?.top_products || []).map((p, i) => (
                    <div key={p.product_name} className="flex items-center justify-between px-3.5 py-2 hover:bg-slate-50">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-slate-400 w-4 text-right">{i + 1}.</span>
                        <span className="font-medium text-slate-800 truncate">{p.product_name}</span>
                      </div>
                      <span className="font-bold text-slate-900 tabular-nums shrink-0">{formatter(p.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
