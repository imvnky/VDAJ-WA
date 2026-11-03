/**
 * VDAJ Services — Official Brand Dashboard Page
 * High-end enterprise UI with original VDAJ branding, cohesive telemetry, and crisp typography.
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { campaignApi, queueApi, analyticsApi, tenantApi } from '../lib/api';
import useAuthStore from '../store/authStore';

// ─── Number & Ratio Formatters ────────────────────────────────────────────────
const fmt = (n) => (n ?? 0).toLocaleString();

function pct(num, den) {
  if (!den || den === 0) return 0;
  return Math.round((num / den) * 100);
}

function deltaClass(d) {
  if (d === null || d === undefined) return 'text-slate-400';
  if (d > 0) return 'text-emerald-600';
  if (d < 0) return 'text-rose-500';
  return 'text-slate-400';
}

function deltaLabel(d) {
  if (d === null || d === undefined) return '0%';
  const sign = d > 0 ? '+' : '';
  return `${sign}${d}%`;
}

// ─── Campaign Status Styles ───────────────────────────────────────────────────
const CAMPAIGN_STATUS_STYLE = {
  draft:     'bg-slate-100 text-slate-600 border-slate-200',
  scheduled: 'bg-[#F3F2FD] text-[#5B4B8A] border-[#D9D5F0]',
  running:   'bg-[#F3F2FD] text-[#5B4B8A] border-[#D9D5F0]',
  paused:    'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  failed:    'bg-rose-50 text-rose-700 border-rose-200',
};

// ─── Skeleton Loader ──────────────────────────────────────────────────────────
function Skeleton({ className }) {
  return (
    <div
      className={clsx('animate-pulse rounded-2xl', className)}
      style={{ background: '#F1F0F8' }}
    />
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. WhatsApp Account Health Console (Unified & Cohesive)
// ══════════════════════════════════════════════════════════════════════════════
const TIER_LABEL = { 1: '1,000', 2: '10,000', 3: '100,000', 4: 'Unlimited' };

function WABAHealthConsole({ health, loading }) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs mb-8">
        <Skeleton className="w-48 h-6 mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  // When WABA not connected
  if (!health?.waba_connected) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#F3F2FD] text-[#5B4B8A] flex items-center justify-center text-2xl shrink-0">
            📱
          </div>
          <div>
            <h4 className="text-base font-bold text-slate-900">WhatsApp Not Connected</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Connect your WhatsApp Business Account (WABA) to monitor real-time quality rating, messaging tiers, and daily limits.
            </p>
          </div>
        </div>
        <Link
          to="/whatsapp-setup"
          className="shrink-0 bg-[#5B4B8A] hover:bg-[#4B3D73] text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-xs hover:shadow-sm transition-all"
        >
          Connect WABA →
        </Link>
      </div>
    );
  }

  const rawRating = (health.quality_rating || 'GREEN').toUpperCase();
  const tier      = health.messaging_tier || 1;
  const usedPct   = health.usage_pct ?? 0;
  const barColor  = usedPct > 80 ? '#ef4444' : usedPct > 60 ? '#f59e0b' : '#10B981';
  const syncedAgo = health.waba_health_synced_at
    ? (() => {
        const diffH = Math.round((Date.now() - new Date(health.waba_health_synced_at)) / 3_600_000);
        return diffH < 1 ? 'just now' : `${diffH}h ago`;
      })()
    : 'Recently';

  let ratingBadge = {
    text: 'Healthy & Compliant',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50 border-emerald-200/80',
    dot: 'bg-emerald-500',
  };

  if (rawRating === 'YELLOW') {
    ratingBadge = { text: 'At Risk', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500' };
  } else if (rawRating === 'RED') {
    ratingBadge = { text: 'Action Required', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200', dot: 'bg-rose-500' };
  } else if (rawRating === 'UNKNOWN') {
    ratingBadge = { text: 'Pending Verification', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500' };
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden mb-8">
      {/* Top Console Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 bg-slate-50/70 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">WhatsApp Account Health</h3>
          <span className="hidden sm:inline-block text-slate-300">•</span>
          <span className="text-xs text-slate-500 font-medium">Meta Cloud API Connected</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs">
          {health.display_phone_number && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-semibold text-slate-700">
              <span className="text-emerald-600">📱</span>
              <span>{health.display_phone_number}</span>
              {health.verified_name && (
                <span className="text-slate-400 font-normal">({health.verified_name})</span>
              )}
            </div>
          )}
          <span className="text-[11px] text-slate-400 font-medium bg-white px-2 py-1 rounded-lg border border-slate-200">
            Synced {syncedAgo}
          </span>
        </div>
      </div>

      {/* 4 Telemetry Metrics */}
      <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Metric 1: Quality Rating */}
        <div className="bg-[#FAF9FE] rounded-xl p-4 border border-[#EBE8F6] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Quality Rating</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {rawRating}
            </div>
          </div>
          <div className="mt-3">
            <span className={clsx("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border", ratingBadge.bg, ratingBadge.color)}>
              <span className={clsx("w-1.5 h-1.5 rounded-full", ratingBadge.dot)} />
              {ratingBadge.text}
            </span>
          </div>
        </div>

        {/* Metric 2: Messaging Tier */}
        <div className="bg-[#FAF9FE] rounded-xl p-4 border border-[#EBE8F6] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Messaging Tier</span>
              <span className="text-xs">⚡</span>
            </div>
            <div className="text-2xl font-black text-[#5B4B8A] tracking-tight">
              Tier {tier}
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-500 font-medium">
            <span className="font-bold text-slate-700">{TIER_LABEL[tier] || '1,000'}</span> msgs / 24-hr rolling
          </div>
        </div>

        {/* Metric 3: Sent Today */}
        <div className="bg-[#FAF9FE] rounded-xl p-4 border border-[#EBE8F6] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sent Today</span>
              <span className="text-xs">📤</span>
            </div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {fmt(health.msgs_sent_today)}
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-500 font-medium">
            of <span className="font-bold text-slate-700">{fmt(health.daily_limit || 1000)}</span> total limit
          </div>
        </div>

        {/* Metric 4: Daily Quota Usage */}
        <div className="bg-[#FAF9FE] rounded-xl p-4 border border-[#EBE8F6] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Quota Usage</span>
              <span className="text-xs font-bold" style={{ color: barColor }}>{usedPct}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden bg-slate-200/80 my-2">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.min(usedPct, 100)}%`, background: barColor }}
              />
            </div>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 font-medium flex items-center justify-between">
            <span>Resets at 00:00 UTC</span>
            {usedPct >= 80 && (
              <span className="text-rose-500 font-bold">Limit Near</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. Getting Started (Onboarding Progress Card)
// ══════════════════════════════════════════════════════════════════════════════
function OnboardingCard({ health, campaigns, contacts, templates, onDismiss }) {
  const approvedTemplates = templates?.filter((t) => t.status === 'approved').length ?? 0;
  const contactCount      = contacts ?? 0;
  const campaignCount     = campaigns ?? 0;

  const steps = [
    { id: 'waba',      label: 'Connect WhatsApp', done: !!health?.waba_connected, link: '/whatsapp-setup' },
    { id: 'template',  label: 'Template Approval', done: approvedTemplates > 0, link: '/templates' },
    { id: 'contacts',  label: 'Import Contacts', done: contactCount > 0, link: '/contacts' },
    { id: 'campaign',  label: 'First Campaign', done: campaignCount > 0, link: '/campaigns' },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  return (
    <div className="mb-8 bg-gradient-to-br from-[#5B4B8A] via-[#52427D] to-[#3E3160] rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
      <div className="flex items-center justify-between mb-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center text-lg">
            🚀
          </div>
          <div>
            <h2 className="text-base font-bold">Getting Started — {doneCount}/{steps.length} complete</h2>
            <p className="text-xs text-white/70">Complete your setup to maximize your messaging reach</p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="p-1.5 hover:bg-white/20 rounded-lg text-white/70 hover:text-white transition-colors"
          title="Dismiss checklist"
          aria-label="Dismiss checklist"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 relative z-10">
        {steps.map((step, idx) => (
          <Link
            key={step.id}
            to={step.done ? '#' : step.link}
            onClick={(e) => step.done && e.preventDefault()}
            className={clsx(
              "rounded-xl p-3.5 flex items-center space-x-3 transition-all",
              step.done
                ? "bg-white/10 border border-white/20"
                : idx === doneCount
                  ? "bg-white/20 border border-white/30 shadow-xs"
                  : "bg-white/5 border border-white/10 opacity-70 hover:opacity-100"
            )}
          >
            <div
              className={clsx(
                "w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold",
                step.done
                  ? "bg-emerald-500 text-white"
                  : idx === doneCount
                    ? "bg-white text-[#5B4B8A]"
                    : "bg-white/20 text-white"
              )}
            >
              {step.done ? '✓' : idx + 1}
            </div>
            <span className="text-xs font-semibold leading-tight">{step.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. Performance Overview Date Range Pills
// ══════════════════════════════════════════════════════════════════════════════
function DateRangePills({ value, onChange }) {
  return (
    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
      {[7, 30, 90].map((d) => (
        <button
          key={d}
          onClick={() => onChange(d)}
          className={clsx(
            "px-3.5 py-1 text-xs font-bold rounded-lg transition-all",
            value === d
              ? "text-slate-900 bg-white shadow-2xs"
              : "text-slate-500 hover:text-slate-900"
          )}
        >
          {d}d
        </button>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. Main Dashboard Page Component
// ══════════════════════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const { user, tenant } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin';

  // ── State ─────────────────────────────────────────────────────────────────
  const [dateRange,       setDateRange]       = useState(30);
  const [campaigns,       setCampaigns]       = useState([]);
  const [queueStats,      setQueueStats]      = useState(null);
  const [wabaHealth,      setWabaHealth]      = useState(null);
  const [analytics,       setAnalytics]       = useState(null);
  const [prevAnalytics,   setPrevAnalytics]   = useState(null);
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

  // ── Live queue refresh (super_admin) ──────────────────────────────────────
  useEffect(() => {
    if (!isSuperAdmin) return;
    const timer = setInterval(() => {
      queueApi.stats({ silent: true }).then((r) => setQueueStats(r?.data || null)).catch(() => {});
    }, 15_000);
    return () => clearInterval(timer);
  }, [isSuperAdmin]);

  // ── Computed KPIs ─────────────────────────────────────────────────────────
  const totalSent      = analytics?.msgs_sent      ?? campaigns.reduce((a, c) => a + (c.sent_count      || 0), 0);
  const totalDelivered = analytics?.msgs_delivered ?? campaigns.reduce((a, c) => a + (c.delivered_count || 0), 0);
  const totalRead      = analytics?.msgs_read      ?? campaigns.reduce((a, c) => a + (c.read_count      || 0), 0);
  const totalDead      = analytics?.msgs_failed    ?? campaigns.reduce((a, c) => a + (c.dead_letter_count || 0), 0);
  const deliveredPct   = pct(totalDelivered, totalSent);
  const readPct        = pct(totalRead, totalSent);

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
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] mx-auto w-full animate-fade-in">

      {/* ── 1. Hero Header with Quick Actions ───────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold text-[#5B4B8A] uppercase tracking-wider bg-[#F3F2FD] px-2.5 py-0.5 rounded-full border border-[#E6E4F5]">
              Operations Console
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center">
            Good {greeting}, {user?.firstName || 'Partner'} <span className="ml-2.5">👋</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {tenant?.name ? `${tenant.name} • Live Performance & Customer Analytics` : "Your brand's performance overview for today."}
          </p>
        </div>

        {/* Quick Launch Buttons */}
        <div className="flex items-center gap-2.5">
          <Link
            to="/campaigns"
            className="flex items-center gap-2 bg-[#5B4B8A] hover:bg-[#4B3D73] text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-xs hover:shadow-sm transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span>New Campaign</span>
          </Link>

          <Link
            to="/inbox"
            className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-2xs"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live Inbox</span>
          </Link>
        </div>
      </div>

      {/* ── 2. Getting Started (Onboarding Progress) ────────────── */}
      {!isSuperAdmin && !checklistDismissed && (
        <OnboardingCard
          health={wabaHealth}
          campaigns={campaigns.filter((c) => c.status === 'completed' || c.status === 'running').length}
          contacts={contactCount}
          templates={[]}
          onDismiss={handleDismissChecklist}
        />
      )}

      {/* ── 3. WhatsApp Account Health Console ──────────────────── */}
      {!isSuperAdmin && (
        <WABAHealthConsole health={wabaHealth} loading={healthLoading} />
      )}

      {/* ── 4. Performance Overview Section ─────────────────────── */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">Performance Overview</h3>
            <p className="text-xs text-slate-500">Aggregated messaging delivery & customer read engagement</p>
          </div>
          {!isSuperAdmin && (
            <DateRangePills value={dateRange} onChange={setDateRange} />
          )}
        </div>

        {loading || analyticsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Total Sent */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-[#5B4B8A]/40 hover:shadow-sm transition-all flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Sent</p>
                  <h4 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-1">{fmt(totalSent)}</h4>
                </div>
                <div className="w-10 h-10 bg-[#F3F2FD] text-[#5B4B8A] rounded-xl flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100 mt-3">
                <span>Last {dateRange} days</span>
                <span className={clsx("font-bold text-[11px] px-2 py-0.5 rounded-md", deltaClass(calcDelta(totalSent, prevSent)), "bg-slate-50")}>
                  {deltaLabel(calcDelta(totalSent, prevSent))}
                </span>
              </div>
            </div>

            {/* Delivered */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-emerald-300 hover:shadow-sm transition-all flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Delivered</p>
                  <h4 className="text-3xl font-extrabold text-emerald-600 tracking-tight mt-1">{deliveredPct}%</h4>
                </div>
                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100 mt-3">
                <span>{fmt(totalDelivered)} messages</span>
                <span className="font-bold text-[10px] tracking-wider uppercase bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-2 py-0.5 rounded-md">
                  {deliveredPct >= 90 ? 'Excellent' : deliveredPct > 0 ? `${deliveredPct}%` : 'No data'}
                </span>
              </div>
            </div>

            {/* Read Rate */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-[#5B4B8A]/40 hover:shadow-sm transition-all flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Read Rate</p>
                  <h4 className="text-3xl font-extrabold text-[#5B4B8A] tracking-tight mt-1">{readPct}%</h4>
                </div>
                <div className="w-10 h-10 bg-[#F3F2FD] text-[#5B4B8A] rounded-xl flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100 mt-3">
                <span>{fmt(totalRead)} opened</span>
                <span className="font-bold text-[10px] tracking-wider uppercase bg-[#F3F2FD] text-[#5B4B8A] border border-[#E6E4F5] px-2 py-0.5 rounded-md">
                  {totalRead > 0 ? `${readPct}% Read` : 'No data'}
                </span>
              </div>
            </div>

            {/* Failed / DLQ */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-rose-300 hover:shadow-sm transition-all flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Failed / DLQ</p>
                  <h4 className={clsx("text-3xl font-extrabold tracking-tight mt-1", totalDead > 0 ? "text-rose-500" : "text-slate-900")}>
                    {fmt(totalDead)}
                  </h4>
                </div>
                <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", totalDead > 0 ? "bg-rose-50 text-rose-500" : "bg-slate-100 text-slate-500")}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100 mt-3">
                <span>{totalDead > 0 ? 'Requires attention' : 'Clean pipeline'}</span>
                <span className={clsx("font-bold text-[10px] tracking-wider uppercase px-2 py-0.5 rounded-md border", totalDead > 0 ? "bg-rose-50 text-rose-700 border-rose-200/80" : "bg-emerald-50 text-emerald-700 border-emerald-200/60")}>
                  {totalDead > 0 ? 'Priority Needed' : 'Healthy'}
                </span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── 5. Recent Campaigns & Queue Health ───────────────────── */}
      <div className={isSuperAdmin ? 'grid grid-cols-1 xl:grid-cols-3 gap-6' : 'grid grid-cols-1 gap-6'}>

        {/* Redis Queue health (Super Admin only) */}
        {isSuperAdmin && (
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-slate-900">
                Redis Queue Health
              </h2>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>

            {!queueStats ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10" />)}
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { label: 'Waiting',     value: queueStats.messageQueue?.waiting,    color: '#5B4B8A' },
                  { label: 'Active',      value: queueStats.messageQueue?.active,     color: '#10B981' },
                  { label: 'Completed',   value: queueStats.messageQueue?.completed,  color: '#64748B' },
                  { label: 'Failed',      value: queueStats.messageQueue?.failed,     color: '#EF4444' },
                  { label: 'Dead Letter', value: queueStats.deadLetterQueue?.waiting, color: '#F59E0B' },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/70"
                  >
                    <span className="text-xs font-medium text-slate-600">{row.label}</span>
                    <span className="text-sm font-bold tabular-nums" style={{ color: row.color }}>
                      {row.value ?? 0}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Recent Campaigns Section */}
        <section className={isSuperAdmin ? 'xl:col-span-2' : ''}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">Recent Campaigns</h3>
              <p className="text-xs text-slate-500">Overview of your recent bulk messaging dispatches</p>
            </div>
            <Link
              to="/campaigns"
              id="view-all-campaigns"
              className="text-xs font-bold text-[#5B4B8A] hover:underline flex items-center transition-colors"
            >
              View all campaigns
              <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)}
            </div>
          ) : campaigns.length === 0 ? (
            /* Branded Empty State */
            <div className="bg-white rounded-2xl border border-slate-200 border-dashed py-16 flex flex-col items-center justify-center text-center p-6 shadow-xs">
              <div className="w-16 h-16 bg-[#F3F2FD] rounded-2xl flex items-center justify-center mb-4 text-[#5B4B8A]">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
              </div>
              <h4 className="text-slate-900 font-bold text-lg mb-1">Empower your brand</h4>
              <p className="text-slate-500 mb-6 max-w-sm text-xs leading-relaxed">
                No campaigns yet. Connect with your audience and start broadcasting WhatsApp templates today.
              </p>
              <Link
                to="/campaigns"
                id="cta-create-campaign"
                className="bg-[#5B4B8A] hover:bg-[#4B3D73] text-white px-6 py-2.5 rounded-xl font-bold text-xs shadow-xs hover:shadow-sm transition-all"
              >
                Create Your First Campaign
              </Link>
            </div>
          ) : (
            /* Populated Campaigns Stream */
            <div className="space-y-3">
              {campaigns.map((c) => {
                // Progress capped cleanly at 100%
                const progressPct = c.status === 'completed'
                  ? 100
                  : c.total_count
                    ? Math.min(100, Math.round((c.sent_count / c.total_count) * 100))
                    : 0;
                const delPct  = c.sent_count  ? Math.round(((c.delivered_count || 0) / c.sent_count) * 100) : 0;
                const cleanName = (c.name || 'Untitled Campaign').replace(/_/g, ' ');

                return (
                  <div
                    key={c.id}
                    className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-[#5B4B8A]/30 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h4 className="text-sm font-bold text-slate-900 tracking-tight">{cleanName}</h4>
                        <span className={clsx("text-[10px] px-2 py-0.5 rounded-md font-bold uppercase border", CAMPAIGN_STATUS_STYLE[c.status])}>
                          {c.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-semibold text-slate-700">{fmt(c.total_count)}</span> recipients
                      </div>
                    </div>

                    {/* Stats columns */}
                    <div className="grid grid-cols-3 gap-3 py-2.5 px-3 bg-slate-50/80 rounded-xl mb-3 text-xs border border-slate-100">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Sent</span>
                        <span className="font-bold text-slate-800">{fmt(c.sent_count)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Delivered</span>
                        <span className="font-bold text-emerald-600">{delPct}%</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Read</span>
                        <span className="font-bold text-[#5B4B8A]">{fmt(c.read_count)}</span>
                      </div>
                    </div>

                    {/* Progress indicator */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 rounded-full overflow-hidden bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#5B4B8A] to-emerald-500 transition-all duration-500"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-600 tabular-nums">
                        {progressPct}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
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
