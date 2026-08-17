/**
 * VDAJ Services — TemplatesPage
 * Sprint 2: Fixed all invisible-text contrast bugs.
 * All text now uses CSS variable tokens (var(--text-primary / secondary / muted))
 * and explicit hex values for badge colours — works correctly in all 3 theme modes.
 */

import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { templateApi } from '../lib/api';
import { showSuccess, showError } from '../components/atoms/Toast/Toast.jsx';
import { PrimaryButton, GhostButton } from '../components/atoms/Button/Button.jsx';
import Input, { Select, Textarea } from '../components/atoms/Input/Input.jsx';

// ── Category badge styles (explicit, theme-safe) ───────────────
const CATEGORY_STYLES = {
  MARKETING: {
    bg:     'rgba(83,74,183,0.12)',
    color:  '#AFA9EC',
    border: 'rgba(83,74,183,0.3)',
  },
  UTILITY: {
    bg:     'rgba(29,158,117,0.12)',
    color:  '#1D9E75',
    border: 'rgba(29,158,117,0.3)',
  },
  AUTHENTICATION: {
    bg:     'rgba(251,191,36,0.12)',
    color:  '#fbbf24',
    border: 'rgba(251,191,36,0.3)',
  },
};

// ── Status badge styles ────────────────────────────────────────
const STATUS_STYLES = {
  APPROVED: {
    bg:     'rgba(29,158,117,0.12)',
    color:  '#1D9E75',
    border: 'rgba(29,158,117,0.3)',
    label:  'Approved',
  },
  approved: {
    bg:     'rgba(29,158,117,0.12)',
    color:  '#1D9E75',
    border: 'rgba(29,158,117,0.3)',
    label:  'Approved',
  },
  pending: {
    bg:     'rgba(251,191,36,0.12)',
    color:  '#fbbf24',
    border: 'rgba(251,191,36,0.3)',
    label:  'Pending',
  },
  PENDING: {
    bg:     'rgba(251,191,36,0.12)',
    color:  '#fbbf24',
    border: 'rgba(251,191,36,0.3)',
    label:  'Pending',
  },
  REJECTED: {
    bg:     'rgba(239,68,68,0.10)',
    color:  '#f87171',
    border: 'rgba(239,68,68,0.25)',
    label:  'Rejected',
  },
  rejected: {
    bg:     'rgba(239,68,68,0.10)',
    color:  '#f87171',
    border: 'rgba(239,68,68,0.25)',
    label:  'Rejected',
  },
};

// ── Badge component ────────────────────────────────────────────
function Badge({ style, children }) {
  return (
    <span
      className="inline-flex items-center text-2xs font-semibold px-2 py-0.5 rounded-full"
      style={{
        background: style?.bg    || 'var(--bg-elevated)',
        color:      style?.color || 'var(--text-muted)',
        border:     `1px solid ${style?.border || 'var(--bg-border)'}`,
      }}
    >
      {children}
    </span>
  );
}

// ── Create / Edit Modal ────────────────────────────────────────
function CreateModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '', category: 'MARKETING', language: 'en',
    bodyText: '', headerText: '', footerText: '',
  });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    if (!form.name || !form.bodyText) return;
    setLoading(true);
    try {
      const res = await templateApi.create(form);
      showSuccess('Template submitted to Meta for approval.');
      onCreated(res.data);
      onClose();
    } catch {} finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl animate-scale-in"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: 'var(--bg-border)' }}>
          <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
            New Template
          </h2>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center hover:opacity-70"
            style={{ background: 'var(--bg-elevated)' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2}
              style={{ color: 'var(--text-muted)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          <Input
            label="Template Name"
            placeholder="e.g. order_confirmation"
            value={form.name}
            onChange={(e) => set('name', e.target.value.toLowerCase().replace(/\s/g, '_'))}
            helperText="Lowercase, underscores only."
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Category"
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
              options={[
                { value: 'MARKETING', label: 'Marketing' },
                { value: 'UTILITY', label: 'Utility' },
                { value: 'AUTHENTICATION', label: 'Authentication' },
              ]}
            />
            <Select
              label="Language"
              value={form.language}
              onChange={(e) => set('language', e.target.value)}
              options={[
                { value: 'en',    label: 'English' },
                { value: 'hi',    label: 'Hindi' },
                { value: 'pt_BR', label: 'Portuguese (BR)' },
                { value: 'ar',    label: 'Arabic' },
              ]}
            />
          </div>
          <Input
            label="Header (optional)"
            placeholder="e.g. Order Update"
            value={form.headerText}
            onChange={(e) => set('headerText', e.target.value)}
          />
          <Textarea
            label="Message Body *"
            placeholder="Use {{1}}, {{2}} for variables. e.g. Hello {{1}}, your order is ready!"
            value={form.bodyText}
            onChange={(e) => set('bodyText', e.target.value)}
            helperText="Variables must match Meta's format exactly."
          />
          <Input
            label="Footer (optional)"
            placeholder="e.g. Reply STOP to opt out"
            value={form.footerText}
            onChange={(e) => set('footerText', e.target.value)}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t"
          style={{ borderColor: 'var(--bg-border)', background: 'var(--bg-elevated)' }}>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton loading={loading} onClick={handleCreate}>
            Submit to Meta
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

// ── Template Card ──────────────────────────────────────────────
function TemplateCard({ template, onSync }) {
  const [syncing, setSyncing] = useState(false);
  const catStyle = CATEGORY_STYLES[template.category] || {};
  const statusKey = template.status?.toUpperCase() || 'PENDING';
  const statusStyle = STATUS_STYLES[statusKey] || STATUS_STYLES.PENDING;

  const handleSync = async () => {
    setSyncing(true);
    try {
      await templateApi.sync(template.id);
      showSuccess('Template status synced from Meta.');
      onSync?.(template.id);
    } catch {} finally { setSyncing(false); }
  };

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3 transition-all duration-200"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--bg-border)',
      }}
      onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(83,74,183,0.4)'}
      onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--bg-border)'}
    >
      {/* Card header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold font-mono truncate"
            style={{ color: 'var(--text-primary)' }}>
            {template.name}
          </p>
          <p className="text-2xs mt-0.5"
            style={{ color: 'var(--text-muted)' }}>
            {template.language}
            {template.meta_template_id && ` · ID: ${template.meta_template_id}`}
          </p>
        </div>
        <div className="flex gap-1.5 shrink-0 flex-wrap justify-end">
          <Badge style={catStyle}>{template.category}</Badge>
          <Badge style={statusStyle}>{statusStyle.label}</Badge>
        </div>
      </div>

      {/* Body preview */}
      <div className="rounded-xl px-3 py-2.5"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}>
        <p className="text-xs leading-relaxed font-mono line-clamp-3"
          style={{ color: 'var(--text-secondary)' }}>
          {template.body_text || template.components?.[0]?.text || 'No body defined.'}
        </p>
      </div>

      {/* Footer: timestamp + sync button */}
      <div className="flex items-center justify-between mt-auto">
        <p className="text-2xs" style={{ color: 'var(--text-muted)' }}>
          {new Date(template.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
        {statusKey !== 'APPROVED' && (
          <button
            onClick={handleSync}
            disabled={syncing}
            className="text-2xs font-semibold px-2.5 py-1 rounded-lg transition-all hover:opacity-70 disabled:opacity-40"
            style={{
              background: 'rgba(83,74,183,0.12)',
              color: '#AFA9EC',
              border: '1px solid rgba(83,74,183,0.25)',
            }}>
            {syncing ? 'Syncing…' : '↻ Sync Status'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────
function EmptyState({ onNew }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)' }}>
      <svg className="w-12 h-12 mb-4 opacity-20" fill="none" viewBox="0 0 24 24"
        stroke="currentColor" strokeWidth={1.2} style={{ color: 'var(--text-primary)' }}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
        No templates yet
      </p>
      <p className="text-xs mt-1 mb-6" style={{ color: 'var(--text-muted)' }}>
        Create a template and submit it to Meta for approval.
      </p>
      <PrimaryButton onClick={onNew}>Create First Template</PrimaryButton>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export default function TemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [creating, setCreating]   = useState(false);

  useEffect(() => {
    templateApi.list()
      .then((r) => setTemplates(r?.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSync = (id) => {
    // Reload single template status after sync
    templateApi.list()
      .then((r) => setTemplates(r?.data || []))
      .catch(() => {});
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6" style={{ animation: 'fadeIn 0.3s ease-out' }}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
            Templates
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Meta-approved message templates for your campaigns.
          </p>
        </div>
        <PrimaryButton
          onClick={() => setCreating(true)}
          leftIcon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          }
        >
          New Template
        </PrimaryButton>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-2xl"
              style={{ background: 'var(--bg-elevated)' }} />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <EmptyState onNew={() => setCreating(true)} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((t) => (
            <TemplateCard key={t.id} template={t} onSync={handleSync} />
          ))}
        </div>
      )}

      {/* Create Modal */}
      {creating && (
        <CreateModal
          onClose={() => setCreating(false)}
          onCreated={(t) => { setTemplates((ts) => [t, ...ts]); setCreating(false); }}
        />
      )}
    </div>
  );
}
