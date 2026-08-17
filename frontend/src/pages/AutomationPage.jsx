/**
 * VDAJ Services — AutomationPage v2
 * Full interactive visual flow builder using @xyflow/react.
 * Left palette → canvas → right config drawer.
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
import { useTheme } from '../context/ThemeContext';

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
  style: { stroke: '#AFA9EC', strokeWidth: 2 },
  markerEnd: { type: MarkerType.ArrowClosed, color: '#AFA9EC', width: 18, height: 18 },
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
      { type: 'trigger', label: 'New Lead Added',   icon: '👤', config: { triggerType: 'new_lead' } },
      { type: 'trigger', label: 'Opt-In Received',  icon: '✅', config: { triggerType: 'opt_in' } },
    ],
  },
  {
    section: 'Messages',
    items: [
      { type: 'message', label: 'Send Text',         icon: '💬', config: { messageType: 'text' } },
      { type: 'message', label: 'Send Image',        icon: '🖼️', config: { messageType: 'image' } },
      { type: 'message', label: 'Interactive Buttons', icon: '🔘', config: { messageType: 'buttons', buttons: [{label:'Yes',value:'yes'},{label:'No',value:'no'}] } },
      { type: 'message', label: 'WA Flow Form',      icon: '📋', config: { messageType: 'wa_flow' } },
    ],
  },
  {
    section: 'Logic',
    items: [
      { type: 'delay',  label: 'Wait / Delay',       icon: '⏱️', config: { value: 1, unit: 'hours' } },
      { type: 'action', label: 'Check Condition',    icon: '❓', config: { actionType: 'condition', field: 'last_reply', operator: 'equals' } },
    ],
  },
  {
    section: 'Actions',
    items: [
      { type: 'action', label: 'Add Tag',            icon: '🏷️', config: { actionType: 'add_tag' } },
      { type: 'action', label: 'Remove Tag',         icon: '✂️', config: { actionType: 'remove_tag' } },
      { type: 'action', label: 'Assign to Agent',   icon: '👤', config: { actionType: 'assign' } },
      { type: 'action', label: 'Trigger Webhook',   icon: '🔗', config: { actionType: 'webhook' } },
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
      { id: 'e3', source: 'n3', sourceHandle: 'yes', target: 'n4', ...EDGE_DEFAULTS, style: { stroke: '#1D9E75', strokeWidth: 2 }, label: 'Yes', markerEnd: { type: MarkerType.ArrowClosed, color: '#1D9E75' } },
      { id: 'e4', source: 'n3', sourceHandle: 'no',  target: 'n5', ...EDGE_DEFAULTS, style: { stroke: '#f87171', strokeWidth: 2 }, label: 'No',  markerEnd: { type: MarkerType.ArrowClosed, color: '#f87171' } },
    ],
  },
  appointment: {
    name: 'Appointment Booking Flow',
    nodes: [
      { id: 'n1', type: 'trigger', position: { x: 300, y: 60 },  data: { label: 'Book Keyword',   config: { triggerType: 'keyword', keywords: ['book','appointment','slot'] } } },
      { id: 'n2', type: 'message', position: { x: 300, y: 220 }, data: { label: 'Pick a Slot',    config: { messageType: 'buttons', body: 'When would you like to book? 📅', buttons: [{label:'Today',value:'today'},{label:'Tomorrow',value:'tomorrow'},{label:'This Week',value:'week'}] } } },
      { id: 'n3', type: 'delay',   position: { x: 300, y: 420 }, data: { label: 'Wait for Reply', config: { value: 1, unit: 'hours' } } },
      { id: 'n4', type: 'message', position: { x: 300, y: 580 }, data: { label: 'Confirmation',   config: { messageType: 'text', body: '✅ Appointment confirmed! We\'ll send a reminder 1 hour before. See you soon!' } } },
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
    <div style={{
      margin: '0 0 12px 0',
      padding: '12px 16px',
      borderRadius: '14px',
      background: 'linear-gradient(135deg, rgba(83,74,183,0.15) 0%, rgba(29,158,117,0.1) 100%)',
      border: '1px solid rgba(83,74,183,0.3)',
      display: 'flex', alignItems: 'center', gap: '20px',
      flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', gap: '20px', flex: 1, flexWrap: 'wrap' }}>
        {[
          { n: '1', text: 'Drag nodes from left palette to canvas', icon: '🖱️' },
          { n: '2', text: 'Connect nodes by dragging from handle to handle', icon: '🔗' },
          { n: '3', text: 'Click any node to configure it, then hit Publish', icon: '🚀' },
        ].map((s) => (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
              background: '#534AB7', color: '#fff', fontSize: '11px', fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{s.n}</span>
            <span style={{ fontSize: '12px', color: 'rgba(248,247,255,0.75)' }}>
              <span style={{ marginRight: 4 }}>{s.icon}</span>{s.text}
            </span>
          </div>
        ))}
      </div>
      <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: 'rgba(248,247,255,0.4)', cursor: 'pointer', fontSize: '16px', flexShrink: 0 }}>✕</button>
    </div>
  );
}

// ── Template Modal ─────────────────────────────────────────────
function TemplateModal({ onSelect, onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
    }}>
      <div style={{
        width: '100%', maxWidth: '680px',
        background: 'rgba(13,13,34,0.97)',
        border: '1px solid rgba(175,169,236,0.2)',
        borderRadius: '24px', padding: '28px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
        animation: 'fadeIn 0.2s ease-out',
      }}>
        <style>{`@keyframes fadeIn { from{opacity:0;transform:scale(0.95)} to{opacity:1;transform:scale(1)} }`}</style>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#F8F7FF', margin: 0 }}>Quick-Start Templates</h2>
            <p style={{ fontSize: '13px', color: 'rgba(248,247,255,0.4)', margin: '4px 0 0' }}>Choose a pre-built flow to get started instantly</p>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(248,247,255,0.06)', border: 'none', color: 'rgba(248,247,255,0.5)', cursor: 'pointer', width: 32, height: 32, borderRadius: '8px', fontSize: '16px' }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '12px' }}>
          {Object.entries(TEMPLATES).map(([key, tpl]) => {
            const icons = { lead_qual: '🎯', appointment: '📅', support: '🎧' };
            const descs = {
              lead_qual: 'Qualify leads with keyword triggers and smart branching',
              appointment: 'Book appointments with slot selection & confirmation',
              support: 'Triage incoming messages to the right team instantly',
            };
            return (
              <button key={key} onClick={() => onSelect(key)}
                style={{
                  padding: '20px', borderRadius: '16px', textAlign: 'left',
                  background: 'rgba(83,74,183,0.08)', border: '1px solid rgba(83,74,183,0.25)',
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(83,74,183,0.18)'; e.currentTarget.style.borderColor = '#534AB7'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(83,74,183,0.08)'; e.currentTarget.style.borderColor = 'rgba(83,74,183,0.25)'; e.currentTarget.style.transform = 'none'; }}>
                <p style={{ fontSize: '28px', margin: '0 0 10px' }}>{icons[key]}</p>
                <p style={{ fontSize: '14px', fontWeight: 700, color: '#F8F7FF', margin: '0 0 6px' }}>{tpl.name}</p>
                <p style={{ fontSize: '11px', color: 'rgba(248,247,255,0.45)', lineHeight: 1.5, margin: 0 }}>{descs[key]}</p>
              </button>
            );
          })}
        </div>

        <button onClick={onClose} style={{
          width: '100%', marginTop: '16px', padding: '10px', borderRadius: '12px',
          background: 'transparent', border: '1px solid rgba(175,169,236,0.2)',
          color: 'rgba(248,247,255,0.4)', cursor: 'pointer', fontSize: '13px',
        }}>
          Start from blank canvas →
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

  const TYPE_COLORS = { trigger: '#534AB7', message: '#2563EB', delay: '#F59E0B', action: '#1D9E75' };
  const color = TYPE_COLORS[item.type] || '#534AB7';

  return (
    <div
      draggable
      onDragStart={onDragStart}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '9px 12px', borderRadius: '10px', cursor: 'grab',
        background: `${color}12`, border: `1px solid ${color}30`,
        transition: 'all 0.15s', userSelect: 'none',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = `${color}22`; e.currentTarget.style.borderColor = `${color}60`; e.currentTarget.style.transform = 'translateX(2px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = `${color}12`; e.currentTarget.style.borderColor = `${color}30`; e.currentTarget.style.transform = 'none'; }}>
      <span style={{ fontSize: '14px', flexShrink: 0 }}>{item.icon}</span>
      <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(248,247,255,0.8)' }}>{item.label}</span>
      <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'rgba(248,247,255,0.2)' }}>⋮⋮</span>
    </div>
  );
}

// ── Left Palette Panel ─────────────────────────────────────────
function NodePalette({ flowList, activeFlowId, onSelectFlow, onNewFlow }) {
  return (
    <div style={{
      width: '220px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 0,
      background: 'rgba(10,10,28,0.97)',
      borderRight: '1px solid rgba(175,169,236,0.12)',
      overflow: 'hidden',
    }}>
      {/* Flows list */}
      <div style={{ padding: '14px 12px 10px', borderBottom: '1px solid rgba(175,169,236,0.1)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <p style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(175,169,236,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>My Flows</p>
          <button onClick={onNewFlow} style={{
            padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700,
            background: '#534AB7', border: 'none', color: '#fff', cursor: 'pointer',
          }}>+ New</button>
        </div>
        <div style={{ maxHeight: '120px', overflowY: 'auto' }}>
          {flowList.length === 0 ? (
            <p style={{ fontSize: '11px', color: 'rgba(248,247,255,0.2)', textAlign: 'center', padding: '12px 0' }}>No flows yet</p>
          ) : flowList.map((f) => (
            <button key={f.id} onClick={() => onSelectFlow(f)} style={{
              width: '100%', textAlign: 'left', padding: '6px 8px', borderRadius: '8px',
              background: activeFlowId === f.id ? 'rgba(83,74,183,0.2)' : 'transparent',
              border: activeFlowId === f.id ? '1px solid rgba(83,74,183,0.4)' : '1px solid transparent',
              color: activeFlowId === f.id ? '#AFA9EC' : 'rgba(248,247,255,0.5)',
              cursor: 'pointer', fontSize: '12px', display: 'block', marginBottom: '2px',
              transition: 'all 0.15s', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {f.status === 'active' && <span style={{ color: '#1D9E75', marginRight: 4 }}>●</span>}
              {f.name}
            </button>
          ))}
        </div>
      </div>

      {/* Draggable palette */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        <p style={{ fontSize: '10px', fontWeight: 800, color: 'rgba(175,169,236,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>Node Palette</p>
        {PALETTE.map((section) => (
          <div key={section.section} style={{ marginBottom: '16px' }}>
            <p style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(248,247,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '6px', paddingLeft: '4px' }}>
              {section.section}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {section.items.map((item) => <PaletteItem key={item.label} item={item} />)}
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
    draft:  { label: 'Draft',  bg: 'rgba(248,247,255,0.08)', color: 'rgba(248,247,255,0.5)', dot: '#888' },
    active: { label: 'Live',   bg: 'rgba(29,158,117,0.15)',  color: '#26C18E',                dot: '#1D9E75' },
    paused: { label: 'Paused', bg: 'rgba(245,158,11,0.15)',  color: '#F59E0B',                dot: '#F59E0B' },
  };
  const sm = statusMeta[status] || statusMeta.draft;

  return (
    <div style={{
      height: '56px', flexShrink: 0,
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '0 16px',
      background: 'rgba(10,10,28,0.97)',
      borderBottom: '1px solid rgba(175,169,236,0.12)',
      zIndex: 10,
    }}>
      {/* Flow name */}
      <input
        value={flowName}
        onChange={(e) => setFlowName(e.target.value)}
        placeholder="Untitled Flow…"
        style={{
          background: 'transparent', border: 'none', outline: 'none',
          fontSize: '15px', fontWeight: 700, color: '#F8F7FF',
          width: '200px', fontFamily: 'Inter, sans-serif',
        }}
      />

      {/* Status pill */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '4px 10px', borderRadius: '20px',
        background: sm.bg, border: `1px solid ${sm.dot}40`,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: sm.dot, boxShadow: status === 'active' ? `0 0 6px ${sm.dot}` : 'none', display: 'block' }} />
        <span style={{ fontSize: '11px', fontWeight: 700, color: sm.color }}>{sm.label}</span>
      </div>

      <div style={{ flex: 1 }} />

      {/* Action buttons */}
      <button onClick={onTemplate}
        style={{ padding: '7px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: 'rgba(83,74,183,0.12)', border: '1px solid rgba(83,74,183,0.3)', color: '#AFA9EC', transition: 'all 0.15s' }}>
        📐 Templates
      </button>

      <button onClick={onTest}
        style={{ padding: '7px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: 'rgba(29,158,117,0.12)', border: '1px solid rgba(29,158,117,0.3)', color: '#26C18E', transition: 'all 0.15s' }}>
        ▶ Test Simulator
      </button>

      <button onClick={onSave} disabled={saving}
        style={{ padding: '7px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', background: 'rgba(248,247,255,0.06)', border: '1px solid rgba(248,247,255,0.15)', color: 'rgba(248,247,255,0.7)', transition: 'all 0.15s' }}>
        {saving ? '…' : '💾 Save'}
      </button>

      <button onClick={onPublish}
        style={{ padding: '7px 18px', borderRadius: '10px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', background: 'linear-gradient(135deg,#534AB7,#3B3499)', border: 'none', color: '#fff', boxShadow: '0 4px 16px rgba(83,74,183,0.4)', transition: 'all 0.2s' }}>
        🚀 Publish
      </button>
    </div>
  );
}

// ── MAIN FLOW CANVAS ───────────────────────────────────────────
function FlowCanvas({ flowId }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [showBanner, setShowBanner] = useState(true);
  const [showTemplates, setShowTemplates] = useState(!flowId);
  const [flowName, setFlowName] = useState('Untitled Flow');
  const [status, setStatus] = useState('draft');
  const [saving, setSaving] = useState(false);
  const [flowList, setFlowList] = useState([]);
  const [activeFlowId, setActiveFlowId] = useState(flowId || null);
  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const { theme } = useTheme();

  // Load flows list
  useEffect(() => {
    automationApi.list().then((r) => setFlowList(r?.data || [])).catch(() => {});
  }, []);

  // Load active flow nodes/edges from saved data
  const loadFlow = useCallback((flow) => {
    setActiveFlowId(flow.id);
    setFlowName(flow.name);
    setStatus(flow.status || 'draft');
    // In full impl: fetch nodes/edges from flow_nodes/flow_edges table
    // For now restore from flow.steps JSONB if available
    const steps = flow.steps || [];
    if (steps.length > 0) {
      // Legacy format from old automation — skip
    }
  }, []);

  const onConnect = useCallback((params) => {
    setEdges((eds) => addEdge({ ...params, ...EDGE_DEFAULTS }, eds));
  }, [setEdges]);

  const onNodeClick = useCallback((_, node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Drop from palette
  const onDrop = useCallback((e) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/vdaj-node');
    if (!raw) return;
    const item = JSON.parse(raw);

    const rect = reactFlowWrapper.current.getBoundingClientRect();
    const pos = reactFlowInstance.screenToFlowPosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });

    const newNode = {
      id: newId(item.type),
      type: item.type,
      position: pos,
      data: { label: item.label, config: { ...item.config } },
    };

    setNodes((nds) => [...nds, newNode]);
  }, [reactFlowInstance, setNodes]);

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  // Update node data from drawer
  const updateNodeData = useCallback((nodeId, updates) => {
    setNodes((nds) => nds.map((n) =>
      n.id === nodeId ? { ...n, data: { ...n.data, ...updates } } : n
    ));
    // Keep selectedNode in sync
    setSelectedNode((prev) => prev?.id === nodeId ? { ...prev, data: { ...prev.data, ...updates } } : prev);
  }, [setNodes]);

  // Load template
  const loadTemplate = (key) => {
    const tpl = TEMPLATES[key];
    if (!tpl) return;
    setFlowName(tpl.name);
    setNodes(tpl.nodes);
    setEdges(tpl.edges);
    setShowTemplates(false);
  };

  // Save flow
  const saveFlow = async () => {
    setSaving(true);
    try {
      const payload = { name: flowName, steps: nodes.map((n) => ({ ...n.data, id: n.id, type: n.type, position: n.position })) };
      if (activeFlowId) {
        await automationApi.update(activeFlowId, payload);
      } else {
        const res = await automationApi.create(payload);
        setActiveFlowId(res?.data?.id);
        setFlowList((fl) => [res.data, ...fl]);
      }
      showSuccess('Flow saved successfully.');
    } catch { showError('Failed to save flow.'); }
    finally { setSaving(false); }
  };

  // Publish
  const publishFlow = async () => {
    if (!activeFlowId) { await saveFlow(); }
    try {
      await automationApi.update(activeFlowId, { isActive: true });
      setStatus('active');
      showSuccess('Flow is now LIVE! 🚀');
    } catch { showError('Publish failed.'); }
  };

  const testSimulator = () => {
    showSuccess('Test Simulator coming soon — connect a real number to test.');
  };

  // Canvas background per theme
  const canvasBg = theme === 'light' ? '#F8F7FF' : '#0A0A1C';
  const gridColor = theme === 'light' ? 'rgba(83,74,183,0.12)' : 'rgba(83,74,183,0.08)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontFamily: 'Inter,sans-serif' }}>
      <TopBar
        flowName={flowName} setFlowName={setFlowName}
        status={status} onSave={saveFlow} onPublish={publishFlow}
        onTest={testSimulator} onTemplate={() => setShowTemplates(true)}
        saving={saving}
      />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Left Palette */}
        <NodePalette
          flowList={flowList}
          activeFlowId={activeFlowId}
          onSelectFlow={loadFlow}
          onNewFlow={() => { setNodes([]); setEdges([]); setFlowName('Untitled Flow'); setActiveFlowId(null); setStatus('draft'); setShowTemplates(true); }}
        />

        {/* React Flow Canvas */}
        <div ref={reactFlowWrapper} style={{ flex: 1, position: 'relative' }}>
          {showBanner && (
            <div style={{ position: 'absolute', top: 12, left: 12, right: 12, zIndex: 20 }}>
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
            style={{ background: canvasBg }}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1.5}
              color={gridColor}
            />
            <Controls
              style={{
                background: 'rgba(13,13,34,0.9)',
                border: '1px solid rgba(175,169,236,0.2)',
                borderRadius: '12px',
              }}
            />
            <MiniMap
              style={{
                background: 'rgba(10,10,28,0.9)',
                border: '1px solid rgba(175,169,236,0.2)',
                borderRadius: '12px',
              }}
              nodeColor={(n) => {
                const colors = { trigger: '#534AB7', message: '#2563EB', delay: '#F59E0B', action: '#1D9E75' };
                return colors[n.type] || '#534AB7';
              }}
              maskColor="rgba(0,0,0,0.5)"
            />

            {/* Empty state */}
            {nodes.length === 0 && (
              <Panel position="top-center">
                <div style={{
                  marginTop: showBanner ? '80px' : '20px',
                  padding: '28px 36px', borderRadius: '20px', textAlign: 'center',
                  background: 'rgba(13,13,34,0.8)', border: '1px dashed rgba(83,74,183,0.35)',
                  backdropFilter: 'blur(12px)',
                }}>
                  <p style={{ fontSize: '36px', margin: '0 0 12px' }}>⚡</p>
                  <p style={{ fontSize: '15px', fontWeight: 700, color: '#F8F7FF', margin: '0 0 6px' }}>Canvas is empty</p>
                  <p style={{ fontSize: '12px', color: 'rgba(248,247,255,0.4)', margin: '0 0 16px' }}>Drag a Trigger from the left panel to start, or pick a template.</p>
                  <button onClick={() => setShowTemplates(true)} style={{
                    padding: '9px 20px', borderRadius: '10px', fontSize: '12px', fontWeight: 700,
                    background: 'linear-gradient(135deg,#534AB7,#3B3499)', border: 'none', color: '#fff', cursor: 'pointer',
                  }}>📐 Use a Template</button>
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
            />
          )}
        </div>
      </div>

      {/* Template Modal */}
      {showTemplates && (
        <TemplateModal onSelect={loadTemplate} onClose={() => setShowTemplates(false)} />
      )}
    </div>
  );
}

// ── Page Wrapper (ReactFlowProvider required) ──────────────────
export default function AutomationPage() {
  return (
    <div style={{ height: 'calc(100vh - 4rem)', margin: '-1.5rem', overflow: 'hidden', borderRadius: '0' }}>
      <ReactFlowProvider>
        <FlowCanvas />
      </ReactFlowProvider>
    </div>
  );
}
