/**
 * VDAJ Services — QuestionNode
 * Interactive Question with branch buttons (e.g. Swimming, Gym, Badminton)
 * and optional No-Response timeout branch.
 */

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

function QuestionNode({ data, selected }) {
  const label = data?.label || 'Choose an activity';
  const body = data.config?.body || 'Hi! What would you like to know about?';
  const buttons = data.config?.buttons || [
    { label: 'Swimming', value: 'swimming' },
    { label: 'Gym', value: 'gym' },
    { label: 'Badminton', value: 'badminton' },
  ];
  const hasTimeout = Boolean(data.config?.hasTimeout ?? true);

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: selected ? '2px solid #534AB7' : '1.5px solid #E2E8F0',
        borderRadius: '16px',
        minWidth: '260px',
        maxWidth: '300px',
        boxShadow: selected
          ? '0 0 0 4px rgba(83, 74, 183, 0.16), 0 12px 28px -4px rgba(83, 74, 183, 0.22)'
          : '0 4px 16px -2px rgba(15, 23, 42, 0.05), 0 2px 6px -1px rgba(15, 23, 42, 0.03)',
        transition: 'all 0.18s ease',
        cursor: 'pointer',
        position: 'relative',
      }}
    >
      {/* Input handle */}
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
          borderBottom: '1px solid #F3E8FF',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          borderRadius: '15px 15px 0 0',
        }}
      >
        <div
          style={{
            width: '30px',
            height: '30px',
            borderRadius: '9px',
            background: '#EDE9FE',
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
              margin: 0,
            }}
          >
            QUESTION
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
      </div>

      {/* Body & Stacked Buttons */}
      <div style={{ padding: '12px 14px' }}>
        <p
          style={{
            fontSize: '12px',
            color: '#334155',
            lineHeight: 1.4,
            margin: '0 0 10px',
            fontWeight: 500,
          }}
        >
          {body}
        </p>

        {/* Buttons list with individual handle dots */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {buttons.map((btn, i) => (
            <div
              key={i}
              style={{
                position: 'relative',
                padding: '7px 12px',
                borderRadius: '9px',
                textAlign: 'center',
                background: '#F8FAFC',
                border: '1px solid #CBD5E1',
                fontSize: '12px',
                fontWeight: 600,
                color: '#534AB7',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
              }}
            >
              {btn.label || `Option ${i + 1}`}
            </div>
          ))}
        </div>
      </div>

      {/* Button output handles at bottom */}
      {buttons.map((btn, i) => (
        <Handle
          key={i}
          type="source"
          position={Position.Bottom}
          id={`btn_${i}`}
          style={{
            background: '#534AB7',
            border: '3px solid #FFFFFF',
            width: 13,
            height: 13,
            bottom: -6,
            left: `${((i + 1) / (buttons.length + 1)) * 100}%`,
            boxShadow: '0 2px 6px rgba(83, 74, 183, 0.35)',
          }}
        />
      ))}

      {/* Timeout / No Response handle at right edge */}
      {hasTimeout && (
        <Handle
          type="source"
          position={Position.Right}
          id="timeout"
          style={{
            background: '#94A3B8',
            border: '3px solid #FFFFFF',
            width: 12,
            height: 12,
            right: -6,
            top: '50%',
            boxShadow: '0 2px 6px rgba(148, 163, 184, 0.4)',
          }}
        />
      )}
    </div>
  );
}

export default memo(QuestionNode);
