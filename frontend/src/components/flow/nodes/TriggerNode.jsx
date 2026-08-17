/**
 * VDAJ Services — TriggerNode
 * Custom React Flow node for Trigger events (keyword / new lead / opt-in etc.)
 */

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

const TRIGGER_ICONS = {
  keyword:    '⌨️',
  new_lead:   '👤',
  opt_in:     '✅',
  campaign:   '📣',
  inbound:    '💬',
};

const TRIGGER_LABELS = {
  keyword:    'Keyword Received',
  new_lead:   'New Lead Added',
  opt_in:     'Contact Opts In',
  campaign:   'Campaign Complete',
  inbound:    'Any Inbound Message',
};

function TriggerNode({ data, selected }) {
  const triggerType = data.config?.triggerType || 'keyword';
  const keywords = data.config?.keywords || [];
  const icon = TRIGGER_ICONS[triggerType] || '⚡';
  const label = TRIGGER_LABELS[triggerType] || 'Trigger';

  return (
    <div
      style={{
        background: selected
          ? 'linear-gradient(135deg, #534AB7 0%, #3B3499 100%)'
          : 'linear-gradient(135deg, rgba(83,74,183,0.2) 0%, rgba(59,52,153,0.12) 100%)',
        border: `2px solid ${selected ? '#AFA9EC' : '#534AB7'}`,
        borderRadius: '16px',
        minWidth: '200px',
        boxShadow: selected
          ? '0 0 0 4px rgba(83,74,183,0.25), 0 8px 32px rgba(83,74,183,0.4)'
          : '0 4px 20px rgba(83,74,183,0.25)',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '10px 14px 8px',
        background: selected ? 'rgba(255,255,255,0.1)' : 'rgba(83,74,183,0.3)',
        borderBottom: '1px solid rgba(175,169,236,0.3)',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <span style={{ fontSize: '16px' }}>{icon}</span>
        <div>
          <p style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', color: '#AFA9EC', textTransform: 'uppercase', lineHeight: 1 }}>Trigger</p>
          <p style={{ fontSize: '12px', fontWeight: 700, color: '#F8F7FF', lineHeight: 1.3, marginTop: 2 }}>{label}</p>
        </div>
        <div style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%', background: '#1D9E75', boxShadow: '0 0 6px #1D9E75' }} />
      </div>

      {/* Body */}
      <div style={{ padding: '10px 14px 12px' }}>
        {triggerType === 'keyword' && keywords.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {keywords.slice(0, 4).map((kw, i) => (
              <span key={i} style={{
                padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 600,
                background: 'rgba(175,169,236,0.15)', color: '#AFA9EC',
                border: '1px solid rgba(175,169,236,0.3)',
              }}>
                {kw}
              </span>
            ))}
            {keywords.length > 4 && (
              <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '10px', color: 'rgba(248,247,255,0.4)' }}>
                +{keywords.length - 4}
              </span>
            )}
          </div>
        ) : (
          <p style={{ fontSize: '11px', color: 'rgba(248,247,255,0.45)', fontStyle: 'italic' }}>
            {data.config?.description || 'Click to configure trigger…'}
          </p>
        )}
      </div>

      {/* Output handle only — triggers have no input */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="out"
        style={{
          background: '#AFA9EC',
          border: '2px solid #534AB7',
          width: 12, height: 12,
          bottom: -6,
        }}
      />
    </div>
  );
}

export default memo(TriggerNode);
