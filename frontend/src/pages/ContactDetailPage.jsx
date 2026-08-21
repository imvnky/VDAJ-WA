/**
 * VDAJ Services — ContactDetailPage (Tier 3)
 * Route: /contacts/:id
 *
 * Sections:
 *  1. Header / Profile card (name, phone, email, editable tags, created date)
 *  2. Opt-out banner (if opted out)
 *  3. Consent / Opt-In audit card
 *  4. Custom variables card
 *  5. Campaign history table
 *  6. "Open in Inbox" quick action
 */

import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { contactApi } from '../lib/api';
import { showSuccess, showError } from '../components/atoms/Toast/Toast.jsx';

// ── Tag color palette (deterministic) ─────────────────────────
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

// ── Skeleton ──────────────────────────────────────────────────
function Skeleton({ className }) {
  return (
    <div className={clsx('animate-pulse rounded-xl', className)}
      style={{ background: 'var(--bg-elevated)' }} />
  );
}

// ── Card wrapper ──────────────────────────────────────────────
function Card({ title, children, action }) {
  return (
    <div className="rounded-2xl border overflow-hidden"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--bg-border)' }}>
      <div className="flex items-center justify-between px-5 py-3 border-b"
        style={{ borderColor: 'var(--bg-border)', background: 'var(--bg-elevated)' }}>
        <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          {title}
        </h3>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ── Delivery status config ─────────────────────────────────────
const DELIVERY_STATUS = {
  sent:      { label: 'Sent',      color: '#AFA9EC', bg: 'rgba(83,74,183,0.12)' },
  delivered: { label: 'Delivered', color: '#1D9E75', bg: 'rgba(29,158,117,0.12)' },
  read:      { label: 'Read',      color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  failed:    { label: 'Failed',    color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  pending:   { label: 'Pending',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
};

function DeliveryBadge({ status }) {
  const s = DELIVERY_STATUS[status] || DELIVERY_STATUS.pending;
  return (
    <span className="inline-flex items-center text-2xs font-bold px-2 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

// ── Editable Tag Input ─────────────────────────────────────────
function EditableTags({ contactId, initialTags, onSaved }) {
  const [tags, setTags]       = useState(initialTags || []);
  const [input, setInput]     = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving]   = useState(false);
  const inputRef = useRef();

  const addTag = () => {
    const clean = input.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 30);
    if (!clean || tags.includes(clean)) { setInput(''); return; }
    setTags((t) => [...t, clean]);
    setInput('');
  };

  const removeTag = (tag) => setTags((t) => t.filter((x) => x !== tag));

  const save = async () => {
    setSaving(true);
    try {
      const res = await contactApi.updateTags(contactId, tags);
      onSaved(res.data.tags);
      setEditing(false);
      showSuccess('Tags saved.');
    } catch {
      showError('Failed to save tags.');
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setTags(initialTags || []);
    setInput('');
    setEditing(false);
  };

  return (
    <div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {tags.map((tag) => {
          const c = tagColor(tag);
          return (
            <span key={tag}
              className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
              {tag}
              {editing && (
                <button onClick={() => removeTag(tag)}
                  className="ml-0.5 rounded-full hover:opacity-60 transition-opacity text-xs leading-none">
                  ×
                </button>
              )}
            </span>
          );
        })}
        {!editing && (
          <button
            onClick={() => { setEditing(true); setTimeout(() => inputRef.current?.focus(), 50); }}
            className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full transition-all hover:opacity-80"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px dashed var(--bg-border)' }}>
            + Add tag
          </button>
        )}
      </div>

      {editing && (
        <div className="mt-2 flex items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); }
              if (e.key === 'Escape') cancel();
            }}
            placeholder="Type tag + Enter"
            className="flex-1 h-8 rounded-lg px-3 text-xs outline-none"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)' }}
          />
          <button onClick={addTag}
            className="h-8 px-3 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-secondary)' }}>
            Add
          </button>
          <button onClick={save} disabled={saving}
            className="h-8 px-3 rounded-lg text-xs font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
            style={{ background: '#534AB7' }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={cancel}
            className="h-8 px-3 rounded-lg text-xs font-semibold transition-all hover:opacity-70"
            style={{ color: 'var(--text-muted)' }}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function InfoRow({ label, value, mono }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b last:border-0"
      style={{ borderColor: 'var(--bg-border)' }}>
      <span className="text-xs font-semibold w-32 shrink-0 pt-0.5"
        style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className={clsx('text-xs flex-1', mono && 'font-mono')}
        style={{ color: 'var(--text-primary)' }}>
        {value ?? '—'}
      </span>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function ContactDetailPage() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const [contact, setContact] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await contactApi.get(id);
        setContact(res.data);
      } catch {
        navigate('/contacts', { replace: true });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]); // eslint-disable-line

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-5">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40" />
        <Skeleton className="h-52" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!contact) return null;

  const displayName = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.phone_e164;
  const isOptedOut  = contact.status === 'opted_out';
  const optInSrcLabel = (contact.opt_in_source || contact.opt_in_event_source || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase()) || 'Not recorded';

  const customVars = (() => {
    try { return contact.custom_vars || {}; }
    catch { return {}; }
  })();

  return (
    <div className="max-w-4xl mx-auto space-y-5" style={{ animation: 'fadeIn 0.3s ease-out' }}>

      {/* ── Breadcrumb ──────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
        <Link to="/contacts" className="hover:underline" style={{ color: '#AFA9EC' }}>Contacts</Link>
        <span>›</span>
        <span style={{ color: 'var(--text-primary)' }}>{displayName}</span>
      </div>

      {/* ── Opt-out banner ──────────────────────────────────── */}
      {isOptedOut && (
        <div className="rounded-2xl p-4 flex items-start gap-3"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24"
            stroke="#f87171" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          <div>
            <p className="text-sm font-bold" style={{ color: '#f87171' }}>Contact has opted out</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(248,113,113,0.7)' }}>
              {contact.opt_out_event?.trigger_keyword
                ? `Triggered by: "${contact.opt_out_event.trigger_keyword}" · `
                : ''}
              {contact.opt_out_event?.opted_out_at
                ? fmtDate(contact.opt_out_event.opted_out_at)
                : contact.opted_out_at
                  ? fmtDate(contact.opted_out_at)
                  : 'Date unknown'}
            </p>
            <p className="text-2xs mt-1" style={{ color: 'rgba(248,113,113,0.5)' }}>
              No campaign messages will be sent to this contact.
            </p>
          </div>
        </div>
      )}

      {/* ── Profile card ────────────────────────────────────── */}
      <div className="rounded-2xl border p-6"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--bg-border)' }}>
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black shrink-0"
            style={{ background: 'rgba(83,74,183,0.18)', color: '#AFA9EC', border: '1px solid rgba(83,74,183,0.25)' }}>
            {(contact.first_name?.[0] || contact.phone_e164?.[1] || '?').toUpperCase()}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>
                {displayName}
              </h1>
              {/* Status pill */}
              <span className={clsx('inline-flex text-2xs font-bold px-2 py-0.5 rounded-full')}
                style={isOptedOut
                  ? { background: 'rgba(239,68,68,0.12)', color: '#f87171' }
                  : { background: 'rgba(29,158,117,0.12)', color: '#1D9E75' }}>
                {isOptedOut ? 'Opted Out' : 'Active'}
              </span>
            </div>

            <div className="mt-2 flex flex-col gap-1">
              <p className="text-sm font-mono" style={{ color: '#AFA9EC' }}>
                {contact.phone_e164}
              </p>
              {contact.email && (
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {contact.email}
                </p>
              )}
              <p className="text-2xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Added {fmtDate(contact.created_at)}
              </p>
            </div>

            {/* Editable tags */}
            <div className="mt-3">
              <EditableTags
                contactId={contact.id}
                initialTags={contact.tags || []}
                onSaved={(newTags) => setContact((c) => ({ ...c, tags: newTags }))}
              />
            </div>
          </div>

          {/* Quick action: Open in Inbox */}
          {contact.conversation_id && (
            <Link
              to="/inbox"
              state={{ conversationId: contact.conversation_id }}
              className="flex items-center gap-2 h-10 px-4 rounded-xl text-xs font-bold shrink-0 transition-all hover:brightness-110"
              style={{ background: 'rgba(29,158,117,0.12)', color: '#1D9E75', border: '1px solid rgba(29,158,117,0.25)' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Open in Inbox
            </Link>
          )}
        </div>
      </div>

      {/* ── Two-column layout ────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Consent / Opt-In Audit */}
        <Card title="Consent Audit">
          <InfoRow label="Source" value={optInSrcLabel} />
          <InfoRow label="Opt-In Date"
            value={fmtDate(contact.opted_in_at || contact.opt_in_event_at)} />
          <InfoRow label="Proof"
            value={contact.opt_in_proof || contact.opt_in_event_proof || 'Not recorded'} />
          <InfoRow label="IP Address"
            value={contact.opt_in_event_ip || '—'} mono />
          {!contact.opted_in_at && !contact.opt_in_event_at && (
            <div className="mt-3 rounded-xl p-3"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
              <p className="text-2xs font-semibold" style={{ color: '#f59e0b' }}>
                ⚠ No opt-in recorded. You should not send marketing messages to this contact until consent is confirmed.
              </p>
            </div>
          )}
        </Card>

        {/* Custom Variables */}
        <Card title="Custom Variables">
          {Object.keys(customVars).length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              No custom variables set. They can be added via CSV import or the API.
            </p>
          ) : (
            Object.entries(customVars).map(([key, val]) => (
              <InfoRow key={key} label={key} value={String(val)} mono />
            ))
          )}
        </Card>
      </div>

      {/* ── Campaign History ─────────────────────────────────── */}
      <Card title={`Campaign History (${contact.campaign_history?.length ?? 0})`}>
        {!contact.campaign_history?.length ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            No campaigns sent to this contact yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--bg-border)' }}>
                  {['Campaign', 'Status', 'Sent At', 'Delivered At', 'Read At'].map((h) => (
                    <th key={h} className="text-left pb-2 pr-4 font-semibold uppercase tracking-wider text-2xs"
                      style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contact.campaign_history.map((row) => (
                  <tr key={row.id}
                    className="border-b"
                    style={{ borderColor: 'var(--bg-border)' }}>
                    <td className="py-2.5 pr-4 font-medium max-w-[160px] truncate"
                      style={{ color: 'var(--text-primary)' }}>
                      {row.campaign_name}
                    </td>
                    <td className="py-2.5 pr-4">
                      <DeliveryBadge status={row.delivery_status} />
                      {row.error_message && (
                        <p className="text-2xs mt-0.5" style={{ color: '#f87171' }}
                          title={row.error_message}>
                          {row.error_message.slice(0, 40)}{row.error_message.length > 40 ? '…' : ''}
                        </p>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                      {row.sent_at ? fmtDate(row.sent_at) : '—'}
                    </td>
                    <td className="py-2.5 pr-4 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                      {row.delivered_at ? fmtDate(row.delivered_at) : '—'}
                    </td>
                    <td className="py-2.5 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                      {row.read_at ? fmtDate(row.read_at) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

    </div>
  );
}
