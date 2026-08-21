/**
 * VDAJ Services — SettingsPage (Tier 4)
 * Route: /settings
 *
 * Tabs:
 *  1. Account        — business name, timezone, country
 *  2. WhatsApp       — WABA health, phone, quality rating, tier
 *  3. Team           — member list + invite modal
 *  4. Compliance     — opt-in breakdown, opt-out rate, WABA quality tracker
 */

import React, { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { tenantApi } from '../lib/api';
import { showSuccess, showError } from '../components/atoms/Toast/Toast.jsx';
import useAuthStore from '../store/authStore';

// ── Helpers ──────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function Skeleton({ className }) {
  return (
    <div className={clsx('animate-pulse rounded-xl', className)}
      style={{ background: 'var(--bg-elevated)' }} />
  );
}

// ── Section card ──────────────────────────────────────────────
function Section({ title, subtitle, children, action }) {
  return (
    <div className="rounded-2xl border overflow-hidden"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--bg-border)' }}>
      <div className="flex items-center justify-between px-5 py-4 border-b"
        style={{ borderColor: 'var(--bg-border)', background: 'var(--bg-elevated)' }}>
        <div>
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
          {subtitle && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ── Form input ────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, disabled }) {
  return (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className="h-10 rounded-xl px-3 text-sm outline-none w-full disabled:opacity-50"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)' }}
    />
  );
}

// ── Quality rating badge ───────────────────────────────────────
const RATING_CFG = {
  GREEN:  { color: '#1D9E75', bg: 'rgba(29,158,117,0.12)', emoji: '🟢' },
  YELLOW: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', emoji: '🟡' },
  RED:    { color: '#f87171', bg: 'rgba(239,68,68,0.12)',  emoji: '🔴' },
};
const TIER_LABEL = { 1: '1,000', 2: '10,000', 3: '100,000', 4: 'Unlimited' };

function QualityBadge({ rating }) {
  const c = RATING_CFG[rating] || RATING_CFG.GREEN;
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold"
      style={{ background: c.bg, color: c.color }}>
      {c.emoji} {rating}
    </span>
  );
}

// ── Role badge ────────────────────────────────────────────────
function RoleBadge({ role }) {
  const cfg = {
    super_admin:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: 'Super Admin' },
    tenant_admin: { color: '#AFA9EC', bg: 'rgba(83,74,183,0.12)',  label: 'Admin' },
    tenant_user:  { color: '#1D9E75', bg: 'rgba(29,158,117,0.12)', label: 'Agent' },
  };
  const c = cfg[role] || cfg.tenant_user;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-bold"
      style={{ background: c.bg, color: c.color }}>
      {c.label}
    </span>
  );
}

// ── Invite Modal ──────────────────────────────────────────────
function InviteModal({ onClose, onInvited }) {
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '', role: 'tenant_user' });
  const [sending, setSending] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.email) { showError('Email is required.'); return; }
    setSending(true);
    try {
      const res = await tenantApi.invite(form);
      showSuccess('Invitation sent!');
      onInvited(res.data);
      onClose();
    } catch {} finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-scale-in"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: 'var(--bg-border)' }}>
          <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Invite Team Member</h2>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center hover:opacity-70"
            style={{ background: 'var(--bg-elevated)' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2} style={{ color: 'var(--text-muted)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <Field label="Email *">
            <TextInput value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="colleague@example.com" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="First Name">
              <TextInput value={form.firstName} onChange={(e) => set('firstName', e.target.value)} placeholder="Jane" />
            </Field>
            <Field label="Last Name">
              <TextInput value={form.lastName} onChange={(e) => set('lastName', e.target.value)} placeholder="Doe" />
            </Field>
          </div>
          <Field label="Role">
            <select value={form.role} onChange={(e) => set('role', e.target.value)}
              className="h-10 rounded-xl px-3 text-sm outline-none w-full"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)' }}>
              <option value="tenant_user">Agent — can view and reply in inbox</option>
              <option value="tenant_admin">Admin — full access to all features</option>
            </select>
          </Field>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t"
          style={{ borderColor: 'var(--bg-border)', background: 'var(--bg-elevated)' }}>
          <button onClick={onClose}
            className="h-10 px-4 rounded-xl text-sm font-semibold hover:opacity-70"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)', color: 'var(--text-secondary)' }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={sending}
            className="h-10 px-5 rounded-xl text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50 transition-all"
            style={{ background: 'linear-gradient(135deg,#534AB7,#3B3499)' }}>
            {sending ? 'Sending…' : 'Send Invite'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Simple horizontal bar chart for opt-in sources ────────────
function SourceBar({ label, count, total, color }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium capitalize" style={{ color: 'var(--text-primary)' }}>
          {label?.replace(/_/g, ' ') || 'Unknown'}
        </span>
        <span className="font-bold tabular-nums" style={{ color }}>
          {count.toLocaleString()} ({pct}%)
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// ── TIMEZONES (abbreviated list) ──────────────────────────────
const TIMEZONES = [
  'Asia/Kolkata', 'UTC', 'America/New_York', 'America/Chicago',
  'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Dubai',
  'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney', 'Africa/Lagos',
];

// ── Tab component ─────────────────────────────────────────────
function Tab({ label, icon, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all',
        active ? '' : 'hover:opacity-80'
      )}
      style={active
        ? { background: '#534AB7', color: '#fff', boxShadow: '0 2px 8px rgba(83,74,183,0.4)' }
        : { background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
    >
      {icon}
      {label}
    </button>
  );
}

// ══════════════════════════════════════════════════════════════
// Main SettingsPage
// ══════════════════════════════════════════════════════════════
export default function SettingsPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('account');

  // ── Account tab state ──────────────────────────────────────
  const [accountForm, setAccountForm] = useState({ name: '', timezone: 'Asia/Kolkata', country_code: 'IN' });
  const [accountLoading, setAccountLoading] = useState(true);
  const [accountSaving,  setAccountSaving]  = useState(false);

  // ── WhatsApp tab state ─────────────────────────────────────
  const [waba, setWaba] = useState(null);
  const [wabaLoading, setWabaLoading] = useState(true);

  // ── Team tab state ─────────────────────────────────────────
  const [team, setTeam]           = useState([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [inviteOpen, setInviteOpen]   = useState(false);

  // ── Compliance tab state ───────────────────────────────────
  const [compliance, setCompliance]       = useState(null);
  const [complianceLoading, setComplianceLoading] = useState(false);

  // ── Load account on mount ──────────────────────────────────
  useEffect(() => {
    tenantApi.me({ silent: true })
      .then((res) => {
        const t = res?.data;
        if (t) setAccountForm({
          name: t.name || '',
          timezone: t.timezone || 'Asia/Kolkata',
          country_code: t.country_code || 'IN',
        });
      })
      .catch(() => {})
      .finally(() => setAccountLoading(false));
  }, []);

  // ── Load WABA ──────────────────────────────────────────────
  useEffect(() => {
    tenantApi.wabaHealth({ silent: true })
      .then((res) => setWaba(res?.data || null))
      .catch(() => {})
      .finally(() => setWabaLoading(false));
  }, []);

  // ── Lazy load on tab switch ────────────────────────────────
  useEffect(() => {
    if (activeTab === 'team' && team.length === 0 && !teamLoading) {
      setTeamLoading(true);
      tenantApi.team()
        .then((res) => setTeam(res?.data || []))
        .catch(() => {})
        .finally(() => setTeamLoading(false));
    }
    if (activeTab === 'compliance' && !compliance && !complianceLoading) {
      setComplianceLoading(true);
      tenantApi.compliance()
        .then((res) => setCompliance(res?.data || null))
        .catch(() => {})
        .finally(() => setComplianceLoading(false));
    }
  }, [activeTab]); // eslint-disable-line

  const saveAccount = async () => {
    setAccountSaving(true);
    try {
      await tenantApi.updateAccount(accountForm);
      showSuccess('Settings saved.');
    } catch {} finally { setAccountSaving(false); }
  };

  const isSuperAdmin = user?.role === 'super_admin';

  const TABS = [
    {
      id: 'account',
      label: 'Account',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12.05 2.049C6.495 2.049 2 6.545 2 12.1c0 1.784.47 3.458 1.292 4.913L2 22l5.237-1.373A9.99 9.99 0 0012.05 22c5.554 0 10.05-4.495 10.05-10.05S17.604 2.049 12.05 2.049z"/>
        </svg>
      ),
    },
    {
      id: 'team',
      label: 'Team',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      id: 'compliance',
      label: 'Compliance',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
  ];

  // Source bar colors
  const SOURCE_COLORS = ['#534AB7', '#1D9E75', '#60a5fa', '#f59e0b', '#f87171', '#34d399'];

  return (
    <div className="max-w-4xl mx-auto space-y-6" style={{ animation: 'fadeIn 0.3s ease-out' }}>

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>Settings</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Account, WhatsApp connection, team management, and compliance audit.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-2 flex-wrap p-1 rounded-2xl"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)' }}>
        {TABS.filter((t) => !(t.id === 'account' && isSuperAdmin)).map((tab) => (
          <Tab
            key={tab.id}
            label={tab.label}
            icon={tab.icon}
            active={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          />
        ))}
      </div>

      {/* ── Tab: Account ────────────────────────────────────── */}
      {activeTab === 'account' && (
        <Section title="Account Settings" subtitle="Update your business profile">
          {accountLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : (
            <div className="space-y-4">
              <Field label="Business Name">
                <TextInput
                  value={accountForm.name}
                  onChange={(e) => setAccountForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Your Business Name"
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Timezone">
                  <select
                    value={accountForm.timezone}
                    onChange={(e) => setAccountForm((f) => ({ ...f, timezone: e.target.value }))}
                    className="h-10 rounded-xl px-3 text-sm outline-none"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)' }}
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Country">
                  <select
                    value={accountForm.country_code}
                    onChange={(e) => setAccountForm((f) => ({ ...f, country_code: e.target.value }))}
                    className="h-10 rounded-xl px-3 text-sm outline-none"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)' }}
                  >
                    {[
                      ['IN', 'India'], ['US', 'United States'], ['GB', 'United Kingdom'],
                      ['AE', 'UAE'], ['SG', 'Singapore'], ['AU', 'Australia'],
                      ['NG', 'Nigeria'], ['ZA', 'South Africa'], ['BR', 'Brazil'],
                    ].map(([code, name]) => (
                      <option key={code} value={code}>{name}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  onClick={saveAccount}
                  disabled={accountSaving}
                  className="h-10 px-6 rounded-xl text-sm font-bold text-white transition-all hover:brightness-110 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#534AB7,#3B3499)' }}>
                  {accountSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}
        </Section>
      )}

      {/* ── Tab: WhatsApp ────────────────────────────────────── */}
      {activeTab === 'whatsapp' && (
        <div className="space-y-4">
          {wabaLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-32" />
              <Skeleton className="h-24" />
            </div>
          ) : !waba?.waba_connected ? (
            <Section title="WhatsApp Business Account">
              <div className="py-8 flex flex-col items-center gap-3 text-center">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  No WhatsApp Business Account connected.
                </p>
                <a href="/whatsapp-setup"
                  className="h-10 px-5 rounded-xl text-sm font-bold text-white inline-flex items-center gap-2 hover:brightness-110 transition-all"
                  style={{ background: 'linear-gradient(135deg,#25D366,#128C7E)' }}>
                  Connect WABA →
                </a>
              </div>
            </Section>
          ) : (
            <>
              <Section title="Account Details">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'WABA ID',         value: waba.waba_id || '—' },
                    { label: 'Phone Number ID',  value: waba.phone_number_id || '—' },
                    { label: 'Display Phone',    value: waba.display_phone_number || '—' },
                    { label: 'Verified Name',    value: waba.verified_name || '—' },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-2xs font-semibold uppercase tracking-wider mb-1"
                        style={{ color: 'var(--text-muted)' }}>{label}</p>
                      <p className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{value}</p>
                    </div>
                  ))}
                </div>
              </Section>

              <Section title="Quality & Messaging Tier">
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1">
                    <p className="text-2xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-muted)' }}>Quality Rating</p>
                    <QualityBadge rating={waba.quality_rating || 'GREEN'} />
                    {(waba.quality_rating === 'YELLOW' || waba.quality_rating === 'RED') && (
                      <p className="text-2xs mt-1" style={{ color: '#f59e0b' }}>
                        {waba.quality_rating === 'RED'
                          ? '⚠ Action required — reduce opt-outs and blocked messages immediately.'
                          : '⚠ At risk — reduce message volume and improve template quality.'}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-2xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-muted)' }}>Messaging Tier</p>
                    <p className="text-2xl font-black" style={{ color: '#534AB7' }}>
                      Tier {waba.messaging_tier || 1}
                    </p>
                    <p className="text-2xs" style={{ color: 'var(--text-muted)' }}>
                      {TIER_LABEL[waba.messaging_tier || 1]} msgs/day
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-2xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-muted)' }}>Sent Today</p>
                    <p className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
                      {(waba.msgs_sent_today || 0).toLocaleString()}
                    </p>
                    <p className="text-2xs" style={{ color: 'var(--text-muted)' }}>
                      of {(waba.daily_limit || 1000).toLocaleString()} limit
                    </p>
                  </div>
                </div>
              </Section>
            </>
          )}
        </div>
      )}

      {/* ── Tab: Team ────────────────────────────────────────── */}
      {activeTab === 'team' && (
        <Section
          title="Team Members"
          subtitle={`${team.length} member${team.length !== 1 ? 's' : ''}`}
          action={
            <button
              onClick={() => setInviteOpen(true)}
              className="flex items-center gap-2 h-9 px-4 rounded-xl text-xs font-bold text-white transition-all hover:brightness-110"
              style={{ background: 'linear-gradient(135deg,#534AB7,#3B3499)' }}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Invite Member
            </button>
          }
        >
          {teamLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : team.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
              No team members yet. Invite your first colleague!
            </p>
          ) : (
            <div className="space-y-2">
              {team.map((member) => (
                <div key={member.id}
                  className="flex items-center gap-4 px-4 py-3 rounded-xl"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}>
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ background: '#534AB7' }}>
                    {(member.first_name?.[0] || member.email?.[0] || '?').toUpperCase()}
                  </div>
                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {[member.first_name, member.last_name].filter(Boolean).join(' ') || member.email}
                    </p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{member.email}</p>
                  </div>
                  {/* Role */}
                  <RoleBadge role={member.role} />
                  {/* Joined */}
                  <p className="text-2xs shrink-0" style={{ color: 'var(--text-muted)' }}>
                    Joined {fmtDate(member.created_at)}
                  </p>
                  {/* Current user indicator */}
                  {member.id === user?.id && (
                    <span className="text-2xs font-bold px-2 py-0.5 rounded-full shrink-0"
                      style={{ background: 'rgba(29,158,117,0.12)', color: '#1D9E75' }}>
                      You
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* ── Tab: Compliance ──────────────────────────────────── */}
      {activeTab === 'compliance' && (
        <div className="space-y-4">
          {complianceLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-40" />
              <Skeleton className="h-32" />
            </div>
          ) : !compliance ? (
            <Section title="Compliance Audit">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Unable to load compliance data.
              </p>
            </Section>
          ) : (
            <>
              {/* Opt-In Consent Breakdown */}
              <Section title="Opt-In Consent Breakdown"
                subtitle={`${(compliance.total_contacts - compliance.contacts_missing_optin).toLocaleString()} of ${compliance.total_contacts.toLocaleString()} contacts have recorded consent`}>
                {compliance.opt_in_breakdown.length === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    No consent data recorded yet. Use the CSV importer or webhook opt-in tracking.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {compliance.opt_in_breakdown.map((row, i) => (
                      <SourceBar
                        key={row.source}
                        label={row.source}
                        count={parseInt(row.count, 10)}
                        total={compliance.total_contacts - compliance.contacts_missing_optin}
                        color={SOURCE_COLORS[i % SOURCE_COLORS.length]}
                      />
                    ))}
                  </div>
                )}
                {compliance.contacts_missing_optin > 0 && (
                  <div className="mt-4 rounded-xl p-3"
                    style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
                    <p className="text-xs font-semibold" style={{ color: '#f59e0b' }}>
                      ⚠ {compliance.contacts_missing_optin.toLocaleString()} active contacts have no opt-in recorded.
                      Per Meta BSP policy, you should not send marketing messages to these contacts.
                    </p>
                  </div>
                )}
              </Section>

              {/* Opt-Out Rate */}
              <Section title="Opt-Out Rate">
                <div className="flex items-center gap-8 flex-wrap">
                  <div>
                    <p className="text-4xl font-black"
                      style={{ color: compliance.opt_out_rate_pct > 5 ? '#f87171' : compliance.opt_out_rate_pct > 2 ? '#f59e0b' : '#1D9E75' }}>
                      {compliance.opt_out_rate_pct}%
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      {compliance.opted_out_count.toLocaleString()} out of {compliance.total_contacts.toLocaleString()} contacts
                    </p>
                  </div>
                  <div className="flex-1 space-y-2">
                    {compliance.opt_out_rate_pct <= 2 && (
                      <div className="rounded-xl p-3"
                        style={{ background: 'rgba(29,158,117,0.08)', border: '1px solid rgba(29,158,117,0.2)' }}>
                        <p className="text-xs font-semibold" style={{ color: '#1D9E75' }}>
                          🟢 Excellent — opt-out rate is within Meta's acceptable range (&lt;2%).
                        </p>
                      </div>
                    )}
                    {compliance.opt_out_rate_pct > 2 && compliance.opt_out_rate_pct <= 5 && (
                      <div className="rounded-xl p-3"
                        style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                        <p className="text-xs font-semibold" style={{ color: '#f59e0b' }}>
                          🟡 Elevated — opt-out rate &gt;2% may affect your quality rating. Review template relevance and consent quality.
                        </p>
                      </div>
                    )}
                    {compliance.opt_out_rate_pct > 5 && (
                      <div className="rounded-xl p-3"
                        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                        <p className="text-xs font-semibold" style={{ color: '#f87171' }}>
                          🔴 Critical — opt-out rate &gt;5% puts your WABA at risk. Pause marketing campaigns and review consent sources immediately.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </Section>

              {/* WABA Quality Score Tracker */}
              <Section title="WABA Quality Score Tracker">
                <div className="flex items-center gap-6 flex-wrap">
                  <QualityBadge rating={compliance.quality_rating} />
                  <div>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Last synced:{' '}
                      {compliance.waba_health_synced_at
                        ? fmtDate(compliance.waba_health_synced_at)
                        : 'Never — syncs automatically every 6 hours'}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                  {[
                    { label: '🟢 GREEN',  desc: 'High quality — no issues' },
                    { label: '🟡 YELLOW', desc: 'At risk — reduce opt-outs' },
                    { label: '🔴 RED',    desc: 'Action required — may be restricted' },
                  ].map(({ label, desc }) => (
                    <div key={label} className="rounded-xl p-3"
                      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}>
                      <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{label}</p>
                      <p className="text-2xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                    </div>
                  ))}
                </div>
              </Section>
            </>
          )}
        </div>
      )}

      {/* Invite Modal */}
      {inviteOpen && (
        <InviteModal
          onClose={() => setInviteOpen(false)}
          onInvited={(member) => setTeam((t) => [...t, member])}
        />
      )}
    </div>
  );
}
