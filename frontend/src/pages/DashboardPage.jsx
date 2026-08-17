/**
 * VDAJ Services — DashboardPage
 * Live metrics + campaign activity stream.
 * Text colors are explicit — no more invisible-on-white-card text.
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { campaignApi, queueApi } from '../lib/api';
import useAuthStore from '../store/authStore';

// Status badge styles — kept vibrant but with opaque base colors so they work on white cards too
const CAMPAIGN_STATUS_STYLE = {
  draft:      'bg-slate-100 text-slate-500 border-slate-200 dark:bg-surface-elevated dark:text-slate-400 dark:border-surface-border',
  scheduled:  'bg-[#EEF0FF] text-[#534AB7] border-[#C9C5F5] dark:bg-brand/15 dark:text-[#AFA9EC] dark:border-brand/30',
  running:    'bg-[#EEF0FF] text-[#534AB7] border-[#C9C5F5] dark:bg-brand/20 dark:text-[#AFA9EC] dark:border-brand/30',
  paused:     'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30',
  completed:  'bg-[#E8F9F4] text-[#1D9E75] border-[#A3E4D0] dark:bg-signal-teal/15 dark:text-teal-light dark:border-signal-teal/30',
  failed:     'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30',
};

// ─── MetricCard ───────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, icon, accentClass }) {
  return (
    <div
      className="p-6 flex flex-col gap-4 rounded-2xl border"
      style={{ background: '#FFFFFF', borderColor: '#E6E4F5' }}
    >
      <div className="flex items-start justify-between">
        <div>
          {/* Label: always visible slate on light bg */}
          <p className="text-xs font-semibold uppercase tracking-wider text-[#5A5A6E] dark:text-[#AFA9EC]">
            {label}
          </p>
          {/* Big number */}
          <p className={clsx('text-3xl font-bold mt-1 text-[#0F0F0F] dark:text-[#F8F7FF]', accentClass)}>
            {value ?? '—'}
          </p>
          {/* Subtext */}
          {sub && (
            <p className="text-xs text-[#5A5A6E] dark:text-slate-400 mt-1">{sub}</p>
          )}
        </div>
        {/* Icon badge */}
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: '#F3F2FD' }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ className }) {
  return (
    <div className={clsx('animate-pulse rounded-xl', className)}
      style={{ background: '#F3F2FD' }} />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuthStore();
  const [campaigns, setCampaigns]   = useState([]);
  const [queueStats, setQueueStats] = useState(null);
  const [loading, setLoading]       = useState(true);

  const isSuperAdmin = user?.role === 'super_admin';

  useEffect(() => {
    const load = async () => {
      try {
        const promises = [campaignApi.list({ limit: 8 })];
        // Only super_admin has access to queue stats — skip for tenant users
        if (isSuperAdmin) promises.push(queueApi.stats());

        const results = await Promise.allSettled(promises);
        if (results[0]?.status === 'fulfilled') setCampaigns(results[0].value?.data || []);
        if (isSuperAdmin && results[1]?.status === 'fulfilled') setQueueStats(results[1].value?.data || null);
      } finally {
        setLoading(false);
      }
    };
    load();

    // Live queue refresh — super_admin only
    if (!isSuperAdmin) return;
    const timer = setInterval(() => {
      queueApi.stats().then((r) => setQueueStats(r?.data || null)).catch(() => {});
    }, 15_000);
    return () => clearInterval(timer);
  }, [isSuperAdmin]);

  const totalSent      = campaigns.reduce((a, c) => a + (c.sent_count        || 0), 0);
  const totalDelivered = campaigns.reduce((a, c) => a + (c.delivered_count   || 0), 0);
  const totalRead      = campaigns.reduce((a, c) => a + (c.read_count        || 0), 0);
  const totalDead      = campaigns.reduce((a, c) => a + (c.dead_letter_count || 0), 0);
  const deliveredPct   = totalSent ? Math.round((totalDelivered / totalSent) * 100) : 0;
  const readPct        = totalSent ? Math.round((totalRead      / totalSent) * 100) : 0;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">

      {/* ── Header ────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-[#0F0F0F] dark:text-[#F8F7FF]">
          Good {greeting},{' '}
          <span className="text-gradient">{user?.firstName}</span> 👋
        </h1>
        <p className="text-sm text-[#5A5A6E] dark:text-slate-400 mt-1">
          Here's your platform overview for today.
        </p>
      </div>

      {/* ── Metric Cards ──────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-36" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

          <MetricCard
            label="Total Sent"
            value={totalSent.toLocaleString()}
            sub="Across all campaigns"
            icon={
              <svg className="w-5 h-5" style={{ color: '#534AB7' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            }
          />

          <MetricCard
            label="Delivered"
            value={`${deliveredPct}%`}
            sub={`${totalDelivered.toLocaleString()} messages`}
            icon={
              <svg className="w-5 h-5" style={{ color: '#1D9E75' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />

          <MetricCard
            label="Read Rate"
            value={`${readPct}%`}
            sub={`${totalRead.toLocaleString()} opened`}
            icon={
              <svg className="w-5 h-5" style={{ color: '#AFA9EC' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            }
          />

          <MetricCard
            label="Failed / DLQ"
            value={totalDead.toLocaleString()}
            sub="Needs attention"
            accentClass={totalDead > 0 ? 'text-red-600 dark:text-red-400' : undefined}
            icon={
              <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            }
          />

        </div>
      )}

      {/* ── Queue Health + Campaign Stream ────────────────────── */}
      {/* Queue health panel only visible to super_admin */}
      <div className={isSuperAdmin ? 'grid grid-cols-1 xl:grid-cols-3 gap-6' : 'grid grid-cols-1 gap-6'}>

        {isSuperAdmin && (
          <div
            className="rounded-2xl p-6"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)' }}
          >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Redis Queue Health
            </h2>
            <span className="w-2 h-2 rounded-full bg-[#1D9E75] animate-pulse" />
          </div>

          {!queueStats ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : (
            <div className="space-y-3">
              {[
                { label: 'Waiting',     value: queueStats.messageQueue?.waiting,    color: '#534AB7' },
                { label: 'Active',      value: queueStats.messageQueue?.active,     color: '#1D9E75' },
                { label: 'Completed',   value: queueStats.messageQueue?.completed,  color: 'var(--text-secondary)' },
                { label: 'Failed',      value: queueStats.messageQueue?.failed,     color: '#f87171' },
                { label: 'Dead Letter', value: queueStats.deadLetterQueue?.waiting, color: '#f59e0b' },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                  style={{ background: 'var(--bg-elevated)' }}
                >
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                  <span className="text-sm font-bold tabular-nums" style={{ color: row.color }}>
                    {row.value ?? 0}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {/* Campaign Activity Stream */}
        <div
          className={isSuperAdmin ? 'xl:col-span-2 rounded-2xl p-6' : 'rounded-2xl p-6'}
          style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)' }}
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Recent Campaigns
            </h2>
            <Link
              to="/campaigns"
              className="text-xs font-medium hover:underline transition-colors"
              style={{ color: '#534AB7' }}
            >
              View all →
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : campaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <svg
                className="w-10 h-10 mb-3"
                style={{ color: '#D0CEEC' }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
              <p className="text-sm text-[#5A5A6E] dark:text-slate-400">No campaigns yet.</p>
              <Link
                to="/campaigns"
                className="mt-3 text-xs font-medium text-[#534AB7] dark:text-[#AFA9EC] hover:underline"
              >
                Create your first →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map((c) => {
                const pct = c.total_count ? Math.round((c.sent_count / c.total_count) * 100) : 0;
                return (
                  <div
                    key={c.id}
                    className="flex items-center gap-4 px-4 py-3 rounded-xl border transition-colors hover:border-[#534AB7]/30"
                    style={{ background: '#F8F7FF', borderColor: '#E6E4F5' }}
                  >
                    <div className="flex-1 min-w-0">
                      {/* Campaign name */}
                      <p className="text-sm font-semibold text-[#0F0F0F] dark:text-[#F8F7FF] truncate">
                        {c.name}
                      </p>
                      {/* Progress bar row */}
                      <div className="flex items-center gap-3 mt-1">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#E6E4F5' }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #534AB7, #AFA9EC)' }}
                          />
                        </div>
                        <span className="text-2xs text-[#5A5A6E] dark:text-slate-400 tabular-nums shrink-0">
                          {pct}%
                        </span>
                      </div>
                    </div>
                    <span className={clsx(
                      'inline-flex px-2.5 py-1 rounded-full text-2xs font-semibold border shrink-0',
                      CAMPAIGN_STATUS_STYLE[c.status]
                    )}>
                      {c.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
