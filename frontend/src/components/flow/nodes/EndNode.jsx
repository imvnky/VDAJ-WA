/**
 * VDAJ Services — EndNode
 * Explicit flow terminus node (End / End flow)
 */

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

function EndNode({ data, selected }) {
  const label = data?.label || 'End';

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: selected ? '2px solid #534AB7' : '1.5px solid #E2E8F0',
        borderRadius: '20px',
        padding: '6px 16px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '11px',
        fontWeight: 700,
        color: '#475569',
        boxShadow: selected
          ? '0 0 0 3px rgba(83, 74, 183, 0.18), 0 4px 12px rgba(15, 23, 42, 0.08)'
          : '0 2px 6px rgba(15, 23, 42, 0.04)',
        transition: 'all 0.15s ease',
        cursor: 'pointer',
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="in"
        style={{
          background: '#94A3B8',
          border: '2px solid #FFFFFF',
          width: 10,
          height: 10,
          top: -5,
        }}
      />
      <span style={{ fontSize: '12px' }}>🚩</span>
      <span>{label}</span>
    </div>
  );
}

export default memo(EndNode);
