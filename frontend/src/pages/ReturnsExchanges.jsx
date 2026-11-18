import { useEffect, useState } from 'react';
import {
  RotateCcw,
  ArrowRightLeft,
  AlertCircle,
  TrendingDown,
  ShoppingBag,
  Store,
  Package,
  Layers,
  HelpCircle,
  ShieldCheck
} from 'lucide-react';
import PageShell from '../components/PageShell';
import ReturnTrendChart from '../charts/ReturnTrendChart';
import { useFilters } from '../context/FilterContext';
import { api } from '../api/client';
import { formatCurrency, formatNumber, formatPercent, formatDate, formatStoreName } from '../utils/format';

export default function ReturnsExchanges() {
  const { filterQueryObj } = useFilters();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = () => {
    setLoading(true);
    setError(null);
    api.getReturns(filterQueryObj)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load returns data:', err);
        setError(err.message || 'Failed to fetch returns');
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, [filterQueryObj]);

  const s = data?.summary || {};

  return (
    <PageShell
      title="Returns & Exchanges Intelligence"
      subtitle="Offline return rates, exchange volume, reason categorization, and store return monitoring"
      onRefresh={loadData}
    >
      {loading ? (
        <div className="flex items-center justify-center py-24 text-gray-400">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="card p-6 bg-rose-50 text-rose-700">{error}</div>
      ) : (
        <div className="space-y-6">
          {/* 1. Summary KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card p-4 bg-white border border-slate-200/90 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <RotateCcw size={13} className="text-rose-600" /> Return Rate (Value)
              </span>
              <div className="text-2xl font-black text-rose-700 tabular-nums">
                {s.return_rate_val || 0}%
              </div>
              <p className="text-[11px] text-slate-500">
                {formatCurrency(s.return_amount)} on {formatCurrency(s.gross_sales)} gross sales
              </p>
            </div>

            <div className="card p-4 bg-white border border-slate-200/90 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <ShoppingBag size={13} className="text-amber-600" /> Returned Units
              </span>
              <div className="text-2xl font-black text-slate-900 tabular-nums">
                {formatNumber(s.return_units)}
              </div>
              <p className="text-[11px] text-slate-500">
                {s.return_rate_units}% of forward sale units ({formatNumber(s.return_bills)} bills)
              </p>
            </div>

            <div className="card p-4 bg-white border border-slate-200/90 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <ArrowRightLeft size={13} className="text-indigo-600" /> Exchanges Value
              </span>
              <div className="text-2xl font-black text-slate-900 tabular-nums">
                {formatCurrency(s.exchange_amount)}
              </div>
              <p className="text-[11px] text-slate-500">
                {formatNumber(s.exchange_bills)} exchange transactions ({formatNumber(s.exchange_units)} units)
              </p>
            </div>

            <div className="card p-4 bg-white border border-slate-200/90 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck size={13} className="text-emerald-600" /> Network Benchmark
              </span>
              <div className="text-2xl font-black text-emerald-700 tabular-nums">
                2.39%
              </div>
              <p className="text-[11px] text-slate-500">
                Offline target threshold across all 55 stores
              </p>
            </div>
          </div>

          {/* 2. Daily Return & Exchange Trajectory Chart */}
          <ReturnTrendChart data={data?.daily_trend || []} />

          {/* 3. Return Reasons Breakdown */}
          <div className="card p-5 space-y-4 bg-white border border-slate-200/90">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 leading-tight">Return Reasons Logged at POS</h3>
              <p className="text-xs text-slate-500 mt-0.5">Categorization of return vouchers recorded in Wondersoft POS</p>
            </div>

            <div className="space-y-3">
              {(data?.reasons || []).map((r, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-900">{r.reason}</span>
                      <span className="text-slate-400 text-[11px] ml-2">
                        {formatNumber(r.lines_count)} lines · {formatNumber(r.return_units)} units
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-rose-600 tabular-nums">{formatCurrency(r.return_amount)}</span>
                      <span className="text-slate-400 text-[11px] ml-1.5 font-medium">({r.share_pct}%)</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-rose-500 h-full rounded-full transition-all"
                      style={{ width: `${r.share_pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Highest Return Stores & Products */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Highest Return Stores */}
            <div className="card p-5 space-y-3 bg-white border border-slate-200/90">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Store size={16} className="text-rose-600" />
                  <span>Highest Return Stores</span>
                </h4>
                <span className="text-[11px] text-slate-400 font-medium">Min 20 Units Sold</span>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {(data?.highest_return_stores || []).map((s, i) => {
                  const isFranchise = s.store_type === 'Franchise' || (s.store_name && s.store_name.startsWith('F_'));
                  const cleanName = formatStoreName(s.store_name);
                  const isAboveBenchmark = s.return_rate > 2.39;
                  return (
                    <div key={i} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate flex items-center gap-1.5">
                          <span className="truncate">{cleanName}</span>
                          {isFranchise && (
                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded">
                              Franchise
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {s.region} · Gross: {formatCurrency(s.gross_sales)} · {formatNumber(s.return_units)} returned units
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`font-bold tabular-nums ${isAboveBenchmark ? 'text-rose-600' : 'text-slate-700'}`}>
                          {s.return_rate}%
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {formatCurrency(s.return_amount)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Highest Return Products */}
            <div className="card p-5 space-y-3 bg-white border border-slate-200/90">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Package size={16} className="text-rose-600" />
                  <span>Highest Return Products</span>
                </h4>
                <span className="text-[11px] text-slate-400 font-medium">Min 15 Units Sold</span>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {(data?.highest_return_products || []).map((p, i) => {
                  const isElevated = p.return_rate > 5.0;
                  return (
                    <div key={i} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate flex items-center gap-1.5">
                          <span className="truncate">{p.product_name}</span>
                          {isElevated && (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded">
                              &gt;5% Risk
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {p.department} · Gross: {formatCurrency(p.gross_sales)} · {p.return_units} returned units
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`font-bold tabular-nums ${isElevated ? 'text-rose-600' : 'text-slate-700'}`}>
                          {p.return_rate}%
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {formatCurrency(p.return_amount)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
