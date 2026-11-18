const API_BASE = '/api';

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
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const errorText = await res.text().catch(() => res.statusText);
    throw new Error(`API Error [${res.status}]: ${errorText}`);
  }
  return res.json();
}

export const api = {
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
