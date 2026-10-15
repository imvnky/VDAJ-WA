/**
 * VDAJ Services — WorkspaceSwitcher
 * ────────────────────────────────────────────────────────────
 * Allows the Platform Owner (Super Admin) to toggle between
 * the Platform Governance Console and individual Client Workspaces
 * (such as VDAJ Services LLP).
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import useAuthStore from '../../store/authStore';
import { superAdminApi, authApi } from '../../lib/api';
import { showSuccess, showError } from '../atoms/Toast/Toast.jsx';

export default function WorkspaceSwitcher() {
  const {
    user,
    tenant,
    isImpersonating,
    impersonatedTenant,
    startImpersonation,
    endImpersonation,
    setAuth,
  } = useAuthStore();

  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [tenants, setTenants] = useState([]);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [switching, setSwitching] = useState(false);
  const dropdownRef = useRef(null);

  const isSuperAdmin = user?.role === 'super_admin' || isImpersonating;

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch tenants list for Super Admin
  useEffect(() => {
    if (isSuperAdmin && open && tenants.length === 0) {
      setLoadingTenants(true);
      superAdminApi.listTenants({ silent: true })
        .then((res) => {
          const list = Array.isArray(res.data) ? res.data : (res.data?.tenants || []);
          setTenants(list);
        })
        .catch(() => {})
        .finally(() => setLoadingTenants(false));
    }
  }, [isSuperAdmin, open, tenants.length]);

  // Switch to a client workspace
  const handleSelectTenant = async (targetTenant) => {
    if (switching) return;
    setSwitching(true);
    setOpen(false);

    try {
      await superAdminApi.impersonate(targetTenant.id);
      const meRes = await authApi.me({ silent: true });
      setAuth(meRes.data?.user, meRes.data?.tenant || targetTenant);
      startImpersonation({ id: targetTenant.id, name: targetTenant.name, slug: targetTenant.slug });
      showSuccess(`Entered ${targetTenant.name} workspace.`);
      navigate('/dashboard');
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to switch workspace.');
    } finally {
      setSwitching(false);
    }
  };

  // Exit back to Platform Console
  const handleExitToPlatform = async () => {
    if (switching) return;
    setSwitching(true);
    setOpen(false);

    try {
      await superAdminApi.exitImpersonation();
      const meRes = await authApi.me({ silent: true });
      setAuth(meRes.data?.user, meRes.data?.tenant || null);
      endImpersonation();
      showSuccess('Switched to Platform Control Plane.');
      navigate('/admin/tenants');
    } catch {
      window.location.href = '/admin/tenants';
    } finally {
      setSwitching(false);
    }
  };

  // Regular tenant user view (Non-super admin)
  if (!isSuperAdmin) {
    return (
      <div className="flex items-center gap-2 h-9 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700">
        <span>🏢</span>
        <span className="truncate max-w-[160px]">{tenant?.name || 'Workspace'}</span>
      </div>
    );
  }

  // Super Admin view
  const currentTitle = isImpersonating
    ? (impersonatedTenant?.name || tenant?.name || 'Client Workspace')
    : 'Platform Console';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={switching}
        className={clsx(
          'flex items-center gap-2 h-9 px-3 rounded-xl text-xs font-bold transition-all border',
          isImpersonating
            ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100 shadow-sm'
            : 'bg-[#F3F2FD] border-[#E6E4F5] text-[#534AB7] hover:bg-[#E8E6FA]'
        )}
      >
        <span className="text-sm">
          {isImpersonating ? '🏢' : '👑'}
        </span>
        <div className="text-left flex flex-col justify-center leading-tight">
          <span className="truncate max-w-[140px] sm:max-w-[180px]">
            {currentTitle}
          </span>
          <span className="text-[9px] font-semibold uppercase opacity-60">
            {isImpersonating ? 'Client Workspace' : 'Global Admin'}
          </span>
        </div>
        <span className="text-[10px] opacity-50 ml-0.5">▼</span>
      </button>

      {/* Dropdown Menu */}
      {open && (
        <div className="absolute left-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-scale-in">
          {/* Header */}
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-slate-500">
              Workspace Switcher
            </span>
            <span className="text-2xs font-bold text-slate-400">
              Super Admin
            </span>
          </div>

          <div className="p-2 space-y-1 max-h-80 overflow-y-auto">
            {/* Control Plane Option */}
            <button
              type="button"
              onClick={handleExitToPlatform}
              className={clsx(
                'w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs transition-colors',
                !isImpersonating
                  ? 'bg-[#F3F2FD] text-[#534AB7] font-bold'
                  : 'hover:bg-slate-100 text-slate-700'
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-7 h-7 rounded-lg bg-[#534AB7]/10 text-[#534AB7] flex items-center justify-center text-sm shrink-0">
                  👑
                </span>
                <div className="min-w-0">
                  <p className="font-bold truncate">Platform Console</p>
                  <p className="text-2xs text-slate-400 truncate">Global SaaS Governance</p>
                </div>
              </div>
              {!isImpersonating && (
                <span className="text-[#534AB7] text-xs font-bold">✓</span>
              )}
            </button>

            <div className="px-3 pt-2 pb-1">
              <p className="text-2xs font-bold uppercase tracking-wider text-slate-400">
                Client Workspaces
              </p>
            </div>

            {loadingTenants ? (
              <div className="py-4 text-center text-xs text-slate-400 animate-pulse">
                Loading client workspaces...
              </div>
            ) : tenants.length === 0 ? (
              <div className="py-3 px-3 text-2xs text-slate-400">
                No client workspaces found.
              </div>
            ) : (
              tenants.map((t) => {
                const isActive = isImpersonating && (impersonatedTenant?.id === t.id || tenant?.id === t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleSelectTenant(t)}
                    className={clsx(
                      'w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs transition-colors',
                      isActive
                        ? 'bg-amber-50 text-amber-900 font-bold border border-amber-200'
                        : 'hover:bg-slate-100 text-slate-700'
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center text-sm shrink-0">
                        🏢
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold truncate">{t.name}</p>
                        <p className="text-2xs text-slate-400 truncate">
                          {t.plan || 'starter'} · {t.phone_number || t.slug}
                        </p>
                      </div>
                    </div>
                    {isActive && (
                      <span className="text-amber-600 text-xs font-bold">✓</span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer Action */}
          <div className="p-2 border-t border-slate-100 bg-slate-50">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                if (isImpersonating) {
                  handleExitToPlatform();
                } else {
                  navigate('/admin/tenants');
                }
              }}
              className="w-full h-8 flex items-center justify-center gap-1.5 rounded-lg text-2xs font-bold text-[#534AB7] hover:bg-[#F3F2FD] transition-colors"
            >
              <span>⚙️</span> Manage All Clients
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
