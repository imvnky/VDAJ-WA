/**
 * VDAJ Services — NotificationBell (frontend/src/components/NotificationBell.jsx)
 *
 * Topbar bell that listens to the shared WebSocket and surfaces:
 *  1. New inbound WhatsApp messages
 *  2. WABA quality rating drops (YELLOW / RED)
 *  3. Campaign completions (status → completed / failed)
 *  4. Template status changes (approved / rejected by Meta)
 *
 * Uses notificationStore (Zustand) for state + showBrowserNotification for OS-level alerts.
 */

import React, { useState, useEffect, useRef } from 'react';
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
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

// ── WS Event → Notification mapper ───────────────────────────
function mapWsEventToNotification(payload) {
  const { type, data = {} } = payload;

  switch (type) {
    // ── 1. New inbound WhatsApp message ──────────────────────
    case 'new_message': {
      if (data.direction !== 'inbound') return null;
      const from = data.display_name || data.phone_e164 || 'Customer';
      return {
        type:  'message',
        title: `💬 New message from ${from}`,
        body:  (data.body || '(media)').slice(0, 120),
        url:   '/inbox',
        browserTitle: `New message from ${from}`,
        browserBody:  (data.body || '(media)').slice(0, 100),
      };
    }

    // ── 2. WABA quality rating drop ───────────────────────────
    case 'waba_quality_changed': {
      const rating = (data.quality_rating || '').toUpperCase();
      if (rating === 'GREEN') return null; // No alert on upgrade
      const isRed = rating === 'RED';
      return {
        type:  'warning',
        title: `${isRed ? '🔴' : '🟡'} WABA Quality ${isRed ? 'Critical' : 'Warning'}`,
        body:  isRed
          ? 'Your quality rating dropped to RED. Pause marketing campaigns immediately.'
          : 'Your quality rating dropped to YELLOW. Review your template opt-out rates.',
        url:   '/settings',
        browserTitle: `WABA Quality ${isRed ? 'RED' : 'YELLOW'}`,
        browserBody:  isRed
          ? 'Action required — quality rating is RED.'
          : 'Warning — quality rating is YELLOW.',
      };
    }

    // ── 3. Campaign completion ────────────────────────────────
    case 'campaign_status': {
      const status = (data.status || '').toLowerCase();
      if (!['completed', 'failed'].includes(status)) return null;
      const isFailed = status === 'failed';
      return {
        type:  isFailed ? 'error' : 'campaign',
        title: isFailed
          ? `❌ Campaign Failed: ${data.campaign_name || data.campaign_id}`
          : `✅ Campaign Complete: ${data.campaign_name || data.campaign_id}`,
        body:  isFailed
          ? `Sending failed. Check the campaign logs for details.`
          : `${data.total_sent ?? '—'} messages sent · ${data.total_failed ?? 0} failed.`,
        url:   '/campaigns',
        browserTitle: isFailed ? 'Campaign Failed' : 'Campaign Complete',
        browserBody:  isFailed ? 'A campaign failed to send.' : 'Campaign finished sending.',
      };
    }

    // ── 4. Template approval / rejection ─────────────────────
    case 'template_status': {
      const status = (data.status || '').toLowerCase();
      if (!['approved', 'rejected'].includes(status)) return null;
      const isApproved = status === 'approved';
      return {
        type:  isApproved ? 'system' : 'error',
        title: isApproved
          ? `✅ Template Approved: ${data.template_name}`
          : `❌ Template Rejected: ${data.template_name}`,
        body:  isApproved
          ? 'The template is now ready to use in campaigns.'
          : `Reason: ${data.rejection_reason || 'See templates page for details.'}`,
        url:   '/templates',
        browserTitle: isApproved ? 'Template Approved by Meta' : 'Template Rejected by Meta',
        browserBody:  isApproved ? `${data.template_name} is ready.` : `${data.template_name} was rejected.`,
      };
    }

    default:
      return null;
  }
}

// ── useNotificationWS — WebSocket bridge hook ─────────────────
export function useNotificationWS() {
  const { user }    = useAuthStore();
  const push        = useNotificationStore((s) => s.push);

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

            // In-app notification
            push({ type: notif.type, title: notif.title, body: notif.body, url: notif.url });

            // OS-level browser notification
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

// ── NotificationBell UI component ────────────────────────────
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef        = useRef(null);
  const navigate        = useNavigate();

  const { notifications, unreadCount, markRead, markAllRead, remove, clearAll } =
    useNotificationStore();

  // Close on outside click
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
    if (notif.url) { navigate(notif.url); setOpen(false); }
  };

  const hasUnread = unreadCount > 0;

  return (
    <div className="relative" ref={panelRef}>

      {/* ── Bell button ── */}
      <button
        id="notification-bell-btn"
        onClick={() => setOpen((o) => !o)}
        className="relative flex items-center justify-center w-9 h-9 rounded-xl transition-all hover:opacity-80"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}
        aria-label={`Notifications${hasUnread ? ` (${unreadCount} unread)` : ''}`}
      >
        {/* Bell SVG */}
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          style={{ color: hasUnread ? '#AFA9EC' : 'var(--text-muted)' }}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>

        {/* Unread badge */}
        {hasUnread && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full flex items-center justify-center font-black text-white"
            style={{ background: '#534AB7', fontSize: '10px', padding: '0 4px', lineHeight: 1 }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div
          className="absolute right-0 top-11 w-[340px] rounded-2xl shadow-2xl overflow-hidden z-50"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--bg-border)',
            animation: 'fadeIn 0.12s ease-out',
          }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: 'var(--bg-border)', background: 'var(--bg-elevated)' }}>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                Notifications
              </span>
              {hasUnread && (
                <span className="text-2xs font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(83,74,183,0.15)', color: '#AFA9EC' }}>
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex gap-3">
              {hasUnread && (
                <button onClick={markAllRead}
                  className="text-2xs font-semibold transition-opacity hover:opacity-70"
                  style={{ color: '#AFA9EC' }}>
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button onClick={clearAll}
                  className="text-2xs font-semibold transition-opacity hover:opacity-70"
                  style={{ color: 'var(--text-muted)' }}>
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* Source legend (compact) */}
          <div className="flex items-center gap-3 px-4 py-2 border-b flex-wrap"
            style={{ borderColor: 'var(--bg-border)', background: 'var(--bg-base)' }}>
            {[
              { label: 'Messages',  color: '#534AB7' },
              { label: 'Campaigns', color: '#1D9E75' },
              { label: 'Templates', color: '#AFA9EC' },
              { label: 'WABA',      color: '#f59e0b' },
            ].map(({ label, color }) => (
              <span key={label} className="flex items-center gap-1 text-2xs"
                style={{ color: 'var(--text-muted)' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                {label}
              </span>
            ))}
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-[360px] divide-y" style={{ borderColor: 'var(--bg-border)' }}>
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <svg className="w-10 h-10 opacity-10" fill="none" viewBox="0 0 24 24"
                  stroke="currentColor" strokeWidth={1.2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>All caught up!</p>
                <p className="text-2xs" style={{ color: 'var(--text-muted)' }}>
                  New messages, quality alerts, and campaign updates will appear here.
                </p>
              </div>
            ) : (
              notifications.map((n) => {
                const cfg = NOTIF_TYPES[n.type] || NOTIF_TYPES.system;
                return (
                  <div
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={clsx(
                      'group flex items-start gap-3 px-4 py-3 transition-all',
                      n.url && 'cursor-pointer',
                      !n.read && 'border-l-2'
                    )}
                    style={{
                      background: n.read ? 'transparent' : 'rgba(83,74,183,0.04)',
                      borderLeftColor: !n.read ? cfg.color : 'transparent',
                    }}
                  >
                    {/* Icon */}
                    <span className="text-base shrink-0 mt-0.5 leading-none select-none"
                      aria-hidden="true">
                      {cfg.icon}
                    </span>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold"
                        style={{ color: n.read ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                        {n.title}
                      </p>
                      <p className="text-xs mt-0.5 line-clamp-2"
                        style={{ color: 'var(--text-secondary)' }}>
                        {n.body}
                      </p>
                      <p className="text-2xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        {timeAgo(n.createdAt)}
                      </p>
                    </div>

                    {/* Dismiss */}
                    <button
                      onClick={(e) => { e.stopPropagation(); remove(n.id); }}
                      className="opacity-0 group-hover:opacity-60 hover:!opacity-100 shrink-0 transition-opacity mt-0.5"
                      aria-label="Dismiss notification">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"
                        stroke="currentColor" strokeWidth={2.5}
                        style={{ color: 'var(--text-muted)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer link */}
          {notifications.length > 0 && (
            <div className="border-t px-4 py-2 text-center"
              style={{ borderColor: 'var(--bg-border)', background: 'var(--bg-elevated)' }}>
              <button
                onClick={() => { navigate('/logs'); setOpen(false); }}
                className="text-2xs font-semibold hover:opacity-70 transition-opacity"
                style={{ color: '#AFA9EC' }}>
                View full activity log →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
