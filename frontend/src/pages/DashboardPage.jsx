/**
 * VDAJ Services — DashboardPage (Tier 2 Overhaul)
 *
 * New sections (top → bottom):
 *  1. Header + greeting
 *  2. Onboarding Checklist — dismissible, hides when all steps done
 *  3. WABA Health Card     — quality rating, tier, daily usage bar
 *  4. Date-range pills + KPI tiles with delta %
 *  5. Queue Health (super_admin) + Recent Campaigns stream
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { campaignApi, queueApi, analyticsApi, tenantApi } from '../lib/api';
import useAuthStore from '../store/authStore';
import { showSuccess, showError } from '../components/atoms/Toast/Toast.jsx';

// ─── Tiny helpers ──────────────────────────────────────────────────────────────
const fmt = (n) => (n ?? 0).toLocaleString();

function pct(num, den) {
  if (!den || den === 0) return 0;
  return Math.round((num / den) * 100);
}

function deltaClass(d) {
  if (d === null || d === undefined) return 'text-[#94a3b8]';
  if (d > 0) return 'text-[#1D9E75]';
  if (d < 0) return 'text-red-500';
  return 'text-[#94a3b8]';
}

function deltaLabel(d) {
  if (d === null || d === undefined) return '—';
  const sign = d > 0 ? '+' : '';
  return `${sign}${d}%`;
}

// ─── Campaign status badge styles (Modern Shadcn style) ────────────────────────
const CAMPAIGN_STATUS_STYLE = {
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  scheduled: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  running: 'bg-indigo-50 text-indigo-700 border-indigo-200 animate-pulse',
  paused: 'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  failed: 'bg-rose-50 text-rose-700 border-rose-200',
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ className }) {
  return (
    <div
      className={clsx('animate-pulse rounded-xl bg-slate-100 border border-slate-200/60', className)}
    />
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. WABA Health Card
// ══════════════════════════════════════════════════════════════════════════════
const RATING_COLOR = { GREEN: '#059669', YELLOW: '#D97706', RED: '#DC2626' };
const RATING_BG = { GREEN: 'bg-emerald-50/70 border-emerald-100 text-emerald-800', YELLOW: 'bg-amber-50/70 border-amber-100 text-amber-800', RED: 'bg-rose-50/70 border-rose-100 text-rose-800' };
const RATING_EMOJI = { GREEN: '🟢', YELLOW: '🟡', RED: '🔴' };
const TIER_LABEL = {
  1: '1,000',
  2: '10,000',
  3: '100,000',
  4: 'Unlimited',
  TIER_250: '250',
  TIER_1K: '1,000',
  TIER_10K: '10,000',
  TIER_100K: '100,000',
  TIER_UNLIMITED: 'Unlimited',
};

function formatTierName(tier, rawTierName) {
  if (rawTierName) return rawTierName;
  const t = String(tier || '').toUpperCase();
  if (t === 'TIER_250' || t.includes('250')) return 'Tier 250';
  if (t === 'TIER_1K' || t.includes('1K') || t === '1') return 'Tier 1K';
  if (t === 'TIER_10K' || t.includes('10K') || t === '2') return 'Tier 10K';
  if (t === 'TIER_100K' || t.includes('100K') || t === '3') return 'Tier 100K';
  if (t.includes('UNLIMITED') || t === '4') return 'Tier Unlimited';
  return `Tier ${tier || '250'}`;
}

function WABAHealthCard({ health, loading, onSync, syncing }) {
  if (loading) {
    return (
      <div className="rounded-xl p-5 border border-slate-200/80 bg-white shadow-xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      </div>
    );
  }

  // When WABA not yet connected show a friendly prompt instead
  if (!health?.waba_connected) {
    return (
      <div className="rounded-xl p-5 border border-slate-200/80 bg-white shadow-xs flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-xl shrink-0">
            📱
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">
              WhatsApp not connected
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Connect your WhatsApp Business Account (WABA) to see live quality rating, messaging tier, and daily limits.
            </p>
          </div>
        </div>
        <Link
          to="/whatsapp-setup"
          className="shrink-0 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#534AB7] hover:bg-[#433A9D] text-white shadow-xs transition-all"
        >
          Connect Account →
        </Link>
      </div>
    );
  }

  const rating = (health.quality_rating || 'GREEN').toUpperCase();
  const tierDisplay = formatTierName(health.messaging_tier, health.tier_name);
  const limitLabel = health.daily_limit_label || TIER_LABEL[health.messaging_tier] || (health.daily_limit ? Number(health.daily_limit).toLocaleString() : '250');
  const msgsSent = Number(health.msgs_sent_today || 0);
  const dailyLimit = Number(health.daily_limit || (health.messaging_tier === 'TIER_250' ? 250 : 1000));
  const usedPct = health.usage_pct ?? Math.min(100, Math.round((msgsSent / (dailyLimit || 1)) * 100));
  const barColor = usedPct > 85 ? 'bg-rose-500' : usedPct > 60 ? 'bg-amber-500' : 'bg-emerald-500';

  const syncedAgo = health.waba_health_synced_at
    ? (() => {
      const diffMins = Math.round((Date.now() - new Date(health.waba_health_synced_at)) / 60_000);
      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffH = Math.round(diffMins / 60);
      return `${diffH}h ago`;
    })()
    : 'just now';

  return (
    <div className="rounded-xl p-5 border border-slate-200/80 bg-white shadow-xs">
      {/* Card header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-600 text-sm font-bold">
            ⚡
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 leading-tight">
              WhatsApp Account Health
            </h2>
            <p className="text-[11px] text-slate-500">Live Meta Graph API connection</p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 ml-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Meta Live
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-xs text-slate-400">
            Synced {syncedAgo}
          </span>
          {onSync && (
            <button
              type="button"
              onClick={onSync}
              disabled={syncing}
              title="Sync live status and quotas directly from Meta Graph API"
              className={clsx(
                "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all cursor-pointer shadow-xs",
                syncing
                  ? "bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-slate-900 active:scale-95"
              )}
            >
              <span className={clsx("inline-block", syncing && "animate-spin")}>
                ↻
              </span>
              <span>{syncing ? 'Syncing...' : 'Sync with Meta'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 4-column modern sub-grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Quality Rating */}
        <div className={clsx("rounded-lg p-3 border", RATING_BG[rating] || "bg-emerald-50/70 border-emerald-100")}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Quality Rating
            </p>
            {health.status && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-emerald-800 bg-white/80 border border-emerald-200/50">
                {health.status}
              </span>
            )}
          </div>
          <p className="text-base font-extrabold" style={{ color: RATING_COLOR[rating] || '#059669' }}>
            {RATING_EMOJI[rating] || '🟢'} {rating}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {rating === 'GREEN' ? 'Healthy & High Throughput' : rating === 'YELLOW' ? 'At risk' : '⚠ Action needed'}
          </p>
        </div>

        {/* Messaging Tier */}
        <div className="rounded-lg p-3 border border-indigo-100 bg-indigo-50/50">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Messaging Tier
          </p>
          <p className="text-base font-extrabold text-[#534AB7]">
            {tierDisplay}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {limitLabel} msgs/day capacity
          </p>
        </div>

        {/* Sent Today */}
        <div className="rounded-lg p-3 border border-slate-200/70 bg-slate-50/60">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Sent Today
          </p>
          <p className="text-base font-extrabold text-slate-900">
            {fmt(msgsSent)}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            of {limitLabel} allowed
          </p>
        </div>

        {/* Business Number */}
        <div className="rounded-lg p-3 border border-slate-200/70 bg-slate-50/60">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Business Number
          </p>
          <p className="text-sm font-extrabold text-slate-900 truncate" title={health.display_phone_number}>
            {health.display_phone_number || '—'}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5 truncate" title={health.verified_name}>
            {health.verified_name || (health.name_status === 'APPROVED' ? 'Meta Approved' : 'Name not verified')}
          </p>
        </div>
      </div>

      {/* Usage progress bar */}
      <div className="mt-4 pt-3 border-t border-slate-100">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-slate-500 text-[11px] font-medium">Rolling 24h Meta Quota Usage ({fmt(msgsSent)} of {limitLabel} allowed)</span>
          <span className="font-bold text-xs text-slate-800">{usedPct}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden bg-slate-100">
          <div
            className={clsx("h-full rounded-full transition-all duration-700", barColor)}
            style={{ width: `${usedPct}%` }}
          />
        </div>
        {usedPct >= 90 ? (
          <p className="text-xs mt-1.5 font-semibold text-rose-600">
            ⚠ Meta Daily Limit Exhausted ({usedPct}%) — Outbound campaign messages will be rate-limited by Meta (Error 130429) until the rolling 24-hour quota rolls over.
          </p>
        ) : usedPct >= 70 ? (
          <p className="text-xs mt-1.5 font-semibold text-amber-600">
            Approaching daily Meta Tier limit ({usedPct}%) — {Math.max(0, dailyLimit - msgsSent)} business-initiated conversations remaining in this 24-hour window.
          </p>
        ) : null}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. Onboarding Checklist Card (Modern Shadcn Style)
// ══════════════════════════════════════════════════════════════════════════════
function OnboardingCard({ health, campaigns, contacts, templates, onDismiss }) {
  const approvedTemplates = templates?.filter((t) => t.status === 'approved').length ?? 0;
  const contactCount = contacts ?? 0;
  const campaignCount = campaigns ?? 0;

  const steps = [
    {
      id: 'waba',
      label: 'Connect your WhatsApp Business Account (WABA)',
      done: !!health?.waba_connected,
      link: '/whatsapp-setup',
    },
    {
      id: 'template',
      label: 'Create & get a message template approved by Meta',
      done: approvedTemplates > 0,
      link: '/templates',
    },
    {
      id: 'contacts',
      label: 'Import contacts with opt-in consent',
      done: contactCount > 0,
      link: '/contacts',
    },
    {
      id: 'campaign',
      label: 'Send or schedule your first broadcast campaign',
      done: campaignCount > 0,
      link: '/campaigns',
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;

  if (allDone) return null;

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden shadow-xs">
      {/* Header bar */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 border-b border-slate-200/70">
        <div className="flex items-center gap-2.5">
          <span className="text-base">🚀</span>
          <div>
            <p className="text-xs font-bold text-slate-900">
              Getting Started Checklist — {doneCount} of {steps.length} completed
            </p>
            <p className="text-[11px] text-slate-500">
              Complete these steps to unlock full automated WhatsApp campaigns.
            </p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-200/50 transition-colors shrink-0"
          aria-label="Dismiss checklist"
        >
          ✕
        </button>
      </div>

      {/* Steps */}
      <div className="divide-y divide-slate-100">
        {steps.map((step, idx) => (
          <Link
            key={step.id}
            to={step.done ? '#' : step.link}
            onClick={(e) => step.done && e.preventDefault()}
            className={clsx(
              'flex items-center gap-3 px-5 py-3 transition-colors',
              !step.done && 'hover:bg-slate-50',
              step.done && 'opacity-60 cursor-default'
            )}
          >
            <div
              className={clsx(
                "w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold border",
                step.done
                  ? "bg-emerald-500 border-emerald-500 text-white"
                  : "bg-slate-100 border-slate-300 text-slate-600"
              )}
            >
              {step.done ? '✓' : idx + 1}
            </div>
            <span className={clsx("text-xs flex-1", step.done ? "text-slate-500 line-through" : "text-slate-800 font-medium")}>
              {step.label}
            </span>
            {!step.done && (
              <span className="text-xs text-[#534AB7] font-semibold">
                Configure →
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. KPI Metric Card (Modern Shadcn Style)
// ══════════════════════════════════════════════════════════════════════════════
function MetricCard({ label, value, sub, icon, accentColor, delta }) {
  return (
    <div className="p-5 flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white shadow-xs hover:border-slate-300 transition-all">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {label}
          </p>
          <p
            className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1.5 truncate text-slate-900"
            style={{ color: accentColor }}
          >
            {value ?? '—'}
          </p>
          {sub && (
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">{sub}</p>
          )}
        </div>
        <div className="w-9 h-9 rounded-lg bg-slate-100/80 border border-slate-200/50 flex items-center justify-center shrink-0 ml-3 text-slate-600">
          {icon}
        </div>
      </div>

      {/* Delta badge */}
      {delta !== undefined && (
        <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-slate-100 text-[11px]">
          <span
            className={clsx(
              'font-bold px-1.5 py-0.5 rounded text-[10px] border',
              delta > 0
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                : delta < 0
                  ? 'bg-rose-50 text-rose-700 border-rose-200/60'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
            )}
          >
            {deltaLabel(delta)}
          </span>
          <span className="text-slate-400">vs prev period</span>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. Date Range Segmented Pill Selector (Shadcn Tabs Style)
// ══════════════════════════════════════════════════════════════════════════════
function DateRangePills({ value, onChange }) {
  return (
    <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200/60 shadow-2xs">
      {[7, 30, 90].map((d) => (
        <button
          key={d}
          onClick={() => onChange(d)}
          className={clsx(
            "px-3 py-1 rounded-md text-xs transition-all",
            value === d
              ? "bg-white text-slate-900 font-bold shadow-xs border border-slate-200/60"
              : "text-slate-500 hover:text-slate-900 font-medium hover:bg-white/50"
          )}
        >
          {d}d
        </button>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Main DashboardPage
// ══════════════════════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin';

  // ── State ─────────────────────────────────────────────────────────────────
  const [dateRange, setDateRange] = useState(30);
  const [campaigns, setCampaigns] = useState([]);
  const [queueStats, setQueueStats] = useState(null);
  const [wabaHealth, setWabaHealth] = useState(null);
  const [syncingHealth, setSyncingHealth] = useState(false);
  const [analytics, setAnalytics] = useState(null);      // current period
  const [prevAnalytics, setPrevAnalytics] = useState(null);      // previous period
  const [contactCount, setContactCount] = useState(0);
  const [checklistDismissed, setChecklistDismissed] = useState(
    () => localStorage.getItem('vdaj_checklist_dismissed') === '1'
  );
  const [loading, setLoading] = useState(true);
  const [healthLoading, setHealthLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  // ── Initial data load ─────────────────────────────────────────────────────
  useEffect(() => {
    const loadCore = async () => {
      try {
        const promises = [campaignApi.list({ limit: 8 }, { silent: true })];
        if (isSuperAdmin) promises.push(queueApi.stats({ silent: true }));

        const results = await Promise.allSettled(promises);
        if (results[0]?.status === 'fulfilled') setCampaigns(results[0].value?.data || []);
        if (isSuperAdmin) {
          const qVal = results[1]?.status === 'fulfilled' ? results[1].value : null;
          const qData = qVal?.data?.messageQueue ? qVal.data : (qVal?.messageQueue ? qVal : (qVal?.data || null));
          setQueueStats(qData || {
            messageQueue: { waiting: 0, active: 0, completed: 0, failed: 0 },
            deadLetterQueue: { waiting: 0, completed: 0 },
          });
        }
      } finally {
        setLoading(false);
      }
    };

    const loadHealth = async () => {
      if (isSuperAdmin) { setHealthLoading(false); return; }
      try {
        const res = await tenantApi.wabaHealth({ silent: true });
        setWabaHealth(res?.data || null);
      } catch {
        setWabaHealth(null);
      } finally {
        setHealthLoading(false);
      }
    };

    loadCore();
    loadHealth();
  }, [isSuperAdmin]);

  const handleSyncHealth = useCallback(async () => {
    setSyncingHealth(true);
    try {
      const res = await tenantApi.wabaHealthSync();
      setWabaHealth(res?.data || null);
      showSuccess('WhatsApp health synchronized with Meta.');
    } catch (err) {
      showError(err?.response?.data?.message || 'Failed to sync with Meta');
    } finally {
      setSyncingHealth(false);
    }
  }, []);

  // ── Analytics: reload on dateRange change ─────────────────────────────────
  useEffect(() => {
    if (isSuperAdmin) { setAnalyticsLoading(false); return; }
    setAnalyticsLoading(true);

    const load = async () => {
      try {
        const [curr, prev] = await Promise.allSettled([
          analyticsApi.trend(dateRange, { silent: true }),
          analyticsApi.trend(dateRange * 2, { silent: true }),
        ]);

        if (curr.status === 'fulfilled') {
          const rows = curr.value?.data || [];
          setAnalytics(aggregateRows(rows.slice(-dateRange)));
        }
        if (prev.status === 'fulfilled') {
          const rows = prev.value?.data || [];
          setPrevAnalytics(aggregateRows(rows.slice(0, dateRange)));
        }
      } finally {
        setAnalyticsLoading(false);
      }
    };
    load();
  }, [dateRange, isSuperAdmin]);

  // ── Live queue refresh (super_admin) — silent ─────────────────────────────
  useEffect(() => {
    if (!isSuperAdmin) return;
    const timer = setInterval(() => {
      queueApi.stats({ silent: true }).then((r) => setQueueStats(r?.data || null)).catch(() => { });
    }, 15_000);
    return () => clearInterval(timer);
  }, [isSuperAdmin]);

  // ── Computed KPIs ─────────────────────────────────────────────────────────
  const totalSent = analytics?.msgs_sent ?? campaigns.reduce((a, c) => a + (c.sent_count || 0), 0);
  const totalDelivered = analytics?.msgs_delivered ?? campaigns.reduce((a, c) => a + (c.delivered_count || 0), 0);
  const totalRead = analytics?.msgs_read ?? campaigns.reduce((a, c) => a + (c.read_count || 0), 0);
  const totalDead = analytics?.msgs_failed ?? campaigns.reduce((a, c) => a + (c.dead_letter_count || 0), 0);
  const deliveredPct = pct(totalDelivered, totalSent);
  const readPct = pct(totalRead, totalSent);

  const calcDelta = (curr, prev) => {
    if (!prev || prev === 0) return null;
    return Math.round(((curr - prev) / prev) * 100);
  };
  const prevSent = prevAnalytics?.msgs_sent ?? null;
  const prevDelivered = prevAnalytics?.msgs_delivered ?? null;
  const prevRead = prevAnalytics?.msgs_read ?? null;
  const prevFailed = prevAnalytics?.msgs_failed ?? null;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  const handleDismissChecklist = () => {
    localStorage.setItem('vdaj_checklist_dismissed', '1');
    setChecklistDismissed(true);
  };

  return (
    <div className="w-full space-y-6 animate-fade-in max-w-7xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Good {greeting},{' '}
            <span>{user?.firstName || 'Admin'}</span> 👋
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time WhatsApp Cloud API delivery and performance metrics.
          </p>
        </div>

        {/* Top Right Quick Controls */}
        <div className="flex items-center gap-2.5">
          {!isSuperAdmin && (
            <DateRangePills value={dateRange} onChange={setDateRange} />
          )}

          <Link
            to="/campaigns"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#534AB7] hover:bg-[#433A9D] text-white shadow-xs transition-all active:scale-95"
          >
            <span>+</span>
            <span>New Campaign</span>
          </Link>
        </div>
      </div>

      {/* ── Onboarding Checklist ───────────────────────────────── */}
      {!isSuperAdmin && !checklistDismissed && (
        <OnboardingCard
          health={wabaHealth}
          campaigns={campaigns.filter((c) => c.status === 'completed' || c.status === 'running').length}
          contacts={contactCount}
          templates={[]}
          onDismiss={handleDismissChecklist}
        />
      )}

      {/* ── WABA Health Hero Card ───────────────────────────────────── */}
      {!isSuperAdmin && (
        <WABAHealthCard
          health={wabaHealth}
          loading={healthLoading}
          onSync={handleSyncHealth}
          syncing={syncingHealth}
        />
      )}

      {/* ── Performance Overview (KPI Stat Cards) ──────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Performance Overview
          </h2>
          <span className="text-xs text-slate-400 font-medium">
            Aggregated over past {dateRange} days
          </span>
        </div>

        {loading || analyticsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <MetricCard
              label="Total Sent"
              value={fmt(totalSent)}
              sub={`Last ${dateRange} days broadcast`}
              delta={calcDelta(totalSent, prevSent)}
              icon={
                <svg className="w-5 h-5 text-[#534AB7]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              }
            />

            <MetricCard
              label="Delivered Rate"
              value={`${deliveredPct}%`}
              sub={`${fmt(totalDelivered)} confirmed delivered`}
              delta={calcDelta(deliveredPct, pct(prevDelivered, prevSent))}
              accentColor="#059669"
              icon={
                <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />

            <MetricCard
              label="Read Rate"
              value={`${readPct}%`}
              sub={`${fmt(totalRead)} recipients opened`}
              delta={calcDelta(readPct, pct(prevRead, prevSent))}
              accentColor="#534AB7"
              icon={
                <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              }
            />

            <MetricCard
              label="Failed / Rate-Limited"
              value={fmt(totalDead)}
              sub={totalDead > 0 ? "Blocked by Meta quotas" : "Clean delivery stream"}
              delta={calcDelta(totalDead, prevFailed)}
              accentColor={totalDead > 0 ? '#DC2626' : undefined}
              icon={
                <svg className="w-5 h-5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              }
            />
          </div>
        )}
      </div>

      {/* ── Modern Grid: Recent Campaigns + Delivery Funnel ───── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Campaign Activity Stream (2 Columns) */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Recent Campaigns
              </h2>
              <p className="text-[11px] text-slate-500">Latest broadcast dispatches & delivery progress</p>
            </div>
            <Link
              to="/campaigns"
              className="text-xs font-semibold text-[#534AB7] hover:underline"
            >
              View all campaigns →
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : campaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <span className="text-3xl mb-2">📢</span>
              <p className="text-sm font-semibold text-slate-700">No campaigns dispatched yet.</p>
              <p className="text-xs text-slate-500 mt-0.5">Start sending messages to your verified audience.</p>
              <Link to="/campaigns" className="mt-3 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#534AB7] text-white shadow-xs">
                Create your first campaign →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.slice(0, 5).map((c) => {
                const sentPct = c.total_count ? Math.round((c.sent_count / c.total_count) * 100) : 0;
                const delPct = c.sent_count ? Math.round(((c.delivered_count || 0) / c.sent_count) * 100) : 0;
                return (
                  <div
                    key={c.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-slate-200/60 hover:border-slate-300 transition-all bg-slate-50/50 hover:bg-white"
                  >
                    <div className="flex-1 min-w-0">
                      {/* Name + status */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link to={`/campaigns`} className="text-xs font-bold text-slate-900 hover:text-[#534AB7] transition-colors truncate">
                          {c.name}
                        </Link>
                        <span className={clsx(
                          'inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0',
                          CAMPAIGN_STATUS_STYLE[c.status] || CAMPAIGN_STATUS_STYLE.draft
                        )}>
                          {c.status}
                        </span>
                        {c.template_name && (
                          <span className="text-[10px] text-slate-400 bg-white border border-slate-200 px-1.5 py-0.2 rounded font-mono">
                            {c.template_name}
                          </span>
                        )}
                      </div>

                      {/* Mini stats row */}
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap text-[11px]">
                        <span className="text-slate-500">
                          Sent: <strong className="text-slate-800">{fmt(c.sent_count)}</strong>
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-500">
                          Delivered: <strong className="text-emerald-700">{fmt(c.delivered_count)}</strong>
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-500">
                          Read: <strong className="text-[#534AB7]">{fmt(c.read_count)}</strong>
                        </span>
                        {delPct > 0 && (
                          <span className="font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded text-[10px] border border-emerald-100">
                            {delPct}% delivered
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress funnel */}
                    <div className="w-full sm:w-36 shrink-0">
                      <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                        <span>Progress</span>
                        <span className="font-bold text-slate-700">{sentPct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#534AB7] transition-all duration-500"
                          style={{ width: `${sentPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Delivery Pipeline Funnel & Quick Links (1 Column) */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <div className="mb-4 pb-3 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">
                Delivery Funnel
              </h2>
              <p className="text-[11px] text-slate-500">End-to-end delivery conversion pipeline</p>
            </div>

            <div className="space-y-3.5">
              {/* Sent */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-700 text-xs">Messages Sent</span>
                  <span className="font-bold text-slate-900 text-xs">{fmt(totalSent)} (100%)</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-[#534AB7] w-full" />
                </div>
              </div>

              {/* Delivered */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-emerald-700 text-xs">Delivered to Devices</span>
                  <span className="font-bold text-slate-900 text-xs">{deliveredPct}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                    style={{ width: `${Math.min(100, deliveredPct)}%` }}
                  />
                </div>
              </div>

              {/* Read */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-indigo-700 text-xs">Read by Recipients</span>
                  <span className="font-bold text-slate-900 text-xs">{readPct}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all duration-700"
                    style={{ width: `${Math.min(100, readPct)}%` }}
                  />
                </div>
              </div>

              {/* Failed */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-rose-700 text-xs">Delivery Failures</span>
                  <span className="font-bold text-slate-900 text-xs">{fmt(totalDead)}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-rose-500 transition-all duration-700"
                    style={{ width: `${totalSent ? Math.min(100, Math.round((totalDead / totalSent) * 100)) : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
              Quick Shortcuts
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <Link
                to="/campaigns"
                className="p-3 rounded-lg border border-slate-200/70 hover:border-[#534AB7]/40 bg-slate-50/50 hover:bg-white text-xs font-semibold text-slate-700 flex flex-col gap-1 transition-all"
              >
                <span className="text-base">📢</span>
                <span>Campaigns</span>
              </Link>
              <Link
                to="/templates"
                className="p-3 rounded-lg border border-slate-200/70 hover:border-[#534AB7]/40 bg-slate-50/50 hover:bg-white text-xs font-semibold text-slate-700 flex flex-col gap-1 transition-all"
              >
                <span className="text-base">📑</span>
                <span>Templates</span>
              </Link>
              <Link
                to="/automation"
                className="p-3 rounded-lg border border-slate-200/70 hover:border-[#534AB7]/40 bg-slate-50/50 hover:bg-white text-xs font-semibold text-slate-700 flex flex-col gap-1 transition-all"
              >
                <span className="text-base">⚡</span>
                <span>Flows Builder</span>
              </Link>
              <Link
                to="/inbox"
                className="p-3 rounded-lg border border-slate-200/70 hover:border-[#534AB7]/40 bg-slate-50/50 hover:bg-white text-xs font-semibold text-slate-700 flex flex-col gap-1 transition-all"
              >
                <span className="text-base">💬</span>
                <span>Live Inbox</span>
              </Link>
            </div>
          </div>

          {/* Queue health — super_admin only */}
          {isSuperAdmin && queueStats && (
            <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Redis Queue Health
                </h2>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="space-y-2">
                {[
                  { label: 'Waiting', value: queueStats.messageQueue?.waiting, color: '#534AB7' },
                  { label: 'Active', value: queueStats.messageQueue?.active, color: '#059669' },
                  { label: 'Completed', value: queueStats.messageQueue?.completed, color: '#475569' },
                  { label: 'Failed', value: queueStats.messageQueue?.failed, color: '#E11D48' },
                  { label: 'Dead Letter', value: queueStats.deadLetterQueue?.waiting, color: '#D97706' },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50 text-xs">
                    <span className="text-slate-500 font-medium">{row.label}</span>
                    <span className="font-bold tabular-nums" style={{ color: row.color }}>
                      {row.value ?? 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ── Utility: aggregate an array of analytics_snapshots rows ───────────────────
function aggregateRows(rows) {
  if (!rows?.length) return null;
  return rows.reduce(
    (acc, r) => ({
      msgs_sent: acc.msgs_sent + (parseInt(r.msgs_sent, 10) || 0),
      msgs_delivered: acc.msgs_delivered + (parseInt(r.msgs_delivered, 10) || 0),
      msgs_read: acc.msgs_read + (parseInt(r.msgs_read, 10) || 0),
      msgs_failed: acc.msgs_failed + (parseInt(r.msgs_failed, 10) || 0),
    }),
    { msgs_sent: 0, msgs_delivered: 0, msgs_read: 0, msgs_failed: 0 }
  );
}
