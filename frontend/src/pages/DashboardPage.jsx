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

// ─── Campaign status badge styles ─────────────────────────────────────────────
const CAMPAIGN_STATUS_STYLE = {
  draft:     'bg-slate-100 text-slate-500 border-slate-200',
  scheduled: 'bg-[#EEF0FF] text-[#534AB7] border-[#C9C5F5]',
  running:   'bg-[#EEF0FF] text-[#534AB7] border-[#C9C5F5]',
  paused:    'bg-amber-50 text-amber-600 border-amber-200',
  completed: 'bg-[#E8F9F4] text-[#1D9E75] border-[#A3E4D0]',
  failed:    'bg-red-50 text-red-600 border-red-200',
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ className }) {
  return (
    <div
      className={clsx('animate-pulse rounded-xl', className)}
      style={{ background: '#F3F2FD' }}
    />
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. WABA Health Card
// ══════════════════════════════════════════════════════════════════════════════
const RATING_COLOR  = { GREEN: '#1D9E75', YELLOW: '#f59e0b', RED:    '#ef4444' };
const RATING_BG     = { GREEN: '#E8F9F4', YELLOW: '#FFF8EB', RED:    '#FEF2F2' };
const RATING_EMOJI  = { GREEN: '🟢',      YELLOW: '🟡',      RED:    '🔴'     };
const TIER_LABEL    = { 1: '1,000',       2: '10,000',       3: '100,000', 4: 'Unlimited' };

function WABAHealthCard({ health, loading }) {
  if (loading) {
    return (
      <div
        className="rounded-2xl p-5 border"
        style={{ background: '#fff', borderColor: '#E6E4F5' }}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14" />)}
        </div>
      </div>
    );
  }

  // When WABA not yet connected show a friendly prompt instead
  if (!health?.waba_connected) {
    return (
      <div
        className="rounded-2xl p-5 border flex items-center justify-between gap-4"
        style={{ background: '#FAFAFE', borderColor: '#E6E4F5' }}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">📱</span>
          <div>
            <p className="text-sm font-bold" style={{ color: '#0F0F0F' }}>
              WhatsApp not connected
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#5A5A6E' }}>
              Connect your WABA to see quality rating, messaging tier and daily limits.
            </p>
          </div>
        </div>
        <Link
          to="/whatsapp-setup"
          className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-opacity hover:opacity-80"
          style={{ background: '#534AB7', color: '#fff' }}
        >
          Connect →
        </Link>
      </div>
    );
  }

  const rating    = health.quality_rating || 'GREEN';
  const tier      = health.messaging_tier || 1;
  const usedPct   = health.usage_pct ?? 0;
  const barColor  = usedPct > 80 ? '#ef4444' : usedPct > 60 ? '#f59e0b' : '#1D9E75';
  const syncedAgo = health.waba_health_synced_at
    ? (() => {
        const diffH = Math.round((Date.now() - new Date(health.waba_health_synced_at)) / 3_600_000);
        return diffH < 1 ? 'just now' : `${diffH}h ago`;
      })()
    : 'Never synced';

  return (
    <div
      className="rounded-2xl p-5 border"
      style={{ background: '#fff', borderColor: '#E6E4F5' }}
    >
      {/* Card header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold" style={{ color: '#0F0F0F' }}>
          WhatsApp Account Health
        </h2>
        <span className="text-xs" style={{ color: '#94a3b8' }}>
          Synced {syncedAgo}
        </span>
      </div>

      {/* 4-column grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Quality Rating */}
        <div
          className="rounded-xl px-3 py-2.5"
          style={{ background: RATING_BG[rating] }}
        >
          <p className="text-2xs font-semibold uppercase tracking-wider mb-1"
            style={{ color: '#5A5A6E' }}>
            Quality Rating
          </p>
          <p className="text-base font-black" style={{ color: RATING_COLOR[rating] }}>
            {RATING_EMOJI[rating]} {rating}
          </p>
          <p className="text-2xs mt-0.5" style={{ color: '#5A5A6E' }}>
            {rating === 'GREEN' ? 'Healthy' : rating === 'YELLOW' ? 'At risk' : '⚠ Action needed'}
          </p>
        </div>

        {/* Messaging Tier */}
        <div className="rounded-xl px-3 py-2.5" style={{ background: '#F3F2FD' }}>
          <p className="text-2xs font-semibold uppercase tracking-wider mb-1"
            style={{ color: '#5A5A6E' }}>
            Messaging Tier
          </p>
          <p className="text-base font-black" style={{ color: '#534AB7' }}>
            Tier {tier}
          </p>
          <p className="text-2xs mt-0.5" style={{ color: '#5A5A6E' }}>
            {TIER_LABEL[tier]} msgs/day
          </p>
        </div>

        {/* Sent Today */}
        <div className="rounded-xl px-3 py-2.5" style={{ background: '#F8F7FF' }}>
          <p className="text-2xs font-semibold uppercase tracking-wider mb-1"
            style={{ color: '#5A5A6E' }}>
            Sent Today
          </p>
          <p className="text-base font-black" style={{ color: '#0F0F0F' }}>
            {fmt(health.msgs_sent_today)}
          </p>
          <p className="text-2xs mt-0.5" style={{ color: '#5A5A6E' }}>
            of {fmt(health.daily_limit)}
          </p>
        </div>

        {/* Phone / Name */}
        <div className="rounded-xl px-3 py-2.5" style={{ background: '#F8F7FF' }}>
          <p className="text-2xs font-semibold uppercase tracking-wider mb-1"
            style={{ color: '#5A5A6E' }}>
            Business Number
          </p>
          <p className="text-sm font-black truncate" style={{ color: '#0F0F0F' }}>
            {health.display_phone_number || '—'}
          </p>
          <p className="text-2xs mt-0.5 truncate" style={{ color: '#5A5A6E' }}>
            {health.verified_name || 'Name not verified'}
          </p>
        </div>
      </div>

      {/* Usage progress bar */}
      <div className="mt-4">
        <div className="flex justify-between text-2xs mb-1" style={{ color: '#94a3b8' }}>
          <span>Daily usage</span>
          <span style={{ color: barColor, fontWeight: 700 }}>{usedPct}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: '#E6E4F5' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${usedPct}%`, background: barColor }}
          />
        </div>
        {usedPct >= 80 && (
          <p className="text-2xs mt-1.5 font-semibold" style={{ color: barColor }}>
            ⚠ Approaching daily limit — paused campaigns will be queued for tomorrow.
          </p>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. Onboarding Checklist Card
// ══════════════════════════════════════════════════════════════════════════════
function OnboardingCard({ health, campaigns, contacts, templates, onDismiss }) {
  const approvedTemplates = templates?.filter((t) => t.status === 'approved').length ?? 0;
  const contactCount      = contacts ?? 0;
  const campaignCount     = campaigns ?? 0;

  const steps = [
    {
      id: 'waba',
      label: 'Connect your WhatsApp Business Account',
      done:  !!health?.waba_connected,
      link:  '/whatsapp-setup',
    },
    {
      id: 'template',
      label: 'Create & get a message template approved',
      done:  approvedTemplates > 0,
      link:  '/templates',
    },
    {
      id: 'contacts',
      label: 'Import contacts with opt-in consent',
      done:  contactCount > 0,
      link:  '/contacts',
    },
    {
      id: 'campaign',
      label: 'Send your first campaign',
      done:  campaignCount > 0,
      link:  '/campaigns',
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const allDone   = doneCount === steps.length;

  // Hide if all steps complete or explicitly dismissed
  if (allDone) return null;

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ background: '#fff', borderColor: '#E6E4F5' }}
    >
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ background: 'linear-gradient(90deg, #534AB7 0%, #7B74D0 100%)' }}
      >
        <div>
          <p className="text-xs font-bold text-white">
            🚀 Getting Started — {doneCount}/{steps.length} complete
          </p>
          <p className="text-2xs text-white/60 mt-0.5">
            Complete these steps to start sending campaigns
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          aria-label="Dismiss checklist"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Steps */}
      <div className="divide-y" style={{ borderColor: '#F3F2FD' }}>
        {steps.map((step, idx) => (
          <Link
            key={step.id}
            to={step.done ? '#' : step.link}
            onClick={(e) => step.done && e.preventDefault()}
            className={clsx(
              'flex items-center gap-3 px-5 py-3 transition-colors',
              !step.done && 'hover:bg-[#FAFAFE]',
              step.done && 'opacity-60 cursor-default'
            )}
          >
            {/* Step number / check */}
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-2xs font-black"
              style={{
                background: step.done ? '#1D9E75' : '#F3F2FD',
                color:      step.done ? '#fff'    : '#534AB7',
              }}
            >
              {step.done ? (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : idx + 1}
            </div>
            <span className="text-xs font-medium flex-1" style={{ color: step.done ? '#5A5A6E' : '#0F0F0F' }}>
              {step.label}
            </span>
            {!step.done && (
              <svg className="w-4 h-4 shrink-0" style={{ color: '#534AB7' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. KPI Metric Card (with delta %)
// ══════════════════════════════════════════════════════════════════════════════
function MetricCard({ label, value, sub, icon, accentColor, delta }) {
  return (
    <div
      className="p-5 flex flex-col gap-3 rounded-2xl border"
      style={{ background: '#FFFFFF', borderColor: '#E6E4F5' }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-2xs font-semibold uppercase tracking-wider text-[#5A5A6E]">
            {label}
          </p>
          <p
            className="text-3xl font-black mt-1 truncate"
            style={{ color: accentColor || '#0F0F0F' }}
          >
            {value ?? '—'}
          </p>
          {sub && (
            <p className="text-2xs text-[#5A5A6E] mt-0.5">{sub}</p>
          )}
        </div>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ml-3"
          style={{ background: '#F3F2FD' }}
        >
          {icon}
        </div>
      </div>

      {/* Delta badge */}
      {delta !== undefined && (
        <div className="flex items-center gap-1.5">
          <span
            className={clsx('text-2xs font-bold px-2 py-0.5 rounded-full', deltaClass(delta))}
            style={{
              background: delta > 0 ? '#E8F9F4' : delta < 0 ? '#FEF2F2' : '#F3F2FD',
            }}
          >
            {deltaLabel(delta)}
          </span>
          <span className="text-2xs text-[#94a3b8]">vs prev period</span>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. Date Range Pill Selector
// ══════════════════════════════════════════════════════════════════════════════
function DateRangePills({ value, onChange }) {
  return (
    <div className="flex items-center gap-1.5 p-1 rounded-xl" style={{ background: '#F3F2FD' }}>
      {[7, 30, 90].map((d) => (
        <button
          key={d}
          onClick={() => onChange(d)}
          className="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all"
          style={
            value === d
              ? { background: '#534AB7', color: '#fff', boxShadow: '0 1px 4px rgba(83,74,183,0.4)' }
              : { background: 'transparent', color: '#534AB7' }
          }
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
  const [dateRange,       setDateRange]       = useState(30);
  const [campaigns,       setCampaigns]       = useState([]);
  const [queueStats,      setQueueStats]      = useState(null);
  const [wabaHealth,      setWabaHealth]      = useState(null);
  const [analytics,       setAnalytics]       = useState(null);      // current period
  const [prevAnalytics,   setPrevAnalytics]   = useState(null);      // previous period
  const [contactCount,    setContactCount]    = useState(0);
  const [checklistDismissed, setChecklistDismissed] = useState(
    () => localStorage.getItem('vdaj_checklist_dismissed') === '1'
  );
  const [loading,         setLoading]         = useState(true);
  const [healthLoading,   setHealthLoading]   = useState(true);
  const [analyticsLoading,setAnalyticsLoading]= useState(true);

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
      // super_admin has no WABA — skip silently
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

  // ── Analytics: reload on dateRange change ─────────────────────────────────
  useEffect(() => {
    if (isSuperAdmin) { setAnalyticsLoading(false); return; }
    setAnalyticsLoading(true);

    const load = async () => {
      try {
        // Fetch current and previous period in parallel — silent to avoid toast on load
        const [curr, prev] = await Promise.allSettled([
          analyticsApi.trend(dateRange, { silent: true }),
          analyticsApi.trend(dateRange * 2, { silent: true }), // double window covers both periods
        ]);

        if (curr.status === 'fulfilled') {
          const rows = curr.value?.data || [];
          // Aggregate the current period
          setAnalytics(aggregateRows(rows.slice(-dateRange)));
        }
        if (prev.status === 'fulfilled') {
          const rows = prev.value?.data || [];
          // The previous period is the earlier half
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
      queueApi.stats({ silent: true }).then((r) => setQueueStats(r?.data || null)).catch(() => {});
    }, 15_000);
    return () => clearInterval(timer);
  }, [isSuperAdmin]);

  // ── Computed KPIs ─────────────────────────────────────────────────────────
  // Fall back to campaign-level aggregation when analytics API is loading/empty
  const totalSent      = analytics?.msgs_sent      ?? campaigns.reduce((a, c) => a + (c.sent_count      || 0), 0);
  const totalDelivered = analytics?.msgs_delivered ?? campaigns.reduce((a, c) => a + (c.delivered_count || 0), 0);
  const totalRead      = analytics?.msgs_read      ?? campaigns.reduce((a, c) => a + (c.read_count      || 0), 0);
  const totalDead      = analytics?.msgs_failed    ?? campaigns.reduce((a, c) => a + (c.dead_letter_count || 0), 0);
  const deliveredPct   = pct(totalDelivered, totalSent);
  const readPct        = pct(totalRead, totalSent);

  // Delta %: compare current vs previous period
  const calcDelta = (curr, prev) => {
    if (!prev || prev === 0) return null;
    return Math.round(((curr - prev) / prev) * 100);
  };
  const prevSent      = prevAnalytics?.msgs_sent      ?? null;
  const prevDelivered = prevAnalytics?.msgs_delivered ?? null;
  const prevRead      = prevAnalytics?.msgs_read      ?? null;
  const prevFailed    = prevAnalytics?.msgs_failed    ?? null;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  const handleDismissChecklist = () => {
    localStorage.setItem('vdaj_checklist_dismissed', '1');
    setChecklistDismissed(true);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-[#0F0F0F] dark:text-[#F8F7FF]">
          Good {greeting},{' '}
          <span className="text-gradient">{user?.firstName}</span> 👋
        </h1>
        <p className="text-sm text-[#5A5A6E] dark:text-slate-400 mt-1">
          Here's your platform overview for today.
        </p>
      </div>

      {/* ── Onboarding Checklist ───────────────────────────────── */}
      {!isSuperAdmin && !checklistDismissed && (
        <OnboardingCard
          health={wabaHealth}
          campaigns={campaigns.filter((c) => c.status === 'completed' || c.status === 'running').length}
          contacts={contactCount}
          templates={[]}   /* will be non-zero once templates are loaded */
          onDismiss={handleDismissChecklist}
        />
      )}

      {/* ── WABA Health Card ───────────────────────────────────── */}
      {!isSuperAdmin && (
        <WABAHealthCard health={wabaHealth} loading={healthLoading} />
      )}

      {/* ── Date Range Pills + KPI Tiles ──────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-[#5A5A6E] uppercase tracking-wider">
            Performance Overview
          </h2>
          {!isSuperAdmin && (
            <DateRangePills value={dateRange} onChange={setDateRange} />
          )}
        </div>

        {loading || analyticsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-36" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <MetricCard
              label="Total Sent"
              value={fmt(totalSent)}
              sub={`Last ${dateRange} days`}
              delta={calcDelta(totalSent, prevSent)}
              icon={
                <svg className="w-5 h-5" style={{ color: '#534AB7' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              }
            />

            <MetricCard
              label="Delivered"
              value={`${deliveredPct}%`}
              sub={`${fmt(totalDelivered)} messages`}
              delta={calcDelta(deliveredPct, pct(prevDelivered, prevSent))}
              accentColor="#1D9E75"
              icon={
                <svg className="w-5 h-5" style={{ color: '#1D9E75' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />

            <MetricCard
              label="Read Rate"
              value={`${readPct}%`}
              sub={`${fmt(totalRead)} opened`}
              delta={calcDelta(readPct, pct(prevRead, prevSent))}
              accentColor="#534AB7"
              icon={
                <svg className="w-5 h-5" style={{ color: '#AFA9EC' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              }
            />

            <MetricCard
              label="Failed / DLQ"
              value={fmt(totalDead)}
              sub="Needs attention"
              delta={calcDelta(totalDead, prevFailed)}
              accentColor={totalDead > 0 ? '#ef4444' : undefined}
              icon={
                <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              }
            />
          </div>
        )}
      </div>

      {/* ── Queue Health + Campaign Stream ────────────────────── */}
      <div className={isSuperAdmin ? 'grid grid-cols-1 xl:grid-cols-3 gap-6' : 'grid grid-cols-1 gap-6'}>

        {/* Queue health — super_admin only */}
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
                className="w-10 h-10 mb-3" style={{ color: '#D0CEEC' }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
              <p className="text-sm text-[#5A5A6E] dark:text-slate-400">No campaigns yet.</p>
              <Link to="/campaigns" className="mt-3 text-xs font-medium text-[#534AB7] hover:underline">
                Create your first →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map((c) => {
                const sentPct = c.total_count ? Math.round((c.sent_count / c.total_count) * 100) : 0;
                const delPct  = c.sent_count  ? Math.round(((c.delivered_count || 0) / c.sent_count) * 100) : 0;
                return (
                  <div
                    key={c.id}
                    className="flex items-center gap-4 px-4 py-3 rounded-xl border transition-colors hover:border-[#534AB7]/30"
                    style={{ background: '#F8F7FF', borderColor: '#E6E4F5' }}
                  >
                    <div className="flex-1 min-w-0">
                      {/* Name + status */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-[#0F0F0F] truncate">{c.name}</p>
                        <span className={clsx(
                          'inline-flex px-2 py-0.5 rounded-full text-2xs font-bold border shrink-0',
                          CAMPAIGN_STATUS_STYLE[c.status]
                        )}>
                          {c.status}
                        </span>
                      </div>
                      {/* Mini stats row */}
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {[
                          { label: 'Sent',      val: c.sent_count,      color: '#534AB7' },
                          { label: 'Delivered', val: c.delivered_count, color: '#1D9E75' },
                          { label: 'Read',      val: c.read_count,      color: '#AFA9EC' },
                        ].map((s) => (
                          <div key={s.label} className="flex items-center gap-1">
                            <span className="text-2xs" style={{ color: '#94a3b8' }}>{s.label}</span>
                            <span className="text-2xs font-bold tabular-nums" style={{ color: s.color }}>
                              {fmt(s.val)}
                            </span>
                          </div>
                        ))}
                        {delPct > 0 && (
                          <span className="text-2xs font-bold" style={{ color: '#1D9E75' }}>
                            · {delPct}% delivered
                          </span>
                        )}
                      </div>
                      {/* Progress bar */}
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: '#E6E4F5' }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${sentPct}%`, background: 'linear-gradient(90deg,#534AB7,#AFA9EC)' }}
                          />
                        </div>
                        <span className="text-2xs tabular-nums shrink-0" style={{ color: '#94a3b8' }}>
                          {sentPct}%
                        </span>
                      </div>
                    </div>
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

// ── Utility: aggregate an array of analytics_snapshots rows ───────────────────
function aggregateRows(rows) {
  if (!rows?.length) return null;
  return rows.reduce(
    (acc, r) => ({
      msgs_sent:      acc.msgs_sent      + (parseInt(r.msgs_sent,      10) || 0),
      msgs_delivered: acc.msgs_delivered + (parseInt(r.msgs_delivered, 10) || 0),
      msgs_read:      acc.msgs_read      + (parseInt(r.msgs_read,      10) || 0),
      msgs_failed:    acc.msgs_failed    + (parseInt(r.msgs_failed,    10) || 0),
    }),
    { msgs_sent: 0, msgs_delivered: 0, msgs_read: 0, msgs_failed: 0 }
  );
}
