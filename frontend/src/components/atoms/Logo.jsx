/**
 * VDAJ Services — Official Logo Lockup
 * 2×2 pixel-grid SVG + "VDAJ SERVICES" wordmark
 */

import React from 'react';

export default function Logo({ size = 36 }) {
  return (
    <div className="flex items-center gap-3 select-none">
      {/* Official 2×2 brandkit grid mark */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 60 60"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
        aria-label="VDAJ logo mark"
      >
        <rect x="8" y="8" width="20" height="20" rx="3" fill="#534AB7" />
        <rect x="32" y="8" width="20" height="20" rx="3" fill="#AFA9EC" />
        <rect x="8" y="32" width="20" height="20" rx="3" fill="#AFA9EC" />
        <rect x="32" y="32" width="20" height="20" rx="3" fill="#1D9E75" />
      </svg>

      {/* Wordmark */}
      <div className="flex flex-col leading-none">
        <span
          className="font-extrabold tracking-tight"
          style={{ fontFamily: "'Inter', sans-serif", fontSize: size * 0.42, color: '#0F0F0F' }}
        >
          VDAJ
        </span>
        <span
          className="font-bold uppercase tracking-widest"
          style={{ fontFamily: "'Inter', sans-serif", fontSize: size * 0.22, color: '#534AB7', letterSpacing: '0.18em', marginTop: '2px' }}
        >
          Services
        </span>
      </div>
    </div>
  );
}
