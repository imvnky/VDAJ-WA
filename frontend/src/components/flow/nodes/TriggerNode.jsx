/**
 * VDAJ Services — TriggerNode
 * Clean Enterprise trigger node with green accent matching the redesigned flow builder.
 */

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

function TriggerNode({ data, selected }) {
  const triggerType = data.config?.triggerType || 'inbound';
  const keywords = data.config?.keywords || [];
  const label = data?.label || 'Incoming message';

  const subtext =
    triggerType === 'keyword' && keywords.length > 0
      ? `Keywords: ${keywords.join(', ')}`
      : triggerType === 'keyword'
      ? 'Keywords: Hi, Hello, Enquiry'
      : triggerType === 'inbound'
      ? 'Keywords: Hi, Hello, Enquiry'
      : triggerType === 'new_lead'
      ? 'When a new contact is added'
      : 'On customer trigger';

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: selected ? '2px solid #534AB7' : '1.5px solid #E2E8F0',
        borderRadius: '16px',
        minWidth: '220px',
        maxWidth: '280px',
        boxShadow: selected
          ? '0 0 0 4px rgba(83, 74, 183, 0.16), 0 12px 28px -4px rgba(83, 74, 183, 0.22)'
          : '0 4px 16px -2px rgba(15, 23, 42, 0.05), 0 2px 6px -1px rgba(15, 23, 42, 0.03)',
        transition: 'all 0.18s ease',
        cursor: 'pointer',
        padding: '12px 14px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Green play icon */}
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '10px',
            background: '#ECFDF5',
            border: '1px solid #A7F3D0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#059669',
            fontSize: '15px',
            fontWeight: 800,
            flexShrink: 0,
          }}
        >
          ▷
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: '10px',
              fontWeight: 800,
              letterSpacing: '0.08em',
              color: '#059669',
              textTransform: 'uppercase',
              lineHeight: 1,
              margin: '0 0 3px',
            }}
          >
            TRIGGER
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

      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #F1F5F9' }}>
        <p
          style={{
            fontSize: '11px',
            color: '#64748B',
            margin: 0,
            fontStyle: 'italic',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {subtext}
        </p>
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="out"
        style={{
          background: '#059669',
          border: '3px solid #FFFFFF',
          width: 14,
          height: 14,
          bottom: -7,
          boxShadow: '0 2px 6px rgba(5, 150, 105, 0.4)',
        }}
      />
    </div>
  );
}

export default memo(TriggerNode);
