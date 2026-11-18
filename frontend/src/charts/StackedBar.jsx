export default function StackedBar({ segments = [], height = 12, showLabels = true }) {
  const total = segments.reduce((s, seg) => s + (seg.value || 0), 0) || 1;

  return (
    <div className="w-full">
      <div className="flex w-full rounded-full overflow-hidden bg-gray-100" style={{ height }}>
        {segments.map((seg) => {
          const pct = ((seg.value || 0) / total) * 100;
          if (pct <= 0) return null;
          return (
            <div
              key={seg.label || seg.name}
              style={{ width: `${pct}%`, background: seg.color }}
              title={`${seg.label || seg.name}: ${pct.toFixed(1)}%`}
              className="h-full transition-all"
            />
          );
        })}
      </div>
      {showLabels && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5">
          {segments.map((seg) => {
            const pct = ((seg.value || 0) / total) * 100;
            return (
              <span key={seg.label || seg.name} className="inline-flex items-center gap-1.5 text-[12px] text-gray-600">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: seg.color }} />
                <span className="font-medium text-gray-800">{seg.label || seg.name}</span>
                <span className="text-gray-400">({pct.toFixed(1)}%)</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
