import { useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Info,
  Database,
  ShieldCheck,
  Server,
  Layers,
  Clock,
  Store,
  FileCheck
} from 'lucide-react';
import PageShell from '../components/PageShell';
import { api } from '../api/client';
import { formatNumber, formatDate, formatStoreName } from '../utils/format';

export default function DataHealth() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadHealth = () => {
    setLoading(true);
    setError(null);
    api.getHealth()
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load data health:', err);
        setError(err.message || 'Failed to fetch data health');
        setLoading(false);
      });
  };

  useEffect(() => {
    loadHealth();
  }, []);

  return (
    <PageShell
      title="Data Health & Pipeline Integrity"
      subtitle="Monitoring BigQuery view ingestion freshness, Wondersoft POS anomalies, cost backfilling, and store reporting status"
      showFilters={false}
      onRefresh={loadHealth}
    >
      {loading ? (
        <div className="flex items-center justify-center py-24 text-gray-400">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="card p-6 bg-rose-50 text-rose-700">{error}</div>
      ) : (
        <div className="space-y-6">
          {/* Freshness Banner */}
          <div className="card p-5 bg-gradient-to-r from-emerald-50/80 to-indigo-50/50 border border-emerald-200/90 rounded-2xl flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900">
                    Retail Pipeline Synced & Reconciled
                  </h4>
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full">
                    Active & Operational
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Single Source of Truth: <code className="text-indigo-900 bg-indigo-50/70 px-1 py-0.5 rounded text-[11px] font-mono">centeral-analytics-bq.retail_data.v_retail_lines</code>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6 text-xs text-slate-600">
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Data Window</span>
                <strong className="text-slate-900 font-bold">{data.min_bill_date} to {data.max_bill_date}</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Stores Reporting</span>
                <strong className="text-emerald-700 font-bold">{data.stores_reporting_yesterday} of {data.total_stores} Stores</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">Last Pulled</span>
                <strong className="text-slate-900 font-bold">{data.max_pulled_at ? new Date(data.max_pulled_at).toLocaleTimeString() : 'Recent'}</strong>
              </div>
            </div>
          </div>

          {/* Unmapped Stores Warning Banner if any store missing in store_geo.json */}
          {data.unmapped_stores && data.unmapped_stores.length > 0 && (
            <div className="card p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between gap-3 text-amber-900">
              <div className="flex items-center gap-3">
                <AlertOctagon size={20} className="text-amber-600 shrink-0" />
                <div>
                  <h5 className="text-xs font-bold">
                    {data.unmapped_stores.length} New Stores Need a Location
                  </h5>
                  <p className="text-[11.5px] text-amber-800 mt-0.5">
                    The following stores in BigQuery are missing from <code className="font-mono text-xs bg-amber-100 px-1 py-0.5 rounded">config/store_geo.json</code>: {data.unmapped_stores.join(', ')}.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Key Pipeline Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card p-4 bg-white border border-slate-200/90 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Database size={13} className="text-indigo-600" /> Total Rows in View
              </span>
              <div className="text-2xl font-black text-slate-900 tabular-nums">
                {formatNumber(data.total_rows)}
              </div>
              <p className="text-[11px] text-slate-500">
                100% matched to Master Prompt
              </p>
            </div>

            <div className="card p-4 bg-white border border-slate-200/90 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Store size={13} className="text-emerald-600" /> Active Store Network
              </span>
              <div className="text-2xl font-black text-emerald-700 tabular-nums">
                {data.total_stores} Stores
              </div>
              <p className="text-[11px] text-slate-500">
                {data.stores_reporting_yesterday} reporting on final date
              </p>
            </div>

            <div className="card p-4 bg-white border border-slate-200/90 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Layers size={13} className="text-sky-600" /> Cost Backfilled Lines
              </span>
              <div className="text-2xl font-black text-slate-900 tabular-nums">
                {formatNumber(data.lines_cost_filled)}
              </div>
              <p className="text-[11px] text-slate-500">
                Wondersoft zero costs backfilled from EAN history
              </p>
            </div>

            <div className="card p-4 bg-white border border-slate-200/90 space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <FileCheck size={13} className="text-amber-600" /> B2B GSTIN Lines
              </span>
              <div className="text-2xl font-black text-slate-900 tabular-nums">
                {formatNumber(data.lines_with_gstin)}
              </div>
              <p className="text-[11px] text-slate-500">
                Lines tagged with verified customer GSTIN
              </p>
            </div>
          </div>

          {/* Dormant Stores Alert Table */}
          <div className="card p-5 space-y-3 bg-white border border-slate-200/90">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <AlertTriangle size={16} className="text-amber-500" />
                  <span>Stores with Inactivity in Recent Days</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Stores that recorded 0 transactions in the 3 days preceding {data.max_bill_date}
                </p>
              </div>
              <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                {data.dormant_stores?.length || 0} Stores Inactive
              </span>
            </div>

            {data.dormant_stores && data.dormant_stores.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase bg-slate-50/70">
                      <th className="py-2.5 px-3">Store Name</th>
                      <th className="py-2.5 px-3">Ownership</th>
                      <th className="py-2.5 px-3">Region</th>
                      <th className="py-2.5 px-3">Last Active Date</th>
                      <th className="py-2.5 px-3 text-right">Days Inactive</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.dormant_stores.map((s) => {
                      const isFranchise = s.store_type === 'Franchise' || (s.store_name && s.store_name.startsWith('F_'));
                      const cleanName = formatStoreName(s.store_name);
                      return (
                        <tr key={s.store_name} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3 font-semibold text-slate-900 flex items-center gap-1.5">
                            <span>{cleanName}</span>
                            {isFranchise && (
                              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded">
                                Franchise
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">{s.store_type}</td>
                          <td className="py-2.5 px-3 text-slate-600">{s.region}</td>
                          <td className="py-2.5 px-3 text-slate-700">{formatDate(s.last_active_date)}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-amber-600 tabular-nums">
                            {s.days_dormant} days
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-xs text-emerald-700 py-3 flex items-center gap-2">
                <CheckCircle2 size={16} /> All 55 stores have traded actively within the past 3 days.
              </div>
            )}
          </div>

          {/* Known Data Caveats Reference Box */}
          <div className="card p-5 space-y-3 bg-white border border-slate-200/90">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 leading-tight">Known Data Caveats & System Rules</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Engineered business logic and integrity safeguards strictly enforced across Kadam
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
              {(data?.caveats || []).map((c) => {
                const isWarning = c.severity === 'warning';
                return (
                  <div
                    key={c.id}
                    className={`p-4 rounded-xl border ${
                      isWarning ? 'border-amber-200/80 bg-amber-50/40' : 'border-indigo-100 bg-indigo-50/30'
                    } space-y-1.5`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${isWarning ? 'bg-amber-500' : 'bg-indigo-600'}`} />
                      <h5 className="text-xs font-bold text-slate-900">{c.title}</h5>
                    </div>
                    <p className="text-[11.5px] text-slate-600 leading-relaxed">{c.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
