/**
 * VDAJ Services — NotificationBell
 *
 * Topbar bell icon with:
 *  - Animated unread badge
 *  - Dropdown panel listing notifications
 *  - Mark all read / clear all
 *  - Per-notification click → navigate to URL
 *  - Dismiss (×) individual items
 */

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import useNotificationStore, { NOTIF_TYPES } from '../../store/notificationStore';

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function NotificationBell() {
  const [open, setOpen]     = useState(false);
  const panelRef            = useRef(null);
  const navigate            = useNavigate();
  const { notifications, unreadCount, markRead, markAllRead, remove, clearAll } =
    useNotificationStore();

  // Close panel when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleNotifClick = (notif) => {
    markRead(notif.id);
    if (notif.url) { navigate(notif.url); setOpen(false); }
  };

  const hasUnread = unreadCount > 0;

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex items-center justify-center w-9 h-9 rounded-xl transition-all hover:opacity-80"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}
        aria-label={`Notifications${hasUnread ? ` (${unreadCount} unread)` : ''}`}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"
          stroke="currentColor" strokeWidth={2}
          style={{ color: hasUnread ? '#AFA9EC' : 'var(--text-muted)' }}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>

        {/* Unread badge */}
        {hasUnread && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-2xs font-black text-white"
            style={{ background: '#534AB7', fontSize: '10px', padding: '0 4px' }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute right-0 top-11 w-80 rounded-2xl shadow-2xl overflow-hidden z-50"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--bg-border)',
            animation: 'fadeIn 0.15s ease-out',
          }}>

          {/* Panel header */}
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
            <div className="flex items-center gap-2">
              {hasUnread && (
                <button
                  onClick={markAllRead}
                  className="text-2xs font-semibold hover:opacity-70 transition-opacity"
                  style={{ color: '#AFA9EC' }}>
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-2xs font-semibold hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--text-muted)' }}>
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-80 divide-y" style={{ borderColor: 'var(--bg-border)' }}>
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <svg className="w-8 h-8 opacity-10" fill="none" viewBox="0 0 24 24"
                  stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>All caught up!</p>
              </div>
            ) : (
              notifications.map((n) => {
                const cfg = NOTIF_TYPES[n.type] || NOTIF_TYPES.system;
                return (
                  <div
                    key={n.id}
                    className={clsx(
                      'flex items-start gap-3 px-4 py-3 transition-colors group',
                      n.url && 'cursor-pointer hover:opacity-90',
                      !n.read && 'border-l-2'
                    )}
                    style={{
                      background: n.read ? 'transparent' : 'rgba(83,74,183,0.04)',
                      borderLeftColor: !n.read ? cfg.color : 'transparent',
                    }}
                    onClick={() => n.url && handleNotifClick(n)}
                  >
                    {/* Icon */}
                    <span className="text-base shrink-0 mt-0.5 select-none">{cfg.icon}</span>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate"
                        style={{ color: 'var(--text-primary)' }}>
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
                      className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity shrink-0"
                      style={{ color: 'var(--text-muted)' }}
                      aria-label="Dismiss">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"
                        stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
