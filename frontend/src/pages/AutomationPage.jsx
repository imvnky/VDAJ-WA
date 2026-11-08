/**
 * VDAJ Services — AutomationPage (Enterprise Light Edition)
 * Full interactive visual flow builder using @xyflow/react.
 * Clean, modern SaaS workflow design matching VDAJ design system.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  MarkerType,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import TriggerNode from '../components/flow/nodes/TriggerNode';
import MessageNode from '../components/flow/nodes/MessageNode';
import DelayNode   from '../components/flow/nodes/DelayNode';
import ActionNode  from '../components/flow/nodes/ActionNode';
import NodeConfigDrawer from '../components/flow/NodeConfigDrawer';
import { automationApi } from '../lib/api';
import { showSuccess, showError } from '../components/atoms/Toast/Toast.jsx';

// ── Register custom node types ─────────────────────────────────
const NODE_TYPES = {
  trigger: TriggerNode,
  message: MessageNode,
  delay:   DelayNode,
  action:  ActionNode,
};

// ── Edge style ─────────────────────────────────────────────────
const EDGE_DEFAULTS = {
  type: 'smoothstep',
  animated: true,
  style: { stroke: '#534AB7', strokeWidth: 2 },
  markerEnd: { type: MarkerType.ArrowClosed, color: '#534AB7', width: 18, height: 18 },
};

// ── ID generator ───────────────────────────────────────────────
let nodeCounter = 0;
const newId = (type) => `${type}_${Date.now()}_${++nodeCounter}`;

// ── PALETTE ITEMS ──────────────────────────────────────────────
const PALETTE = [
  {
    section: 'Triggers',
    items: [
      { type: 'trigger', label: 'Keyword Received',   icon: '⌨️', config: { triggerType: 'keyword', keywords: [] } },
      { type: 'trigger', label: 'New Lead Added',     icon: '👤', config: { triggerType: 'new_lead' } },
      { type: 'trigger', label: 'Opt-In Received',    icon: '✅', config: { triggerType: 'opt_in' } },
    ],
  },
  {
    section: 'Messages',
    items: [
      { type: 'message', label: 'Send Text',           icon: '💬', config: { messageType: 'text' } },
      { type: 'message', label: 'Send Image',          icon: '🖼️', config: { messageType: 'image' } },
      { type: 'message', label: 'Interactive Buttons', icon: '🔘', config: { messageType: 'buttons', buttons: [{label:'Yes',value:'yes'},{label:'No',value:'no'}] } },
      { type: 'message', label: 'WA Flow Form',        icon: '📋', config: { messageType: 'wa_flow' } },
    ],
  },
  {
    section: 'Logic',
    items: [
      { type: 'delay',  label: 'Wait / Delay',         icon: '⏱️', config: { value: 1, unit: 'hours' } },
      { type: 'action', label: 'Check Condition',      icon: '❓', config: { actionType: 'condition', field: 'last_reply', operator: 'equals' } },
    ],
  },
  {
    section: 'Actions',
    items: [
      { type: 'action', label: 'Add Tag',              icon: '🏷️', config: { actionType: 'add_tag' } },
      { type: 'action', label: 'Remove Tag',           icon: '✂️', config: { actionType: 'remove_tag' } },
      { type: 'action', label: 'Assign to Agent',     icon: '👤', config: { actionType: 'assign' } },
      { type: 'action', label: 'Trigger Webhook',     icon: '🔗', config: { actionType: 'webhook' } },
    ],
  },
];

// ── Quick-start templates ──────────────────────────────────────
const TEMPLATES = {
  lead_qual: {
    name: 'Lead Qualification Bot',
    nodes: [
      { id: 'n1', type: 'trigger', position: { x: 300, y: 60 },  data: { label: 'Keyword Received', config: { triggerType: 'keyword', keywords: ['price','quote','info'] } } },
      { id: 'n2', type: 'message', position: { x: 300, y: 220 }, data: { label: 'Welcome Message', config: { messageType: 'buttons', body: 'Hi! Are you interested in our plans? 👋', buttons: [{label:'Yes, show me',value:'yes'},{label:'Not now',value:'no'}] } } },
      { id: 'n3', type: 'action',  position: { x: 160, y: 420 }, data: { label: 'Check Response',  config: { actionType: 'condition', field: 'last_reply', operator: 'equals', value: 'yes' } } },
      { id: 'n4', type: 'action',  position: { x: 60,  y: 580 }, data: { label: 'Tag Hot Lead',    config: { actionType: 'add_tag', tag: 'hot-lead' } } },
      { id: 'n5', type: 'message', position: { x: 540, y: 580 }, data: { label: 'Follow-up Later', config: { messageType: 'text', body: 'No problem! Feel free to reach out anytime. 😊' } } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', ...EDGE_DEFAULTS },
      { id: 'e2', source: 'n2', target: 'n3', ...EDGE_DEFAULTS },
      { id: 'e3', source: 'n3', sourceHandle: 'yes', target: 'n4', ...EDGE_DEFAULTS, style: { stroke: '#059669', strokeWidth: 2 }, label: 'Yes', markerEnd: { type: MarkerType.ArrowClosed, color: '#059669' } },
      { id: 'e4', source: 'n3', sourceHandle: 'no',  target: 'n5', ...EDGE_DEFAULTS, style: { stroke: '#DC2626', strokeWidth: 2 }, label: 'No',  markerEnd: { type: MarkerType.ArrowClosed, color: '#DC2626' } },
    ],
  },
  appointment: {
    name: 'Appointment Booking Flow',
    nodes: [
      { id: 'n1', type: 'trigger', position: { x: 300, y: 60 },  data: { label: 'Book Keyword',   config: { triggerType: 'keyword', keywords: ['book','appointment','slot'] } } },
      { id: 'n2', type: 'message', position: { x: 300, y: 220 }, data: { label: 'Pick a Slot',    config: { messageType: 'buttons', body: 'When would you like to book? 📅', buttons: [{label:'Today',value:'today'},{label:'Tomorrow',value:'tomorrow'},{label:'This Week',value:'week'}] } } },
      { id: 'n3', type: 'delay',   position: { x: 300, y: 420 }, data: { label: 'Wait for Reply', config: { value: 1, unit: 'hours' } } },
      { id: 'n4', type: 'message', position: { x: 300, y: 580 }, data: { label: 'Confirmation',   config: { messageType: 'text', body: "✅ Appointment confirmed! We'll send a reminder 1 hour before. See you soon!" } } },
      { id: 'n5', type: 'action',  position: { x: 300, y: 740 }, data: { label: 'Tag Booked',     config: { actionType: 'add_tag', tag: 'appointment-booked' } } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', ...EDGE_DEFAULTS },
      { id: 'e2', source: 'n2', target: 'n3', ...EDGE_DEFAULTS },
      { id: 'e3', source: 'n3', target: 'n4', ...EDGE_DEFAULTS },
      { id: 'e4', source: 'n4', target: 'n5', ...EDGE_DEFAULTS },
    ],
  },
  support: {
    name: 'Customer Support Triage',
    nodes: [
      { id: 'n1', type: 'trigger', position: { x: 300, y: 60 },  data: { label: 'Any Inbound',    config: { triggerType: 'inbound' } } },
      { id: 'n2', type: 'message', position: { x: 300, y: 220 }, data: { label: 'Auto-Reply',     config: { messageType: 'buttons', body: 'Hi! How can we help you today? 🙋', buttons: [{label:'Billing',value:'billing'},{label:'Technical',value:'tech'},{label:'Other',value:'other'}] } } },
      { id: 'n3', type: 'action',  position: { x: 100, y: 420 }, data: { label: 'Assign Billing', config: { actionType: 'assign', agentName: 'Billing Team' } } },
      { id: 'n4', type: 'action',  position: { x: 300, y: 420 }, data: { label: 'Assign Tech',    config: { actionType: 'assign', agentName: 'Tech Support' } } },
      { id: 'n5', type: 'action',  position: { x: 500, y: 420 }, data: { label: 'Tag & Assign',   config: { actionType: 'add_tag', tag: 'general-enquiry' } } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', ...EDGE_DEFAULTS },
      { id: 'e2', source: 'n2', sourceHandle: 'btn_0', target: 'n3', ...EDGE_DEFAULTS, label: 'Billing' },
      { id: 'e3', source: 'n2', sourceHandle: 'btn_1', target: 'n4', ...EDGE_DEFAULTS, label: 'Tech' },
      { id: 'e4', source: 'n2', sourceHandle: 'btn_2', target: 'n5', ...EDGE_DEFAULTS, label: 'Other' },
    ],
  },
};

// ── Help Guide Banner ──────────────────────────────────────────
function HelpGuideBanner({ onDismiss }) {
  return (
    <div
      style={{
        margin: '0',
        padding: '12px 18px',
        borderRadius: '16px',
        background: '#FFFFFF',
        border: '1px solid #DDD6FE',
        boxShadow: '0 4px 16px -2px rgba(83, 74, 183, 0.12), 0 2px 6px -1px rgba(83, 74, 183, 0.06)',
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', gap: '20px', flex: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        {[
          { n: '1', text: 'Drag nodes from the left palette to canvas', icon: '🖱️' },
          { n: '2', text: 'Connect nodes by dragging handles', icon: '🔗' },
          { n: '3', text: 'Click any node to configure, then click Publish', icon: '🚀' },
        ].map((s) => (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                flexShrink: 0,
                background: '#534AB7',
                color: '#FFFFFF',
                fontSize: '11px',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {s.n}
            </span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
              <span style={{ marginRight: 5 }}>{s.icon}</span>
              {s.text}
            </span>
          </div>
        ))}
      </div>
      <button
        onClick={onDismiss}
        style={{
          background: '#F1F5F9',
          border: 'none',
          color: '#64748B',
          cursor: 'pointer',
          width: 26,
          height: 26,
          borderRadius: '50%',
          fontSize: '12px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  );
}

// ── Template Modal ─────────────────────────────────────────────
function TemplateModal({ onSelect, onClose }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(15, 23, 42, 0.4)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '680px',
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '24px',
          padding: '28px',
          boxShadow: '0 24px 60px -12px rgba(15, 23, 42, 0.25)',
          animation: 'scaleIn 0.18s ease-out',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              Quick-Start WhatsApp Flows
            </h2>
            <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0' }}>
              Select a pre-configured automation flow to get started instantly
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#F1F5F9',
              border: 'none',
              color: '#64748B',
              cursor: 'pointer',
              width: 32,
              height: 32,
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 'bold',
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: '14px' }}>
          {Object.entries(TEMPLATES).map(([key, tpl]) => {
            const icons = { lead_qual: '🎯', appointment: '📅', support: '🎧' };
            const descs = {
              lead_qual: 'Qualify inbound leads with keyword triggers and automated Yes/No decision branches',
              appointment: 'Automate booking requests with slot selection buttons and auto confirmations',
              support: 'Triage customer inquiries directly to the correct agent or department',
            };
            return (
              <button
                key={key}
                onClick={() => onSelect(key)}
                style={{
                  padding: '20px',
                  borderRadius: '16px',
                  textAlign: 'left',
                  background: '#F8FAFC',
                  border: '1.5px solid #E2E8F0',
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#F5F3FF';
                  e.currentTarget.style.borderColor = '#534AB7';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px -4px rgba(83, 74, 183, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#F8FAFC';
                  e.currentTarget.style.borderColor = '#E2E8F0';
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>{icons[key]}</div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', marginBottom: '6px' }}>
                  {tpl.name}
                </div>
                <div style={{ fontSize: '11px', color: '#64748B', lineHeight: 1.5 }}>
                  {descs[key]}
                </div>
              </button>
            );
          })}
        </div>

        <button
          onClick={onClose}
          style={{
            width: '100%',
            marginTop: '20px',
            padding: '12px',
            borderRadius: '12px',
            background: '#F8FAFC',
            border: '1px solid #CBD5E1',
            color: '#475569',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 700,
          }}
        >
          Start from a blank canvas →
        </button>
      </div>
    </div>
  );
}

// ── Palette Item (Draggable) ───────────────────────────────────
function PaletteItem({ item }) {
  const onDragStart = (e) => {
    e.dataTransfer.setData('application/vdaj-node', JSON.stringify(item));
    e.dataTransfer.effectAllowed = 'move';
  };

  const TYPE_STYLES = {
    trigger: { bg: '#FAF5FF', border: '#F3E8FF', hoverBorder: '#DDD6FE', text: '#6D28D9' },
    message: { bg: '#F0F9FF', border: '#E0F2FE', hoverBorder: '#BAE6FD', text: '#0369A1' },
    delay:   { bg: '#FFFBEB', border: '#FEF3C7', hoverBorder: '#FDE68A', text: '#B45309' },
    action:  { bg: '#ECFDF5', border: '#D1FAE5', hoverBorder: '#A7F3D0', text: '#047857' },
  };

  const style = TYPE_STYLES[item.type] || TYPE_STYLES.trigger;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '9px 12px',
        borderRadius: '10px',
        cursor: 'grab',
        background: style.bg,
        border: `1px solid ${style.border}`,
        transition: 'all 0.15s ease',
        userSelect: 'none',
        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = style.hoverBorder;
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.05)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = style.border;
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.02)';
      }}
    >
      <span style={{ fontSize: '15px', flexShrink: 0 }}>{item.icon}</span>
      <span style={{ fontSize: '12px', fontWeight: 700, color: '#1E293B' }}>{item.label}</span>
      <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#94A3B8', fontWeight: 'bold' }}>⋮⋮</span>
    </div>
  );
}

// ── Left Palette Panel ─────────────────────────────────────────
function NodePalette({ flowList, activeFlowId, onSelectFlow, onNewFlow }) {
  return (
    <div
      style={{
        width: '240px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#FFFFFF',
        borderRight: '1px solid #E2E8F0',
        overflow: 'hidden',
        zIndex: 5,
      }}
    >
      {/* Flows list */}
      <div style={{ padding: '14px 14px 12px', borderBottom: '1px solid #E2E8F0', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <p
            style={{
              fontSize: '10px',
              fontWeight: 800,
              color: '#64748B',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              margin: 0,
            }}
          >
            My Flows
          </p>
          <button
            onClick={onNewFlow}
            style={{
              padding: '4px 10px',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: 700,
              background: '#EDE9FE',
              border: '1px solid #DDD6FE',
              color: '#534AB7',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            + New Flow
          </button>
        </div>
        <div style={{ maxHeight: '110px', overflowY: 'auto' }}>
          {flowList.length === 0 ? (
            <p style={{ fontSize: '11px', color: '#94A3B8', textAlign: 'center', padding: '10px 0', margin: 0 }}>
              No saved flows yet
            </p>
          ) : (
            flowList.map((f) => (
              <button
                key={f.id}
                onClick={() => onSelectFlow(f)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '7px 10px',
                  borderRadius: '8px',
                  background: activeFlowId === f.id ? '#F5F3FF' : 'transparent',
                  border: activeFlowId === f.id ? '1px solid #DDD6FE' : '1px solid transparent',
                  color: activeFlowId === f.id ? '#534AB7' : '#334155',
                  fontWeight: activeFlowId === f.id ? 700 : 500,
                  cursor: 'pointer',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '2px',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                <span style={{ color: f.status === 'active' ? '#10B981' : '#94A3B8', fontSize: '10px' }}>●</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Draggable palette */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
        <p
          style={{
            fontSize: '10px',
            fontWeight: 800,
            color: '#64748B',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: '12px',
            margin: 0,
          }}
        >
          Node Palette
        </p>
        {PALETTE.map((section) => (
          <div key={section.section} style={{ marginTop: '14px' }}>
            <p
              style={{
                fontSize: '10px',
                fontWeight: 800,
                color: '#94A3B8',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: '6px',
                paddingLeft: '2px',
                margin: 0,
              }}
            >
              {section.section}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {section.items.map((item) => (
                <PaletteItem key={item.label} item={item} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Top Action Bar ─────────────────────────────────────────────
function TopBar({ flowName, setFlowName, status, onSave, onPublish, onTest, onTemplate, saving }) {
  const statusMeta = {
    draft:  { label: 'Draft',  bg: '#F1F5F9', color: '#475569', border: '#E2E8F0', dot: '#94A3B8' },
    active: { label: 'Live',   bg: '#ECFDF5', color: '#059669', border: '#A7F3D0', dot: '#10B981' },
    paused: { label: 'Paused', bg: '#FFFBEB', color: '#D97706', border: '#FDE68A', dot: '#F59E0B' },
  };
  const sm = statusMeta[status] || statusMeta.draft;

  return (
    <div
      style={{
        height: '56px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '0 20px',
        background: '#FFFFFF',
        borderBottom: '1px solid #E2E8F0',
        zIndex: 10,
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
      }}
    >
      {/* Flow name & editable input */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input
          value={flowName}
          onChange={(e) => setFlowName(e.target.value)}
          placeholder="Untitled Flow…"
          style={{
            background: 'transparent',
            border: '1px solid transparent',
            outline: 'none',
            fontSize: '15px',
            fontWeight: 800,
            color: '#0F172A',
            padding: '4px 8px',
            borderRadius: '8px',
            fontFamily: 'Inter, sans-serif',
            transition: 'all 0.15s ease',
          }}
          onFocus={(e) => {
            e.target.style.background = '#F8FAFC';
            e.target.style.borderColor = '#CBD5E1';
          }}
          onBlur={(e) => {
            e.target.style.background = 'transparent';
            e.target.style.borderColor = 'transparent';
          }}
        />

        {/* Status pill */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '3px 10px',
            borderRadius: '20px',
            fontSize: '11px',
            fontWeight: 700,
            background: sm.bg,
            color: sm.color,
            border: `1px solid ${sm.border}`,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: sm.dot }} />
          {sm.label}
        </span>
      </div>

      <div style={{ flex: 1 }} />

      {/* Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={onTemplate}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            borderRadius: '10px',
            background: '#FFFFFF',
            border: '1px solid #CBD5E1',
            color: '#334155',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 700,
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            transition: 'all 0.15s ease',
          }}
        >
          <span>📐</span> Templates
        </button>

        <button
          onClick={onTest}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            borderRadius: '10px',
            background: '#FFFFFF',
            border: '1px solid #CBD5E1',
            color: '#334155',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 700,
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            transition: 'all 0.15s ease',
          }}
        >
          <span>▶</span> Simulator
        </button>

        <button
          onClick={onSave}
          disabled={saving}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 16px',
            borderRadius: '10px',
            background: '#F1F5F9',
            border: '1px solid #E2E8F0',
            color: '#0F172A',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 700,
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            transition: 'all 0.15s ease',
          }}
        >
          <span>💾</span> {saving ? 'Saving...' : 'Save Draft'}
        </button>

        <button
          onClick={onPublish}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 18px',
            borderRadius: '10px',
            background: '#534AB7',
            border: 'none',
            color: '#FFFFFF',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 800,
            boxShadow: '0 4px 14px rgba(83, 74, 183, 0.25)',
            transition: 'all 0.15s ease',
          }}
        >
          <span>🚀</span> Publish Flow
        </button>
      </div>
    </div>
  );
}

// ── Flow Canvas Inner Component ────────────────────────────────
function FlowCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [flowName, setFlowName] = useState('Untitled Flow');
  const [activeFlowId, setActiveFlowId] = useState(null);
  const [status, setStatus] = useState('draft');
  const [flowList, setFlowList] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showBanner, setShowBanner] = useState(true);

  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);

  // Load flows on mount
  useEffect(() => {
    automationApi.list()
      .then((res) => {
        const list = res.data?.flows || res.data || [];
        setFlowList(list);
      })
      .catch(() => {});
  }, []);

  // Connect edges
  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, ...EDGE_DEFAULTS }, eds)),
    [setEdges]
  );

  // Node selection
  const onNodeClick = useCallback((_, node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Drag and drop from palette to canvas
  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData('application/vdaj-node');
      if (!raw) return;
      const item = JSON.parse(raw);

      if (!reactFlowInstance || !reactFlowWrapper.current) return;
      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const pos = reactFlowInstance.screenToFlowPosition({
        x: e.clientX - bounds.left,
        y: e.clientY - bounds.top,
      });

      const newNode = {
        id: newId(item.type),
        type: item.type,
        position: pos,
        data: { label: item.label, config: { ...item.config } },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [reactFlowInstance, setNodes]
  );

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  // Update node data from drawer
  const updateNodeData = useCallback(
    (nodeId, updates) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...updates } } : n))
      );
      setSelectedNode((prev) =>
        prev?.id === nodeId ? { ...prev, data: { ...prev.data, ...updates } } : prev
      );
    },
    [setNodes]
  );

  // Delete node
  const deleteNode = useCallback(
    (nodeId) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      setSelectedNode(null);
      showSuccess('Step removed from flow.');
    },
    [setNodes, setEdges]
  );

  // Load template
  const loadTemplate = (key) => {
    const tpl = TEMPLATES[key];
    if (!tpl) return;
    setFlowName(tpl.name);
    setNodes(tpl.nodes);
    setEdges(tpl.edges);
    setShowTemplates(false);
  };

  // Helper to re-hydrate nodes for React Flow
  const toRfNode = (n) => ({
    id: n.id,
    type: n.type || 'message',
    position: n.position || { x: 300, y: 100 },
    data: n.data || { label: n.label || 'Step', config: n.config || {} },
  });

  // Load flow
  const loadFlow = (f) => {
    setFlowName(f.name);
    setActiveFlowId(f.id);
    setStatus(f.is_active ? 'active' : (f.status || 'draft'));
    if (f.steps) {
      if (Array.isArray(f.steps)) {
        setNodes(f.steps.filter((s) => !s.source).map(toRfNode));
        setEdges(f.steps.filter((s) => s.source));
      } else if (typeof f.steps === 'object') {
        const loadedNodes = (f.steps.nodes || []).map(toRfNode);
        const loadedEdges = (f.steps.edges || []).map((e) => ({
          ...EDGE_DEFAULTS,
          ...e,
        }));
        setNodes(loadedNodes);
        setEdges(loadedEdges);
      }
    }
  };

  // Save flow
  const saveFlow = async () => {
    if (!flowName.trim()) {
      showError('Please enter a name for this automation flow.');
      return null;
    }

    if (nodes.length === 0) {
      showError('Cannot save an empty flow. Add at least one Trigger and Message step.');
      return null;
    }

    const triggerNode = nodes.find((n) => n.type === 'trigger');
    const triggerType = triggerNode?.data?.config?.triggerType || 'keyword';
    const triggerConfig = triggerNode?.data?.config || {};

    setSaving(true);
    let savedId = activeFlowId;
    try {
      const payload = {
        name: flowName.trim(),
        triggerType,
        triggerConfig,
        steps: {
          nodes: nodes.map((n) => ({
            id: n.id,
            type: n.type,
            position: n.position,
            data: n.data,
          })),
          edges: edges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            sourceHandle: e.sourceHandle || null,
            targetHandle: e.targetHandle || null,
            label: e.label || null,
          })),
        },
      };

      if (activeFlowId) {
        await automationApi.update(activeFlowId, payload);
      } else {
        const res = await automationApi.create(payload);
        savedId = res?.data?.id;
        setActiveFlowId(savedId);
        setFlowList((fl) => [res.data, ...fl]);
      }
      showSuccess('Flow saved successfully with all connections.');
      return savedId;
    } catch {
      showError('Failed to save flow.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  // Publish
  const publishFlow = async () => {
    if (nodes.length === 0) {
      showError('Add steps to your flow before publishing.');
      return;
    }

    const hasTrigger = nodes.some((n) => n.type === 'trigger');
    if (!hasTrigger) {
      showError('Your flow needs at least one Trigger node (e.g. Keyword Received) to start.');
      return;
    }

    let targetId = activeFlowId;
    if (!targetId) {
      targetId = await saveFlow();
    }
    if (!targetId) return;

    try {
      await automationApi.update(targetId, { isActive: true });
      setActiveFlowId(targetId);
      setStatus('active');
      showSuccess('Flow is now LIVE on WhatsApp! 🚀');
    } catch {
      showError('Publish failed.');
    }
  };

  const testSimulator = () => {
    showSuccess('Test Simulator ready. Select or test steps on active WhatsApp line.');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden' }}>
      <TopBar
        flowName={flowName}
        setFlowName={setFlowName}
        status={status}
        onSave={saveFlow}
        onPublish={publishFlow}
        onTest={testSimulator}
        onTemplate={() => setShowTemplates(true)}
        saving={saving}
      />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Left Palette */}
        <NodePalette
          flowList={flowList}
          activeFlowId={activeFlowId}
          onSelectFlow={loadFlow}
          onNewFlow={() => {
            setNodes([]);
            setEdges([]);
            setFlowName('Untitled Flow');
            setActiveFlowId(null);
            setStatus('draft');
            setShowTemplates(true);
          }}
        />

        {/* React Flow Canvas */}
        <div ref={reactFlowWrapper} style={{ flex: 1, position: 'relative', height: '100%', background: '#F8FAFC' }}>
          {showBanner && (
            <div style={{ position: 'absolute', top: 14, left: 14, right: 14, zIndex: 20 }}>
              <HelpGuideBanner onDismiss={() => setShowBanner(false)} />
            </div>
          )}

          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={NODE_TYPES}
            defaultEdgeOptions={EDGE_DEFAULTS}
            fitView
            deleteKeyCode="Delete"
            style={{ background: '#F8FAFC' }}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="#CBD5E1" />

            <Controls
              style={{
                background: '#FFFFFF',
                border: '1px solid #CBD5E1',
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
                overflow: 'hidden',
              }}
            />

            <MiniMap
              style={{
                background: '#FFFFFF',
                border: '1px solid #CBD5E1',
                borderRadius: '12px',
                boxShadow: '0 4px 14px rgba(15, 23, 42, 0.08)',
                width: 160,
                height: 100,
              }}
              nodeColor={(n) => {
                const colors = { trigger: '#7C3AED', message: '#2563EB', delay: '#D97706', action: '#059669' };
                return colors[n.type] || '#534AB7';
              }}
              maskColor="rgba(83, 74, 183, 0.05)"
            />

            {/* Empty state */}
            {nodes.length === 0 && (
              <Panel position="top-center">
                <div
                  style={{
                    marginTop: showBanner ? '90px' : '40px',
                    padding: '32px 40px',
                    borderRadius: '24px',
                    textAlign: 'center',
                    background: '#FFFFFF',
                    border: '1.5px dashed #CBD5E1',
                    boxShadow: '0 20px 40px -15px rgba(15, 23, 42, 0.1)',
                    maxWidth: '380px',
                  }}
                >
                  <div
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: '16px',
                      background: '#F5F3FF',
                      border: '1px solid #DDD6FE',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '24px',
                      margin: '0 auto 16px',
                    }}
                  >
                    ⚡
                  </div>
                  <p style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', margin: '0 0 6px' }}>
                    Canvas is ready
                  </p>
                  <p style={{ fontSize: '12px', color: '#64748B', margin: '0 0 20px', lineHeight: 1.5 }}>
                    Drag a Trigger from the left panel onto the canvas, or pick a pre-configured template.
                  </p>
                  <button
                    onClick={() => setShowTemplates(true)}
                    type="button"
                    style={{
                      padding: '10px 22px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 700,
                      background: '#534AB7',
                      border: 'none',
                      color: '#FFFFFF',
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(83, 74, 183, 0.25)',
                    }}
                  >
                    📐 Choose a Template
                  </button>
                </div>
              </Panel>
            )}
          </ReactFlow>

          {/* Node Config Drawer */}
          {selectedNode && (
            <NodeConfigDrawer
              node={selectedNode}
              onClose={() => setSelectedNode(null)}
              onUpdate={updateNodeData}
              onDelete={deleteNode}
            />
          )}
        </div>
      </div>

      {/* Template Modal */}
      {showTemplates && <TemplateModal onSelect={loadTemplate} onClose={() => setShowTemplates(false)} />}
    </div>
  );
}

// ── Page Wrapper (ReactFlowProvider required) ──────────────────
export default function AutomationPage() {
  return (
    <div style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
      <ReactFlowProvider>
        <FlowCanvas />
      </ReactFlowProvider>
    </div>
  );
}
