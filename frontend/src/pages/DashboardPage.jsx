/**
 * VDAJ Services — Official Brand Dashboard Page
 * Grounded in the VDAJ Official Brand Identity Kit
 *
 * Sections:
 *  1. Hero Greeting
 *  2. Getting Started (Onboarding Checklist)
 *  3. WhatsApp Account Health (4 Metric Cards + Daily Usage)
 *  4. Performance Overview (Date Pills + 4 KPI Cards with Delta %)
 *  5. Recent Campaigns (Branded Empty State / Activity Stream) + Redis Queue Health (Super Admin)
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
  if (d === null || d === undefined) return 'text-vdaj-purple/40';
  if (d > 0) return 'text-vdaj-teal';
  if (d < 0) return 'text-rose-500';
  return 'text-vdaj-purple/40';
}

function deltaLabel(d) {
  if (d === null || d === undefined) return '0%';
  const sign = d > 0 ? '+' : '';
  return `${sign}${d}%`;
}

// ─── Campaign Status Styles ───────────────────────────────────────────────────
const CAMPAIGN_STATUS_STYLE = {
  draft:     'bg-slate-100 text-slate-500 border-slate-200',
  scheduled: 'bg-vdaj-purple/10 text-vdaj-purple border-vdaj-purple/20',
  running:   'bg-vdaj-purple/10 text-vdaj-purple border-vdaj-purple/20',
  paused:    'bg-amber-50 text-amber-600 border-amber-200',
  completed: 'bg-vdaj-teal/10 text-vdaj-teal border-vdaj-teal/20',
  failed:    'bg-rose-50 text-rose-600 border-rose-200',
};

// ─── Skeleton Loader ──────────────────────────────────────────────────────────
function Skeleton({ className }) {
  return (
    <div
      className={clsx('animate-pulse rounded-2xl', className)}
      style={{ background: '#F3F2FD' }}
    />
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. WhatsApp Account Health Section
// ══════════════════════════════════════════════════════════════════════════════
const TIER_LABEL = { 1: '1,000', 2: '10,000', 3: '100,000', 4: 'Unlimited' };

function WABAHealthCard({ health, loading }) {
  if (loading) {
    return (
      <section className="mb-10">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-vdaj-black">WhatsApp Account Health</h3>
          <Skeleton className="w-32 h-7 rounded-full" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </section>
    );
  }

  // When WABA not yet connected show a friendly prompt
  if (!health?.waba_connected) {
    return (
      <section className="mb-10">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-vdaj-black">WhatsApp Account Health</h3>
          <div className="flex items-center text-[10px] text-vdaj-purple/50 font-bold uppercase tracking-widest bg-white px-3 py-1.5 rounded-full border border-vdaj-aura/10 shadow-sm">
            <svg className="w-3.5 h-3.5 mr-2 text-vdaj-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Disconnected
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-vdaj-aura/10 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-vdaj-aura/10 text-vdaj-purple flex items-center justify-center text-2xl shrink-0">
              📱
            </div>
            <div>
              <h4 className="text-base font-bold text-vdaj-black">WhatsApp Not Connected</h4>
              <p className="text-xs text-vdaj-purple/60 mt-0.5">
                Connect your WhatsApp Business Account (WABA) to view live quality rating, messaging limits, and phone details.
              </p>
            </div>
          </div>
          <Link
            to="/whatsapp-setup"
            className="shrink-0 bg-vdaj-purple hover:bg-vdaj-purple/90 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-vdaj-purple/20 transition-all"
          >
            Connect WABA →
          </Link>
        </div>
      </section>
    );
  }

  const rawRating = (health.quality_rating || 'UNKNOWN').toUpperCase();
  const tier      = health.messaging_tier || 1;
  const usedPct   = health.usage_pct ?? 0;
  const barColor  = usedPct > 80 ? '#ef4444' : usedPct > 60 ? '#f59e0b' : '#17C975';
  const syncedAgo = health.waba_health_synced_at
    ? (() => {
        const diffH = Math.round((Date.now() - new Date(health.waba_health_synced_at)) / 3_600_000);
        return diffH < 1 ? 'just now' : `${diffH}h ago`;
      })()
    : '4h ago';

  // Quality badge styling
  let ratingText = rawRating;
  let ratingColor = 'text-vdaj-teal';
  let badgeText = 'Healthy';
  let badgeClass = 'text-vdaj-teal bg-vdaj-teal/10';

  if (rawRating === 'UNKNOWN') {
    ratingColor = 'text-amber-500';
    badgeText = 'Action required';
    badgeClass = 'text-amber-600 bg-amber-50';
  } else if (rawRating === 'YELLOW') {
    ratingColor = 'text-amber-500';
    badgeText = 'At risk';
    badgeClass = 'text-amber-600 bg-amber-50';
  } else if (rawRating === 'RED') {
    ratingColor = 'text-rose-500';
    badgeText = 'Action required';
    badgeClass = 'text-rose-600 bg-rose-50';
  }

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-vdaj-black">WhatsApp Account Health</h3>
        <div className="flex items-center text-[10px] text-vdaj-purple/50 font-bold uppercase tracking-widest bg-white px-3 py-1.5 rounded-full border border-vdaj-aura/10 shadow-sm">
          <svg className="w-3.5 h-3.5 mr-2 text-vdaj-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Last Synced {syncedAgo}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Quality Rating */}
        <div className="bg-white p-6 rounded-2xl border border-vdaj-aura/10 metric-card-hover transition-all">
          <p className="text-[10px] font-bold text-vdaj-purple/40 uppercase tracking-widest mb-3">Quality Rating</p>
          <div className="flex flex-col">
            <span className={clsx("text-2xl font-bold mb-1 tracking-tight", ratingColor)}>
              {ratingText}
            </span>
            <span className={clsx("text-[11px] px-2 py-0.5 rounded-md inline-block w-fit font-semibold", badgeClass)}>
              {badgeText}
            </span>
          </div>
        </div>

        {/* Messaging Tier */}
        <div className="bg-white p-6 rounded-2xl border border-vdaj-aura/10 metric-card-hover transition-all">
          <p className="text-[10px] font-bold text-vdaj-purple/40 uppercase tracking-widest mb-3">Messaging Tier</p>
          <div className="flex flex-col">
            <span className="text-2xl font-bold text-vdaj-purple mb-1">Tier {tier}</span>
            <span className="text-[11px] text-vdaj-purple/60 font-medium">
              {TIER_LABEL[tier] || '1,000'} msgs/day
            </span>
          </div>
        </div>

        {/* Sent Today */}
        <div className="bg-white p-6 rounded-2xl border border-vdaj-aura/10 metric-card-hover transition-all">
          <p className="text-[10px] font-bold text-vdaj-purple/40 uppercase tracking-widest mb-3">Sent Today</p>
          <div className="flex flex-col">
            <span className="text-2xl font-bold text-vdaj-black mb-1">{fmt(health.msgs_sent_today)}</span>
            <span className="text-[11px] text-vdaj-purple/40 font-medium">of {fmt(health.daily_limit || 1000)} total</span>
          </div>
        </div>

        {/* Business Number */}
        <div className="bg-white p-6 rounded-2xl border border-vdaj-aura/10 metric-card-hover transition-all">
          <p className="text-[10px] font-bold text-vdaj-purple/40 uppercase tracking-widest mb-3">Business Number</p>
          <div className="flex flex-col">
            <span className="text-lg font-bold text-vdaj-black mb-1 truncate">
              {health.display_phone_number || '—'}
            </span>
            <span className="text-[11px] text-vdaj-teal font-semibold truncate">
              {health.verified_name || 'Verified Business'}
            </span>
          </div>
        </div>
      </div>

      {/* Usage progress bar */}
      <div className="mt-4 bg-white p-4 rounded-xl border border-vdaj-aura/10">
        <div className="flex justify-between text-[11px] font-semibold text-vdaj-purple/60 mb-1.5">
          <span>Daily Quota Usage</span>
          <span style={{ color: barColor }}>{usedPct}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden bg-vdaj-aura/10">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${Math.min(usedPct, 100)}%`, background: barColor }}
          />
        </div>
        {usedPct >= 80 && (
          <p className="text-[11px] mt-1.5 font-semibold text-rose-500">
            ⚠️ Approaching daily limit — queued messages will resume tomorrow.
          </p>
        )}
      </div>
    </section>
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
    {
      id: 'waba',
      label: 'Connect WhatsApp',
      done:  !!health?.waba_connected,
      link:  '/whatsapp-setup',
    },
    {
      id: 'template',
      label: 'Template Approval',
      done:  approvedTemplates > 0,
      link:  '/templates',
    },
    {
      id: 'contacts',
      label: 'Import Contacts',
      done:  contactCount > 0,
      link:  '/contacts',
    },
    {
      id: 'campaign',
      label: 'First Campaign',
      done:  campaignCount > 0,
      link:  '/campaigns',
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const allDone   = doneCount === steps.length;

  // Hide if all steps complete
  if (allDone) return null;

  return (
    <div className="mb-10 bg-vdaj-purple rounded-2xl p-7 text-white shadow-xl shadow-vdaj-purple/10 relative overflow-hidden">
      {/* Decorative Sparkle Decal */}
      <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none select-none">
        <svg className="w-28 h-28" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z" />
        </svg>
      </div>

      <div className="flex items-center justify-between mb-8 relative z-10">
        <div className="flex items-center">
          <svg className="w-6 h-6 mr-3 text-vdaj-aura" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.63 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m0 0L8.8 8.8m0 0L7.4 7.4" />
          </svg>
          <h2 className="text-xl font-bold">Getting Started &mdash; {doneCount}/{steps.length} complete</h2>
        </div>
        <button
          onClick={onDismiss}
          className="p-1.5 hover:bg-white/20 rounded-md transition-colors"
          title="Dismiss checklist"
          aria-label="Dismiss checklist"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative z-10">
        {steps.map((step, idx) => (
          <Link
            key={step.id}
            to={step.done ? '#' : step.link}
            onClick={(e) => step.done && e.preventDefault()}
            className={clsx(
              "rounded-xl p-4 flex items-center space-x-3 transition-all",
              step.done
                ? "bg-white/10 backdrop-blur-md border border-white/20"
                : idx === doneCount
                  ? "bg-white/20 border border-white/30 shadow-md"
                  : "bg-white/5 border border-white/10 opacity-60 hover:opacity-100"
            )}
          >
            <div
              className={clsx(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold",
                step.done
                  ? "bg-vdaj-teal text-white"
                  : idx === doneCount
                    ? "bg-vdaj-aura/40 text-white"
                    : "bg-white/20 text-white"
              )}
            >
              {step.done ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                idx + 1
              )}
            </div>
            <span className="text-xs font-medium leading-snug">{step.label}</span>
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
    <div className="flex bg-vdaj-aura/5 p-1 rounded-lg border border-vdaj-aura/10">
      {[7, 30, 90].map((d) => (
        <button
          key={d}
          onClick={() => onChange(d)}
          className={clsx(
            "px-4 py-1.5 text-xs font-bold rounded-md transition-all",
            value === d
              ? "text-white bg-vdaj-purple shadow-md shadow-vdaj-purple/20"
              : "text-vdaj-purple/60 hover:text-vdaj-purple"
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
    <div className="p-2 sm:p-4 lg:p-6 max-w-[1440px] mx-auto w-full animate-fade-in">

      {/* ── 1. Hero Greeting ────────────────────────────────────── */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-vdaj-black mb-1 flex items-center tracking-tight">
          Good {greeting}, {user?.firstName || 'Harinarayan'} <span className="ml-3 text-3xl">👋</span>
        </h1>
        <p className="text-vdaj-purple/60">
          {tenant?.name ? `${tenant.name}'s performance overview for today.` : "Your brand's performance overview for today."}
        </p>
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

      {/* ── 3. WhatsApp Account Health Section ──────────────────── */}
      {!isSuperAdmin && (
        <WABAHealthCard health={wabaHealth} loading={healthLoading} />
      )}

      {/* ── 4. Performance Overview Section ─────────────────────── */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-vdaj-black">Performance Overview</h3>
          {!isSuperAdmin && (
            <DateRangePills value={dateRange} onChange={setDateRange} />
          )}
        </div>

        {loading || analyticsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Sent */}
            <div className="bg-white p-6 rounded-2xl border border-vdaj-aura/10 shadow-sm metric-card-hover transition-all">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-[10px] font-bold text-vdaj-purple/40 uppercase tracking-widest mb-1">Total Sent</p>
                  <h4 className="text-3xl font-bold text-vdaj-black">{fmt(totalSent)}</h4>
                </div>
                <div className="w-10 h-10 bg-vdaj-purple/10 text-vdaj-purple rounded-xl flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </div>
              </div>
              <div className="flex items-center text-[11px]">
                <span className="text-vdaj-purple/40">Last {dateRange} days</span>
                <span className={clsx("ml-auto font-bold", deltaClass(calcDelta(totalSent, prevSent)))}>
                  {deltaLabel(calcDelta(totalSent, prevSent))}
                </span>
              </div>
            </div>

            {/* Delivered */}
            <div className="bg-white p-6 rounded-2xl border border-vdaj-aura/10 shadow-sm metric-card-hover transition-all">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-[10px] font-bold text-vdaj-purple/40 uppercase tracking-widest mb-1">Delivered</p>
                  <h4 className="text-3xl font-bold text-vdaj-teal">{deliveredPct}%</h4>
                </div>
                <div className="w-10 h-10 bg-vdaj-teal/10 text-vdaj-teal rounded-xl flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="flex items-center text-[11px]">
                <span className="text-vdaj-purple/40">{fmt(totalDelivered)} messages</span>
                <span className="ml-auto text-vdaj-teal/60 font-bold tracking-tighter uppercase">
                  {deliveredPct >= 90 ? 'Excellent' : deliveredPct > 0 ? `${deliveredPct}%` : 'No data'}
                </span>
              </div>
            </div>

            {/* Read Rate */}
            <div className="bg-white p-6 rounded-2xl border border-vdaj-aura/10 shadow-sm metric-card-hover transition-all">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-[10px] font-bold text-vdaj-purple/40 uppercase tracking-widest mb-1">Read Rate</p>
                  <h4 className="text-3xl font-bold text-vdaj-purple">{readPct}%</h4>
                </div>
                <div className="w-10 h-10 bg-vdaj-aura/10 text-vdaj-purple rounded-xl flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
              </div>
              <div className="flex items-center text-[11px]">
                <span className="text-vdaj-purple/40">{fmt(totalRead)} opened</span>
                <span className="ml-auto text-vdaj-purple/40 font-medium">
                  {totalRead > 0 ? `${readPct}% read` : 'No data'}
                </span>
              </div>
            </div>

            {/* Failed / DLQ */}
            <div className="bg-white p-6 rounded-2xl border border-vdaj-aura/10 shadow-sm metric-card-hover transition-all">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-[10px] font-bold text-vdaj-purple/40 uppercase tracking-widest mb-1">Failed / DLQ</p>
                  <h4 className="text-3xl font-bold text-rose-500">{fmt(totalDead)}</h4>
                </div>
                <div className="w-10 h-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              </div>
              <div className="flex items-center text-[11px]">
                <span className={clsx("font-bold uppercase tracking-tighter", totalDead > 0 ? "text-rose-500" : "text-vdaj-teal")}>
                  {totalDead > 0 ? "Priority Needed" : "Clean Queue"}
                </span>
                <svg className="w-3.5 h-3.5 ml-auto text-vdaj-purple/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── 5. Recent Campaigns & Queue Health ───────────────────── */}
      <div className={isSuperAdmin ? 'grid grid-cols-1 xl:grid-cols-3 gap-6' : 'grid grid-cols-1 gap-6'}>

        {/* Redis Queue health (Super Admin only) */}
        {isSuperAdmin && (
          <div className="bg-white rounded-2xl p-6 border border-vdaj-aura/10 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-vdaj-black">
                Redis Queue Health
              </h2>
              <span className="w-2.5 h-2.5 rounded-full bg-vdaj-teal animate-pulse" />
            </div>

            {!queueStats ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10" />)}
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { label: 'Waiting',     value: queueStats.messageQueue?.waiting,    color: '#5B4B8A' },
                  { label: 'Active',      value: queueStats.messageQueue?.active,     color: '#17C975' },
                  { label: 'Completed',   value: queueStats.messageQueue?.completed,  color: '#5A5A6E' },
                  { label: 'Failed',      value: queueStats.messageQueue?.failed,     color: '#f87171' },
                  { label: 'Dead Letter', value: queueStats.deadLetterQueue?.waiting, color: '#f59e0b' },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-vdaj-white border border-vdaj-aura/10"
                  >
                    <span className="text-xs font-medium text-vdaj-purple/60">{row.label}</span>
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
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-vdaj-black">Recent Campaigns</h3>
            <Link
              to="/campaigns"
              id="view-all-campaigns"
              className="text-sm font-bold text-vdaj-purple hover:text-vdaj-purple/80 flex items-center transition-colors"
            >
              View all campaigns
              <svg className="w-4 h-4 ml-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)}
            </div>
          ) : campaigns.length === 0 ? (
            /* Official Branded Empty State */
            <div className="bg-white rounded-2xl border border-vdaj-aura/20 py-24 flex flex-col items-center justify-center border-dashed relative overflow-hidden shadow-sm">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-vdaj-purple/20 via-vdaj-aura/30 to-vdaj-teal/20" />
              <div className="w-24 h-24 bg-vdaj-white rounded-full flex items-center justify-center mb-6 shadow-inner border border-vdaj-aura/10">
                <svg className="w-12 h-12 text-vdaj-aura/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
              </div>
              <h4 className="text-vdaj-black font-bold text-xl mb-2">Empower your brand</h4>
              <p className="text-vdaj-purple/50 mb-10 max-w-sm text-center px-6 leading-relaxed text-sm">
                No campaigns yet. Connect with your audience and grow your business today.
              </p>
              <Link
                to="/campaigns"
                id="cta-create-campaign"
                className="bg-vdaj-purple hover:bg-vdaj-purple/90 text-white px-10 py-3.5 rounded-xl font-bold text-sm shadow-xl shadow-vdaj-purple/20 transition-all transform hover:scale-105 active:scale-95"
              >
                Create Your First Campaign
              </Link>
            </div>
          ) : (
            /* Populated Campaigns Stream */
            <div className="space-y-3">
              {campaigns.map((c) => {
                const sentPct = c.total_count ? Math.round((c.sent_count / c.total_count) * 100) : 0;
                const delPct  = c.sent_count  ? Math.round(((c.delivered_count || 0) / c.sent_count) * 100) : 0;
                return (
                  <div
                    key={c.id}
                    className="bg-white p-5 rounded-2xl border border-vdaj-aura/10 shadow-sm metric-card-hover transition-all"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <h4 className="text-base font-bold text-vdaj-black">{c.name}</h4>
                        <span className={clsx("text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border", CAMPAIGN_STATUS_STYLE[c.status])}>
                          {c.status}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-vdaj-purple/60">
                        {fmt(c.total_count)} recipients
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 my-3 py-2 border-y border-vdaj-aura/5 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-vdaj-purple/40 block">Sent</span>
                        <span className="font-bold text-vdaj-black">{fmt(c.sent_count)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-vdaj-purple/40 block">Delivered</span>
                        <span className="font-bold text-vdaj-teal">{delPct}%</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-vdaj-purple/40 block">Read</span>
                        <span className="font-bold text-vdaj-purple">{fmt(c.read_count)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-vdaj-aura/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-vdaj-purple to-vdaj-teal transition-all duration-500"
                          style={{ width: `${Math.min(sentPct, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-vdaj-purple/60 tabular-nums">
                        {sentPct}%
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
