import { useEffect, useState, useMemo } from 'react';
import {
  UserCheck,
  Award,
  Store,
  SlidersHorizontal,
  UserX,
  TrendingUp,
  ShoppingBag,
  Percent,
  Sparkles,
  Trophy
} from 'lucide-react';
import PageShell from '../components/PageShell';
import DataTable from '../tables/DataTable';
import { useFilters } from '../context/FilterContext';
import { api } from '../api/client';
import { formatCurrency, formatNumber, formatPercent, formatStoreName } from '../utils/format';

export default function Staff() {
  const { filterQueryObj, startDate, endDate } = useFilters();

  const daysDiff = useMemo(() => {
    if (!startDate || !endDate) return 1;
    const s = new Date(startDate);
    const e = new Date(endDate);
    return Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1);
  }, [startDate, endDate]);

  const defaultMin = useMemo(() => {
    if (daysDiff <= 1) return 1;
    if (daysDiff <= 7) return 5;
    if (daysDiff <= 14) return 10;
    return 20;
  }, [daysDiff]);

  const [minBills, setMinBills] = useState(defaultMin);

  useEffect(() => {
    setMinBills(defaultMin);
  }, [defaultMin]);

  const thresholdOptions = useMemo(() => {
    if (daysDiff <= 1) return [1, 2, 3, 5];
    if (daysDiff <= 7) return [1, 5, 10, 20];
    if (daysDiff <= 14) return [1, 5, 10, 25];
    return [1, 10, 20, 50];
  }, [daysDiff]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadStaff = () => {
    setLoading(true);
    setError(null);
    api.getStaff(filterQueryObj, minBills)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load staff leaderboard:', err);
        setError(err.message || 'Failed to fetch staff data');
        setLoading(false);
      });
  };

  useEffect(() => {
    loadStaff();
  }, [filterQueryObj, minBills]);

  const top3 = useMemo(() => {
    return (data?.leaderboard || []).slice(0, 3);
  }, [data]);

  // Helper for initials
  const getInitials = (name) => {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const columns = [
    {
      key: 'rank',
      label: '#',
      width: '45px',
      sortable: false,
      render: (val, r, idx) => {
        const row = r && typeof r === 'object' ? r : val;
        let num = typeof idx === 'number' && !isNaN(idx) ? idx + 1 : 1;
        return (
          <span className="text-[11px] font-bold text-slate-400">
            {row?.salesman_name === 'Unassigned' ? '—' : `#${num}`}
          </span>
        );
      },
    },
    {
      key: 'salesman_name',
      label: 'Associate',
      width: '260px',
      render: (r, idx) => {
        const initials = getInitials(r.salesman_name);
        const storesText = (r.stores_worked || []).map(formatStoreName).slice(0, 2).join(', ');
        return (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <span className="font-semibold text-slate-900 truncate block">{r.salesman_name}</span>
              <span className="text-[11px] text-slate-400 truncate block">
                {r.stores_count} {r.stores_count === 1 ? 'store' : 'stores'} ({storesText})
              </span>
            </div>
          </div>
        );
      },
    },
    {
      key: 'net_sales_incl_gst',
      label: 'Net Sales',
      align: 'right',
      width: '160px',
      render: (r) => (
        <span className="font-bold text-slate-900 tabular-nums">
          {formatCurrency(r.net_sales_incl_gst)}
        </span>
      ),
    },
    {
      key: 'bills',
      label: 'Bills',
      align: 'right',
      width: '90px',
      render: (r) => (
        <span className="text-slate-700 font-semibold tabular-nums">
          {formatNumber(r.bills)}
        </span>
      ),
    },
    {
      key: 'upt',
      label: 'UPT',
      align: 'right',
      width: '90px',
      render: (r) => (
        <span className={`tabular-nums font-bold ${r.upt >= 1.4 ? 'text-emerald-700' : 'text-slate-700'}`}>
          {r.upt?.toFixed(2)}
        </span>
      ),
    },
    {
      key: 'aov',
      label: 'AOV',
      align: 'right',
      width: '120px',
      render: (r) => (
        <span className="text-slate-700 tabular-nums font-medium">
          {formatCurrency(r.aov, { compact: false })}
        </span>
      ),
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
        <span className={`tabular-nums font-medium ${r.return_rate > 5 ? 'text-rose-600 font-bold' : 'text-slate-500'}`}>
          {formatPercent(r.return_rate)}
        </span>
      ),
    },
    {
      key: 'share_pct',
      label: 'Network Share',
      align: 'right',
      width: '110px',
      render: (r) => (
        <span className="text-slate-500 text-[11.5px] tabular-nums font-medium">
          {r.share_pct}%
        </span>
      ),
    },
  ];

  return (
    <PageShell
      title="Store Staff & Salesman Leaderboard"
      subtitle="Retail associate sales performance, productivity, basket size (UPT), and discount discipline"
      onRefresh={loadStaff}
    >
      <div className="space-y-6">
        {/* Top 3 Podium Strip */}
        {top3.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {top3.map((staff, idx) => {
              const badgeColors = [
                'bg-amber-50 border-amber-300 text-amber-800',
                'bg-slate-100 border-slate-300 text-slate-700',
                'bg-orange-50 border-orange-300 text-orange-800'
              ];
              const trophyLabels = ['#1 Top Performer', '#2 Silver Rank', '#3 Bronze Rank'];

              return (
                <div
                  key={staff.salesman_name}
                  className={`card p-4 bg-white border ${idx === 0 ? 'border-amber-300 shadow-sm' : 'border-slate-200'} space-y-3 relative overflow-hidden`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border flex items-center gap-1 ${badgeColors[idx]}`}>
                      <Trophy size={11} /> {trophyLabels[idx]}
                    </span>
                    <span className="text-xs font-bold text-slate-400">
                      {staff.share_pct}% Network Share
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-black text-sm flex items-center justify-center shrink-0">
                      {getInitials(staff.salesman_name)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-slate-900 truncate">{staff.salesman_name}</h4>
                      <p className="text-[11px] text-slate-400 truncate">
                        {(staff.stores_worked || []).map(formatStoreName).join(', ')}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100 text-center">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Net Sales</span>
                      <span className="text-xs font-black text-slate-900">{formatCurrency(staff.net_sales_incl_gst)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">UPT</span>
                      <span className="text-xs font-black text-emerald-700">{staff.upt?.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">AOV</span>
                      <span className="text-xs font-black text-slate-900">{formatCurrency(staff.aov)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Qualifier Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white card p-3.5 border border-slate-200/90">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">Minimum Bills to Qualify:</span>
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs font-semibold">
              {thresholdOptions.map((num) => (
                <button
                  key={num}
                  onClick={() => setMinBills(num)}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    minBills === num ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {num === 1 ? 'All (1+ Bill)' : `${num} Bills`}
                </button>
              ))}
            </div>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            Displaying <strong>{data?.total_ranked_staff || 0}</strong> associates meeting threshold
          </span>
        </div>

        {/* Staff Leaderboard Table */}
        <DataTable
          columns={columns}
          data={data?.leaderboard || []}
          pageSize={50}
          title="Associate Leaderboard"
          subtitle="Ranked by total net revenue generated. Includes transaction metrics, basket size, and discount depth."
          csvFilename="kadam_staff_leaderboard.csv"
          searchPlaceholder="Search associate or store..."
          defaultSort={{ key: 'net_sales_incl_gst', dir: 'desc' }}
        />

        {/* Unassigned Store Billing Box */}
        {data?.unassigned && (
          <div className="card p-4 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs space-y-2">
            <div className="flex items-center gap-2 text-amber-900 font-bold">
              <UserX size={16} className="text-amber-600" />
              <span>Unassigned Associate Receipts in POS</span>
            </div>
            <p className="text-slate-700 leading-relaxed">
              Invoices processed without an associate identifier logged in Wondersoft POS:{' '}
              <strong>{formatNumber(data.unassigned.bills)} bills</strong> generating{' '}
              <strong>{formatCurrency(data.unassigned.net_sales_incl_gst)}</strong> ({data.unassigned.share_pct}% of total retail sales).
            </p>
          </div>
        )}
      </div>
    </PageShell>
  );
}
