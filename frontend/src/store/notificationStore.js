/**
 * VDAJ Services — Notification Store (Zustand)
 *
 * In-app notification bell system.
 * Notifications are generated from:
 *  - WebSocket messages (new inbox message, campaign status change)
 *  - Campaign completion events
 *  - WABA quality rating changes
 *  - System alerts
 *
 * Persisted in localStorage so notifications survive reloads.
 * Badge count tracks unread.
 */

import { create } from 'zustand';

let _idCounter = Date.now();

const NOTIF_TYPES = {
  message:    { label: 'Messages',  color: '#534AB7', bg: '#EEECFC' },
  campaign:   { label: 'Campaigns', color: '#1D9E75', bg: '#E8F9F4' },
  warning:    { label: 'Warning',   color: '#D97706', bg: '#FEF3C7' },
  error:      { label: 'Errors',    color: '#DC2626', bg: '#FEE2E2' },
  system:     { label: 'System',    color: '#4F46E5', bg: '#EEF2FF' },
  compliance: { label: 'Policy',    color: '#0284C7', bg: '#E0F2FE' },
};

export { NOTIF_TYPES };

const STORAGE_KEY = 'vdaj_notifications_store_v2';

function getInitialNotifications() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}

  // Enterprise platform initial gateway notification
  return [
    {
      id: 'notif-gateway-connected',
      type: 'system',
      title: 'Meta Cloud API Gateway Connected',
      body: 'Verified webhook listeners and message dispatch queues are active and operating in Tier 1 status.',
      url: '/settings',
      read: false,
      createdAt: new Date().toISOString(),
    },
  ];
}

function saveNotifications(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 100)));
  } catch {}
}

const initialList = getInitialNotifications();

const useNotificationStore = create((set, get) => ({
  notifications: initialList,
  unreadCount: initialList.filter((n) => !n.read).length,

  /**
   * Push a new notification.
   * @param {{ type, title, body, url? }} notif
   */
  push(notif) {
    const id = `notif-${_idCounter++}`;
    const item = {
      id,
      type:      notif.type || 'system',
      title:     notif.title || 'Notification',
      body:      notif.body  || '',
      url:       notif.url   || null,
      read:      false,
      createdAt: new Date().toISOString(),
    };
    set((s) => {
      const next = [item, ...s.notifications].slice(0, 100);
      saveNotifications(next);
      return {
        notifications: next,
        unreadCount: s.unreadCount + 1,
      };
    });
  },

  /** Mark a single notification as read */
  markRead(id) {
    set((s) => {
      const notifs = s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      );
      const unread = notifs.filter((n) => !n.read).length;
      saveNotifications(notifs);
      return { notifications: notifs, unreadCount: unread };
    });
  },

  /** Mark all as read */
  markAllRead() {
    set((s) => {
      const notifs = s.notifications.map((n) => ({ ...n, read: true }));
      saveNotifications(notifs);
      return {
        notifications: notifs,
        unreadCount: 0,
      };
    });
  },

  /** Remove a notification */
  remove(id) {
    set((s) => {
      const notifs = s.notifications.filter((n) => n.id !== id);
      const unread = notifs.filter((n) => !n.read).length;
      saveNotifications(notifs);
      return { notifications: notifs, unreadCount: unread };
    });
  },

  /** Clear all */
  clearAll() {
    saveNotifications([]);
    set({ notifications: [], unreadCount: 0 });
  },
}));

export default useNotificationStore;
