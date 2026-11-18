import { formatDelta } from '../utils/format';

export default function ChangeBadge({ current, previous, kind = 'percent', size = 'sm', invert = false }) {
  const { label, tone, hasArrow } = formatDelta(current, previous, kind, invert);

  if (label === '—') {
    return (
      <span className="inline-flex items-center text-gray-400 font-medium text-[11.5px] tabular-nums">
        —
      </span>
    );
  }

  const colorClass =
    tone === 'pos'
      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
      : tone === 'neg'
      ? 'bg-rose-50 text-rose-700 border border-rose-200/60'
      : 'bg-gray-100 text-gray-600 border border-gray-200';

  const sizeClass = size === 'xs' ? 'text-[11px] px-1.5 py-0.5' : 'text-[11.5px] px-2 py-0.5';

  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold rounded-md tabular-nums ${colorClass} ${sizeClass}`}>
      {label}
    </span>
  );
}
