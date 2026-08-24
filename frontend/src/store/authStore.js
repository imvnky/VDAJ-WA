/**
 * VDAJ Services — Zustand Auth Store
 * Global auth state: user, tenant, role + impersonation overlay.
 */

import { create } from 'zustand';

const useAuthStore = create((set) => ({
  user:            null,
  tenant:          null,
  isAuthenticated: false,
  isLoading:       true,

  // Impersonation overlay — set when super_admin is viewing a tenant
  isImpersonating:    false,
  impersonatedTenant: null, // { id, name, slug }

  setAuth: (user, tenant) =>
    set({ user, tenant, isAuthenticated: true, isLoading: false }),

  clearAuth: () =>
    set({
      user: null, tenant: null,
      isAuthenticated: false, isLoading: false,
      isImpersonating: false, impersonatedTenant: null,
    }),

  setLoading: (val) => set({ isLoading: val }),

  startImpersonation: (tenant) =>
    set({ isImpersonating: true, impersonatedTenant: tenant }),

  endImpersonation: () =>
    set({ isImpersonating: false, impersonatedTenant: null }),
}));

export default useAuthStore;
