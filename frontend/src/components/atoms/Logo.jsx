/**
 * VDAJ Services LLP — Official Logo Lockup
 * Official emblem + "VDAJ Services LLP" wordmark
 */

import React from 'react';

export default function Logo({ size = 36, variant = 'default', showWordmark = true }) {
  const isLight = variant === 'light';

  return (
    <div className="flex items-center gap-2.5 select-none shrink-0">
      {/* Official 2×2 Brand Grid Mark */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 60 60"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
        aria-label="VDAJ Services LLP Logo"
      >
        <rect x="8" y="8" width="20" height="20" rx="4" fill="#534AB7" />
        <rect x="32" y="8" width="20" height="20" rx="4" fill="#AFA9EC" />
        <rect x="8" y="32" width="20" height="20" rx="4" fill="#AFA9EC" />
        <rect x="32" y="32" width="20" height="20" rx="4" fill="#1D9E75" />
      </svg>

      {/* Wordmark */}
      {showWordmark && (
        <div className="flex flex-col leading-none">
          <span
            className="font-extrabold tracking-tight"
            style={{
              fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
              fontSize: size * 0.42,
              color: isLight ? '#FFFFFF' : '#0F172A',
              letterSpacing: '-0.02em',
            }}
          >
            VDAJ
          </span>
          <span
            className="font-bold uppercase tracking-widest"
            style={{
              fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
              fontSize: size * 0.22,
              color: isLight ? '#AFA9EC' : '#534AB7',
              letterSpacing: '0.16em',
              marginTop: '2px',
            }}
          >
            Services LLP
          </span>
        </div>
      )}
    </div>
  );
}
