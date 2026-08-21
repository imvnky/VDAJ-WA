/**
 * VDAJ Services — ContactsPage (Tier 3)
 * - Opt-In status column (green pill with source+date, or red Unknown)
 * - Tag pills per contact row
 * - Tag dropdown filter
 * - Clickable rows → /contacts/:id
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { contactApi } from '../lib/api';
import { showSuccess } from '../components/atoms/Toast/Toast.jsx';
import Input from '../components/atoms/Input/Input.jsx';
import CsvContactUploader from '../components/organisms/CsvContactUploader.jsx';

// ── Tag color palette (deterministic from tag string) ──────────
const TAG_PALETTE = [
  { bg: 'rgba(83,74,183,0.12)',  color: '#AFA9EC',  border: 'rgba(83,74,183,0.25)'  },
  { bg: 'rgba(29,158,117,0.12)', color: '#1D9E75',  border: 'rgba(29,158,117,0.25)' },
  { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b',  border: 'rgba(245,158,11,0.25)' },
  { bg: 'rgba(96,165,250,0.12)', color: '#60a5fa',  border: 'rgba(96,165,250,0.25)' },
  { bg: 'rgba(248,113,113,0.12)',color: '#f87171',  border: 'rgba(248,113,113,0.25)'},
  { bg: 'rgba(52,211,153,0.12)', color: '#34d399',  border: 'rgba(52,211,153,0.25)' },
];
function tagColor(tag) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) & 0xffffffff;
  return TAG_PALETTE[Math.abs(h) % TAG_PALETTE.length];
}

function TagPill({ tag, onClick }) {
  const c = tagColor(tag);
  return (
    <span
      onClick={onClick}
      className={clsx('inline-flex items-center text-2xs font-semibold px-2 py-0.5 rounded-full shrink-0',
        onClick && 'cursor-pointer hover:brightness-90 transition-all')}
      style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}
    >
      {tag}
    </span>
  );
}

// ── Opt-In Status Badge ────────────────────────────────────────
function OptInBadge({ contact }) {
  if (!contact.opted_in_at) {
    return (
      <span className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full"
        style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}>
        ⚠ Unknown
      </span>
    );
  }
  const date = new Date(contact.opted_in_at).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  const src = (contact.opt_in_source || 'import')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: 'rgba(29,158,117,0.10)', color: '#1D9E75', border: '1px solid rgba(29,158,117,0.25)' }}
      title={`${src} · ${date}`}>
      ✓ {src}
    </span>
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

// ── Opt-out toggle ──────────────────────────────────────────────
function OptOutToggle({ contact, onToggle }) {
  const [loading, setLoading] = useState(false);
  const isActive = contact.status === 'active';

  const handleToggle = async (e) => {
    e.preventDefault(); e.stopPropagation(); // don't navigate to detail
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
        'transition-colors duration-200',
        !isActive && 'cursor-not-allowed opacity-50',
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

// ── Skeleton row ───────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className="grid grid-cols-12 gap-3 px-5 py-4 items-center animate-pulse">
      <div className="col-span-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full" style={{ background: 'var(--bg-elevated)' }} />
        <div className="h-3 w-24 rounded" style={{ background: 'var(--bg-elevated)' }} />
      </div>
      <div className="col-span-2 h-3 w-28 rounded" style={{ background: 'var(--bg-elevated)' }} />
      <div className="col-span-2 h-5 w-20 rounded-full" style={{ background: 'var(--bg-elevated)' }} />
      <div className="col-span-3 flex gap-1">
        <div className="h-5 w-12 rounded-full" style={{ background: 'var(--bg-elevated)' }} />
        <div className="h-5 w-16 rounded-full" style={{ background: 'var(--bg-elevated)' }} />
      </div>
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
  const [tagFilter, setTagFilter]     = useState('');
  const [allTags, setAllTags]         = useState([]);   // collected from loaded contacts
  const [loading, setLoading]         = useState(true);
  const [importOpen, setImportOpen]   = useState(false);
  const [lists, setLists]             = useState([]);

  const LIMIT = 20;

  const load = useCallback(async (p = page, s = search, t = tagFilter) => {
    setLoading(true);
    try {
      const res = await contactApi.list({
        page: p, limit: LIMIT,
        search: s || undefined,
        tag: t || undefined,
      });
      const rows = res.data || [];
      setContacts(rows);
      setTotal(res.meta?.total || 0);

      // Collect unique tags for the filter dropdown
      const seen = new Set();
      rows.forEach((c) => (c.tags || []).forEach((t) => seen.add(t)));
      setAllTags((prev) => [...new Set([...prev, ...seen])]);
    } catch {} finally { setLoading(false); }
  }, [page, search, tagFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    contactApi.lists().then((r) => setLists(r.data || [])).catch(() => {});
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      const trimmed = searchInput.trim();
      setSearch(trimmed);
      setPage(1);
      load(1, trimmed, tagFilter);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]); // eslint-disable-line

  const handleOptOut = (id) => {
    setContacts((cs) => cs.map((c) => c.id === id ? { ...c, status: 'opted_out' } : c));
  };

  const handleImported = (result) => {
    load(1, search, tagFilter);
    showSuccess(`${result.inserted} contacts added, ${result.updated} updated.`);
  };

  const handleTagFilter = (tag) => {
    const next = tagFilter === tag ? '' : tag;
    setTagFilter(next);
    setPage(1);
    load(1, search, next);
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="max-w-6xl mx-auto space-y-5" style={{ animation: 'fadeIn 0.3s ease-out' }}>

      {/* ── Header ────────────────────────────────────────────── */}
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
          style={{ background: 'linear-gradient(135deg,#534AB7,#3B3499)', color: '#fff', border: '1px solid rgba(83,74,183,0.4)' }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
          </svg>
          Import CSV
        </button>
      </div>

      {/* ── Search + Tag Filter ─────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-48">
          <Input
            placeholder="Search by name or phone…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            leftIcon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
          />
        </div>

        {/* Tag filter dropdown */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-2xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Filter by tag:
            </span>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => handleTagFilter(tag)}
                className="transition-all"
              >
                <TagPill
                  tag={tag}
                  onClick={() => handleTagFilter(tag)}
                />
              </button>
            ))}
            {tagFilter && (
              <button
                onClick={() => handleTagFilter('')}
                className="text-2xs font-semibold px-2 py-0.5 rounded-full transition-all hover:opacity-80"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--bg-border)' }}
              >
                ✕ Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* Active tag filter indicator */}
      {tagFilter && (
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span>Filtering by tag:</span>
          <TagPill tag={tagFilter} />
        </div>
      )}

      {/* ── Table ─────────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden"
        style={{ border: '1px solid var(--bg-border)', background: 'var(--bg-card)' }}>

        {/* Column header */}
        <div className="grid grid-cols-12 gap-3 px-5 py-3 border-b"
          style={{ borderColor: 'var(--bg-border)', background: 'var(--bg-elevated)' }}>
          {[
            { label: 'Contact', span: 'col-span-3' },
            { label: 'Phone',   span: 'col-span-2' },
            { label: 'Opt-In',  span: 'col-span-2' },
            { label: 'Tags',    span: 'col-span-3' },
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
                {search || tagFilter ? 'No contacts match your filter.' : 'No contacts yet. Click "Import CSV" to get started.'}
              </p>
              {!search && !tagFilter && (
                <button onClick={() => setImportOpen(true)}
                  className="text-sm font-semibold underline underline-offset-2"
                  style={{ color: '#AFA9EC' }}>
                  Import your first CSV →
                </button>
              )}
            </div>
          ) : (
            contacts.map((c) => (
              <Link
                key={c.id}
                to={`/contacts/${c.id}`}
                className="grid grid-cols-12 gap-3 px-5 py-4 items-center transition-colors"
                style={{ borderColor: 'var(--bg-border)', textDecoration: 'none' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                {/* Name + avatar */}
                <div className="col-span-3 flex items-center gap-3 min-w-0">
                  <Avatar contact={c} />
                  <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {c.display_name || [c.first_name, c.last_name].filter(Boolean).join(' ') || '—'}
                  </span>
                </div>

                {/* Phone */}
                <div className="col-span-2">
                  <span className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>
                    {c.phone_e164}
                  </span>
                </div>

                {/* Opt-In status */}
                <div className="col-span-2">
                  <OptInBadge contact={c} />
                </div>

                {/* Tags */}
                <div className="col-span-3 flex items-center gap-1.5 flex-wrap">
                  {(c.tags || []).map((tag) => (
                    <TagPill
                      key={tag}
                      tag={tag}
                      onClick={(e) => {
                        e.preventDefault(); e.stopPropagation();
                        handleTagFilter(tag);
                      }}
                    />
                  ))}
                </div>

                {/* Opt-out toggle */}
                <div className="col-span-2 flex justify-end">
                  <OptOutToggle contact={c} onToggle={handleOptOut} />
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* ── Pagination ────────────────────────────────────────── */}
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
