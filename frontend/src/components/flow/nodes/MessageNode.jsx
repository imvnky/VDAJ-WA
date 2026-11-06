/**
 * VDAJ Services — MessageNode (Enterprise Light Edition)
 * Custom React Flow node for sending WhatsApp messages (text / image / interactive buttons).
 */

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

const TYPE_META = {
  text:    { icon: '💬', label: 'Send Text',          color: '#2563EB', lightBg: '#EFF6FF', border: '#BFDBFE' },
  image:   { icon: '🖼️', label: 'Send Image',         color: '#7C3AED', lightBg: '#F5F3FF', border: '#DDD6FE' },
  buttons: { icon: '🔘', label: 'Interactive Buttons', color: '#0284C7', lightBg: '#F0F9FF', border: '#BAE6FD' },
  wa_flow: { icon: '📋', label: 'WhatsApp Flow Form',  color: '#059669', lightBg: '#ECFDF5', border: '#A7F3D0' },
  list:    { icon: '📝', label: 'List Message',        color: '#D97706', lightBg: '#FFFBEB', border: '#FDE68A' },
};

function MessageNode({ data, selected }) {
  const msgType = data.config?.messageType || 'text';
  const meta = TYPE_META[msgType] || TYPE_META.text;
  const body = data.config?.body || '';
  const buttons = data.config?.buttons || [];
  const imageUrl = data.config?.imageUrl || '';

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: selected ? `2px solid ${meta.color}` : '1.5px solid #E2E8F0',
        borderRadius: '16px',
        minWidth: '240px',
        maxWidth: '280px',
        boxShadow: selected
          ? `0 0 0 4px ${meta.color}25, 0 12px 28px -4px ${meta.color}35`
          : '0 4px 16px -2px rgba(15, 23, 42, 0.06), 0 2px 6px -1px rgba(15, 23, 42, 0.04)',
        transition: 'all 0.18s ease',
        cursor: 'pointer',
        overflow: 'hidden',
      }}
    >
      {/* Input handle */}
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
            Message
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

      {/* WhatsApp Message Preview */}
      <div style={{ padding: '12px 14px' }}>
        {imageUrl && (
          <div
            style={{
              width: '100%',
              height: '76px',
              borderRadius: '10px',
              overflow: 'hidden',
              marginBottom: '10px',
              background: '#F1F5F9',
              border: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src={imageUrl}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                e.target.parentElement.innerHTML = '🖼️';
              }}
            />
          </div>
        )}

        {/* Message bubble preview */}
        {body ? (
          <div
            style={{
              background: '#005C4B',
              borderRadius: '10px 10px 10px 2px',
              padding: '8px 12px',
              marginBottom: buttons.length > 0 ? '10px' : '0',
              boxShadow: '0 2px 6px rgba(0, 92, 75, 0.2)',
            }}
          >
            <p
              style={{
                fontSize: '11px',
                color: '#FFFFFF',
                lineHeight: 1.5,
                margin: 0,
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {body}
            </p>
          </div>
        ) : (
          <p
            style={{
              fontSize: '11px',
              color: '#94A3B8',
              fontStyle: 'italic',
              margin: 0,
              marginBottom: buttons.length > 0 ? '10px' : '0',
            }}
          >
            Click node to write WhatsApp message…
          </p>
        )}

        {/* Buttons preview */}
        {buttons.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {buttons.slice(0, 3).map((btn, i) => (
              <div
                key={i}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  textAlign: 'center',
                  background: '#F8FAFC',
                  border: '1px solid #CBD5E1',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#0284C7',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                }}
              >
                {btn.label || `Option ${i + 1}`}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Output handles */}
      {buttons.length > 1 ? (
        buttons.slice(0, 3).map((btn, i) => (
          <Handle
            key={i}
            type="source"
            position={Position.Bottom}
            id={`btn_${i}`}
            style={{
              background: meta.color,
              border: '3px solid #FFFFFF',
              width: 13,
              height: 13,
              bottom: -6,
              left: `${((i + 1) / (Math.min(buttons.length, 3) + 1)) * 100}%`,
              boxShadow: `0 2px 6px ${meta.color}40`,
            }}
          />
        ))
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

export default memo(MessageNode);
