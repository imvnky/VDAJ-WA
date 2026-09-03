/**
 * VDAJ Services — CampaignsPage
 * Campaign list + Composer Modal with live WhatsApp chat preview.
 */

import React, { useState, useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { campaignApi, contactApi, templateApi } from '../lib/api';
import { showSuccess, showError } from '../components/atoms/Toast/Toast.jsx';
import Button, { PrimaryButton, DangerButton, GhostButton, SecondaryButton } from '../components/atoms/Button/Button.jsx';
import Input, { Select, Textarea } from '../components/atoms/Input/Input.jsx';
import CampaignDetailView from '../components/organisms/CampaignDetailView.jsx';

// ---- Status Badge ----
const STATUS = {
  draft:     { label: 'Draft',     cls: 'bg-[#F8F7FF] text-[#5A5A6E] border-[#E6E4F5]' },
  scheduled: { label: 'Scheduled', cls: 'bg-[#F3F2FD] text-[#534AB7] border-[#E6E4F5]' },
  running:   { label: 'Running',   cls: 'bg-[#F3F2FD] text-[#534AB7] border-[#AFA9EC]' },
  paused:    { label: 'Paused',    cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  completed: { label: 'Done',      cls: 'bg-[#E8F9F4] text-[#148059] border-[#A3E4D0]' },
  failed:    { label: 'Failed',    cls: 'bg-red-50 text-red-700 border-red-200' },
};

function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.draft;
  return (
    <span className={clsx('inline-flex px-2.5 py-0.5 rounded-full text-2xs font-bold border', s.cls)}>
      {s.label}
    </span>
  );
}

// ---- WhatsApp Message Preview ----
function WhatsAppPreview({ template, variables = {} }) {
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Interpolate variables into template body
  const getInterpolatedBody = () => {
    if (!template) {
      return 'Please select a template to preview the message…';
    }
    let body = template.body_text || template.body || '';
    Object.entries(variables).forEach(([key, val]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      body = body.replace(regex, val?.trim() ? `*${val.trim()}*` : `{{${key}}}`);
    });
    return body;
  };

  const renderText = (raw) => {
    if (!raw) return <span className="text-gray-400 text-xs italic">Select a template to preview…</span>;
    const tokens = raw.split(/(\*[^*]+\*|_[^_]+_|~[^~]+~|```[^`]+```)/g);
    return tokens.map((t, idx) => {
      if (t.startsWith('*') && t.endsWith('*')) return <strong key={idx} className="font-semibold text-white">{t.slice(1, -1)}</strong>;
      if (t.startsWith('_') && t.endsWith('_')) return <em key={idx}>{t.slice(1, -1)}</em>;
      if (t.startsWith('~') && t.endsWith('~')) return <s key={idx}>{t.slice(1, -1)}</s>;
      if (t.startsWith('```') && t.endsWith('```')) return <code key={idx} className="font-mono bg-black/20 rounded px-1">{t.slice(3, -3)}</code>;
      return <span key={idx}>{t}</span>;
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#0B141A] rounded-2xl overflow-hidden border border-white/10 shadow-lg">
      {/* WA Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#1F2C34] border-b border-white/5">
        <div className="w-8 h-8 rounded-full bg-[#534AB7] flex items-center justify-center text-xs font-bold text-white shrink-0">
          V
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-white truncate">VDAJ Services LLP</p>
          <p className="text-[10px] text-[#00A884]">Official Business Account</p>
        </div>
      </div>

      {/* Chat Area */}
      <div
        className="flex-1 p-3.5 overflow-y-auto min-h-[320px] flex flex-col justify-end"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }}
      >
        <div className="flex justify-end">
          <div className="max-w-[92%] bg-[#005C4B] rounded-2xl rounded-tr-sm p-3 shadow-md">
            {/* Header Text if any */}
            {template?.header_text && (
              <p className="text-xs font-bold text-white mb-1.5 border-b border-white/10 pb-1">
                {template.header_text}
              </p>
            )}

            {/* Body */}
            <div className="text-xs text-white/90 leading-relaxed whitespace-pre-wrap break-words">
              {renderText(getInterpolatedBody())}
            </div>

            {/* Footer */}
            {template?.footer_text && (
              <p className="text-[10px] text-white/50 mt-2 italic border-t border-white/10 pt-1">
                {template.footer_text}
              </p>
            )}

            <div className="flex items-center justify-end gap-1 mt-1">
              <span className="text-[9px] text-white/40">{time}</span>
              <svg className="w-3 h-3 text-[#53BDEB]" viewBox="0 0 16 11" fill="currentColor">
                <path d="M11.071.653a.45.45 0 0 0-.63 0L4.995 6.099l-2.1-2.1a.45.45 0 0 0-.63.63l2.415 2.414a.45.45 0 0 0 .63 0L11.07 1.29a.45.45 0 0 0 0-.637zM15.05.653a.45.45 0 0 0-.63 0L8.974 6.099l-.6-.6a.45.45 0 0 0-.63.63l.914.914a.45.45 0 0 0 .63 0L15.05 1.29a.45.45 0 0 0 0-.637z" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Composer Modal ----
function ComposerModal({ onClose, onCreated, contactLists, templates }) {
  const [form, setForm] = useState({
    name: '',
    templateId: '',
    contactListId: '',
    variables: {},
    sendTiming: 'now', // 'now' | 'schedule'
    scheduledAt: '',
    interactive: false,
  });
  const [activeTab, setActiveTab] = useState('preview'); // 'preview' | 'excel_guide'
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Find currently selected template
  const selectedTemplate = templates.find((t) => t.id === form.templateId);

  // Extract variables like {{1}}, {{2}} from template body
  const detectedVariables = React.useMemo(() => {
    if (!selectedTemplate?.body_text) return [];
    const matches = [...selectedTemplate.body_text.matchAll(/\{\{(\w+)\}\}/g)];
    const unique = Array.from(new Set(matches.map((m) => m[1])));
    return unique;
  }, [selectedTemplate]);

  const handleVariableChange = (varKey, val) => {
    setForm((f) => ({
      ...f,
      variables: { ...f.variables, [varKey]: val },
    }));
  };

  const handleCreate = async () => {
    if (!form.name.trim()) {
      showError('Campaign name is required.', 'ERR_VDAJ_VAL_005');
      return;
    }
    if (!form.templateId) {
      showError('Please select an approved WhatsApp template for this campaign.', 'ERR_VDAJ_VAL_006');
      return;
    }
    if (!form.contactListId) {
      showError('Please select a contact audience list.', 'ERR_VDAJ_VAL_007');
      return;
    }

    setLoading(true);
    try {
      const res = await campaignApi.create({
        name: form.name,
        templateId: form.templateId,
        contactListId: form.contactListId,
        templateVariables: form.variables,
        scheduledAt: form.sendTiming === 'schedule' && form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
      });
      showSuccess('Campaign created successfully!');
      onCreated(res.data);
      onClose();
    } catch {
      // Toast fired by API interceptor
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-5xl max-h-[92vh] flex flex-col bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl shadow-2xl animate-scale-in overflow-hidden">
        {/* ── MODAL HEADER (High Contrast MNC Grade) ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] bg-[#FFFFFF] shrink-0">
          <div>
            <h2 className="text-lg font-bold text-[#0F172A] tracking-tight">New WhatsApp Campaign</h2>
            <p className="text-xs text-[#64748B]">Broadcast Meta-approved template messages to your contacts.</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── MODAL BODY ── */}
        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
          {/* Left: Form Controls */}
          <div className="flex-1 p-6 overflow-y-auto space-y-5 border-r border-[#E2E8F0]">
            {/* 1. Campaign Details */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#0F172A] uppercase tracking-wider">
                Campaign Details
              </label>
              <Input
                placeholder="e.g. May Enquiry Blast"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                required
              />
            </div>

            {/* 2. Template Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#0F172A] uppercase tracking-wider">
                Message Template *
              </label>
              <Select
                placeholder="— choose an approved template —"
                value={form.templateId}
                onChange={(e) => set('templateId', e.target.value)}
                options={templates.map((t) => ({
                  value: t.id,
                  label: `${t.name} (${t.language || 'en'}) — ${t.category || 'marketing'}`,
                }))}
              />

              {/* Template Preview Box if selected */}
              {selectedTemplate ? (
                <div className="mt-3 p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#534AB7]">
                      Template Preview
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#E6F7F1] text-[#065F46] border border-[#A7F3D0]">
                      {selectedTemplate.status || 'Active'}
                    </span>
                  </div>
                  <p className="text-[#334155] leading-relaxed whitespace-pre-wrap font-sans">
                    {selectedTemplate.body_text}
                  </p>
                  {selectedTemplate.footer_text && (
                    <p className="text-[11px] text-[#64748B] italic pt-1 border-t border-[#E2E8F0]">
                      Footer: {selectedTemplate.footer_text}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-[#64748B]">
                  Per WhatsApp Business policies, outbound campaigns must use an approved Meta template.
                </p>
              )}

              {/* Dynamic Variable Inputs */}
              {detectedVariables.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[#E2E8F0] space-y-3">
                  <label className="text-xs font-bold text-[#0F172A]">
                    Template Variables ({detectedVariables.length})
                  </label>
                  <p className="text-[11px] text-[#64748B]">
                    Provide fallback default values. Contacts with custom attributes will use their personalized values.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {detectedVariables.map((vKey) => (
                      <div key={vKey}>
                        <label className="block text-[11px] font-medium text-[#475569] mb-1">
                          Variable {vKey} ({`{{${vKey}}}`})
                        </label>
                        <input
                          type="text"
                          placeholder={`Enter value for variable ${vKey}`}
                          value={form.variables[vKey] || ''}
                          onChange={(e) => handleVariableChange(vKey, e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg text-[#0F172A] placeholder-[#94A3B8] focus:border-[#534AB7] focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 3. Recipients (Audience) */}
            <div className="space-y-1.5 pt-2 border-t border-[#E2E8F0]">
              <label className="text-xs font-semibold text-[#0F172A] uppercase tracking-wider">
                Recipients (Contact Audience) *
              </label>
              <Select
                placeholder="Select a contact audience list…"
                value={form.contactListId}
                onChange={(e) => set('contactListId', e.target.value)}
                options={contactLists.map((l) => ({
                  value: l.id,
                  label: `${l.name} (${l.contact_count || 0} active contacts)`,
                }))}
              />
              <p className="text-[11px] text-[#64748B]">
                Upload CSV lists with <code className="text-[#534AB7] font-mono">phone</code>, <code className="text-[#534AB7] font-mono">name</code>, and optional variable columns in the <strong>Contacts</strong> page.
              </p>
            </div>

            {/* 4. Interactive Campaign Toggle */}
            <div className="p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-[#0F172A]">Interactive Campaign</p>
                <p className="text-[11px] text-[#64748B] leading-tight mt-0.5">
                  When enabled, customers who click template buttons trigger an automated bot reply flow.
                </p>
              </div>
              <button
                type="button"
                onClick={() => set('interactive', !form.interactive)}
                className={clsx(
                  'w-11 h-6 rounded-full transition-colors relative shrink-0 p-0.5',
                  form.interactive ? 'bg-[#534AB7]' : 'bg-[#CBD5E1]'
                )}
              >
                <div
                  className={clsx(
                    'w-5 h-5 rounded-full bg-white transition-transform shadow-sm',
                    form.interactive ? 'translate-x-5' : 'translate-x-0'
                  )}
                />
              </button>
            </div>

            {/* 5. When to Send */}
            <div className="space-y-2 pt-2 border-t border-[#E2E8F0]">
              <label className="text-xs font-semibold text-[#0F172A] uppercase tracking-wider">
                When to Send
              </label>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[#0F172A]">
                  <input
                    type="radio"
                    name="sendTiming"
                    checked={form.sendTiming === 'now'}
                    onChange={() => set('sendTiming', 'now')}
                    className="text-[#534AB7] focus:ring-[#534AB7]"
                  />
                  <span>Send Immediately</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[#0F172A]">
                  <input
                    type="radio"
                    name="sendTiming"
                    checked={form.sendTiming === 'schedule'}
                    onChange={() => set('sendTiming', 'schedule')}
                    className="text-[#534AB7] focus:ring-[#534AB7]"
                  />
                  <span>Schedule for Later</span>
                </label>
              </div>

              {form.sendTiming === 'schedule' && (
                <div className="mt-2">
                  <Input
                    label="Scheduled Date & Time"
                    type="datetime-local"
                    value={form.scheduledAt}
                    onChange={(e) => set('scheduledAt', e.target.value)}
                    helperText="Stored in UTC, shown in your local time."
                  />
                </div>
              )}
            </div>
          </div>

          {/* Right: Live Preview & Excel Format */}
          <div className="w-full lg:w-80 shrink-0 p-5 bg-[#F8FAFC] flex flex-col gap-3">
            {/* Tab switch */}
            <div className="flex items-center bg-[#E2E8F0] p-1 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={clsx(
                  'flex-1 py-1 rounded-md transition-all',
                  activeTab === 'preview' ? 'bg-[#FFFFFF] text-[#0F172A] shadow-sm' : 'text-[#64748B]'
                )}
              >
                Live Preview
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('excel_guide')}
                className={clsx(
                  'flex-1 py-1 rounded-md transition-all',
                  activeTab === 'excel_guide' ? 'bg-[#FFFFFF] text-[#0F172A] shadow-sm' : 'text-[#64748B]'
                )}
              >
                Excel Format
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'preview' ? (
              <div className="flex-1 flex flex-col">
                <WhatsAppPreview template={selectedTemplate} variables={form.variables} />
              </div>
            ) : (
              <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-4 text-xs space-y-3 shadow-sm">
                <div>
                  <h4 className="font-bold text-[#0F172A] mb-1">Excel / CSV Format</h4>
                  <p className="text-[11px] text-[#64748B]">
                    First row must be column headers. <code className="text-[#534AB7] font-mono">phone</code> is required.
                  </p>
                </div>

                <div className="overflow-x-auto border border-[#E2E8F0] rounded-lg">
                  <table className="w-full text-[11px] text-left">
                    <thead className="bg-[#F8FAFC] text-[#475569] font-bold border-b border-[#E2E8F0]">
                      <tr>
                        <th className="p-1.5 font-mono">PHONE</th>
                        <th className="p-1.5 font-mono">NAME</th>
                        <th className="p-1.5 font-mono">VAR1</th>
                        <th className="p-1.5 font-mono">VAR2</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0] text-[#334155]">
                      <tr>
                        <td className="p-1.5 font-mono text-[10px]">919876543210</td>
                        <td className="p-1.5">Rajesh</td>
                        <td className="p-1.5">Rajesh</td>
                        <td className="p-1.5">10%</td>
                      </tr>
                      <tr>
                        <td className="p-1.5 font-mono text-[10px]">919864008174</td>
                        <td className="p-1.5">Priya</td>
                        <td className="p-1.5">Priya</td>
                        <td className="p-1.5">20%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <p className="text-[11px] text-[#64748B] leading-relaxed">
                  <span className="text-[#534AB7] font-semibold">var1</span> fills <code className="font-mono">{"{{1}}"}</code>, <span className="text-[#534AB7] font-semibold">var2</span> fills <code className="font-mono">{"{{2}}"}</code>. Per-row values override form defaults.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── MODAL FOOTER ── */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E2E8F0] bg-[#FFFFFF] shrink-0">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={handleCreate} loading={loading}>
            {form.sendTiming === 'now' ? 'Launch Campaign' : 'Schedule Campaign'}
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
  const [selectedCampaignId, setSelectedCampaignId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('id') || null;
  });

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

  // If a campaign is selected, render the MNC CampaignDetailView
  if (selectedCampaignId) {
    return (
      <div className="max-w-7xl mx-auto animate-fade-in">
        <CampaignDetailView
          campaignId={selectedCampaignId}
          onBack={() => {
            setSelectedCampaignId(null);
            const url = new URL(window.location);
            url.searchParams.delete('id');
            window.history.pushState({}, '', url);
          }}
          onNewCampaign={() => {
            setSelectedCampaignId(null);
            setComposerOpen(true);
          }}
        />
        {/* Composer Modal */}
        {composerOpen && (
          <ComposerModal
            onClose={() => setComposerOpen(false)}
            onCreated={(c) => {
              setCampaigns((cs) => [c, ...cs]);
              setSelectedCampaignId(c.id);
            }}
            contactLists={contactLists}
            templates={templates}
          />
        )}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#0F0F0F]">Campaigns</h1>
          <p className="text-sm text-[#5A5A6E] mt-1">{campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''} total</p>
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
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-white border border-[#E6E4F5]" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center py-20 text-center bg-white border border-[#E6E4F5]">
          <svg className="w-14 h-14 text-[#9494A8]/40 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
          </svg>
          <p className="text-[#5A5A6E] text-sm">No campaigns yet.</p>
          <PrimaryButton className="mt-5" onClick={() => setComposerOpen(true)}>Create your first campaign</PrimaryButton>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((c) => {
            const sentPct  = c.total_count  ? Math.round((c.sent_count       / c.total_count)  * 100) : 0;
            const delPct   = c.sent_count   ? Math.round(((c.delivered_count || 0) / c.sent_count)  * 100) : 0;
            const readPct  = c.sent_count   ? Math.round(((c.read_count      || 0) / c.sent_count)  * 100) : 0;
            const isRunning = c.status === 'running';
            const isDraft   = c.status === 'draft' || c.status === 'scheduled';
            const al = actionLoading[c.id];
            return (
              <div key={c.id} className="glass-card p-5 hover:border-[#534AB7]/50 transition-all bg-white border border-[#E6E4F5] rounded-2xl shadow-xs">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Name + badge + list info */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <button
                        onClick={() => setSelectedCampaignId(c.id)}
                        className="text-base font-extrabold text-[#0F172A] hover:text-[#534AB7] transition-colors truncate text-left cursor-pointer"
                      >
                        {c.name}
                      </button>
                      <StatusBadge status={c.status} />
                      {c.contact_list_name && (
                        <span className="text-2xs font-semibold px-2 py-0.5 rounded-md bg-gray-100 text-gray-700">
                          Audience: {c.contact_list_name}
                        </span>
                      )}
                      {c.template_name && (
                        <span className="text-2xs font-semibold px-2 py-0.5 rounded-md bg-[#F3F2FD] text-[#534AB7]">
                          Template: {c.template_name}
                        </span>
                      )}
                    </div>

                    {/* Executive Metric Cards Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-3.5">
                      <div className="bg-[#F8FAFC] px-3.5 py-2.5 rounded-xl border border-gray-100">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Total Contacts</span>
                        <span className="text-base font-black text-[#0F172A] tabular-nums mt-0.5 block">{(c.total_count || 0).toLocaleString()}</span>
                      </div>
                      <div className="bg-blue-50/70 px-3.5 py-2.5 rounded-xl border border-blue-100/80">
                        <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Sent</span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-base font-black text-blue-700 tabular-nums">{(c.sent_count || 0).toLocaleString()}</span>
                          {typeof sentPct === 'number' && sentPct > 0 && (
                            <span className="text-2xs font-bold text-blue-600">({sentPct}%)</span>
                          )}
                        </div>
                      </div>
                      <div className="bg-emerald-50/70 px-3.5 py-2.5 rounded-xl border border-emerald-100/80">
                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Delivered</span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-base font-black text-emerald-700 tabular-nums">{(c.delivered_count || 0).toLocaleString()}</span>
                          {typeof delPct === 'number' && delPct > 0 && (
                            <span className="text-2xs font-bold text-emerald-600">({delPct}%)</span>
                          )}
                        </div>
                      </div>
                      <div className="bg-sky-50/70 px-3.5 py-2.5 rounded-xl border border-sky-100/80">
                        <span className="text-[10px] font-bold text-sky-600 uppercase tracking-wider block">Read</span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-base font-black text-sky-700 tabular-nums">{(c.read_count || 0).toLocaleString()}</span>
                          {typeof readPct === 'number' && readPct > 0 && (
                            <span className="text-2xs font-bold text-sky-600">({readPct}%)</span>
                          )}
                        </div>
                      </div>
                      <div className={`px-3.5 py-2.5 rounded-xl border ${(c.failed_count || 0) > 0 ? 'bg-red-50/80 border-red-200' : 'bg-gray-50 border-gray-100'}`}>
                        <span className={`text-[10px] font-bold uppercase tracking-wider block ${(c.failed_count || 0) > 0 ? 'text-red-600' : 'text-gray-500'}`}>Failed</span>
                        <span className={`text-base font-black tabular-nums mt-0.5 block ${(c.failed_count || 0) > 0 ? 'text-red-700' : 'text-gray-700'}`}>
                          {(c.failed_count || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Progress bar + View details action */}
                    <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                        <div className="flex-1 relative h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="absolute inset-y-0 left-0 rounded-full bg-[#534AB7] transition-all"
                            style={{ width: `${Math.min(sentPct, 100)}%` }}
                          />
                        </div>
                        <span className="text-2xs text-gray-400 font-medium whitespace-nowrap">
                          {sentPct}% dispatched
                        </span>
                      </div>

                      <button
                        onClick={() => setSelectedCampaignId(c.id)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#534AB7] bg-[#F3F2FD] hover:bg-[#E8E6F8] px-3.5 py-1.5 rounded-xl border border-[#AFA9EC]/30 transition-all shadow-2xs cursor-pointer"
                      >
                        <span>View Delivery Dashboard & Recipients</span>
                        <span>→</span>
                      </button>
                    </div>
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
