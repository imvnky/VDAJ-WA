/**
 * VDAJ Services LLP — Official Logo Lockup
 * Official emblem + "VDAJ Services LLP" wordmark
 */

import React from 'react';

export default function Logo({ size = 36, variant = 'default', showWordmark = true }) {
  const isLight = variant === 'light';

  return (
    <div className="flex items-center gap-2.5 select-none shrink-0">
      {/* Official VDAJ Brand Emblem */}
      <img
        src="/vdaj_logo.jpg"
        alt="VDAJ Services LLP"
        width={size}
        height={size}
        className="rounded-xl object-contain shrink-0 shadow-2xs"
        style={{ width: `${size}px`, height: `${size}px` }}
        onError={(e) => {
          // Fallback if image path fails
          e.currentTarget.style.display = 'none';
        }}
      />

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
