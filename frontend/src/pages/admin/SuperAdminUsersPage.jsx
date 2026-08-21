/**
 * VDAJ Services — Super Admin: Users Management Page
 * Route: /admin/users  (super_admin only)
 *
 * Features:
 * - Cross-tenant user data grid
 * - Add User modal with tenant selector + role assignment
 * - Force password reset (reveal temp password once)
 * - Role change dropdown per user
 */

import React, { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { superAdminApi } from '../../lib/api';
import { showSuccess } from '../../components/atoms/Toast/Toast.jsx';

// ── Constants ─────────────────────────────────────────────────
const ROLES = ['tenant_admin', 'manager', 'agent', 'tenant_user'];

const ROLE_CFG = {
  super_admin:  { label: 'Super Admin',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  tenant_admin: { label: 'Tenant Admin',  color: '#AFA9EC', bg: 'rgba(83,74,183,0.12)'  },
  manager:      { label: 'Manager',       color: '#53BDEB', bg: 'rgba(83,189,235,0.12)' },
  agent:        { label: 'Agent',         color: '#1D9E75', bg: 'rgba(29,158,117,0.12)' },
  tenant_user:  { label: 'User',          color: '#6b7280', bg: 'rgba(100,100,100,0.1)' },
};

function RolePill({ role }) {
  const cfg = ROLE_CFG[role] || ROLE_CFG.tenant_user;
  return (
    <span className="text-2xs font-bold px-2 py-0.5 rounded-full"
      style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(iso) {
  if (!iso) return 'Never';
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

// ── Reset Password Result Modal ───────────────────────────────
function ResetResultModal({ user, password, onClose }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-sm rounded-2xl p-6 space-y-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)' }}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">🔐</span>
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Password Reset</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Share with {user.email} — shown once only.</p>
          </div>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}>
          <p className="text-2xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>New Temp Password</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-sm font-bold" style={{ color: '#AFA9EC' }}>{password}</code>
            <button
              onClick={() => { navigator.clipboard.writeText(password); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="text-xs px-2 py-1 rounded-lg transition-all hover:opacity-80"
              style={{ background: 'rgba(83,74,183,0.2)', color: '#AFA9EC' }}>
              {copied ? '✓ Copied' : '⎘ Copy'}
            </button>
          </div>
        </div>
        <button onClick={onClose}
          className="w-full h-9 rounded-xl text-sm font-semibold text-white"
          style={{ background: '#534AB7' }}>
          Done
        </button>
      </div>
    </div>
  );
}

// ── Add User Modal ────────────────────────────────────────────
function AddUserModal({ tenants, onClose, onCreated }) {
  const [form, setForm] = useState({
    tenantId: tenants[0]?.id || '',
    email: '', firstName: '', lastName: '', role: 'agent', password: '',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await superAdminApi.createUser(form);
      setResult(res?.data || res);
      onCreated();
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full h-9 rounded-xl px-3 text-sm outline-none transition-all";
  const inputStyle = { background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)' };

  if (result) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
        <div className="w-full max-w-sm rounded-2xl p-6 space-y-4"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(29,158,117,0.15)', color: '#1D9E75', fontSize: 18 }}>✓</div>
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>User Created</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Save credentials — shown once.</p>
            </div>
          </div>
          <div className="rounded-xl p-4 space-y-2" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}>
            <div className="flex justify-between">
              <span className="text-2xs text-gray-500">Email</span>
              <span className="font-mono text-xs" style={{ color: 'var(--text-primary)' }}>{result.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-2xs text-gray-500">Password</span>
              <span className="font-mono text-xs font-bold" style={{ color: '#AFA9EC' }}>{result.tempPassword}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-2xs text-gray-500">Role</span>
              <RolePill role={result.role} />
            </div>
          </div>
          <button onClick={onClose} className="w-full h-9 rounded-xl text-sm font-semibold text-white" style={{ background: '#534AB7' }}>Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--bg-border)', background: 'var(--bg-elevated)' }}>
          <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Add User</h2>
          <button type="button" onClick={onClose} className="opacity-50 hover:opacity-100">✕</button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-2xs font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>Tenant *</label>
            <select className={inputClass} style={inputStyle} value={form.tenantId} onChange={(e) => set('tenantId', e.target.value)} required>
              {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-2xs font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>Email *</label>
            <input type="email" className={inputClass} style={inputStyle} required
              value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="user@client.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-2xs font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>First Name</label>
              <input className={inputClass} style={inputStyle}
                value={form.firstName} onChange={(e) => set('firstName', e.target.value)} placeholder="John" />
            </div>
            <div>
              <label className="text-2xs font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>Last Name</label>
              <input className={inputClass} style={inputStyle}
                value={form.lastName} onChange={(e) => set('lastName', e.target.value)} placeholder="Smith" />
            </div>
          </div>
          <div>
            <label className="text-2xs font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>Role</label>
            <select className={inputClass} style={inputStyle} value={form.role} onChange={(e) => set('role', e.target.value)}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_CFG[r]?.label || r}</option>)}
            </select>
          </div>
          <div>
            <label className="text-2xs font-semibold block mb-1" style={{ color: 'var(--text-secondary)' }}>Password (leave blank to auto-generate)</label>
            <input type="password" className={inputClass} style={inputStyle}
              value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="••••••••••" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t"
          style={{ borderColor: 'var(--bg-border)', background: 'var(--bg-elevated)' }}>
          <button type="button" onClick={onClose}
            className="h-9 px-4 rounded-xl text-sm font-semibold hover:opacity-70 transition-opacity"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)', color: 'var(--text-secondary)' }}>
            Cancel
          </button>
          <button type="submit" disabled={loading}
            className="h-9 px-5 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            style={{ background: '#534AB7' }}>
            {loading ? 'Creating…' : 'Create User'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function SuperAdminUsersPage() {
  const [users,      setUsers]      = useState([]);
  const [tenants,    setTenants]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showAdd,    setShowAdd]    = useState(false);
  const [resetting,  setResetting]  = useState(null); // userId
  const [resetResult, setResetResult] = useState(null); // { user, password }
  const [search,     setSearch]     = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, tenantsRes] = await Promise.all([
        superAdminApi.listUsers(),
        superAdminApi.listTenants(),
      ]);
      setUsers(usersRes?.data || []);
      setTenants(tenantsRes?.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleResetPassword = async (user) => {
    setResetting(user.id);
    try {
      const res = await superAdminApi.resetPassword(user.id);
      setResetResult({ user, password: (res?.data || res)?.newPassword });
      showSuccess('Password reset successfully.');
    } finally {
      setResetting(null);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await superAdminApi.changeRole(userId, newRole);
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole } : u));
      showSuccess('Role updated.');
    } catch {}
  };

  const filtered = users.filter((u) => {
    const matchSearch = !search ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      (u.tenant_name || '').toLowerCase().includes(search.toLowerCase());
    const matchRole = !roleFilter || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const inputStyle = { background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)' };

  return (
    <div className="max-w-[1400px] mx-auto space-y-6" style={{ animation: 'fadeIn 0.3s ease-out' }}>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>User Management</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            All platform users across {tenants.length} client accounts.
          </p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 h-10 px-5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          style={{ background: '#534AB7', boxShadow: '0 4px 20px rgba(83,74,183,0.4)' }}>
          <span className="text-lg leading-none">+</span> Add User
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, or company…"
          className="h-9 rounded-xl px-3 text-sm outline-none flex-1 min-w-[200px]"
          style={inputStyle}
        />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
          className="h-9 rounded-xl px-3 text-sm outline-none"
          style={{ ...inputStyle, minWidth: 140 }}>
          <option value="">All Roles</option>
          {['super_admin', ...ROLES].map((r) => (
            <option key={r} value={r}>{ROLE_CFG[r]?.label || r}</option>
          ))}
        </select>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {filtered.length} / {users.length} users
        </span>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden"
        style={{ border: '1px solid var(--bg-border)', background: 'var(--bg-card)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--bg-border)' }}>
                {['User', 'Company', 'Role', 'Status', 'Last Login', 'Joined', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-2xs font-bold uppercase tracking-wider whitespace-nowrap"
                    style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--bg-border)' }}>
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {[160, 130, 90, 70, 110, 90, 130].map((w, j) => (
                      <td key={j} className="px-4 py-3.5">
                        <div className="h-3 rounded" style={{ width: w, background: 'var(--bg-elevated)' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center" style={{ color: 'var(--text-muted)' }}>
                    <div className="flex flex-col items-center gap-3">
                      <span className="text-4xl opacity-10">👤</span>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>No users found</p>
                      <p className="text-xs">{search ? 'Try a different search term.' : 'Add users to get started.'}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id}
                    className="transition-colors"
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>

                    {/* User */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0"
                          style={{ background: 'linear-gradient(135deg, #534AB7 0%, #7C6FD1 100%)' }}>
                          {(u.first_name?.[0] || u.email?.[0] || 'U').toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold" style={{ color: 'var(--text-primary)' }}>
                            {[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}
                          </p>
                          <p className="text-2xs" style={{ color: 'var(--text-muted)' }}>{u.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Company */}
                    <td className="px-4 py-3.5">
                      {u.tenant_name ? (
                        <div>
                          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{u.tenant_name}</p>
                          <p className="text-2xs font-mono" style={{ color: 'var(--text-muted)' }}>{u.tenant_status}</p>
                        </div>
                      ) : (
                        <span className="text-2xs font-bold px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
                          Platform
                        </span>
                      )}
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3.5">
                      {u.role === 'super_admin' ? (
                        <RolePill role={u.role} />
                      ) : (
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          className="h-7 rounded-lg px-2 text-2xs font-bold outline-none cursor-pointer"
                          style={{ background: ROLE_CFG[u.role]?.bg || 'var(--bg-elevated)', color: ROLE_CFG[u.role]?.color || 'var(--text-primary)', border: 'none' }}>
                          {ROLES.map((r) => <option key={r} value={r}>{ROLE_CFG[r]?.label || r}</option>)}
                        </select>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <span className={clsx(
                        'text-2xs font-bold px-2 py-0.5 rounded-full',
                        u.is_active
                          ? 'text-teal-400'
                          : 'text-red-400'
                      )}
                        style={{ background: u.is_active ? 'rgba(20,184,166,0.1)' : 'rgba(239,68,68,0.1)' }}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    {/* Last Login */}
                    <td className="px-4 py-3.5 whitespace-nowrap"
                      style={{ color: 'var(--text-secondary)' }}>
                      {fmtDateTime(u.last_login_at)}
                    </td>

                    {/* Joined */}
                    <td className="px-4 py-3.5 whitespace-nowrap"
                      style={{ color: 'var(--text-secondary)' }}>
                      {fmtDate(u.created_at)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {u.role !== 'super_admin' && (
                        <button
                          disabled={resetting === u.id}
                          onClick={() => handleResetPassword(u)}
                          className="h-7 px-2.5 rounded-lg text-2xs font-semibold transition-all hover:opacity-80 disabled:opacity-50"
                          style={{ background: 'rgba(83,74,183,0.1)', color: '#AFA9EC', border: '1px solid rgba(83,74,183,0.2)' }}>
                          {resetting === u.id ? '…' : '🔑 Reset Password'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showAdd && tenants.length > 0 && (
        <AddUserModal
          tenants={tenants}
          onClose={() => setShowAdd(false)}
          onCreated={load}
        />
      )}

      {resetResult && (
        <ResetResultModal
          user={resetResult.user}
          password={resetResult.password}
          onClose={() => setResetResult(null)}
        />
      )}
    </div>
  );
}
