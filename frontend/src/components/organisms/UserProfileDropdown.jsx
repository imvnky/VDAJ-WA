/**
 * VDAJ Services — UserProfileDropdown
 * Top-right profile menu with avatar, account summary, navigation links, and logout.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import useAuthStore from '../../store/authStore';
import { authApi } from '../../lib/api';
import { showSuccess } from '../atoms/Toast/Toast.jsx';

export default function UserProfileDropdown() {
  const { user, tenant, isImpersonating, clearAuth } = useAuthStore();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setOpen(false);
    try { await authApi.logout(); } catch {}
    clearAuth();
    showSuccess('Logged out successfully.');
    navigate('/login');
  };

  const initial = (user?.firstName?.[0] || user?.email?.[0] || 'U').toUpperCase();
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'User';
  const roleLabel = user?.role === 'super_admin'
    ? 'Super Admin'
    : user?.role === 'tenant_admin'
      ? 'Tenant Admin'
      : (user?.role?.replace('_', ' ') || 'Member');

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setOpen(!open)}
        className={clsx(
          "flex items-center gap-2.5 pl-1.5 pr-3 py-1 rounded-full border transition-all cursor-pointer select-none",
          open
            ? "bg-[#F3F2FD] border-[#534AB7]/40 shadow-sm"
            : "bg-white border-[#E6E4F5] hover:bg-[#F8F7FF] hover:border-[#D4D2E6]"
        )}
        title="Account & Profile"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#534AB7] to-[#3B3499] text-white flex items-center justify-center text-xs font-bold shadow-xs">
          {initial}
        </div>
        <div className="hidden sm:flex flex-col text-left leading-tight">
          <span className="text-xs font-bold text-[#0F0F0F] max-w-[120px] truncate">
            {user?.firstName || fullName}
          </span>
          <span className="text-[10px] text-[#9494A8] font-semibold uppercase tracking-wider">
            {roleLabel}
          </span>
        </div>
        <svg
          className={clsx("w-3.5 h-3.5 text-[#9494A8] transition-transform duration-200", open && "rotate-180")}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {open && (
        <div
          className="absolute right-0 mt-2 w-72 rounded-2xl bg-white border border-[#E6E4F5] shadow-2xl p-2 z-50 animate-scale-in"
          style={{ boxShadow: '0 12px 36px rgba(83, 74, 183, 0.16)' }}
        >
          {/* Header Card */}
          <div className="p-3 rounded-xl bg-[#F8F7FF] border border-[#E6E4F5]/80 mb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#534AB7] text-white flex items-center justify-center text-sm font-bold shadow-sm shrink-0">
                {initial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[#0F0F0F] truncate">{fullName}</p>
                <p className="text-xs text-[#64748B] truncate">{user?.email}</p>
              </div>
            </div>

            <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-[#E6E4F5]/70 text-2xs">
              <span className="font-semibold text-[#64748B] uppercase tracking-wider">Workspace</span>
              <span className="font-bold text-[#534AB7] max-w-[140px] truncate">
                {tenant?.name || 'VDAJ Platform'}
              </span>
            </div>
          </div>

          {/* Nav Items */}
          <div className="space-y-0.5">
            <button
              onClick={() => { setOpen(false); navigate('/settings'); }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-[#334155] hover:bg-[#F3F2FD] hover:text-[#534AB7] transition-colors text-left"
            >
              <svg className="w-4 h-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Settings & Account</span>
            </button>

            <button
              onClick={() => { setOpen(false); navigate('/team'); }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-[#334155] hover:bg-[#F3F2FD] hover:text-[#534AB7] transition-colors text-left"
            >
              <svg className="w-4 h-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Team Members</span>
            </button>

            <button
              onClick={() => { setOpen(false); navigate('/compliance'); }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-[#334155] hover:bg-[#F3F2FD] hover:text-[#534AB7] transition-colors text-left"
            >
              <svg className="w-4 h-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
              <span>Compliance & Opt-In</span>
            </button>
          </div>

          {/* Divider */}
          <div className="border-t border-[#E6E4F5] my-1.5" />

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold text-[#DC2626] hover:bg-[#FEE2E2]/60 transition-colors text-left"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
            </svg>
            <span>Log out</span>
          </button>
        </div>
      )}
    </div>
  );
}
