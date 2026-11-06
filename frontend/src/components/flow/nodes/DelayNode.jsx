/**
 * VDAJ Services — DelayNode (Enterprise Light Edition)
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

  const r = 22;
  const circ = 2 * Math.PI * r;
  const pct = Math.min((parseInt(value) / (unit === 'minutes' ? 60 : unit === 'hours' ? 24 : 30)) * 100, 100);
  const offset = circ - (pct / 100) * circ;

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: selected ? '2px solid #D97706' : '1.5px solid #E2E8F0',
        borderRadius: '16px',
        minWidth: '210px',
        boxShadow: selected
          ? '0 0 0 4px rgba(217, 119, 6, 0.18), 0 12px 28px -4px rgba(217, 119, 6, 0.25)'
          : '0 4px 16px -2px rgba(15, 23, 42, 0.06), 0 2px 6px -1px rgba(15, 23, 42, 0.04)',
        transition: 'all 0.18s ease',
        cursor: 'pointer',
        overflow: 'hidden',
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="in"
        style={{
          background: '#D97706',
          border: '3px solid #FFFFFF',
          width: 14,
          height: 14,
          top: -7,
          boxShadow: '0 2px 6px rgba(217, 119, 6, 0.3)',
        }}
      />

      {/* Header */}
      <div
        style={{
          padding: '10px 14px',
          background: selected ? '#FFFBEB' : '#FEF3C7',
          borderBottom: '1px solid #FDE68A',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '10px',
            background: '#FDE68A',
            border: '1px solid #FCD34D',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: '10px',
              fontWeight: 800,
              letterSpacing: '0.08em',
              color: '#B45309',
              textTransform: 'uppercase',
              lineHeight: 1,
              margin: 0,
            }}
          >
            Timing
          </p>
          <p
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: '#0F172A',
              lineHeight: 1.3,
              marginTop: '3px',
              marginBottom: 0,
            }}
          >
            Wait / Delay
          </p>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* SVG arc clock */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <svg width={52} height={52} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={26} cy={26} r={r} fill="none" stroke="#F1F5F9" strokeWidth={4} />
            <circle
              cx={26}
              cy={26}
              r={r}
              fill="none"
              stroke="#D97706"
              strokeWidth={4}
              strokeDasharray={circ}
              strokeDashoffset={offset}
              strokeLinecap="round"
            />
          </svg>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '15px',
            }}
          >
            {icon}
          </div>
        </div>

        <div>
          <p style={{ fontSize: '22px', fontWeight: 900, color: '#D97706', lineHeight: 1, margin: 0 }}>
            {value}
          </p>
          <p style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginTop: '3px', margin: 0 }}>
            {unitLabel}
          </p>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        id="out"
        style={{
          background: '#D97706',
          border: '3px solid #FFFFFF',
          width: 14,
          height: 14,
          bottom: -7,
          boxShadow: '0 2px 6px rgba(217, 119, 6, 0.4)',
        }}
      />
    </div>
  );
}

export default memo(DelayNode);
