/**
 * VDAJ Services — MessageNode
 * Clean Enterprise Message Card matching the redesigned flow builder.
 */

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

function MessageNode({ data, selected }) {
  const label = data?.label || 'Send message';
  const body = data.config?.body || '';
  const isForm = data.config?.messageType === 'wa_flow' || label.toLowerCase().includes('form');
  const ctaText = data.config?.ctaText || 'Open Form';
  const fields = data.config?.fields || [
    { label: 'Full Name' },
    { label: 'Phone Number' },
    { label: 'Activity' },
  ];

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: selected ? '2px solid #534AB7' : isForm ? '1.5px solid #DDD6FE' : '1.5px solid #E2E8F0',
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
            background: isForm ? '#EDE9FE' : '#F5F3FF',
            border: isForm ? '1px solid #DDD6FE' : '1px solid #DDD6FE',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '15px',
            flexShrink: 0,
            color: '#534AB7',
          }}
        >
          {isForm ? '📋' : '💬'}
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
            {isForm ? 'WHATSAPP FORM' : 'MESSAGE'}
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
            {isForm ? 'Please tap below to complete your registration.' : 'Click to write message…'}
          </p>
        )}

        {isForm && (
          <div style={{ marginTop: '8px' }}>
            <div
              style={{
                background: '#F3F2FD',
                border: '1.5px dashed #534AB7',
                borderRadius: '8px',
                padding: '6px 10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                color: '#534AB7',
                fontSize: '11px',
                fontWeight: 700,
              }}
            >
              <span>📋</span>
              <span>{ctaText}</span>
              <span style={{ fontSize: '9px' }}>↗</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '6px' }}>
              {fields.map((f, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: '9px',
                    fontWeight: 600,
                    color: '#64748B',
                    background: '#F1F5F9',
                    padding: '2px 5px',
                    borderRadius: '4px',
                  }}
                >
                  • {f.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="out"
        style={{
          background: isForm ? '#10B981' : '#534AB7',
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
