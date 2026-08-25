/**
 * VDAJ Services — Axios API Client
 * Centralized HTTP client with base URL, cookie credentials, error parsing.
 */

import axios from 'axios';
import { showApiError } from '../components/atoms/Toast/Toast';

const _envBase = import.meta.env.VITE_API_BASE_URL;
const _isProd  = typeof window !== 'undefined' &&
                 !window.location.hostname.includes('localhost') &&
                 !window.location.hostname.includes('127.0.0.1');
let BASE = _envBase ||
           (_isProd ? 'https://api.vdajservices.com/api/v1' : 'http://localhost:5000/api/v1');
if (BASE && !BASE.endsWith('/api/v1')) {
  BASE = BASE.replace(/\/+$/, '') + '/api/v1';
}

const apiClient = axios.create({
  baseURL: BASE,
  withCredentials: true,        // Send HTTP-only cookies with every request
  timeout: 30000,               // 30s timeout
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ============================================================
// REQUEST INTERCEPTOR — Attach request ID for tracing
// ============================================================

apiClient.interceptors.request.use((config) => {
  config.headers['X-Request-ID'] = crypto.randomUUID();
  // Attach Bearer token when cookies are blocked (cross-origin)
  const token = sessionStorage.getItem('vdaj_token');
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ============================================================
// RESPONSE INTERCEPTOR — Handle 401 redirect + error toasts
// ============================================================

apiClient.interceptors.response.use(
  (response) => response.data,  // Unwrap data from { success, data, message }
  (error) => {
    if (error.response?.status === 401) {
      // Token expired — redirect to login (avoid loop if already on /login)
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login?session=expired';
      }
      return Promise.reject(error);
    }

    // Show toast for non-401 errors (can be suppressed per-call with { silent: true })
    if (!error.config?.silent) {
      showApiError(error);
    }

    return Promise.reject(error);
  }
);

export default apiClient;
