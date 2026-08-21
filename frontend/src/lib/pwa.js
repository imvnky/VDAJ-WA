/**
 * VDAJ Services — PWA Registration
 * Registers the service worker and returns helper utilities.
 * Called once from main.jsx.
 */

export async function registerSW() {
  if (!('serviceWorker' in navigator)) return null;

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

    // Trigger update check on page focus
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update();
    });

    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      if (!newWorker) return;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New content is available — fire a custom event for the UI to show a banner
          window.dispatchEvent(new CustomEvent('sw:update-available'));
        }
      });
    });

    console.info('[VDAJ SW] Registered:', reg.scope);
    return reg;
  } catch (err) {
    console.warn('[VDAJ SW] Registration failed:', err);
    return null;
  }
}

/**
 * Request browser push permission.
 * Returns 'granted' | 'denied' | 'default'
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}

/**
 * Show a local (non-push) browser notification.
 * Falls back silently if permission not granted.
 */
export function showBrowserNotification(title, body, url = '/inbox') {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const n = new Notification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'vdaj-local',
  });
  n.onclick = () => {
    window.focus();
    window.location.pathname = url;
    n.close();
  };
}
