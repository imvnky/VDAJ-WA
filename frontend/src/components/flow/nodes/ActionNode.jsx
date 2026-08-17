/**
 * VDAJ Services — ActionNode
 * Performs side-effect actions: Add/Remove Tag, Assign Agent, Webhook, Opt-Out.
 * Also doubles as ConditionNode (branching Yes/No) when type = 'condition'.
 */

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

const ACTION_META = {
  add_tag:    { icon: '🏷️',  label: 'Add Tag',           color: '#1D9E75' },
  remove_tag: { icon: '✂️',  label: 'Remove Tag',         color: '#EF4444' },
  assign:     { icon: '👤',  label: 'Assign to Agent',    color: '#6366F1' },
  webhook:    { icon: '🔗',  label: 'Trigger Webhook',    color: '#8B5CF6' },
  opt_out:    { icon: '🚫',  label: 'Mark Opted Out',     color: '#F59E0B' },
  condition:  { icon: '❓',  label: 'Check Condition',    color: '#EC4899' },
};

function ActionNode({ data, selected }) {
  const actionType = data.config?.actionType || 'add_tag';
  const meta = ACTION_META[actionType] || ACTION_META.add_tag;
  const isCondition = actionType === 'condition';

  const configSummary = () => {
    switch (actionType) {
      case 'add_tag':
      case 'remove_tag': return data.config?.tag ? `Tag: ${data.config.tag}` : 'No tag set';
      case 'assign':     return data.config?.agentName ? `→ ${data.config.agentName}` : 'No agent set';
      case 'webhook':    return data.config?.webhookUrl ? 'URL configured ✓' : 'No URL set';
      case 'opt_out':    return 'Block all future sends';
      case 'condition':  {
        const { field, operator, value } = data.config || {};
        if (field) return `${field} ${operator || '='} ${value || '?'}`;
        return 'No condition set';
      }
      default: return 'Click to configure…';
    }
  };

  return (
    <div style={{
      background: selected
        ? `linear-gradient(135deg, ${meta.color}22 0%, ${meta.color}11 100%)`
        : 'rgba(26,26,46,0.95)',
      border: `2px solid ${selected ? meta.color : `${meta.color}60`}`,
      borderRadius: isCondition ? '12px' : '16px',
      minWidth: '190px',
      boxShadow: selected
        ? `0 0 0 4px ${meta.color}25, 0 8px 32px ${meta.color}35`
        : '0 4px 20px rgba(0,0,0,0.3)',
      transition: 'all 0.2s ease',
      cursor: 'pointer',
      overflow: 'hidden',
      transform: isCondition ? 'rotate(0deg)' : undefined,
    }}>
      <Handle type="target" position={Position.Top} id="in" style={{
        background: '#AFA9EC', border: '2px solid rgba(175,169,236,0.5)',
        width: 12, height: 12, top: -6,
      }} />

      {/* Header */}
      <div style={{
        padding: '10px 14px 8px',
        background: `${meta.color}18`,
        borderBottom: `1px solid ${meta.color}30`,
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <span style={{ fontSize: '15px' }}>{meta.icon}</span>
        <div>
          <p style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', color: `${meta.color}cc`, textTransform: 'uppercase', lineHeight: 1 }}>
            {isCondition ? 'Logic' : 'Action'}
          </p>
          <p style={{ fontSize: '12px', fontWeight: 700, color: '#F8F7FF', lineHeight: 1.3, marginTop: 2 }}>{meta.label}</p>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '10px 14px 12px' }}>
        <p style={{ fontSize: '11px', color: 'rgba(248,247,255,0.55)', lineHeight: 1.5 }}>
          {configSummary()}
        </p>

        {/* Condition Yes/No badges */}
        {isCondition && (
          <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
            <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, background: 'rgba(29,158,117,0.2)', color: '#1D9E75', border: '1px solid rgba(29,158,117,0.4)' }}>Yes →</span>
            <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, background: 'rgba(239,68,68,0.2)', color: '#F87171', border: '1px solid rgba(239,68,68,0.4)' }}>No →</span>
          </div>
        )}
      </div>

      {/* Condition: 2 source handles (yes / no) */}
      {isCondition ? (
        <>
          <Handle type="source" position={Position.Bottom} id="yes" style={{
            background: '#1D9E75', border: '2px solid rgba(29,158,117,0.5)',
            width: 12, height: 12, bottom: -6, left: '30%',
          }} />
          <Handle type="source" position={Position.Bottom} id="no" style={{
            background: '#EF4444', border: '2px solid rgba(239,68,68,0.5)',
            width: 12, height: 12, bottom: -6, left: '70%',
          }} />
        </>
      ) : (
        <Handle type="source" position={Position.Bottom} id="out" style={{
          background: meta.color, border: '2px solid rgba(255,255,255,0.2)',
          width: 12, height: 12, bottom: -6,
        }} />
      )}
    </div>
  );
}

export default memo(ActionNode);
