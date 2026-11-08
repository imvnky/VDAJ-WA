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
import DelayNode from '../components/flow/nodes/DelayNode';
import ActionNode from '../components/flow/nodes/ActionNode';
import NodeConfigDrawer from '../components/flow/NodeConfigDrawer';
import { automationApi } from '../lib/api';
import { showSuccess, showError } from '../components/atoms/Toast/Toast.jsx';

// ── Register custom node types ─────────────────────────────────
const NODE_TYPES = {
  trigger: TriggerNode,
  message: MessageNode,
  delay: DelayNode,
  action: ActionNode,
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
      { type: 'trigger', label: 'Keyword Received', icon: '⌨️', config: { triggerType: 'keyword', keywords: [] } },
      { type: 'trigger', label: 'New Lead Added', icon: '👤', config: { triggerType: 'new_lead' } },
      { type: 'trigger', label: 'Opt-In Received', icon: '✅', config: { triggerType: 'opt_in' } },
    ],
  },
  {
    section: 'Messages',
    items: [
      { type: 'message', label: 'Send Text', icon: '💬', config: { messageType: 'text' } },
      { type: 'message', label: 'Send Image', icon: '🖼️', config: { messageType: 'image' } },
      { type: 'message', label: 'Interactive Buttons', icon: '🔘', config: { messageType: 'buttons', buttons: [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }] } },
      { type: 'message', label: 'WA Flow Form', icon: '📋', config: { messageType: 'wa_flow' } },
    ],
  },
  {
    section: 'Logic',
    items: [
      { type: 'delay', label: 'Wait / Delay', icon: '⏱️', config: { value: 1, unit: 'hours' } },
      { type: 'action', label: 'Check Condition', icon: '❓', config: { actionType: 'condition', field: 'last_reply', operator: 'equals' } },
    ],
  },
  {
    section: 'Actions',
    items: [
      { type: 'action', label: 'Add Tag', icon: '🏷️', config: { actionType: 'add_tag' } },
      { type: 'action', label: 'Remove Tag', icon: '✂️', config: { actionType: 'remove_tag' } },
      { type: 'action', label: 'Assign to Agent', icon: '👤', config: { actionType: 'assign' } },
      { type: 'action', label: 'Trigger Webhook', icon: '🔗', config: { actionType: 'webhook' } },
    ],
  },
];

// ── Quick-start templates ──────────────────────────────────────
const TEMPLATES = {
  blank: {
    name: 'New Custom Flow',
    nodes: [
      { id: 'n1', type: 'trigger', position: { x: 300, y: 60 }, data: { label: 'Keyword Received', config: { triggerType: 'keyword', keywords: ['hi', 'help', 'info'] } } },
      { id: 'n2', type: 'message', position: { x: 300, y: 220 }, data: { label: 'Welcome Message', config: { messageType: 'text', body: 'Hello! Thank you for contacting us. How can we assist you today?' } } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', ...EDGE_DEFAULTS },
    ],
  },
  lead_qual: {
    name: 'Lead Qualification Bot',
    nodes: [
      { id: 'n1', type: 'trigger', position: { x: 300, y: 60 }, data: { label: 'Keyword Received', config: { triggerType: 'keyword', keywords: ['price', 'quote', 'info'] } } },
      { id: 'n2', type: 'message', position: { x: 300, y: 220 }, data: { label: 'Welcome Message', config: { messageType: 'buttons', body: 'Hi! Are you interested in our plans? 👋', buttons: [{ label: 'Yes, show me', value: 'yes' }, { label: 'Not now', value: 'no' }] } } },
      { id: 'n3', type: 'action', position: { x: 160, y: 420 }, data: { label: 'Check Response', config: { actionType: 'condition', field: 'last_reply', operator: 'equals', value: 'yes' } } },
      { id: 'n4', type: 'action', position: { x: 60, y: 580 }, data: { label: 'Tag Hot Lead', config: { actionType: 'add_tag', tag: 'hot-lead' } } },
      { id: 'n5', type: 'message', position: { x: 540, y: 580 }, data: { label: 'Follow-up Later', config: { messageType: 'text', body: 'No problem! Feel free to reach out anytime. 😊' } } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2', ...EDGE_DEFAULTS },
      { id: 'e2', source: 'n2', target: 'n3', ...EDGE_DEFAULTS },
      { id: 'e3', source: 'n3', sourceHandle: 'yes', target: 'n4', ...EDGE_DEFAULTS, style: { stroke: '#059669', strokeWidth: 2 }, label: 'Yes', markerEnd: { type: MarkerType.ArrowClosed, color: '#059669' } },
      { id: 'e4', source: 'n3', sourceHandle: 'no', target: 'n5', ...EDGE_DEFAULTS, style: { stroke: '#DC2626', strokeWidth: 2 }, label: 'No', markerEnd: { type: MarkerType.ArrowClosed, color: '#DC2626' } },
    ],
  },
  appointment: {
    name: 'Appointment Booking Flow',
    nodes: [
      { id: 'n1', type: 'trigger', position: { x: 300, y: 60 }, data: { label: 'Book Keyword', config: { triggerType: 'keyword', keywords: ['book', 'appointment', 'slot'] } } },
      { id: 'n2', type: 'message', position: { x: 300, y: 220 }, data: { label: 'Pick a Slot', config: { messageType: 'buttons', body: 'When would you like to book? 📅', buttons: [{ label: 'Today', value: 'today' }, { label: 'Tomorrow', value: 'tomorrow' }, { label: 'This Week', value: 'week' }] } } },
      { id: 'n3', type: 'delay', position: { x: 300, y: 420 }, data: { label: 'Wait for Reply', config: { value: 1, unit: 'hours' } } },
      { id: 'n4', type: 'message', position: { x: 300, y: 580 }, data: { label: 'Confirmation', config: { messageType: 'text', body: "✅ Appointment confirmed! We'll send a reminder 1 hour before. See you soon!" } } },
      { id: 'n5', type: 'action', position: { x: 300, y: 740 }, data: { label: 'Tag Booked', config: { actionType: 'add_tag', tag: 'appointment-booked' } } },
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
      { id: 'n1', type: 'trigger', position: { x: 300, y: 60 }, data: { label: 'Any Inbound', config: { triggerType: 'inbound' } } },
      { id: 'n2', type: 'message', position: { x: 300, y: 220 }, data: { label: 'Auto-Reply', config: { messageType: 'buttons', body: 'Hi! How can we help you today? 🙋', buttons: [{ label: 'Billing', value: 'billing' }, { label: 'Technical', value: 'tech' }, { label: 'Other', value: 'other' }] } } },
      { id: 'n3', type: 'action', position: { x: 100, y: 420 }, data: { label: 'Assign Billing', config: { actionType: 'assign', agentName: 'Billing Team' } } },
      { id: 'n4', type: 'action', position: { x: 300, y: 420 }, data: { label: 'Assign Tech', config: { actionType: 'assign', agentName: 'Tech Support' } } },
      { id: 'n5', type: 'action', position: { x: 500, y: 420 }, data: { label: 'Tag & Assign', config: { actionType: 'add_tag', tag: 'general-enquiry' } } },
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

// ── Create Flow Modal ──────────────────────────────────────────
function CreateFlowModal({ onSelect, onClose }) {
  const [nameInput, setNameInput] = useState('');

  const handleCreate = (tplKey) => {
    const tpl = TEMPLATES[tplKey] || TEMPLATES.blank;
    const finalName = nameInput.trim() || tpl.name || 'New Custom Flow';
    onSelect(tplKey, finalName);
  };

  const templatesList = [
    {
      key: 'blank',
      name: 'Blank Flow Canvas',
      icon: '🚀',
      desc: 'Start with a clean canvas containing a default Trigger & Welcome Message.',
    },
    {
      key: 'lead_qual',
      name: 'Lead Qualification Bot',
      icon: '🎯',
      desc: 'Qualify inbound leads with keyword triggers and automated Yes/No decision branches.',
    },
    {
      key: 'appointment',
      name: 'Appointment Booking Flow',
      icon: '📅',
      desc: 'Automate booking requests with slot selection buttons and auto confirmations.',
    },
    {
      key: 'support',
      name: 'Customer Support Triage',
      icon: '🎧',
      desc: 'Triage customer inquiries directly to the correct agent or department.',
    },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(15, 23, 42, 0.45)',
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
              Create New WhatsApp Flow
            </h2>
            <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0' }}>
              Give your flow a name and pick a starter layout
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

        {/* Flow Name Input */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
            Flow Name
          </label>
          <input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="e.g. SMR Membership Inquiries, Welcome Bot..."
            style={{
              width: '100%',
              padding: '11px 14px',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 600,
              background: '#F8FAFC',
              border: '1.5px solid #CBD5E1',
              color: '#0F172A',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <p style={{ fontSize: '11px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
          Choose Starting Template
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '12px' }}>
          {templatesList.map((tpl) => (
            <button
              key={tpl.key}
              onClick={() => handleCreate(tpl.key)}
              style={{
                padding: '16px',
                borderRadius: '14px',
                textAlign: 'left',
                background: '#F8FAFC',
                border: '1.5px solid #E2E8F0',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start',
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
              <div style={{ fontSize: '28px', flexShrink: 0 }}>{tpl.icon}</div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', marginBottom: '4px' }}>
                  {tpl.name}
                </div>
                <div style={{ fontSize: '11px', color: '#64748B', lineHeight: 1.4 }}>
                  {tpl.desc}
                </div>
              </div>
            </button>
          ))}
        </div>
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
    delay: { bg: '#FFFBEB', border: '#FEF3C7', hoverBorder: '#FDE68A', text: '#B45309' },
    action: { bg: '#ECFDF5', border: '#D1FAE5', hoverBorder: '#A7F3D0', text: '#047857' },
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
function NodePalette({ flowList, activeFlowId, onSelectFlow, onNewFlow, onDeleteFlow }) {
  return (
    <div
      style={{
        width: '250px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#FFFFFF',
        borderRight: '1px solid #E2E8F0',
        overflow: 'hidden',
        zIndex: 5,
      }}
    >
      {/* Flows list header */}
      <div style={{ padding: '14px', borderBottom: '1px solid #E2E8F0', flexShrink: 0, background: '#FAFAFD' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <p
            style={{
              fontSize: '11px',
              fontWeight: 800,
              color: '#475569',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              margin: 0,
            }}
          >
            My WhatsApp Flows ({flowList.length})
          </p>
          <button
            onClick={onNewFlow}
            style={{
              padding: '4px 10px',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: 700,
              background: '#534AB7',
              border: 'none',
              color: '#FFFFFF',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: '0 2px 6px rgba(83, 74, 183, 0.25)',
              transition: 'all 0.15s ease',
            }}
          >
            <span>+</span> New Flow
          </button>
        </div>
        <div style={{ maxHeight: '140px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {flowList.length === 0 ? (
            <div style={{ padding: '12px 6px', textAlign: 'center', background: '#FFFFFF', borderRadius: '8px', border: '1px dashed #CBD5E1' }}>
              <p style={{ fontSize: '11px', color: '#64748B', fontWeight: 600, margin: '0 0 6px' }}>
                No saved flows yet
              </p>
              <button
                onClick={onNewFlow}
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#534AB7',
                  background: '#EDE9FE',
                  border: 'none',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                + Create your first flow
              </button>
            </div>
          ) : (
            flowList.map((f) => {
              const isSelected = activeFlowId === f.id;
              return (
                <div
                  key={f.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: '8px',
                    background: isSelected ? '#F5F3FF' : '#FFFFFF',
                    border: isSelected ? '1.5px solid #534AB7' : '1px solid #E2E8F0',
                    transition: 'all 0.15s',
                  }}
                >
                  <button
                    onClick={() => onSelectFlow(f)}
                    style={{
                      flex: 1,
                      textAlign: 'left',
                      padding: '8px 10px',
                      background: 'transparent',
                      border: 'none',
                      color: isSelected ? '#534AB7' : '#1E293B',
                      fontWeight: isSelected ? 800 : 600,
                      cursor: 'pointer',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        background: f.is_active ? '#10B981' : '#94A3B8',
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.name}
                    </span>
                  </button>
                  <button
                    onClick={(e) => onDeleteFlow(f.id, e)}
                    title="Delete Flow"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#94A3B8',
                      cursor: 'pointer',
                      padding: '6px 8px',
                      fontSize: '11px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#DC2626')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#94A3B8')}
                  >
                    ✕
                  </button>
                </div>
              );
            })
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
function TopBar({ flowName, setFlowName, status, onSave, onPublish, onTest, onNewFlow, onDelete, saving, hasActiveFlow }) {
  const statusMeta = {
    draft: { label: 'Draft', bg: '#F1F5F9', color: '#475569', border: '#E2E8F0', dot: '#94A3B8' },
    active: { label: 'Live', bg: '#ECFDF5', color: '#059669', border: '#A7F3D0', dot: '#10B981' },
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
        <div style={{ display: 'flex', alignItems: 'center', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '0 8px' }}>
          <span style={{ fontSize: '13px', color: '#64748B', marginRight: '4px' }}>✏️</span>
          <input
            value={flowName}
            onChange={(e) => setFlowName(e.target.value)}
            placeholder="Untitled Flow…"
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: '14px',
              fontWeight: 800,
              color: '#0F172A',
              padding: '6px 4px',
              fontFamily: 'Inter, sans-serif',
              minWidth: '180px',
            }}
          />
        </div>

        {/* Status pill */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
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
          onClick={onNewFlow}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            borderRadius: '10px',
            background: '#EDE9FE',
            border: '1.5px solid #DDD6FE',
            color: '#534AB7',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 800,
            transition: 'all 0.15s ease',
          }}
        >
          <span>+</span> New Flow
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

        {hasActiveFlow && (
          <button
            onClick={onDelete}
            title="Delete this flow"
            style={{
              padding: '7px 12px',
              borderRadius: '10px',
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              color: '#DC2626',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 700,
              transition: 'all 0.15s ease',
            }}
          >
            🗑️
          </button>
        )}
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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBanner, setShowBanner] = useState(true);

  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);

  // Helper to re-hydrate nodes for React Flow
  const toRfNode = (n) => ({
    id: n.id,
    type: n.type || 'message',
    position: n.position || { x: 300, y: 100 },
    data: n.data || { label: n.label || 'Step', config: n.config || {} },
  });

  // Load flow into canvas with safe stringified JSON parsing
  const loadFlow = useCallback((f) => {
    if (!f) return;
    setFlowName(f.name || 'Untitled Flow');
    setActiveFlowId(f.id);
    setStatus(f.is_active ? 'active' : (f.status || 'draft'));

    let rawSteps = f.steps;
    if (typeof rawSteps === 'string') {
      try {
        rawSteps = JSON.parse(rawSteps);
        if (typeof rawSteps === 'string') {
          rawSteps = JSON.parse(rawSteps);
        }
      } catch (err) {
        console.warn('Could not parse steps JSON:', err);
      }
    }

    if (rawSteps) {
      if (Array.isArray(rawSteps)) {
        setNodes(rawSteps.filter((s) => !s.source).map(toRfNode));
        setEdges(rawSteps.filter((s) => s.source));
      } else if (typeof rawSteps === 'object') {
        const loadedNodes = (rawSteps.nodes || []).map(toRfNode);
        const loadedEdges = (rawSteps.edges || []).map((e) => ({
          ...EDGE_DEFAULTS,
          ...e,
        }));
        setNodes(loadedNodes);
        setEdges(loadedEdges);
      }
    } else {
      setNodes([]);
      setEdges([]);
    }
  }, [setNodes, setEdges]);

  // Load flows on mount and auto-select the first flow
  useEffect(() => {
    automationApi.list()
      .then((res) => {
        const list = res.data?.flows || res.data || [];
        setFlowList(list);
        if (list.length > 0) {
          loadFlow(list[0]);
        }
      })
      .catch(() => { });
  }, [loadFlow]);

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

  // Create new flow or load template
  const handleSelectTemplate = (tplKey, customName) => {
    const tpl = TEMPLATES[tplKey] || TEMPLATES.blank;
    const nameToUse = customName || tpl.name || 'New Custom Flow';
    setFlowName(nameToUse);
    setActiveFlowId(null);
    setStatus('draft');
    setNodes(tpl.nodes);
    setEdges(tpl.edges);
    setShowCreateModal(false);
    showSuccess(`Created flow "${nameToUse}". Click "Save Draft" or "Publish Flow" to persist.`);
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
        const res = await automationApi.update(activeFlowId, payload);
        const updated = res?.data;
        if (updated) {
          setFlowList((prev) =>
            prev.map((item) => (item.id === activeFlowId ? { ...item, ...updated } : item))
          );
        }
      } else {
        const res = await automationApi.create(payload);
        savedId = res?.data?.id;
        setActiveFlowId(savedId);
        if (res?.data) {
          setFlowList((prev) => [res.data, ...prev]);
        }
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
      setFlowList((prev) =>
        prev.map((item) => (item.id === targetId ? { ...item, is_active: true } : item))
      );
      showSuccess('Flow is now LIVE on WhatsApp! 🚀');
    } catch {
      showError('Publish failed.');
    }
  };

  // Delete Flow
  const handleDeleteFlow = async (flowId, e) => {
    if (e) e.stopPropagation();
    const targetId = flowId || activeFlowId;
    if (!targetId) return;

    if (!window.confirm('Are you sure you want to delete this automation flow?')) {
      return;
    }

    try {
      await automationApi.delete(targetId);
      const remaining = flowList.filter((item) => item.id !== targetId);
      setFlowList(remaining);
      if (activeFlowId === targetId) {
        if (remaining.length > 0) {
          loadFlow(remaining[0]);
        } else {
          setNodes([]);
          setEdges([]);
          setFlowName('Untitled Flow');
          setActiveFlowId(null);
          setStatus('draft');
        }
      }
      showSuccess('Flow deleted successfully.');
    } catch {
      showError('Failed to delete flow.');
    }
  };

  const testSimulator = () => {
    showSuccess('Test Simulator ready. Send any configured keyword to your WhatsApp number to test.');
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
        onNewFlow={() => setShowCreateModal(true)}
        onDelete={() => handleDeleteFlow(activeFlowId)}
        saving={saving}
        hasActiveFlow={Boolean(activeFlowId)}
      />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Left Palette */}
        <NodePalette
          flowList={flowList}
          activeFlowId={activeFlowId}
          onSelectFlow={loadFlow}
          onNewFlow={() => setShowCreateModal(true)}
          onDeleteFlow={handleDeleteFlow}
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
                    onClick={() => setShowCreateModal(true)}
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
                    🚀 Create Flow or Choose Template
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

      {/* Create Flow Modal */}
      {showCreateModal && (
        <CreateFlowModal
          onSelect={handleSelectTemplate}
          onClose={() => setShowCreateModal(false)}
        />
      )}
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
