/**
 * VDAJ Services — CompliancePage
 * Route: /compliance
 * Dedicated Compliance & Opt-in Governance page:
 *  - Consent breakdown by source
 *  - Opt-out rates vs Meta thresholds
 *  - Real-time WABA Quality Rating tracker
 */

import React, { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { tenantApi } from '../lib/api';
import { showError } from '../components/atoms/Toast/Toast.jsx';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const RATING_CFG = {
  GREEN:  { color: '#1D9E75', bg: '#E6F7F1', emoji: '🟢', label: 'High Quality' },
  YELLOW: { color: '#D97706', bg: '#FEF3C7', emoji: '🟡', label: 'Medium Quality' },
  RED:    { color: '#DC2626', bg: '#FEE2E2', emoji: '🔴', label: 'Low Quality' },
};

function QualityBadge({ rating }) {
  const norm = (rating || 'GREEN').toUpperCase();
  const c = RATING_CFG[norm] || RATING_CFG.GREEN;
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
      style={{ background: c.bg, color: c.color }}>
      {c.emoji} {c.label} ({norm})
    </span>
  );
}

const SOURCE_COLORS = ['#534AB7', '#1D9E75', '#0284c7', '#D97706', '#8B5CF6', '#EC4899'];

function SourceBar({ label, count, total, color }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-[#334155] capitalize">
          {label?.replace(/_/g, ' ') || 'Unknown'}
        </span>
        <span className="font-bold tabular-nums" style={{ color }}>
          {count.toLocaleString()} ({pct}%)
        </span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden bg-[#F1F5F9]">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

export default function CompliancePage() {
  const [compliance, setCompliance] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadCompliance = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tenantApi.compliance();
      setCompliance(res?.data || null);
    } catch (err) {
      showError(err?.message || 'Failed to load compliance data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCompliance();
  }, [loadCompliance]);

  const totalContacts = compliance?.total_contacts || 0;
  const missingOptIn = compliance?.contacts_missing_optin || 0;
  const consentedContacts = Math.max(0, totalContacts - missingOptIn);
  const consentRate = totalContacts > 0 ? Math.round((consentedContacts / totalContacts) * 100) : 100;
  const optOutRate = compliance?.opt_out_rate_pct ?? 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl font-black text-[#0F0F0F] tracking-tight">Compliance & Opt-In Governance</h1>
          <p className="text-sm text-[#64748B] mt-0.5">
            Monitor contact consent sources, opt-out thresholds, and WhatsApp Business Account quality ratings.
          </p>
        </div>
        <button
          onClick={loadCompliance}
          disabled={loading}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-xl text-xs font-bold text-[#534AB7] bg-[#F3F2FD] border border-[#534AB7]/20 hover:bg-[#EEECFC] transition-colors"
        >
          <svg className={clsx("w-3.5 h-3.5", loading && "animate-spin")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Audit
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-[#E6E4F5] shadow-xs">
          <p className="text-2xs font-bold uppercase tracking-wider text-[#9494A8]">Total Contacts</p>
          <p className="text-2xl font-black text-[#0F0F0F] mt-1">{loading ? '…' : totalContacts.toLocaleString()}</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E6E4F5] shadow-xs">
          <p className="text-2xs font-bold uppercase tracking-wider text-[#9494A8]">Consent Opt-In Rate</p>
          <p className="text-2xl font-black text-[#1D9E75] mt-1">{loading ? '…' : `${consentRate}%`}</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E6E4F5] shadow-xs">
          <p className="text-2xs font-bold uppercase tracking-wider text-[#9494A8]">Opt-Out Rate</p>
          <p className={clsx(
            "text-2xl font-black mt-1",
            optOutRate > 5 ? "text-[#DC2626]" : optOutRate > 2 ? "text-[#D97706]" : "text-[#1D9E75]"
          )}>
            {loading ? '…' : `${optOutRate}%`}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E6E4F5] shadow-xs">
          <p className="text-2xs font-bold uppercase tracking-wider text-[#9494A8]">WABA Quality</p>
          <div className="mt-1">
            {loading ? <span className="text-sm font-bold text-gray-400">…</span> : <QualityBadge rating={compliance?.quality_rating} />}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="h-44 rounded-2xl bg-gray-100 animate-pulse" />
          <div className="h-36 rounded-2xl bg-gray-100 animate-pulse" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Opt-In Breakdown */}
          <div className="rounded-2xl bg-white border border-[#E6E4F5] p-6 shadow-xs space-y-5">
            <div>
              <h2 className="text-sm font-bold text-[#0F0F0F]">Opt-In Consent Breakdown</h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                {consentedContacts.toLocaleString()} of {totalContacts.toLocaleString()} contacts have verified opt-in records.
              </p>
            </div>

            {(!compliance?.opt_in_breakdown || compliance.opt_in_breakdown.length === 0) ? (
              <div className="py-8 text-center text-xs text-[#64748B]">
                No consent data recorded yet. Opt-in sources are tagged automatically during CSV import or inbound webhooks.
              </div>
            ) : (
              <div className="space-y-4">
                {compliance.opt_in_breakdown.map((row, i) => (
                  <SourceBar
                    key={row.source}
                    label={row.source}
                    count={parseInt(row.count, 10)}
                    total={consentedContacts}
                    color={SOURCE_COLORS[i % SOURCE_COLORS.length]}
                  />
                ))}
              </div>
            )}

            {missingOptIn > 0 && (
              <div className="rounded-xl p-3 bg-[#FEF3C7] border border-[#FDE68A] text-[#92400E] text-xs">
                <span className="font-bold">⚠️ Warning:</span> {missingOptIn.toLocaleString()} contacts lack recorded opt-in consent. Meta policies prohibit unsolicited broadcast messages.
              </div>
            )}
          </div>

          {/* Right Column: Opt-Out Rates & Safety Thresholds */}
          <div className="rounded-2xl bg-white border border-[#E6E4F5] p-6 shadow-xs space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-bold text-[#0F0F0F]">Opt-Out Rate vs Meta Standards</h2>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Percentage of recipients who unsubscribed or blocked communications.
                </p>
              </div>

              <div className="flex items-center gap-6 p-4 rounded-xl bg-[#F8F7FF] border border-[#E6E4F5]">
                <div>
                  <p className={clsx(
                    "text-4xl font-black",
                    optOutRate > 5 ? "text-[#DC2626]" : optOutRate > 2 ? "text-[#D97706]" : "text-[#1D9E75]"
                  )}>
                    {optOutRate}%
                  </p>
                  <p className="text-2xs text-[#64748B] mt-1">
                    {compliance?.opted_out_count || 0} of {totalContacts.toLocaleString()} contacts
                  </p>
                </div>
                <div className="flex-1 text-xs">
                  {optOutRate <= 2 ? (
                    <p className="text-[#065F46] font-medium">
                      🟢 <span className="font-bold">Healthy Range (&lt;2%)</span> — Your account is in good standing with low spam reports.
                    </p>
                  ) : optOutRate <= 5 ? (
                    <p className="text-[#92400E] font-medium">
                      🟡 <span className="font-bold">Elevated Range (2-5%)</span> — Users are opting out at an above-average rate. Verify message frequency.
                    </p>
                  ) : (
                    <p className="text-[#9F1239] font-bold">
                      🔴 <span className="font-bold">Critical Risk (&gt;5%)</span> — High opt-out rates will trigger Meta rate-limiting or template pauses.
                    </p>
                  )}
                </div>
              </div>

              {/* Quality Tracker */}
              <div className="pt-2">
                <p className="text-xs font-bold text-[#0F0F0F] mb-2">Quality Tier Status</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 rounded-xl border border-[#A7F3D0] bg-[#E6F7F1]">
                    <p className="text-xs font-bold text-[#065F46]">🟢 High Quality</p>
                    <p className="text-2xs text-[#065F46]/80 mt-0.5">Normal dispatch</p>
                  </div>
                  <div className="p-2.5 rounded-xl border border-[#FDE68A] bg-[#FEF3C7]">
                    <p className="text-xs font-bold text-[#92400E]">🟡 Medium</p>
                    <p className="text-2xs text-[#92400E]/80 mt-0.5">Under monitoring</p>
                  </div>
                  <div className="p-2.5 rounded-xl border border-[#FECDD3] bg-[#FFE4E6]">
                    <p className="text-xs font-bold text-[#9F1239]">🔴 Low Quality</p>
                    <p className="text-2xs text-[#9F1239]/80 mt-0.5">Rate-restricted</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#E6E4F5] text-2xs text-[#9494A8]">
              Quality score last synced from Meta: {compliance?.waba_health_synced_at ? fmtDate(compliance.waba_health_synced_at) : 'Automated 6-hour cycle'}
            </div>
          </div>
        </div>
      )}

      {/* Meta Guidelines Card */}
      <div className="rounded-2xl bg-white border border-[#E6E4F5] p-6 shadow-xs space-y-3">
        <h3 className="text-sm font-bold text-[#0F0F0F]">Meta WhatsApp Business Messaging Policy Reminders</h3>
        <ul className="text-xs text-[#64748B] space-y-2 list-disc list-inside">
          <li>Always obtain explicit opt-in consent before initiating outbound WhatsApp messages.</li>
          <li>Marketing and promotional broadcasts must clearly identify your organization and provide an immediate stop/opt-out keyword.</li>
          <li>Customer service conversations have a 24-hour service window from the user's last inbound message.</li>
        </ul>
      </div>
    </div>
  );
}
