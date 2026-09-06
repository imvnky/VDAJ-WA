/**
 * VDAJ Services — NotificationBell (frontend/src/components/NotificationBell.jsx)
 *
 * MNC-Grade Executive Notification Center:
 *  - Interactive Category Tabs (All, Unread, Messages, Campaigns, System)
 *  - Real-time Live Status Pulse with WebSocket integration
 *  - Rich Notification Cards with Category Badges & Direct Action Links
 *  - One-click "Mark All Read" & "Clear All"
 *  - Responsive Elevated Dropdown (w-[420px])
 *  - Seamless Local Persistence via notificationStore
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import useAuthStore from '../store/authStore';
import useNotificationStore, { NOTIF_TYPES } from '../store/notificationStore';
import { WS_BASE } from '../lib/api';
import { showBrowserNotification } from '../lib/pwa';

// ── Relative time helper ──────────────────────────────────────
function timeAgo(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

// ── WS Event → Notification mapper ───────────────────────────
function mapWsEventToNotification(payload) {
  const { type, data = {} } = payload;

  switch (type) {
    // ── 1. Inbound message ──────────────────────
    case 'new_message': {
      if (data.direction !== 'inbound') return null;
      const from = data.display_name || data.phone_e164 || 'Customer';
      return {
        type:  'message',
        title: `New message from ${from}`,
        body:  (data.body || '(Media attachment)').slice(0, 120),
        url:   '/inbox',
        browserTitle: `New message from ${from}`,
        browserBody:  (data.body || '(Media attachment)').slice(0, 100),
      };
    }

    // ── 2. WABA quality rating ───────────────────
    case 'waba_quality_changed': {
      const rating = (data.quality_rating || '').toUpperCase();
      if (rating === 'GREEN') return null;
      const isRed = rating === 'RED';
      return {
        type:  'warning',
        title: `WABA Quality: ${isRed ? 'Critical Alert' : 'Quality Warning'}`,
        body:  isRed
          ? 'Quality rating dropped to RED. Pause non-essential marketing broadcasts immediately.'
          : 'Quality rating dropped to YELLOW. Review template opt-out rates and recipient feedback.',
        url:   '/settings',
        browserTitle: `WABA Quality ${isRed ? 'RED' : 'YELLOW'}`,
        browserBody:  isRed ? 'Action required — quality rating is RED.' : 'Warning — quality rating is YELLOW.',
      };
    }

    // ── 3. Campaign completion ────────────────────
    case 'campaign_status': {
      const status = (data.status || '').toLowerCase();
      if (!['completed', 'failed'].includes(status)) return null;
      const isFailed = status === 'failed';
      return {
        type:  isFailed ? 'error' : 'campaign',
        title: isFailed
          ? `Campaign Failed: ${data.campaign_name || data.campaign_id}`
          : `Campaign Complete: ${data.campaign_name || data.campaign_id}`,
        body:  isFailed
          ? `Broadcast could not complete. Check message delivery logs for details.`
          : `${data.total_sent ?? '—'} messages dispatched · ${data.total_failed ?? 0} errors.`,
        url:   '/campaigns',
        browserTitle: isFailed ? 'Campaign Failed' : 'Campaign Complete',
        browserBody:  isFailed ? 'A campaign failed to send.' : 'Campaign finished sending.',
      };
    }

    // ── 4. Template status ─────────────────────────
    case 'template_status': {
      const status = (data.status || '').toLowerCase();
      if (!['approved', 'rejected'].includes(status)) return null;
      const isApproved = status === 'approved';
      return {
        type:  isApproved ? 'system' : 'error',
        title: isApproved
          ? `Template Approved: ${data.template_name}`
          : `Template Rejected: ${data.template_name}`,
        body:  isApproved
          ? 'Approved by Meta. Template is now live and ready for broadcast campaigns.'
          : `Rejected by Meta: ${data.rejection_reason || 'Policy compliance issue.'}`,
        url:   '/templates',
        browserTitle: isApproved ? 'Template Approved' : 'Template Rejected',
        browserBody:  isApproved ? `${data.template_name} approved.` : `${data.template_name} rejected.`,
      };
    }

    default:
      return null;
  }
}

// ── WebSocket bridge hook ─────────────────────────────────────
export function useNotificationWS() {
  const { user } = useAuthStore();
  const push     = useNotificationStore((s) => s.push);

  useEffect(() => {
    if (!user?.tenantId) return;
    let ws;
    let retryTimer;

    const connect = () => {
      try {
        ws = new WebSocket(`${WS_BASE}/ws/inbox?tenantId=${user.tenantId}`);

        ws.onmessage = (e) => {
          try {
            const payload = JSON.parse(e.data);
            const notif = mapWsEventToNotification(payload);
            if (!notif) return;

            push({ type: notif.type, title: notif.title, body: notif.body, url: notif.url });
            showBrowserNotification(notif.browserTitle, notif.browserBody, notif.url);
          } catch {}
        };

        ws.onclose = () => {
          retryTimer = setTimeout(connect, 6000);
        };
      } catch {}
    };

    connect();
    return () => {
      ws?.close();
      clearTimeout(retryTimer);
    };
  }, [user?.tenantId]); // eslint-disable-line
}

// ── Clean SVG Icons for Notification Types ───────────────────
function NotifIcon({ type }) {
  switch (type) {
    case 'message':
      return (
        <svg className="w-4 h-4 text-[#534AB7]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      );
    case 'campaign':
      return (
        <svg className="w-4 h-4 text-[#1D9E75]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
        </svg>
      );
    case 'warning':
      return (
        <svg className="w-4 h-4 text-[#D97706]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      );
    case 'error':
      return (
        <svg className="w-4 h-4 text-[#DC2626]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'compliance':
      return (
        <svg className="w-4 h-4 text-[#0284C7]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      );
    case 'system':
    default:
      return (
        <svg className="w-4 h-4 text-[#4F46E5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
  }
}

// ── Main UI Component ─────────────────────────────────────────
export default function NotificationBell() {
  const [open, setOpen]         = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'unread' | 'message' | 'campaign' | 'system'
  const panelRef                = useRef(null);
  const navigate                = useNavigate();

  const { notifications, unreadCount, markRead, markAllRead, remove, clearAll } =
    useNotificationStore();

  // Close when clicked outside
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleClick = (notif) => {
    markRead(notif.id);
    if (notif.url) {
      navigate(notif.url);
      setOpen(false);
    }
  };

  const hasUnread = unreadCount > 0;

  // Filter items based on active tab
  const filteredNotifications = useMemo(() => {
    if (activeTab === 'unread') {
      return notifications.filter((n) => !n.read);
    }
    if (activeTab === 'message') {
      return notifications.filter((n) => n.type === 'message');
    }
    if (activeTab === 'campaign') {
      return notifications.filter((n) => n.type === 'campaign' || n.type === 'error');
    }
    if (activeTab === 'system') {
      return notifications.filter((n) => n.type === 'system' || n.type === 'warning' || n.type === 'compliance');
    }
    return notifications;
  }, [notifications, activeTab]);

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Trigger Button — MNC Grade Minimal & Consistent */}
      <button
        id="notification-bell-btn"
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          "relative flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-150 cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-[#534AB7]/20",
          open
            ? "bg-[#EEECFC] border border-[#534AB7]/40 text-[#534AB7]"
            : "bg-white hover:bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#CBD5E1] text-[#475569] hover:text-[#0F172A]"
        )}
        aria-label={`Notifications${hasUnread ? ` (${unreadCount} unread)` : ''}`}
        title="Notifications"
      >
        <svg
          className="w-[17px] h-[17px] transition-colors"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>

        {/* Minimal MNC Badge */}
        {hasUnread && (
          <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 rounded-full bg-[#534AB7] text-white font-bold text-[9px] leading-none flex items-center justify-center ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div
          className="absolute right-0 top-11 w-[380px] sm:w-[410px] rounded-xl bg-white border border-[#E2E8F0] shadow-[0_12px_32px_-4px_rgba(15,23,42,0.12),0_4px_12px_-2px_rgba(15,23,42,0.04)] overflow-hidden z-50 animate-scale-in"
          style={{ transformOrigin: 'top right' }}
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-[#F1F5F9]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#0F172A] tracking-tight">
                Notifications
              </span>
              {hasUnread && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#EEECFC] text-[#534AB7]">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs">
              {hasUnread && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="font-medium text-[#534AB7] hover:text-[#3B3499] transition-colors cursor-pointer hover:underline"
                >
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="font-medium text-[#94A3B8] hover:text-[#DC2626] transition-colors cursor-pointer"
                  title="Clear all notifications"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* Clean Segmented Category Tabs — MNC Standard */}
          <div className="flex items-center gap-0.5 p-1 mx-3 my-2 bg-[#F1F5F9] rounded-lg text-xs">
            {[
              { id: 'all',      label: 'All',       count: notifications.length },
              { id: 'unread',   label: 'Unread',    count: unreadCount, badge: true },
              { id: 'message',  label: 'Messages' },
              { id: 'campaign', label: 'Campaigns' },
              { id: 'system',   label: 'System' },
            ].map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    "flex-1 flex items-center justify-center gap-1.5 py-1 px-1 rounded-md text-xs transition-all cursor-pointer select-none",
                    active
                      ? "bg-white text-[#0F172A] font-semibold shadow-xs"
                      : "text-[#64748B] hover:text-[#0F172A] font-medium"
                  )}
                >
                  <span>{tab.label}</span>
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className={clsx(
                      "text-[10px] px-1.5 py-0.2 rounded-full font-bold leading-tight",
                      active
                        ? "bg-[#EEECFC] text-[#534AB7]"
                        : "bg-[#E2E8F0] text-[#64748B]"
                    )}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto max-h-[360px] divide-y divide-[#F1F5F9] bg-white">
            {filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <div className="w-10 h-10 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center text-[#94A3B8] mb-2.5">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                  </svg>
                </div>
                <p className="text-xs font-semibold text-[#0F172A]">No notifications</p>
                <p className="text-[11px] text-[#64748B] mt-0.5 max-w-[220px]">
                  {activeTab === 'unread' ? 'All notifications have been read.' : 'You are all caught up.'}
                </p>
              </div>
            ) : (
              filteredNotifications.map((n) => {
                const cfg = NOTIF_TYPES[n.type] || NOTIF_TYPES.system;
                return (
                  <div
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={clsx(
                      "group relative flex items-start gap-3 px-4 py-3 transition-colors duration-150 cursor-pointer",
                      !n.read ? "bg-[#FBFBFF] hover:bg-[#F3F2FD]/50" : "bg-white hover:bg-[#F8FAFC]"
                    )}
                  >
                    {/* Unread Accent Bar */}
                    {!n.read && (
                      <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#534AB7]" />
                    )}

                    {/* Clean SVG Icon Box */}
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: cfg.bg }}
                    >
                      <NotifIcon type={n.type} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={clsx(
                          "text-xs truncate",
                          !n.read ? "font-semibold text-[#0F172A]" : "font-medium text-[#334155]"
                        )}>
                          {n.title}
                        </p>
                        <span className="text-[10px] text-[#94A3B8] shrink-0">
                          {timeAgo(n.createdAt)}
                        </span>
                      </div>

                      <p className="text-xs text-[#64748B] mt-0.5 line-clamp-2 leading-relaxed">
                        {n.body}
                      </p>

                      {n.url && (
                        <div className="mt-1.5">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#534AB7] hover:underline">
                            View details
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Dismiss Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(n.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-[#94A3B8] hover:text-[#DC2626] rounded-md transition-all shrink-0"
                      title="Dismiss"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Bar */}
          <div className="px-4 py-2.5 bg-[#FAFAFC] border-t border-[#F1F5F9] flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                navigate('/logs');
                setOpen(false);
              }}
              className="font-semibold text-[#534AB7] hover:text-[#3B3499] transition-colors inline-flex items-center gap-1"
            >
              <span>Message Logs</span>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <span className="text-[11px] text-[#94A3B8]">
              {notifications.length} item{notifications.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
