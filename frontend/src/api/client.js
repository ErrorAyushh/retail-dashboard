const API_BASE = '/api';

export function getStoredToken() {
  try {
    return localStorage.getItem('kadam_token');
  } catch {
    return null;
  }
}

export function setStoredToken(token) {
  try {
    if (token) {
      localStorage.setItem('kadam_token', token);
    } else {
      localStorage.removeItem('kadam_token');
    }
  } catch (e) {
    console.error('Failed to update stored token:', e);
  }
}

function buildQueryString(params = {}) {
  const query = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val === undefined || val === null || val === '') continue;
    if (Array.isArray(val)) {
      val.forEach((v) => {
        if (v !== undefined && v !== null && v !== '') query.append(key, v);
      });
    } else {
      query.append(key, String(val));
    }
  }
  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

async function request(endpoint, params = {}, options = {}) {
  const qs = buildQueryString(params);
  const url = `${API_BASE}${endpoint}${qs}`;
  const token = getStoredToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const res = await fetch(url, { ...options, headers });
  if (res.status === 401 && endpoint !== '/auth/google') {
    // Missing or invalid session -> clear token and redirect to login
    setStoredToken(null);
    try {
      localStorage.removeItem('kadam_user');
    } catch {}
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }
  if (!res.ok) {
    const errorText = await res.text().catch(() => res.statusText);
    throw new Error(`API Error [${res.status}]: ${errorText}`);
  }
  return res.json();
}

export const api = {
  // Auth
  loginWithGoogle: (credential) =>
    request('/auth/google', {}, {
      method: 'POST',
      body: JSON.stringify({ credential }),
    }),
  getMe: () => request('/auth/me'),

  // Data routes
  getFiltersMeta: () => request('/filters/meta'),
  getMetricsRegistry: () => request('/metrics/registry'),
  getOverview: (filters) => request('/overview', filters),
  getMetricDrilldown: (metric, filters) => request('/overview/drilldown', { ...filters, metric }),
  getStores: (filters) => request('/stores', filters),
  getStoreHeatmap: (filters) => request('/stores/heatmap', filters),
  getStoreDetail: (storeName, filters) => request(`/stores/${encodeURIComponent(storeName)}`, filters),
  getGeography: (filters, matureOnly = false) => request('/geography', { ...filters, mature_only: matureOnly }),
  getGeographyTopProducts: (filters, options = {}) =>
    request('/geography/products', { ...filters, ...options }),
  getProducts: (filters, groupBy = 'product') => request('/products', { ...filters, group_by: groupBy }),
  getProductHeatmap: (filters, groupBy = 'product') => request('/products/heatmap', { ...filters, group_by: groupBy }),
  getProductSizeMatrix: (productName, filters) => request('/products/size-matrix', { ...filters, product_name: productName }),
  getDiscounts: (filters) => request('/discounts', filters),
  getReturns: (filters) => request('/returns', filters),
  getStaff: (filters, minBills) =>
    request('/staff', { ...filters, ...(minBills !== undefined ? { min_bills: minBills } : {}) }),
  getCustomers: (filters, canViewPII = true) =>
    request('/customers', filters, {
      headers: { 'X-Can-View-PII': 'true' }
    }),
  getHealth: () => request('/health'),
};
