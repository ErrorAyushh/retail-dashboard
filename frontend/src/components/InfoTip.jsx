import { Info } from 'lucide-react';
import { useState } from 'react';
import { glossary } from '../utils/metricGlossary';

export default function InfoTip({ term, text }) {
  const [open, setOpen] = useState(false);
  const content = text || glossary(term);
  if (!content) return null;

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={() => setOpen((o) => !o)}
    >
      <Info size={13} className="text-gray-400 hover:text-gray-600 transition-colors cursor-help" />
      {open && (
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-64 rounded-lg bg-gray-900 text-white text-[11px] leading-snug px-3 py-2 shadow-xl animate-fade-in pointer-events-none">
          {content}
        </span>
      )}
    </span>
  );
}
