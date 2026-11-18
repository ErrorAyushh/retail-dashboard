import { useEffect, useState, useMemo } from 'react';
import {
  Package,
  Grid,
  Layers,
  Sparkles,
  TrendingUp,
  Percent,
  ShoppingBag,
  Footprints,
  Tag,
  BarChart2,
  Table as TableIcon,
  Flame
} from 'lucide-react';
import PageShell from '../components/PageShell';
import DataTable from '../tables/DataTable';
import SizeCurveChart from '../charts/SizeCurveChart';
import ProductHeatmap from '../charts/ProductHeatmap';
import DiscountMarginScatter from '../charts/DiscountMarginScatter';
import PriceBandChart from '../charts/PriceBandChart';
import CombosTable from '../components/CombosTable';
import ProductSizeMatrixModal from '../components/ProductSizeMatrixModal';
import { useFilters } from '../context/FilterContext';
import { api } from '../api/client';
import { formatCurrency, formatNumber, formatPercent } from '../utils/format';

export default function Products() {
  const { filterQueryObj } = useFilters();
  const [groupBy, setGroupBy] = useState('product'); // 'product' | 'color'
  const [activeView, setActiveView] = useState('table'); // 'table' | 'heatmap' | 'scatter'
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Product x Size matrix modal
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isMatrixOpen, setIsMatrixOpen] = useState(false);

  const loadProducts = () => {
    setLoading(true);
    setError(null);
    api.getProducts(filterQueryObj, groupBy)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load products data:', err);
        setError(err.message || 'Failed to fetch products');
        setLoading(false);
      });
  };

  useEffect(() => {
    loadProducts();
  }, [filterQueryObj, groupBy]);

  const openMatrix = (productName) => {
    setSelectedProduct(productName);
    setIsMatrixOpen(true);
  };

  // Summary Metrics
  const summary = useMemo(() => {
    if (!data?.best_sellers || data.best_sellers.length === 0) return null;
    const totalProducts = data.best_sellers.length;
    const totalSales = data.best_sellers.reduce((acc, p) => acc + (p.net_sales_incl_gst || 0), 0);
    const totalUnits = data.best_sellers.reduce((acc, p) => acc + (p.net_units || 0), 0);
    const topDept = data.department_split?.[0] || { department: 'Footwear', share_pct: 0 };
    const topCombo = data.best_combos?.[0] || null;

    return {
      totalProducts,
      totalSales,
      totalUnits,
      topDept,
      topCombo,
    };
  }, [data]);

  // Max product sales for inline progress bar
  const maxSales = useMemo(() => {
    if (!data?.best_sellers?.length) return 1;
    return Math.max(...data.best_sellers.map(p => p.net_sales_incl_gst || 0), 1);
  }, [data]);

  const columns = [
    {
      key: 'rank',
      label: '#',
      width: '45px',
      sortable: false,
      render: (val, row, idx) => {
        let num = 1;
        if (typeof idx === 'number' && !isNaN(idx)) {
          num = idx + 1;
        } else if (typeof row === 'number' && !isNaN(row)) {
          num = row + 1;
        } else if (typeof val === 'number' && !isNaN(val)) {
          num = val;
        }
        return (
          <span className="text-[11px] font-bold text-slate-400">#{num}</span>
        );
      },
    },
    {
      key: 'product_name',
      label: 'Product Name',
      width: '260px',
      render: (r) => (
        <button
          onClick={() => openMatrix(r.product_name)}
          className="text-left font-semibold text-indigo-700 hover:text-indigo-900 hover:underline flex items-center gap-1.5 group"
          title="Click to view Size x Colour Heat Matrix"
        >
          <Package size={14} className="text-slate-400 group-hover:text-indigo-600 shrink-0" />
          <span className="truncate">{r.product_name}</span>
        </button>
      ),
    },
    ...(groupBy === 'color' ? [{ key: 'color', label: 'Colour', width: '110px' }] : []),
    {
      key: 'department',
      label: 'Dept',
      width: '110px',
      render: (r) => (
        <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded truncate block max-w-[100px]" title={r.department}>
          {r.department || '—'}
        </span>
      ),
    },
    {
      key: 'gender',
      label: 'Gender',
      width: '90px',
      render: (r) => (
        <span className="text-[11px] text-slate-500">
          {r.gender || 'Unisex'}
        </span>
      ),
    },
    {
      key: 'net_units',
      label: 'Units',
      align: 'right',
      width: '90px',
      render: (r) => (
        <span className="font-semibold text-slate-700 tabular-nums">
          {formatNumber(r.net_units)}
        </span>
      ),
    },
    {
      key: 'net_sales_incl_gst',
      label: 'Net Sales',
      align: 'right',
      width: '180px',
      render: (r) => {
        const pct = Math.min(100, Math.round(((r.net_sales_incl_gst || 0) / maxSales) * 100));
        return (
          <div className="space-y-1 text-right">
            <span className="font-bold text-slate-900 tabular-nums">
              {formatCurrency(r.net_sales_incl_gst)}
            </span>
            <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
              <div
                className="bg-indigo-600 h-full rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      key: 'gross_margin_pct',
      label: 'Margin %',
      align: 'right',
      width: '100px',
      render: (r) => {
        const val = r.gross_margin_pct;
        const colorClass =
          val >= 68
            ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
            : val >= 60
            ? 'text-indigo-700 bg-indigo-50 border-indigo-200'
            : 'text-amber-700 bg-amber-50 border-amber-200';
        return (
          <span className={`inline-block px-1.5 py-0.5 text-[11px] font-bold rounded border tabular-nums ${colorClass}`}>
            {formatPercent(val)}
          </span>
        );
      },
    },
    {
      key: 'discount_pct',
      label: 'Discount %',
      align: 'right',
      width: '100px',
      render: (r) => (
        <span className="text-slate-600 font-medium tabular-nums">
          {formatPercent(r.discount_pct)}
        </span>
      ),
    },
    {
      key: 'return_rate',
      label: 'Return Rate',
      align: 'right',
      width: '100px',
      render: (r) => (
        <span
          className={`tabular-nums font-medium ${
            r.return_rate > 5 ? 'text-rose-600 font-bold' : 'text-slate-500'
          }`}
        >
          {formatPercent(r.return_rate)}
        </span>
      ),
    },
    {
      key: 'stores_selling',
      label: 'Store Reach',
      align: 'right',
      width: '110px',
      render: (r) => (
        <span className="text-[11.5px] text-slate-500 tabular-nums">
          {r.stores_selling} / 55
        </span>
      ),
    },
  ];

  return (
    <PageShell
      title="Product Catalog & Best Sellers"
      subtitle="Merchandising performance, size availability curves, product combos, and price bands"
      onRefresh={loadProducts}
    >
      <div className="space-y-6">
        {/* Hero Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card p-4 bg-white border border-slate-200/90 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Package size={13} className="text-indigo-600" /> Catalog Depth
              </span>
              <div className="text-2xl font-black text-slate-900 tabular-nums">
                {formatNumber(summary.totalProducts)}
              </div>
              <p className="text-[11px] text-slate-500">
                Active products in current filtered window
              </p>
            </div>

            <div className="card p-4 bg-white border border-slate-200/90 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <TrendingUp size={13} className="text-emerald-600" /> Total Net Revenue
              </span>
              <div className="text-2xl font-black text-slate-900 tabular-nums">
                {formatCurrency(summary.totalSales)}
              </div>
              <p className="text-[11px] text-slate-500">
                Across {formatNumber(summary.totalUnits)} total units sold
              </p>
            </div>

            <div className="card p-4 bg-white border border-slate-200/90 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Layers size={13} className="text-sky-600" /> Leading Department
              </span>
              <div className="text-2xl font-black text-slate-900 truncate">
                {summary.topDept.department}
              </div>
              <p className="text-[11px] text-slate-500">
                {summary.topDept.share_pct}% revenue share ({formatCurrency(summary.topDept.net_sales)})
              </p>
            </div>

            <div className="card p-4 bg-white border border-slate-200/90 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Sparkles size={13} className="text-indigo-600" /> Top Combo Pair
              </span>
              <div className="text-sm font-bold text-slate-900 truncate mt-1">
                {summary.topCombo ? `${summary.topCombo.item_a} + ${summary.topCombo.item_b}` : '—'}
              </div>
              <p className="text-[11px] text-slate-500">
                {summary.topCombo ? `${formatNumber(summary.topCombo.support_bills)} bills together` : 'Single items'}
              </p>
            </div>
          </div>
        )}

        {/* View Switcher Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs font-semibold">
            <button
              onClick={() => setActiveView('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                activeView === 'table' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon size={14} /> Ranking Table
            </button>
            <button
              onClick={() => setActiveView('heatmap')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                activeView === 'heatmap' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Flame size={14} className="text-amber-500" /> Product Heatmap
            </button>
            <button
              onClick={() => setActiveView('scatter')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                activeView === 'scatter' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart2 size={14} /> Discount vs Margin
            </button>
          </div>

          {activeView === 'table' && (
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
              <button
                onClick={() => setGroupBy('product')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  groupBy === 'product' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'
                }`}
              >
                By Product
              </button>
              <button
                onClick={() => setGroupBy('color')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  groupBy === 'color' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'
                }`}
              >
                By Product × Colour
              </button>
            </div>
          )}
        </div>

        {/* Dynamic View Content */}
        {activeView === 'table' && (
          <div className="space-y-3">
            <DataTable
              columns={columns}
              data={data?.best_sellers || []}
              pageSize={50}
              title={groupBy === 'color' ? 'Product & Colour Performance' : 'Best Sellers Ranking'}
              subtitle="Ranked by total net sales revenue. Click any product to view its color and UK size distribution."
              csvFilename="kadam_best_sellers.csv"
              itemLabel={groupBy === 'color' ? 'variant' : 'product'}
              rowKey={(r, i) => `${r.product_name}_${r.color || ''}_${i}`}
              defaultSort={{ key: 'net_sales_incl_gst', dir: 'desc' }}
            />
          </div>
        )}

        {activeView === 'heatmap' && (
          <ProductHeatmap
            products={data?.best_sellers || []}
            onSelectProduct={(name) => openMatrix(name)}
          />
        )}

        {activeView === 'scatter' && (
          <DiscountMarginScatter
            products={data?.best_sellers || []}
            onSelectProduct={(name) => openMatrix(name)}
          />
        )}

        {/* Footwear Size Curve Chart & MRP Price-Band Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <SizeCurveChart data={data?.size_curve || []} />
          <PriceBandChart data={data?.price_bands || []} />
        </div>

        {/* Gender Mix */}
        <div className="card p-5 space-y-4 bg-white border border-slate-200/90">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900 leading-tight">Gender Mix</h4>
              <p className="text-xs text-slate-500 mt-0.5">Revenue and units distributed by target gender</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(data?.gender_split || []).map((g) => (
              <div key={g.gender} className="p-3 bg-slate-50/70 border border-slate-100 rounded-lg space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">{g.gender}</span>
                  <span className="text-slate-400 text-[11px]">({g.share_pct}%)</span>
                </div>
                <div className="text-base font-bold text-slate-900 tabular-nums">
                  {formatCurrency(g.net_sales)}
                </div>
                <div className="w-full bg-slate-200/70 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full transition-all"
                    style={{ width: `${g.share_pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Best Product Combos (Market Basket Analysis) */}
        <CombosTable combos={data?.best_combos || []} />

        {/* Product x Size Matrix Modal */}
        <ProductSizeMatrixModal
          productName={selectedProduct}
          filters={filterQueryObj}
          isOpen={isMatrixOpen}
          onClose={() => {
            setIsMatrixOpen(false);
            setSelectedProduct(null);
          }}
        />
      </div>
    </PageShell>
  );
}
