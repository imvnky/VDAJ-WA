/**
 * VDAJ Services — AnalyticsPage
 * Recharts AreaChart + Circular SVG rings + Elevated metric cards
 * Zero ugly tables. Premium data visualization only.
 */

import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import { analyticsApi } from '../lib/api';
import { ErrorState, parseApiError } from '../components/atoms/ErrorState/ErrorState.jsx';

// ── Circular Progress Ring ────────────────────────────────────
function CircleRing({ pct = 0, size = 80, stroke = 7, color = '#534AB7', label, value }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(pct, 100) / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke="var(--bg-border)" strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={color} strokeWidth={stroke}
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>{value}</span>
        </div>
      </div>
      <p className="text-2xs font-medium text-center" style={{ color: 'var(--text-muted)' }}>{label}</p>
    </div>
  );
}

// ── KPI Metric Card ───────────────────────────────────────────
function MetricCard({ label, value, sub, color, icon }) {
  return (
    <div className="glass-card p-5 flex items-start gap-4">
      <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
        <span style={{ color, fontSize: '1.25rem' }}>{icon}</span>
      </div>
      <div>
        <p className="text-2xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</p>
        <p className="text-2xl font-black mt-0.5" style={{ color: 'var(--text-primary)' }}>{value ?? '—'}</p>
        {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{sub}</p>}
      </div>
    </div>
  );
}

// ── Custom Tooltip ────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-4 py-3 rounded-xl shadow-brand-sm text-xs space-y-1"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}>
      <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────
function EmptyAnalytics() {
  return (
    <div className="glass-card flex flex-col items-center justify-center py-20 text-center">
      <svg className="w-24 h-24 opacity-10 mb-4" viewBox="0 0 100 100" fill="none">
        <rect x="10" y="60" width="15" height="30" rx="3" fill="currentColor"/>
        <rect x="35" y="40" width="15" height="50" rx="3" fill="currentColor"/>
        <rect x="60" y="25" width="15" height="65" rx="3" fill="currentColor"/>
        <path d="M10 50 Q35 20 60 30 Q80 40 90 10" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round"/>
      </svg>
      <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>No data yet</p>
      <p className="text-sm mt-2 mb-6" style={{ color: 'var(--text-muted)' }}>
        Send your first campaign to start seeing analytics here.
      </p>
      <a href="/campaigns"
        className="btn-primary px-5 py-2.5 rounded-xl text-sm font-semibold">
        → Create a Campaign
      </a>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────
function Skeleton({ className }) {
  return <div className={clsx('animate-pulse rounded-2xl', className)} style={{ background: 'var(--bg-elevated)' }} />;
}

// ── Main Page ─────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [overview, setOverview] = useState(null);
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [trendDays, setTrendDays] = useState(30);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [ov, tr] = await Promise.allSettled([
          analyticsApi.overview({ silent: true }),
          analyticsApi.trend(trendDays, { silent: true }),
        ]);
        if (ov.status === 'fulfilled') setOverview(ov.value?.data || null);
        if (tr.status === 'fulfilled') setTrend(tr.value?.data || []);
        // If both failed, set an error state
        if (ov.status === 'rejected' && tr.status === 'rejected') {
          setError(parseApiError(ov.reason));
        }
      } finally { setLoading(false); }
    };
    load();
  }, [trendDays]);

  const m = overview?.messages;
  const hasData = trend.length > 0 || m?.total_sent > 0;

  // Format trend data for Recharts
  const chartData = trend.map((t) => ({
    date: new Date(t.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
    Sent: t.msgs_sent,
    Delivered: t.msgs_delivered,
    Read: t.msgs_read,
    Failed: t.msgs_failed,
  }));

  return (
    <div className="max-w-7xl mx-auto space-y-6" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>Analytics</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Last 30 days · Auto-refreshes every session</p>
        </div>
        <div className="flex gap-2">
          {[7, 14, 30].map((d) => (
            <button key={d} onClick={() => setTrendDays(d)}
              className="h-8 px-3 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: trendDays === d ? '#534AB7' : 'var(--bg-elevated)',
                color: trendDays === d ? '#fff' : 'var(--text-secondary)',
                border: '1px solid var(--bg-border)',
              }}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
          </div>
          <Skeleton className="h-72" />
        </div>
      ) : error ? (
        <ErrorState
          title="Analytics unavailable"
          message={error.message}
          httpCode={error.httpCode}
          errorCode={error.errorCode}
          onRetry={() => setTrendDays((d) => d)}
        />
      ) : !hasData ? (
        <EmptyAnalytics />
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MetricCard label="Messages Sent" value={m?.total_sent?.toLocaleString()} icon="📤" color="#534AB7" sub="Last 30 days" />
            <MetricCard label="Delivery Rate" value={`${m?.deliveryRate ?? 0}%`} icon="✅" color="#1D9E75" sub={`${m?.total_delivered?.toLocaleString()} delivered`} />
            <MetricCard label="Read Rate" value={`${m?.readRate ?? 0}%`} icon="👁️" color="#AFA9EC" sub={`${m?.total_read?.toLocaleString()} read`} />
            <MetricCard label="Opt-Outs" value={m?.total_opt_outs?.toLocaleString()} icon="🚫" color="#f87171" sub={`${m?.optOutRate ?? 0}% rate`} />
          </div>

          {/* Circular Progress Rings */}
          <div className="glass-card p-6">
            <h2 className="text-sm font-bold mb-6" style={{ color: 'var(--text-primary)' }}>Message Health</h2>
            <div className="flex flex-wrap justify-around gap-6">
              <CircleRing pct={parseFloat(m?.deliveryRate || 0)} color="#534AB7" label="Delivery Rate" value={`${m?.deliveryRate || 0}%`} size={90} />
              <CircleRing pct={parseFloat(m?.readRate || 0)} color="#1D9E75" label="Read Rate" value={`${m?.readRate || 0}%`} size={90} />
              <CircleRing pct={100 - parseFloat(m?.optOutRate || 0)} color="#AFA9EC" label="Retention" value={`${(100 - parseFloat(m?.optOutRate || 0)).toFixed(1)}%`} size={90} />
              <CircleRing
                pct={overview?.campaigns?.total_campaigns > 0 ? (overview.campaigns.completed / overview.campaigns.total_campaigns) * 100 : 0}
                color="#fbbf24" label="Campaigns Done" value={`${overview?.campaigns?.completed || 0}/${overview?.campaigns?.total_campaigns || 0}`} size={90}
              />
            </div>
          </div>

          {/* Area Chart */}
          <div className="glass-card p-6">
            <h2 className="text-sm font-bold mb-5" style={{ color: 'var(--text-primary)' }}>Message Trend</h2>
            {chartData.length === 0 ? (
              <div className="h-52 flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
                <p className="text-sm">No trend data for this period.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradSent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#534AB7" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#534AB7" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="gradDelivered" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1D9E75" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#1D9E75" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="gradRead" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#AFA9EC" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#AFA9EC" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} />
                  <Area type="monotone" dataKey="Sent"      stroke="#534AB7" fill="url(#gradSent)"      strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="Delivered" stroke="#1D9E75" fill="url(#gradDelivered)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="Read"      stroke="#AFA9EC" fill="url(#gradRead)"      strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="Failed"    stroke="#f87171" fill="none"                strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Contact + Campaign Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="glass-card p-5">
              <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Contact Health</h3>
              <div className="space-y-3">
                {[
                  { label: 'Total Contacts', val: overview?.contacts?.total_contacts, color: '#534AB7' },
                  { label: 'Opted Out', val: overview?.contacts?.opted_out, color: '#f87171' },
                  { label: 'Active', val: parseInt(overview?.contacts?.total_contacts || 0) - parseInt(overview?.contacts?.opted_out || 0), color: '#1D9E75' },
                ].map((r) => (
                  <div key={r.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: r.color }} />
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{r.label}</span>
                    </div>
                    <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{r.val?.toLocaleString() ?? '—'}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card p-5">
              <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Campaigns</h3>
              <div className="space-y-3">
                {[
                  { label: 'Total', val: overview?.campaigns?.total_campaigns, color: '#534AB7' },
                  { label: 'Completed', val: overview?.campaigns?.completed, color: '#1D9E75' },
                  { label: 'Running', val: overview?.campaigns?.running, color: '#AFA9EC' },
                ].map((r) => (
                  <div key={r.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: r.color }} />
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{r.label}</span>
                    </div>
                    <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{r.val?.toLocaleString() ?? '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
