/**
 * VDAJ Services — MessageNode
 * Custom React Flow node for sending messages (text / image / interactive buttons).
 */

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

const TYPE_META = {
  text:        { icon: '💬', label: 'Send Text',          color: '#534AB7' },
  image:       { icon: '🖼️',  label: 'Send Image',         color: '#7C3AED' },
  buttons:     { icon: '🔘', label: 'Interactive Buttons', color: '#2563EB' },
  wa_flow:     { icon: '📋', label: 'WhatsApp Flow Form',  color: '#1D9E75' },
  list:        { icon: '📝', label: 'List Message',        color: '#D97706' },
};

function MessageNode({ data, selected }) {
  const msgType = data.config?.messageType || 'text';
  const meta = TYPE_META[msgType] || TYPE_META.text;
  const body = data.config?.body || '';
  const buttons = data.config?.buttons || [];
  const imageUrl = data.config?.imageUrl || '';

  return (
    <div style={{
      background: selected
        ? `linear-gradient(135deg, ${meta.color}22 0%, ${meta.color}11 100%)`
        : 'var(--node-bg, rgba(26,26,46,0.95))',
      border: `2px solid ${selected ? meta.color : 'rgba(175,169,236,0.4)'}`,
      borderRadius: '16px',
      minWidth: '220px',
      maxWidth: '260px',
      boxShadow: selected
        ? `0 0 0 4px ${meta.color}30, 0 8px 32px ${meta.color}40`
        : '0 4px 20px rgba(0,0,0,0.3)',
      transition: 'all 0.2s ease',
      cursor: 'pointer',
      overflow: 'hidden',
    }}>
      {/* Input handle */}
      <Handle type="target" position={Position.Top} id="in" style={{
        background: '#AFA9EC', border: '2px solid rgba(175,169,236,0.5)',
        width: 12, height: 12, top: -6,
      }} />

      {/* Header */}
      <div style={{
        padding: '10px 14px 8px',
        background: `${meta.color}22`,
        borderBottom: '1px solid rgba(175,169,236,0.2)',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <span style={{ fontSize: '15px' }}>{meta.icon}</span>
        <div>
          <p style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(175,169,236,0.8)', textTransform: 'uppercase', lineHeight: 1 }}>Message</p>
          <p style={{ fontSize: '12px', fontWeight: 700, color: '#F8F7FF', lineHeight: 1.3, marginTop: 2 }}>{meta.label}</p>
        </div>
      </div>

      {/* WhatsApp Message Preview */}
      <div style={{ padding: '10px 12px 4px' }}>
        {imageUrl && (
          <div style={{
            width: '100%', height: '72px', borderRadius: '10px', overflow: 'hidden', marginBottom: '8px',
            background: 'rgba(83,74,183,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => { e.target.parentElement.innerHTML = '🖼️'; }} />
          </div>
        )}

        {/* Message bubble preview */}
        {body ? (
          <div style={{
            background: '#005C4B',
            borderRadius: '8px 8px 8px 2px',
            padding: '7px 10px',
            marginBottom: '8px',
          }}>
            <p style={{
              fontSize: '11px', color: '#fff', lineHeight: 1.5,
              display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {body}
            </p>
          </div>
        ) : (
          <p style={{ fontSize: '10px', color: 'rgba(248,247,255,0.3)', fontStyle: 'italic', marginBottom: '8px', paddingLeft: '4px' }}>
            Click to write message…
          </p>
        )}

        {/* Buttons */}
        {buttons.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
            {buttons.slice(0, 3).map((btn, i) => (
              <div key={i} style={{
                padding: '5px 10px', borderRadius: '8px', textAlign: 'center',
                background: 'rgba(83,74,183,0.2)', border: '1px solid rgba(83,74,183,0.4)',
                fontSize: '10px', fontWeight: 600, color: '#AFA9EC',
              }}>
                {btn.label || `Option ${i + 1}`}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Output handles */}
      {buttons.length > 1 ? (
        /* Multiple handles for button branches */
        buttons.slice(0, 3).map((btn, i) => (
          <Handle
            key={i}
            type="source"
            position={Position.Bottom}
            id={`btn_${i}`}
            style={{
              background: meta.color,
              border: '2px solid rgba(255,255,255,0.3)',
              width: 10, height: 10,
              bottom: -5,
              left: `${((i + 1) / (buttons.length + 1)) * 100}%`,
            }}
          />
        ))
      ) : (
        <Handle type="source" position={Position.Bottom} id="out" style={{
          background: '#AFA9EC', border: '2px solid rgba(175,169,236,0.5)',
          width: 12, height: 12, bottom: -6,
        }} />
      )}
    </div>
  );
}

export default memo(MessageNode);
