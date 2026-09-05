/**
 * VDAJ Services — Enterprise WhatsApp Templates Management
 * ────────────────────────────────────────────────────────────
 * Professional MNC Grade template manager & creator adhering to
 * Meta Graph API v19.0 and WhatsApp Business Platform standards.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { clsx } from 'clsx';
import { templateApi } from '../lib/api';
import { showSuccess, showError, showInfo } from '../components/atoms/Toast/Toast.jsx';
import Button, { PrimaryButton, GhostButton } from '../components/atoms/Button/Button.jsx';
import { ErrorState, parseApiError } from '../components/atoms/ErrorState/ErrorState.jsx';

// ── Categories & Status Configuration ──────────────────────────
const CATEGORIES = [
  { id: 'MARKETING', label: 'Marketing', desc: 'Promotions, discounts, product launches' },
  { id: 'UTILITY', label: 'Utility', desc: 'Order updates, account alerts, transactional' },
  { id: 'AUTHENTICATION', label: 'Authentication', desc: 'OTPs, security verification codes' },
];

const LANGUAGES = [
  { code: 'en', label: 'English (en)' },
  { code: 'en_US', label: 'English (US)' },
  { code: 'hi', label: 'Hindi (hi)' },
  { code: 'mr', label: 'Marathi (mr)' },
  { code: 'es', label: 'Spanish (es)' },
  { code: 'pt_BR', label: 'Portuguese (BR)' },
  { code: 'ar', label: 'Arabic (ar)' },
];

const HEADER_TYPES = [
  { id: 'NONE', label: 'NONE' },
  { id: 'TEXT', label: 'TEXT' },
  { id: 'IMAGE', label: 'IMAGE' },
  { id: 'VIDEO', label: 'VIDEO' },
  { id: 'DOCUMENT', label: 'DOCUMENT' },
];

// ── WhatsApp Mobile Preview Card ──────────────────────────────
function WhatsAppLivePreview({ form }) {
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Sample values for variable replacement in preview
  const sampleValues = {
    '1': 'Viren',
    '2': 'tomorrow at 4:00 PM',
    '3': 'VDAJ-8942',
    '4': '20% OFF',
    'name': 'Viren',
  };

  const getInterpolatedBody = () => {
    if (!form.bodyText) {
      return 'Hello {{1}}, thank you for contacting VDAJ Services. Your request is being processed.';
    }
    let text = form.bodyText;
    return text.replace(/\{\{(\w+)\}\}/g, (match, p1) => {
      const sample = sampleValues[p1] || `Sample_${p1}`;
      return `*${sample}*`;
    });
  };

  const renderFormatted = (raw) => {
    const tokens = raw.split(/(\*[^*]+\*|_[^_]+_|~[^~]+~|```[^`]+```)/g);
    return tokens.map((t, idx) => {
      if (t.startsWith('*') && t.endsWith('*')) return <strong key={idx} className="font-semibold text-white">{t.slice(1, -1)}</strong>;
      if (t.startsWith('_') && t.endsWith('_')) return <em key={idx}>{t.slice(1, -1)}</em>;
      if (t.startsWith('~') && t.endsWith('~')) return <s key={idx}>{t.slice(1, -1)}</s>;
      if (t.startsWith('```') && t.endsWith('```')) return <code key={idx} className="font-mono bg-black/30 rounded px-1">{t.slice(3, -3)}</code>;
      return <span key={idx}>{t}</span>;
    });
  };

  return (
    <div className="flex flex-col h-full max-w-[340px] mx-auto bg-[#0B141A] rounded-3xl overflow-hidden border border-[#2A3942] shadow-2xl">
      {/* Device Top Bar */}
      <div className="bg-[#1F2C34] px-4 py-2 flex items-center justify-between text-[11px] text-[#8696A0] border-b border-white/5">
        <span>02:31</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px]">5G</span>
          <div className="w-3.5 h-2 border border-[#8696A0] rounded-sm relative">
            <div className="h-full w-2.5 bg-[#8696A0]"></div>
          </div>
        </div>
      </div>

      {/* WhatsApp Header */}
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-[#1F2C34] border-b border-white/5">
        <div className="w-8 h-8 rounded-full bg-[#534AB7] flex items-center justify-center text-xs font-bold text-white shrink-0 shadow">
          V
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <p className="text-xs font-semibold text-white truncate">VDAJ Services LLP</p>
            <svg className="w-3 h-3 text-[#00A884] shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
          <p className="text-[10px] text-[#8696A0]">Official Business Account</p>
        </div>
      </div>

      {/* Chat Area with WhatsApp Pattern */}
      <div
        className="flex-1 p-3.5 overflow-y-auto min-h-[360px] flex flex-col justify-end"
        style={{
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        }}
      >
        <div className="flex justify-end">
          <div className="max-w-[95%] w-full bg-[#005C4B] rounded-2xl rounded-tr-sm p-3 shadow-lg flex flex-col gap-1.5">
            {/* Header Preview */}
            {form.headerType === 'TEXT' && form.headerText && (
              <p className="text-xs font-bold text-white border-b border-white/10 pb-1">
                {form.headerText}
              </p>
            )}
            {form.headerType !== 'NONE' && form.headerType !== 'TEXT' && (
              <div className="h-28 bg-[#1F2C34] rounded-lg border border-white/10 flex flex-col items-center justify-center text-[#8696A0] gap-1">
                <span className="text-lg">
                  {form.headerType === 'IMAGE' ? '🖼️' : form.headerType === 'VIDEO' ? '🎥' : '📄'}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider">{form.headerType} Header</span>
              </div>
            )}

            {/* Body */}
            <div className="text-xs text-white/95 leading-relaxed whitespace-pre-wrap break-words">
              {renderFormatted(getInterpolatedBody())}
            </div>

            {/* Footer */}
            {form.footerText && (
              <p className="text-[10px] text-white/55 italic pt-1 border-t border-white/10">
                {form.footerText}
              </p>
            )}

            {/* Timestamp & Double Checkmark */}
            <div className="flex items-center justify-end gap-1 mt-0.5">
              <span className="text-[9px] text-white/40">{time}</span>
              <svg className="w-3 h-3 text-[#53BDEB]" viewBox="0 0 16 11" fill="currentColor">
                <path d="M11.071.653a.45.45 0 0 0-.63 0L4.995 6.099l-2.1-2.1a.45.45 0 0 0-.63.63l2.415 2.414a.45.45 0 0 0 .63 0L11.07 1.29a.45.45 0 0 0 0-.637zM15.05.653a.45.45 0 0 0-.63 0L8.974 6.099l-.6-.6a.45.45 0 0 0-.63.63l.914.914a.45.45 0 0 0 .63 0L15.05 1.29a.45.45 0 0 0 0-.637z" />
              </svg>
            </div>

            {/* Interactive Buttons Preview */}
            {form.buttons && form.buttons.length > 0 && (
              <div className="mt-2 pt-2 border-t border-white/10 flex flex-col gap-1.5">
                {form.buttons.map((btn, idx) => (
                  <div
                    key={idx}
                    className="py-1.5 px-3 bg-[#005C4B]/60 hover:bg-[#005C4B] border border-white/20 rounded-lg text-center text-xs font-semibold text-[#53BDEB] flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-colors"
                  >
                    {btn.type === 'URL' && <span>🔗</span>}
                    {btn.type === 'PHONE_NUMBER' && <span>📞</span>}
                    {btn.type === 'QUICK_REPLY' && <span>↩️</span>}
                    <span className="truncate">{btn.text || `Button ${idx + 1}`}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-[#1F2C34] px-4 py-2 text-center text-[10px] text-[#8696A0] border-t border-white/5">
        Preview uses sample variable values — actual send fills real data.
      </div>
    </div>
  );
}

// ── LeadMantra-Grade Create Template Modal ─────────────────────
function CreateTemplateModal({ onClose, onCreated, prefill = null }) {
  const isEdit = !!prefill;
  const [form, setForm] = useState({
    displayName: prefill?.name ? prefill.name.replace(/_/g, ' ') : '',
    name: prefill?.name || '',
    category: prefill?.category ? prefill.category.toUpperCase() : 'MARKETING',
    language: prefill?.language || 'en',
    allowReclassify: true,
    description: '',
    headerType: prefill?.header_text ? 'TEXT' : 'NONE',
    headerText: prefill?.header_text || '',
    bodyText: prefill?.body_text || '',
    footerText: prefill?.footer_text || '',
    buttons: prefill?.buttons || [],
  });
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Auto-generate snake_case template name from display name
  const handleDisplayNameChange = (val) => {
    const autoSlug = val.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
    setForm((f) => ({
      ...f,
      displayName: val,
      name: f.name === '' || f.name === f.displayName.toLowerCase().replace(/[^a-z0-9_]/g, '_') ? autoSlug : f.name,
    }));
  };

  // Detect {{1}}, {{2}} in body
  const detectedVars = useMemo(() => {
    const matches = [...(form.bodyText || '').matchAll(/\{\{(\w+)\}\}/g)];
    return Array.from(new Set(matches.map((m) => m[1])));
  }, [form.bodyText]);

  // Button management
  const addButton = () => {
    if (form.buttons.length >= 3) {
      showInfo('Maximum 3 buttons allowed per template.');
      return;
    }
    setForm((f) => ({
      ...f,
      buttons: [...f.buttons, { type: 'QUICK_REPLY', text: '' }],
    }));
  };

  const updateButton = (index, field, value) => {
    const updated = [...form.buttons];
    updated[index][field] = value;
    setForm((f) => ({ ...f, buttons: updated }));
  };

  const removeButton = (index) => {
    setForm((f) => ({
      ...f,
      buttons: f.buttons.filter((_, i) => i !== index),
    }));
  };

  const handleCreate = async () => {
    if (!form.name.trim()) {
      showError('Template name is required.', 'ERR_VDAJ_VAL_001');
      return;
    }
    if (!form.bodyText.trim()) {
      showError('Message body text is required.', 'ERR_VDAJ_VAL_002');
      return;
    }

    // Policy check for marketing templates
    if (form.category === 'MARKETING') {
      const optOutRegex = /\b(stop|unsubscribe|opt.?out|no more)\b/i;
      if (!optOutRegex.test(form.bodyText) && !optOutRegex.test(form.footerText || '')) {
        showError(
          'Marketing templates must include opt-out text in the body or footer (e.g., "Reply STOP to unsubscribe").',
          'ERR_TEMPLATE_NO_OPTOUT'
        );
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        name: form.name.toLowerCase().trim(),
        category: form.category,
        language: form.language,
        bodyText: form.bodyText,
        headerText: form.headerType === 'TEXT' ? form.headerText : null,
        footerText: form.footerText || null,
        buttons: form.buttons.filter((b) => b.text.trim() !== ''),
      };

      const res = await templateApi.create(payload);
      showSuccess('Template submitted to Meta Graph API for review!');
      onCreated(res.data);
      onClose();
    } catch {
      // Handled by toast interceptor
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-6xl max-h-[94vh] flex flex-col bg-[#FFFFFF] border border-[#E2E8F0] rounded-3xl shadow-2xl animate-scale-in overflow-hidden">
        {/* ── MODAL HEADER ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] bg-[#FFFFFF] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E8F9F4] text-[#148059] flex items-center justify-center">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.16 12.04 20.16C10.66 20.16 9.3 19.8 8.09 19.09L7.81 18.92L4.69 19.74L5.52 16.7L5.33 16.4C4.54 15.13 4.12 13.54 4.12 11.91C4.12 7.37 7.82 3.67 12.05 3.67Z"/>
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#64748B]">WhatsApp Templates /</span>
                <span className="text-xs font-semibold text-[#534AB7]">{isEdit ? 'Edit & Resubmit' : 'Create Template'}</span>
              </div>
              <h2 className="text-lg font-bold text-[#0F172A] tracking-tight">
                {isEdit ? 'Edit & Resubmit Template' : 'Create WhatsApp Template'}
              </h2>
              <p className="text-xs text-[#64748B]">Template will be submitted to Meta for approval.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── MODAL BODY (2 COLUMNS) ── */}
        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
          {/* Left Column: Form Controls */}
          <div className="flex-1 p-6 overflow-y-auto space-y-5 border-r border-[#E2E8F0]">
            {/* Display Name */}
            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">
                Display Name <span className="text-[#E11D48]">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Welcome Message"
                value={form.displayName}
                onChange={(e) => handleDisplayNameChange(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] focus:border-[#534AB7] focus:ring-1 focus:ring-[#534AB7] focus:outline-none"
              />
              <p className="text-[11px] text-[#64748B] mt-1">
                Human-readable label shown in the CRM send form.
              </p>
            </div>

            {/* Template Name & Language */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">
                  Template Name <span className="text-[#E11D48]">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. welcome_message"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                  className="w-full px-3.5 py-2.5 text-xs bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl text-[#0F172A] font-mono placeholder-[#94A3B8] focus:border-[#534AB7] focus:outline-none"
                  required
                />
                <p className="text-[11px] text-[#64748B] mt-1">
                  Lowercase, digits, underscores only. Cannot be changed after submission.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1">
                  Language <span className="text-[#E11D48]">*</span>
                </label>
                <select
                  value={form.language}
                  onChange={(e) => set('language', e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl text-[#0F172A] focus:border-[#534AB7] focus:outline-none"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Category + Allow Reclassify */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-[#0F172A]">
                  Category <span className="text-[#E11D48]">*</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs text-[#64748B] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.allowReclassify}
                    onChange={(e) => set('allowReclassify', e.target.checked)}
                    className="rounded text-[#534AB7] focus:ring-[#534AB7]"
                  />
                  <span>Allow Meta to reclassify category if needed</span>
                </label>
              </div>

              <select
                value={form.category}
                onChange={(e) => set('category', e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl text-[#0F172A] focus:border-[#534AB7] focus:outline-none font-semibold"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label} — {c.desc}
                  </option>
                ))}
              </select>

              {/* Compliance Warning */}
              {form.category === 'MARKETING' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
                  <span className="text-base">⚠️</span>
                  <div>
                    <strong className="block font-semibold">Marketing Opt-Out Policy:</strong>
                    Meta requires all marketing templates to include an explicit opt-out mechanism (e.g., &ldquo;Reply STOP to unsubscribe&rdquo;) in the footer.
                  </div>
                </div>
              )}
            </div>

            {/* Description (optional) */}
            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">
                Description (optional)
              </label>
              <input
                type="text"
                placeholder="Brief internal description"
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] focus:border-[#534AB7] focus:outline-none"
              />
            </div>

            {/* ── HEADER SECTION ── */}
            <div className="pt-3 border-t border-[#E2E8F0] space-y-3">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#F1F5F9] text-[#475569]">
                  HEADER
                </span>
                <span className="text-xs text-[#64748B]">Optional</span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#475569] uppercase tracking-wider mb-2">
                  TYPE
                </label>
                <div className="flex flex-wrap gap-2">
                  {HEADER_TYPES.map((t) => (
                    <label
                      key={t.id}
                      className={clsx(
                        'px-3.5 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5',
                        form.headerType === t.id
                          ? 'bg-[#534AB7] text-white border-[#534AB7] shadow-sm'
                          : 'bg-[#FFFFFF] text-[#475569] border-[#CBD5E1] hover:bg-[#F8FAFC]'
                      )}
                    >
                      <input
                        type="radio"
                        name="headerType"
                        value={t.id}
                        checked={form.headerType === t.id}
                        onChange={() => set('headerType', t.id)}
                        className="sr-only"
                      />
                      <span>{t.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {form.headerType === 'TEXT' && (
                <div>
                  <input
                    type="text"
                    maxLength={60}
                    placeholder="e.g. Order Update #{{1}}"
                    value={form.headerText}
                    onChange={(e) => set('headerText', e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] focus:border-[#534AB7] focus:outline-none"
                  />
                  <p className="text-[11px] text-[#64748B] mt-1">Max 60 characters.</p>
                </div>
              )}
            </div>

            {/* ── BODY SECTION (REQUIRED) ── */}
            <div className="pt-3 border-t border-[#E2E8F0] space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#EDE9FE] text-[#6D28D9]">
                    BODY
                  </span>
                  <span className="text-xs font-semibold text-[#0F172A]">Required</span>
                </div>
                <span className="text-[11px] text-[#64748B]">
                  Use <code className="text-[#534AB7] font-mono">{"{{1}}"}</code>, <code className="text-[#534AB7] font-mono">{"{{2}}"}</code> for variables
                </span>
              </div>

              <div className="relative">
                <textarea
                  rows={4}
                  maxLength={1024}
                  placeholder="Hello {{1}}, your appointment is confirmed for {{2}}. Reply STOP to unsubscribe."
                  value={form.bodyText}
                  onChange={(e) => set('bodyText', e.target.value)}
                  className="w-full p-3.5 text-xs bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] font-sans leading-relaxed focus:border-[#534AB7] focus:ring-1 focus:ring-[#534AB7] focus:outline-none"
                  required
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                <span className="font-semibold text-[#534AB7]">
                  Detected variables: {detectedVars.length} {detectedVars.length > 0 && `(${detectedVars.map(v => `{{${v}}}`).join(', ')})`}
                </span>
                <span>{form.bodyText.length} / 1024</span>
              </div>
            </div>

            {/* ── FOOTER SECTION ── */}
            <div className="pt-3 border-t border-[#E2E8F0] space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#F1F5F9] text-[#475569]">
                    FOOTER
                  </span>
                  <span className="text-xs text-[#64748B]">Optional</span>
                </div>
                {form.category === 'MARKETING' && (
                  <button
                    type="button"
                    onClick={() => set('footerText', 'Reply STOP to unsubscribe')}
                    className="text-[11px] font-semibold text-[#534AB7] hover:underline"
                  >
                    + Insert Standard Opt-Out Text
                  </button>
                )}
              </div>

              <input
                type="text"
                maxLength={60}
                placeholder="e.g. This is an automated message. Reply STOP to unsubscribe."
                value={form.footerText}
                onChange={(e) => set('footerText', e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] focus:border-[#534AB7] focus:outline-none"
              />
              <p className="text-[11px] text-[#64748B]">
                Short text shown below the body. Max 60 characters.
              </p>
            </div>

            {/* ── BUTTONS SECTION (MAX 3) ── */}
            <div className="pt-3 border-t border-[#E2E8F0] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#F1F5F9] text-[#475569]">
                    BUTTONS
                  </span>
                  <span className="text-xs text-[#64748B]">Optional — max 3</span>
                </div>
                {form.buttons.length < 3 && (
                  <button
                    type="button"
                    onClick={addButton}
                    className="px-2.5 py-1 text-xs font-bold text-[#534AB7] bg-[#F3F2FD] hover:bg-[#E6E4F5] rounded-lg transition-colors"
                  >
                    + Add Button
                  </button>
                )}
              </div>

              {form.buttons.map((btn, idx) => (
                <div key={idx} className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#0F172A]">Button #{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeButton(idx)}
                      className="text-xs font-semibold text-[#E11D48] hover:underline"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      value={btn.type}
                      onChange={(e) => updateButton(idx, 'type', e.target.value)}
                      className="px-2.5 py-1.5 text-xs bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg text-[#0F172A]"
                    >
                      <option value="QUICK_REPLY">Quick Reply</option>
                      <option value="URL">Visit Website (URL)</option>
                      <option value="PHONE_NUMBER">Call Phone Number</option>
                    </select>

                    <input
                      type="text"
                      maxLength={25}
                      placeholder="Button label (max 25 chars)"
                      value={btn.text}
                      onChange={(e) => updateButton(idx, 'text', e.target.value)}
                      className="px-2.5 py-1.5 text-xs bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg text-[#0F172A]"
                    />
                  </div>

                  {btn.type === 'URL' && (
                    <input
                      type="url"
                      placeholder="https://vdajservices.com/offer"
                      value={btn.url || ''}
                      onChange={(e) => updateButton(idx, 'url', e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-[#FFFFFF] border border-[#CBD5E1] rounded-lg text-[#0F172A]"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Live Sticky WhatsApp Preview */}
          <div className="w-full lg:w-96 shrink-0 p-6 bg-[#F8FAFC] flex flex-col justify-center items-center">
            <div className="w-full">
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-[#475569]">
                  Live WhatsApp Preview
                </span>
                <span className="text-[10px] font-semibold text-[#00A884] bg-[#E8F9F4] px-2 py-0.5 rounded-full">
                  Real-time rendering
                </span>
              </div>
              <WhatsAppLivePreview form={form} />
            </div>
          </div>
        </div>

        {/* ── MODAL FOOTER ── */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E2E8F0] bg-[#FFFFFF] shrink-0">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={handleCreate} loading={loading}>
            {isEdit ? 'Resubmit to Meta' : 'Submit to Meta'}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

// ── Enterprise Template Card ───────────────────────────────────
function EnterpriseTemplateCard({ template, onSync, onResubmit }) {
  const [syncing, setSyncing] = useState(false);
  const isApproved = (template.status || '').toLowerCase() === 'approved';
  const isRejected = (template.status || '').toLowerCase() === 'rejected';

  const handleSync = async () => {
    setSyncing(true);
    try {
      await templateApi.sync(template.id);
      showSuccess(`Synced "${template.name}" with Meta.`);
      onSync?.(template.id);
    } catch {
    } finally {
      setSyncing(false);
    }
  };

  const copyId = () => {
    if (template.meta_template_id) {
      navigator.clipboard.writeText(template.meta_template_id);
      showSuccess(`Copied Meta Template ID: ${template.meta_template_id}`);
    }
  };

  const copyBody = () => {
    navigator.clipboard.writeText(template.body_text || '');
    showSuccess('Template message copied to clipboard!');
  };

  return (
    <div className="bg-[#FFFFFF] border border-[#E2E8F0] hover:border-[#CBD5E1] rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-4">
      {/* Top Header */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-[#0F172A] font-mono truncate">
                {template.name}
              </h3>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-[#F3F2FD] text-[#534AB7] border border-[#E6E4F5]">
                {template.category || 'MARKETING'}
              </span>
            </div>

            <div className="flex items-center gap-2 mt-1 text-xs text-[#64748B]">
              <span>{template.language || 'en'}</span>
              {template.meta_template_id && (
                <button
                  onClick={copyId}
                  title="Click to copy Meta Template ID"
                  className="flex items-center gap-1 font-mono text-[11px] text-[#534AB7] hover:underline"
                >
                  <span>ID: {template.meta_template_id}</span>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Status Badge */}
          <span
            className={clsx(
              'px-3 py-1 rounded-full text-xs font-bold border shrink-0 flex items-center gap-1.5 shadow-sm',
              isApproved && 'bg-[#E8F9F4] text-[#148059] border-[#A3E4D0]',
              isRejected && 'bg-red-50 text-red-700 border-red-200',
              !isApproved && !isRejected && 'bg-amber-50 text-amber-700 border-amber-200'
            )}
          >
            <span className="w-2 h-2 rounded-full bg-current"></span>
            {isApproved ? 'Approved' : isRejected ? 'Rejected' : 'In Review'}
          </span>
        </div>

        {/* Rejection alert if applicable */}
        {isRejected && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 space-y-1">
            <p className="font-bold">❌ Rejected by Meta Review</p>
            <p className="text-[11px] text-red-700 leading-relaxed">
              {template.rejection_reason || 'Policy mismatch or missing opt-out text in marketing template. Edit and resubmit to request re-evaluation.'}
            </p>
          </div>
        )}

        {/* Message Preview Box */}
        <div className="mt-3 p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs text-[#334155] leading-relaxed space-y-1.5">
          {template.header_text && (
            <p className="font-bold text-[#0F172A] border-b border-[#E2E8F0] pb-1">
              {template.header_text}
            </p>
          )}
          <p className="whitespace-pre-wrap font-sans text-xs">
            {template.body_text}
          </p>
          {template.footer_text && (
            <p className="text-[11px] text-[#64748B] italic pt-1 border-t border-[#E2E8F0]">
              Footer: {template.footer_text}
            </p>
          )}
        </div>
      </div>

      {/* Bottom Actions Bar */}
      <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[11px] text-[#64748B]">
          {new Date(template.created_at).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={copyBody}
            className="px-2.5 py-1 text-xs font-semibold text-[#475569] hover:text-[#0F172A] bg-[#F1F5F9] hover:bg-[#E2E8F0] rounded-lg transition-colors"
          >
            Copy Text
          </button>

          {isRejected && (
            <button
              onClick={() => onResubmit(template)}
              className="px-2.5 py-1 text-xs font-bold text-white bg-[#534AB7] hover:bg-[#4339A6] rounded-lg transition-colors shadow-sm"
            >
              ✏️ Edit & Resubmit
            </button>
          )}

          {!isApproved && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-2.5 py-1 text-xs font-semibold text-[#534AB7] bg-[#F3F2FD] hover:bg-[#E6E4F5] rounded-lg transition-colors disabled:opacity-50"
            >
              {syncing ? 'Syncing…' : '🔄 Sync Meta'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Templates Page Component ─────────────────────────────
export default function TemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [prefill, setPrefill] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [syncAllLoading, setSyncAllLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadTemplates = () => {
    setLoading(true);
    templateApi.list({ silent: true })
      .then((res) => {
        setTemplates(res?.data || []);
        setError(null);
      })
      .catch((err) => {
        setError(parseApiError(err));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleSyncAll = async () => {
    setSyncAllLoading(true);
    try {
      await Promise.all(
        templates.filter((t) => (t.status || '').toLowerCase() !== 'approved').map((t) => templateApi.sync(t.id).catch(() => {}))
      );
      showSuccess('Meta sync complete for all templates.');
      loadTemplates();
    } finally {
      setSyncAllLoading(false);
    }
  };

  const openResubmit = (template) => {
    setPrefill(template);
    setCreating(true);
  };

  const closeModal = () => {
    setCreating(false);
    setPrefill(null);
  };

  // Metrics
  const approvedCount = templates.filter((t) => (t.status || '').toLowerCase() === 'approved').length;
  const pendingCount = templates.filter((t) => (t.status || '').toLowerCase() === 'pending').length;
  const rejectedCount = templates.filter((t) => (t.status || '').toLowerCase() === 'rejected').length;

  // Filtered list
  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const matchSearch =
        t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.body_text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.meta_template_id?.includes(searchQuery);

      const matchCat =
        categoryFilter === 'ALL' || (t.category || '').toUpperCase() === categoryFilter.toUpperCase();

      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'APPROVED' && (t.status || '').toLowerCase() === 'approved') ||
        (statusFilter === 'PENDING' && (t.status || '').toLowerCase() === 'pending') ||
        (statusFilter === 'REJECTED' && (t.status || '').toLowerCase() === 'rejected');

      return matchSearch && matchCat && matchStatus;
    });
  }, [templates, searchQuery, categoryFilter, statusFilter]);

  return (
    <div className="w-full space-y-6 pb-12 animate-fade-in">
      {/* ── TOP HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">WhatsApp Templates</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#E8F9F4] text-[#148059] border border-[#A3E4D0]">
              Meta Cloud API
            </span>
          </div>
          <p className="text-xs text-[#64748B] mt-1">
            Create, manage, and broadcast Meta-approved message templates for outbound campaigns &amp; alerts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSyncAll}
            disabled={syncAllLoading}
            className="px-4 py-2 text-xs font-bold text-[#475569] bg-[#FFFFFF] hover:bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
          >
            <span>🔄</span>
            <span>{syncAllLoading ? 'Syncing...' : 'Sync with Meta'}</span>
          </button>

          <PrimaryButton
            onClick={() => { setPrefill(null); setCreating(true); }}
            leftIcon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            }
          >
            New Template
          </PrimaryButton>
        </div>
      </div>

      {/* ── MNC GRADE KPI METRICS RIBBON ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#FFFFFF] border border-[#E2E8F0] p-4 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Total Templates</p>
            <h3 className="text-2xl font-black text-[#0F172A] mt-1">{templates.length}</h3>
            <p className="text-[11px] text-[#534AB7] mt-0.5">WABA ID Linked</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#F3F2FD] text-[#534AB7] flex items-center justify-center text-xl font-bold">
            📋
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E2E8F0] p-4 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Approved & Live</p>
            <h3 className="text-2xl font-black text-[#148059] mt-1">{approvedCount}</h3>
            <p className="text-[11px] text-[#148059] mt-0.5">Ready to broadcast</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-[#E8F9F4] text-[#148059] flex items-center justify-center text-xl font-bold">
            ✅
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E2E8F0] p-4 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">In Meta Review</p>
            <h3 className="text-2xl font-black text-amber-700 mt-1">{pendingCount}</h3>
            <p className="text-[11px] text-amber-600 mt-0.5">Est. time: ~15 mins</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl font-bold">
            ⏳
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E2E8F0] p-4 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Needs Attention</p>
            <h3 className="text-2xl font-black text-red-600 mt-1">{rejectedCount}</h3>
            <p className="text-[11px] text-red-500 mt-0.5">Rejected by Meta</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-red-50 text-red-600 flex items-center justify-center text-xl font-bold">
            ⚠️
          </div>
        </div>
      </div>

      {/* ── TOOLBAR: SEARCH & FILTERS ── */}
      <div className="bg-[#FFFFFF] border border-[#E2E8F0] p-3.5 rounded-2xl shadow-sm flex flex-col md:flex-row items-center gap-3 justify-between">
        {/* Search */}
        <div className="w-full md:w-80 relative">
          <input
            type="text"
            placeholder="Search templates by name, content, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] focus:border-[#534AB7] focus:bg-white focus:outline-none"
          />
          <svg className="w-4 h-4 text-[#94A3B8] absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-[#0F172A] font-semibold focus:border-[#534AB7] focus:outline-none"
          >
            <option value="ALL">All Categories</option>
            <option value="MARKETING">Marketing</option>
            <option value="UTILITY">Utility</option>
            <option value="AUTHENTICATION">Authentication</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-[#0F172A] font-semibold focus:border-[#534AB7] focus:outline-none"
          >
            <option value="ALL">All Status</option>
            <option value="APPROVED">Approved Only</option>
            <option value="PENDING">Pending Review</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* ── TEMPLATES GRID ── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-56 bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl animate-pulse p-5" />
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title="Failed to load templates"
          message={error.message}
          httpCode={error.httpCode}
          errorCode={error.errorCode}
          onRetry={loadTemplates}
        />
      ) : filteredTemplates.length === 0 ? (
        <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-3xl p-12 text-center shadow-sm space-y-4 max-w-lg mx-auto">
          <div className="w-14 h-14 bg-[#F3F2FD] text-[#534AB7] rounded-2xl flex items-center justify-center text-2xl mx-auto shadow-sm">
            📝
          </div>
          <div>
            <h3 className="text-base font-bold text-[#0F172A]">No Templates Found</h3>
            <p className="text-xs text-[#64748B] mt-1 max-w-xs mx-auto">
              {searchQuery || categoryFilter !== 'ALL' || statusFilter !== 'ALL'
                ? 'No templates match your current filter criteria.'
                : 'Create your first Meta-approved template to start sending broadcast campaigns.'}
            </p>
          </div>
          <PrimaryButton onClick={() => { setPrefill(null); setCreating(true); }}>
            + Create WhatsApp Template
          </PrimaryButton>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTemplates.map((t) => (
            <EnterpriseTemplateCard
              key={t.id}
              template={t}
              onSync={loadTemplates}
              onResubmit={openResubmit}
            />
          ))}
        </div>
      )}

      {/* ── CREATE / EDIT MODAL ── */}
      {creating && (
        <CreateTemplateModal
          onClose={closeModal}
          prefill={prefill}
          onCreated={() => { loadTemplates(); closeModal(); }}
        />
      )}
    </div>
  );
}
