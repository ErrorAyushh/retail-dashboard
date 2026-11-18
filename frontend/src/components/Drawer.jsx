import { X } from 'lucide-react';
import { useEffect } from 'react';

export default function Drawer({ open, onClose, title, children, width = 'max-w-xl' }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xs animate-fade-in" onClick={onClose} />
      <div className={`relative w-full ${width} h-full bg-white shadow-2xl flex flex-col animate-fade-in z-10`}>
        <div className="flex items-center justify-between px-5 h-14 border-b border-[var(--color-border)] shrink-0">
          <h2 className="text-[15px] font-semibold text-gray-900 truncate">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">{children}</div>
      </div>
    </div>
  );
}
