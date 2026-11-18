import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';

const FilterContext = createContext(null);

export const DATE_PRESETS = [
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: '7 Days' },
  { value: 'mtd', label: 'MTD' },
  { value: 'custom', label: 'Custom' },
];

export const STORE_TYPE_OPTIONS = [
  { value: 'Own store', label: 'Own stores' },
  { value: 'Franchise', label: 'Franchise' },
  { value: 'All', label: 'All stores' },
];

function calcDateRange(preset, minDate, maxDate) {
  // Completed days dynamically anchored to maxDate (T-1)
  const effectiveMax = maxDate || '2026-11-16';
  const effectiveMin = minDate || '2026-10-13';
  const maxDt = new Date(effectiveMax);

  if (preset === 'yesterday') {
    return { start: effectiveMax, end: effectiveMax };
  } else if (preset === 'last7' || preset === '7d') {
    const s = new Date(maxDt);
    s.setDate(s.getDate() - 6);
    return { start: s.toISOString().slice(0, 10), end: effectiveMax };
  } else if (preset === 'last14' || preset === '14d') {
    const s = new Date(maxDt);
    s.setDate(s.getDate() - 13);
    return { start: s.toISOString().slice(0, 10), end: effectiveMax };
  } else if (preset === 'last30' || preset === '30d') {
    const s = new Date(maxDt);
    s.setDate(s.getDate() - 29);
    return { start: s.toISOString().slice(0, 10), end: effectiveMax };
  } else if (preset === 'mtd') {
    const year = maxDt.getFullYear();
    const month = String(maxDt.getMonth() + 1).padStart(2, '0');
    return { start: `${year}-${month}-01`, end: effectiveMax };
  } else if (preset === 'all') {
    return { start: effectiveMin, end: effectiveMax };
  }
  const s = new Date(maxDt);
  s.setDate(s.getDate() - 6);
  return { start: s.toISOString().slice(0, 10), end: effectiveMax };
}

export function FilterProvider({ children }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [meta, setMeta] = useState({
    min_date: '2026-10-13',
    max_date: '2026-11-16',
    max_pulled_at: '',
    regions: [],
    stores: [],
    genders: [],
    departments: [],
    default_store_type: 'All'
  });
  const [loadingMeta, setLoadingMeta] = useState(true);

  // Initialize filters from URL query parameters (defaults: yesterday & All stores)
  const datePreset = searchParams.get('preset') || 'yesterday';
  const storeType = searchParams.get('store_type') || 'All';
  const paramStart = searchParams.get('start_date');
  const paramEnd = searchParams.get('end_date');
  const productSearch = searchParams.get('product') || '';
  const regionsParam = searchParams.getAll('region');
  const storesParam = searchParams.getAll('store');
  const gendersParam = searchParams.getAll('gender');
  const deptsParam = searchParams.getAll('dept');

  useEffect(() => {
    let mounted = true;
    api.getFiltersMeta()
      .then((data) => {
        if (mounted) {
          setMeta(data);
          setLoadingMeta(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load filter metadata:', err);
        if (mounted) setLoadingMeta(false);
      });
    return () => { mounted = false; };
  }, []);

  // Sanitize URL params if someone arrives with an out-of-bounds date beyond available max_date
  useEffect(() => {
    if (meta.max_date && ((paramStart && paramStart > meta.max_date) || (paramEnd && paramEnd > meta.max_date))) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (paramStart && paramStart > meta.max_date) {
          next.set('start_date', meta.max_date);
        }
        if (paramEnd && paramEnd > meta.max_date) {
          next.set('end_date', meta.max_date);
        }
        return next;
      }, { replace: true });
    }
  }, [paramStart, paramEnd, meta.max_date, setSearchParams]);

  // Compute effective dates
  const { start: computedStart, end: computedEnd } = useMemo(() => {
    if (datePreset === 'custom' && paramStart && paramEnd) {
      const minBound = meta.min_date || '2026-10-13';
      const maxBound = meta.max_date || '';
      let clampedStart = paramStart < minBound ? minBound : paramStart;
      if (maxBound && clampedStart > maxBound) clampedStart = maxBound;
      let clampedEnd = paramEnd < minBound ? minBound : paramEnd;
      if (maxBound && clampedEnd > maxBound) clampedEnd = maxBound;
      return { start: clampedStart, end: clampedEnd < clampedStart ? clampedStart : clampedEnd };
    }
    return calcDateRange(datePreset, meta.min_date, meta.max_date);
  }, [datePreset, paramStart, paramEnd, meta.min_date, meta.max_date]);

  const setFilter = useCallback((key, value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
        next.delete(key);
      } else if (Array.isArray(value)) {
        next.delete(key);
        value.forEach((v) => next.append(key, v));
      } else {
        next.set(key, String(value));
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const setDatePreset = useCallback((preset) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('preset', preset);
      if (preset !== 'custom') {
        const { start, end } = calcDateRange(preset, meta.min_date, meta.max_date);
        next.set('start_date', start);
        next.set('end_date', end);
      }
      return next;
    }, { replace: true });
  }, [setSearchParams, meta.min_date, meta.max_date]);

  const setCustomDates = useCallback((start, end) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('preset', 'custom');
      next.set('start_date', start);
      next.set('end_date', end);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const resetFilters = useCallback(() => {
    setSearchParams({
      preset: 'yesterday',
      store_type: meta.default_store_type || 'All'
    }, { replace: true });
  }, [setSearchParams, meta.default_store_type]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (storeType && storeType !== 'All') count++;
    if (regionsParam.length > 0) count += regionsParam.length;
    if (storesParam.length > 0) count += storesParam.length;
    if (gendersParam.length > 0) count += gendersParam.length;
    if (deptsParam.length > 0) count += deptsParam.length;
    if (productSearch.trim()) count++;
    return count;
  }, [storeType, regionsParam, storesParam, gendersParam, deptsParam, productSearch]);

  const filterQueryObj = useMemo(() => {
    return {
      start_date: computedStart,
      end_date: computedEnd,
      store_type: storeType,
      regions: regionsParam.length ? regionsParam : undefined,
      stores: storesParam.length ? storesParam : undefined,
      genders: gendersParam.length ? gendersParam : undefined,
      departments: deptsParam.length ? deptsParam : undefined,
      product: productSearch || undefined,
    };
  }, [computedStart, computedEnd, storeType, regionsParam, storesParam, gendersParam, deptsParam, productSearch]);

  const dateRangeLabel = useMemo(() => {
    const s = new Date(computedStart).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const e = new Date(computedEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${s} – ${e}`;
  }, [computedStart, computedEnd]);

  return (
    <FilterContext.Provider
      value={{
        meta,
        loadingMeta,
        datePreset,
        startDate: computedStart,
        endDate: computedEnd,
        storeType,
        regions: regionsParam,
        stores: storesParam,
        genders: gendersParam,
        departments: deptsParam,
        productSearch,
        activeFilterCount,
        filterQueryObj,
        dateRangeLabel,
        setFilter,
        setDatePreset,
        setCustomDates,
        resetFilters,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters() {
  const context = useContext(FilterContext);
  if (!context) throw new Error('useFilters must be used within a FilterProvider');
  return context;
}
