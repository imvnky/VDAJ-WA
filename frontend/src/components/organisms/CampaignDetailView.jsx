/**
 * VDAJ Services — Enterprise Campaign Detail & Delivery Analytics Dashboard
 * ─────────────────────────────────────────────────────────────────────────
 * Designed to MNC / Fortune 500 standards (LeadMantra / WhatsApp Bulk World Grade).
 * Provides deep visibility into message dispatch, delivery states, and error analytics.
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { campaignApi } from '../../lib/api';
import { PrimaryButton, SecondaryButton, GhostButton } from '../atoms/Button/Button.jsx';
import { showSuccess, showError } from '../atoms/Toast/Toast.jsx';

// ── Helpers ─────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return iso;
  }
}

function calcPct(part, total) {
  if (!total || total === 0 || !part) return '0%';
  const pct = Math.min(100, Math.max(0, (part / total) * 100));
  return `${pct.toFixed(2)}%`;
}

// ── Status Config ───────────────────────────────────────────────────────
const STATUS_CFG = {
  read: {
    label: 'Read',
    icon: '✓✓',
    color: '#0284C7',
    bg: '#E0F2FE',
    border: '#BAE6FD',
  },
  delivered: {
    label: 'Delivered',
    icon: '✓✓',
    color: '#16A34A',
    bg: '#DCFCE7',
    border: '#BBF7D0',
  },
  sent: {
    label: 'Sent',
    icon: '✓',
    color: '#2563EB',
    bg: '#DBEAFE',
    border: '#BFDBFE',
  },
  queued: {
    label: 'Queued',
    icon: '🕐',
    color: '#D97706',
    bg: '#FEF3C7',
    border: '#FDE68A',
  },
  failed: {
    label: 'Failed',
    icon: '✗',
    color: '#DC2626',
    bg: '#FEE2E2',
    border: '#FECACA',
  },
  dead_letter: {
    label: 'Failed',
    icon: '✗',
    color: '#DC2626',
    bg: '#FEE2E2',
    border: '#FECACA',
  },
};

export default function CampaignDetailView({ campaignId, onBack, onNewCampaign }) {
  const [campaign, setCampaign] = useState(null);
  const [messages, setMessages] = useState([]);
  const [totalMessages, setTotalMessages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [resending, setResending] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // all, executed, queued, failed
  const [searchTerm, setSearchTerm] = useState('');
  const recipientTableRef = useRef(null);

  const handleCardFilter = (tab) => {
    setActiveTab(tab);
    setTimeout(() => {
      recipientTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  // Load campaign + recipient messages
  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      // 1. Fetch campaign header and counts
      const campRes = await campaignApi.get(campaignId);
      const campData = campRes?.data || campRes;
      setCampaign(campData);

      // 2. Fetch campaign messages list (up to 200)
      const msgRes = await campaignApi.messages({
        campaign_id: campaignId,
        limit: 200,
        offset: 0,
      });

      const msgList = msgRes?.data?.messages || msgRes?.messages || [];
      const total = msgRes?.data?.total || msgRes?.total || msgList.length;
      setMessages(msgList);
      setTotalMessages(total);
    } catch (err) {
      showError('Failed to load campaign analytics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [campaignId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Retry failed recipients only
  const handleRetryFailed = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      const res = await campaignApi.retryFailed(campaignId);
      showSuccess(res?.message || 'Failed recipient(s) queued for re-dispatch.');
      await loadData(true);
    } catch (err) {
      showError(err?.message || 'Failed to retry recipients.');
    } finally {
      setRetrying(false);
    }
  };

  // Resend entire campaign to all recipients
  const handleResendCampaign = async () => {
    if (resending) return;
    if (!window.confirm('Are you sure you want to resend this campaign to all audience contacts?')) {
      return;
    }
    setResending(true);
    try {
      const res = await campaignApi.resend(campaignId);
      showSuccess(res?.message || 'Campaign queued for resend.');
      await loadData(true);
    } catch (err) {
      showError(err?.message || 'Failed to resend campaign.');
    } finally {
      setResending(false);
    }
  };

  // Derived metrics
  const stats = useMemo(() => {
    if (!campaign) {
      return {
        total: 0,
        sent: 0,
        delivered: 0,
        read: 0,
        failed: 0,
        queued: 0,
        accepted: 0,
        singleTickSent: 0,
        doubleTickDelivered: 0,
        totalRead: 0,
      };
    }

    const counts = campaign.live_counts || {};
    const rawSent = Number(counts.sent ?? campaign.sent_count ?? 0);
    const rawDelivered = Number(counts.delivered ?? campaign.delivered_count ?? 0);
    const rawRead = Number(counts.read ?? campaign.read_count ?? 0);
    const queued = Number(counts.queued ?? campaign.queued_count ?? 0);
    const failed = Number(counts.failed !== undefined ? counts.failed : (campaign.failed_count || 0));
    const total = Math.max(Number(campaign.total_count || totalMessages || (rawSent + rawDelivered + rawRead + failed + queued)), 1);

    // WhatsApp delivery status hierarchy:
    // Single Tick = Dispatched to Meta network (sent + delivered + read)
    // Double Tick = Reached handset (delivered + read)
    // Read = Opened by contact (read)
    const singleTickSent = rawSent + rawDelivered + rawRead;
    const doubleTickDelivered = rawDelivered + rawRead;
    const totalRead = rawRead;
    const accepted = singleTickSent;

    return {
      total,
      sent: singleTickSent,
      delivered: doubleTickDelivered,
      read: totalRead,
      singleTickSent,
      doubleTickDelivered,
      totalRead,
      failed: Math.min(failed, total),
      queued,
      accepted,
    };
  }, [campaign, totalMessages]);

  // Real-time updates: WebSocket listener + continuous live polling
  useEffect(() => {
    const handleWsMsg = (e) => {
      const payload = e?.detail;
      if (!payload) return;
      if (
        (payload.type === 'CAMPAIGN_STATUS_UPDATE' && payload.data?.campaignId === campaignId) ||
        payload.type === 'campaign_update' ||
        payload.type === 'message_status_update' ||
        payload.type === 'new_message'
      ) {
        // Optimistically update matching recipient row in table instantly
        if (payload.data?.metaMessageId && payload.data?.status) {
          setMessages((prev) =>
            prev.map((m) =>
              m.meta_message_id === payload.data.metaMessageId || m.id === payload.data.messageId
                ? {
                    ...m,
                    status: payload.data.status,
                    delivered_at: payload.data.status === 'delivered' ? new Date().toISOString() : m.delivered_at,
                    read_at: payload.data.status === 'read' ? new Date().toISOString() : m.read_at,
                    failed_at: payload.data.status === 'failed' ? new Date().toISOString() : m.failed_at,
                    last_error: payload.data.error_message || m.last_error,
                  }
                : m
            )
          );
        }
        loadData(true);
      }
    };

    window.addEventListener('vdaj:ws_message', handleWsMsg);

    // Continuous live polling: 3.5s while dispatching/queued, 6s for executed campaigns to stream handset delivery/read receipts
    const intervalMs = (campaign?.status === 'running' || (stats && stats.queued > 0)) ? 3500 : 6000;
    const pollTimer = setInterval(() => {
      loadData(true);
    }, intervalMs);

    return () => {
      window.removeEventListener('vdaj:ws_message', handleWsMsg);
      clearInterval(pollTimer);
    };
  }, [campaignId, campaign?.status, stats?.queued, loadData]);

  // Filtered recipient messages
  const filteredMessages = useMemo(() => {
    return messages.filter((m) => {
      // Tab filter
      if (activeTab === 'executed') {
        if (!['sent', 'delivered', 'read'].includes(m.status)) return false;
      } else if (activeTab === 'queued') {
        if (m.status !== 'queued') return false;
      } else if (activeTab === 'failed') {
        if (!['failed', 'dead_letter'].includes(m.status)) return false;
      }

      // Search filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const name = (m.display_name || `${m.first_name || ''} ${m.last_name || ''}`).toLowerCase();
        const phone = (m.phone_e164 || '').toLowerCase();
        return name.includes(q) || phone.includes(q);
      }

      return true;
    });
  }, [messages, activeTab, searchTerm]);

  // Export CSV Report
  const handleExportCsv = () => {
    if (!messages.length) {
      showError('No messages available to export.');
      return;
    }

    const headers = ['Recipient Name', 'Phone Number', 'Status', 'Sent At', 'Delivered At', 'Read At', 'Last Error'];
    const rows = messages.map((m) => [
      `"${m.display_name || `${m.first_name || ''} ${m.last_name || ''}`.trim() || 'N/A'}"`,
      `"'${m.phone_e164 || ''}"`,
      `"${m.status || ''}"`,
      `"${m.sent_at || ''}"`,
      `"${m.delivered_at || ''}"`,
      `"${m.read_at || ''}"`,
      `"${(m.last_error || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Campaign_Report_${campaign?.name || 'VDAJ'}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSuccess('Delivery report exported.');
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-white rounded-xl border border-[#E6E4F5] w-48" />
        <div className="h-32 bg-white rounded-2xl border border-[#E6E4F5]" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-28 bg-white rounded-2xl border border-[#E6E4F5]" />
          ))}
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-[#E6E4F5]">
        <p className="text-sm font-semibold text-gray-600">Campaign not found.</p>
        <SecondaryButton onClick={onBack} className="mt-4">
          ← Back to Campaigns
        </SecondaryButton>
      </div>
    );
  }

  const isCompleted = ['completed', 'failed'].includes(campaign.status);
  const isRunning = campaign.status === 'running';

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* ── Top Navigation Bar ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/80 shadow-2xs transition-all cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Campaigns
          </button>
          <PrimaryButton
            onClick={onNewCampaign}
            size="sm"
            className="cursor-pointer h-9 px-3.5 rounded-lg text-xs font-semibold shadow-xs"
            leftIcon={
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            }
          >
            Create New Campaign
          </PrimaryButton>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Retry Failed Only Button */}
          {stats.failed > 0 && (
            <button
              onClick={handleRetryFailed}
              disabled={retrying}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200/80 hover:bg-rose-100 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
              title="Re-send template only to failed/dead-lettered recipients"
            >
              <svg
                className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{retrying ? 'Queueing Retries...' : `Retry Failed (${stats.failed})`}</span>
            </button>
          )}

          {/* Resend Campaign Button */}
          <button
            onClick={handleResendCampaign}
            disabled={resending}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200/80 hover:bg-slate-50 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
            title="Relaunch this campaign to all audience contacts"
          >
            <svg
              className={`w-3.5 h-3.5 ${resending ? 'animate-spin text-[#534AB7]' : 'text-slate-500'}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{resending ? 'Relaunching...' : 'Resend Campaign'}</span>
          </button>

          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200/80 hover:bg-slate-50 shadow-2xs transition-all cursor-pointer"
          >
            <svg
              className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#534AB7]' : 'text-slate-400'}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>

          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 hover:bg-emerald-100 shadow-2xs transition-all cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export Report (.csv)
          </button>
        </div>
      </div>

      {/* ── Campaign Metadata Header ───────────────────────────────────── */}
      <div className="shadcn-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">{campaign.name}</h1>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-2xs font-semibold uppercase tracking-wider ${
                  campaign.status === 'completed'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : campaign.status === 'running'
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    : campaign.status === 'failed'
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                {campaign.status === 'completed' ? 'EXECUTED' : campaign.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-normal">
              Started on: <span className="font-medium text-slate-700">{fmtDate(campaign.started_at || campaign.created_at)}</span>
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-600 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200/60">
            <div>
              <span className="text-slate-400 uppercase font-semibold text-[10px] block tracking-wider">Template</span>
              <span className="font-semibold text-slate-900 font-mono">{campaign.template_name || '—'}</span>
            </div>
            <div className="w-px h-6 bg-slate-200" />
            <div>
              <span className="text-slate-400 uppercase font-semibold text-[10px] block tracking-wider">Language</span>
              <span className="font-semibold text-slate-900">{campaign.template_language || 'en_US'}</span>
            </div>
            <div className="w-px h-6 bg-slate-200" />
            <div>
              <span className="text-slate-400 uppercase font-semibold text-[10px] block tracking-wider">Target List</span>
              <span className="font-semibold text-[#534AB7]">{campaign.contact_list_name || 'Default Audience'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 8 Executive KPI Metric Cards (Interactive Filters) ────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {/* Card 1: TOTAL CONTACTS */}
        <div
          onClick={() => handleCardFilter('all')}
          title="Click to view all recipients"
          className={`shadcn-card p-4 flex flex-col justify-between cursor-pointer transition-all hover:border-slate-300 ${
            activeTab === 'all' ? 'ring-2 ring-[#534AB7]/30 border-[#534AB7]' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400">Total Contacts</span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-semibold text-xs">
              👥
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-bold text-slate-900 tabular-nums">{stats.total}</span>
            <p className="text-2xs text-slate-500 font-medium mt-1 truncate">
              Group: {campaign.contact_list_name || 'Contacts'}
            </p>
          </div>
        </div>

        {/* Card 2: SINGLE TICK SENT (Meta Dispatched) */}
        <div
          onClick={() => handleCardFilter('all')}
          title="Click to view sent messages"
          className="shadcn-card p-4 flex flex-col justify-between cursor-pointer transition-all hover:border-slate-300"
        >
          <div className="flex items-center justify-between">
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400">Single Tick Sent</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-semibold text-xs">
              ✓
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-bold text-slate-900 tabular-nums">{calcPct(stats.sent, stats.total)}</span>
            <p className="text-2xs text-slate-500 font-medium mt-1">{stats.sent} Messages</p>
          </div>
        </div>

        {/* Card 3: DOUBLE TICK DELIVERED (Handset Received) */}
        <div
          onClick={() => handleCardFilter('executed')}
          title="Click to view delivered recipients"
          className={`shadcn-card p-4 flex flex-col justify-between cursor-pointer transition-all hover:border-slate-300 ${
            activeTab === 'executed' ? 'ring-2 ring-emerald-500/30 border-emerald-500' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400">Double Tick Delivered</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
              ✓✓
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-bold text-slate-900 tabular-nums">{calcPct(stats.delivered, stats.total)}</span>
            <p className="text-2xs text-slate-500 font-medium mt-1">{stats.delivered} Contacts</p>
          </div>
        </div>

        {/* Card 4: TOTAL READ (Blue Ticks) */}
        <div
          onClick={() => handleCardFilter('executed')}
          title="Click to view read recipients"
          className={`shadcn-card p-4 flex flex-col justify-between cursor-pointer transition-all hover:border-slate-300 ${
            activeTab === 'executed' ? 'ring-2 ring-sky-500/30 border-sky-500' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400">Total Read</span>
            <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center font-semibold text-xs">
              👁
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-bold text-slate-900 tabular-nums">{calcPct(stats.read, stats.total)}</span>
            <p className="text-2xs text-slate-500 font-medium mt-1">{stats.read} Contacts</p>
          </div>
        </div>

        {/* Card 5: PROCESSING / QUEUED */}
        <div
          onClick={() => handleCardFilter('queued')}
          title="Click to view processing queue"
          className={`shadcn-card p-4 flex flex-col justify-between cursor-pointer transition-all hover:border-slate-300 ${
            activeTab === 'queued' ? 'ring-2 ring-amber-500/30 border-amber-500' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400">Processing</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
              ↻
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-bold text-slate-900 tabular-nums">{calcPct(stats.queued, stats.total)}</span>
            <p className="text-2xs text-slate-500 font-medium mt-1">{stats.queued} Messages</p>
          </div>
        </div>

        {/* Card 6: TOTAL META ACCEPTED */}
        <div
          onClick={() => handleCardFilter('executed')}
          title="Click to view accepted messages"
          className="shadcn-card p-4 flex flex-col justify-between cursor-pointer transition-all hover:border-slate-300"
        >
          <div className="flex items-center justify-between">
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400">Total Meta Accepted</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-semibold text-xs">
              ✓
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-bold text-slate-900 tabular-nums">{calcPct(stats.accepted, stats.total)}</span>
            <p className="text-2xs text-slate-500 font-medium mt-1">{stats.accepted} Messages</p>
          </div>
        </div>

        {/* Card 7: TOTAL FAILED */}
        <div
          onClick={() => handleCardFilter('failed')}
          title="Click to view failed recipients"
          className={`shadcn-card p-4 flex flex-col justify-between cursor-pointer transition-all hover:border-slate-300 ${
            activeTab === 'failed' ? 'ring-2 ring-rose-500/30 border-rose-500' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400">Total Failed</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-xs">
              !
            </div>
          </div>
          <div className="mt-2.5">
            <span className={`text-2xl font-bold tabular-nums ${stats.failed > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {calcPct(stats.failed, stats.total)}
            </span>
            <p className={`text-2xs font-medium mt-1 ${stats.failed > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
              {stats.failed} Contacts
            </p>
          </div>
        </div>

        {/* Card 8: OVERALL MESSAGE STATUS */}
        <div
          onClick={() => handleCardFilter('all')}
          title="Click to view all messages"
          className="shadcn-card p-4 flex flex-col justify-between cursor-pointer transition-all hover:border-slate-300"
        >
          <div className="flex items-center justify-between">
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-400">Overall Message Status</span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
              ≡
            </div>
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-bold text-slate-900 tabular-nums">
              {stats.total > 0 ? `${Math.min(100, Math.round(((stats.accepted + Math.min(stats.failed, stats.total - stats.accepted)) / stats.total) * 100))}%` : '0%'}
            </span>
            <p className="text-2xs text-slate-500 font-medium mt-1">Messages Processed</p>
          </div>
        </div>
      </div>

      {/* ── Status Lifecycle Legend Bar ───────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="shadcn-card p-3 rounded-xl flex items-start gap-2.5">
          <span className="w-2 h-2 rounded-full bg-amber-400 mt-1 shrink-0" />
          <div>
            <span className="text-xs font-semibold text-slate-900 block">Accepted</span>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Processing by WhatsApp</p>
          </div>
        </div>

        <div className="shadcn-card p-3 rounded-xl flex items-start gap-2.5">
          <span className="w-2 h-2 rounded-full bg-blue-500 mt-1 shrink-0" />
          <div>
            <span className="text-xs font-semibold text-slate-900 block">Sent</span>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Sent to Meta network</p>
          </div>
        </div>

        <div className="shadcn-card p-3 rounded-xl flex items-start gap-2.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1 shrink-0" />
          <div>
            <span className="text-xs font-semibold text-slate-900 block">Delivered</span>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Reached phone handset</p>
          </div>
        </div>

        <div className="shadcn-card p-3 rounded-xl flex items-start gap-2.5">
          <span className="w-2 h-2 rounded-full bg-sky-500 mt-1 shrink-0" />
          <div>
            <span className="text-xs font-semibold text-slate-900 block">Read</span>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Opened by recipient</p>
          </div>
        </div>

        <div className="shadcn-card p-3 rounded-xl flex items-start gap-2.5">
          <span className="w-2 h-2 rounded-full bg-rose-500 mt-1 shrink-0" />
          <div>
            <span className="text-xs font-semibold text-slate-900 block">Failed</span>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">Could not be delivered</p>
          </div>
        </div>
      </div>

      {/* ── Recipient Delivery Log Table ──────────────────────────────── */}
      <div ref={recipientTableRef} className="shadcn-card overflow-hidden scroll-mt-6">
        {/* Failed Recipient Action Banner */}
        {stats.failed > 0 && (
          <div className="bg-rose-50 border-b border-rose-200/80 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-rose-900 font-medium">
              <span className="w-5 h-5 rounded-full bg-rose-200 text-rose-700 flex items-center justify-center font-bold text-xs shrink-0">!</span>
              <span>
                <strong>{stats.failed} recipient(s)</strong> failed or were rate-limited in the delivery pipeline.
              </span>
            </div>
            <button
              onClick={handleRetryFailed}
              disabled={retrying}
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-xs transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <svg className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{retrying ? 'Queueing Retries...' : `Retry ${stats.failed} Failed Recipients Only`}</span>
            </button>
          </div>
        )}

        {/* Table Toolbar */}
        <div className="p-3.5 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 bg-white">
          {/* Segmented Tabs (Shadcn UI style) */}
          <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200/60">
            {[
              { key: 'all', label: 'All Recipients' },
              { key: 'executed', label: 'Delivered / Read' },
              { key: 'queued', label: 'In Queue' },
              { key: 'failed', label: 'Failed' },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  activeTab === t.key
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative min-w-[240px]">
            <input
              type="text"
              placeholder="Search recipient or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg focus:border-[#534AB7] focus:ring-2 focus:ring-[#534AB7]/10 outline-none text-slate-900 transition-colors"
            />
            <svg
              className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200/80 text-slate-500 text-[11px] font-semibold tracking-wider uppercase">
                <th className="py-2.5 px-4 font-semibold">Name</th>
                <th className="py-2.5 px-4 font-semibold">Phone Number</th>
                <th className="py-2.5 px-4 font-semibold">Message Delivery Status</th>
                <th className="py-2.5 px-4 font-semibold">Last Status Updated At</th>
                <th className="py-2.5 px-4 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredMessages.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    <p className="font-semibold text-slate-700">No recipient messages found.</p>
                    <p className="text-2xs text-slate-400 mt-1">
                      {searchTerm ? 'Try changing your search query.' : 'Messages will appear here as they are processed.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredMessages.map((m) => {
                  const cfg = STATUS_CFG[m.status] || STATUS_CFG.queued;
                  const displayName = m.display_name || `${m.first_name || ''} ${m.last_name || ''}`.trim() || '—';
                  const timestamp = m.read_at || m.delivered_at || m.sent_at || m.failed_at || m.updated_at || m.created_at;

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900">{displayName}</td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-600">{m.phone_e164}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-2xs font-semibold border"
                            style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}
                          >
                            <span>{cfg.icon}</span>
                            <span>{cfg.label}</span>
                          </span>
                          {m.status === 'failed' && m.last_error && (
                            <span className="text-[10px] text-rose-600 font-medium max-w-xs truncate" title={m.last_error}>
                              Error: {m.last_error}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-2xs font-normal">{fmtDate(timestamp)}</td>
                      <td className="py-3 px-4 text-right">
                        <a
                          href={`/inbox?phone=${encodeURIComponent(m.phone_e164)}`}
                          className="inline-flex items-center gap-1 text-2xs font-semibold text-[#534AB7] hover:text-[#4338CA] hover:underline"
                        >
                          Chat →
                        </a>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50/75 border-t border-slate-200/80 flex items-center justify-between text-2xs text-slate-500 font-normal">
          <span>
            Showing <strong className="font-semibold text-slate-700">{filteredMessages.length}</strong> of <strong className="font-semibold text-slate-700">{messages.length}</strong> recipients
          </span>
          <span>Auto-refreshes on status updates</span>
        </div>
      </div>
    </div>
  );
}
