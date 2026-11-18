import { useEffect, useState, useMemo } from 'react';
import {
  Percent,
  TrendingDown,
  Layers,
  AlertCircle,
  Tag,
  ShieldAlert,
  ArrowUpRight,
  TrendingUp,
  Sparkles,
  Store,
  Package
} from 'lucide-react';
import PageShell from '../components/PageShell';
import StackedBar from '../charts/StackedBar';
import DiscountDepthChart from '../charts/DiscountDepthChart';
import { useFilters } from '../context/FilterContext';
import { api } from '../api/client';
import { formatCurrency, formatNumber, formatPercent, formatStoreName } from '../utils/format';

export default function DiscountsMargin() {
  const { filterQueryObj } = useFilters();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = () => {
    setLoading(true);
    setError(null);
    api.getDiscounts(filterQueryObj)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load discounts data:', err);
        setError(err.message || 'Failed to fetch discounts');
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, [filterQueryObj]);

  // Overall discount & margin aggregates for hero cards
  const heroStats = useMemo(() => {
    if (!data?.depth_buckets || data.depth_buckets.length === 0) return null;
    const totalDiscount = (data.components || []).reduce((acc, c) => acc + (c.value || 0), 0);
    const totalSales = data.depth_buckets.reduce((acc, b) => acc + (b.sales_incl_gst || 0), 0);
    const totalSalesEx = data.depth_buckets.reduce((acc, b) => acc + (b.sales_ex_gst || 0), 0);
    const totalMargin = data.depth_buckets.reduce((acc, b) => acc + (b.gross_margin || 0), 0);
    const overallMarginPct = totalSalesEx > 0 ? (totalMargin / totalSalesEx) * 100 : 0;
    const billDiscountComp = (data.components || []).find(c => c.name.toLowerCase().includes('bill'));
    const billDiscountShare = billDiscountComp ? billDiscountComp.share_pct : 0;

    return {
      totalDiscount,
      totalSales,
      overallMarginPct: overallMarginPct.toFixed(1),
      billDiscountShare,
    };
  }, [data]);

  return (
    <PageShell
      title="Discounts & Margin Analysis"
      subtitle="Discount depth distribution, bill vs product discount mechanics, and gross margin preservation"
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
          {/* Top Hero KPI Cards */}
          {heroStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="card p-4 bg-white border border-slate-200/90 space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Tag size={13} className="text-amber-600" /> Total Retail Discount
                </span>
                <div className="text-2xl font-black text-slate-900 tabular-nums">
                  {formatCurrency(heroStats.totalDiscount)}
                </div>
                <p className="text-[11px] text-slate-500">
                  Total markdown across all store lines
                </p>
              </div>

              <div className="card p-4 bg-white border border-slate-200/90 space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <TrendingUp size={13} className="text-emerald-600" /> Realized Margin %
                </span>
                <div className="text-2xl font-black text-emerald-700 tabular-nums">
                  {heroStats.overallMarginPct}%
                </div>
                <p className="text-[11px] text-slate-500">
                  Network gross margin on net ex-GST revenue
                </p>
              </div>

              <div className="card p-4 bg-white border border-slate-200/90 space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Layers size={13} className="text-indigo-600" /> Bill-Level Discount Share
                </span>
                <div className="text-2xl font-black text-slate-900 tabular-nums">
                  {heroStats.billDiscountShare}%
                </div>
                <p className="text-[11px] text-slate-500">
                  Invoice-level vouchers vs tag markdowns
                </p>
              </div>

              <div className="card p-4 bg-white border border-slate-200/90 space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <ShieldAlert size={13} className="text-rose-600" /> High-Discount Bucket
                </span>
                <div className="text-2xl font-black text-slate-900 tabular-nums">
                  {data?.depth_buckets?.slice(-2).reduce((a, b) => a + b.units, 0) || 0} units
                </div>
                <p className="text-[11px] text-slate-500">
                  Sold at &gt;50% discount depth
                </p>
              </div>
            </div>
          )}

          {/* 1. Dual-Axis Discount Depth & Margin Tradeoff Curve */}
          <DiscountDepthChart data={data?.depth_buckets || []} />

          {/* 2. Discount Depth Buckets Table */}
          <div className="card p-5 space-y-3 bg-white border border-slate-200/90">
            <div>
              <h3 className="text-sm font-bold text-slate-900 leading-tight">Discount Depth Buckets Detail</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Distribution of forward sale units and sales realization grouped by discount percentage of MRP
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase bg-slate-50/70">
                    <th className="py-2.5 px-3">Discount Depth</th>
                    <th className="py-2.5 px-3 text-right">Lines</th>
                    <th className="py-2.5 px-3 text-right">Units</th>
                    <th className="py-2.5 px-3 text-right">Sales (incl. GST)</th>
                    <th className="py-2.5 px-3 text-right">Sales (ex-GST)</th>
                    <th className="py-2.5 px-3 text-right">Total Discount</th>
                    <th className="py-2.5 px-3 text-right">Gross Margin ₹</th>
                    <th className="py-2.5 px-3 text-right">Margin %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(data?.depth_buckets || []).map((b) => (
                    <tr key={b.bucket} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{b.bucket}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-slate-600">{formatNumber(b.lines_count)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-slate-800 font-medium">{formatNumber(b.units)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-slate-900">{formatCurrency(b.sales_incl_gst)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-slate-700">{formatCurrency(b.sales_ex_gst)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-rose-600 font-medium">{formatCurrency(b.discount)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-emerald-700 font-medium">{formatCurrency(b.gross_margin)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">
                        <span className={`inline-block px-1.5 py-0.5 rounded font-bold ${
                          b.margin_pct >= 65 ? 'text-emerald-700 bg-emerald-50' : b.margin_pct >= 55 ? 'text-indigo-700 bg-indigo-50' : 'text-amber-700 bg-amber-50'
                        }`}>
                          {b.margin_pct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. Discount Component Split (Product vs Bill vs Other) */}
          <div className="card p-5 space-y-3 bg-white border border-slate-200/90">
            <h3 className="text-sm font-bold text-slate-900 leading-tight">Discount Component Split</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Breakdown of total retail discount value into Item/Product markdown, Invoice/Bill level, and Other promotions
            </p>
            <StackedBar segments={data?.components || []} height={14} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              {(data?.components || []).map((c) => (
                <div key={c.name} className="p-3 bg-slate-50/70 border border-slate-200/60 rounded-xl space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />
                    <span className="text-xs font-bold text-slate-800">{c.name}</span>
                  </div>
                  <div className="text-lg font-black text-slate-900">{formatCurrency(c.value)}</div>
                  <div className="text-[11px] text-slate-500">{c.share_pct}% of total discount</div>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Store Outliers: Highest Discount & Lowest Margin */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Highest Discount Stores */}
            <div className="card p-5 space-y-3 bg-white border border-slate-200/90">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Percent size={16} className="text-amber-600" />
                  <span>Highest Discount Stores</span>
                </h4>
                <span className="text-[11px] text-slate-400 font-medium">Min ₹20k Net Sales</span>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {(data?.highest_discount_stores || []).map((s, i) => {
                  const isFranchise = s.store_type === 'Franchise' || (s.store_name && s.store_name.startsWith('F_'));
                  const cleanName = formatStoreName(s.store_name);
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
                          {s.region} · Net sales: {formatCurrency(s.net_sales)}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-amber-600 tabular-nums">{s.discount_pct}%</div>
                        <div className="text-[11px] text-slate-400">Margin: {s.margin_pct}%</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Lowest Margin Stores */}
            <div className="card p-5 space-y-3 bg-white border border-slate-200/90">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <TrendingDown size={16} className="text-rose-600" />
                  <span>Lowest Margin Stores</span>
                </h4>
                <span className="text-[11px] text-slate-400 font-medium">Min ₹20k Net Sales</span>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {(data?.lowest_margin_stores || []).map((s, i) => {
                  const isFranchise = s.store_type === 'Franchise' || (s.store_name && s.store_name.startsWith('F_'));
                  const cleanName = formatStoreName(s.store_name);
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
                          {s.region} · Net sales: {formatCurrency(s.net_sales)}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-rose-600 tabular-nums">{s.margin_pct}%</div>
                        <div className="text-[11px] text-slate-400">Discount: {s.discount_pct}%</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 5. Product Outliers: Highest Discount & Lowest Margin */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Highest Discount Products */}
            <div className="card p-5 space-y-3 bg-white border border-slate-200/90">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Package size={16} className="text-amber-600" />
                  <span>Highest Discount Products</span>
                </h4>
                <span className="text-[11px] text-slate-400 font-medium">Min 10 Units</span>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {(data?.highest_discount_products || []).map((p, i) => (
                  <div key={i} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">{p.product_name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {p.department} · {formatNumber(p.units)} units · {formatCurrency(p.net_sales)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-amber-600 tabular-nums">{p.discount_pct}%</div>
                      <div className="text-[11px] text-slate-400">Margin: {p.margin_pct}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Lowest Margin Products */}
            <div className="card p-5 space-y-3 bg-white border border-slate-200/90">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <AlertCircle size={16} className="text-rose-600" />
                  <span>Lowest Margin Products</span>
                </h4>
                <span className="text-[11px] text-slate-400 font-medium">Min 10 Units</span>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {(data?.lowest_margin_products || []).map((p, i) => (
                  <div key={i} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">{p.product_name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {p.department} · {formatNumber(p.units)} units · {formatCurrency(p.net_sales)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-rose-600 tabular-nums">{p.margin_pct}%</div>
                      <div className="text-[11px] text-slate-400">Discount: {p.discount_pct}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
