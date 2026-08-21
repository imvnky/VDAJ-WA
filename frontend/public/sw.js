/**
 * VDAJ WhatsApp Platform — Service Worker (sw.js)
 *
 * Strategy:
 *  - Static assets: Cache-First (app shell)
 *  - API calls:     Network-First with stale fallback
 *  - Push events:   Show notification + badge
 */

const CACHE_NAME    = 'vdaj-wa-v1';
const API_PREFIX    = '/api/';

// App shell files to pre-cache on install
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
];

// ── Install: pre-cache app shell ──────────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
});

// ── Activate: clear old caches ────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: Cache-First for assets, Network-First for API ──────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin, WebSocket, and non-GET requests
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (url.protocol === 'ws:' || url.protocol === 'wss:') return;

  // API calls: Network-First
  if (url.pathname.startsWith(API_PREFIX)) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Static assets: Cache-First
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
        }
        return res;
      });
    })
  );
});

// ── Push: display notification ────────────────────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'VDAJ WA', body: 'You have a new notification.' };
  try {
    data = event.data?.json() || data;
  } catch {
    data.body = event.data?.text() || data.body;
  }

  const options = {
    body:    data.body,
    icon:    '/icon-192.png',
    badge:   '/icon-192.png',
    tag:     data.tag   || 'vdaj-notification',
    data:    data.url   || '/dashboard',
    vibrate: [100, 50, 100],
    actions: data.actions || [],
    silent:  false,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// ── Notification click: open/focus app ───────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => {
        try { return new URL(c.url).origin === self.location.origin; } catch { return false; }
      });
      if (existing) {
        existing.navigate(targetUrl);
        return existing.focus();
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
