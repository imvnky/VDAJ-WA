/**
 * VDAJ Services — CampaignsPage
 * Campaign list + Composer Modal with live WhatsApp chat preview.
 */

import React, { useState, useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { campaignApi, contactApi, templateApi } from '../lib/api';
import { showSuccess, showError } from '../components/atoms/Toast/Toast.jsx';
import Button, { PrimaryButton, DangerButton, GhostButton } from '../components/atoms/Button/Button.jsx';
import Input, { Select, Textarea } from '../components/atoms/Input/Input.jsx';

// ---- Status Badge ----
const STATUS = {
  draft:     { label: 'Draft',     cls: 'bg-surface-elevated text-aura-white/50 border-surface-border' },
  scheduled: { label: 'Scheduled', cls: 'bg-soft-aura/10 text-soft-aura border-soft-aura/30' },
  running:   { label: 'Running',   cls: 'bg-brand/20 text-soft-aura border-brand/30' },
  paused:    { label: 'Paused',    cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  completed: { label: 'Done',      cls: 'bg-signal-teal/20 text-teal-light border-signal-teal/30' },
  failed:    { label: 'Failed',    cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.draft;
  return (
    <span className={clsx('inline-flex px-2.5 py-1 rounded-full text-2xs font-bold border', s.cls)}>
      {s.label}
    </span>
  );
}

// ---- WhatsApp Message Preview ----
function WhatsAppPreview({ text }) {
  // Convert markdown to styled spans
  const render = (raw) => {
    if (!raw) return <span className="text-gray-400 text-xs italic">Your message will appear here…</span>;
    const parts = [];
    let i = 0;
    const tokens = raw.split(/(\*[^*]+\*|_[^_]+_|~[^~]+~|```[^`]+```)/g);
    return tokens.map((t, idx) => {
      if (t.startsWith('*') && t.endsWith('*')) return <strong key={idx}>{t.slice(1, -1)}</strong>;
      if (t.startsWith('_') && t.endsWith('_')) return <em key={idx}>{t.slice(1, -1)}</em>;
      if (t.startsWith('~') && t.endsWith('~')) return <s key={idx}>{t.slice(1, -1)}</s>;
      if (t.startsWith('```') && t.endsWith('```')) return <code key={idx} className="font-mono bg-black/20 rounded px-1">{t.slice(3, -3)}</code>;
      return <span key={idx}>{t}</span>;
    });
  };

  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex flex-col h-full bg-[#0B141A] rounded-2xl overflow-hidden border border-white/10">
      {/* WA Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#1F2C34]">
        <div className="w-9 h-9 rounded-full bg-brand-gradient flex items-center justify-center text-xs font-bold text-white shrink-0">C</div>
        <div>
          <p className="text-sm font-semibold text-white">Customer</p>
          <p className="text-2xs text-white/40">Online</p>
        </div>
      </div>

      {/* Chat Area */}
      <div
        className="flex-1 p-4 overflow-y-auto"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }}
      >
        {/* Message bubble */}
        <div className="flex justify-end">
          <div className="max-w-[85%] bg-[#005C4B] rounded-2xl rounded-tr-sm px-3.5 py-2.5 shadow">
            <p className="text-sm text-white leading-relaxed whitespace-pre-wrap break-words">
              {render(text)}
            </p>
            <div className="flex items-center justify-end gap-1 mt-1.5">
              <span className="text-2xs text-white/40">{time}</span>
              <svg className="w-3.5 h-3.5 text-[#53BDEB]" viewBox="0 0 16 11" fill="currentColor">
                <path d="M11.071.653a.45.45 0 0 0-.63 0L4.995 6.099l-2.1-2.1a.45.45 0 0 0-.63.63l2.415 2.414a.45.45 0 0 0 .63 0L11.07 1.29a.45.45 0 0 0 0-.637zM15.05.653a.45.45 0 0 0-.63 0L8.974 6.099l-.6-.6a.45.45 0 0 0-.63.63l.914.914a.45.45 0 0 0 .63 0L15.05 1.29a.45.45 0 0 0 0-.637z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* WA Input Bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#1F2C34]">
        <div className="flex-1 h-9 rounded-full bg-[#2A3942] flex items-center px-4">
          <span className="text-xs text-white/20">Type a message</span>
        </div>
        <div className="w-9 h-9 rounded-full bg-[#00A884] flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </div>
      </div>
    </div>
  );
}

// ---- Composer Modal ----
function ComposerModal({ onClose, onCreated, contactLists, templates }) {
  const [form, setForm] = useState({ name: '', templateId: '', contactListId: '', body: '', scheduledAt: '' });
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    if (!form.name.trim()) { showError('Campaign name is required.', 'ERR_VDAJ_VAL_005'); return; }
    setLoading(true);
    try {
      const res = await campaignApi.create({
        name: form.name,
        templateId: form.templateId || undefined,
        contactListId: form.contactListId || undefined,
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
      });
      showSuccess('Campaign created!');
      onCreated(res.data);
      onClose();
    } catch {
      // Toast fired by interceptor
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col glass-card animate-scale-in overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border shrink-0">
          <div>
            <h2 className="text-lg font-bold text-aura-white">New Campaign</h2>
            <p className="text-xs text-aura-white/40">Compose your message and configure your audience.</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-card text-aura-white/40 hover:text-aura-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Form */}
          <div className="flex-1 p-6 overflow-y-auto space-y-4 border-r border-surface-border">
            <Input
              label="Campaign Name"
              placeholder="e.g. Diwali Offer Blast"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              required
            />

            <Select
              label="Contact List (Audience)"
              placeholder="Select a contact list…"
              value={form.contactListId}
              onChange={(e) => set('contactListId', e.target.value)}
              options={contactLists.map((l) => ({ value: l.id, label: `${l.name} (${l.contact_count} contacts)` }))}
              helperText="Which group of people to send this campaign to."
            />

            <Select
              label="Message Template"
              placeholder="Select a template…"
              value={form.templateId}
              onChange={(e) => set('templateId', e.target.value)}
              options={templates.map((t) => ({ value: t.id, label: `${t.name} (${t.language})` }))}
            />

            <div>
              <Textarea
                label="Message Body"
                placeholder="Use *bold*, _italic_, ~strikethrough~, ```code``` — just like WhatsApp!"
                value={form.body}
                onChange={(e) => set('body', e.target.value)}
                helperText="Raw markdown — sent directly to Meta API. Live preview on the right →"
                className="font-mono text-xs"
              />
            </div>

            <Input
              label="Schedule (optional)"
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(e) => set('scheduledAt', e.target.value)}
              helperText="Leave blank to save as Draft. Stored in UTC, shown in your local time."
            />
          </div>

          {/* Right: WhatsApp Preview */}
          <div className="w-72 shrink-0 p-4 flex flex-col gap-3">
            <p className="text-xs font-semibold text-aura-white/40 uppercase tracking-wider">Live Preview</p>
            <div className="flex-1">
              <WhatsAppPreview text={form.body} />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-surface-border shrink-0">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={handleCreate} loading={loading}>
            Save Campaign
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

// ---- Main CampaignsPage ----
export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [contactLists, setContactLists] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState({});

  useEffect(() => {
    const load = async () => {
      try {
        const [campRes, listRes, tmplRes] = await Promise.allSettled([
          campaignApi.list({ limit: 50 }, { silent: true }),
          contactApi.lists({ silent: true }),
          templateApi.list({ silent: true }),
        ]);
        if (campRes.status === 'fulfilled') setCampaigns(campRes.value?.data || []);
        if (listRes.status === 'fulfilled') setContactLists(listRes.value?.data || []);
        if (tmplRes.status === 'fulfilled') setTemplates(tmplRes.value?.data || []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const setAction = (id, val) => setActionLoading((p) => ({ ...p, [id]: val }));

  const handleLaunch = async (id) => {
    setAction(id, 'launch');
    try {
      await campaignApi.launch(id);
      showSuccess('Campaign launched! Messages are queued.');
      setCampaigns((cs) => cs.map((c) => c.id === id ? { ...c, status: 'running' } : c));
    } catch { } finally {
      setAction(id, null);
    }
  };

  const handlePause = async (id) => {
    setAction(id, 'pause');
    try {
      await campaignApi.pause(id);
      showSuccess('Campaign paused.');
      setCampaigns((cs) => cs.map((c) => c.id === id ? { ...c, status: 'paused' } : c));
    } catch { } finally {
      setAction(id, null);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this campaign? This cannot be undone.')) return;
    setAction(id, 'delete');
    try {
      await campaignApi.delete(id);
      showSuccess('Campaign deleted.');
      setCampaigns((cs) => cs.filter((c) => c.id !== id));
    } catch { } finally {
      setAction(id, null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-aura-white">Campaigns</h1>
          <p className="text-sm text-aura-white/40 mt-1">{campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''} total</p>
        </div>
        <PrimaryButton onClick={() => setComposerOpen(true)} leftIcon={
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        }>
          New Campaign
        </PrimaryButton>
      </div>

      {/* Campaign Cards */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-surface-elevated" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center py-20 text-center">
          <svg className="w-14 h-14 text-aura-white/10 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
          </svg>
          <p className="text-aura-white/40 text-sm">No campaigns yet.</p>
          <PrimaryButton className="mt-5" onClick={() => setComposerOpen(true)}>Create your first campaign</PrimaryButton>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => {
            const sentPct  = c.total_count  ? Math.round((c.sent_count       / c.total_count)  * 100) : 0;
            const delPct   = c.sent_count   ? Math.round(((c.delivered_count || 0) / c.sent_count)  * 100) : 0;
            const readPct  = c.sent_count   ? Math.round(((c.read_count      || 0) / c.sent_count)  * 100) : 0;
            const isRunning = c.status === 'running';
            const isDraft   = c.status === 'draft' || c.status === 'scheduled';
            const al = actionLoading[c.id];
            return (
              <div key={c.id} className="glass-card px-5 py-4 hover:border-brand/30 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Name + badge */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-sm font-bold text-aura-white truncate">{c.name}</h3>
                      <StatusBadge status={c.status} />
                    </div>

                    {/* Numerical stats row */}
                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                      {[
                        { label: 'Sent',      val: c.sent_count,      pct: sentPct,  color: '#AFA9EC' },
                        { label: 'Delivered', val: c.delivered_count, pct: delPct,   color: '#1D9E75' },
                        { label: 'Read',      val: c.read_count,      pct: readPct,  color: '#60a5fa' },
                        { label: 'Failed',    val: c.failed_count,    pct: null,     color: '#f87171' },
                      ].map((s) => (
                        <div key={s.label} className="flex flex-col">
                          <span className="text-2xs text-aura-white/30">{s.label}</span>
                          <div className="flex items-baseline gap-1">
                            <span
                              className="text-sm font-black tabular-nums"
                              style={{ color: (s.val ?? 0) > 0 ? s.color : 'rgba(255,255,255,0.3)' }}
                            >
                              {(s.val ?? 0).toLocaleString()}
                            </span>
                            {s.pct !== null && (s.val ?? 0) > 0 && (
                              <span className="text-2xs" style={{ color: s.color, opacity: 0.7 }}>
                                {s.pct}%
                              </span>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* Opt-out count */}
                      {(c.opt_out_count ?? 0) > 0 && (
                        <div className="flex flex-col">
                          <span className="text-2xs text-aura-white/30">Opt-outs</span>
                          <span className="text-sm font-black tabular-nums text-amber-400">
                            {c.opt_out_count}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Progress bar */}
                    {c.total_count > 0 && (
                      <div className="mt-3">
                        {/* Layered bar: sent (brand) + delivered overlay (teal) */}
                        <div className="relative h-2 rounded-full bg-surface-border overflow-hidden">
                          {/* Sent layer */}
                          <div
                            className="absolute inset-y-0 left-0 rounded-full"
                            style={{ width: `${sentPct}%`, background: 'rgba(83,74,183,0.4)' }}
                          />
                          {/* Delivered layer */}
                          <div
                            className="absolute inset-y-0 left-0 rounded-full transition-all"
                            style={{ width: `${delPct * sentPct / 100}%`, background: '#1D9E75' }}
                          />
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-2xs text-aura-white/30">
                            {sentPct}% sent · {delPct}% delivered · {readPct}% read
                          </span>
                          {/* View details placeholder */}
                          <button
                            className="text-2xs font-semibold hover:underline transition-colors"
                            style={{ color: '#AFA9EC' }}
                            onClick={() => { /* TODO: open campaign detail drawer */ }}
                          >
                            View details →
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isDraft && (
                      <Button variant="teal" size="sm" loading={al === 'launch'} onClick={() => handleLaunch(c.id)}
                        leftIcon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}>
                        Launch
                      </Button>
                    )}
                    {isRunning && (
                      <Button variant="secondary" size="sm" loading={al === 'pause'} onClick={() => handlePause(c.id)}>
                        Pause
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" loading={al === 'delete'} onClick={() => handleDelete(c.id)}
                      className="text-red-400/60 hover:text-red-400 hover:bg-red-500/10">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Composer Modal */}
      {composerOpen && (
        <ComposerModal
          onClose={() => setComposerOpen(false)}
          onCreated={(c) => setCampaigns((cs) => [c, ...cs])}
          contactLists={contactLists}
          templates={templates}
        />
      )}
    </div>
  );
}
