import { useState, useEffect } from 'react';
import { X, Layers, Package, Footprints } from 'lucide-react';
import { api } from '../api/client';
import { formatCurrency, formatNumber } from '../utils/format';

export default function ProductSizeMatrixModal({ productName, filters, isOpen, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && productName) {
      setLoading(true);
      api.getProductSizeMatrix(productName, filters)
        .then((res) => {
          setData(res);
          setLoading(false);
        })
        .catch((err) => {
          console.error('Failed to load size matrix:', err);
          setLoading(false);
        });
    }
  }, [isOpen, productName, filters]);

  if (!isOpen) return null;

  const sizes = data?.sizes || [];
  const matrix = data?.matrix || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in" onClick={onClose}>
      <div 
        className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden" 
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70">
          <div>
            <div className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5">
              <Footprints size={14} /> Color × Size Heat Matrix
            </div>
            <h3 className="text-lg font-bold text-slate-900 mt-0.5">{productName}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <div className="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">Computing color x size distribution...</span>
            </div>
          ) : matrix.length > 0 ? (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-center border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 text-[11px]">
                    <th className="px-4 py-2.5 text-left border-r border-slate-200 min-w-[130px]">Colorway</th>
                    {sizes.map(s => (
                      <th key={s} className="px-3 py-2.5 border-r border-slate-100 min-w-[55px]">
                        UK {s}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {matrix.map(row => (
                    <tr key={row.color} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-left font-semibold text-slate-800 border-r border-slate-200 bg-slate-50/40">
                        {row.color}
                      </td>
                      {sizes.map(s => {
                        const cell = row.sizes[s] || { units: 0, net_sales: 0 };
                        const hasSales = cell.units > 0;
                        const isHigh = cell.units >= 15;
                        return (
                          <td 
                            key={s} 
                            className={`p-2 border-r border-slate-100 font-mono text-[11px] ${
                              isHigh
                                ? 'bg-emerald-100/70 text-emerald-900 font-bold'
                                : hasSales
                                ? 'bg-indigo-50/50 text-indigo-950 font-medium'
                                : 'text-slate-300'
                            }`}
                          >
                            <div>{cell.units}</div>
                            {hasSales && (
                              <div className="text-[9.5px] text-slate-400 font-sans">{formatCurrency(cell.net_sales, { compact: true })}</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-slate-400">
              No size breakdown available for this product in the selected window.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
