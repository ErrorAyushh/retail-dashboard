import { useEffect, useState } from 'react';
import { 
  Store, 
  TrendingUp, 
  Grid, 
  Table as TableIcon, 
  ScatterChart as ScatterIcon,
  Download,
  Building2,
  Calendar
} from 'lucide-react';
import PageShell from '../components/PageShell';
import DataTable from '../tables/DataTable';
import StoreDrawer from '../components/StoreDrawer';
import StoreDayHeatmap from '../charts/StoreDayHeatmap';
import QuadrantScatter from '../charts/QuadrantScatter';
import Sparkline from '../charts/Sparkline';
import { useFilters } from '../context/FilterContext';
import { api } from '../api/client';
import { formatCurrency, formatIndianNumber, formatNumber, formatPercent, formatStoreName, isFranchiseStore } from '../utils/format';

export default function Stores() {
  const { filterQueryObj } = useFilters();
  const [data, setData] = useState(null);
  const [heatmapData, setHeatmapData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeView, setActiveView] = useState('table'); // 'table' | 'heatmap' | 'scatter'

  // Selected store for drawer
  const [selectedStore, setSelectedStore] = useState(null);
  const [selectedStoreMeta, setSelectedStoreMeta] = useState(null);

  const loadStoresData = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.getStores(filterQueryObj),
      api.getStoreHeatmap(filterQueryObj)
    ])
      .then(([storesRes, heatmapRes]) => {
        setData(storesRes);
        setHeatmapData(heatmapRes);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load stores data:', err);
        setError(err.message || 'Failed to fetch stores data');
        setLoading(false);
      });
  };

  useEffect(() => {
    loadStoresData();
  }, [filterQueryObj]);

  const handleOpenStore = (storeName) => {
    const meta = (data?.stores || []).find(s => s.store_name === storeName);
    setSelectedStore(storeName);
    setSelectedStoreMeta(meta);
  };

  const columns = [
    {
      key: 'store_name',
      label: 'Store Name',
      width: '260px',
      render: (r) => {
        const clean = formatStoreName(r.store_name);
        const isFran = isFranchiseStore(r.store_name);
        return (
          <button
            onClick={() => handleOpenStore(r.store_name)}
            className="text-left font-semibold text-slate-900 hover:text-indigo-600 flex items-center justify-between w-full group cursor-pointer gap-2 pr-1"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Store size={14} className="text-slate-400 group-hover:text-indigo-600 shrink-0" />
              <span className="truncate">{clean}</span>
            </div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
              isFran ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-indigo-50 text-indigo-700'
            }`}>
              {isFran ? 'Fran' : 'Own'}
            </span>
          </button>
        );
      },
    },
    {
      key: 'region',
      label: 'Region',
      width: '130px',
      render: (r) => (
        <span className="text-xs text-slate-600 font-medium">{r.region || '—'}</span>
      ),
    },
    {
      key: 'net_sales_incl_gst',
      label: 'Net Sales',
      width: '115px',
      align: 'right',
      render: (r) => (
        <span className="font-bold text-slate-900 tabular-nums">{formatCurrency(r.net_sales_incl_gst)}</span>
      ),
    },
    {
      key: 'share_pct',
      label: 'Share %',
      width: '110px',
      align: 'right',
      render: (r) => (
        <div className="flex items-center justify-end gap-2">
          <div className="w-12 bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${Math.min(r.share_pct * 10, 100)}%` }} />
          </div>
          <span className="tabular-nums font-medium">{formatPercent(r.share_pct)}</span>
        </div>
      ),
    },
    {
      key: 'sparkline',
      label: '14D Trend',
      width: '95px',
      sortable: false,
      render: (r) => (
        <div className="w-16 h-6">
          <Sparkline data={r.sparkline} color="#4f46e5" height={22} />
        </div>
      )
    },
    {
      key: 'bills',
      label: 'Bills',
      width: '80px',
      align: 'right',
      render: (r) => <span className="tabular-nums">{formatNumber(r.bills)}</span>,
    },
    {
      key: 'aov',
      label: 'AOV',
      width: '95px',
      align: 'right',
      render: (r) => <span className="tabular-nums font-medium">{formatCurrency(r.aov, { compact: false })}</span>,
    },
    {
      key: 'upt',
      label: 'UPT',
      width: '75px',
      align: 'right',
      render: (r) => <span className="tabular-nums">{r.upt ? r.upt.toFixed(2) : '—'}</span>,
    },
    {
      key: 'net_units',
      label: 'Units',
      width: '80px',
      align: 'right',
      render: (r) => <span className="tabular-nums">{formatNumber(r.net_units)}</span>,
    },
    {
      key: 'discount_pct',
      label: 'Discount %',
      width: '95px',
      align: 'right',
      render: (r) => (
        <span className={`tabular-nums font-semibold ${r.discount_pct > 35 ? 'text-amber-600' : 'text-slate-700'}`}>
          {formatPercent(r.discount_pct)}
        </span>
      ),
    },
    {
      key: 'gross_margin_pct',
      label: 'Margin %',
      width: '95px',
      align: 'right',
      render: (r) => (
        <span className="tabular-nums font-semibold text-emerald-700">
          {formatPercent(r.gross_margin_pct)}
        </span>
      ),
    },
    {
      key: 'return_rate',
      label: 'Return %',
      width: '85px',
      align: 'right',
      render: (r) => (
        <span className={`tabular-nums ${r.return_rate > 5 ? 'text-rose-600 font-semibold' : 'text-slate-600'}`}>
          {formatPercent(r.return_rate)}
        </span>
      ),
    },
    {
      key: 'days_with_sales',
      label: 'Traded Days',
      width: '100px',
      align: 'right',
      render: (r) => <span className="tabular-nums text-slate-500">{r.days_with_sales}d</span>,
    },
  ];

  return (
    <PageShell
      title="Store Benchmarking & Analytics"
      subtitle="Performance rankings, store efficiency quadrants, and store x day matrix"
      onRefresh={loadStoresData}
    >
      {loading ? (
        <div className="flex items-center justify-center py-28 text-slate-400">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-[13px] font-medium text-slate-600">Benchmarking store network...</span>
          </div>
        </div>
      ) : error ? (
        <div className="card p-6 bg-rose-50 border-rose-200 text-rose-700 space-y-3">
          <h4 className="font-bold text-sm">Failed to load stores data</h4>
          <p className="text-xs">{error}</p>
          <button
            onClick={loadStoresData}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Top View Selector & Network KPI Summary */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200">
            {/* View Selector Tabs */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              <button
                onClick={() => setActiveView('table')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  activeView === 'table' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TableIcon size={14} />
                <span>Ranking Table</span>
              </button>

              <button
                onClick={() => setActiveView('heatmap')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  activeView === 'heatmap' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Grid size={14} />
                <span>Store × Day Heatmap</span>
              </button>
            </div>

            {/* Network Benchmark summary */}
            <div className="flex items-center gap-4 text-xs">
              <span className="text-slate-500">
                Network Sales: <strong className="text-slate-900 font-bold">{formatCurrency(data?.total_network_sales)}</strong>
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-500">
                Avg AOV: <strong className="text-slate-900 font-bold">₹{formatIndianNumber(Math.round(data?.network_benchmarks?.avg_aov || 0))}</strong>
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-500">
                Avg UPT: <strong className="text-slate-900 font-bold">{(Number(data?.network_benchmarks?.avg_upt) || 1.3).toFixed(2)}</strong>
              </span>
            </div>
          </div>

          {/* Active View Display */}
          {activeView === 'table' && (
            <DataTable
              columns={columns}
              data={data?.stores || []}
              pageSize={55}
              title="Store Network Ranking"
              csvFilename="kadam_stores_ranking.csv"
              searchPlaceholder="Search store name or region..."
              defaultSort={{ key: 'net_sales_incl_gst', dir: 'desc' }}
            />
          )}

          {activeView === 'heatmap' && (
            <StoreDayHeatmap
              data={heatmapData}
              onSelectStore={handleOpenStore}
            />
          )}

          {/* Store Scorecard Drawer */}
          <StoreDrawer
            isOpen={Boolean(selectedStore)}
            storeName={selectedStore}
            storeMeta={selectedStoreMeta}
            filters={filterQueryObj}
            onClose={() => setSelectedStore(null)}
          />
        </div>
      )}
    </PageShell>
  );
}
