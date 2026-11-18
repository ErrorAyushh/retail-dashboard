import { useState, useEffect } from 'react';
import { 
  X, 
  Store, 
  Award, 
  TrendingUp, 
  Clock, 
  Package, 
  Users, 
  RotateCcw,
  Layers,
  MapPin
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar } from 'recharts';
import { api } from '../api/client';
import { formatCurrency, formatNumber, formatPercent, formatDate, formatStoreName, isFranchiseStore } from '../utils/format';
import MetricCard from './MetricCard';

export default function StoreDrawer({ storeName, storeMeta, filters, isOpen, onClose }) {
  const [detailData, setDetailData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && storeName) {
      setLoading(true);
      api.getStoreDetail(storeName, filters)
        .then((res) => {
          setDetailData(res);
          setLoading(false);
        })
        .catch((err) => {
          console.error('Failed to load store detail:', err);
          setLoading(false);
        });
    }
  }, [isOpen, storeName, filters]);

  if (!isOpen) return null;

  const cleanName = formatStoreName(storeName);
  const isFran = isFranchiseStore(storeName);
  const ranks = storeMeta?.ranks || {};
  const totalStores = ranks.total_stores || 55;

  return (
    <div className="fixed inset-0 z-50 flex justify-end animate-fade-in">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col z-10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0 bg-slate-50/70">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                isFran ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
              }`}>
                {isFran ? 'Franchise Partner' : 'Company Owned Store'}
              </span>
              {storeMeta?.region && (
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <MapPin size={11} /> {storeMeta.region}
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-slate-900 leading-tight mt-1 truncate">
              {cleanName}
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
          {/* Network Scorecard */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Award size={14} className="text-indigo-600" />
                Network Benchmark Scorecard
              </h3>
              <span className="text-[11px] text-slate-400">Benchmarked across {totalStores} stores</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <RankBadge label="Net Sales" rank={ranks.sales_rank} total={totalStores} />
              <RankBadge label="Gross Margin %" rank={ranks.margin_rank} total={totalStores} />
              <RankBadge label="AOV Ticket" rank={ranks.aov_rank} total={totalStores} />
              <RankBadge label="UPT Basket" rank={ranks.upt_rank} total={totalStores} />
              <RankBadge label="Discount Control" rank={ranks.discount_rank} total={totalStores} note="Lowest is best" />
              <RankBadge label="Return Rate" rank={ranks.return_rank} total={totalStores} note="Lowest is best" />
            </div>
          </div>

          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-3">
              <div className="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">Loading store performance...</span>
            </div>
          ) : detailData ? (
            <>
              {/* Summary KPIs */}
              <div>
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Store Metrics Overview
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="card p-3 bg-slate-50/60 border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-medium">Net Sales</span>
                    <div className="text-base font-bold text-slate-900 mt-0.5">
                      {formatCurrency(detailData.kpis?.net_sales_incl_gst)}
                    </div>
                  </div>
                  <div className="card p-3 bg-slate-50/60 border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-medium">Bills Count</span>
                    <div className="text-base font-bold text-slate-900 mt-0.5">
                      {formatNumber(detailData.kpis?.bills)}
                    </div>
                  </div>
                  <div className="card p-3 bg-slate-50/60 border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-medium">AOV</span>
                    <div className="text-base font-bold text-slate-900 mt-0.5">
                      {formatCurrency(detailData.kpis?.aov, { compact: false })}
                    </div>
                  </div>
                  <div className="card p-3 bg-slate-50/60 border border-slate-200">
                    <span className="text-[11px] text-slate-500 font-medium">Gross Margin</span>
                    <div className="text-base font-bold text-emerald-700 mt-0.5">
                      {formatPercent(detailData.kpis?.gross_margin_pct)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Daily Trend Line */}
              <div>
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <TrendingUp size={14} className="text-indigo-600" /> Daily Revenue Trajectory
                </h3>
                <div className="card p-3 h-48 bg-slate-50/40">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={detailData.daily || []} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="storeAreaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="bill_date" tickFormatter={formatDate} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={(v) => formatCurrency(v, { compact: true })} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(val) => [formatCurrency(val), 'Net Sales']} labelFormatter={formatDate} />
                      <Area type="monotone" dataKey="net_sales" stroke="#4f46e5" strokeWidth={2} fill="url(#storeAreaGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Top 5 Products & Size Mix */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Top Products */}
                <div>
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Package size={14} className="text-indigo-600" /> Best Selling Products
                  </h3>
                  <div className="card divide-y divide-slate-100 overflow-hidden text-xs">
                    {(detailData.top_products || []).slice(0, 5).map((p, i) => (
                      <div key={p.product_code} className="p-2.5 hover:bg-slate-50 flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate">{p.product_name}</div>
                          <div className="text-[10.5px] text-slate-400">{formatNumber(p.units)} units sold</div>
                        </div>
                        <span className="font-bold text-slate-900 tabular-nums shrink-0">{formatCurrency(p.net_sales)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Size Curve */}
                <div>
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Layers size={14} className="text-indigo-600" /> Footwear Size Mix
                  </h3>
                  <div className="card divide-y divide-slate-100 overflow-hidden text-xs">
                    {(detailData.size_mix || []).slice(0, 5).map((s) => (
                      <div key={s.size} className="p-2.5 hover:bg-slate-50 flex items-center justify-between">
                        <span className="font-bold text-slate-800">UK {s.size}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400 font-medium">{formatNumber(s.units)} units</span>
                          <span className="font-semibold text-slate-900 tabular-nums">{formatCurrency(s.net_sales)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Staff Breakdown */}
              {detailData.staff && detailData.staff.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Users size={14} className="text-indigo-600" /> Staff Performance
                  </h3>
                  <div className="card divide-y divide-slate-100 overflow-hidden text-xs">
                    {detailData.staff.map((st) => (
                      <div key={st.staff_name} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                        <div>
                          <span className="font-semibold text-slate-900">{st.staff_name}</span>
                          <span className="text-slate-400 text-[11px] ml-2">{formatNumber(st.bills)} bills</span>
                        </div>
                        <span className="font-bold text-slate-900 tabular-nums">{formatCurrency(st.net_sales)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function RankBadge({ label, rank, total, note }) {
  if (!rank) return null;
  const isTopTier = rank <= Math.max(3, Math.round(total * 0.1));
  const isWeakTier = rank >= Math.round(total * 0.8);

  return (
    <div className={`p-2.5 rounded-xl border flex flex-col justify-between ${
      isTopTier
        ? 'bg-emerald-50/70 border-emerald-200'
        : isWeakTier
        ? 'bg-rose-50/50 border-rose-200'
        : 'bg-slate-50 border-slate-200'
    }`}>
      <span className="text-[10.5px] font-semibold text-slate-500 uppercase truncate">{label}</span>
      <div className="flex items-baseline gap-1 mt-1">
        <span className={`text-base font-bold tabular-nums ${
          isTopTier ? 'text-emerald-700' : isWeakTier ? 'text-rose-700' : 'text-slate-900'
        }`}>
          {rank}th
        </span>
        <span className="text-[10px] text-slate-400">of {total}</span>
      </div>
      {note && <span className="text-[9.5px] text-slate-400 italic mt-0.5">{note}</span>}
    </div>
  );
}
