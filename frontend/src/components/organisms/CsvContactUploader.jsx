/**
 * VDAJ Services — Enterprise CSV Contact Uploader
 * ────────────────────────────────────────────────────────────
 * High-performance contact importer with automatic column detection,
 * sample CSV template generator, audience grouping, multi-tagging,
 * and Meta BSP compliance consent logging.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { clsx } from 'clsx';
import { contactApi } from '../../lib/api';
import { showSuccess, showError, showWarning } from '../atoms/Toast/Toast.jsx';

// ── E.164 Sanitiser ───────────────────────────────────────────
function sanitizeE164(raw) {
  if (!raw) return null;
  let p = String(raw).trim().replace(/[\s\-().]/g, '');
  if (!p.startsWith('+')) p = '+' + p;
  return /^\+[1-9]\d{7,14}$/.test(p) ? p : null;
}

// ── Column auto-mapper ────────────────────────────────────────
function detectColumns(headers) {
  const find = (keywords) =>
    headers.findIndex((h) => keywords.some((kw) => h.includes(kw)));

  return {
    phoneIdx:     find(['phone', 'mobile', 'number', 'tel', 'whatsapp']),
    firstNameIdx: find(['first', 'fname']),
    lastNameIdx:  find(['last', 'lname', 'surname']),
    nameIdx:      find(['name']),
    emailIdx:     find(['email', 'mail']),
  };
}

// ── PapaParse-style CSV parser ────────────────────────────────
function parseCSVText(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 1) return [];

  const parseRow = (line) => {
    const result = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === ',' && !inQuote) {
        result.push(cur.trim()); cur = '';
      } else {
        cur += ch;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const headers = parseRow(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9_]/g, ''));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = parseRow(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = cols[idx] || ''; });
    obj.__lineNumber = i + 1;
    obj.__rawCols = cols;
    rows.push(obj);
  }

  return { headers, rows };
}

// ── Process CSV text → {valid, invalid, headers} ──────────────
function processCSV(text) {
  const { headers, rows } = parseCSVText(text);
  const col = detectColumns(headers);

  const valid = [];
  const invalid = [];

  for (const row of rows) {
    const rawPhone =
      col.phoneIdx >= 0   ? row.__rawCols[col.phoneIdx]   :
      col.nameIdx  >= 0   ? row.__rawCols[0] : '';

    const phone = sanitizeE164(rawPhone);

    let firstName = col.firstNameIdx >= 0 ? row.__rawCols[col.firstNameIdx] : '';
    let lastName  = col.lastNameIdx  >= 0 ? row.__rawCols[col.lastNameIdx]  : '';

    if (!firstName && col.nameIdx >= 0) {
      const parts = (row.__rawCols[col.nameIdx] || '').split(' ');
      firstName = parts[0] || '';
      lastName  = parts.slice(1).join(' ') || '';
    }

    const email = col.emailIdx >= 0 ? row.__rawCols[col.emailIdx] : '';

    const reservedIdx = new Set([
      col.phoneIdx, col.firstNameIdx, col.lastNameIdx, col.nameIdx, col.emailIdx,
    ].filter((i) => i >= 0));

    const customVars = {};
    headers.forEach((h, idx) => {
      if (!reservedIdx.has(idx) && row.__rawCols[idx]) {
        customVars[h] = row.__rawCols[idx];
      }
    });

    const entry = {
      phoneE164:  phone,
      rawPhone,
      firstName:  firstName.trim(),
      lastName:   lastName.trim(),
      email:      email.trim() || null,
      customVars: Object.keys(customVars).length ? customVars : undefined,
      lineNumber: row.__lineNumber,
    };

    if (phone) { valid.push(entry); }
    else        { invalid.push({ ...entry, reason: 'invalid_e164' }); }
  }

  return { valid, invalid, headers };
}

function Pill({ ok, children }) {
  return (
    <span className={clsx(
      'inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full',
      ok
        ? 'bg-[#E8F9F4] text-[#148059] border border-[#A3E4D0]'
        : 'bg-red-50 text-red-700 border border-red-200'
    )}>
      {ok ? '✓' : '✗'} {children}
    </span>
  );
}

function UploadIcon({ active }) {
  return (
    <div
      className={clsx(
        'w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 transition-all duration-200',
        active ? 'bg-[#534AB7] text-white scale-110' : 'bg-[#F3F2FD] text-[#534AB7]'
      )}
    >
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
    </div>
  );
}

const OPT_IN_SOURCES = [
  { value: 'manual',          label: 'Offline / verbal consent (store visit, call)' },
  { value: 'web_form',        label: 'Website opt-in / contact form' },
  { value: 'transactional',   label: 'Purchased product/service (transactional)' },
  { value: 'inbound_message', label: 'Inbound WhatsApp message from them' },
  { value: 'import',          label: 'General client database (explicit consent obtained)' },
];

export default function CsvContactUploader({ isOpen, onClose, onImported, lists = [] }) {
  const [step, setStep]                 = useState('drop'); // drop | preview | done
  const [dragging, setDragging]         = useState(false);
  const [filename, setFilename]         = useState('');
  const [valid, setValid]               = useState([]);
  const [invalid, setInvalid]           = useState([]);
  const [listOption, setListOption]     = useState('existing'); // 'existing' | 'new' | 'none'
  const [selectedList, setSelectedList] = useState('');
  const [newListName, setNewListName]   = useState('');
  const [tagsInput, setTagsInput]       = useState('');
  const [optInSource, setOptInSource]   = useState('manual');
  const [importing, setImporting]       = useState(false);
  const [result, setResult]             = useState(null);
  const inputRef = useRef();

  // Reset when opened/closed
  useEffect(() => {
    if (!isOpen) {
      setStep('drop');
      setDragging(false);
      setFilename('');
      setValid([]);
      setInvalid([]);
      setResult(null);
      setImporting(false);
      setListOption(lists.length > 0 ? 'existing' : 'new');
      setSelectedList(lists[0]?.id || '');
      setNewListName('');
      setTagsInput('');
      setOptInSource('manual');
    } else {
      if (lists.length > 0 && !selectedList) {
        setSelectedList(lists[0].id);
      }
    }
  }, [isOpen, lists]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // ── Download Sample CSV Template ────────────────────────────
  const handleDownloadTemplate = () => {
    const headers = 'phone,first_name,last_name,email,var1,var2';
    const sample1 = '+919876543210,Rajesh,Sharma,rajesh@example.com,VIP,Special Offer';
    const sample2 = '+919864008174,Priya,Patel,priya@example.com,Customer,20% Discount';
    const csvContent = `${headers}\n${sample1}\n${sample2}\n`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'vdaj_contacts_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSuccess('Sample contacts template downloaded (.csv)');
  };

  const handleFile = useCallback((file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      showError('Please upload a .csv file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showError('CSV file must be under 10 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const { valid: v, invalid: inv } = processCSV(e.target.result);
      setFilename(file.name);
      setValid(v);
      setInvalid(inv);
      setStep('preview');
      if (inv.length > 0) {
        showWarning(`${inv.length} row${inv.length !== 1 ? 's' : ''} had invalid phone numbers and will be skipped.`);
      }
      if (v.length === 0) {
        showError('No valid phone numbers found in this file.');
        setStep('drop');
      }
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const handleImport = async () => {
    if (!valid.length) return;
    if (!optInSource) {
      showError('Please select how these contacts gave consent.', 'ERR_VDAJ_VAL_001');
      return;
    }

    setImporting(true);
    try {
      const proofText = `CSV import · source: ${optInSource} · file: ${filename}`;
      const targetListId = listOption === 'existing' ? selectedList || undefined : undefined;
      const targetNewList = listOption === 'new' ? newListName.trim() || undefined : undefined;
      const tagsArray = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);

      const res = await contactApi.bulkImport(
        valid,
        targetListId,
        optInSource,
        proofText,
        tagsArray,
        targetNewList
      );

      setResult(res.data);
      setStep('done');
      showSuccess(`Import complete — ${res.data.inserted} new, ${res.data.updated} updated.`);
      onImported?.(res.data);
    } catch {
      // Toast fired by Axios interceptor
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl bg-[#FFFFFF] border border-[#E2E8F0] rounded-3xl shadow-2xl animate-scale-in overflow-hidden max-h-[92vh] flex flex-col">
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] bg-[#FFFFFF] shrink-0">
          <div>
            <h2 className="text-base font-bold text-[#0F172A] tracking-tight">
              Import Contacts from CSV
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Max 5,000 contacts per upload · E.164 phone numbers with country code
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0F172A] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────── */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* ── Step 1: Drop & Template ────────────────────────── */}
          {step === 'drop' && (
            <>
              {/* Download Sample Template Banner */}
              <div className="p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#E8F9F4] text-[#148059] flex items-center justify-center text-base shrink-0">
                    📥
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#0F172A]">Need a pre-formatted template?</p>
                    <p className="text-[11px] text-[#64748B]">
                      Download our sample CSV with proper phone and variable columns.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-3 py-1.5 text-xs font-bold text-[#534AB7] bg-[#FFFFFF] hover:bg-[#F3F2FD] border border-[#CBD5E1] rounded-xl transition-all shrink-0 shadow-sm"
                >
                  Download Template (.csv)
                </button>
              </div>

              {/* Drag and drop area */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={clsx(
                  'relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200',
                  dragging
                    ? 'border-[#534AB7] bg-[#F3F2FD]/50 scale-[1.01]'
                    : 'border-[#CBD5E1] bg-[#F8FAFC] hover:border-[#534AB7]/50 hover:bg-[#F1F5F9]'
                )}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files[0])}
                />
                <UploadIcon active={dragging} />
                <p className="text-sm font-bold text-[#0F172A]">
                  {dragging ? 'Drop your CSV file here!' : 'Drag & drop your CSV file here'}
                </p>
                <p className="text-xs text-[#64748B] mt-1">
                  or click to browse from your computer · .csv format only
                </p>
              </div>

              {/* Column guide */}
              <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl p-4 space-y-2">
                <p className="text-xs font-bold text-[#0F172A]">
                  Expected Column Headers (Auto-detected):
                </p>
                <div className="flex flex-wrap gap-2">
                  {['phone *', 'first_name', 'last_name', 'email', 'var1', 'var2'].map((c) => (
                    <span
                      key={c}
                      className={clsx(
                        'font-mono text-xs px-2.5 py-1 rounded-lg border',
                        c.endsWith('*')
                          ? 'bg-[#F3F2FD] text-[#534AB7] border-[#E6E4F5] font-bold'
                          : 'bg-[#F8FAFC] text-[#475569] border-[#E2E8F0]'
                      )}
                    >
                      {c}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-[#64748B] leading-relaxed">
                  Phone numbers must include country code (e.g. <code className="font-mono text-[#534AB7]">+919876543210</code>). Any extra columns map to template variables automatically.
                </p>
              </div>
            </>
          )}

          {/* ── Step 2: Preview & Configure ────────────────────── */}
          {step === 'preview' && (
            <>
              {/* Summary Bar */}
              <div className="flex items-center justify-between gap-3 p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl">
                <div className="flex items-center gap-2 truncate">
                  <span className="text-xs font-bold text-[#0F172A] truncate">{filename}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Pill ok>{valid.length} Valid</Pill>
                  {invalid.length > 0 && <Pill ok={false}>{invalid.length} Skipped</Pill>}
                </div>
              </div>

              {/* Table Preview */}
              <div className="border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm">
                <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-[#F1F5F9] border-b border-[#E2E8F0] text-[11px] font-bold text-[#475569] uppercase tracking-wider">
                  <span className="col-span-5">Phone</span>
                  <span className="col-span-3">First Name</span>
                  <span className="col-span-2">Last Name</span>
                  <span className="col-span-2 text-right">Status</span>
                </div>

                <div className="max-h-40 overflow-y-auto divide-y divide-[#E2E8F0] text-xs">
                  {valid.slice(0, 5).map((r, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 px-3 py-2 items-center text-[#334155]">
                      <span className="col-span-5 font-mono text-[#534AB7] font-semibold truncate">{r.phoneE164}</span>
                      <span className="col-span-3 truncate">{r.firstName || '—'}</span>
                      <span className="col-span-2 truncate">{r.lastName || '—'}</span>
                      <div className="col-span-2 flex justify-end">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#E8F9F4] text-[#148059]">Valid</span>
                      </div>
                    </div>
                  ))}
                  {invalid.slice(0, 2).map((r, i) => (
                    <div key={`inv-${i}`} className="grid grid-cols-12 gap-2 px-3 py-2 items-center bg-red-50/50 text-[#64748B]">
                      <span className="col-span-5 font-mono text-red-500 line-through truncate">{r.rawPhone}</span>
                      <span className="col-span-3 truncate">{r.firstName || '—'}</span>
                      <span className="col-span-2 truncate">{r.lastName || '—'}</span>
                      <div className="col-span-2 flex justify-end">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">Invalid</span>
                      </div>
                    </div>
                  ))}
                </div>

                {valid.length > 5 && (
                  <div className="px-3 py-1.5 bg-[#F8FAFC] border-t border-[#E2E8F0] text-center text-[11px] text-[#64748B]">
                    +{valid.length - 5} more valid contacts in this batch
                  </div>
                )}
              </div>

              {/* ── Groups / Contact Lists (MNC Standard) ────── */}
              <div className="space-y-2 pt-2 border-t border-[#E2E8F0]">
                <label className="block text-xs font-bold text-[#0F172A]">
                  Audience Group / Contact List
                </label>
                <div className="flex flex-wrap gap-2 text-xs">
                  {lists.length > 0 && (
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="listOption"
                        checked={listOption === 'existing'}
                        onChange={() => setListOption('existing')}
                        className="text-[#534AB7] focus:ring-[#534AB7]"
                      />
                      <span className="font-semibold text-[#0F172A]">Add to Existing List</span>
                    </label>
                  )}

                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="listOption"
                      checked={listOption === 'new'}
                      onChange={() => setListOption('new')}
                      className="text-[#534AB7] focus:ring-[#534AB7]"
                    />
                    <span className="font-semibold text-[#0F172A]">Create New List</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="listOption"
                      checked={listOption === 'none'}
                      onChange={() => setListOption('none')}
                      className="text-[#534AB7] focus:ring-[#534AB7]"
                    />
                    <span className="text-[#64748B]">No List (Save to All Contacts)</span>
                  </label>
                </div>

                {listOption === 'existing' && lists.length > 0 && (
                  <select
                    value={selectedList}
                    onChange={(e) => setSelectedList(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl text-[#0F172A] focus:border-[#534AB7] focus:outline-none font-semibold"
                  >
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.contact_count || 0} contacts)
                      </option>
                    ))}
                  </select>
                )}

                {listOption === 'new' && (
                  <input
                    type="text"
                    placeholder="e.g. September 2026 Customer Blast"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] focus:border-[#534AB7] focus:outline-none"
                  />
                )}
              </div>

              {/* ── Tags / Segment Assignment ────────────────── */}
              <div className="space-y-1 pt-2 border-t border-[#E2E8F0]">
                <label className="block text-xs font-bold text-[#0F172A]">
                  Assign Tags (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. VIP, Customer, Lead, Store Visit (comma separated)"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl text-[#0F172A] placeholder-[#94A3B8] focus:border-[#534AB7] focus:outline-none"
                />
                <p className="text-[11px] text-[#64748B]">
                  Tags enable fast audience filtering, smart segment campaigns, and inbox triage.
                </p>
              </div>

              {/* ── Consent / Opt-In Source (Required) ────────── */}
              <div className="space-y-1 pt-2 border-t border-[#E2E8F0]">
                <label className="block text-xs font-bold text-[#0F172A]">
                  How did these contacts give consent? <span className="text-[#E11D48]">*</span>
                </label>
                <select
                  value={optInSource}
                  onChange={(e) => setOptInSource(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl text-[#0F172A] focus:border-[#534AB7] focus:outline-none font-semibold"
                >
                  {OPT_IN_SOURCES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <p className="text-[11px] text-[#64748B]">
                  Required by Meta WhatsApp Business policies to maintain high phone number quality.
                </p>
              </div>
            </>
          )}

          {/* ── Step 3: Done ──────────────────────────────────── */}
          {step === 'done' && result && (
            <div className="flex flex-col items-center py-6 gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#E8F9F4] text-[#148059] flex items-center justify-center text-3xl shadow-sm">
                ✓
              </div>
              <div>
                <h3 className="text-lg font-black text-[#0F172A]">Contacts Imported Successfully</h3>
                <p className="text-xs text-[#64748B] mt-1">
                  Your contacts have been processed and saved to your workspace.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 w-full max-w-sm mt-2">
                <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl">
                  <p className="text-xl font-black text-[#148059]">{result.inserted}</p>
                  <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mt-0.5">New Contacts</p>
                </div>
                <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl">
                  <p className="text-xl font-black text-[#534AB7]">{result.updated}</p>
                  <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mt-0.5">Updated</p>
                </div>
                <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl">
                  <p className="text-xl font-black text-red-600">{result.invalidCount}</p>
                  <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mt-0.5">Skipped</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E2E8F0] bg-[#FFFFFF] shrink-0">
          {step === 'drop' && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-[#64748B] hover:text-[#0F172A] transition-colors"
            >
              Cancel
            </button>
          )}

          {step === 'preview' && (
            <>
              <button
                onClick={() => setStep('drop')}
                className="px-4 py-2 text-xs font-bold text-[#64748B] hover:text-[#0F172A] transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleImport}
                disabled={importing || valid.length === 0}
                className="px-5 py-2.5 text-xs font-bold text-white bg-[#534AB7] hover:bg-[#4339A6] rounded-xl transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
              >
                {importing ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    <span>Importing...</span>
                  </>
                ) : (
                  <span>Import {valid.length.toLocaleString()} Contacts</span>
                )}
              </button>
            </>
          )}

          {step === 'done' && (
            <button
              onClick={onClose}
              className="px-6 py-2.5 text-xs font-bold text-white bg-[#534AB7] hover:bg-[#4339A6] rounded-xl transition-all shadow-sm"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
