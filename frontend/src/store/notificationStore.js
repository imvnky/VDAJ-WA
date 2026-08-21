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
 * Stored in-memory (no persistence — refreshes clean).
 * Badge count tracks unread.
 */

import { create } from 'zustand';

let _idCounter = 1;

const NOTIF_TYPES = {
  message:    { icon: '💬', color: '#534AB7' },
  campaign:   { icon: '📢', color: '#1D9E75' },
  warning:    { icon: '⚠️', color: '#f59e0b' },
  error:      { icon: '❌', color: '#f87171' },
  system:     { icon: '🔔', color: '#AFA9EC' },
  compliance: { icon: '🛡️', color: '#60a5fa' },
};

export { NOTIF_TYPES };

const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,

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
    set((s) => ({
      notifications:  [item, ...s.notifications].slice(0, 100), // cap at 100
      unreadCount:    s.unreadCount + 1,
    }));
  },

  /** Mark a single notification as read */
  markRead(id) {
    set((s) => {
      const notifs = s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      );
      const unread = notifs.filter((n) => !n.read).length;
      return { notifications: notifs, unreadCount: unread };
    });
  },

  /** Mark all as read */
  markAllRead() {
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },

  /** Remove a notification */
  remove(id) {
    set((s) => {
      const notifs = s.notifications.filter((n) => n.id !== id);
      return { notifications: notifs, unreadCount: notifs.filter((n) => !n.read).length };
    });
  },

  /** Clear all */
  clearAll() {
    set({ notifications: [], unreadCount: 0 });
  },
}));

export default useNotificationStore;
