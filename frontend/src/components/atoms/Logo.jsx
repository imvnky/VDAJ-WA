/**
 * VDAJ Services — Official Logo Lockup
 * 2×2 pixel-grid SVG + "VDAJ SERVICES" wordmark
 */

import React from 'react';

export default function Logo({ size = 36 }) {
  const cell = size / 2;
  return (
    <div className="flex items-center gap-3 select-none">
      {/* 2×2 grid mark */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 rounded-lg overflow-hidden"
        aria-label="VDAJ logo mark"
      >
        {/* Top-Left — brand purple */}
        <rect x={0}      y={0}      width={cell} height={cell} fill="#534AB7" />
        {/* Top-Right — soft aura */}
        <rect x={cell}   y={0}      width={cell} height={cell} fill="#AFA9EC" />
        {/* Bottom-Left — soft aura */}
        <rect x={0}      y={cell}   width={cell} height={cell} fill="#AFA9EC" />
        {/* Bottom-Right — signal teal */}
        <rect x={cell}   y={cell}   width={cell} height={cell} fill="#1D9E75" />
      </svg>

      {/* Wordmark */}
      <div className="flex flex-col leading-none">
        <span
          className="font-black tracking-tight"
          style={{ fontFamily: "'Inter', sans-serif", fontSize: size * 0.38, color: 'var(--text-primary)' }}
        >
          VDAJ
        </span>
        <span
          className="font-semibold uppercase tracking-widest"
          style={{ fontFamily: "'Inter', sans-serif", fontSize: size * 0.22, color: 'var(--text-muted)', letterSpacing: '0.15em' }}
        >
          Services
        </span>
      </div>
    </div>
  );
}
