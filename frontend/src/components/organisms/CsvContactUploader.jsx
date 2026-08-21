/**
 * VDAJ Services — CSV Contact Uploader
 * Sprint 2: Full drag-and-drop modal with PapaParse, column auto-mapping,
 * E.164 sanitisation, preview table with valid/invalid pills,
 * and single-shot bulk API import.
 *
 * Props:
 *   isOpen    {boolean}
 *   onClose   {() => void}
 *   onImported {(result: {inserted, updated, invalidCount}) => void}
 *   lists     {Array<{id, name}>}  — optional contact lists for assignment
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { clsx } from 'clsx';
import { contactApi } from '../../lib/api';
import { showSuccess, showError, showWarning } from '../atoms/Toast/Toast.jsx';

// ── E.164 Sanitiser ───────────────────────────────────────────
// Auto-strips spaces, dashes, parentheses, dots. Prepends '+' if missing.
function sanitizeE164(raw) {
  if (!raw) return null;
  let p = String(raw).trim().replace(/[\s\-().]/g, '');
  if (!p.startsWith('+')) p = '+' + p;
  return /^\+[1-9]\d{7,14}$/.test(p) ? p : null;
}

// ── Column auto-mapper ────────────────────────────────────────
// Returns { phoneIdx, firstNameIdx, lastNameIdx, emailIdx, customIdxs }
function detectColumns(headers) {
  const find = (keywords) =>
    headers.findIndex((h) => keywords.some((kw) => h.includes(kw)));

  return {
    phoneIdx:     find(['phone', 'mobile', 'number', 'tel', 'whatsapp']),
    firstNameIdx: find(['first', 'fname']),
    lastNameIdx:  find(['last', 'lname', 'surname']),
    // 'name' alone maps to firstName when no first/last split
    nameIdx:      find(['name']),
    emailIdx:     find(['email', 'mail']),
  };
}

// ── PapaParse-style CSV parser (no dependency) ────────────────
// Handles quoted fields, CRLF, trailing commas.
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

// ── Parse + map CSV text → {valid, invalid, headers} ─────────
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

    // Derive name — prefer first/last split, fall back to 'name' column
    let firstName = col.firstNameIdx >= 0 ? row.__rawCols[col.firstNameIdx] : '';
    let lastName  = col.lastNameIdx  >= 0 ? row.__rawCols[col.lastNameIdx]  : '';

    if (!firstName && col.nameIdx >= 0) {
      const parts = (row.__rawCols[col.nameIdx] || '').split(' ');
      firstName = parts[0] || '';
      lastName  = parts.slice(1).join(' ') || '';
    }

    const email = col.emailIdx >= 0 ? row.__rawCols[col.emailIdx] : '';

    // Collect any unmapped columns into customVars
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

// ── Status Pill ───────────────────────────────────────────────
function Pill({ ok, children }) {
  return (
    <span className={clsx(
      'inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full',
      ok
        ? 'bg-[#1D9E75]/15 text-[#1D9E75] border border-[#1D9E75]/25'
        : 'bg-red-500/15 text-red-400 border border-red-500/25'
    )}>
      {ok ? '✓' : '✗'} {children}
    </span>
  );
}

// ── Upload icon ───────────────────────────────────────────────
const UploadIcon = ({ active }) => (
  <svg className={clsx('w-10 h-10 mx-auto mb-3 transition-colors duration-200',
    active ? 'text-[#534AB7]' : 'text-[#5A5A6E]/40 dark:text-white/20')}
    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
  </svg>
);

// ── Main Component ────────────────────────────────────────────
// Consent source options (BSP-compliant)
const OPT_IN_SOURCES = [
  { value: 'web_form',        label: 'They shared number via web / landing page form' },
  { value: 'click_to_chat',   label: 'WhatsApp click-to-chat button on our website' },
  { value: 'manual',          label: 'Offline / verbal consent (store visit, call)' },
  { value: 'transactional',   label: 'Purchased product/service (transactional only)' },
  { value: 'inbound_message', label: 'Inbound WhatsApp message from them' },
];

export default function CsvContactUploader({ isOpen, onClose, onImported, lists = [] }) {
  const [step, setStep]             = useState('drop'); // drop | preview | importing | done
  const [dragging, setDragging]     = useState(false);
  const [filename, setFilename]     = useState('');
  const [valid, setValid]           = useState([]);
  const [invalid, setInvalid]       = useState([]);
  const [selectedList, setSelectedList] = useState('');
  const [optInSource, setOptInSource]   = useState('');
  const [importing, setImporting]   = useState(false);
  const [result, setResult]         = useState(null);
  const inputRef = useRef();

  // Reset when closed
  useEffect(() => {
    if (!isOpen) {
      setStep('drop'); setDragging(false); setFilename('');
      setValid([]); setInvalid([]); setResult(null); setImporting(false);
      setOptInSource('');
    }
  }, [isOpen]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleFile = useCallback((file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      showError('Please upload a .csv file.'); return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showError('CSV file must be under 5 MB.'); return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const { valid: v, invalid: inv } = processCSV(e.target.result);
      setFilename(file.name);
      setValid(v);
      setInvalid(inv);
      setStep('preview');
      if (inv.length > 0) {
        showWarning(`${inv.length} row${inv.length !== 1 ? 's' : ''} had unreadable phone numbers and will be skipped.`);
      }
      if (v.length === 0) {
        showError('No valid phone numbers found in this file.');
        setStep('drop');
      }
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const handleImport = async () => {
    if (!valid.length) return;
    if (!optInSource) { showError('Please select how these contacts gave consent.'); return; }
    setImporting(true);
    try {
      const proofText = `CSV import · source: ${optInSource} · file: ${filename}`;
      const res = await contactApi.bulkImport(
        valid,
        selectedList || undefined,
        optInSource,
        proofText
      );
      setResult(res.data);
      setStep('done');
      showSuccess(`Import complete — ${res.data.inserted} new, ${res.data.updated} updated.`);
      onImported?.(res.data);
    } catch {
      // Error toast fired by Axios interceptor
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl animate-scale-in"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--bg-border)',
        }}
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: 'var(--bg-border)' }}>
          <div>
            <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
              Import Contacts from CSV
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Max 5,000 contacts per file · phone, first_name, last_name, email
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:opacity-70"
            style={{ background: 'var(--bg-elevated)' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2} style={{ color: 'var(--text-muted)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────── */}
        <div className="p-6 space-y-5">

          {/* ── Step: Drop ────────────────────────────────── */}
          {step === 'drop' && (
            <>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={clsx(
                  'relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer',
                  'transition-all duration-200',
                  dragging
                    ? 'border-[#534AB7] scale-[1.01]'
                    : 'hover:border-[#534AB7]/50'
                )}
                style={{
                  borderColor: dragging ? '#534AB7' : 'var(--bg-border)',
                  background: dragging ? 'rgba(83,74,183,0.06)' : 'var(--bg-elevated)',
                }}
              >
                <input
                  ref={inputRef} type="file" accept=".csv"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files[0])}
                />
                <UploadIcon active={dragging} />
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {dragging ? 'Drop it here!' : 'Drag & drop your CSV file'}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  or click to browse · .csv only · max 5 MB
                </p>
              </div>

              {/* Column guide */}
              <div className="rounded-2xl p-4" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}>
                <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Expected CSV columns (auto-detected)
                </p>
                <div className="flex flex-wrap gap-2">
                  {['phone *', 'first_name', 'last_name', 'email', 'any extra columns → custom_vars'].map((c) => (
                    <span key={c} className="font-mono text-2xs px-2 py-1 rounded-lg"
                      style={{
                        background: c.endsWith('*') ? 'rgba(83,74,183,0.12)' : 'var(--bg-card)',
                        color: c.endsWith('*') ? '#AFA9EC' : 'var(--text-muted)',
                        border: '1px solid var(--bg-border)',
                      }}>
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Step: Preview ─────────────────────────────── */}
          {step === 'preview' && (
            <>
              {/* Summary bar */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-semibold truncate flex-1"
                  style={{ color: 'var(--text-primary)' }}>
                  {filename}
                </span>
                <Pill ok>{valid.length} valid</Pill>
                {invalid.length > 0 && <Pill ok={false}>{invalid.length} invalid</Pill>}
              </div>

              {/* Preview table */}
              <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--bg-border)' }}>
                {/* Header */}
                <div className="grid grid-cols-12 gap-3 px-4 py-2.5"
                  style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--bg-border)' }}>
                  {['Phone', 'First Name', 'Last Name', 'Status'].map((h, i) => (
                    <span key={h}
                      className={clsx('text-2xs font-semibold uppercase tracking-wider',
                        i === 0 ? 'col-span-4' : i === 3 ? 'col-span-2 text-right' : 'col-span-3')}
                      style={{ color: 'var(--text-muted)' }}>
                      {h}
                    </span>
                  ))}
                </div>

                {/* Rows: show first 8 valid + up to 3 invalid */}
                <div className="max-h-52 overflow-y-auto divide-y"
                  style={{ divideColor: 'var(--bg-border)' }}>
                  {valid.slice(0, 8).map((r, i) => (
                    <div key={i} className="grid grid-cols-12 gap-3 px-4 py-2.5 items-center">
                      <span className="col-span-4 text-xs font-mono truncate"
                        style={{ color: '#AFA9EC' }}>{r.phoneE164}</span>
                      <span className="col-span-3 text-xs truncate"
                        style={{ color: 'var(--text-secondary)' }}>{r.firstName || '—'}</span>
                      <span className="col-span-3 text-xs truncate"
                        style={{ color: 'var(--text-secondary)' }}>{r.lastName || '—'}</span>
                      <div className="col-span-2 flex justify-end">
                        <Pill ok>Valid</Pill>
                      </div>
                    </div>
                  ))}
                  {invalid.slice(0, 3).map((r, i) => (
                    <div key={`inv-${i}`} className="grid grid-cols-12 gap-3 px-4 py-2.5 items-center"
                      style={{ background: 'rgba(239,68,68,0.04)' }}>
                      <span className="col-span-4 text-xs font-mono truncate text-red-400 line-through">
                        {r.rawPhone}</span>
                      <span className="col-span-3 text-xs truncate"
                        style={{ color: 'var(--text-muted)' }}>{r.firstName || '—'}</span>
                      <span className="col-span-3 text-xs truncate"
                        style={{ color: 'var(--text-muted)' }}>{r.lastName || '—'}</span>
                      <div className="col-span-2 flex justify-end">
                        <Pill ok={false}>Invalid</Pill>
                      </div>
                    </div>
                  ))}
                </div>

                {(valid.length > 8 || invalid.length > 3) && (
                  <div className="px-4 py-2 border-t text-center"
                    style={{ borderColor: 'var(--bg-border)', background: 'var(--bg-elevated)' }}>
                    <p className="text-2xs" style={{ color: 'var(--text-muted)' }}>
                      {valid.length > 8 && `+${valid.length - 8} more valid`}
                      {valid.length > 8 && invalid.length > 3 && ' · '}
                      {invalid.length > 3 && `+${invalid.length - 3} more invalid`}
                    </p>
                  </div>
                )}
              </div>

              {/* ── REQUIRED: Consent / opt-in source ────── */}
              <div>
                <label className="block text-xs font-semibold mb-1.5"
                  style={{ color: 'var(--text-secondary)' }}>
                  How did these contacts give consent?{' '}
                  <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={optInSource}
                  onChange={(e) => setOptInSource(e.target.value)}
                  className="w-full h-10 rounded-xl px-3 text-sm outline-none"
                  style={{
                    background: 'var(--bg-elevated)',
                    border: `1px solid ${optInSource ? 'var(--bg-border)' : '#ef4444'}`,
                    color: optInSource ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}
                >
                  <option value="">— Select consent source (required) —</option>
                  {OPT_IN_SOURCES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                {!optInSource && (
                  <p className="text-2xs mt-1" style={{ color: '#f87171' }}>
                    Required by Meta BSP policy — you must record how consent was obtained.
                  </p>
                )}
              </div>

              {/* Optional: assign to list */}
              {lists.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold mb-1.5"
                    style={{ color: 'var(--text-secondary)' }}>
                    Add to Contact List (optional)
                  </label>
                  <select
                    value={selectedList}
                    onChange={(e) => setSelectedList(e.target.value)}
                    className="w-full h-10 rounded-xl px-3 text-sm outline-none"
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--bg-border)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <option value="">— No list —</option>
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          {/* ── Step: Done ────────────────────────────────── */}
          {step === 'done' && result && (
            <div className="flex flex-col items-center py-8 gap-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(29,158,117,0.15)' }}>
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24"
                  stroke="#1D9E75" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>
                  Import Complete
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                  Your contacts have been added to the database.
                </p>
              </div>
              <div className="flex gap-4">
                {[
                  { label: 'New', value: result.inserted, color: '#1D9E75' },
                  { label: 'Updated', value: result.updated, color: '#534AB7' },
                  { label: 'Skipped', value: result.invalidCount, color: '#f87171' },
                ].map((s) => (
                  <div key={s.label} className="flex flex-col items-center gap-1 px-5 py-3 rounded-2xl"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}>
                    <span className="text-2xl font-black" style={{ color: s.color }}>{s.value}</span>
                    <span className="text-2xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-muted)' }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* ── Footer Actions ──────────────────────────────────── */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t"
          style={{ borderColor: 'var(--bg-border)', background: 'var(--bg-elevated)' }}>

          {step === 'drop' && (
            <button onClick={onClose}
              className="h-10 px-4 rounded-xl text-sm font-semibold transition-all hover:opacity-70"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)', color: 'var(--text-secondary)' }}>
              Cancel
            </button>
          )}

          {step === 'preview' && (
            <>
              <button onClick={() => setStep('drop')}
                className="h-10 px-4 rounded-xl text-sm font-semibold transition-all hover:opacity-70"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)', color: 'var(--text-secondary)' }}>
                ← Back
              </button>
              <button
                onClick={handleImport}
                disabled={importing || valid.length === 0 || !optInSource}
                className="h-10 px-5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#534AB7,#3B3499)' }}>
                {importing ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4"/>
                      <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Importing…
                  </span>
                ) : (
                  `Import ${valid.length.toLocaleString()} Contacts`
                )}
              </button>
            </>
          )}

          {step === 'done' && (
            <button
              onClick={onClose}
              className="h-10 px-5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110"
              style={{ background: 'linear-gradient(135deg,#534AB7,#3B3499)' }}>
              Done
            </button>
          )}

        </div>
      </div>
    </div>
  );
}
