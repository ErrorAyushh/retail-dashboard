import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Lightbulb, 
  AlertTriangle, 
  TrendingUp, 
  Sparkles, 
  ArrowRight, 
  X, 
  Pin,
  CheckCircle2,
  Info
} from 'lucide-react';
import { formatCurrency } from '../utils/format';

export default function InsightsStrip({ insights = [] }) {
  const [dismissedIds, setDismissedIds] = useState([]);
  const [pinnedIds, setPinnedIds] = useState([]);
  const [activeGroup, setActiveGroup] = useState('all'); // 'all' | 'Risks' | 'Opportunities' | 'Notable'
  const navigate = useNavigate();

  if (!insights || insights.length === 0) return null;

  const visibleInsights = insights.filter(ins => !dismissedIds.includes(ins.id || ins.title));

  // Sort: pinned first, then by rupee_impact descending
  const sortedInsights = [...visibleInsights].sort((a, b) => {
    const aPin = pinnedIds.includes(a.id || a.title);
    const bPin = pinnedIds.includes(b.id || b.title);
    if (aPin && !bPin) return -1;
    if (!aPin && bPin) return 1;
    return (b.rupee_impact || 0) - (a.rupee_impact || 0);
  });

  const filteredInsights = activeGroup === 'all'
    ? sortedInsights
    : sortedInsights.filter(ins => (ins.group || 'Notable') === activeGroup);

  const togglePin = (id) => {
    setPinnedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const dismiss = (id) => {
    setDismissedIds(prev => [...prev, id]);
  };

  return (
    <div className="card p-5 space-y-3.5 bg-gradient-to-r from-white via-indigo-50/15 to-white">
      {/* Header with Group Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
            <Lightbulb size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 leading-tight flex items-center gap-2">
              Actionable Retail Intelligence
              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.2 rounded-full">
                {visibleInsights.length} signals
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Rule-generated operational signals ranked by computed rupee impact
            </p>
          </div>
        </div>

        {/* Group Tabs */}
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          {['all', 'Risks', 'Opportunities', 'Notable'].map((grp) => (
            <button
              key={grp}
              onClick={() => setActiveGroup(grp)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all capitalize ${
                activeGroup === grp
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {grp}
            </button>
          ))}
        </div>
      </div>

      {/* Insight Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filteredInsights.map((ins) => {
          const id = ins.id || ins.title || ins.headline;
          const isPinned = pinnedIds.includes(id);
          const isRisk = ins.group === 'Risks' || ins.severity === 'negative' || ins.severity === 'warning';
          const isOpp = ins.group === 'Opportunities' || ins.severity === 'positive';

          return (
            <div
              key={id}
              className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all bg-white hover:shadow-xs ${
                isPinned
                  ? 'ring-1 ring-indigo-500 border-indigo-200'
                  : isRisk
                  ? 'border-rose-100 hover:border-rose-200'
                  : isOpp
                  ? 'border-emerald-100 hover:border-emerald-200'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                {/* Badge line */}
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold text-[10.5px] uppercase tracking-wider ${
                      isRisk
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : isOpp
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    }`}
                  >
                    {isRisk ? <AlertTriangle size={11} /> : isOpp ? <TrendingUp size={11} /> : <Sparkles size={11} />}
                    {ins.group || (isRisk ? 'Risk' : isOpp ? 'Opportunity' : 'Notable')}
                  </span>

                  <div className="flex items-center gap-1 text-slate-400">
                    <button
                      onClick={() => togglePin(id)}
                      className={`p-1 rounded hover:bg-slate-100 ${isPinned ? 'text-indigo-600 font-bold' : ''}`}
                      title={isPinned ? 'Unpin insight' : 'Pin to top'}
                    >
                      <Pin size={12} className={isPinned ? 'fill-indigo-600 text-indigo-600' : ''} />
                    </button>
                    <button
                      onClick={() => dismiss(id)}
                      className="p-1 rounded hover:bg-slate-100 hover:text-slate-600"
                      title="Dismiss"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>

                {/* Headline & Description */}
                <h4 className="text-[13px] font-bold text-slate-900 leading-tight mt-1">
                  {ins.headline || ins.title}
                </h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {ins.description}
                </p>
              </div>

              {/* Bottom Rupee Impact & Action Button */}
              <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                {ins.impact_label ? (
                  <span className="font-bold text-slate-800 tabular-nums text-[11.5px] bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                    {ins.impact_label}
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400">{ins.metric}</span>
                )}

                {ins.link && (
                  <button
                    onClick={() => navigate(ins.link)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                  >
                    <span>View</span>
                    <ArrowRight size={13} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
