/**
 * VDAJ Services â€” Centralized API Layer v2
 * All API calls in one place. Every call uses HTTP-only JWT cookies.
 */

import axios from 'axios';
import { showError } from '../components/atoms/Toast/Toast.jsx';

// build: 20260825-2017
// Determine API base URL — VITE_API_BASE_URL is baked in at build time.
// Fallback chain: env var â†’ production domain â†’ localhost (dev only).
const _envBase = import.meta.env.VITE_API_BASE_URL;
const _isProd  = typeof window !== 'undefined' &&
                 !window.location.hostname.includes('localhost') &&
                 !window.location.hostname.includes('127.0.0.1');
let BASE = _envBase ||
           (_isProd ? 'https://api.vdajservices.com/api/v1' : 'http://localhost:5000/api/v1');
if (BASE && !BASE.endsWith('/api/v1')) {
  BASE = BASE.replace(/\/+$/, '') + '/api/v1';
}

// Build WS_BASE dynamically from BASE if VITE_WS_URL is not set
const getWsBase = () => {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  try {
    const apiURL = new URL(BASE);
    const protocol = apiURL.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${apiURL.host}`;
  } catch (err) {
    return 'ws://localhost:5000';
  }
};

export const WS_BASE = getWsBase();

const client = axios.create({
  baseURL: BASE,
  withCredentials: true,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

client.interceptors.request.use((cfg) => {
  cfg.headers['X-Request-ID'] = crypto.randomUUID();
  // Attach Bearer token when cookies are blocked (cross-origin)
  const token = sessionStorage.getItem('vdaj_token');
  if (token && !cfg.headers.Authorization) {
    cfg.headers.Authorization = `Bearer ${token}`;
  }
  return cfg;
});

client.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const silent = err.config?.silent;
    // On 401, redirect to login ONLY if not silent and not already on login page
    if (err.response?.status === 401 && !silent && !window.location.pathname.startsWith('/login')) {
      // Check if user was already authenticated by login flow before redirecting
      // This prevents the /auth/me revalidation race from overriding a successful login
      const authStore = typeof window !== 'undefined' && window.__vdaj_auth_store;
      if (!authStore || !authStore.getState().isAuthenticated) {
        window.location.href = '/login?session=expired';
        return Promise.reject(err);
      }
    }
    if (!silent) {
      const d = err.response?.data;
      showError(d?.message || 'An unexpected error occurred.', d?.errorCode);
    }
    return Promise.reject(err);
  }
);

// ---- AUTH ----
export const authApi = {
  login: (email, password) => client.post('/auth/login', { email, password }),
  logout: () => client.post('/auth/logout'),
  me: (config) => client.get('/auth/me', config),
  metaCallback: (code, wabaId, phoneNumberId) =>
    client.post('/auth/meta/callback', { code, wabaId, phoneNumberId }),
};

// ---- CAMPAIGNS ----
export const campaignApi = {
  list: (params, config = {}) => client.get('/campaigns', { params, ...config }),
  get: (id) => client.get(`/campaigns/${id}`),
  create: (data) => client.post('/campaigns', data),
  launch: (id) => client.post(`/campaigns/${id}/launch`),
  pause: (id) => client.patch(`/campaigns/${id}/pause`),
  delete: (id) => client.delete(`/campaigns/${id}`),
  messages: (params, config = {}) => client.get('/campaigns/messages', { params, ...config }),
};

// ---- CONTACTS ----
export const contactApi = {
  list: (params, config = {}) => client.get('/contacts', { params, ...config }),
  get: (id) => client.get(`/contacts/${id}`),
  create: (data) => client.post('/contacts', data),
  bulkImport: (contacts, listId, opt_in_source, opt_in_proof) =>
    client.post('/contacts/bulk', { contacts, listId, opt_in_source, opt_in_proof }),
  updateTags: (id, tags) => client.patch(`/contacts/${id}/tags`, { tags }),
  optOut: (id) => client.patch(`/contacts/${id}/opt-out`),
  lists: (config = {}) => client.get('/contacts/lists', config),
  createList: (data) => client.post('/contacts/lists', data),
};

// ---- TEMPLATES ----
export const templateApi = {
  list: (config = {}) => client.get('/templates', config),
  get: (id) => client.get(`/templates/${id}`),
  create: (data) => client.post('/templates', data),
  sync: (id) => client.post(`/templates/${id}/sync`),
};

// ---- TENANTS ----
export const tenantApi = {
  me: (config) => client.get('/tenants/me', config),
  wabaHealth: (config) => client.get('/tenants/me/waba-health', config),
  updateAccount: (data) => client.patch('/tenants/me', data),
  team: () => client.get('/tenants/me/team'),
  invite: (data) => client.post('/tenants/me/invite', data),
  compliance: () => client.get('/tenants/me/compliance'),
  list: () => client.get('/tenants'),
  create: (data) => client.post('/tenants', data),
  setStatus: (id, isActive) => client.patch(`/tenants/${id}/status`, { isActive }),
};

// ---- QUEUE ----
export const queueApi = {
  stats: (config = {}) => client.get('/admin/queue/stats', config),
  dlq: (config = {}) => client.get('/admin/queue/dlq', config),
  replay: (jobId) => client.post(`/admin/queue/dlq/${jobId}/replay`),
};

// ---- INBOX ----
export const inboxApi = {
  conversations: (params, config = {}) => client.get('/inbox/conversations', { params, ...config }),
  messages: (id, params) => client.get(`/inbox/conversations/${id}/messages`, { params }),
  reply: (id, body, messageType) => client.post(`/inbox/conversations/${id}/reply`, { body, messageType }),
  resolve: (id, status) => client.patch(`/inbox/conversations/${id}/resolve`, { status }),
  assign: (id, userId) => client.post(`/inbox/conversations/${id}/assign`, { userId }),
  updateStatus: (id, status) => client.patch(`/inbox/conversations/${id}/status`, { status }),
};

// ---- TEAM ----
export const teamApi = {
  list: (config = {}) => client.get('/team', config),
  invite: (data) => client.post('/team/invite', data),
  remove: (id) => client.delete(`/team/${id}`),
};

// ---- ANALYTICS ----
export const analyticsApi = {
  overview: (config = {}) => client.get('/analytics/overview', config),
  trend: (days = 30, config = {}) => client.get('/analytics/trend', { params: { days }, ...config }),
  campaigns: (config = {}) => client.get('/analytics/campaigns', config),
};

// ---- AUTOMATIONS ----
export const automationApi = {
  list: (config = {}) => client.get('/automations', config),
  create: (data) => client.post('/automations', data),
  update: (id, data) => client.put(`/automations/${id}`, data),
  delete: (id) => client.delete(`/automations/${id}`),
  getAiConfig: (config = {}) => client.get('/automations/ai-config', config),
  saveAiConfig: (data) => client.put('/automations/ai-config', data),
};

// ---- BILLING ----
export const billingApi = {
  subscription: () => client.get('/billing/subscription'),
  tiers: () => client.get('/billing/tiers'),
};

// ---- SUPER ADMIN ----
export const superAdminApi = {
  // Platform overview
  overview:       (config = {})      => client.get('/admin/overview', config),
  // Tenants
  listTenants:    (config = {})      => client.get('/admin/tenants', config),
  createTenant:   (data)             => client.post('/admin/tenants', data),
  suspendTenant:  (id, s)            => client.patch(`/admin/tenants/${id}/suspend`, { suspend: s }),
  updateStatus:   (id, status)       => client.patch(`/admin/tenants/${id}/status`, { status }),
  updateFeatures: (id, feats)        => client.patch(`/admin/tenants/${id}/features`, { features: feats }),
  // Users
  listUsers:      (config = {})      => client.get('/admin/users', config),
  createUser:     (data)             => client.post('/admin/users', data),
  resetPassword:  (id, pw)           => client.patch(`/admin/users/${id}/reset-password`, pw ? { password: pw } : {}),
  changeRole:     (id, role)         => client.patch(`/admin/users/${id}/role`, { role }),
  // Impersonation
  impersonate:    (tenantId)         => client.post(`/admin/impersonate/${tenantId}`),
  exitImpersonation: ()              => client.post('/admin/impersonate/exit'),
};


export default client;

