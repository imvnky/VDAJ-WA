/**
 * VDAJ Services — MessageNode
 * Clean Enterprise Message Card matching the redesigned flow builder.
 */

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

function MessageNode({ data, selected }) {
  const label = data?.label || 'Send message';
  const body = data.config?.body || '';

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: selected ? '2px solid #534AB7' : '1.5px solid #E2E8F0',
        borderRadius: '16px',
        minWidth: '240px',
        maxWidth: '280px',
        boxShadow: selected
          ? '0 0 0 4px rgba(83, 74, 183, 0.16), 0 12px 28px -4px rgba(83, 74, 183, 0.22)'
          : '0 4px 16px -2px rgba(15, 23, 42, 0.05), 0 2px 6px -1px rgba(15, 23, 42, 0.03)',
        transition: 'all 0.18s ease',
        cursor: 'pointer',
        padding: '12px 14px',
      }}
    >
      {/* Top input handle */}
      <Handle
        type="target"
        position={Position.Top}
        id="in"
        style={{
          background: '#534AB7',
          border: '3px solid #FFFFFF',
          width: 14,
          height: 14,
          top: -7,
          boxShadow: '0 2px 6px rgba(83, 74, 183, 0.3)',
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '10px',
            background: '#F5F3FF',
            border: '1px solid #DDD6FE',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '15px',
            flexShrink: 0,
            color: '#534AB7',
          }}
        >
          💬
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: '10px',
              fontWeight: 800,
              letterSpacing: '0.08em',
              color: '#7C3AED',
              textTransform: 'uppercase',
              lineHeight: 1,
              margin: '0 0 3px',
            }}
          >
            MESSAGE
          </p>
          <p
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: '#0F172A',
              lineHeight: 1.2,
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </p>
        </div>
      </div>

      {/* Body Preview */}
      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #F1F5F9' }}>
        {body ? (
          <p
            style={{
              fontSize: '11px',
              color: '#334155',
              lineHeight: 1.45,
              margin: 0,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {body}
          </p>
        ) : (
          <p style={{ fontSize: '11px', color: '#94A3B8', fontStyle: 'italic', margin: 0 }}>
            Click to write message…
          </p>
        )}
      </div>

      {/* Bottom output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="out"
        style={{
          background: '#534AB7',
          border: '3px solid #FFFFFF',
          width: 14,
          height: 14,
          bottom: -7,
          boxShadow: '0 2px 6px rgba(83, 74, 183, 0.3)',
        }}
      />
    </div>
  );
}

export default memo(MessageNode);
