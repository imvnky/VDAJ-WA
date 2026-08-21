/**
 * VDAJ Services — Super Admin: Tenants Management Page
 * Route: /admin/tenants  (super_admin only)
 *
 * Features:
 * - Premium data grid with health indicators
 * - "Add New Client" slide-over modal with feature toggles
 * - Feature flag editor (checkbox panel) per tenant
 * - Suspend / Reactivate toggle
 * - Impersonate button (UI shell — Phase 2 logic)
 * - Temp password reveal on tenant creation
 */

import React, { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { superAdminApi } from '../../lib/api';
import { showSuccess } from '../../components/atoms/Toast/Toast.jsx';

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

function WABABadge({ connected }) {
  return (
    <span className={clsx(
      'inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full',
      connected
        ? 'text-teal-400'
        : 'text-gray-500'
    )}
      style={{ background: connected ? 'rgba(20,184,166,0.1)' : 'rgba(100,100,100,0.08)' }}>
      <span className={clsx('w-1.5 h-1.5 rounded-full', connected ? 'bg-teal-400' : 'bg-gray-500')} />
      {connected ? 'Connected' : 'Not linked'}
    </span>
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
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--bg-border)', background: 'var(--bg-elevated)' }}>
          <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            Manage Feature Access
          </h2>
          <button onClick={onClose} className="opacity-50 hover:opacity-100 transition-opacity"
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
                checked={selected.has(f.key)}
                onChange={() => toggle(f.key)} />
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

  // Auto-generate slug from name
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
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full h-9 rounded-xl px-3 text-sm outline-none transition-all";
  const inputStyle = {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--bg-border)',
    color: 'var(--text-primary)',
  };

  if (result) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
        <div className="w-full max-w-sm rounded-2xl p-6 space-y-4"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(29,158,117,0.15)', color: '#1D9E75' }}>✓</div>
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Tenant Created!</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Save these credentials — shown once only.</p>
            </div>
          </div>
          <div className="rounded-xl p-4 space-y-2" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}>
            <CredRow label="Tenant" value={result.tenant?.name} />
            <CredRow label="Admin Email" value={result.adminUser?.email} />
            <CredRow label="Temp Password" value={result.adminUser?.tempPassword} highlight />
          </div>
          <p className="text-2xs text-center" style={{ color: 'var(--text-muted)' }}>
            Share these with the client. They should change the password on first login.
          </p>
          <button onClick={onClose}
            className="w-full h-9 rounded-xl text-sm font-semibold text-white"
            style={{ background: '#534AB7' }}>
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
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
          <button type="button" onClick={onClose} className="opacity-50 hover:opacity-100 transition-opacity">✕</button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Business Details */}
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
                value={form.countryCode} onChange={(e) => set('countryCode', e.target.value.toUpperCase().slice(0,2))} placeholder="IN" maxLength={2} />
            </div>
          </div>

          {/* Admin Account */}
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

          {/* Feature Flags */}
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
                  checked={form.enabledFeatures.includes(f.key)}
                  onChange={() => toggleFeature(f.key)} />
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
  const copy = () => {
    navigator.clipboard.writeText(value || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-2xs font-semibold shrink-0" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className={clsx('font-mono text-xs truncate', highlight ? 'font-bold' : '')}
        style={{ color: highlight ? '#AFA9EC' : 'var(--text-primary)' }}>{value}</span>
      <button onClick={copy} className="text-2xs shrink-0 opacity-60 hover:opacity-100"
        style={{ color: 'var(--text-muted)' }}>
        {copied ? '✓' : '⎘'}
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function SuperAdminTenantsPage() {
  const [tenants,        setTenants]        = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [showAdd,        setShowAdd]        = useState(false);
  const [featurePanel,   setFeaturePanel]   = useState(null); // { id, features }
  const [suspending,     setSuspending]     = useState(null); // id

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await superAdminApi.listTenants();
      setTenants(res?.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSuspend = async (tenant) => {
    const willSuspend = tenant.status === 'active';
    setSuspending(tenant.id);
    try {
      await superAdminApi.suspendTenant(tenant.id, willSuspend);
      showSuccess(`Tenant ${willSuspend ? 'suspended' : 'reactivated'}.`);
      load();
    } finally {
      setSuspending(null);
    }
  };

  const handleFeaturesUpdated = (tenantId, features) => {
    setTenants((prev) => prev.map((t) => t.id === tenantId ? { ...t, enabled_features: features } : t));
    setFeaturePanel(null);
  };

  const stats = {
    total:     tenants.length,
    active:    tenants.filter((t) => t.status === 'active').length,
    suspended: tenants.filter((t) => t.status === 'suspended').length,
    waba:      tenants.filter((t) => t.waba_connected).length,
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-6" style={{ animation: 'fadeIn 0.3s ease-out' }}>

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

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Clients',  value: stats.total,     color: '#AFA9EC' },
          { label: 'Active',         value: stats.active,    color: '#1D9E75' },
          { label: 'Suspended',      value: stats.suspended, color: '#f87171' },
          { label: 'WABA Connected', value: stats.waba,      color: '#53BDEB' },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl p-4"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)' }}>
            <p className="text-2xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            <p className="text-3xl font-black mt-1" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden"
        style={{ border: '1px solid var(--bg-border)', background: 'var(--bg-card)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--bg-border)' }}>
                {['Client', 'Admin', 'Plan', 'Status', 'WABA', 'Users', 'Features', 'Joined', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-2xs font-bold uppercase tracking-wider whitespace-nowrap"
                    style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--bg-border)' }}>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {[180, 140, 70, 80, 100, 50, 120, 90, 140].map((w, j) => (
                      <td key={j} className="px-4 py-3.5">
                        <div className="h-3 rounded" style={{ width: w, background: 'var(--bg-elevated)' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : tenants.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center" style={{ color: 'var(--text-muted)' }}>
                    <div className="flex flex-col items-center gap-3">
                      <span className="text-4xl opacity-10">🏢</span>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>No clients yet</p>
                      <p className="text-xs">Click "Add New Client" to onboard your first client.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                tenants.map((t) => (
                  <tr key={t.id}
                    className="transition-colors"
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

                    {/* Admin email */}
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
                          {(t.enabled_features || []).slice(0, 4).map((f) => (
                            <span key={f} className="text-2xs px-1.5 py-0.5 rounded font-medium"
                              style={{ background: 'rgba(83,74,183,0.1)', color: '#AFA9EC' }}>
                              {f}
                            </span>
                          ))}
                          {(t.enabled_features || []).length > 4 && (
                            <span className="text-2xs" style={{ color: 'var(--text-muted)' }}>
                              +{t.enabled_features.length - 4}
                            </span>
                          )}
                        </div>
                        <span className="text-2xs" style={{ color: '#AFA9EC' }}>✎</span>
                      </button>
                    </td>

                    {/* Joined */}
                    <td className="px-4 py-3.5 whitespace-nowrap"
                      style={{ color: 'var(--text-secondary)' }}>
                      {fmtDate(t.created_at)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {/* Impersonate — UI shell, Phase 2 */}
                        <button
                          title="Impersonate (Phase 2)"
                          className="h-7 px-2.5 rounded-lg text-2xs font-semibold transition-all hover:opacity-80 opacity-40 cursor-not-allowed"
                          style={{ background: 'rgba(83,74,183,0.12)', color: '#AFA9EC', border: '1px solid rgba(83,74,183,0.2)' }}>
                          👤 Login as
                        </button>

                        {/* Suspend / Activate */}
                        <button
                          disabled={suspending === t.id}
                          onClick={() => handleSuspend(t)}
                          className="h-7 px-2.5 rounded-lg text-2xs font-semibold transition-all hover:opacity-80 disabled:opacity-50"
                          style={t.status === 'active'
                            ? { background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }
                            : { background: 'rgba(29,158,117,0.08)', color: '#1D9E75', border: '1px solid rgba(29,158,117,0.2)' }}>
                          {suspending === t.id ? '…' : t.status === 'active' ? 'Suspend' : 'Activate'}
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

      {/* Modals */}
      {showAdd && (
        <AddTenantModal
          onClose={() => setShowAdd(false)}
          onCreated={load}
        />
      )}

      {featurePanel && (
        <FeaturePanel
          tenantId={featurePanel.id}
          initialFeatures={featurePanel.features}
          onSave={(features) => handleFeaturesUpdated(featurePanel.id, features)}
          onClose={() => setFeaturePanel(null)}
        />
      )}
    </div>
  );
}
