/**
 * VDAJ Services — ImpersonationBanner
 *
 * A persistent sticky banner rendered at the very top of the app
 * when a super_admin is impersonating a tenant. It shows the tenant
 * name and provides a one-click "Exit" button that calls the backend
 * exit endpoint and redirects back to /admin/tenants.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { superAdminApi, authApi } from '../lib/api';

export default function ImpersonationBanner() {
  const { isImpersonating, impersonatedTenant, endImpersonation, setAuth } = useAuthStore();
  const navigate  = useNavigate();
  const [exiting, setExiting] = useState(false);

  if (!isImpersonating || !impersonatedTenant) return null;

  const handleExit = async () => {
    setExiting(true);
    try {
      // Call backend to restore super_admin cookie
      await superAdminApi.exitImpersonation();

      // Re-fetch the restored super_admin session from /auth/me
      const res = await authApi.me({ silent: true });
      setAuth(res.data?.user, res.data?.tenant || null);

      // Clear impersonation state
      endImpersonation();

      // Redirect back to admin panel
      navigate('/admin/tenants', { replace: true });
    } catch {
      // If something goes wrong, force a page reload to re-sync auth state
      window.location.href = '/admin/tenants';
    } finally {
      setExiting(false);
    }
  };

  return (
    <div
      id="impersonation-banner"
      className="flex items-center justify-between gap-4 px-4 py-2.5 z-50 relative"
      style={{
        background: 'linear-gradient(90deg, #b45309 0%, #92400e 100%)',
        borderBottom: '1px solid rgba(251,191,36,0.3)',
      }}
    >
      {/* Left: Icon + Text */}
      <div className="flex items-center gap-3 min-w-0">
        <span
          className="flex items-center justify-center w-6 h-6 rounded-full shrink-0"
          style={{ background: 'rgba(251,191,36,0.2)', border: '1px solid rgba(251,191,36,0.4)' }}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold text-white truncate">
            Admin Mode — Viewing as:{' '}
            <span style={{ color: '#fde68a' }}>{impersonatedTenant.name}</span>
          </p>
          <p className="text-2xs" style={{ color: 'rgba(253,230,138,0.7)' }}>
            This is a read/write impersonation session. All actions affect the real tenant.
          </p>
        </div>
      </div>

      {/* Right: Timer + Exit */}
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-2xs font-mono" style={{ color: 'rgba(253,230,138,0.7)' }}>
          Session: 4h max
        </span>
        <button
          onClick={handleExit}
          disabled={exiting}
          className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-bold transition-all hover:opacity-90 disabled:opacity-50"
          style={{
            background: 'rgba(251,191,36,0.2)',
            border: '1px solid rgba(251,191,36,0.5)',
            color: '#fbbf24',
          }}
        >
          {exiting ? (
            <>
              <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Exiting…
            </>
          ) : (
            <>
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Exit Impersonation
            </>
          )}
        </button>
      </div>
    </div>
  );
}
