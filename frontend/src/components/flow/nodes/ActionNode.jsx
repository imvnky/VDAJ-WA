/**
 * VDAJ Services — ActionNode (Enterprise Light Edition)
 * Performs side-effect actions: Add/Remove Tag, Assign Agent, Webhook, Opt-Out.
 * Also doubles as ConditionNode (branching Yes/No) when type = 'condition'.
 */

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

const ACTION_META = {
  add_tag:    { icon: '🏷️', label: 'Add Tag',        color: '#059669', lightBg: '#ECFDF5', border: '#A7F3D0' },
  remove_tag: { icon: '✂️', label: 'Remove Tag',     color: '#DC2626', lightBg: '#FEF2F2', border: '#FECACA' },
  assign:     { icon: '👤', label: 'Assign Agent',   color: '#4F46E5', lightBg: '#EEF2FF', border: '#C7D2FE' },
  webhook:    { icon: '🔗', label: 'Webhook Call',   color: '#7C3AED', lightBg: '#F5F3FF', border: '#DDD6FE' },
  opt_out:    { icon: '🚫', label: 'Mark Opted Out', color: '#D97706', lightBg: '#FFFBEB', border: '#FDE68A' },
  condition:  { icon: '❓', label: 'Condition Split',color: '#DB2777', lightBg: '#FDF2F8', border: '#FBCFE8' },
};

function ActionNode({ data, selected }) {
  const actionType = data.config?.actionType || 'add_tag';
  const meta = ACTION_META[actionType] || ACTION_META.add_tag;
  const isCondition = actionType === 'condition';

  const configSummary = () => {
    switch (actionType) {
      case 'add_tag':
      case 'remove_tag':
        return data.config?.tag ? `Tag: ${data.config.tag}` : 'No tag configured';
      case 'assign':
        return data.config?.agentName ? `Agent: ${data.config.agentName}` : 'No agent assigned';
      case 'webhook':
        return data.config?.webhookUrl ? 'URL endpoint ready ✓' : 'No webhook URL set';
      case 'opt_out':
        return 'Exclude contact from future campaigns';
      case 'condition': {
        const { field, operator, value } = data.config || {};
        if (field) return `If ${field} ${operator || '='} "${value || ''}"`;
        return 'Click to set branch rules';
      }
      default:
        return 'Click to configure…';
    }
  };

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: selected ? `2px solid ${meta.color}` : '1.5px solid #E2E8F0',
        borderRadius: '16px',
        minWidth: '220px',
        maxWidth: '260px',
        boxShadow: selected
          ? `0 0 0 4px ${meta.color}25, 0 12px 28px -4px ${meta.color}35`
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
          background: meta.color,
          border: '3px solid #FFFFFF',
          width: 14,
          height: 14,
          top: -7,
          boxShadow: `0 2px 6px ${meta.color}40`,
        }}
      />

      {/* Header */}
      <div
        style={{
          padding: '10px 14px',
          background: selected ? meta.lightBg : '#F8FAFC',
          borderBottom: `1px solid ${selected ? meta.border : '#E2E8F0'}`,
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
            background: meta.lightBg,
            border: `1px solid ${meta.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            flexShrink: 0,
          }}
        >
          {meta.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: '10px',
              fontWeight: 800,
              letterSpacing: '0.08em',
              color: meta.color,
              textTransform: 'uppercase',
              lineHeight: 1,
              margin: 0,
            }}
          >
            {isCondition ? 'Logic' : 'Action'}
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
            {meta.label}
          </p>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px' }}>
        <p
          style={{
            fontSize: '11px',
            fontWeight: 500,
            color: '#475569',
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          {configSummary()}
        </p>

        {/* Condition Yes/No badges */}
        {isCondition && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <span
              style={{
                flex: 1,
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 700,
                textAlign: 'center',
                background: '#ECFDF5',
                color: '#059669',
                border: '1px solid #A7F3D0',
              }}
            >
              Yes ↳
            </span>
            <span
              style={{
                flex: 1,
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 700,
                textAlign: 'center',
                background: '#FEF2F2',
                color: '#DC2626',
                border: '1px solid #FECACA',
              }}
            >
              No ↳
            </span>
          </div>
        )}
      </div>

      {/* Output handles */}
      {isCondition ? (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="yes"
            style={{
              background: '#059669',
              border: '3px solid #FFFFFF',
              width: 14,
              height: 14,
              bottom: -7,
              left: '30%',
              boxShadow: '0 2px 6px rgba(5, 150, 105, 0.4)',
            }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="no"
            style={{
              background: '#DC2626',
              border: '3px solid #FFFFFF',
              width: 14,
              height: 14,
              bottom: -7,
              left: '70%',
              boxShadow: '0 2px 6px rgba(220, 38, 38, 0.4)',
            }}
          />
        </>
      ) : (
        <Handle
          type="source"
          position={Position.Bottom}
          id="out"
          style={{
            background: meta.color,
            border: '3px solid #FFFFFF',
            width: 14,
            height: 14,
            bottom: -7,
            boxShadow: `0 2px 6px ${meta.color}40`,
          }}
        />
      )}
    </div>
  );
}

export default memo(ActionNode);
