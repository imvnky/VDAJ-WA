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
};

export default function CampaignDetailView({ campaignId, onBack, onNewCampaign }) {
  const [campaign, setCampaign] = useState(null);
  const [messages, setMessages] = useState([]);
  const [totalMessages, setTotalMessages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
      };
    }

    const counts = campaign.live_counts || {};
    const sent = counts.sent || campaign.sent_count || 0;
    const delivered = counts.delivered || campaign.delivered_count || 0;
    const read = counts.read || campaign.read_count || 0;
    const failed = counts.failed || campaign.failed_count || 0;
    const queued = counts.queued || campaign.queued_count || 0;
    const total = Math.max(campaign.total_count || 0, totalMessages, sent + delivered + read + failed + queued, 1);
    const accepted = sent + delivered + read;

    return {
      total: campaign.total_count || totalMessages || total,
      sent,
      delivered,
      read,
      failed,
      queued,
      accepted,
    };
  }, [campaign, totalMessages]);

  // Filtered recipient messages
  const filteredMessages = useMemo(() => {
    return messages.filter((m) => {
      // Tab filter
      if (activeTab === 'executed') {
        if (!['sent', 'delivered', 'read'].includes(m.status)) return false;
      } else if (activeTab === 'queued') {
        if (m.status !== 'queued') return false;
      } else if (activeTab === 'failed') {
        if (m.status !== 'failed') return false;
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
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-[#E6E4F5]">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all text-[#534AB7] bg-[#F3F2FD] hover:bg-[#E8E6F8] border border-[#AFA9EC]/40 shadow-xs cursor-pointer"
          >
            ← Back to Campaigns
          </button>
          <PrimaryButton
            onClick={onNewCampaign}
            size="sm"
            className="cursor-pointer"
            leftIcon={
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            }
          >
            Create New Campaign
          </PrimaryButton>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-gray-700 bg-white border border-[#E6E4F5] hover:bg-gray-50 shadow-xs transition-all cursor-pointer"
          >
            <svg
              className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#534AB7]' : 'text-gray-500'}`}
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#148059] bg-[#E8F9F4] border border-[#A3E4D0] hover:bg-[#D3F5EB] shadow-xs transition-all cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export Report (.csv)
          </button>
        </div>
      </div>

      {/* ── Campaign Metadata Header ───────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-6 border border-[#E6E4F5] shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">{campaign.name}</h1>
              <span
                className={`px-3 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                  campaign.status === 'completed'
                    ? 'bg-[#E8F9F4] text-[#148059] border border-[#A3E4D0]'
                    : campaign.status === 'running'
                    ? 'bg-[#F3F2FD] text-[#534AB7] border border-[#AFA9EC]'
                    : campaign.status === 'failed'
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-gray-100 text-gray-700 border border-gray-200'
                }`}
              >
                {campaign.status === 'completed' ? 'EXECUTED' : campaign.status}
              </span>
            </div>
            <p className="text-xs text-gray-500 font-medium">
              Started on: <span className="font-semibold text-gray-800">{fmtDate(campaign.started_at || campaign.created_at)}</span>
            </p>
          </div>

          <div className="flex items-center gap-6 text-xs text-gray-600 bg-[#F8FAFC] px-4 py-2.5 rounded-xl border border-gray-100">
            <div>
              <span className="text-gray-400 uppercase font-semibold text-[10px] block">Template Name</span>
              <span className="font-bold text-[#0F172A]">{campaign.template_name || '—'}</span>
            </div>
            <div className="w-px h-6 bg-gray-200" />
            <div>
              <span className="text-gray-400 uppercase font-semibold text-[10px] block">Language</span>
              <span className="font-bold text-[#0F172A]">{campaign.template_language || 'en_US'}</span>
            </div>
            <div className="w-px h-6 bg-gray-200" />
            <div>
              <span className="text-gray-400 uppercase font-semibold text-[10px] block">Target List</span>
              <span className="font-bold text-[#534AB7]">{campaign.contact_list_name || 'Default Audience'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 8 Executive KPI Metric Cards (Interactive Filters) ────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Card 1: TOTAL CONTACTS */}
        <div
          onClick={() => handleCardFilter('all')}
          title="Click to view all recipients"
          className={`bg-white rounded-2xl p-5 border shadow-xs flex flex-col justify-between cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] ${
            activeTab === 'all' ? 'border-[#534AB7] ring-2 ring-[#534AB7]/20 bg-[#FBFBFF]' : 'border-[#E6E4F5]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-gray-400">Total Contacts</span>
            <div className="w-7 h-7 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
              👤
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-[#0F172A] tabular-nums">{stats.total}</span>
            <p className="text-2xs text-[#16A34A] font-medium mt-1 truncate">
              Group: {campaign.contact_list_name || 'Contacts'}
            </p>
          </div>
        </div>

        {/* Card 2: SINGLE TICK SENT (Meta Dispatched) */}
        <div
          onClick={() => handleCardFilter('all')}
          title="Click to view sent messages"
          className="bg-white rounded-2xl p-5 border border-[#E6E4F5] shadow-xs flex flex-col justify-between cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99]"
        >
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-gray-400">Total Single Tick Sent</span>
            <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              ✓
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-[#0F172A] tabular-nums">{calcPct(stats.sent, stats.total)}</span>
            <p className="text-2xs text-gray-500 font-medium mt-1">{stats.sent} Messages</p>
          </div>
        </div>

        {/* Card 3: DOUBLE TICK DELIVERED (Handset Received) */}
        <div
          onClick={() => handleCardFilter('executed')}
          title="Click to view delivered recipients"
          className={`bg-white rounded-2xl p-5 border shadow-xs flex flex-col justify-between cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] ${
            activeTab === 'executed' ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20' : 'border-[#E6E4F5]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-gray-400">Total Double Tick Delivered</span>
            <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              ✓✓
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-[#0F172A] tabular-nums">{calcPct(stats.delivered, stats.total)}</span>
            <p className="text-2xs text-gray-500 font-medium mt-1">{stats.delivered} Contacts</p>
          </div>
        </div>

        {/* Card 4: TOTAL READ (Blue Ticks) */}
        <div
          onClick={() => handleCardFilter('executed')}
          title="Click to view read recipients"
          className={`bg-white rounded-2xl p-5 border shadow-xs flex flex-col justify-between cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] ${
            activeTab === 'executed' ? 'border-sky-500 ring-2 ring-sky-500/20 bg-sky-50/20' : 'border-[#E6E4F5]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-gray-400">Total Read</span>
            <div className="w-7 h-7 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
              👁️
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-[#0F172A] tabular-nums">{calcPct(stats.read, stats.total)}</span>
            <p className="text-2xs text-gray-500 font-medium mt-1">{stats.read} Contacts</p>
          </div>
        </div>

        {/* Card 5: PROCESSING / QUEUED */}
        <div
          onClick={() => handleCardFilter('queued')}
          title="Click to view processing queue"
          className={`bg-white rounded-2xl p-5 border shadow-xs flex flex-col justify-between cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] ${
            activeTab === 'queued' ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/20' : 'border-[#E6E4F5]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-gray-400">Processing</span>
            <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              ↻
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-[#0F172A] tabular-nums">{calcPct(stats.queued, stats.total)}</span>
            <p className="text-2xs text-gray-500 font-medium mt-1">{stats.queued} Messages</p>
          </div>
        </div>

        {/* Card 6: TOTAL META ACCEPTED */}
        <div
          onClick={() => handleCardFilter('executed')}
          title="Click to view accepted messages"
          className="bg-white rounded-2xl p-5 border border-[#E6E4F5] shadow-xs flex flex-col justify-between cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99]"
        >
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-gray-400">Total Meta Accepted</span>
            <div className="w-7 h-7 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              ✓
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-[#0F172A] tabular-nums">{calcPct(stats.accepted, stats.total)}</span>
            <p className="text-2xs text-gray-500 font-medium mt-1">{stats.accepted} Messages</p>
          </div>
        </div>

        {/* Card 7: TOTAL FAILED */}
        <div
          onClick={() => handleCardFilter('failed')}
          title="Click to view failed recipients"
          className={`bg-white rounded-2xl p-5 border shadow-xs flex flex-col justify-between cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] ${
            activeTab === 'failed' ? 'border-[#DC2626] ring-2 ring-red-500/20 bg-red-50/30' : 'border-[#E6E4F5]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-gray-400">Total Failed</span>
            <div className="w-7 h-7 rounded-full bg-red-50 text-red-600 flex items-center justify-center font-bold">
              !
            </div>
          </div>
          <div className="mt-3">
            <span className={`text-2xl font-black tabular-nums ${stats.failed > 0 ? 'text-[#DC2626]' : 'text-[#0F172A]'}`}>
              {calcPct(stats.failed, stats.total)}
            </span>
            <p className={`text-2xs font-medium mt-1 ${stats.failed > 0 ? 'text-[#DC2626]' : 'text-gray-500'}`}>
              {stats.failed} Contacts
            </p>
          </div>
        </div>

        {/* Card 8: OVERALL MESSAGE STATUS */}
        <div
          onClick={() => handleCardFilter('all')}
          title="Click to view all messages"
          className="bg-white rounded-2xl p-5 border border-[#E6E4F5] shadow-xs flex flex-col justify-between cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99]"
        >
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-gray-400">Overall Message Status</span>
            <div className="w-7 h-7 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
              ≡
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-[#0F172A] tabular-nums">
              {stats.total > 0 ? `${Math.round(((stats.accepted + stats.failed) / stats.total) * 100)}%` : '0%'}
            </span>
            <p className="text-2xs text-gray-500 font-medium mt-1">Messages Processed</p>
          </div>
        </div>
      </div>

      {/* ── Status Lifecycle Legend Bar ───────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-2xs">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="text-xs font-bold text-gray-800">Accepted</span>
          </div>
          <p className="text-2xs text-gray-500">Your message is being processed by WhatsApp.</p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-2xs">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span className="text-xs font-bold text-gray-800">Sent</span>
          </div>
          <p className="text-2xs text-gray-500">Your message has been sent successfully.</p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-2xs">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-xs font-bold text-gray-800">Delivered</span>
          </div>
          <p className="text-2xs text-gray-500">Your message has reached the recipient's phone.</p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-2xs">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
            <span className="text-xs font-bold text-gray-800">Read</span>
          </div>
          <p className="text-2xs text-gray-500">The recipient has opened and seen your message.</p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-gray-100 shadow-2xs">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="text-xs font-bold text-gray-800">Failed</span>
          </div>
          <p className="text-2xs text-gray-500">The message couldn't be delivered to recipient.</p>
        </div>
      </div>

      {/* ── Recipient Delivery Log Table ──────────────────────────────── */}
      <div ref={recipientTableRef} className="bg-white rounded-2xl border border-[#E6E4F5] shadow-xs overflow-hidden scroll-mt-6">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-[#E6E4F5] flex flex-wrap items-center justify-between gap-4 bg-[#F8FAFC]">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-white rounded-xl border border-gray-200 shadow-2xs">
            {[
              { key: 'all', label: 'All Recipients' },
              { key: 'executed', label: 'Delivered / Read' },
              { key: 'queued', label: 'In Queue' },
              { key: 'failed', label: 'Failed' },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === t.key
                    ? 'bg-[#534AB7] text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
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
              className="w-full h-9 pl-9 pr-3 text-xs bg-white border border-gray-200 rounded-xl focus:border-[#534AB7] focus:ring-2 focus:ring-[#534AB7]/10 outline-none text-[#0F172A]"
            />
            <svg
              className="w-4 h-4 text-gray-400 absolute left-3 top-2.5"
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
              <tr className="bg-[#1E293B] text-white text-2xs uppercase tracking-wider font-extrabold">
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Phone Number</th>
                <th className="py-3 px-4">Message Delivery Status</th>
                <th className="py-3 px-4">Last Status Updated At</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {filteredMessages.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-500">
                    <p className="font-semibold">No recipient messages found.</p>
                    <p className="text-2xs text-gray-400 mt-1">
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
                    <tr key={m.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-[#0F172A]">{displayName}</td>
                      <td className="py-3 px-4 font-mono font-medium text-gray-600">{m.phone_e164}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-2xs font-extrabold border"
                            style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}
                          >
                            <span>{cfg.icon}</span>
                            <span>{cfg.label}</span>
                          </span>
                          {m.status === 'failed' && m.last_error && (
                            <span className="text-[10px] text-red-600 font-medium max-w-xs truncate" title={m.last_error}>
                              Error: {m.last_error}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-2xs font-medium">{fmtDate(timestamp)}</td>
                      <td className="py-3 px-4 text-right">
                        <a
                          href={`/inbox?phone=${encodeURIComponent(m.phone_e164)}`}
                          className="inline-flex items-center gap-1 text-2xs font-bold text-[#534AB7] hover:underline"
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
        <div className="p-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-2xs text-gray-500 font-medium">
          <span>
            Showing <strong>{filteredMessages.length}</strong> of <strong>{messages.length}</strong> recipients
          </span>
          <span>Auto-refreshes on status updates</span>
        </div>
      </div>
    </div>
  );
}
