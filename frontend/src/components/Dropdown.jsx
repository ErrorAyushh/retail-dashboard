import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export default function Dropdown({ 
  label, 
  triggerLabel, 
  value, 
  options, 
  items, 
  onChange, 
  icon: Icon, 
  width = 'w-44', 
  active 
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const opts = options || items || [];
  const displayLabel = triggerLabel || label || 'Select';

  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const selected = opts.find((o) => o.value === value);
  const isActive = active ?? (value && value !== 'all');

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center justify-between gap-1.5 h-8 px-2.5 rounded-lg border text-xs font-medium transition-all ${
          isActive
            ? 'border-sky-300 bg-sky-50/70 text-sky-800'
            : 'border-slate-200/90 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
        }`}
      >
        <span className="flex items-center gap-1.5 truncate">
          {Icon && <Icon size={13} className={isActive ? 'text-sky-600' : 'text-slate-400'} />}
          <span className="truncate">{selected ? selected.label : displayLabel}</span>
        </span>
        <ChevronDown size={13} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className={`absolute left-0 mt-1 ${width} bg-white rounded-xl border border-slate-200 shadow-xl py-1 z-50 animate-fade-in max-h-72 overflow-y-auto`}
        >
          {opts.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                if (onChange) onChange(opt.value);
                setOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-slate-50 transition-colors ${
                opt.value === value ? 'text-sky-700 font-bold bg-sky-50/50' : 'text-slate-700'
              }`}
            >
              <span className="truncate">{opt.label}</span>
              {opt.value === value && <Check size={13} className="text-sky-600 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
