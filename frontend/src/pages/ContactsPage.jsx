/**
 * VDAJ Services — ContactsPage
 * Contact table with search, pagination, opt-out toggle.
 * Sprint 2: CSV import via CsvContactUploader modal (POST /contacts/bulk).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { contactApi } from '../lib/api';
import { showSuccess } from '../components/atoms/Toast/Toast.jsx';
import Button, { PrimaryButton } from '../components/atoms/Button/Button.jsx';
import Input from '../components/atoms/Input/Input.jsx';
import CsvContactUploader from '../components/organisms/CsvContactUploader.jsx';

// ── Opt-out Toggle ─────────────────────────────────────────────
function OptOutToggle({ contact, onToggle }) {
  const [loading, setLoading] = useState(false);
  const isActive = contact.status === 'active';

  const handleToggle = async () => {
    if (!isActive) return;
    setLoading(true);
    try {
      await contactApi.optOut(contact.id);
      onToggle(contact.id);
    } catch {} finally { setLoading(false); }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading || !isActive}
      title={isActive ? 'Mark as opted out' : 'Opted out'}
      className={clsx(
        'relative inline-flex h-5 w-9 items-center rounded-full',
        'transition-colors duration-200 focus-ring',
        isActive ? 'bg-[#1D9E75]' : 'cursor-not-allowed opacity-50',
        loading && 'opacity-60'
      )}
      style={{ background: isActive ? '#1D9E75' : 'var(--bg-border)' }}
    >
      <span className={clsx(
        'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow',
        'transition-transform duration-200',
        isActive ? 'translate-x-[18px]' : 'translate-x-0.5'
      )} />
    </button>
  );
}

// ── Status Badge ───────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = {
    active:    { bg: 'rgba(29,158,117,0.12)', color: '#1D9E75',  border: 'rgba(29,158,117,0.25)',  label: 'Active' },
    opted_out: { bg: 'rgba(239,68,68,0.10)',  color: '#f87171',  border: 'rgba(239,68,68,0.25)',   label: 'Opted Out' },
    invalid:   { bg: 'rgba(251,191,36,0.10)', color: '#fbbf24',  border: 'rgba(251,191,36,0.25)',  label: 'Invalid' },
  };
  const s = cfg[status] || cfg.active;
  return (
    <span className="inline-flex items-center text-2xs font-semibold px-2 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {s.label}
    </span>
  );
}

// ── Avatar initials ────────────────────────────────────────────
function Avatar({ contact }) {
  const letter = (contact.first_name?.[0] || contact.phone_e164?.[1] || '?').toUpperCase();
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
      style={{ background: 'rgba(83,74,183,0.18)', color: '#AFA9EC', border: '1px solid rgba(83,74,183,0.25)' }}>
      {letter}
    </div>
  );
}

// ── Skeleton row ───────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className="grid grid-cols-12 gap-4 px-5 py-4 items-center animate-pulse">
      <div className="col-span-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full" style={{ background: 'var(--bg-elevated)' }} />
        <div className="h-3 w-24 rounded" style={{ background: 'var(--bg-elevated)' }} />
      </div>
      <div className="col-span-4 h-3 w-32 rounded" style={{ background: 'var(--bg-elevated)' }} />
      <div className="col-span-2 h-5 w-16 rounded-full" style={{ background: 'var(--bg-elevated)' }} />
      <div className="col-span-2 flex justify-end">
        <div className="h-5 w-9 rounded-full" style={{ background: 'var(--bg-elevated)' }} />
      </div>
    </div>
  );
}

// ── Main ContactsPage ──────────────────────────────────────────
export default function ContactsPage() {
  const [contacts, setContacts]       = useState([]);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(1);
  const [search, setSearch]           = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading]         = useState(true);
  const [importOpen, setImportOpen]   = useState(false);
  const [lists, setLists]             = useState([]);

  const LIMIT = 20;

  // Load contacts
  const load = useCallback(async (p = page, s = search) => {
    setLoading(true);
    try {
      const res = await contactApi.list({ page: p, limit: LIMIT, search: s || undefined });
      setContacts(res.data || []);
      setTotal(res.meta?.total || 0);
    } catch {} finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  // Load contact lists for the uploader
  useEffect(() => {
    contactApi.lists().then((r) => setLists(r.data || [])).catch(() => {});
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      const trimmed = searchInput.trim();
      setSearch(trimmed);
      setPage(1);
      load(1, trimmed);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]); // eslint-disable-line

  const handleOptOut = (id) => {
    setContacts((cs) => cs.map((c) => c.id === id ? { ...c, status: 'opted_out' } : c));
  };

  const handleImported = (result) => {
    load(1, search);
    showSuccess(`${result.inserted} contacts added, ${result.updated} updated.`);
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="max-w-6xl mx-auto space-y-6" style={{ animation: 'fadeIn 0.3s ease-out' }}>

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
            Contacts
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {total.toLocaleString()} total contacts
          </p>
        </div>
        <button
          onClick={() => setImportOpen(true)}
          className="flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold transition-all hover:brightness-110"
          style={{
            background: 'linear-gradient(135deg,#534AB7,#3B3499)',
            color: '#fff',
            border: '1px solid rgba(83,74,183,0.4)',
          }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
          </svg>
          Import CSV
        </button>
      </div>

      {/* ── Search ───────────────────────────────────────────── */}
      <Input
        placeholder="Search by name or phone…"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        leftIcon={
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        }
      />

      {/* ── Table ────────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden"
        style={{ border: '1px solid var(--bg-border)', background: 'var(--bg-card)' }}>

        {/* Column header */}
        <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b"
          style={{ borderColor: 'var(--bg-border)', background: 'var(--bg-elevated)' }}>
          {[
            { label: 'Contact', span: 'col-span-4' },
            { label: 'Phone',   span: 'col-span-4' },
            { label: 'Status',  span: 'col-span-2' },
            { label: 'Active',  span: 'col-span-2 text-right' },
          ].map(({ label, span }) => (
            <span key={label}
              className={clsx('text-2xs font-semibold uppercase tracking-wider', span)}
              style={{ color: 'var(--text-muted)' }}>
              {label}
            </span>
          ))}
        </div>

        {/* Rows */}
        <div className="divide-y" style={{ borderColor: 'var(--bg-border)' }}>
          {loading ? (
            [...Array(6)].map((_, i) => <SkeletonRow key={i} />)
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <svg className="w-12 h-12 opacity-10" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth={1.2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {search ? 'No contacts match your search.' : 'No contacts yet. Click "Import CSV" to get started.'}
              </p>
              {!search && (
                <button
                  onClick={() => setImportOpen(true)}
                  className="text-sm font-semibold underline underline-offset-2"
                  style={{ color: '#AFA9EC' }}>
                  Import your first CSV →
                </button>
              )}
            </div>
          ) : (
            contacts.map((c) => (
              <div key={c.id}
                className="grid grid-cols-12 gap-4 px-5 py-4 items-center transition-colors"
                style={{ borderColor: 'var(--bg-border)' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div className="col-span-4 flex items-center gap-3 min-w-0">
                  <Avatar contact={c} />
                  <span className="text-sm font-medium truncate"
                    style={{ color: 'var(--text-primary)' }}>
                    {c.display_name || [c.first_name, c.last_name].filter(Boolean).join(' ') || '—'}
                  </span>
                </div>

                <div className="col-span-4">
                  <span className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>
                    {c.phone_e164}
                  </span>
                </div>

                <div className="col-span-2">
                  <StatusBadge status={c.status} />
                </div>

                <div className="col-span-2 flex justify-end">
                  <OptOutToggle contact={c} onToggle={handleOptOut} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Pagination ───────────────────────────────────────── */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Page {page} of {totalPages} · {total.toLocaleString()} contacts
          </p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => { setPage((p) => p - 1); }}
              className="h-9 px-4 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 hover:opacity-80"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-secondary)' }}>
              ← Prev
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => { setPage((p) => p + 1); }}
              className="h-9 px-4 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 hover:opacity-80"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-secondary)' }}>
              Next →
            </button>
          </div>
        </div>
      )}

      {/* ── CSV Uploader Modal ────────────────────────────────── */}
      <CsvContactUploader
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={handleImported}
        lists={lists}
      />
    </div>
  );
}
