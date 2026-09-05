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
      {/* Bell Trigger Button */}
      <button
        id="notification-bell-btn"
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          "relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-150 cursor-pointer",
          open
            ? "bg-indigo-50 border-indigo-200 text-indigo-700 shadow-xs"
            : "bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 shadow-2xs"
        )}
        aria-label={`Notifications${hasUnread ? ` (${unreadCount} unread)` : ''}`}
        title="Notifications"
      >
        <svg
          className="w-4.5 h-4.5 transition-transform duration-150 group-hover:scale-105"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Unread Badge */}
        {hasUnread && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-600 text-white font-extrabold text-[10px] flex items-center justify-center ring-2 ring-white animate-scale-in">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div
          className="absolute right-0 top-12 w-[390px] sm:w-[430px] rounded-2xl bg-white border border-slate-200/90 shadow-2xl overflow-hidden z-50 animate-scale-in"
          style={{ transformOrigin: 'top right' }}
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between px-4 py-3.5 bg-slate-50/90 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-extrabold text-slate-900 tracking-tight">
                Notifications
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Sync
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              {hasUnread && (
                <button
                  onClick={markAllRead}
                  className="font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer flex items-center gap-1 hover:underline"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="font-medium text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                  title="Clear all notifications"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Interactive Category Filter Tabs */}
          <div className="flex items-center gap-1.5 px-3 py-2 bg-white border-b border-slate-100 overflow-x-auto text-xs no-scrollbar">
            {[
              { id: 'all',      label: 'All',       count: notifications.length },
              { id: 'unread',   label: 'Unread',    count: unreadCount, badge: true },
              { id: 'message',  label: 'Messages',  icon: '💬' },
              { id: 'campaign', label: 'Campaigns', icon: '📢' },
              { id: 'system',   label: 'System',    icon: '⚡' },
            ].map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    "flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition-all shrink-0 cursor-pointer",
                    active
                      ? "bg-slate-900 text-white shadow-2xs"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  {tab.icon && <span className="text-[11px]">{tab.icon}</span>}
                  <span>{tab.label}</span>
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className={clsx(
                      "text-[9.5px] px-1.5 py-0.2 rounded-full font-bold leading-tight",
                      active
                        ? "bg-white/20 text-white"
                        : (tab.badge ? "bg-indigo-100 text-indigo-700 font-extrabold" : "bg-slate-100 text-slate-500")
                    )}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto max-h-[380px] divide-y divide-slate-100 bg-white">
            {filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-3 shadow-2xs">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <p className="text-sm font-bold text-slate-900">All caught up!</p>
                <p className="text-xs text-slate-500 mt-1 max-w-[260px] leading-relaxed">
                  {activeTab === 'unread'
                    ? 'No unread notifications to review right now.'
                    : 'Real-time updates for WhatsApp messages, broadcasts, and Meta API events will appear here.'}
                </p>
                <div className="mt-4 flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Meta Cloud API Connected</span>
                </div>
              </div>
            ) : (
              filteredNotifications.map((n) => {
                const cfg = NOTIF_TYPES[n.type] || NOTIF_TYPES.system;
                return (
                  <div
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={clsx(
                      "group flex items-start gap-3 px-4 py-3.5 transition-colors duration-150 cursor-pointer",
                      !n.read ? "bg-indigo-50/35 hover:bg-indigo-50/60" : "hover:bg-slate-50/80"
                    )}
                  >
                    {/* Left Type Icon Box */}
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 text-sm shadow-2xs select-none"
                      style={{ background: cfg.bg, color: cfg.color }}
                    >
                      {cfg.icon}
                    </div>

                    {/* Notification Body */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={clsx(
                          "text-xs truncate font-bold",
                          n.read ? "text-slate-700" : "text-slate-900"
                        )}>
                          {n.title}
                        </p>
                        <span className="text-[11px] text-slate-400 font-medium shrink-0">
                          {timeAgo(n.createdAt)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 mt-0.5 line-clamp-2 leading-relaxed">
                        {n.body}
                      </p>

                      {/* Action Pill / Read status */}
                      <div className="flex items-center justify-between mt-2">
                        {n.url ? (
                          <span className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5">
                            <span>Open details</span>
                            <span>→</span>
                          </span>
                        ) : <span />}

                        {!n.read && (
                          <span className="w-2 h-2 rounded-full bg-indigo-600 ring-2 ring-indigo-200" title="Unread" />
                        )}
                      </div>
                    </div>

                    {/* Dismiss Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(n.id);
                      }}
                      className="opacity-0 group-hover:opacity-60 hover:!opacity-100 shrink-0 p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-200/50 transition-all"
                      title="Dismiss"
                      aria-label="Dismiss notification"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Bar */}
          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
            <button
              onClick={() => {
                navigate('/logs');
                setOpen(false);
              }}
              className="font-semibold text-slate-700 hover:text-indigo-600 transition-colors flex items-center gap-1"
            >
              <span>View Full Message Logs</span>
              <span>→</span>
            </button>
            <span className="text-[11px] text-slate-400">
              {notifications.length} item{notifications.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
