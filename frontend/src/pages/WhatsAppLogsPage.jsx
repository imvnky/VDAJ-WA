/**
 * VDAJ Services — WhatsAppLogsPage
 * Route: /logs
 *
 * Detailed delivery log for all campaign_messages.
 * Columns: Phone, Contact, Campaign, Template, Status, Sent At, Delivered At, Read At
 * Filters: Status dropdown · Date range picker · Campaign selector
 * Pagination: load-more (50/page)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { campaignApi } from '../lib/api';
import { ErrorState, parseApiError } from '../components/atoms/ErrorState/ErrorState.jsx';

// ── Status config ─────────────────────────────────────────────
const STATUS_CFG = {
  queued:    { label: 'Queued',    color: '#AFA9EC', bg: 'rgba(83,74,183,0.12)',   icon: '🕐' },
  sent:      { label: 'Sent',      color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  icon: '✉️' },
  delivered: { label: 'Delivered', color: '#1D9E75', bg: 'rgba(29,158,117,0.12)', icon: '✓✓' },
  read:      { label: 'Read',      color: '#53BDEB', bg: 'rgba(83,189,235,0.12)', icon: '👁️' },
  failed:    { label: 'Failed',    color: '#f87171', bg: 'rgba(239,68,68,0.12)',   icon: '✗'  },
  skipped:   { label: 'Skipped',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: '⤵️' },
};

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  ...Object.entries(STATUS_CFG).map(([k, v]) => ({ value: k, label: v.label })),
];

// ── Helpers ───────────────────────────────────────────────────
function fmtDateTime(iso) {
  if (!iso) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  const d = new Date(iso);
  return (
    <span className="font-mono text-2xs whitespace-nowrap">
      {d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
      {' '}
      <span style={{ color: 'var(--text-muted)' }}>
        {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </span>
    </span>
  );
}

function StatusPill({ status }) {
  const cfg = STATUS_CFG[status] || { label: status, color: '#AFA9EC', bg: 'rgba(83,74,183,0.10)', icon: '?' };
  return (
    <span className="inline-flex items-center gap-1 text-2xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.color }}>
      <span className="text-xs leading-none" aria-hidden="true">{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

function Skeleton() {
  return (
    <tr className="animate-pulse">
      {[140, 120, 130, 110, 90, 120, 110, 110].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3 rounded" style={{ width: w, background: 'var(--bg-elevated)' }} />
        </td>
      ))}
    </tr>
  );
}

// ── Summary bar ───────────────────────────────────────────────
function SummaryBar({ messages }) {
  if (!messages.length) return null;
  const counts = messages.reduce((acc, m) => {
    acc[m.status] = (acc[m.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {Object.entries(counts).map(([status, count]) => {
        const cfg = STATUS_CFG[status];
        if (!cfg) return null;
        return (
          <div key={status} className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold"
            style={{ background: cfg.bg, color: cfg.color }}>
            {cfg.icon} {count} {cfg.label}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
const PAGE_SIZE = 50;

export default function WhatsAppLogsPage() {
  const [messages,  setMessages]  = useState([]);
  const [total,     setTotal]     = useState(0);
  const [offset,    setOffset]    = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filters
  const [statusFilter,   setStatusFilter]   = useState('');
  const [campaignFilter, setCampaignFilter] = useState('');
  const [dateFrom,       setDateFrom]       = useState('');
  const [dateTo,         setDateTo]         = useState('');

  // Campaign list for selector
  const [campaigns, setCampaigns] = useState([]);

  // Load campaigns for filter dropdown — silent to avoid toast on load
  useEffect(() => {
    campaignApi.list({ limit: 100, offset: 0 }, { silent: true })
      .then((r) => setCampaigns(r?.data || []))
      .catch(() => {});
  }, []);

  // Fetch messages
  const [fetchError, setFetchError] = useState(null);
  const fetchMessages = useCallback(async (reset = true) => {
    const currentOffset = reset ? 0 : offset;
    reset ? setLoading(true) : setLoadingMore(true);
    if (reset) setFetchError(null);

    try {
      const params = {
        limit:  PAGE_SIZE,
        offset: currentOffset,
        ...(statusFilter   && { status:      statusFilter }),
        ...(campaignFilter && { campaign_id: campaignFilter }),
        ...(dateFrom       && { date_from:   dateFrom }),
        ...(dateTo         && { date_to:     dateTo }),
      };

      const res = await campaignApi.messages(params, { silent: true });
      const rows = res?.data?.messages || res?.messages || [];
      const tot  = res?.data?.total    || res?.total    || 0;

      if (reset) {
        setMessages(rows);
        setOffset(PAGE_SIZE);
      } else {
        setMessages((prev) => [...prev, ...rows]);
        setOffset(currentOffset + PAGE_SIZE);
      }
      setTotal(tot);
    } catch (err) {
      if (reset) setFetchError(parseApiError(err));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [statusFilter, campaignFilter, dateFrom, dateTo, offset]); // eslint-disable-line

  // Re-fetch on filter change
  useEffect(() => {
    fetchMessages(true);
  }, [statusFilter, campaignFilter, dateFrom, dateTo]); // eslint-disable-line

  const hasMore = messages.length < total;

  const clearFilters = () => {
    setStatusFilter('');
    setCampaignFilter('');
    setDateFrom('');
    setDateTo('');
  };

  const hasFilters = statusFilter || campaignFilter || dateFrom || dateTo;

  return (
    <div className="w-full space-y-6" style={{ animation: 'fadeIn 0.3s ease-out' }}>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
            WhatsApp Message Logs
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Full delivery log for all campaign messages ·{' '}
            <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
              {total.toLocaleString()} total records
            </span>
          </p>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex items-center gap-3 flex-wrap p-4 rounded-2xl"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)' }}>

        {/* Status */}
        <div className="flex flex-col gap-1">
          <label className="text-2xs font-bold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}>Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-xl px-3 text-sm outline-none"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', minWidth: 140 }}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Campaign */}
        <div className="flex flex-col gap-1">
          <label className="text-2xs font-bold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}>Campaign</label>
          <select
            value={campaignFilter}
            onChange={(e) => setCampaignFilter(e.target.value)}
            className="h-9 rounded-xl px-3 text-sm outline-none"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', minWidth: 180 }}>
            <option value="">All Campaigns</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Date From */}
        <div className="flex flex-col gap-1">
          <label className="text-2xs font-bold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}>From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 rounded-xl px-3 text-sm outline-none"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)' }}
          />
        </div>

        {/* Date To */}
        <div className="flex flex-col gap-1">
          <label className="text-2xs font-bold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}>To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            min={dateFrom || undefined}
            className="h-9 rounded-xl px-3 text-sm outline-none"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)' }}
          />
        </div>

        {/* Clear */}
        {hasFilters && (
          <div className="flex flex-col gap-1 justify-end">
            <div className="h-4" />
            <button
              onClick={clearFilters}
              className="h-9 px-4 rounded-xl text-sm font-semibold transition-all hover:opacity-70"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-muted)' }}>
              ✕ Clear
            </button>
          </div>
        )}
      </div>

      {/* Summary counts */}
      {!loading && messages.length > 0 && <SummaryBar messages={messages} />}

      {/* ── Table ── */}
      <div className="rounded-2xl overflow-hidden"
        style={{ border: '1px solid var(--bg-border)', background: 'var(--bg-card)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--bg-border)' }}>
                {[
                  'Phone Number',
                  'Contact',
                  'Campaign',
                  'Template',
                  'Status',
                  'Sent At',
                  'Delivered At',
                  'Read At',
                ].map((h) => (
                  <th key={h}
                    className="px-4 py-3 text-left font-bold uppercase tracking-wider text-2xs whitespace-nowrap"
                    style={{ color: 'var(--text-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--bg-border)' }}>
              {loading ? (
                [...Array(10)].map((_, i) => <Skeleton key={i} />)
              ) : fetchError ? (
                <tr>
                  <td colSpan={8} className="py-8">
                    <ErrorState
                      title="Failed to load message logs"
                      message={fetchError.message}
                      httpCode={fetchError.httpCode}
                      errorCode={fetchError.errorCode}
                      onRetry={() => fetchMessages(true)}
                    />
                  </td>
                </tr>
              ) : messages.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center"
                    style={{ color: 'var(--text-muted)' }}>
                    <div className="flex flex-col items-center gap-3">
                      <svg className="w-10 h-10 opacity-10" fill="none" viewBox="0 0 24 24"
                        stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        No messages found
                      </span>
                      <span className="text-xs">
                        {hasFilters ? 'Try adjusting your filters.' : 'Launch a campaign to see delivery logs here.'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                messages.map((msg) => {
                  const isDeadLetter = msg.is_dead_letter;
                  return (
                    <tr
                      key={msg.id}
                      className="transition-colors"
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      style={isDeadLetter ? { borderLeft: '2px solid rgba(239,68,68,0.4)' } : {}}
                    >
                      {/* Phone */}
                      <td className="px-4 py-3 whitespace-nowrap font-mono font-semibold"
                        style={{ color: 'var(--text-primary)' }}>
                        {msg.phone_e164}
                        {isDeadLetter && (
                          <span className="ml-1.5 text-2xs font-bold px-1 py-0.5 rounded"
                            style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}>
                            DLQ
                          </span>
                        )}
                      </td>

                      {/* Contact name */}
                      <td className="px-4 py-3 whitespace-nowrap"
                        style={{ color: 'var(--text-secondary)' }}>
                        {[msg.first_name, msg.last_name].filter(Boolean).join(' ') || '—'}
                      </td>

                      {/* Campaign */}
                      <td className="px-4 py-3 max-w-[180px]"
                        style={{ color: 'var(--text-primary)' }}>
                        <span className="truncate block" title={msg.campaign_name}>
                          {msg.campaign_name || '—'}
                        </span>
                      </td>

                      {/* Template */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {msg.template_name ? (
                          <span className="font-mono text-2xs px-1.5 py-0.5 rounded"
                            style={{ background: 'rgba(83,74,183,0.10)', color: '#AFA9EC' }}>
                            {msg.template_name}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <StatusPill status={msg.status} />
                          {msg.last_error && (
                            <span className="text-2xs truncate max-w-[140px]"
                              title={msg.last_error}
                              style={{ color: '#f87171' }}>
                              {msg.last_error.slice(0, 40)}…
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Sent At */}
                      <td className="px-4 py-3">{fmtDateTime(msg.sent_at)}</td>

                      {/* Delivered At */}
                      <td className="px-4 py-3">{fmtDateTime(msg.delivered_at)}</td>

                      {/* Read At */}
                      <td className="px-4 py-3">{fmtDateTime(msg.read_at)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Load more / footer */}
        {!loading && (
          <div className="flex items-center justify-between px-4 py-3 border-t"
            style={{ borderColor: 'var(--bg-border)', background: 'var(--bg-elevated)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Showing {messages.length.toLocaleString()} of {total.toLocaleString()} messages
            </p>
            {hasMore && (
              <button
                onClick={() => fetchMessages(false)}
                disabled={loadingMore}
                className="flex items-center gap-2 h-8 px-4 rounded-xl text-xs font-semibold transition-all hover:opacity-80 disabled:opacity-50"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)', color: 'var(--text-secondary)' }}>
                {loadingMore ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Loading…
                  </>
                ) : (
                  `Load more (${(total - messages.length).toLocaleString()} remaining)`
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
