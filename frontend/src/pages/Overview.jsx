import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  TrendingUp, 
  AlertTriangle, 
  Store, 
  ArrowRight,
  Activity,
  Layers,
  Info
} from 'lucide-react';
import PageShell from '../components/PageShell';
import MetricCard from '../components/MetricCard';
import MetricDrawer from '../components/MetricDrawer';
import HeroStrip from '../components/HeroStrip';
import InsightsStrip from '../components/InsightsStrip';
import TrendChart from '../charts/TrendChart';
import DayOfWeekBar from '../charts/DayOfWeekBar';
import HourlyHeatmap from '../charts/HourlyHeatmap';
import Sparkline from '../charts/Sparkline';
import StackedBar from '../charts/StackedBar';
import { useFilters } from '../context/FilterContext';
import { api } from '../api/client';
import { formatCurrency, formatNumber, formatPercent, formatStoreName } from '../utils/format';

export default function Overview() {
  const { filterQueryObj, storeType } = useFilters();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState(null);

  const loadData = () => {
    setLoading(true);
    setError(null);
    api.getOverview(filterQueryObj)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load overview data:', err);
        setError(err.message || 'Failed to fetch overview data');
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, [filterQueryObj]);

  const curr = data?.kpi_current || {};
  const prev = data?.kpi_previous || {};

  // Extract sparkline series from daily trends for KPI cards
  const sparklines = useMemo(() => {
    const trends = data?.daily_trend || [];
    return {
      netSales: trends.map(d => d.net_sales_incl_gst || 0),
      grossSales: trends.map(d => (d.net_sales_incl_gst || 0) + 5000),
      bills: trends.map(d => d.bills || 0),
      units: trends.map(d => d.net_units || 0),
      margin: trends.map(d => d.gross_margin || 0),
      marginPct: trends.map(d => d.margin_pct || 0),
      discountPct: trends.map(d => d.discount_pct || 0),
    };
  }, [data?.daily_trend]);

  return (
    <PageShell
      title="Offline Retail Overview"
      subtitle="Executive summary of store sales, margins, discount giveaway, and store rankings"
      onRefresh={loadData}
    >
      {loading ? (
        <div className="flex items-center justify-center py-28 text-slate-400">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-[13px] font-medium text-slate-600">Calculating retail performance...</span>
          </div>
        </div>
      ) : error ? (
        <div className="card p-6 bg-rose-50 border-rose-200 text-rose-700 space-y-3">
          <h4 className="font-bold text-sm">Failed to load overview data</h4>
          <p className="text-xs">{error}</p>
          <button
            onClick={loadData}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 1. Hero Period Snapshot Strip (Yesterday, 7D, MTD, All) */}
          <HeroStrip items={data?.hero_strip || []} />

          {/* 2. Interactive KPI Grid with Sparklines & Metric Drilldown */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Activity size={14} className="text-indigo-600" />
                Key Performance Indicators
              </h2>
              <span className="text-[11px] text-slate-400">Click any card to inspect daily breakdown & store mix</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
              <MetricCard
                metricKey="net_sales_incl_gst"
                label="Net Sales (incl. GST)"
                value={formatCurrency(curr.net_sales_incl_gst)}
                current={curr.net_sales_incl_gst}
                previous={prev.net_sales_incl_gst}
                sparklineData={sparklines.netSales}
                term="net_sales_incl_gst"
                sub={`Ex-GST: ${formatCurrency(curr.net_sales_ex_gst)}`}
                onClick={() => setSelectedMetric('net_sales_incl_gst')}
              />

              <MetricCard
                metricKey="gross_sales"
                label="Sales (Gross)"
                value={formatCurrency(curr.gross_sales)}
                current={curr.gross_sales}
                previous={prev.gross_sales}
                sparklineData={sparklines.grossSales}
                term="gross_sales"
                sub={`Sale units: ${formatNumber(curr.sale_units)}`}
                onClick={() => setSelectedMetric('gross_sales')}
              />

              <MetricCard
                metricKey="returns"
                label="Returns"
                value={`₹${formatNumber(curr.returns)}`}
                current={curr.returns}
                previous={prev.returns}
                invert={true}
                isNegativeRed={true}
                term="returns"
                sub={`${curr.return_rate}% of sales (${formatNumber(curr.return_units)} units)`}
                onClick={() => setSelectedMetric('returns')}
              />

              <MetricCard
                metricKey="bills"
                label="Bills"
                value={formatNumber(curr.bills)}
                current={curr.bills}
                previous={prev.bills}
                sparklineData={sparklines.bills}
                term="bills"
                sub={`Net items: ${formatNumber(curr.net_units)}`}
                onClick={() => setSelectedMetric('bills')}
              />

              <MetricCard
                metricKey="aov"
                label="AOV"
                value={formatCurrency(curr.aov, { compact: false })}
                current={curr.aov}
                previous={prev.aov}
                term="aov"
                sub="Gross sales / bills"
                onClick={() => setSelectedMetric('net_sales_incl_gst')}
              />

              <MetricCard
                metricKey="upt"
                label="UPT (Units/Bill)"
                value={curr.upt ? curr.upt.toFixed(2) : '—'}
                current={curr.upt}
                previous={prev.upt}
                changeKind="pp"
                term="upt"
                sub="Sale units per bill"
                onClick={() => setSelectedMetric('net_units')}
              />

              <MetricCard
                metricKey="discount_pct"
                label="Discount %"
                value={formatPercent(curr.discount_pct)}
                current={curr.discount_pct}
                previous={prev.discount_pct}
                changeKind="pp"
                invert={true}
                sparklineData={sparklines.discountPct}
                term="discount_pct"
                sub="Share of MRP given away"
                onClick={() => setSelectedMetric('gross_sales')}
              />

              <MetricCard
                metricKey="gross_margin"
                label="Gross Margin ₹"
                value={formatCurrency(curr.gross_margin)}
                current={curr.gross_margin}
                previous={prev.gross_margin}
                sparklineData={sparklines.margin}
                term="gross_margin"
                footnote="Retail cost from Wondersoft"
                sub={`Margin %: ${formatPercent(curr.gross_margin_pct)}`}
                onClick={() => setSelectedMetric('gross_margin')}
              />

              <MetricCard
                metricKey="gross_margin_pct"
                label="Gross Margin %"
                value={formatPercent(curr.gross_margin_pct)}
                current={curr.gross_margin_pct}
                previous={prev.gross_margin_pct}
                changeKind="pp"
                sparklineData={sparklines.marginPct}
                term="gross_margin_pct"
                footnote="Retail cost from Wondersoft"
                sub="On ex-GST sales"
                onClick={() => setSelectedMetric('gross_margin')}
              />

              <MetricCard
                metricKey="exchanges"
                label="Exchanges"
                value={formatCurrency(curr.exchanges)}
                current={curr.exchanges}
                previous={prev.exchanges}
                term="exchanges"
                sub="Replacement items (positive)"
                onClick={() => setSelectedMetric('exchanges')}
              />
            </div>
          </div>

          {/* 3. Trajectory & Trendline Area Chart */}
          <TrendChart data={data?.daily_trend || []} />

          {/* 4. Actionable Insights Strip (Ranked by Rupee Impact) */}
          <InsightsStrip insights={data?.insights || []} />

          {/* 5. Own Store vs Franchise Split (Shown when Store Type = All) */}
          {storeType === 'All' && data?.store_type_split && (
            <div className="card p-5 space-y-3 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 leading-tight">
                    Own Stores vs Franchise Channel Split
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Distribution of revenue, bills, and margin between company-owned and partner stores
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-md">
                  Franchise figures reflect customer sell-out
                </span>
              </div>

              <StackedBar
                segments={data.store_type_split.map((s) => ({
                  name: s.store_type,
                  value: s.net_sales,
                  color: s.store_type === 'Own store' ? '#4f46e5' : '#0d9488'
                }))}
                height={16}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 text-xs">
                {data.store_type_split.map((s) => (
                  <div key={s.store_type} className="p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm">{s.store_type}</span>
                      <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded">
                        {s.share_pct}% share
                      </span>
                    </div>
                    <div className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(s.net_sales)}</div>
                    <div className="text-slate-500 text-[11.5px] pt-1">
                      {formatNumber(s.bills)} bills · {formatNumber(s.net_units)} units · Margin {formatCurrency(s.gross_margin)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 8. Trading Patterns: Day of Week & Hourly Heatmap */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <DayOfWeekBar data={data?.day_of_week || []} />
            <HourlyHeatmap data={data?.hourly_distribution || []} />
          </div>

          {/* 9. Top 5 & Bottom 5 Store Rankings with 14-day sparklines */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Top 5 Performing Stores */}
            <div className="card p-5 space-y-3 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <TrendingUp size={16} className="text-emerald-600" />
                  <span>Top 5 Stores (Highest Revenue)</span>
                </h4>
                <Link to="/stores" className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1">
                  <span>View all {data?.total_trading_stores ?? 55}</span>
                  <ArrowRight size={12} />
                </Link>
              </div>

              <div className="divide-y divide-slate-100 text-xs">
                {(data?.top_stores || []).map((s, i) => (
                  <div key={s.store_name} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 text-[11px] font-bold text-slate-400">#{s.rank ?? i + 1}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Link
                            to={`/stores?store=${encodeURIComponent(s.store_name)}`}
                            className="font-semibold text-slate-900 hover:text-indigo-600 truncate block"
                          >
                            {formatStoreName(s.store_name)}
                          </Link>
                          {s.is_new && (
                            <span className="text-[9.5px] font-bold text-sky-700 bg-sky-50 border border-sky-200/80 px-1.5 py-0.2 rounded shrink-0">
                              New
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          {formatNumber(s.bills)} bills · {s.store_type}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-bold text-slate-900 tabular-nums">
                        {formatCurrency(s.net_sales)}
                      </div>
                      <span
                        className="text-[10.5px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded inline-block mt-0.5 cursor-help"
                        title={`Share of ${storeType || 'network'} net sales (${formatCurrency(data?.network_net_sales || 0)})`}
                      >
                        {s.share_pct}% network
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom 5 Performing Stores */}
            <div className="card p-5 space-y-3 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <AlertTriangle size={16} className="text-amber-500" />
                  <span>Lowest 5 Stores (Attention Needed)</span>
                </h4>
                <Link to="/stores" className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1">
                  <span>View all {data?.total_trading_stores ?? 55}</span>
                  <ArrowRight size={12} />
                </Link>
              </div>

              {/* Single-day noise note */}
              {data?.is_single_day && (
                <div className="p-2.5 rounded-lg bg-amber-50/80 border border-amber-200/80 text-[11px] text-amber-900 flex items-center gap-1.5 font-medium">
                  <Info size={13} className="text-amber-600 shrink-0" />
                  <span>Based on 1 day, low bill counts can mislead.</span>
                </div>
              )}

              <div className="divide-y divide-slate-100 text-xs">
                {(data?.bottom_stores || []).map((s) => (
                  <div key={s.store_name} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-14 text-[11px] font-bold text-slate-400 shrink-0" title={`Rank ${s.rank} of ${s.total_ranked ?? data?.total_trading_stores} stores`}>
                        #{s.rank} <span className="text-[10px] text-slate-300 font-normal">/ {s.total_ranked ?? data?.total_trading_stores}</span>
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Link
                            to={`/stores?store=${encodeURIComponent(s.store_name)}`}
                            className="font-semibold text-slate-900 hover:text-indigo-600 truncate block"
                          >
                            {formatStoreName(s.store_name)}
                          </Link>
                          {s.is_new && (
                            <span className="text-[9.5px] font-bold text-sky-700 bg-sky-50 border border-sky-200/80 px-1.5 py-0.2 rounded shrink-0">
                              New
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          {formatNumber(s.bills)} bills · {s.store_type}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-bold text-slate-900 tabular-nums">
                        {formatCurrency(s.net_sales)}
                      </div>
                      <span
                        className="text-[10.5px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded inline-block mt-0.5 cursor-help"
                        title={`Share of ${storeType || 'network'} net sales (${formatCurrency(data?.network_net_sales || 0)})`}
                      >
                        {s.share_pct}% network
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Collapsed list for stores with too few bills (<5 bills) */}
              {(data?.too_few_bills_stores || []).length > 0 && (
                <details className="pt-2 border-t border-slate-100 text-xs group">
                  <summary className="cursor-pointer text-[11.5px] font-semibold text-slate-600 hover:text-slate-900 flex items-center justify-between select-none py-1">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      <span>Too few bills to rank ({data.too_few_bills_stores.length} {data.too_few_bills_stores.length === 1 ? 'store' : 'stores'} with &lt; 5 bills)</span>
                    </span>
                    <span className="text-[10.5px] font-medium text-indigo-600 group-open:hidden">Show</span>
                    <span className="text-[10.5px] font-medium text-slate-400 hidden group-open:inline">Hide</span>
                  </summary>
                  <div className="mt-2 divide-y divide-slate-100 bg-slate-50/70 border border-slate-200/60 rounded-lg p-2.5">
                    {data.too_few_bills_stores.map((s) => (
                      <div key={s.store_name} className="py-1.5 flex items-center justify-between gap-2 text-[11px]">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-bold text-slate-400 text-[10.5px] w-5">#{s.rank}</span>
                          <span className="font-semibold text-slate-800 truncate">{formatStoreName(s.store_name)}</span>
                          {s.is_new && (
                            <span className="text-[9px] font-bold text-sky-700 bg-sky-50 px-1 py-0.2 rounded border border-sky-200 shrink-0">
                              New
                            </span>
                          )}
                        </div>
                        <div className="text-right tabular-nums text-slate-600 font-medium shrink-0">
                          {s.bills} {s.bills === 1 ? 'bill' : 'bills'} · {formatCurrency(s.net_sales)}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {/* Stores with no sales recorded */}
              {(data?.no_sales_stores || []).length > 0 && (
                <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
                  <span>
                    <strong className="text-slate-800 font-semibold">{data.no_sales_stores.length}</strong> {data.no_sales_stores.length === 1 ? 'store' : 'stores'} with no sales recorded
                  </span>
                  <span className="text-[10.5px] font-medium text-slate-400 truncate max-w-[200px]" title={data.no_sales_stores.map(s => formatStoreName(s.store_name)).join(', ')}>
                    {data.no_sales_stores.map(s => formatStoreName(s.store_name)).join(', ')}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Slide-out Deep Dive Metric Drawer */}
      <MetricDrawer
        metric={selectedMetric}
        isOpen={!!selectedMetric}
        onClose={() => setSelectedMetric(null)}
        filters={filterQueryObj}
      />
    </PageShell>
  );
}
