/**
 * VDAJ Services — Zustand Auth Store
 * Global auth state: user, tenant, role.
 */

import { create } from 'zustand';

const useAuthStore = create((set) => ({
  user: null,
  tenant: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: (user, tenant) =>
    set({ user, tenant, isAuthenticated: true, isLoading: false }),

  clearAuth: () =>
    set({ user: null, tenant: null, isAuthenticated: false, isLoading: false }),

  setLoading: (val) => set({ isLoading: val }),
}));

export default useAuthStore;
