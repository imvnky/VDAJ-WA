/**
 * VDAJ Services — PWA Update Banner
 * Shows a slim banner at the top when the service worker detects a new version.
 * User clicks "Update" → page reloads to activate the new SW.
 */

import React, { useState, useEffect } from 'react';

export default function UpdateBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = () => setVisible(true);
    window.addEventListener('sw:update-available', handler);
    return () => window.removeEventListener('sw:update-available', handler);
  }, []);

  if (!visible) return null;

  const handleUpdate = () => {
    // Tell all service workers to skipWaiting and reload
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg?.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    }
    window.location.reload();
  };

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-4 px-4 py-2.5 text-sm font-semibold"
      style={{
        background: 'linear-gradient(90deg, #534AB7, #3B3499)',
        color: '#fff',
        boxShadow: '0 2px 12px rgba(83,74,183,0.5)',
        animation: 'slideDown 0.3s ease-out',
      }}>
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24"
        stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      <span>A new version of VDAJ WA is available.</span>
      <button
        onClick={handleUpdate}
        className="px-3 py-1 rounded-lg text-xs font-bold transition-all hover:brightness-90"
        style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)' }}>
        Update Now
      </button>
      <button
        onClick={() => setVisible(false)}
        className="ml-auto opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Dismiss">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
