import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Same-origin "/api" by default (Vite proxies it in dev; Express serves both in production).
// Set VITE_API_URL at build time if the API lives on another domain.
const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  withCredentials: true,
});

/** Turns an axios error into a sentence the user can act on. */
export function errorMessage(err) {
  if (err?.response?.data?.error) return err.response.data.error;
  if (err?.response) return `The server responded with ${err.response.status}.`;
  if (err?.code === 'ECONNABORTED') return 'The server took too long to respond.';
  return 'Could not reach the server. Check your connection and try again.';
}

/** Builds the full URL that starts the Google OAuth 2.0 redirect flow. */
export function googleLoginUrl(returnTo = '/') {
  const base = API_BASE.replace(/\/+$/, '');
  const params = new URLSearchParams({ returnTo });
  return `${base}/auth/google?${params.toString()}`;
}

export const Api = {
  authMe: () => api.get('/auth/me').then((r) => r.data),
  logout: () => api.post('/auth/logout').then((r) => r.data),

  menu: ({ availableOnly = false } = {}) =>
    api.get('/menu', { params: availableOnly ? { available: true } : {} }).then((r) => r.data),
  saveMenuItem: (id, item) =>
    (id ? api.put(`/menu/${id}`, item) : api.post('/menu', item)).then((r) => r.data),
  createSeasonalItem: (item) => api.post('/menu/seasonal', item).then((r) => r.data),

  inventory: () => api.get('/inventory').then((r) => r.data),
  saveIngredient: (id, item) =>
    (id ? api.put(`/inventory/${id}`, item) : api.post('/inventory', item)).then((r) => r.data),

  employees: () => api.get('/employees').then((r) => r.data),
  saveEmployee: (id, emp) =>
    (id ? api.put(`/employees/${id}`, emp) : api.post('/employees', emp)).then((r) => r.data),

  orders: (limit = 100) => api.get('/orders', { params: { limit } }).then((r) => r.data),
  orderItems: (id) => api.get(`/orders/${id}/items`).then((r) => r.data),
  discounts: () => api.get('/orders/discounts').then((r) => r.data),
  createDiscount: (discount) => api.post('/orders/discounts', discount).then((r) => r.data),
  checkDiscount: (code) => api.get(`/orders/discounts/${encodeURIComponent(code)}`).then((r) => r.data),
  discounts: () => api.get('/orders/discounts').then((r) => r.data),
  createDiscount: (discount) => api.post('/orders/discounts', discount).then((r) => r.data),
  createOrder: (order) => api.post('/orders', order).then((r) => r.data),

  reportList: () => api.get('/reports').then((r) => r.data),
  report: (key, from, to) => api.get(`/reports/${key}`, { params: { from, to } }).then((r) => r.data),
  xReport: (date) => api.get('/reports/x-report', { params: { date } }).then((r) => r.data),
  weather: (zip) => api.get('/weather', { params: zip ? { zip } : {} }).then((r) => r.data),
  pokemon: (id) => api.get(`/pokemon/${id}`).then((r) => r.data),

  productUsage: (from, to) => api.get('/reports/product-usage', { params: { from, to } }).then((r) => r.data),
};
