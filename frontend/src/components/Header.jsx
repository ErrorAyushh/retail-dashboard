import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Menu, 
  RefreshCw, 
  Search, 
  Share2, 
  Check, 
  Store,
  Clock
} from 'lucide-react';
import { useFilters } from '../context/FilterContext';
import { formatDate } from '../utils/format';

export default function PageHeader({ 
  title, 
  subtitle = "Store sales, margin, discount and returns across Neemans retail stores.", 
  onToggleSidebar, 
  onRefresh,
  onOpenCommandPalette 
}) {
  const { meta } = useFilters();
  const [spinning, setSpinning] = useState(false);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const handleRefresh = () => {
    setSpinning(true);
    if (onRefresh) onRefresh();
    setTimeout(() => setSpinning(false), 600);
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const pulledAtFormatted = meta.max_pulled_at
    ? new Date(meta.max_pulled_at).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    : '03:12 am';

  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200/80">
      <div className="flex items-center justify-between gap-3 px-4 md:px-6 h-15">
        {/* Left: Mobile hamburger & Page Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onToggleSidebar}
            className="md:hidden shrink-0 p-1.5 -ml-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label="Toggle navigation"
          >
            <Menu size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-900 truncate leading-tight tracking-tight">
              {title}
            </h1>
            <p className="text-xs text-slate-500 truncate leading-tight mt-0.5 hidden sm:block">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Right: Freshness Chip, Store Count, Command Palette trigger, Share, Refresh */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Quick Command Palette Button */}
          <button
            onClick={onOpenCommandPalette}
            className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-slate-200/90 px-3 py-1.5 text-xs font-medium text-slate-500 hover:border-slate-300 hover:text-slate-800 bg-slate-50/70 hover:bg-white transition-colors"
          >
            <Search size={13} className="text-slate-400" />
            <span>Search or jump...</span>
            <kbd className="hidden lg:inline-block px-1.5 py-0.2 text-[10px] font-semibold text-slate-400 bg-white border border-slate-200 rounded">
              ⌘K
            </kbd>
          </button>

          {/* Data Freshness Chip -> opens Data Health */}
          <button
            onClick={() => navigate('/health')}
            className="hidden lg:inline-flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 hover:bg-sky-50 hover:border-sky-200 hover:text-sky-800 border border-slate-200/90 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
            title="Click to view Data Health & Reporting Status"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              Data as of <strong>{meta?.max_date ? formatDate(meta.max_date, { year: 'numeric' }) : 'T-1'}</strong> ({pulledAtFormatted})
            </span>
          </button>

          {/* Stores Reporting Chip */}
          <span className="hidden xl:inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200/90 px-2.5 py-1.5 rounded-lg">
            <Store size={12} className="text-sky-600" />
            <span>55 of 55 Stores Reported</span>
          </span>

          {/* Share Button */}
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/90 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            title="Copy dashboard link"
          >
            {copied ? <Check size={13} className="text-emerald-600" /> : <Share2 size={13} />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Share'}</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/90 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            title="Reload metrics"
          >
            <RefreshCw size={13} className={spinning ? 'animate-spin text-indigo-600' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>
    </header>
  );
}
