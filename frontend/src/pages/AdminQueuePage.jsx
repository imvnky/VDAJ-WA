/**
 * VDAJ Services — AdminQueuePage
 * Real-time Redis queue monitor + Dead Letter Queue viewer with replay.
 *
 * Sprint 3 fix:
 *  - Role guard: renders Access Denied for non-super_admin (prevents ERR_VDAJ_AUTH_006 toast floods)
 *  - All text/bg classes replaced with CSS variable tokens — works in Light, Dark, Colorful
 *  - StatBox uses var(--text-primary / muted) instead of hardcoded text-aura-white/40
 */

import React, { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { queueApi } from '../lib/api';
import { showSuccess } from '../components/atoms/Toast/Toast.jsx';
import Button from '../components/atoms/Button/Button.jsx';
import useAuthStore from '../store/authStore';

// ── Stat Box ───────────────────────────────────────────────────
function StatBox({ label, value, valueStyle }) {
  return (
    <div
      className="p-5 text-center rounded-2xl"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--bg-border)',
      }}
    >
      <p
        className="text-3xl font-black tabular-nums"
        style={valueStyle || { color: 'var(--text-primary)' }}
      >
        {value ?? '—'}
      </p>
      <p
        className="text-xs font-semibold uppercase tracking-wider mt-1"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </p>
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────
function Skeleton({ className }) {
  return (
    <div
      className={clsx('animate-pulse rounded-2xl', className)}
      style={{ background: 'var(--bg-elevated)' }}
    />
  );
}

// ── Section heading ────────────────────────────────────────────
function SectionHead({ dot, children, badge }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: dot }}
      />
      <h2
        className="text-sm font-bold"
        style={{ color: 'var(--text-primary)' }}
      >
        {children}
      </h2>
      {badge && (
        <span
          className="text-2xs px-2 py-0.5 rounded-full font-bold"
          style={{
            background: 'rgba(239,68,68,0.12)',
            color: '#f87171',
            border: '1px solid rgba(239,68,68,0.25)',
          }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

// ── Access Denied state ────────────────────────────────────────
function AccessDenied() {
  return (
    <div
      className="flex flex-col items-center justify-center py-24 rounded-2xl text-center"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--bg-border)',
      }}
    >
      <svg
        className="w-12 h-12 mb-4"
        style={{ color: 'var(--text-muted)', opacity: 0.35 }}
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
      <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
        Access Restricted
      </p>
      <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
        Queue Monitor is available to SuperAdmins only.
      </p>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────
export default function AdminQueuePage() {
  const { user } = useAuthStore();

  const [stats, setStats]               = useState(null);
  const [dlqJobs, setDlqJobs]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [replayLoading, setReplayLoading] = useState({});
  const [lastRefresh, setLastRefresh]   = useState(null);

  const isSuperAdmin = user?.role === 'super_admin';

  const load = useCallback(async () => {
    if (!isSuperAdmin) return;
    try {
      const [statsRes, dlqRes] = await Promise.allSettled([
        queueApi.stats(),
        queueApi.dlq(),
      ]);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value?.data || null);
      if (dlqRes.status  === 'fulfilled') setDlqJobs(dlqRes.value?.data || []);
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }
    load();
    const timer = setInterval(load, 10_000);
    return () => clearInterval(timer);
  }, [load, isSuperAdmin]);

  // ── RBAC gate ──────────────────────────────────────────────
  if (!isSuperAdmin) return <AccessDenied />;

  const mq  = stats?.messageQueue;
  const dlq = stats?.deadLetterQueue;

  return (
    <div className="max-w-6xl mx-auto space-y-8" style={{ animation: 'fadeIn 0.3s ease-out' }}>

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
            Queue Monitor
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Auto-refreshes every 10s
            {lastRefresh && ` · Last updated ${lastRefresh.toLocaleTimeString()}`}
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 h-9 px-4 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--bg-border)',
            color: 'var(--text-secondary)',
          }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* ── Main Queue Stats ──────────────────────────────────── */}
      <div>
        <SectionHead dot="#534AB7">Message Queue</SectionHead>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <StatBox label="Waiting"   value={mq?.waiting}   valueStyle={{ color: '#AFA9EC' }} />
            <StatBox label="Active"    value={mq?.active}    valueStyle={{ color: '#1D9E75' }} />
            <StatBox label="Delayed"   value={mq?.delayed}   valueStyle={{ color: '#f59e0b' }} />
            <StatBox label="Completed" value={mq?.completed} />
            <StatBox label="Failed"    value={mq?.failed}    valueStyle={{ color: '#f87171' }} />
          </div>
        )}
      </div>

      {/* ── Queue Distribution Bar ────────────────────────────── */}
      {mq && (
        <div
          className="p-5 rounded-2xl"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)' }}
        >
          <p
            className="text-xs font-semibold uppercase tracking-wider mb-3"
            style={{ color: 'var(--text-muted)' }}
          >
            Queue Distribution
          </p>
          {(() => {
            const total = (mq.waiting || 0) + (mq.active || 0) + (mq.completed || 0) + (mq.failed || 0);
            if (!total) {
              return (
                <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
                  Queue is empty.
                </p>
              );
            }
            const bars = [
              { label: 'Active',    val: mq.active,    color: '#1D9E75' },
              { label: 'Waiting',   val: mq.waiting,   color: '#AFA9EC' },
              { label: 'Completed', val: mq.completed, color: 'var(--bg-border)' },
              { label: 'Failed',    val: mq.failed,    color: '#f87171' },
            ];
            return (
              <div>
                <div className="flex h-4 rounded-full overflow-hidden gap-px">
                  {bars.map((b) => b.val > 0 && (
                    <div
                      key={b.label}
                      className="transition-all duration-500"
                      style={{ width: `${(b.val / total) * 100}%`, background: b.color }}
                      title={`${b.label}: ${b.val}`}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-4 mt-2">
                  {bars.map((b) => (
                    <div key={b.label} className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: b.color }} />
                      <span className="text-2xs" style={{ color: 'var(--text-muted)' }}>
                        {b.label} ({b.val ?? 0})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Dead-Letter Queue ─────────────────────────────────── */}
      <div>
        <SectionHead
          dot="#f87171"
          badge={dlqJobs.length > 0 ? `${dlqJobs.length} job${dlqJobs.length !== 1 ? 's' : ''}` : undefined}
        >
          Dead-Letter Queue
        </SectionHead>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : dlqJobs.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-12 rounded-2xl"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)' }}
          >
            <svg
              className="w-10 h-10 mb-3"
              style={{ color: '#1D9E75', opacity: 0.4 }}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Dead-Letter Queue is empty. No failed jobs.
            </p>
          </div>
        ) : (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)' }}
          >
            {/* Column headers */}
            <div
              className="grid grid-cols-12 gap-4 px-5 py-3 border-b"
              style={{ borderColor: 'var(--bg-border)', background: 'var(--bg-elevated)' }}
            >
              {['Campaign', 'Messages', 'Chunk', 'Error', 'Action'].map((h, i) => (
                <span
                  key={h}
                  className={clsx(
                    'text-2xs font-semibold uppercase tracking-wider',
                    i === 0 ? 'col-span-3' :
                    i === 1 ? 'col-span-2' :
                    i === 2 ? 'col-span-2' :
                    i === 3 ? 'col-span-3' :
                              'col-span-2 text-right'
                  )}
                  style={{ color: 'var(--text-muted)' }}
                >
                  {h}
                </span>
              ))}
            </div>

            <div className="divide-y" style={{ borderColor: 'var(--bg-border)' }}>
              {dlqJobs.map((job) => (
                <div
                  key={job.id}
                  className="grid grid-cols-12 gap-4 px-5 py-4 items-center transition-colors"
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.04)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  {/* Campaign ID + timestamp */}
                  <div className="col-span-3 min-w-0">
                    <p
                      className="text-xs font-mono truncate"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {job.campaignId?.slice(0, 8)}…
                    </p>
                    {job.failedAt && (
                      <p className="text-2xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {new Date(job.failedAt).toLocaleString()}
                      </p>
                    )}
                  </div>

                  {/* Message count */}
                  <div className="col-span-2">
                    <span
                      className="text-sm font-bold tabular-nums"
                      style={{ color: '#f87171' }}
                    >
                      {job.messageCount ?? 0}
                    </span>
                    <span className="text-2xs ml-1" style={{ color: 'var(--text-muted)' }}>
                      msgs
                    </span>
                  </div>

                  {/* Chunk badge */}
                  <div className="col-span-2">
                    <span
                      className="text-2xs px-2 py-0.5 rounded-full font-semibold"
                      style={{
                        background: 'rgba(239,68,68,0.10)',
                        color: '#f87171',
                        border: '1px solid rgba(239,68,68,0.25)',
                      }}
                    >
                      Chunk {job.chunkIndex ?? '?'}
                    </span>
                  </div>

                  {/* Error */}
                  <div className="col-span-3 min-w-0">
                    <p
                      className="text-2xs font-mono truncate"
                      style={{ color: '#f87171', opacity: 0.8 }}
                      title={job.originalError}
                    >
                      {job.originalError || 'Unknown error'}
                    </p>
                  </div>

                  {/* Replay button */}
                  <div className="col-span-2 flex justify-end">
                    <button
                      disabled={replayLoading[job.id]}
                      onClick={async () => {
                        setReplayLoading((p) => ({ ...p, [job.id]: true }));
                        try {
                          await queueApi.replay(job.id);
                          showSuccess('Job replayed — back in main queue with 3 retries.');
                          setDlqJobs((jobs) => jobs.filter((j) => j.id !== job.id));
                        } catch {} finally {
                          setReplayLoading((p) => ({ ...p, [job.id]: false }));
                        }
                      }}
                      className="h-7 px-3 rounded-lg text-xs font-semibold transition-all hover:opacity-80 disabled:opacity-40"
                      style={{
                        background: 'rgba(83,74,183,0.12)',
                        border: '1px solid rgba(83,74,183,0.3)',
                        color: '#AFA9EC',
                      }}
                    >
                      {replayLoading[job.id] ? '…' : 'Replay'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── DLQ stats row ─────────────────────────────────────── */}
      {dlq && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <StatBox label="DLQ Waiting"   value={dlq.waiting}   valueStyle={{ color: '#f59e0b' }} />
          <StatBox label="DLQ Completed" value={dlq.completed} />
          <StatBox label="DLQ Failed"    value={dlq.failed}    valueStyle={{ color: '#f87171' }} />
        </div>
      )}

      {/* Footer note */}
      <p className="text-xs text-center pb-4" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
        Replayed jobs return to the main queue with 3 automatic retry attempts.
        Jobs that fail again will return to this Dead-Letter Queue.
      </p>
    </div>
  );
}
