/**
 * VDAJ Services — SettingsPage
 * Route: /settings
 *
 * Streamlined Settings focused on:
 *  1. WhatsApp Configuration — Meta WABA health, live connection status, verified name, messaging tier,
 *     and full customer-facing WhatsApp Business Profile (Meta CDN logo upload, description, category, websites).
 *  2. Organization Profile   — Business Name, Timezone, Country, Workspace ID.
 *
 * Team and Compliance have been promoted to dedicated pages (/team and /compliance).
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b"
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
  const norm = (rating || 'GREEN').toUpperCase();
  const c = RATING_CFG[norm] || RATING_CFG.GREEN;
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
      style={{ background: c.bg, color: c.color }}>
      {c.emoji} {norm}
    </span>
  );
}

function NameStatusBadge({ status }) {
  const norm = (status || 'APPROVED').toUpperCase();
  const cfg = {
    APPROVED:                 { bg: '#E6F7F1', text: '#065F46', border: '#A7F3D0', label: 'Approved' },
    AVAILABLE_WITHOUT_REVIEW: { bg: '#E6F7F1', text: '#065F46', border: '#A7F3D0', label: 'Verified' },
    PENDING_REVIEW:           { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A', label: 'Pending Review' },
    DECLINED:                 { bg: '#FFE4E6', text: '#9F1239', border: '#FECDD3', label: 'Declined' },
    EXPIRED:                  { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1', label: 'Expired' },
  };
  const c = cfg[norm] || cfg.APPROVED;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ml-2"
      style={{ background: c.bg, color: c.text, borderColor: c.border }}>
      {c.label}
    </span>
  );
}

function ConnectionBadge({ status }) {
  const norm = (status || 'CONNECTED').toUpperCase();
  const isConnected = norm === 'CONNECTED';
  return (
    <span className={clsx(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ml-2",
      isConnected
        ? "bg-[#E6F7F1] text-[#065F46] border-[#A7F3D0]"
        : "bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]"
    )}>
      <span className={clsx("w-1.5 h-1.5 rounded-full", isConnected ? "bg-[#1D9E75]" : "bg-[#D97706]")} />
      {isConnected ? 'Connected' : 'Pending'}
    </span>
  );
}

const VERTICALS = [
  { value: 'PROF_SERVICES', label: 'Professional Services' },
  { value: 'FITNESS',       label: 'Health & Fitness / Sports' },
  { value: 'ENTERTAIN',     label: 'Entertainment & Recreation' },
  { value: 'EDUCATION',     label: 'Education' },
  { value: 'HEALTH',        label: 'Healthcare & Medical' },
  { value: 'RETAIL',        label: 'Retail & Shopping' },
  { value: 'RESTAURANT',    label: 'Restaurant & Hospitality' },
  { value: 'TRAVEL',        label: 'Travel & Transportation' },
  { value: 'OTHER',         label: 'Other / Business' },
];

const TIMEZONES = [
  'Asia/Kolkata', 'UTC', 'America/New_York', 'America/Chicago',
  'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Dubai',
  'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney', 'Africa/Lagos',
];

// ── Edit WABA Details Modal ───────────────────────────────────
function EditWabaModal({ initialData, onClose, onUpdated }) {
  const [form, setForm] = useState({
    waba_id: initialData?.waba_id || '',
    phone_number_id: initialData?.phone_number_id || '',
    display_phone_number: initialData?.display_phone_number || '',
    verified_name: initialData?.verified_name || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await tenantApi.updateAccount(form);
      showSuccess('WhatsApp credentials updated.');
      onUpdated();
      onClose();
    } catch (err) {
      showError(err?.response?.data?.message || err?.message || 'Failed to update details.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full h-10 rounded-xl px-3 text-sm outline-none transition-all font-mono";
  const inputStyle = { background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: 'var(--bg-border)', background: 'var(--bg-elevated)' }}>
          <div className="flex items-center gap-2.5">
            <span className="text-lg">💬</span>
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Edit WhatsApp Credentials</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Configure Meta WABA ID & Phone Number ID</p>
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center hover:opacity-70 transition-opacity"
            style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}>
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs">
          <div>
            <label className="block font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
              WhatsApp Business Account ID (WABA ID) *
            </label>
            <input
              type="text"
              required
              value={form.waba_id}
              onChange={(e) => setForm((p) => ({ ...p, waba_id: e.target.value }))}
              placeholder="e.g. 110682885408990"
              className={inputClass}
              style={inputStyle}
            />
          </div>

          <div>
            <label className="block font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
              Phone Number ID *
            </label>
            <input
              type="text"
              required
              value={form.phone_number_id}
              onChange={(e) => setForm((p) => ({ ...p, phone_number_id: e.target.value }))}
              placeholder="e.g. 1446611171861825"
              className={inputClass}
              style={inputStyle}
            />
          </div>

          <div>
            <label className="block font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
              Display Phone Number
            </label>
            <input
              type="text"
              value={form.display_phone_number}
              onChange={(e) => setForm((p) => ({ ...p, display_phone_number: e.target.value }))}
              placeholder="e.g. +91 99703 64001"
              className={inputClass}
              style={inputStyle}
            />
          </div>

          <div>
            <label className="block font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
              Verified Business Name
            </label>
            <input
              type="text"
              value={form.verified_name}
              onChange={(e) => setForm((p) => ({ ...p, verified_name: e.target.value }))}
              placeholder="e.g. SMR Swimming Pool and Health Club"
              className={clsx(inputClass, 'font-sans')}
              style={inputStyle}
            />
          </div>

          <div>
            <label className="block font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
              Meta System User Access Token (Permanent Token)
            </label>
            <input
              type="password"
              value={form.meta_system_token || ''}
              onChange={(e) => setForm((p) => ({ ...p, meta_system_token: e.target.value }))}
              placeholder="Paste permanent token (leave blank to keep current)"
              className={inputClass}
              style={inputStyle}
            />
            <p className="text-[10px] text-[#94A3B8] mt-1 leading-normal">
              To prevent session expiry, generate a permanent System User Token in Meta Business Suite &rarr; Users &rarr; System Users with permissions: <strong>whatsapp_business_messaging</strong>, <strong>whatsapp_business_management</strong>.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t"
          style={{ borderColor: 'var(--bg-border)', background: 'var(--bg-elevated)' }}>
          <button type="button" onClick={onClose}
            className="h-9 px-4 rounded-xl text-xs font-semibold hover:opacity-70 transition-opacity"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)', color: 'var(--text-secondary)' }}>
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="h-9 px-5 rounded-xl text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            style={{ background: '#534AB7' }}>
            {saving ? 'Saving…' : 'Save Details'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Main SettingsPage
// ══════════════════════════════════════════════════════════════
export default function SettingsPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Route any legacy tab queries cleanly
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'team') navigate('/team', { replace: true });
    if (tab === 'compliance') navigate('/compliance', { replace: true });
  }, [searchParams, navigate]);

  const [activeTab, setActiveTab] = useState('whatsapp');

  // ── Account tab state ──────────────────────────────────────
  const [accountForm, setAccountForm] = useState({ name: '', timezone: 'Asia/Kolkata', country_code: 'IN' });
  const [tenantProfile, setTenantProfile] = useState(null);
  const [accountLoading, setAccountLoading] = useState(true);
  const [accountSaving,  setAccountSaving]  = useState(false);

  // ── WhatsApp tab state ─────────────────────────────────────
  const [waba, setWaba] = useState(null);
  const [wabaLoading, setWabaLoading] = useState(true);
  const [wabaSyncing, setWabaSyncing] = useState(false);
  const [editWabaOpen, setEditWabaOpen] = useState(false);

  // ── WhatsApp Business Profile state (Meta CDN) ─────────────
  const [profile, setProfile] = useState({
    about: '',
    description: '',
    address: '',
    email: '',
    vertical: 'OTHER',
    websites: ['', ''],
    profile_picture_url: '',
  });
  const [profileLoading,  setProfileLoading]  = useState(false);
  const [profileSaving,   setProfileSaving]   = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef(null);

  // ── Load account & WABA ────────────────────────────────────
  const loadAccount = useCallback(() => {
    setAccountLoading(true);
    tenantApi.me({ silent: true })
      .then((res) => {
        const t = res?.data;
        if (t) {
          setTenantProfile(t);
          setAccountForm({
            name: t.name || '',
            timezone: t.timezone || 'Asia/Kolkata',
            country_code: t.country_code || 'IN',
          });
        }
      })
      .catch(() => {})
      .finally(() => setAccountLoading(false));
  }, []);

  const loadWaba = useCallback(() => {
    setWabaLoading(true);
    tenantApi.wabaHealth({ silent: true })
      .then((res) => setWaba(res?.data || null))
      .catch(() => {})
      .finally(() => setWabaLoading(false));
  }, []);

  const handleSyncWaba = async () => {
    setWabaSyncing(true);
    try {
      const res = await tenantApi.wabaHealthSync();
      const updated = res?.data || res;
      setWaba((prev) => ({ ...prev, ...updated }));
      showSuccess('Synced live WhatsApp account status & verified name from Meta!');
    } catch (err) {
      showError(err?.message || 'Failed to sync with Meta.');
    } finally {
      setWabaSyncing(false);
    }
  };

  const loadProfile = useCallback(() => {
    setProfileLoading(true);
    tenantApi.getProfile({ silent: true })
      .then((res) => {
        const p = res?.data || {};
        setProfile({
          about: p.about || '',
          description: p.description || '',
          address: p.address || '',
          email: p.email || '',
          vertical: p.vertical || 'OTHER',
          websites: Array.isArray(p.websites) ? [p.websites[0] || '', p.websites[1] || ''] : ['', ''],
          profile_picture_url: p.profile_picture_url || '',
        });
      })
      .catch(() => {})
      .finally(() => setProfileLoading(false));
  }, []);

  const handleSaveProfile = async (e) => {
    e?.preventDefault();
    setProfileSaving(true);
    try {
      const payload = {
        about: profile.about.trim(),
        description: profile.description.trim(),
        address: profile.address.trim(),
        email: profile.email.trim(),
        vertical: profile.vertical,
        websites: profile.websites.map((w) => w.trim()).filter(Boolean),
      };
      await tenantApi.updateProfile(payload);
      showSuccess('WhatsApp Business Profile saved directly to Meta!');
    } catch (err) {
      showError(err?.message || 'Failed to update WhatsApp profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleAvatarFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      showError('Please select a JPG or PNG image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showError('File must be smaller than 5MB.');
      return;
    }

    setAvatarUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      await tenantApi.uploadAvatar(fd);
      showSuccess('Profile photo uploaded directly to Meta CDN!');
      loadProfile();
    } catch (err) {
      showError(err?.message || 'Failed to upload photo to Meta.');
    } finally {
      setAvatarUploading(false);
      e.target.value = '';
    }
  };

  const saveAccount = async (e) => {
    e?.preventDefault();
    setAccountSaving(true);
    try {
      await tenantApi.updateAccount(accountForm);
      showSuccess('Organization settings saved.');
      loadAccount();
    } catch (err) {
      showError(err?.message || 'Failed to save settings.');
    } finally {
      setAccountSaving(false);
    }
  };

  useEffect(() => {
    loadAccount();
    loadWaba();
    loadProfile();
  }, [loadAccount, loadWaba, loadProfile]);

  const isSuperAdmin = user?.role === 'super_admin';

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6" style={{ animation: 'fadeIn 0.3s ease-out' }}>

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-2xl font-black text-[#0F0F0F]">Settings & Configuration</h1>
          <p className="text-sm text-[#64748B] mt-0.5">
            Manage your Meta WhatsApp Business API integration and organization profile.
          </p>
        </div>

        {/* Quick Links to Separated Modules */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/team')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[#534AB7] bg-[#F3F2FD] hover:bg-[#EEECFC] transition-colors"
          >
            <span>👥 Team Members →</span>
          </button>
          <button
            onClick={() => navigate('/compliance')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[#1D9E75] bg-[#E6F7F1] hover:bg-[#D5F2E8] transition-colors"
          >
            <span>🛡️ Compliance Audit →</span>
          </button>
        </div>
      </div>

      {/* Primary Tab Bar */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-white border border-[#E6E4F5] shadow-xs">
        <button
          onClick={() => setActiveTab('whatsapp')}
          className={clsx(
            'flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
            activeTab === 'whatsapp'
              ? 'bg-[#534AB7] text-white shadow-sm'
              : 'text-[#64748B] hover:text-[#0F0F0F] hover:bg-[#F8F7FF]'
          )}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12.05 2.049C6.495 2.049 2 6.545 2 12.1c0 1.784.47 3.458 1.292 4.913L2 22l5.237-1.373A9.99 9.99 0 0012.05 22c5.554 0 10.05-4.495 10.05-10.05S17.604 2.049 12.05 2.049z"/>
          </svg>
          <span>WhatsApp Configuration</span>
        </button>

        <button
          onClick={() => setActiveTab('account')}
          className={clsx(
            'flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
            activeTab === 'account'
              ? 'bg-[#534AB7] text-white shadow-sm'
              : 'text-[#64748B] hover:text-[#0F0F0F] hover:bg-[#F8F7FF]'
          )}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <span>Organization Profile</span>
        </button>
      </div>

      {/* ── TAB 1: WHATSAPP CONFIGURATION ── */}
      {activeTab === 'whatsapp' && (
        <div className="space-y-6">
          {wabaLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-44" />
              <Skeleton className="h-64" />
            </div>
          ) : !waba ? (
            <Section title="WhatsApp Account Connection">
              <div className="text-center py-10 space-y-3">
                <p className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
                  No WhatsApp Business Account is linked to this workspace yet.
                </p>
                {(user?.role === 'tenant_admin' || isSuperAdmin) && (
                  <button
                    onClick={() => setEditWabaOpen(true)}
                    className="inline-flex items-center gap-2 h-10 px-5 rounded-xl text-xs font-bold text-white bg-[#534AB7]"
                  >
                    Configure WhatsApp Credentials
                  </button>
                )}
              </div>
            </Section>
          ) : (
            <>
              {/* WhatsApp Account Health & Credentials */}
              <Section
                title="WhatsApp Account Health & Meta Credentials"
                subtitle="Live status, registered phone number, and quality score synced directly from Meta Graph API."
                action={
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSyncWaba}
                      disabled={wabaSyncing}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-[#F3F2FD] text-[#534AB7] border border-[#534AB7]/20 hover:bg-[#EEECFC] transition-colors disabled:opacity-50"
                      title="Sync live status and verified name from Meta"
                    >
                      <svg className={clsx("w-3.5 h-3.5", wabaSyncing && "animate-spin")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      {wabaSyncing ? 'Syncing with Meta…' : 'Sync Live Meta Status'}
                    </button>

                    {(user?.role === 'tenant_admin' || isSuperAdmin) && (
                      <button
                        onClick={() => setEditWabaOpen(true)}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-white border border-[#CBD5E1] text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
                      >
                        Edit Credentials
                      </button>
                    )}
                  </div>
                }
              >
                {/* Meta Identifiers & Live Status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] mb-5">
                  <div>
                    <p className="text-2xs font-bold text-[#64748B] uppercase tracking-wider">Business Phone</p>
                    <div className="flex items-center flex-wrap gap-1 mt-1">
                      <span className="text-sm font-bold text-[#0F172A] font-mono">
                        {waba.display_phone_number || tenantProfile?.display_phone_number || '—'}
                      </span>
                      <ConnectionBadge status={waba.connection_status} />
                    </div>
                  </div>

                  <div>
                    <p className="text-2xs font-bold text-[#64748B] uppercase tracking-wider">Verified Name</p>
                    <div className="flex items-center flex-wrap gap-1 mt-1">
                      <span className="text-sm font-bold text-[#0F172A]">
                        {waba.verified_name || tenantProfile?.verified_name || 'Pending Review'}
                      </span>
                      <NameStatusBadge status={waba.name_status} />
                    </div>
                  </div>

                  <div>
                    <p className="text-2xs font-bold text-[#64748B] uppercase tracking-wider">Phone Number ID</p>
                    <p className="text-xs font-mono text-[#0F172A] mt-1 truncate" title={waba.phone_number_id}>
                      {waba.phone_number_id || tenantProfile?.phone_number_id || '—'}
                    </p>
                  </div>

                  <div>
                    <p className="text-2xs font-bold text-[#64748B] uppercase tracking-wider">WABA ID</p>
                    <p className="text-xs font-mono text-[#0F172A] mt-1 truncate" title={waba.waba_id}>
                      {waba.waba_id || tenantProfile?.waba_id || '—'}
                    </p>
                  </div>
                </div>

                {/* Quality & Daily Sending Limit */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2">
                  <div className="flex flex-col gap-1.5">
                    <p className="text-2xs font-bold uppercase tracking-wider text-[#64748B]">Quality Rating</p>
                    <div><QualityBadge rating={waba.quality_rating} /></div>
                    <p className="text-2xs text-[#94A3B8] mt-1">
                      Last synced: {waba.synced_at ? fmtDate(waba.synced_at) : 'Active'}
                    </p>
                  </div>

                  <div className="flex flex-col gap-1">
                    <p className="text-2xs font-bold uppercase tracking-wider text-[#64748B]">Messaging Tier</p>
                    <p className="text-2xl font-black text-[#534AB7]">Tier {waba.messaging_tier || 1}</p>
                    <p className="text-2xs text-[#94A3B8]">{TIER_LABEL[waba.messaging_tier || 1]} msgs/day</p>
                  </div>

                  <div className="flex flex-col gap-1">
                    <p className="text-2xs font-bold uppercase tracking-wider text-[#64748B]">Sent Today</p>
                    <p className="text-2xl font-black text-[#0F172A]">{(waba.msgs_sent_today || 0).toLocaleString()}</p>
                    <p className="text-2xs text-[#94A3B8]">of {(waba.daily_limit || 1000).toLocaleString()} daily limit</p>
                  </div>
                </div>
              </Section>

              {/* WhatsApp Customer-Facing Business Profile (Meta CDN) */}
              <Section
                title="WhatsApp Business Profile (Meta CDN)"
                subtitle="Customer-facing profile displayed inside WhatsApp. Changes and logo uploads stream directly to Meta CDN with 0 MB VPS storage consumed."
              >
                {profileLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-16" />
                    <Skeleton className="h-28" />
                  </div>
                ) : (
                  <form onSubmit={handleSaveProfile} className="space-y-5">
                    {/* Photo Upload Row */}
                    <div className="flex items-center gap-4 p-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
                      <div className="relative shrink-0">
                        {profile.profile_picture_url ? (
                          <img
                            src={profile.profile_picture_url}
                            alt="WhatsApp Profile"
                            className="w-16 h-16 rounded-full object-cover border-2 border-[#534AB7] shadow-sm"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-[#EEECFC] text-[#534AB7] font-bold text-xl flex items-center justify-center border-2 border-[#CBD5E1]">
                            {tenantProfile?.name?.charAt(0) || 'W'}
                          </div>
                        )}
                        {avatarUploading && (
                          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                            <svg className="w-5 h-5 text-white animate-spin" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <input
                            type="file"
                            ref={avatarInputRef}
                            onChange={handleAvatarFile}
                            accept="image/jpeg,image/png"
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => avatarInputRef.current?.click()}
                            disabled={avatarUploading}
                            className="h-8 px-3 rounded-lg text-xs font-semibold bg-white border border-[#CBD5E1] text-[#0F172A] hover:bg-[#F1F5F9] transition-all cursor-pointer shadow-xs disabled:opacity-50"
                          >
                            {avatarUploading ? 'Uploading to Meta CDN…' : 'Change Profile Logo'}
                          </button>
                        </div>
                        <p className="text-2xs text-[#64748B] mt-1">
                          Recommended: Square image, min 192×192px (JPG or PNG, max 5MB). Streamed directly to Meta CDN without saving on disk.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="Business Category">
                        <select
                          value={profile.vertical}
                          onChange={(e) => setProfile((p) => ({ ...p, vertical: e.target.value }))}
                          className="h-10 rounded-xl px-3 text-sm outline-none w-full cursor-pointer"
                          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)' }}
                        >
                          {VERTICALS.map((v) => (
                            <option key={v.value} value={v.value}>{v.label}</option>
                          ))}
                        </select>
                      </Field>

                      <Field label="Customer Contact Email">
                        <TextInput
                          value={profile.email}
                          onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
                          placeholder="support@company.com"
                        />
                      </Field>
                    </div>

                    <Field label="About / Status (Shown below name on WhatsApp — max 139 characters)">
                      <div className="relative">
                        <TextInput
                          value={profile.about}
                          onChange={(e) => setProfile((p) => ({ ...p, about: e.target.value.slice(0, 139) }))}
                          placeholder="e.g. Professional fitness and aquatic wellness club."
                        />
                        <span className="absolute right-3 top-2.5 text-2xs font-mono text-[#94A3B8]">
                          {profile.about.length}/139
                        </span>
                      </div>
                    </Field>

                    <Field label="Business Description (Company profile on WhatsApp — max 512 characters)">
                      <div className="relative">
                        <textarea
                          rows={3}
                          value={profile.description}
                          onChange={(e) => setProfile((p) => ({ ...p, description: e.target.value.slice(0, 512) }))}
                          placeholder="Detailed overview of services, facilities, and working philosophy…"
                          className="rounded-xl p-3 text-sm outline-none w-full resize-none"
                          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)' }}
                        />
                        <span className="absolute right-3 bottom-2 text-2xs font-mono text-[#94A3B8]">
                          {profile.description.length}/512
                        </span>
                      </div>
                    </Field>

                    <Field label="Business Address">
                      <TextInput
                        value={profile.address}
                        onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))}
                        placeholder="Street Address, City, State, PIN"
                      />
                    </Field>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="Primary Website">
                        <TextInput
                          value={profile.websites[0] || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setProfile((p) => ({ ...p, websites: [val, p.websites[1] || ''] }));
                          }}
                          placeholder="https://yourwebsite.com"
                        />
                      </Field>

                      <Field label="Secondary Website (Optional)">
                        <TextInput
                          value={profile.websites[1] || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setProfile((p) => ({ ...p, websites: [p.websites[0] || '', val] }));
                          }}
                          placeholder="https://instagram.com/yourhandle"
                        />
                      </Field>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={profileSaving}
                        className="h-10 px-6 rounded-xl text-xs font-bold text-white transition-all shadow-sm hover:brightness-110 cursor-pointer disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg,#534AB7,#3B3499)' }}
                      >
                        {profileSaving ? 'Saving to Meta…' : 'Save WhatsApp Profile'}
                      </button>
                    </div>
                  </form>
                )}
              </Section>
            </>
          )}
        </div>
      )}

      {/* ── TAB 2: ORGANIZATION PROFILE ── */}
      {activeTab === 'account' && (
        <Section title="Organization Details" subtitle="Update workspace name, legal business identity, and local timezone.">
          {accountLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : (
            <form onSubmit={saveAccount} className="space-y-5">
              <Field label="Business Name">
                <TextInput
                  value={accountForm.name}
                  onChange={(e) => setAccountForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. SMR Swimming Pool & Health Club"
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Timezone">
                  <select
                    value={accountForm.timezone}
                    onChange={(e) => setAccountForm((p) => ({ ...p, timezone: e.target.value }))}
                    className="h-10 rounded-xl px-3 text-sm outline-none w-full cursor-pointer"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)' }}
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Country">
                  <select
                    value={accountForm.country_code}
                    onChange={(e) => setAccountForm((p) => ({ ...p, country_code: e.target.value }))}
                    className="h-10 rounded-xl px-3 text-sm outline-none w-full cursor-pointer"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)' }}
                  >
                    <option value="IN">India</option>
                    <option value="US">United States</option>
                    <option value="GB">United Kingdom</option>
                    <option value="AE">United Arab Emirates</option>
                    <option value="SG">Singapore</option>
                  </select>
                </Field>
              </div>

              {tenantProfile && (
                <div className="pt-2">
                  <p className="text-2xs font-mono text-[#9494A8]">
                    Workspace Slug: <span className="font-bold text-[#534AB7]">{tenantProfile.slug}</span> · ID: <span className="font-bold text-[#0F0F0F]">{tenantProfile.id}</span>
                  </p>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={accountSaving}
                  className="h-10 px-6 rounded-xl text-xs font-bold text-white transition-all shadow-sm hover:brightness-110 cursor-pointer disabled:opacity-50"
                  style={{ background: '#534AB7' }}
                >
                  {accountSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}
        </Section>
      )}

      {/* Edit WABA Modal */}
      {editWabaOpen && (
        <EditWabaModal
          initialData={{
            waba_id: waba?.waba_id || tenantProfile?.waba_id || '',
            phone_number_id: waba?.phone_number_id || tenantProfile?.phone_number_id || '',
            display_phone_number: waba?.display_phone_number || tenantProfile?.display_phone_number || '',
            verified_name: waba?.verified_name || tenantProfile?.verified_name || '',
          }}
          onClose={() => setEditWabaOpen(false)}
          onUpdated={() => {
            loadWaba();
            loadAccount();
            loadProfile();
          }}
        />
      )}
    </div>
  );
}
