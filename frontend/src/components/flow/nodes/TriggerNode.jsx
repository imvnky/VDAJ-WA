/**
 * VDAJ Services — TriggerNode (Enterprise Light Edition)
 * Custom React Flow node for Trigger events (keyword / new lead / opt-in etc.)
 */

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

const TRIGGER_ICONS = {
  keyword:  '⌨️',
  new_lead: '👤',
  opt_in:   '✅',
  campaign: '📣',
  inbound:  '💬',
};

const TRIGGER_LABELS = {
  keyword:  'Keyword Received',
  new_lead: 'New Lead Added',
  opt_in:   'Contact Opts In',
  campaign: 'Campaign Complete',
  inbound:  'Any Inbound Message',
};

function TriggerNode({ data, selected }) {
  const triggerType = data.config?.triggerType || 'keyword';
  const keywords = data.config?.keywords || [];
  const icon = TRIGGER_ICONS[triggerType] || '⚡';
  const label = TRIGGER_LABELS[triggerType] || 'Trigger Event';

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: selected ? '2px solid #534AB7' : '1.5px solid #E2E8F0',
        borderRadius: '16px',
        minWidth: '220px',
        maxWidth: '280px',
        boxShadow: selected
          ? '0 0 0 4px rgba(83, 74, 183, 0.16), 0 12px 28px -4px rgba(83, 74, 183, 0.25)'
          : '0 4px 16px -2px rgba(15, 23, 42, 0.06), 0 2px 6px -1px rgba(15, 23, 42, 0.04)',
        transition: 'all 0.18s ease',
        cursor: 'pointer',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 14px',
          background: selected ? '#F5F3FF' : '#FAF5FF',
          borderBottom: '1px solid #F3E8FF',
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
            background: '#EDE9FE',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            flexShrink: 0,
            border: '1px solid #DDD6FE',
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
              color: '#7C3AED',
              textTransform: 'uppercase',
              lineHeight: 1,
              margin: 0,
            }}
          >
            Trigger
          </p>
          <p
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: '#0F172A',
              lineHeight: 1.3,
              marginTop: '3px',
              marginBottom: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </p>
        </div>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#10B981',
            boxShadow: '0 0 6px rgba(16, 185, 129, 0.6)',
          }}
        />
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px' }}>
        {triggerType === 'keyword' && keywords.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
            {keywords.slice(0, 4).map((kw, i) => (
              <span
                key={i}
                style={{
                  padding: '3px 9px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: 600,
                  background: '#F5F3FF',
                  color: '#6D28D9',
                  border: '1px solid #DDD6FE',
                }}
              >
                {kw}
              </span>
            ))}
            {keywords.length > 4 && (
              <span
                style={{
                  padding: '3px 8px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: 600,
                  background: '#F1F5F9',
                  color: '#64748B',
                }}
              >
                +{keywords.length - 4} more
              </span>
            )}
          </div>
        ) : (
          <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0, fontStyle: 'italic' }}>
            {data.config?.description || 'Click to configure trigger criteria…'}
          </p>
        )}
      </div>

      {/* Output handle only */}
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
          boxShadow: '0 2px 6px rgba(83, 74, 183, 0.4)',
        }}
      />
    </div>
  );
}

export default memo(TriggerNode);
