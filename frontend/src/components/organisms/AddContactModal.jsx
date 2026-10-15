/**
 * VDAJ Services — AddContactModal
 * ────────────────────────────────────────────────────────────
 * Manual 1-by-1 contact creation with:
 * - Real-time E.164 phone formatting & country prefix selector
 * - Name, email, and tags multi-input
 * - Contact List / Group assignment (with inline new group creation)
 * - Meta BSP Opt-in consent proof logging
 */

import React, { useState, useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { contactApi } from '../../lib/api';
import { showSuccess, showError } from '../atoms/Toast/Toast.jsx';

const COUNTRY_CODES = [
  { code: '+91', country: 'India', flag: '🇮🇳' },
  { code: '+1',  country: 'US/Canada', flag: '🇺🇸' },
  { code: '+44', country: 'UK', flag: '🇬🇧' },
  { code: '+971', country: 'UAE', flag: '🇦🇪' },
  { code: '+65', country: 'Singapore', flag: '🇸🇬' },
  { code: '+61', country: 'Australia', flag: '🇦🇺' },
  { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦' },
  { code: '+49', country: 'Germany', flag: '🇩🇪' },
  { code: '+33', country: 'France', flag: '🇫🇷' },
];

const CONSENT_SOURCES = [
  { id: 'manual',    label: 'Direct / In-Person Entry' },
  { id: 'verbal',    label: 'Customer Inbound / Verbal Request' },
  { id: 'web_form',  label: 'Website Sign-up / Contact Form' },
  { id: 'order',     label: 'Customer Order / Transaction' },
  { id: 'import',    label: 'Offline Database / CRM' },
];

export default function AddContactModal({
  isOpen,
  onClose,
  onSuccess,
  lists = [],
  existingTags = [],
  defaultListId = '',
}) {
  const [countryCode, setCountryCode]   = useState('+91');
  const [phoneNumber, setPhoneNumber]   = useState('');
  const [firstName, setFirstName]       = useState('');
  const [lastName, setLastName]         = useState('');
  const [email, setEmail]               = useState('');
  const [selectedListId, setSelectedListId] = useState(defaultListId || '');
  const [newListName, setNewListName]   = useState('');
  const [isCreatingList, setIsCreatingList] = useState(false);
  
  // Tags
  const [tags, setTags]                 = useState([]);
  const [tagInput, setTagInput]         = useState('');
  
  // Consent
  const [optInSource, setOptInSource]   = useState('manual');
  const [optInProof, setOptInProof]     = useState('Direct addition via web portal');

  // Custom variables
  const [showCustomVars, setShowCustomVars] = useState(false);
  const [customVars, setCustomVars]     = useState([{ key: '', value: '' }]);

  const [loading, setLoading]           = useState(false);
  const [errorMsg, setErrorMsg]         = useState('');

  const phoneInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedListId(defaultListId || '');
      setErrorMsg('');
      setPhoneNumber('');
      setFirstName('');
      setLastName('');
      setEmail('');
      setTags([]);
      setTagInput('');
      setIsCreatingList(false);
      setNewListName('');
      setTimeout(() => phoneInputRef.current?.focus(), 80);
    }
  }, [isOpen, defaultListId]);

  if (!isOpen) return null;

  // Clean local phone number
  const cleanLocal = phoneNumber.replace(/[\s\-().]/g, '');
  let fullE164 = '';
  let isValidE164 = false;

  if (cleanLocal) {
    if (cleanLocal.startsWith('+')) {
      fullE164 = cleanLocal;
    } else {
      // Strip leading zero if present
      const stripped = cleanLocal.replace(/^0+/, '');
      fullE164 = countryCode + stripped;
    }
    isValidE164 = /^\+[1-9]\d{7,14}$/.test(fullE164);
  }

  // Tag helper
  const handleAddTag = (raw) => {
    const clean = String(raw || tagInput).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 30);
    if (!clean || tags.includes(clean)) {
      setTagInput('');
      return;
    }
    setTags([...tags, clean]);
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag(tagInput);
    }
  };

  // Custom vars helper
  const handleAddCustomVar = () => {
    setCustomVars([...customVars, { key: '', value: '' }]);
  };

  const handleUpdateCustomVar = (index, field, val) => {
    const updated = [...customVars];
    updated[index][field] = val;
    setCustomVars(updated);
  };

  const handleRemoveCustomVar = (index) => {
    setCustomVars(customVars.filter((_, i) => i !== index));
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!phoneNumber.trim()) {
      setErrorMsg('Please enter a phone number.');
      phoneInputRef.current?.focus();
      return;
    }

    if (!isValidE164) {
      setErrorMsg(`Invalid phone format "${fullE164}". Must be a valid international number (e.g. +91 98888 73138).`);
      return;
    }

    setLoading(true);

    try {
      let targetListId = selectedListId || undefined;

      // If user typed a new group name, create it first
      if (isCreatingList && newListName.trim()) {
        try {
          const listRes = await contactApi.createList({
            name: newListName.trim(),
            description: 'Created during manual contact addition',
          });
          if (listRes.data?.id) {
            targetListId = listRes.data.id;
          }
        } catch (err) {
          console.warn('Could not create contact list:', err);
        }
      }

      // Convert custom vars array to object
      const varsObj = {};
      customVars.forEach(({ key, value }) => {
        if (key.trim()) {
          varsObj[key.trim()] = value.trim();
        }
      });

      const payload = {
        phoneE164: fullE164,
        firstName: firstName.trim() || undefined,
        lastName:  lastName.trim() || undefined,
        email:     email.trim() || undefined,
        tags:      tags,
        listId:    targetListId,
        opt_in_source: optInSource,
        opt_in_proof:  optInProof.trim() || 'Manual entry via dashboard',
        customVars: varsObj,
      };

      const res = await contactApi.create(payload);
      showSuccess(`Contact ${fullE164} added successfully.`);
      if (onSuccess) onSuccess(res.data);
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to add contact.';
      setErrorMsg(msg);
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose(); }}
    >
      <div className="w-full max-w-xl bg-[#FFFFFF] border border-[#E2E8F0] rounded-3xl shadow-2xl animate-scale-in overflow-hidden max-h-[92vh] flex flex-col">
        {/* ── Modal Header ────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] bg-[#FFFFFF] shrink-0">
          <div>
            <h2 className="text-base font-bold text-[#0F172A] tracking-tight flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-[#534AB7]/10 text-[#534AB7] flex items-center justify-center text-xs font-bold">
                +
              </span>
              Add Contact
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Add a single contact with phone validation and audience grouping
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Modal Form Body ─────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-2">
              <span className="shrink-0 font-bold">✕</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ── Phone Number with Country Code ────────────────── */}
          <div>
            <label className="block text-xs font-bold text-[#334155] mb-1.5">
              WhatsApp Phone Number <span className="text-red-500">*</span>
            </label>
            <div className="flex items-stretch gap-2">
              {/* Country Code Picker */}
              <div className="relative shrink-0">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="h-10 px-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs font-semibold text-[#0F172A] appearance-none pr-8 cursor-pointer hover:border-[#534AB7] focus:outline-none focus:ring-2 focus:ring-[#534AB7]/20"
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.code} ({c.country})
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#64748B]">
                  ▼
                </div>
              </div>

              {/* Number Input */}
              <div className="flex-1 relative">
                <input
                  ref={phoneInputRef}
                  type="tel"
                  placeholder="e.g. 98888 73138"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className={clsx(
                    'w-full h-10 px-3 bg-[#FFFFFF] border rounded-xl text-sm font-mono text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 transition-all',
                    phoneNumber && !isValidE164 && 'border-amber-400 focus:ring-amber-200',
                    phoneNumber && isValidE164 && 'border-emerald-500 focus:ring-emerald-200',
                    !phoneNumber && 'border-[#CBD5E1] focus:ring-[#534AB7]/20 focus:border-[#534AB7]'
                  )}
                  required
                />
              </div>
            </div>

            {/* Live E.164 preview */}
            <div className="mt-1.5 flex items-center justify-between text-2xs">
              <span className="text-[#64748B]">
                Standard international E.164 format with country code
              </span>
              {fullE164 && (
                <span className={clsx('font-mono font-semibold', isValidE164 ? 'text-emerald-600' : 'text-amber-600')}>
                  {isValidE164 ? `✓ ${fullE164}` : `⚠ ${fullE164}`}
                </span>
              )}
            </div>
          </div>

          {/* ── Names ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#334155] mb-1">First Name</label>
              <input
                type="text"
                placeholder="e.g. Shankar"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full h-9 px-3 bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#334155] mb-1">Last Name</label>
              <input
                type="text"
                placeholder="e.g. Channe"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full h-9 px-3 bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7]"
              />
            </div>
          </div>

          {/* ── Email ─────────────────────────────────────────── */}
          <div>
            <label className="block text-xs font-bold text-[#334155] mb-1">
              Email Address <span className="text-2xs font-normal text-[#64748B]">(Optional)</span>
            </label>
            <input
              type="email"
              placeholder="e.g. contact@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-9 px-3 bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#534AB7]/20 focus:border-[#534AB7]"
            />
          </div>

          {/* ── Group / Contact List Assignment ───────────────── */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-[#334155]">
                Group / Audience List
              </label>
              <button
                type="button"
                onClick={() => setIsCreatingList(!isCreatingList)}
                className="text-2xs font-semibold text-[#534AB7] hover:underline"
              >
                {isCreatingList ? 'Choose existing group' : '+ Create new group'}
              </button>
            </div>

            {isCreatingList ? (
              <input
                type="text"
                placeholder="New group name (e.g. Diwali Campaign 2026)"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                className="w-full h-9 px-3 bg-[#FFFFFF] border border-[#534AB7] rounded-xl text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#534AB7]/20"
              />
            ) : (
              <select
                value={selectedListId}
                onChange={(e) => setSelectedListId(e.target.value)}
                className="w-full h-9 px-3 bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#534AB7]/20"
              >
                <option value="">No group (Unassigned)</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    📁 {l.name} {l.contact_count ? `(${l.contact_count} contacts)` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* ── Tags Multi-input ──────────────────────────────── */}
          <div>
            <label className="block text-xs font-bold text-[#334155] mb-1">
              Tags <span className="text-2xs font-normal text-[#64748B]">(Press Enter to add)</span>
            </label>
            <div className="p-2 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl flex items-center flex-wrap gap-1.5 focus-within:border-[#534AB7]">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 text-2xs font-bold px-2 py-0.5 rounded-full bg-[#534AB7]/10 text-[#534AB7] border border-[#534AB7]/20"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-red-500 text-xs leading-none"
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                type="text"
                placeholder={tags.length === 0 ? "Type tag e.g. 'VIP', 'Lead'..." : "Add tag..."}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={() => { if (tagInput.trim()) handleAddTag(tagInput); }}
                className="flex-1 min-w-[120px] bg-transparent text-xs text-[#0F172A] focus:outline-none placeholder-[#94A3B8]"
              />
            </div>

            {/* Quick suggested existing tags */}
            {existingTags.length > 0 && (
              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                <span className="text-2xs text-[#64748B]">Suggestions:</span>
                {existingTags.slice(0, 6).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleAddTag(t)}
                    disabled={tags.includes(t)}
                    className={clsx(
                      'text-2xs font-medium px-1.5 py-0.5 rounded-md border transition-all',
                      tags.includes(t)
                        ? 'opacity-40 border-transparent bg-slate-100 text-slate-400'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-[#534AB7] hover:text-[#534AB7]'
                    )}
                  >
                    + {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── WhatsApp Opt-In Source (Meta BSP Compliance) ──── */}
          <div className="p-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-2xl space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs">🛡️</span>
              <span className="text-xs font-bold text-[#166534]">
                Meta WhatsApp Opt-In Consent
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-2xs font-semibold text-[#166534] mb-1">
                  Consent Source
                </label>
                <select
                  value={optInSource}
                  onChange={(e) => setOptInSource(e.target.value)}
                  className="w-full h-8 px-2 bg-white border border-[#86EFAC] rounded-lg text-2xs font-medium text-[#166534] focus:outline-none"
                >
                  {CONSENT_SOURCES.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-2xs font-semibold text-[#166534] mb-1">
                  Consent Proof Note
                </label>
                <input
                  type="text"
                  value={optInProof}
                  onChange={(e) => setOptInProof(e.target.value)}
                  placeholder="e.g. Walk-in customer consent"
                  className="w-full h-8 px-2 bg-white border border-[#86EFAC] rounded-lg text-2xs text-[#166534] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* ── Custom Template Variables (Collapsible) ────────── */}
          <div className="border border-[#E2E8F0] rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowCustomVars(!showCustomVars)}
              className="w-full px-4 py-2.5 bg-[#F8FAFC] text-left flex items-center justify-between text-xs font-bold text-[#334155] hover:bg-[#F1F5F9]"
            >
              <span>Custom Variables for Templates (Optional)</span>
              <span>{showCustomVars ? '▲' : '▼'}</span>
            </button>
            {showCustomVars && (
              <div className="p-3 space-y-2 bg-white">
                <p className="text-2xs text-[#64748B]">
                  Used for dynamic placeholders in templates (e.g. {`{{city}}`}, {`{{company}}`}).
                </p>
                {customVars.map((v, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Key (e.g. city)"
                      value={v.key}
                      onChange={(e) => handleUpdateCustomVar(i, 'key', e.target.value)}
                      className="flex-1 h-8 px-2.5 border border-[#CBD5E1] rounded-lg text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Value (e.g. Mumbai)"
                      value={v.value}
                      onChange={(e) => handleUpdateCustomVar(i, 'value', e.target.value)}
                      className="flex-1 h-8 px-2.5 border border-[#CBD5E1] rounded-lg text-xs"
                    />
                    {customVars.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomVar(i)}
                        className="text-red-500 hover:text-red-700 text-xs px-1"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddCustomVar}
                  className="text-2xs font-semibold text-[#534AB7] hover:underline"
                >
                  + Add another variable
                </button>
              </div>
            )}
          </div>
        </form>

        {/* ── Modal Footer ────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="h-10 px-4 text-xs font-bold text-[#64748B] hover:text-[#0F172A] hover:bg-[#E2E8F0] rounded-xl transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className={clsx(
              'h-10 px-5 text-xs font-bold text-white rounded-xl shadow-md transition-all flex items-center gap-2',
              loading ? 'opacity-60 cursor-not-allowed' : 'hover:brightness-110 active:scale-95'
            )}
            style={{ background: 'linear-gradient(135deg,#534AB7,#3B3499)' }}
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              'Save Contact'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
