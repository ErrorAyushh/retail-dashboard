import { useEffect, useMemo, useRef, useState } from 'react';
import { 
  ArrowUp, 
  ArrowDown, 
  ArrowUpDown, 
  Search, 
  Download, 
  ChevronLeft, 
  ChevronRight,
  SlidersHorizontal,
  Eye,
  Rows
} from 'lucide-react';
import EmptyState from '../components/EmptyState';
import { downloadCSV } from '../utils/csv';

export default function DataTable({
  columns = [],
  data = [],
  pageSize = 50,
  searchable = true,
  searchPlaceholder = 'Search table...',
  searchFn,
  csvFilename = 'retail_report.csv',
  rowKey = (row, i) => row.id ?? row.store_name ?? row.product_code ?? i,
  defaultSort,
  stickyFirst = true,
  emptyMessage = 'No matching rows found.',
  title,
  toolbarExtra,
  itemLabel,
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState(defaultSort || { key: columns[0]?.key, dir: 'desc' });
  const [page, setPage] = useState(1);
  const [hiddenCols, setHiddenCols] = useState([]);
  const [colChooserOpen, setColChooserOpen] = useState(false);
  const colChooserRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (colChooserRef.current && !colChooserRef.current.contains(e.target)) {
        setColChooserOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // Active visible columns
  const visibleColumns = useMemo(() => {
    return columns.filter(c => !hiddenCols.includes(c.key));
  }, [columns, hiddenCols]);

  const toggleColumn = (key) => {
    setHiddenCols(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // Filter rows based on search
  const filtered = useMemo(() => {
    if (!query.trim()) return data;
    const q = query.trim().toLowerCase();
    if (searchFn) return data.filter((row) => searchFn(row, q));
    return data.filter((row) =>
      columns.some((c) => {
        const val = c.accessor ? c.accessor(row) : row[c.key];
        return String(val ?? '').toLowerCase().includes(q);
      })
    );
  }, [data, query, columns, searchFn]);

  // Sort rows
  const sorted = useMemo(() => {
    if (!sort?.key) return filtered;
    const col = (columns || []).find((c) => c.key === sort.key);
    if (!col) return filtered;
    const getVal = col.sortAccessor || col.accessor || ((r) => r[col.key]);

    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = getVal(a);
      const bv = getVal(b);
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (typeof av === 'string' && typeof bv === 'string') {
        return sort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sort.dir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
    return copy;
  }, [filtered, sort, columns]);

  // Paginate
  const totalPages = Math.ceil(sorted.length / pageSize) || 1;
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  const handleSort = (key) => {
    setSort((prev) => {
      if (prev?.key === key) {
        return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
      }
      return { key, dir: 'desc' };
    });
  };

  const handleExportCSV = () => {
    downloadCSV(csvFilename, visibleColumns, sorted);
  };

  const pyClass = 'py-2.5';
  const textClass = 'text-[12px]';

  return (
    <div className="card overflow-hidden bg-white border border-slate-200">
      {/* Table Toolbar */}
      <div className="p-3.5 md:p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white">
        <div className="flex items-center gap-3">
          {title && <h3 className="text-sm font-bold text-slate-900">{title}</h3>}
          <span className="text-xs text-slate-400 font-medium bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
            {sorted.length} {
              itemLabel
                ? (sorted.length === 1 ? itemLabel : `${itemLabel}s`)
                : (title?.toLowerCase().includes('product')
                  ? (sorted.length === 1 ? 'product' : 'products')
                  : title?.toLowerCase().includes('customer')
                  ? (sorted.length === 1 ? 'customer' : 'customers')
                  : (title?.toLowerCase().includes('staff') || title?.toLowerCase().includes('associate'))
                  ? (sorted.length === 1 ? 'associate' : 'associates')
                  : (sorted.length === 1 ? 'store' : 'stores'))
            }
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {toolbarExtra}

          {searchable && (
            <div className="flex items-center gap-1.5 h-8 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-48 sm:w-56 focus-within:border-indigo-600 focus-within:bg-white transition-all">
              <Search size={13} className="text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent w-full outline-none text-slate-800"
              />
            </div>
          )}

          {/* Column Chooser Dropdown */}
          <div className="relative" ref={colChooserRef}>
            <button
              onClick={() => setColChooserOpen(!colChooserOpen)}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              title="Choose visible columns"
            >
              <Eye size={13} className="text-slate-400" />
              <span className="hidden sm:inline">Columns</span>
            </button>

            {colChooserOpen && (
              <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-200 p-2 z-40 text-xs divide-y divide-slate-100">
                <div className="px-2 py-1 font-bold text-slate-400 text-[10.5px] uppercase tracking-wider">
                  Toggle Columns
                </div>
                <div className="py-1 max-h-48 overflow-y-auto space-y-0.5">
                  {columns.map(col => (
                    <label key={col.key} className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!hiddenCols.includes(col.key)}
                        onChange={() => toggleColumn(col.key)}
                        className="rounded text-indigo-600"
                      />
                      <span className="truncate text-slate-700">{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            title="Download CSV of current table data"
          >
            <Download size={13} className="text-slate-500" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* Table Container with Horizontal Scroll & Sticky First Column */}
      <div className="overflow-x-auto relative">
        {paginated.length > 0 ? (
          <table className={`min-w-full text-left border-separate border-spacing-0 ${textClass}`}>
            <thead>
              <tr className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {visibleColumns.map((col, idx) => {
                  const isSorted = sort?.key === col.key;
                  const isFirst = idx === 0 && stickyFirst;
                  return (
                    <th
                      key={col.key}
                      onClick={() => col.sortable !== false && handleSort(col.key)}
                      className={`py-2.5 px-3.5 whitespace-nowrap select-none border-b border-slate-200 ${
                        col.sortable !== false ? 'cursor-pointer hover:bg-slate-100 transition-colors' : ''
                      } ${col.align === 'right' ? 'text-right' : 'text-left'} ${
                        isFirst ? 'sticky-col bg-slate-50 border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]' : ''
                      }`}
                      style={{ width: col.width, minWidth: col.width }}
                    >
                      <div className={`inline-flex items-center gap-1 ${col.align === 'right' ? 'justify-end w-full' : ''}`}>
                        <span>{col.label}</span>
                        {col.sortable !== false && (
                          <span className="text-slate-400">
                            {isSorted ? (
                              sort.dir === 'asc' ? <ArrowUp size={12} className="text-indigo-600 font-bold" /> : <ArrowDown size={12} className="text-indigo-600 font-bold" />
                            ) : (
                              <ArrowUpDown size={11} className="opacity-40" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {paginated.map((row, rowIdx) => {
                const globalIdx = (page - 1) * pageSize + rowIdx;
                return (
                  <tr key={rowKey(row, rowIdx)} className="hover:bg-indigo-50/30 transition-colors group">
                    {visibleColumns.map((col, colIdx) => {
                      const isFirst = colIdx === 0 && stickyFirst;
                      const val = col.accessor ? col.accessor(row) : row[col.key];
                      const rendered = col.render
                        ? (col.render.length >= 3
                            ? col.render(val, row, globalIdx)
                            : col.render(row, globalIdx, globalIdx))
                        : (val ?? row[col.key]);
                      return (
                        <td
                          key={col.key}
                          className={`${pyClass} px-3.5 whitespace-nowrap text-slate-700 border-b border-slate-100 ${
                            col.align === 'right' ? 'text-right tabular-nums' : 'text-left'
                          } ${isFirst ? 'sticky-col bg-white group-hover:bg-slate-50 border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] font-semibold text-slate-900' : ''}`}
                          style={{ width: col.width, minWidth: col.width }}
                        >
                          {rendered}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="py-16 text-center text-xs text-slate-400">
            {emptyMessage}
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="p-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
          <div>
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, sorted.length)} of {sorted.length}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1 rounded border border-slate-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="px-2 font-medium">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1 rounded border border-slate-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
