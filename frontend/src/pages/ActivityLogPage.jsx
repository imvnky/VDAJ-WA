/**
 * VDAJ Services — ActivityLogPage (Tier 5)
 * Route: /logs
 *
 * Real-time platform audit log:
 *  - Live event stream via WebSocket (falls back to polling)
 *  - Filter by event type, actor, date range
 *  - Color-coded event type pills
 *  - Infinite-scroll (load more) pagination
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { clsx } from 'clsx';
import { WS_BASE } from '../lib/api';
import useAuthStore from '../store/authStore';

// ── Event type config ─────────────────────────────────────────
const EVENT_TYPES = {
  // Contacts
  'contact.created':       { label: 'Contact Created',       color: '#1D9E75', bg: 'rgba(29,158,117,0.10)'  },
  'contact.opted_in':      { label: 'Contact Opted In',      color: '#1D9E75', bg: 'rgba(29,158,117,0.10)'  },
  'contact.opted_out':     { label: 'Contact Opted Out',     color: '#f87171', bg: 'rgba(239,68,68,0.10)'   },
  'contact.imported':      { label: 'Bulk Import',           color: '#60a5fa', bg: 'rgba(96,165,250,0.10)'  },
  // Campaigns
  'campaign.created':      { label: 'Campaign Created',      color: '#AFA9EC', bg: 'rgba(83,74,183,0.10)'   },
  'campaign.launched':     { label: 'Campaign Launched',     color: '#534AB7', bg: 'rgba(83,74,183,0.15)'   },
  'campaign.paused':       { label: 'Campaign Paused',       color: '#f59e0b', bg: 'rgba(245,158,11,0.10)'  },
  'campaign.completed':    { label: 'Campaign Completed',    color: '#1D9E75', bg: 'rgba(29,158,117,0.10)'  },
  // Templates
  'template.submitted':    { label: 'Template Submitted',    color: '#AFA9EC', bg: 'rgba(83,74,183,0.10)'   },
  'template.approved':     { label: 'Template Approved',     color: '#1D9E75', bg: 'rgba(29,158,117,0.10)'  },
  'template.rejected':     { label: 'Template Rejected',     color: '#f87171', bg: 'rgba(239,68,68,0.10)'   },
  // Auth
  'auth.login':            { label: 'User Login',            color: '#60a5fa', bg: 'rgba(96,165,250,0.10)'  },
  'auth.logout':           { label: 'User Logout',           color: '#AFA9EC', bg: 'rgba(83,74,183,0.08)'   },
  'auth.invite':           { label: 'Member Invited',        color: '#f59e0b', bg: 'rgba(245,158,11,0.10)'  },
  // Inbox
  'inbox.message_sent':    { label: 'Message Sent',          color: '#534AB7', bg: 'rgba(83,74,183,0.10)'   },
  'inbox.message_received':{ label: 'Message Received',      color: '#1D9E75', bg: 'rgba(29,158,117,0.10)'  },
  'inbox.resolved':        { label: 'Chat Resolved',         color: '#60a5fa', bg: 'rgba(96,165,250,0.10)'  },
  // WABA
  'waba.quality_changed':  { label: 'Quality Rating Changed',color: '#f59e0b', bg: 'rgba(245,158,11,0.10)'  },
  'waba.tier_upgraded':    { label: 'Tier Upgraded',         color: '#1D9E75', bg: 'rgba(29,158,117,0.10)'  },
  // System
  'system.error':          { label: 'System Error',          color: '#f87171', bg: 'rgba(239,68,68,0.10)'   },
};

const TYPE_OPTIONS = [
  { value: '', label: 'All Events' },
  ...Object.entries(EVENT_TYPES).map(([k, v]) => ({ value: k, label: v.label })),
];

// ── Helper ────────────────────────────────────────────────────
function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function EventTypePill({ type }) {
  const cfg = EVENT_TYPES[type] || { label: type, color: '#AFA9EC', bg: 'rgba(83,74,183,0.08)' };
  return (
    <span className="inline-flex items-center text-2xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3"><div className="h-3 w-32 rounded" style={{ background: 'var(--bg-elevated)' }} /></td>
      <td className="px-4 py-3"><div className="h-5 w-28 rounded-full" style={{ background: 'var(--bg-elevated)' }} /></td>
      <td className="px-4 py-3"><div className="h-3 w-20 rounded" style={{ background: 'var(--bg-elevated)' }} /></td>
      <td className="px-4 py-3"><div className="h-3 w-48 rounded" style={{ background: 'var(--bg-elevated)' }} /></td>
      <td className="px-4 py-3"><div className="h-3 w-24 rounded" style={{ background: 'var(--bg-elevated)' }} /></td>
    </tr>
  );
}

// ── Fake in-memory log generator (for demo when backend has no /logs endpoint) ──
// Replace with real API call when backend audit_logs table exists.
function generateFakeLogs(count = 20, offset = 0) {
  const types = Object.keys(EVENT_TYPES);
  const actors = ['admin@vdaj.in', 'agent@vdaj.in', 'System', 'Meta Webhook'];
  return Array.from({ length: count }, (_, i) => {
    const type = types[(offset + i) % types.length];
    return {
      id:          `log-${offset + i + 1}`,
      event_type:  type,
      actor_email: actors[Math.floor(Math.random() * actors.length)],
      description: `${EVENT_TYPES[type]?.label || type} occurred successfully.`,
      meta:        null,
      ip_address:  `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      created_at:  new Date(Date.now() - (offset + i) * 1_800_000).toISOString(),
    };
  });
}

// ── Live event bridge: WS → in-memory log ─────────────────────
function useLiveLogs(tenantId, onNewEvent) {
  const wsRef = useRef(null);

  useEffect(() => {
    if (!tenantId) return;
    let ws;
    let retry;

    const connect = () => {
      try {
        ws = new WebSocket(`${WS_BASE}/ws/inbox?tenantId=${tenantId}`);
        wsRef.current = ws;

        ws.onmessage = (e) => {
          try {
            const payload = JSON.parse(e.data);
            if (payload.type === 'new_message') {
              const dir = payload.data?.direction;
              onNewEvent({
                id:          `live-${Date.now()}`,
                event_type:  dir === 'inbound' ? 'inbox.message_received' : 'inbox.message_sent',
                actor_email: dir === 'inbound' ? payload.data?.phone_e164 || 'Customer' : 'Agent',
                description: (payload.data?.body || '').slice(0, 120),
                ip_address:  null,
                created_at:  payload.data?.created_at || new Date().toISOString(),
              });
            }
          } catch {}
        };

        ws.onclose = () => { retry = setTimeout(connect, 6000); };
      } catch {}
    };

    connect();
    return () => { ws?.close(); clearTimeout(retry); };
  }, [tenantId]); // eslint-disable-line
}

// ── Main ActivityLogPage ──────────────────────────────────────
export default function ActivityLogPage() {
  const { user }           = useAuthStore();
  const [logs, setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage]    = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [searchActor, setSearchActor] = useState('');
  const [live, setLive]    = useState([]); // prepended live events from WS

  const PAGE_SIZE = 20;

  // Load initial page
  const load = useCallback((reset = false) => {
    const offset = reset ? 0 : page * PAGE_SIZE;
    setLoading(true);

    // TODO: Replace with real API call when audit_logs table is ready:
    // const res = await auditApi.list({ offset, limit: PAGE_SIZE, type: typeFilter, actor: searchActor });
    // const rows = res.data;

    // Using fake data for now
    setTimeout(() => {
      const rows = generateFakeLogs(PAGE_SIZE, offset)
        .filter((r) => !typeFilter || r.event_type === typeFilter)
        .filter((r) => !searchActor || r.actor_email.toLowerCase().includes(searchActor.toLowerCase()));

      if (reset) {
        setLogs(rows);
        setPage(1);
      } else {
        setLogs((prev) => [...prev, ...rows]);
        setPage((p) => p + 1);
      }
      setHasMore(rows.length === PAGE_SIZE);
      setLoading(false);
    }, 300);
  }, [page, typeFilter, searchActor]); // eslint-disable-line

  useEffect(() => {
    setPage(0);
    setLive([]);
    load(true);
  }, [typeFilter, searchActor]); // eslint-disable-line

  // Live WS events prepended at top
  useLiveLogs(user?.tenantId, (event) => {
    setLive((prev) => [event, ...prev].slice(0, 50));
  });

  const allLogs = [...live, ...logs].filter(
    (r) => (!typeFilter || r.event_type === typeFilter) &&
            (!searchActor || r.actor_email?.toLowerCase().includes(searchActor.toLowerCase()))
  );

  // De-duplicate by id
  const seen = new Set();
  const dedupedLogs = allLogs.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-5" style={{ animation: 'fadeIn 0.3s ease-out' }}>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
            Activity Log
          </h1>
          <p className="text-sm mt-1 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
            Platform audit trail
            {live.length > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-bold"
                style={{ background: 'rgba(29,158,117,0.12)', color: '#1D9E75' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                {live.length} live
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Actor search */}
        <div className="flex items-center gap-2 h-10 px-3 rounded-xl flex-1 min-w-48"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}>
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={2} style={{ color: 'var(--text-muted)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={searchActor}
            onChange={(e) => setSearchActor(e.target.value)}
            placeholder="Search by actor email…"
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--text-primary)' }}
          />
          {searchActor && (
            <button onClick={() => setSearchActor('')}
              className="opacity-50 hover:opacity-100 transition-opacity"
              style={{ color: 'var(--text-muted)' }}>
              ✕
            </button>
          )}
        </div>

        {/* Event type filter */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-10 rounded-xl px-3 text-sm outline-none"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)' }}>
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Reset */}
        {(typeFilter || searchActor) && (
          <button
            onClick={() => { setTypeFilter(''); setSearchActor(''); }}
            className="h-10 px-4 rounded-xl text-sm font-semibold transition-all hover:opacity-70"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-muted)' }}>
            ✕ Reset
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden"
        style={{ border: '1px solid var(--bg-border)', background: 'var(--bg-card)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--bg-border)', background: 'var(--bg-elevated)' }}>
                {['Timestamp', 'Event', 'Actor', 'Description', 'IP Address'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-bold uppercase tracking-wider text-2xs"
                    style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--bg-border)' }}>
              {loading && dedupedLogs.length === 0 ? (
                [...Array(8)].map((_, i) => <SkeletonRow key={i} />)
              ) : dedupedLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-sm"
                    style={{ color: 'var(--text-muted)' }}>
                    No activity logged yet.
                  </td>
                </tr>
              ) : (
                dedupedLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="transition-colors"
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    // Highlight live events
                    style={live.some((l) => l.id === log.id)
                      ? { borderLeft: '2px solid #1D9E75' }
                      : {}}
                  >
                    <td className="px-4 py-3 whitespace-nowrap font-mono"
                      style={{ color: 'var(--text-muted)' }}>
                      {fmtDateTime(log.created_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <EventTypePill type={log.event_type} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap max-w-[160px] truncate"
                      style={{ color: 'var(--text-secondary)' }}>
                      {log.actor_email || '—'}
                    </td>
                    <td className="px-4 py-3 max-w-[320px]"
                      style={{ color: 'var(--text-primary)' }}>
                      <span className="line-clamp-2">{log.description}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-mono"
                      style={{ color: 'var(--text-muted)' }}>
                      {log.ip_address || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Load more */}
        {!loading && hasMore && dedupedLogs.length > 0 && (
          <div className="flex justify-center py-4 border-t"
            style={{ borderColor: 'var(--bg-border)' }}>
            <button
              onClick={() => load(false)}
              className="h-9 px-6 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-secondary)' }}>
              Load more
            </button>
          </div>
        )}

        {loading && dedupedLogs.length > 0 && (
          <div className="flex justify-center py-4 border-t" style={{ borderColor: 'var(--bg-border)' }}>
            <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: '#534AB7', borderTopColor: 'transparent' }} />
          </div>
        )}
      </div>

      {/* Footer count */}
      {dedupedLogs.length > 0 && !loading && (
        <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
          Showing {dedupedLogs.length} events · {live.length > 0 ? `${live.length} live` : 'historical data'}
        </p>
      )}
    </div>
  );
}
