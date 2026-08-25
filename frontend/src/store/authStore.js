/**
 * VDAJ Services — Zustand Auth Store
 * Global auth state: user, tenant, role + impersonation overlay.
 */

import { create } from 'zustand';

const useAuthStore = create((set) => ({
  user:            null,
  tenant:          null,
  token:           typeof window !== 'undefined' ? sessionStorage.getItem('vdaj_token') : null,
  isAuthenticated: false,
  isLoading:       true,

  // Impersonation overlay — set when super_admin is viewing a tenant
  isImpersonating:    false,
  impersonatedTenant: null, // { id, name, slug }

  setAuth: (user, tenant, token) => {
    if (token) sessionStorage.setItem('vdaj_token', token);
    set({ user, tenant, isAuthenticated: true, isLoading: false, ...(token ? { token } : {}) });
  },

  clearAuth: () => {
    sessionStorage.removeItem('vdaj_token');
    set({
      user: null, tenant: null, token: null,
      isAuthenticated: false, isLoading: false,
      isImpersonating: false, impersonatedTenant: null,
    });
  },

  setLoading: (val) => set({ isLoading: val }),

  startImpersonation: (tenant) =>
    set({ isImpersonating: true, impersonatedTenant: tenant }),

  endImpersonation: () =>
    set({ isImpersonating: false, impersonatedTenant: null }),
}));

export default useAuthStore;

// Expose store for the API interceptor to check auth state
if (typeof window !== 'undefined') {
  window.__vdaj_auth_store = useAuthStore;
}
