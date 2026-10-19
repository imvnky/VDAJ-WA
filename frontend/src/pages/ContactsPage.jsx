/**
 * VDAJ Services — ContactsPage (Enterprise Edition)
 * ────────────────────────────────────────────────────────────
 * - Manual 1-by-1 contact addition modal
 * - Groups (contact lists) segmentation & creation
 * - Instant tag filtering with active state & clear filters fix
 * - Direct row-level CRM actions (Open in Inbox, Edit, Delete)
 * - CSV Export for filtered/total audience
 * - Opt-in Meta BSP compliance status column & active toggle
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { contactApi } from '../lib/api';
import { showSuccess, showError } from '../components/atoms/Toast/Toast.jsx';
import Input from '../components/atoms/Input/Input.jsx';
import CsvContactUploader from '../components/organisms/CsvContactUploader.jsx';
import AddContactModal from '../components/organisms/AddContactModal.jsx';
import EditContactModal from '../components/organisms/EditContactModal.jsx';
import CreateGroupModal from '../components/organisms/CreateGroupModal.jsx';

// ── Tag color palette (deterministic from tag string) ──────────
const TAG_PALETTE = [
  { bg: '#F3F2FD', color: '#534AB7', border: '#E6E4F5' },
  { bg: '#E8F9F4', color: '#148059', border: '#A3E4D0' },
  { bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' },
  { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
  { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' },
  { bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' },
];

function tagColor(tag) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) & 0xffffffff;
  return TAG_PALETTE[Math.abs(h) % TAG_PALETTE.length];
}

function TagPill({ tag, onClick, isSelected, onRemove }) {
  const c = tagColor(tag);
  return (
    <span
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-1 text-2xs font-semibold px-2.5 py-0.5 rounded-full shrink-0 transition-all select-none',
        onClick && 'cursor-pointer hover:brightness-95',
        isSelected && 'ring-2 ring-offset-1 font-bold shadow-sm'
      )}
      style={{
        background: isSelected ? c.color : c.bg,
        color: isSelected ? '#FFFFFF' : c.color,
        border: `1px solid ${isSelected ? c.color : c.border}`,
      }}
    >
      {isSelected && <span className="text-[10px]">✓</span>}
      {tag}
      {isSelected && onRemove && (
        <span
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 hover:opacity-80 text-xs font-bold leading-none cursor-pointer"
          title="Remove filter"
        >
          ✕
        </span>
      )}
    </span>
  );
}

// ── Opt-In Status Badge ────────────────────────────────────────
function OptInBadge({ contact }) {
  if (contact.status === 'opted_out') {
    const outDate = contact.opted_out_at
      ? new Date(contact.opted_out_at).toLocaleDateString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric',
        })
      : null;
    return (
      <span
        className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
        style={{
          background: 'rgba(239,68,68,0.12)',
          color: '#ef4444',
          border: '1px solid rgba(239,68,68,0.3)',
        }}
        title={outDate ? `Opted Out on ${outDate}` : 'Opted Out'}
      >
        ✕ Opted Out
      </span>
    );
  }

  if (contact.status === 'invalid') {
    return (
      <span
        className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
        style={{ background: 'rgba(251,191,36,0.10)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}
      >
        ⚠ Invalid
      </span>
    );
  }

  if (!contact.opted_in_at) {
    return (
      <span
        className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
        style={{ background: 'rgba(239,68,68,0.10)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}
      >
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
    <span
      className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: 'rgba(29,158,117,0.10)', color: '#1D9E75', border: '1px solid rgba(29,158,117,0.25)' }}
      title={`${src} · ${date}`}
    >
      ✓ {src}
    </span>
  );
}

// ── Avatar initials ────────────────────────────────────────────
function Avatar({ contact }) {
  const letter = (contact.first_name?.[0] || contact.phone_e164?.[1] || '?').toUpperCase();
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
      style={{ background: 'rgba(83,74,183,0.18)', color: '#AFA9EC', border: '1px solid rgba(83,74,183,0.25)' }}
    >
      {letter}
    </div>
  );
}

// ── Status toggle (Active <-> Inactive) ─────────────────────────
function StatusToggle({ contact, onToggle }) {
  const [loading, setLoading] = useState(false);
  const isActive = contact.status === 'active';

  const handleToggle = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    try {
      const nextStatus = isActive ? 'opted_out' : 'active';
      await contactApi.toggleStatus(contact.id, nextStatus);
      onToggle(contact.id, nextStatus);
      showSuccess(nextStatus === 'active' ? 'Contact reactivated.' : 'Contact marked as inactive.');
    } catch {} finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      title={isActive ? 'Active (Click to mark inactive)' : 'Inactive (Click to reactivate)'}
      className={clsx(
        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 cursor-pointer shrink-0',
        loading && 'opacity-60'
      )}
      style={{ background: isActive ? '#1D9E75' : '#CBD5E1' }}
    >
      <span
        className={clsx(
          'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200',
          isActive ? 'translate-x-[18px]' : 'translate-x-0.5'
        )}
      />
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
      <div className="col-span-2 flex justify-end gap-2">
        <div className="h-5 w-9 rounded-full" style={{ background: 'var(--bg-elevated)' }} />
      </div>
    </div>
  );
}

// ── Main ContactsPage ──────────────────────────────────────────
export default function ContactsPage() {
  const [contacts, setContacts]             = useState([]);
  const [total, setTotal]                   = useState(0);
  const [page, setPage]                     = useState(1);
  const [search, setSearch]                 = useState('');
  const [searchInput, setSearchInput]       = useState('');
  const [tagFilter, setTagFilter]           = useState('');
  const [selectedGroup, setSelectedGroup]   = useState('');
  const [allTags, setAllTags]               = useState([]);
  const [lists, setLists]                   = useState([]);
  const [loading, setLoading]               = useState(true);

  // Modals
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [editContact, setEditContact]       = useState(null);
  const [importOpen, setImportOpen]         = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm]   = useState(null);
  const [deleting, setDeleting]             = useState(false);
  const [exporting, setExporting]           = useState(false);

  const LIMIT = 20;

  // ── Load Contacts ────────────────────────────────────────────
  const load = useCallback(async (p = page, s = search, t = tagFilter, g = selectedGroup) => {
    setLoading(true);
    try {
      const res = await contactApi.list({
        page: p,
        limit: LIMIT,
        search: s || undefined,
        tag: t || undefined,
        listId: g || undefined,
      }, { silent: true });

      const rows = res.data || [];
      setContacts(rows);
      setTotal(res.meta?.total || 0);

      // Collect tags from rows
      const seen = new Set();
      rows.forEach((c) => (c.tags || []).forEach((tag) => seen.add(tag)));
      if (seen.size > 0) {
        setAllTags((prev) => [...new Set([...prev, ...seen])]);
      }
    } catch (err) {
      console.error('Failed to load contacts:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, tagFilter, selectedGroup]);

  // Initial load
  useEffect(() => {
    load();
  }, [load]);

  // Load distinct tags & groups on mount
  const refreshLists = useCallback(async () => {
    try {
      const res = await contactApi.lists({ silent: true });
      setLists(res.data || []);
    } catch {}
  }, []);

  const refreshTags = useCallback(async () => {
    try {
      const res = await contactApi.tags({ silent: true });
      if (Array.isArray(res.data) && res.data.length > 0) {
        setAllTags((prev) => [...new Set([...prev, ...res.data])]);
      }
    } catch {}
  }, []);

  useEffect(() => {
    refreshLists();
    refreshTags();
  }, [refreshLists, refreshTags]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      const trimmed = searchInput.trim();
      if (trimmed !== search) {
        setSearch(trimmed);
        setPage(1);
        load(1, trimmed, tagFilter, selectedGroup);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]); // eslint-disable-line

  // ── Filter Handlers ──────────────────────────────────────────
  const handleTagFilter = (tag) => {
    const next = tagFilter === tag ? '' : tag;
    setTagFilter(next);
    setPage(1);
    load(1, search, next, selectedGroup);
  };

  const handleGroupChange = (groupId) => {
    const next = selectedGroup === groupId ? '' : groupId;
    setSelectedGroup(next);
    setPage(1);
    load(1, search, tagFilter, next);
  };

  const handleResetAllFilters = () => {
    setSearchInput('');
    setSearch('');
    setTagFilter('');
    setSelectedGroup('');
    setPage(1);
    load(1, '', '', '');
  };

  const handleStatusChange = (id, newStatus) => {
    setContacts((cs) => cs.map((c) => (c.id === id ? { ...c, status: newStatus } : c)));
  };

  const handleContactCreated = () => {
    load(1, search, tagFilter, selectedGroup);
    refreshTags();
    refreshLists();
  };

  const handleContactUpdated = (updated) => {
    setContacts((cs) => cs.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
    refreshTags();
  };

  // ── Delete Contact ───────────────────────────────────────────
  const handleDeleteContact = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await contactApi.delete(deleteConfirm.id);
      showSuccess(`Contact ${deleteConfirm.phone_e164} deleted.`);
      setContacts((cs) => cs.filter((c) => c.id !== deleteConfirm.id));
      setTotal((t) => Math.max(0, t - 1));
      setDeleteConfirm(null);
      refreshLists();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to delete contact.');
    } finally {
      setDeleting(false);
    }
  };

  // ── Export CSV ───────────────────────────────────────────────
  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const res = await contactApi.list({
        page: 1,
        limit: 1000,
        search: search || undefined,
        tag: tagFilter || undefined,
        listId: selectedGroup || undefined,
      }, { silent: true });

      const items = res.data || [];
      if (items.length === 0) {
        showError('No contacts to export.');
        return;
      }

      const headers = ['Phone', 'First Name', 'Last Name', 'Email', 'Status', 'Opt-In Source', 'Opt-In Date', 'Tags'];
      const rows = items.map((c) => [
        `"${c.phone_e164 || ''}"`,
        `"${(c.first_name || '').replace(/"/g, '""')}"`,
        `"${(c.last_name || '').replace(/"/g, '""')}"`,
        `"${c.email || ''}"`,
        `"${c.status || ''}"`,
        `"${c.opt_in_source || ''}"`,
        `"${c.opted_in_at ? new Date(c.opted_in_at).toISOString().slice(0, 10) : ''}"`,
        `"${(c.tags || []).join('; ')}"`,
      ]);

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `contacts_export_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showSuccess(`Exported ${items.length} contacts.`);
    } catch {
      showError('Failed to export contacts.');
    } finally {
      setExporting(false);
    }
  };

  const hasActiveFilters = Boolean(search || tagFilter || selectedGroup);
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="w-full space-y-5" style={{ animation: 'fadeIn 0.3s ease-out' }}>

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
            Contacts
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {total.toLocaleString()} total verified WhatsApp contacts
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            disabled={exporting || total === 0}
            className="flex items-center gap-1.5 h-10 px-3.5 rounded-xl text-xs font-bold transition-all disabled:opacity-40"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--bg-border)',
              color: 'var(--text-secondary)',
            }}
            title="Export filtered contacts to CSV"
          >
            <span>{exporting ? '⏳' : '📥'}</span>
            <span>{exporting ? 'Exporting...' : 'Export'}</span>
          </button>

          {/* Import CSV */}
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-2 h-10 px-3.5 rounded-xl text-xs font-bold transition-all hover:bg-slate-100"
            style={{
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              color: '#334155',
            }}
          >
            <svg className="w-4 h-4 text-[#534AB7]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
            Import CSV
          </button>

          {/* Add Contact (Primary) */}
          <button
            onClick={() => setAddContactOpen(true)}
            className="flex items-center gap-2 h-10 px-4 rounded-xl text-xs font-bold transition-all shadow-md hover:brightness-110 active:scale-95"
            style={{
              background: 'linear-gradient(135deg,#534AB7,#3B3499)',
              color: '#fff',
              border: '1px solid rgba(83,74,183,0.4)',
            }}
          >
            <span className="text-base leading-none font-bold">+</span>
            Add Contact
          </button>
        </div>
      </div>

      {/* ── Audience Groups Tabs ──────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
        <button
          onClick={() => handleGroupChange('')}
          className={clsx(
            'flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-semibold transition-all shrink-0',
            !selectedGroup
              ? 'bg-[#534AB7] text-white shadow-sm'
              : 'bg-[#FFFFFF] text-[#64748B] hover:text-[#0F172A] border border-[#E2E8F0] hover:bg-[#F8FAFC]'
          )}
        >
          <span>👥 All Contacts</span>
          <span className={clsx(
            'text-2xs px-1.5 py-0.2 rounded-full font-bold',
            !selectedGroup ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
          )}>
            {total.toLocaleString()}
          </span>
        </button>

        {lists.map((list) => {
          const isSelected = selectedGroup === list.id;
          return (
            <button
              key={list.id}
              onClick={() => handleGroupChange(list.id)}
              className={clsx(
                'flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-semibold transition-all shrink-0',
                isSelected
                  ? 'bg-[#534AB7] text-white shadow-sm'
                  : 'bg-[#FFFFFF] text-[#64748B] hover:text-[#0F172A] border border-[#E2E8F0] hover:bg-[#F8FAFC]'
              )}
            >
              <span>📁 {list.name}</span>
              {list.contact_count !== undefined && (
                <span className={clsx(
                  'text-2xs px-1.5 py-0.2 rounded-full font-bold',
                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                )}>
                  {list.contact_count}
                </span>
              )}
            </button>
          );
        })}

        <button
          onClick={() => setCreateGroupOpen(true)}
          className="flex items-center gap-1 h-8 px-2.5 rounded-xl text-xs font-bold text-[#534AB7] bg-[#F3F2FD] hover:bg-[#E8E6FA] border border-[#E6E4F5] transition-all shrink-0"
          title="Create a new audience group"
        >
          <span>+ New Group</span>
        </button>
      </div>

      {/* ── Search + Tag Filters Toolbar ─────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search input with instant clear */}
        <div className="flex-1 min-w-56 relative">
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
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                setSearchInput('');
                setSearch('');
                setPage(1);
                load(1, '', tagFilter, selectedGroup);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#94A3B8] hover:text-[#0F172A] w-5 h-5 flex items-center justify-center rounded-full hover:bg-slate-100"
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Tag Filters with 'All' chip */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-2xs font-bold uppercase tracking-wider text-[#64748B]">
            Tags:
          </span>

          {/* All Tags chip */}
          <button
            type="button"
            onClick={() => handleTagFilter('')}
            className={clsx(
              'text-2xs font-semibold px-2.5 py-0.5 rounded-full transition-all cursor-pointer',
              !tagFilter
                ? 'bg-[#534AB7] text-white font-bold shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            All
          </button>

          {allTags.map((tag) => (
            <TagPill
              key={tag}
              tag={tag}
              isSelected={tagFilter === tag}
              onClick={() => handleTagFilter(tag)}
              onRemove={() => handleTagFilter('')}
            />
          ))}
        </div>
      </div>

      {/* ── Active Filter Bar & Reset Button ─────────────────── */}
      {hasActiveFilters && (
        <div className="flex items-center justify-between p-2.5 px-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs animate-fade-in">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-[#64748B]">Active Filter:</span>

            {selectedGroup && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-[#CBD5E1] text-[#0F172A] font-semibold text-2xs">
                📁 {lists.find((l) => l.id === selectedGroup)?.name || 'Group'}
                <button
                  onClick={() => handleGroupChange('')}
                  className="hover:text-red-500 font-bold ml-1"
                >
                  ✕
                </button>
              </span>
            )}

            {tagFilter && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-[#CBD5E1] text-[#0F172A] font-semibold text-2xs">
                🏷️ {tagFilter}
                <button
                  onClick={() => handleTagFilter('')}
                  className="hover:text-red-500 font-bold ml-1"
                >
                  ✕
                </button>
              </span>
            )}

            {search && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-[#CBD5E1] text-[#0F172A] font-semibold text-2xs">
                🔍 "{search}"
                <button
                  onClick={() => {
                    setSearchInput('');
                    setSearch('');
                    load(1, '', tagFilter, selectedGroup);
                  }}
                  className="hover:text-red-500 font-bold ml-1"
                >
                  ✕
                </button>
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleResetAllFilters}
            className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline flex items-center gap-1 shrink-0 ml-3 cursor-pointer"
          >
            ✕ Clear All Filters
          </button>
        </div>
      )}

      {/* ── Table ─────────────────────────────────────────────── */}
      <div
        className="rounded-2xl overflow-hidden shadow-sm"
        style={{ border: '1px solid var(--bg-border)', background: 'var(--bg-card)' }}
      >
        {/* Column header */}
        <div
          className="grid grid-cols-12 gap-3 px-5 py-3 border-b items-center"
          style={{ borderColor: 'var(--bg-border)', background: 'var(--bg-elevated)' }}
        >
          {[
            { label: 'Contact', span: 'col-span-3' },
            { label: 'Phone',   span: 'col-span-2' },
            { label: 'Opt-In',  span: 'col-span-2' },
            { label: 'Tags',    span: 'col-span-3' },
            { label: 'Actions', span: 'col-span-2 text-right' },
          ].map(({ label, span }) => (
            <span
              key={label}
              className={clsx('text-2xs font-bold uppercase tracking-wider', span)}
              style={{ color: 'var(--text-muted)' }}
            >
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
              <svg className="w-12 h-12 opacity-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                {hasActiveFilters ? 'No contacts match your active filters.' : 'No contacts yet. Add your first contact or import CSV.'}
              </p>
              {hasActiveFilters ? (
                <button
                  onClick={handleResetAllFilters}
                  className="text-xs font-bold text-[#534AB7] hover:underline"
                >
                  Clear all filters
                </button>
              ) : (
                <div className="flex gap-3 mt-1">
                  <button
                    onClick={() => setAddContactOpen(true)}
                    className="text-xs font-bold text-[#534AB7] underline underline-offset-2"
                  >
                    + Add a contact
                  </button>
                  <span className="text-slate-300">·</span>
                  <button
                    onClick={() => setImportOpen(true)}
                    className="text-xs font-bold text-[#534AB7] underline underline-offset-2"
                  >
                    Import CSV →
                  </button>
                </div>
              )}
            </div>
          ) : (
            contacts.map((c) => (
              <div
                key={c.id}
                className="grid grid-cols-12 gap-3 px-5 py-4 items-center transition-colors group hover:bg-[#F8FAFC]"
                style={{ borderColor: 'var(--bg-border)' }}
              >
                {/* Name + avatar (clickable) */}
                <div className="col-span-3 flex items-center gap-3 min-w-0">
                  <Link to={`/contacts/${c.id}`} className="shrink-0">
                    <Avatar contact={c} />
                  </Link>
                  <Link
                    to={`/contacts/${c.id}`}
                    className="text-sm font-medium truncate hover:text-[#534AB7] transition-colors"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {c.display_name || [c.first_name, c.last_name].filter(Boolean).join(' ') || '—'}
                  </Link>
                </div>

                {/* Phone */}
                <div className="col-span-2">
                  <span className="text-xs font-mono font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {c.phone_e164}
                  </span>
                </div>

                {/* Opt-In status */}
                <div className="col-span-2">
                  <OptInBadge contact={c} />
                </div>

                {/* Tags */}
                <div className="col-span-3 flex items-center gap-1.5 flex-wrap">
                  {(c.tags || []).length > 0 ? (
                    (c.tags || []).map((tag) => (
                      <TagPill
                        key={tag}
                        tag={tag}
                        isSelected={tagFilter === tag}
                        onClick={() => handleTagFilter(tag)}
                        onRemove={() => handleTagFilter('')}
                      />
                    ))
                  ) : (
                    <span className="text-2xs text-slate-300">—</span>
                  )}
                </div>

                {/* Actions */}
                <div className="col-span-2 flex items-center justify-end gap-1.5">
                  {/* Jump to Inbox */}
                  <Link
                    to={`/inbox?phone=${encodeURIComponent(c.phone_e164 || c.phone || '')}&contactId=${c.id}`}
                    title="Open in WhatsApp Inbox"
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-[#534AB7] hover:bg-[#534AB7]/10 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </Link>

                  {/* Edit Contact */}
                  <button
                    type="button"
                    onClick={() => setEditContact(c)}
                    title="Edit Contact"
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-[#534AB7] hover:bg-[#534AB7]/10 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>

                  {/* Delete Contact */}
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(c)}
                    title="Delete Contact"
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>

                  {/* Active / Inactive Toggle */}
                  <div className="ml-1">
                    <StatusToggle contact={c} onToggle={handleStatusChange} />
                  </div>
                </div>
              </div>
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
              onClick={() => {
                const nextP = page - 1;
                setPage(nextP);
                load(nextP, search, tagFilter, selectedGroup);
              }}
              className="h-9 px-4 rounded-xl text-xs font-semibold transition-all disabled:opacity-40 hover:opacity-80"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-secondary)' }}
            >
              ← Prev
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => {
                const nextP = page + 1;
                setPage(nextP);
                load(nextP, search, tagFilter, selectedGroup);
              }}
              className="h-9 px-4 rounded-xl text-xs font-semibold transition-all disabled:opacity-40 hover:opacity-80"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-secondary)' }}
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* ── Add Contact Modal ─────────────────────────────────── */}
      <AddContactModal
        isOpen={addContactOpen}
        onClose={() => setAddContactOpen(false)}
        onSuccess={handleContactCreated}
        lists={lists}
        existingTags={allTags}
        defaultListId={selectedGroup}
      />

      {/* ── Edit Contact Modal ────────────────────────────────── */}
      <EditContactModal
        isOpen={Boolean(editContact)}
        contact={editContact}
        onClose={() => setEditContact(null)}
        onUpdated={handleContactUpdated}
        existingTags={allTags}
      />

      {/* ── Create Group Modal ────────────────────────────────── */}
      <CreateGroupModal
        isOpen={createGroupOpen}
        onClose={() => setCreateGroupOpen(false)}
        onCreated={() => {
          refreshLists();
        }}
      />

      {/* ── CSV Uploader Modal ────────────────────────────────── */}
      <CsvContactUploader
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          load(1, search, tagFilter, selectedGroup);
          refreshTags();
          refreshLists();
        }}
        lists={lists}
      />

      {/* ── Delete Confirmation Dialog ────────────────────────── */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => { if (!deleting) setDeleteConfirm(null); }}
        >
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center text-xl font-bold">
              🗑️
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Delete Contact?</h3>
              <p className="text-xs text-slate-600 mt-1">
                Are you sure you want to delete{' '}
                <strong className="text-slate-900">
                  {deleteConfirm.display_name || deleteConfirm.phone_e164}
                </strong>
                ? This will remove the contact from all lists and stop scheduled campaigns to this number.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteConfirm(null)}
                className="h-9 px-4 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteContact}
                className="h-9 px-4 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-all shadow-sm"
              >
                {deleting ? 'Deleting...' : 'Delete Contact'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
