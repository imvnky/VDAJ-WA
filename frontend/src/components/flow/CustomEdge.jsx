/**
 * VDAJ Services — CustomEdge
 * Enterprise SmoothStep Edge with clickable (+) step insertion button
 * and branch label pill (e.g. Swimming, Gym, Badminton, No response - 24h).
 */

import React from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from '@xyflow/react';

export default function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  label,
}) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 16,
  });

  const edgeLabel = label || data?.label;
  const isDashed = data?.isDashed || (edgeLabel && edgeLabel.toLowerCase().includes('no response'));
  const strokeColor = isDashed ? '#94A3B8' : (style.stroke || '#534AB7');

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: strokeColor,
          strokeWidth: 2,
          strokeDasharray: isDashed ? '5,5' : undefined,
        }}
      />

      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            zIndex: 10,
          }}
          className="nodrag nopan"
        >
          {/* Branch Label Badge */}
          {edgeLabel && (
            <div
              style={{
                padding: '3px 10px',
                borderRadius: '12px',
                background: isDashed ? '#F1F5F9' : '#EDE9FE',
                border: isDashed ? '1px solid #CBD5E1' : '1px solid #DDD6FE',
                color: isDashed ? '#64748B' : '#534AB7',
                fontSize: '11px',
                fontWeight: 700,
                boxShadow: '0 2px 5px rgba(0,0,0,0.04)',
                whiteSpace: 'nowrap',
              }}
            >
              {edgeLabel}
            </div>
          )}

          {/* Click-to-add (+) Button */}
          {!isDashed && (
            <button
              type="button"
              title="Add step here"
              onClick={(e) => {
                e.stopPropagation();
                if (data?.onAddStep) data.onAddStep(id);
              }}
              style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: '#FFFFFF',
                border: '1.5px solid #CBD5E1',
                color: '#534AB7',
                fontSize: '13px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(15, 23, 42, 0.08)',
                transition: 'all 0.15s ease',
                padding: 0,
                lineHeight: 1,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#534AB7';
                e.currentTarget.style.background = '#EDE9FE';
                e.currentTarget.style.transform = 'scale(1.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#CBD5E1';
                e.currentTarget.style.background = '#FFFFFF';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              +
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
