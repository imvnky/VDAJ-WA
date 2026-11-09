/**
 * VDAJ Services — FormNode
 * Dedicated WhatsApp Form (Flow) Node with interactive in-app form preview,
 * CTA action button, and field badges.
 */

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

function FormNode({ data, selected }) {
  const label = data?.label || data?.config?.flowName || 'WhatsApp form';
  const body = data.config?.body || 'Please tap below to fill out your registration form.';
  const ctaText = data.config?.ctaText || 'Register Now';
  const fields = data.config?.fields || [
    { id: 'name', label: 'Full Name', type: 'text' },
    { id: 'phone', label: 'Phone Number', type: 'phone' },
    { id: 'activity', label: 'Activity (Swimming, Gym, Badminton)', type: 'select' },
  ];

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: selected ? '2px solid #534AB7' : '1.5px solid #DDD6FE',
        borderRadius: '16px',
        minWidth: '260px',
        maxWidth: '300px',
        boxShadow: selected
          ? '0 0 0 4px rgba(83, 74, 183, 0.16), 0 12px 28px -4px rgba(83, 74, 183, 0.22)'
          : '0 4px 16px -2px rgba(83, 74, 183, 0.08), 0 2px 6px -1px rgba(15, 23, 42, 0.03)',
        transition: 'all 0.18s ease',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top Input Handle */}
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

      {/* Header */}
      <div
        style={{
          padding: '10px 14px',
          background: selected ? '#F5F3FF' : '#FAF5FF',
          borderBottom: '1px solid #EDE9FE',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '9px',
            background: '#EDE9FE',
            border: '1px solid #DDD6FE',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '15px',
            flexShrink: 0,
            color: '#7C3AED',
          }}
        >
          📋
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
              margin: '0 0 2px',
            }}
          >
            WHATSAPP FORM
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

      {/* Form Content Preview */}
      <div style={{ padding: '12px 14px' }}>
        <p
          style={{
            fontSize: '11px',
            color: '#334155',
            lineHeight: 1.45,
            margin: '0 0 10px',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {body}
        </p>

        {/* CTA Button that triggers native WhatsApp Form */}
        <div
          style={{
            background: '#F3F2FD',
            border: '1.5px dashed #534AB7',
            borderRadius: '9px',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            color: '#534AB7',
            fontSize: '12px',
            fontWeight: 700,
            marginBottom: '10px',
          }}
        >
          <span>📋</span>
          <span>{ctaText}</span>
          <span style={{ fontSize: '10px' }}>↗</span>
        </div>

        {/* Form Fields Summary Badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {fields.slice(0, 3).map((f, i) => (
            <span
              key={i}
              style={{
                fontSize: '10px',
                fontWeight: 600,
                color: '#64748B',
                background: '#F1F5F9',
                padding: '2px 7px',
                borderRadius: '6px',
                border: '1px solid #E2E8F0',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              • {f.label}
            </span>
          ))}
          {fields.length > 3 && (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 600,
                color: '#7C3AED',
                background: '#F5F3FF',
                padding: '2px 6px',
                borderRadius: '6px',
              }}
            >
              +{fields.length - 3} more
            </span>
          )}
        </div>
      </div>

      {/* Handle output: on form submit */}
      <div
        style={{
          borderTop: '1px solid #F1F5F9',
          padding: '6px 14px',
          background: '#FAFAFE',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: '10px', fontWeight: 700, color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          On Form Submitted →
        </span>
        <Handle
          type="source"
          position={Position.Bottom}
          id="submitted"
          style={{
            background: '#10B981',
            border: '3px solid #FFFFFF',
            width: 14,
            height: 14,
            bottom: -7,
            boxShadow: '0 2px 6px rgba(16, 185, 129, 0.35)',
          }}
        />
      </div>
    </div>
  );
}

export default memo(FormNode);
