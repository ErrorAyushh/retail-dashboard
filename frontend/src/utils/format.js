// Indian numbering system formatting helpers (shared with Pulse & elevated for Kadam)

export function formatIndianNumber(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const num = Math.round(value);
  const isNeg = num < 0;
  const s = Math.abs(num).toString();
  if (s.length <= 3) return (isNeg ? '-' : '') + s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return (isNeg ? '-' : '') + grouped + ',' + last3;
}

// ₹24.8L / ₹2.4Cr / ₹84.6K / ₹1,986
export function formatCurrency(value, opts = {}) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const { compact = true, decimals } = opts;
  const isNeg = value < 0;
  const abs = Math.abs(value);
  let out;
  if (compact && abs >= 1e7) {
    out = '₹' + trimZero(abs / 1e7, decimals ?? 2) + ' Cr';
  } else if (compact && abs >= 1e5) {
    out = '₹' + trimZero(abs / 1e5, decimals ?? 1) + ' L';
  } else if (compact && abs >= 1e3) {
    out = '₹' + trimZero(abs / 1e3, decimals ?? 1) + ' K';
  } else {
    out = '₹' + formatIndianNumber(abs);
  }
  return (isNeg ? '-' : '') + out;
}

export const formatINR = formatCurrency;

export function formatCurrencyFull(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const isNeg = value < 0;
  return (isNeg ? '-' : '') + '₹' + formatIndianNumber(Math.abs(value));
}

function trimZero(n, decimals) {
  const fixed = n.toFixed(decimals);
  return fixed.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

export function formatNumber(value, opts = {}) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const { compact = false, decimals = 0 } = opts;
  const isNeg = value < 0;
  const abs = Math.abs(value);
  let out;
  if (compact && abs >= 1e7) out = trimZero(abs / 1e7, 2) + ' Cr';
  else if (compact && abs >= 1e5) out = trimZero(abs / 1e5, 1) + ' L';
  else if (compact && abs >= 1e3) out = trimZero(abs / 1e3, 1) + ' K';
  else out = formatIndianNumber(decimals ? Number(abs.toFixed(decimals)) : abs);
  return (isNeg ? '-' : '') + out;
}

// Always strictly format units as integers (e.g. 35 units, never 35.0)
export function formatUnits(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return formatIndianNumber(Math.round(value));
}

export function formatPercent(value, opts = {}) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const { decimals = 1, showPlus = false } = opts;
  const prefix = showPlus && value > 0 ? '+' : '';
  return prefix + value.toFixed(decimals) + '%';
}

// Format delta with neutral grey dash on zero (no down arrow on 0.0pp)
export function formatDelta(current, previous, kind = 'percent', invert = false) {
  if (current === undefined || current === null || previous === undefined || previous === null) {
    return { label: '—', tone: 'neutral', hasArrow: false, rawDiff: 0 };
  }

  if (kind === 'pp') {
    const diff = current - previous;
    if (Math.abs(diff) < 0.05) {
      return { label: '—', tone: 'neutral', hasArrow: false, rawDiff: 0 };
    }
    const isUp = diff > 0;
    let tone = isUp ? 'pos' : 'neg';
    if (invert) tone = isUp ? 'neg' : 'pos';
    return {
      label: `${isUp ? '↑' : '↓'} ${Math.abs(diff).toFixed(1)}pp`,
      tone,
      hasArrow: true,
      rawDiff: diff
    };
  }

  // percentage change
  if (previous === 0) {
    return { label: '—', tone: 'neutral', hasArrow: false, rawDiff: 0 };
  }
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  if (Math.abs(pct) < 0.05) {
    return { label: '—', tone: 'neutral', hasArrow: false, rawDiff: 0 };
  }
  const isUp = pct > 0;
  let tone = isUp ? 'pos' : 'neg';
  if (invert) tone = isUp ? 'neg' : 'pos';
  return {
    label: `${isUp ? '↑' : '↓'} ${Math.abs(pct).toFixed(1)}%`,
    tone,
    hasArrow: true,
    rawDiff: pct
  };
}

import storeGeo from '../config/store_geo.json';

const STORE_ACRONYMS = {
  'VR': 'VR',
  'HSR': 'HSR',
  'SCCM': 'SCCM',
  'DB': 'DB',
  'CG': 'CG',
  'LA': 'LA',
  'ASRAO': 'ASRao',
};

// Explicit overrides for names the rule cannot fix
const STORE_NAME_OVERRIDES = {
  'vr surat': 'VR Surat',
  'vr_surat': 'VR Surat',
  'hilite calicut': 'HiLite Calicut',
  'hilite_calicut': 'HiLite Calicut',
  'lakeshore-hyderabad': 'Lakeshore Hyderabad',
  'lakeshore_hyderabad': 'Lakeshore Hyderabad',
  'lakeshore hyderabad': 'Lakeshore Hyderabad',
  'la_city center_bareily': 'LA City Center Bareilly',
  'la city center bareily': 'LA City Center Bareilly',
  'punjagutta_hyd': 'Punjagutta Hyderabad',
  'punjagutta hyd': 'Punjagutta Hyderabad',
};

// Store name formatter: strip 'F_', replace '_' and '-' with spaces, title case, keep acronyms in capitals
export function formatStoreName(rawName) {
  if (!rawName) return '—';
  const rawStr = String(rawName).trim();
  const lower = rawStr.toLowerCase();

  // 1. Check explicit overrides first
  if (STORE_NAME_OVERRIDES[lower]) {
    return STORE_NAME_OVERRIDES[lower];
  }

  // 2. Check store_geo.json display_name if set
  if (storeGeo && storeGeo[rawStr] && storeGeo[rawStr].display_name) {
    const geoDisp = storeGeo[rawStr].display_name;
    if (STORE_NAME_OVERRIDES[geoDisp.toLowerCase()]) {
      return STORE_NAME_OVERRIDES[geoDisp.toLowerCase()];
    }
  }

  // 3. Rule: Strip 'F_' or 'f_'
  let clean = rawStr;
  if (clean.startsWith('F_') || clean.startsWith('f_')) {
    clean = clean.slice(2);
  }

  // 4. Replace '_' and '-' with spaces
  clean = clean.replace(/[_\-]+/g, ' ');

  // 5. Title-case words, keep acronyms in capitals
  clean = clean
    .split(' ')
    .filter(Boolean)
    .map((w) => {
      const upper = w.toUpperCase();
      if (STORE_ACRONYMS[upper]) {
        return STORE_ACRONYMS[upper];
      }
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');

  return clean;
}

export function isFranchiseStore(rawName) {
  if (!rawName) return false;
  return rawName.startsWith('F_');
}

export function formatDate(dateStr, opts = {}) {
  if (!dateStr) return '—';
  const parts = String(dateStr).split('T')[0].split('-');
  let d;
  if (parts.length === 3) {
    d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  } else {
    d = new Date(dateStr);
  }
  const formatOptions = { day: 'numeric', month: 'short', ...opts };
  return d.toLocaleDateString('en-IN', formatOptions);
}

export function formatHour(hour) {
  if (hour === null || hour === undefined) return '—';
  const h = Number(hour);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12} ${ampm}`;
}

export function toCSVValue(v) {
  if (v === null || v === undefined) return '""';
  const s = String(v).replace(/"/g, '""');
  return `"${s}"`;
}
