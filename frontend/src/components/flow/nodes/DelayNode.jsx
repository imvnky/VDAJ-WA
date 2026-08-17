/**
 * VDAJ Services — DelayNode
 * Wait timer node — holds execution for a given duration.
 */

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

const UNIT_DISPLAY = { minutes: 'min', hours: 'hr', days: 'day' };
const UNIT_ICON = { minutes: '⏱️', hours: '⏰', days: '📅' };

function DelayNode({ data, selected }) {
  const value = data.config?.value || 1;
  const unit = data.config?.unit || 'hours';
  const icon = UNIT_ICON[unit] || '⏱️';
  const unitLabel = `${UNIT_DISPLAY[unit] || unit}${value !== 1 ? 's' : ''}`;

  // Arc progress visual (purely decorative)
  const r = 22;
  const circ = 2 * Math.PI * r;
  const pct = Math.min((parseInt(value) / (unit === 'minutes' ? 60 : unit === 'hours' ? 24 : 30)) * 100, 100);
  const offset = circ - (pct / 100) * circ;

  return (
    <div style={{
      background: selected
        ? 'linear-gradient(135deg, rgba(245,158,11,0.2) 0%, rgba(245,158,11,0.1) 100%)'
        : 'rgba(26,26,46,0.95)',
      border: `2px solid ${selected ? '#F59E0B' : 'rgba(245,158,11,0.4)'}`,
      borderRadius: '16px',
      minWidth: '180px',
      boxShadow: selected
        ? '0 0 0 4px rgba(245,158,11,0.2), 0 8px 32px rgba(245,158,11,0.3)'
        : '0 4px 20px rgba(0,0,0,0.3)',
      transition: 'all 0.2s ease',
      cursor: 'pointer',
      overflow: 'hidden',
    }}>
      <Handle type="target" position={Position.Top} id="in" style={{
        background: '#AFA9EC', border: '2px solid rgba(175,169,236,0.5)',
        width: 12, height: 12, top: -6,
      }} />

      {/* Header */}
      <div style={{
        padding: '10px 14px 8px',
        background: 'rgba(245,158,11,0.12)',
        borderBottom: '1px solid rgba(245,158,11,0.2)',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <span style={{ fontSize: '16px' }}>{icon}</span>
        <div>
          <p style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(245,158,11,0.8)', textTransform: 'uppercase', lineHeight: 1 }}>Wait</p>
          <p style={{ fontSize: '12px', fontWeight: 700, color: '#F8F7FF', lineHeight: 1.3, marginTop: 2 }}>Delay Step</p>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* SVG arc clock */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <svg width={54} height={54} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={27} cy={27} r={r} fill="none" stroke="rgba(245,158,11,0.12)" strokeWidth={4} />
            <circle cx={27} cy={27} r={r} fill="none" stroke="#F59E0B" strokeWidth={4}
              strokeDasharray={circ} strokeDashoffset={offset}
              strokeLinecap="round" />
          </svg>
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: '15px' }}>{icon}</span>
          </div>
        </div>

        <div>
          <p style={{ fontSize: '22px', fontWeight: 900, color: '#F59E0B', lineHeight: 1 }}>{value}</p>
          <p style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(248,247,255,0.6)', marginTop: 2 }}>{unitLabel}</p>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} id="out" style={{
        background: '#F59E0B', border: '2px solid rgba(245,158,11,0.4)',
        width: 12, height: 12, bottom: -6,
      }} />
    </div>
  );
}

export default memo(DelayNode);
