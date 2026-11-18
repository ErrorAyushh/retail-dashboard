import { useEffect, useState } from 'react';
import {
  Users,
  UserCheck,
  ShieldCheck,
  ShieldAlert,
  FileText,
  Lock,
  Calendar,
  Building,
  CreditCard,
  ShoppingBag,
  Info
} from 'lucide-react';
import PageShell from '../components/PageShell';
import MetricCard from '../components/MetricCard';
import DataTable from '../tables/DataTable';
import { useFilters } from '../context/FilterContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { formatCurrency, formatNumber, formatPercent, formatDate, formatStoreName } from '../utils/format';

export default function Customers() {
  const { filterQueryObj } = useFilters();
  const { canViewPII } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadCustomers = () => {
    setLoading(true);
    setError(null);
    api.getCustomers(filterQueryObj, canViewPII)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load customer data:', err);
        setError(err.message || 'Failed to fetch customer data');
        setLoading(false);
      });
  };

  useEffect(() => {
    loadCustomers();
  }, [filterQueryObj, canViewPII]);

  const k = data?.kpis || {};

  const customerColumns = [
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
      key: 'customer_name',
      label: 'Customer Name',
      width: '210px',
      render: (r) => (
        <span className="font-bold text-slate-900 block truncate">
          {r.customer_name || 'Walk-in Customer'}
        </span>
      ),
    },
    {
      key: 'customer_mobile',
      label: 'Mobile Number',
      width: '140px',
      render: (r) => (
        <span className="font-mono text-xs font-semibold text-slate-800 tabular-nums">
          {r.customer_mobile || '—'}
        </span>
      ),
    },
    {
      key: 'total_spend',
      label: 'Total Spend',
      align: 'right',
      width: '140px',
      render: (r) => (
        <span className="font-bold text-slate-900 tabular-nums">{formatCurrency(r.total_spend)}</span>
      ),
    },
    {
      key: 'bill_count',
      label: 'Visits (Bills)',
      align: 'right',
      width: '100px',
      render: (r) => (
        <span className={`tabular-nums font-bold ${r.bill_count >= 2 ? 'text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded' : 'text-slate-700'}`}>
          {formatNumber(r.bill_count)}
        </span>
      ),
    },
    {
      key: 'units',
      label: 'Units',
      align: 'right',
      width: '80px',
      render: (r) => (
        <span className="tabular-nums text-slate-700">{formatNumber(r.units)}</span>
      ),
    },
    {
      key: 'first_visit',
      label: 'First Visit in Window',
      width: '140px',
      render: (r) => (
        <span className="text-[11.5px] text-slate-500">{formatDate(r.first_visit)}</span>
      ),
    },
    {
      key: 'latest_visit',
      label: 'Latest Visit',
      width: '140px',
      render: (r) => (
        <span className="text-[11.5px] text-slate-500">{formatDate(r.latest_visit)}</span>
      ),
    },
    {
      key: 'stores_visited',
      label: 'Stores Visited',
      render: (r) => (
        <span className="text-[11.5px] text-slate-600 truncate block">
          {(r.stores_visited || []).map(formatStoreName).join(', ') || '—'}
        </span>
      ),
    },
  ];

  const gstColumns = [
    {
      key: 'bill_date',
      label: 'Bill Date',
      width: '110px',
      render: (r) => <span className="text-[11.5px] text-slate-600">{formatDate(r.bill_date)}</span>
    },
    {
      key: 'bill_number',
      label: 'Bill #',
      width: '120px',
      render: (r) => <span className="font-mono text-xs font-semibold text-slate-900">{r.bill_number}</span>
    },
    {
      key: 'store_name',
      label: 'Store',
      width: '180px',
      render: (r) => <span className="font-medium text-slate-800">{formatStoreName(r.store_name)}</span>
    },
    {
      key: 'customer_gst_number',
      label: 'GSTIN',
      width: '160px',
      render: (r) => (
        <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50/60 px-1.5 py-0.5 rounded border border-indigo-100">
          {r.customer_gst_number}
        </span>
      )
    },
    {
      key: 'customer_name',
      label: 'B2B Purchaser',
      width: '170px',
      render: (r) => (
        <span className="text-xs font-semibold text-slate-800 truncate block">{r.customer_name}</span>
      )
    },
    {
      key: 'customer_mobile',
      label: 'Contact',
      width: '130px',
      render: (r) => (
        <span className="font-mono text-xs text-slate-700 tabular-nums">{r.customer_mobile || '—'}</span>
      )
    },
    {
      key: 'product_name',
      label: 'Product',
      render: (r) => <span className="text-xs text-slate-600 truncate block">{r.product_name}</span>
    },
    {
      key: 'amount_incl_gst',
      label: 'Net Amount',
      align: 'right',
      width: '120px',
      render: (r) => (
        <span className="font-bold text-slate-900 tabular-nums">{formatCurrency(r.amount_incl_gst)}</span>
      ),
    },
    {
      key: 'gst',
      label: 'GST ₹',
      align: 'right',
      width: '100px',
      render: (r) => (
        <span className="font-medium text-slate-600 tabular-nums">{formatCurrency(r.gst)}</span>
      ),
    },
  ];

  return (
    <PageShell
      title="Customer Intelligence"
      subtitle="Repeat visit dynamics, spend distribution, and GST business invoice drilldown"
      onRefresh={loadCustomers}
    >
      {loading ? (
        <div className="flex items-center justify-center py-24 text-gray-400">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="card p-6 bg-rose-50 text-rose-700">{error}</div>
      ) : (
        <div className="space-y-6">
          {/* Status Banner */}
          <div className="card p-4 flex flex-wrap items-center justify-between gap-3 bg-emerald-50/50 border border-emerald-200/80">
            <div className="flex items-center gap-3">
              <ShieldCheck size={20} className="text-emerald-600 shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <span>Customer Directory & Contact Intelligence</span>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Full Info Active
                  </span>
                </h4>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Showing complete customer names, active phone numbers, and GSTIN identifiers across retail transactions.
                </p>
              </div>
            </div>

            <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-md border border-emerald-200">
              <UserCheck size={13} />
              <span>Unmasked Access Active</span>
            </div>
          </div>

          {/* 1. Summary KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
            <div className="card p-4 bg-white border border-slate-200/90 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Users size={13} className="text-indigo-600" /> Total Customers
              </span>
              <div className="text-2xl font-black text-slate-900 tabular-nums">
                {formatNumber(k.unique_customers)}
              </div>
              <p className="text-[11px] text-slate-500">
                Unique phone / customer_key
              </p>
            </div>

            <div className="card p-4 bg-white border border-slate-200/90 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Calendar size={13} className="text-slate-600" /> First Seen in Window
              </span>
              <div className="text-2xl font-black text-slate-900 tabular-nums">
                {formatNumber(k.first_seen_in_window)}
              </div>
              <p className="text-[11px] text-slate-500">
                Single bill in 35-day window
              </p>
            </div>

            <div className="card p-4 bg-white border border-slate-200/90 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <UserCheck size={13} className="text-emerald-600" /> Repeat Shoppers
              </span>
              <div className="text-2xl font-black text-emerald-700 tabular-nums">
                {formatNumber(k.repeat_customers)}
              </div>
              <p className="text-[11px] text-slate-500">
                2+ distinct visits in window
              </p>
            </div>

            <div className="card p-4 bg-white border border-slate-200/90 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <ShoppingBag size={13} className="text-amber-600" /> Repeat Rate
              </span>
              <div className="text-2xl font-black text-slate-900 tabular-nums">
                {formatPercent(k.repeat_rate)}
              </div>
              <p className="text-[11px] text-slate-500">
                Repeat / Total shoppers
              </p>
            </div>

            <div className="card p-4 bg-white border border-slate-200/90 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <CreditCard size={13} className="text-sky-600" /> Avg Customer Spend
              </span>
              <div className="text-2xl font-black text-slate-900 tabular-nums">
                {formatCurrency(k.avg_spend_per_customer)}
              </div>
              <p className="text-[11px] text-slate-500">
                Avg {k.avg_bills_per_customer} invoices / customer
              </p>
            </div>
          </div>

          {/* 2. Visit Frequency Distribution */}
          <div className="card p-5 space-y-3.5 bg-white border border-slate-200/90">
            <div>
              <h3 className="text-sm font-bold text-slate-900 leading-tight">Visit Frequency Distribution</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Breakdown of customer cohort sizes and revenue contribution by invoice visits
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5 pt-1">
              {(data?.frequency || []).map((f) => (
                <div key={f.frequency_bucket} className="p-4 bg-slate-50/70 border border-slate-200/70 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>{f.frequency_bucket}</span>
                    <span className="text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded text-[10.5px]">
                      {f.share_pct}% shoppers
                    </span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 tabular-nums">
                    {formatNumber(f.customers_count)}
                  </div>
                  <div className="text-[11px] text-slate-500 border-t border-slate-200/60 pt-2 flex items-center justify-between">
                    <span>Total Sales:</span>
                    <strong className="text-slate-900 font-bold">{formatCurrency(f.total_spend)}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Top Customers by Spend Table */}
          <DataTable
            columns={customerColumns}
            data={data?.top_customers || []}
            pageSize={25}
            title="Top Spenders by Cumulative Value"
            subtitle="Top 50 customers ranked by total retail spend across Neemans stores with full unmasked customer details and mobile numbers."
            csvFilename="kadam_top_customers.csv"
            searchPlaceholder="Search customer..."
            defaultSort={{ key: 'total_spend', dir: 'desc' }}
          />

          {/* 4. GST Business Invoices Table */}
          <div className="card p-5 space-y-3 bg-white border border-slate-200/90">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <FileText size={16} className="text-indigo-600" />
                  <span>GST Business Invoices (has_gstin = true)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  High-confidence B2B retail transactions tagged with customer GST identification numbers
                </p>
              </div>
            </div>

            <DataTable
              columns={gstColumns}
              data={data?.gst_invoices || []}
              pageSize={20}
              title="GST Invoiced Bills"
              csvFilename="kadam_gst_invoices.csv"
            />
          </div>
        </div>
      )}
    </PageShell>
  );
}
