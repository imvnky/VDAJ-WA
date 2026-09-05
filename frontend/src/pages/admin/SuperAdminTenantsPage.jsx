/**
 * VDAJ Services — Super Admin: Tenants Management Page (Phase 3)
 * Route: /admin/tenants  (super_admin only)
 *
 * Phase 1 features retained:
 *  - Tenant directory grid with health indicators
 *  - "Add New Client" modal with feature toggles
 *  - Feature flag editor panel per tenant
 *  - Suspend / Reactivate toggle
 *
 * Phase 3 additions:
 *  - Platform-wide KPI overview cards (live from GET /admin/overview)
 *  - Working impersonation via POST /admin/impersonate/:tenantId
 *  - Confirm modal for suspend/activate and impersonate
 *  - WABA Quality distribution badges in overview
 */

import React, { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { useNavigate } from 'react-router-dom';
import { superAdminApi, authApi } from '../../lib/api';
import { showSuccess, showError } from '../../components/atoms/Toast/Toast.jsx';
import { ErrorState, parseApiError } from '../../components/atoms/ErrorState/ErrorState.jsx';
import useAuthStore from '../../store/authStore';

// ── Constants ─────────────────────────────────────────────────
const ALL_FEATURES = [
  { key: 'inbox',          label: 'Inbox',          desc: 'Two-way conversations' },
  { key: 'campaigns',      label: 'Campaigns',       desc: 'Bulk message campaigns' },
  { key: 'contacts',       label: 'Contacts',        desc: 'Contact management & CRM' },
  { key: 'templates',      label: 'Templates',       desc: 'WhatsApp message templates' },
  { key: 'analytics',      label: 'Analytics',       desc: 'KPI dashboards & reports' },
  { key: 'automation',     label: 'Automation',      desc: 'Drip sequences & AI responder' },
  { key: 'commerce',       label: 'Commerce',        desc: 'Meta catalog & product msgs' },
  { key: 'logs',           label: 'Message Logs',    desc: 'Full delivery log table' },
];

const PLANS = ['starter', 'growth', 'enterprise', 'custom'];

// ── Helpers ───────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtNum(n) {
  return parseInt(n || 0, 10).toLocaleString();
}

// ── Reusable Badges ───────────────────────────────────────────
function StatusPill({ status }) {
  const cfg = {
    active:    { label: 'Active',    bg: 'rgba(29,158,117,0.12)', color: '#1D9E75' },
    suspended: { label: 'Suspended', bg: 'rgba(239,68,68,0.12)',  color: '#f87171' },
    trial:     { label: 'Trial',     bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
    churned:   { label: 'Churned',   bg: 'rgba(100,100,100,0.12)',color: '#6b7280' },
  }[status] || { label: status, bg: 'rgba(83,74,183,0.12)', color: '#AFA9EC' };
  return (
    <span className="inline-flex items-center gap-1.5 text-2xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />
      {cfg.label}
    </span>
  );
}

function QualityBadge({ rating }) {
  const cfg = {
    GREEN:  { label: 'Green',   color: '#1D9E75', bg: 'rgba(29,158,117,0.12)' },
    YELLOW: { label: 'Yellow',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    RED:    { label: 'Red',     color: '#f87171', bg: 'rgba(239,68,68,0.12)'  },
  }[rating] || { label: 'N/A', color: '#6b7280', bg: 'rgba(100,100,100,0.1)' };
  return (
    <span className="text-2xs font-bold px-2 py-0.5 rounded-full"
      style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

function WABABadge({ connected }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full')}
      style={{
        color:      connected ? '#1D9E75' : '#6b7280',
        background: connected ? 'rgba(29,158,117,0.1)' : 'rgba(100,100,100,0.08)',
      }}>
      <span className={clsx('w-1.5 h-1.5 rounded-full', connected ? 'bg-teal-400' : 'bg-gray-500')} />
      {connected ? 'Connected' : 'Not linked'}
    </span>
  );
}

// ── Overview Cards ────────────────────────────────────────────
function OverviewPanel({ overview, loading }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl p-4 animate-pulse"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)', height: 80 }} />
        ))}
      </div>
    );
  }

  if (!overview) return null;

  const { tenants, contacts, messages, quality } = overview;

  const cards = [
    {
      label: 'Active Clients',
      value: fmtNum(tenants?.active_tenants),
      sub:   `${fmtNum(tenants?.total_tenants)} total`,
      color: '#1D9E75',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      label: 'Platform Contacts',
      value: fmtNum(contacts?.total_contacts),
      sub:   'across all tenants',
      color: '#AFA9EC',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      label: 'Messages Today',
      value: fmtNum(messages?.msgs_today),
      sub:   `${fmtNum(messages?.monthly_quota)} monthly quota`,
      color: '#53BDEB',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
    },
    {
      label: 'WABA Quality',
      value: null, // rendered differently
      color: '#f59e0b',
      quality: { green: quality?.green || 0, yellow: quality?.yellow || 0, red: quality?.red || 0 },
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-2xl p-4"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-2xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              {c.label}
            </p>
            <span className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: `${c.color}18`, color: c.color }}>
              {c.icon}
            </span>
          </div>
          {c.quality ? (
            <div className="flex items-center gap-2 flex-wrap mt-1">
              <span className="text-xs font-bold" style={{ color: '#1D9E75' }}>🟢 {c.quality.green}</span>
              <span className="text-xs font-bold" style={{ color: '#f59e0b' }}>🟡 {c.quality.yellow}</span>
              <span className="text-xs font-bold" style={{ color: '#f87171' }}>🔴 {c.quality.red}</span>
            </div>
          ) : (
            <>
              <p className="text-2xl font-black" style={{ color: c.color }}>{c.value}</p>
              {c.sub && <p className="text-2xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{c.sub}</p>}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Feature Checkboxes Panel ──────────────────────────────────
function FeaturePanel({ tenantId, initialFeatures, onSave, onClose }) {
  const [selected, setSelected] = useState(new Set(initialFeatures));
  const [saving, setSaving] = useState(false);

  const toggle = (key) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await superAdminApi.updateFeatures(tenantId, [...selected]);
      showSuccess('Feature flags updated.');
      onSave([...selected]);
    } catch {} finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--bg-border)', background: 'var(--bg-elevated)' }}>
          <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Manage Feature Access</h2>
          <button onClick={onClose} className="opacity-50 hover:opacity-100 transition-opacity text-lg"
            style={{ color: 'var(--text-muted)' }}>✕</button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-3">
          {ALL_FEATURES.map((f) => (
            <label key={f.key}
              className="flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all"
              style={{
                background: selected.has(f.key) ? 'rgba(83,74,183,0.12)' : 'var(--bg-elevated)',
                border: `1px solid ${selected.has(f.key) ? 'rgba(83,74,183,0.35)' : 'var(--bg-border)'}`,
              }}>
              <input type="checkbox" className="mt-0.5 shrink-0 accent-purple-500"
                checked={selected.has(f.key)} onChange={() => toggle(f.key)} />
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{f.label}</p>
                <p className="text-2xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{f.desc}</p>
              </div>
            </label>
          ))}
        </div>
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t"
          style={{ borderColor: 'var(--bg-border)', background: 'var(--bg-elevated)' }}>
          <button onClick={onClose}
            className="h-9 px-4 rounded-xl text-sm font-semibold transition-all hover:opacity-70"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)', color: 'var(--text-secondary)' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="h-9 px-5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: '#534AB7' }}>
            {saving ? 'Saving…' : 'Save Features'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Confirm Modal ─────────────────────────────────────────────
function ConfirmModal({ title, message, confirmLabel, confirmStyle, onConfirm, onClose, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)' }}>
        <div className="p-6 space-y-3">
          <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{message}</p>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t"
          style={{ borderColor: 'var(--bg-border)', background: 'var(--bg-elevated)' }}>
          <button onClick={onClose}
            className="h-9 px-4 rounded-xl text-sm font-semibold hover:opacity-70"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)', color: 'var(--text-secondary)' }}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="h-9 px-5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
            style={confirmStyle || { background: '#534AB7' }}>
            {loading ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add Tenant Modal ──────────────────────────────────────────
function AddTenantModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '', slug: '', plan: 'starter',
    adminEmail: '', adminFirstName: '', adminLastName: '',
    countryCode: 'IN', timezone: 'Asia/Kolkata',
    enabledFeatures: ['inbox', 'campaigns', 'contacts', 'templates', 'analytics'],
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const handleNameChange = (v) => {
    set('name', v);
    set('slug', v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
  };
  const toggleFeature = (key) => {
    setForm((p) => {
      const f = new Set(p.enabledFeatures);
      f.has(key) ? f.delete(key) : f.add(key);
      return { ...p, enabledFeatures: [...f] };
    });
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await superAdminApi.createTenant(form);
      setResult(res?.data || res);
      onCreated();
    } catch {} finally { setLoading(false); }
  };

  const inputClass = 'w-full h-9 rounded-xl px-3 text-sm outline-none transition-all';
  const inputStyle = { background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)' };

  if (result) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}>
        <div className="w-full max-w-sm rounded-2xl p-6 space-y-4"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
              style={{ background: 'rgba(29,158,117,0.15)', color: '#1D9E75' }}>✓</div>
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Tenant Created!</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Save these credentials — shown once only.</p>
            </div>
          </div>
          <div className="rounded-xl p-4 space-y-2"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}>
            <CredRow label="Tenant"        value={result.tenant?.name} />
            <CredRow label="Admin Email"   value={result.adminUser?.email} />
            <CredRow label="Temp Password" value={result.adminUser?.tempPassword} highlight />
          </div>
          <p className="text-2xs text-center" style={{ color: 'var(--text-muted)' }}>
            Share these with the client. They should change the password on first login.
          </p>
          <button onClick={onClose}
            className="w-full h-9 rounded-xl text-sm font-semibold text-white"
            style={{ background: '#534AB7' }}>Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}>
      <form onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--bg-border)', background: 'var(--bg-elevated)' }}>
          <div>
            <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Add New Client</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Creates tenant + admin account</p>
          </div>
          <button type="button" onClick={onClose} className="text-lg opacity-50 hover:opacity-100 transition-opacity">✕</button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <p className="text-2xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Business Details</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-2xs font-semibold mb-1 block" style={{ color: 'var(--text-secondary)' }}>Business Name *</label>
              <input className={inputClass} style={inputStyle} required
                value={form.name} onChange={(e) => handleNameChange(e.target.value)} placeholder="Acme Corp" />
            </div>
            <div>
              <label className="text-2xs font-semibold mb-1 block" style={{ color: 'var(--text-secondary)' }}>URL Slug *</label>
              <input className={inputClass} style={inputStyle} required
                value={form.slug} onChange={(e) => set('slug', e.target.value)} placeholder="acme-corp" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-2xs font-semibold mb-1 block" style={{ color: 'var(--text-secondary)' }}>Plan</label>
              <select className={inputClass} style={inputStyle}
                value={form.plan} onChange={(e) => set('plan', e.target.value)}>
                {PLANS.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-2xs font-semibold mb-1 block" style={{ color: 'var(--text-secondary)' }}>Country</label>
              <input className={inputClass} style={inputStyle}
                value={form.countryCode} onChange={(e) => set('countryCode', e.target.value.toUpperCase().slice(0,2))}
                placeholder="IN" maxLength={2} />
            </div>
          </div>

          <p className="text-2xs font-bold uppercase tracking-wider pt-2" style={{ color: 'var(--text-muted)' }}>Admin Account</p>
          <div>
            <label className="text-2xs font-semibold mb-1 block" style={{ color: 'var(--text-secondary)' }}>Admin Email *</label>
            <input type="email" className={inputClass} style={inputStyle} required
              value={form.adminEmail} onChange={(e) => set('adminEmail', e.target.value)} placeholder="admin@client.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-2xs font-semibold mb-1 block" style={{ color: 'var(--text-secondary)' }}>First Name</label>
              <input className={inputClass} style={inputStyle}
                value={form.adminFirstName} onChange={(e) => set('adminFirstName', e.target.value)} placeholder="John" />
            </div>
            <div>
              <label className="text-2xs font-semibold mb-1 block" style={{ color: 'var(--text-secondary)' }}>Last Name</label>
              <input className={inputClass} style={inputStyle}
                value={form.adminLastName} onChange={(e) => set('adminLastName', e.target.value)} placeholder="Smith" />
            </div>
          </div>

          <p className="text-2xs font-bold uppercase tracking-wider pt-2" style={{ color: 'var(--text-muted)' }}>Service Access</p>
          <div className="grid grid-cols-2 gap-2">
            {ALL_FEATURES.map((f) => (
              <label key={f.key}
                className="flex items-center gap-2 p-2.5 rounded-xl cursor-pointer transition-all"
                style={{
                  background: form.enabledFeatures.includes(f.key) ? 'rgba(83,74,183,0.12)' : 'var(--bg-elevated)',
                  border: `1px solid ${form.enabledFeatures.includes(f.key) ? 'rgba(83,74,183,0.3)' : 'var(--bg-border)'}`,
                }}>
                <input type="checkbox" className="accent-purple-500"
                  checked={form.enabledFeatures.includes(f.key)} onChange={() => toggleFeature(f.key)} />
                <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{f.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t"
          style={{ borderColor: 'var(--bg-border)', background: 'var(--bg-elevated)' }}>
          <button type="button" onClick={onClose}
            className="h-9 px-4 rounded-xl text-sm font-semibold hover:opacity-70 transition-opacity"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)', color: 'var(--text-secondary)' }}>
            Cancel
          </button>
          <button type="submit" disabled={loading}
            className="h-9 px-5 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            style={{ background: '#534AB7' }}>
            {loading ? 'Creating…' : 'Create Client'}
          </button>
        </div>
      </form>
    </div>
  );
}

function CredRow({ label, value, highlight }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(value || ''); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-2xs font-semibold shrink-0" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className={clsx('font-mono text-xs truncate', highlight ? 'font-bold' : '')}
        style={{ color: highlight ? '#AFA9EC' : 'var(--text-primary)' }}>{value}</span>
      <button onClick={copy} className="text-2xs shrink-0 opacity-60 hover:opacity-100" style={{ color: 'var(--text-muted)' }}>
        {copied ? '✓' : '⎘'}
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function SuperAdminTenantsPage() {
  const navigate = useNavigate();
  const { startImpersonation, setAuth } = useAuthStore();

  const [tenants,      setTenants]      = useState([]);
  const [overview,     setOverview]     = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [ovLoading,    setOvLoading]    = useState(true);
  const [showAdd,      setShowAdd]      = useState(false);
  const [featurePanel, setFeaturePanel] = useState(null);

  // Confirm modal state
  const [confirm, setConfirm] = useState(null);
  // { type: 'suspend'|'activate'|'impersonate', tenant, loading }

  const [error,        setError]        = useState(null);

  // ── Loaders ─────────────────────────────────────────────────
  const loadTenants = useCallback(async () => {
    setLoading(true);
    try {
      const res = await superAdminApi.listTenants({ silent: true });
      setTenants(res?.data || []);
      setError(null);
    } catch (err) {
      setError(parseApiError(err));
    } finally { setLoading(false); }
  }, []);

  const loadOverview = useCallback(async () => {
    setOvLoading(true);
    try {
      const res = await superAdminApi.overview({ silent: true });
      setOverview(res?.data || null);
    } catch {} finally { setOvLoading(false); }
  }, []);

  useEffect(() => {
    loadTenants();
    loadOverview();
  }, [loadTenants, loadOverview]);

  // ── Suspend / Activate ──────────────────────────────────────
  const handleSuspendConfirm = async () => {
    if (!confirm) return;
    const { tenant, type } = confirm;
    const willSuspend = type === 'suspend';
    setConfirm((c) => ({ ...c, loading: true }));
    try {
      await superAdminApi.suspendTenant(tenant.id, willSuspend);
      showSuccess(`Tenant ${willSuspend ? 'suspended' : 'reactivated'}.`);
      loadTenants();
      loadOverview();
    } catch {} finally { setConfirm(null); }
  };

  // ── Impersonation ───────────────────────────────────────────
  const handleImpersonateConfirm = async () => {
    if (!confirm) return;
    const { tenant } = confirm;
    setConfirm((c) => ({ ...c, loading: true }));
    try {
      const res = await superAdminApi.impersonate(tenant.id);
      const data = res?.data;

      // Re-fetch /auth/me to get the impersonation session user populated
      const meRes = await authApi.me({ silent: true });
      setAuth(meRes.data?.user, meRes.data?.tenant || null);

      // Set impersonation overlay state
      startImpersonation({
        id:   data.tenant.id,
        name: data.tenant.name,
        slug: data.tenant.slug,
      });

      showSuccess(`Now viewing ${tenant.name} as Admin.`);
      setConfirm(null);

      // Redirect to tenant's dashboard
      navigate('/dashboard');
    } catch (err) {
      setConfirm((c) => ({ ...c, loading: false }));
    }
  };

  const handleFeaturesUpdated = (tenantId, features) => {
    setTenants((prev) => prev.map((t) => t.id === tenantId ? { ...t, enabled_features: features } : t));
    setFeaturePanel(null);
  };

  // ── Confirm dispatch ────────────────────────────────────────
  const openSuspendConfirm = (tenant) =>
    setConfirm({ type: tenant.status === 'active' ? 'suspend' : 'activate', tenant, loading: false });

  const openImpersonateConfirm = (tenant) =>
    setConfirm({ type: 'impersonate', tenant, loading: false });

  const onConfirm = () => {
    if (!confirm) return;
    if (confirm.type === 'impersonate') handleImpersonateConfirm();
    else handleSuspendConfirm();
  };

  // ── Stats ───────────────────────────────────────────────────
  const stats = {
    total:     tenants.length,
    active:    tenants.filter((t) => t.status === 'active').length,
    suspended: tenants.filter((t) => t.status === 'suspended').length,
    waba:      tenants.filter((t) => t.waba_connected).length,
  };

  return (
    <div className="w-full space-y-6" style={{ animation: 'fadeIn 0.3s ease-out' }}>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
            Client Management
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Manage all client tenants, service access, and WhatsApp accounts.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 h-10 px-5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
          style={{ background: '#534AB7', boxShadow: '0 4px 20px rgba(83,74,183,0.4)' }}>
          <span className="text-lg leading-none">+</span> Add New Client
        </button>
      </div>

      {/* Platform Overview */}
      <OverviewPanel overview={overview} loading={ovLoading} />

      {/* Tenant Directory Grid */}
      <div className="rounded-2xl overflow-hidden"
        style={{ border: '1px solid var(--bg-border)', background: 'var(--bg-card)' }}>
        {/* Table header */}
        <div className="px-5 py-3 border-b flex items-center gap-3"
          style={{ borderColor: 'var(--bg-border)', background: 'var(--bg-elevated)' }}>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            All Clients
          </p>
          <span className="text-2xs px-2 py-0.5 rounded-full font-bold"
            style={{ background: 'rgba(83,74,183,0.1)', color: '#AFA9EC' }}>
            {stats.total}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--bg-border)' }}>
                {['Client', 'Admin', 'Plan', 'Status', 'WABA', 'Quality', 'Tier', 'Today\'s Msgs', 'Users', 'Features', 'Joined', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-2xs font-bold uppercase tracking-wider whitespace-nowrap"
                    style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--bg-border)' }}>
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {[180, 140, 70, 80, 100, 70, 50, 80, 50, 120, 90, 160].map((w, j) => (
                      <td key={j} className="px-4 py-3.5">
                        <div className="h-3 rounded" style={{ width: w, background: 'var(--bg-elevated)' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={12} className="p-8">
                    <ErrorState
                      title="Failed to load client tenants"
                      message={error.message}
                      httpCode={error.httpCode}
                      errorCode={error.errorCode}
                      onRetry={loadTenants}
                    />
                  </td>
                </tr>
              ) : tenants.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-16 text-center" style={{ color: 'var(--text-muted)' }}>
                    <div className="flex flex-col items-center gap-3">
                      <span className="text-4xl opacity-10">🏢</span>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>No clients yet</p>
                      <p className="text-xs">Click "Add New Client" to onboard your first client.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                tenants.map((t) => (
                  <tr key={t.id} className="transition-colors"
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>

                    {/* Client */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black text-white shrink-0"
                          style={{ background: 'linear-gradient(135deg, #534AB7, #7C6FD1)' }}>
                          {t.name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{t.name}</p>
                          <p className="text-2xs font-mono" style={{ color: 'var(--text-muted)' }}>{t.slug}</p>
                        </div>
                      </div>
                    </td>

                    {/* Admin */}
                    <td className="px-4 py-3.5">
                      <span style={{ color: 'var(--text-secondary)' }}>{t.admin_email || '—'}</span>
                    </td>

                    {/* Plan */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="text-2xs font-bold px-2 py-0.5 rounded-full capitalize"
                        style={{ background: 'rgba(83,74,183,0.1)', color: '#AFA9EC' }}>
                        {t.plan}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <StatusPill status={t.status} />
                    </td>

                    {/* WABA */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <WABABadge connected={t.waba_connected} />
                    </td>

                    {/* Quality */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <QualityBadge rating={t.quality_rating} />
                    </td>

                    {/* Tier */}
                    <td className="px-4 py-3.5 text-center font-bold"
                      style={{ color: 'var(--text-primary)' }}>
                      {t.messaging_tier ? `T${t.messaging_tier}` : '—'}
                    </td>

                    {/* Today's Msgs */}
                    <td className="px-4 py-3.5 text-right font-mono font-bold"
                      style={{ color: 'var(--text-primary)' }}>
                      {(t.msgs_sent_today || 0).toLocaleString()}
                    </td>

                    {/* Users */}
                    <td className="px-4 py-3.5 text-center font-bold"
                      style={{ color: 'var(--text-primary)' }}>
                      {t.user_count || 0}
                    </td>

                    {/* Features */}
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => setFeaturePanel({ id: t.id, features: t.enabled_features || [] })}
                        className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                        <div className="flex gap-1 flex-wrap max-w-[120px]">
                          {(t.enabled_features || []).slice(0, 3).map((f) => (
                            <span key={f} className="text-2xs px-1.5 py-0.5 rounded font-medium"
                              style={{ background: 'rgba(83,74,183,0.1)', color: '#AFA9EC' }}>
                              {f}
                            </span>
                          ))}
                          {(t.enabled_features || []).length > 3 && (
                            <span className="text-2xs" style={{ color: 'var(--text-muted)' }}>
                              +{t.enabled_features.length - 3}
                            </span>
                          )}
                        </div>
                        <span className="text-2xs" style={{ color: '#AFA9EC' }}>✎</span>
                      </button>
                    </td>

                    {/* Joined */}
                    <td className="px-4 py-3.5 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                      {fmtDate(t.created_at)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {/* Impersonate */}
                        <button
                          onClick={() => openImpersonateConfirm(t)}
                          disabled={t.status !== 'active'}
                          title={t.status !== 'active' ? 'Cannot impersonate a suspended tenant' : 'Login as this tenant'}
                          className="h-7 px-2.5 rounded-lg text-2xs font-semibold transition-all hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed"
                          style={{ background: 'rgba(83,74,183,0.12)', color: '#AFA9EC', border: '1px solid rgba(83,74,183,0.2)' }}>
                          👤 Login as
                        </button>

                        {/* Suspend / Activate */}
                        <button
                          onClick={() => openSuspendConfirm(t)}
                          className="h-7 px-2.5 rounded-lg text-2xs font-semibold transition-all hover:opacity-80"
                          style={t.status === 'active'
                            ? { background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }
                            : { background: 'rgba(29,158,117,0.08)', color: '#1D9E75', border: '1px solid rgba(29,158,117,0.2)' }}>
                          {t.status === 'active' ? 'Suspend' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modals ── */}
      {showAdd && (
        <AddTenantModal onClose={() => setShowAdd(false)} onCreated={loadTenants} />
      )}

      {featurePanel && (
        <FeaturePanel
          tenantId={featurePanel.id}
          initialFeatures={featurePanel.features}
          onSave={(features) => handleFeaturesUpdated(featurePanel.id, features)}
          onClose={() => setFeaturePanel(null)}
        />
      )}

      {confirm && (
        <ConfirmModal
          title={
            confirm.type === 'impersonate' ? `Impersonate ${confirm.tenant.name}?` :
            confirm.type === 'suspend'     ? `Suspend ${confirm.tenant.name}?` :
                                             `Reactivate ${confirm.tenant.name}?`
          }
          message={
            confirm.type === 'impersonate'
              ? `You will be redirected to this tenant's dashboard as their admin. A golden banner will appear. Session expires in 4 hours.`
              : confirm.type === 'suspend'
              ? `This will immediately block all logins and API calls for this tenant's users.`
              : `This will restore full platform access for this tenant.`
          }
          confirmLabel={
            confirm.type === 'impersonate' ? '👤 Enter as Admin' :
            confirm.type === 'suspend'     ? 'Suspend'            :
                                             'Reactivate'
          }
          confirmStyle={
            confirm.type === 'impersonate'
              ? { background: 'linear-gradient(135deg,#534AB7,#3B3499)' }
              : confirm.type === 'suspend'
              ? { background: 'rgba(239,68,68,0.8)' }
              : { background: '#1D9E75' }
          }
          loading={confirm.loading}
          onConfirm={onConfirm}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
