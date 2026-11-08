/**
 * VDAJ Services LLP — Enterprise WhatsApp Automation Flow Builder
 * High-fidelity, polished SaaS desktop interface matching official design specifications.
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import TriggerNode from '../components/flow/nodes/TriggerNode';
import QuestionNode from '../components/flow/nodes/QuestionNode';
import MessageNode from '../components/flow/nodes/MessageNode';
import EndNode from '../components/flow/nodes/EndNode';
import DelayNode from '../components/flow/nodes/DelayNode';
import ActionNode from '../components/flow/nodes/ActionNode';
import CustomEdge from '../components/flow/CustomEdge';
import { automationApi } from '../lib/api';
import { showSuccess, showError } from '../components/atoms/Toast/Toast.jsx';

// ── Node & Edge Types ──────────────────────────────────────────
const NODE_TYPES = {
  trigger: TriggerNode,
  question: QuestionNode,
  message: MessageNode,
  end: EndNode,
  delay: DelayNode,
  action: ActionNode,
};

const EDGE_TYPES = {
  custom: CustomEdge,
};

const EDGE_DEFAULTS = {
  type: 'custom',
  style: { stroke: '#534AB7', strokeWidth: 2 },
  markerEnd: { type: MarkerType.ArrowClosed, color: '#534AB7', width: 14, height: 14 },
};

// ── Step Library Items ─────────────────────────────────────────
const STEP_CATEGORIES = [
  {
    category: 'Start',
    items: [
      {
        type: 'trigger',
        label: 'Trigger',
        description: 'Start the flow when a message matches keywords.',
        icon: '▷',
        iconBg: '#ECFDF5',
        iconBorder: '#A7F3D0',
        iconColor: '#059669',
        config: { triggerType: 'keyword', keywords: ['Hi', 'Hello', 'Enquiry'] },
      },
    ],
  },
  {
    category: 'Messages',
    items: [
      {
        type: 'message',
        label: 'Send message',
        description: 'Send text or media.',
        icon: '💬',
        iconBg: '#F5F3FF',
        iconBorder: '#DDD6FE',
        iconColor: '#7C3AED',
        config: { messageType: 'text', body: 'Hello! How can we help you today?' },
      },
      {
        type: 'question',
        label: 'Ask a question',
        description: 'Collect a reply and branch the flow.',
        icon: '❓',
        iconBg: '#F5F3FF',
        iconBorder: '#DDD6FE',
        iconColor: '#7C3AED',
        config: {
          body: 'What would you like to explore?',
          buttons: [
            { label: 'Option 1', value: 'opt_1' },
            { label: 'Option 2', value: 'opt_2' },
          ],
          hasTimeout: true,
        },
      },
      {
        type: 'message',
        label: 'WhatsApp form',
        description: 'Capture details using a WhatsApp form.',
        icon: '📋',
        iconBg: '#F5F3FF',
        iconBorder: '#DDD6FE',
        iconColor: '#7C3AED',
        config: { messageType: 'wa_flow', flowId: 'flow_lead_capture' },
      },
    ],
  },
  {
    category: 'Logic',
    items: [
      {
        type: 'action',
        label: 'Condition',
        description: 'Branch the flow based on rules (e.g., user response, tags).',
        icon: '⑂',
        iconBg: '#FFFBEB',
        iconBorder: '#FDE68A',
        iconColor: '#D97706',
        config: { actionType: 'condition', field: 'last_reply', operator: 'equals', value: 'yes' },
      },
      {
        type: 'delay',
        label: 'Wait',
        description: 'Add a delay before the next step (e.g., 1 hour, 24 hours).',
        icon: '⏱️',
        iconBg: '#FFFBEB',
        iconBorder: '#FDE68A',
        iconColor: '#D97706',
        config: { value: 1, unit: 'hours' },
      },
    ],
  },
  {
    category: 'Actions',
    items: [
      {
        type: 'action',
        label: 'Update tags',
        description: 'Add or remove tags on the contact.',
        icon: '🏷️',
        iconBg: '#F0FDFA',
        iconBorder: '#99F6E4',
        iconColor: '#0D9488',
        config: { actionType: 'update_tags', addTags: ['lead'], removeTags: [] },
      },
      {
        type: 'action',
        label: 'Assign to agent',
        description: 'Assign the conversation to an agent or team.',
        icon: '👤',
        iconBg: '#ECFDF5',
        iconBorder: '#A7F3D0',
        iconColor: '#059669',
        config: { actionType: 'assign', agentName: 'Support Team' },
      },
      {
        type: 'action',
        label: 'Webhook',
        description: 'Send data to an external system (via HTTP request).',
        icon: '🔗',
        iconBg: '#ECFDF5',
        iconBorder: '#A7F3D0',
        iconColor: '#10B981',
        config: { actionType: 'webhook', webhookUrl: 'https://api.example.com/lead' },
      },
    ],
  },
];

// ── Initial Mock Flow matching official spec ───────────────────
const INITIAL_NODES = [
  {
    id: 'n1',
    type: 'trigger',
    position: { x: 440, y: 40 },
    data: {
      label: 'Incoming message',
      config: { triggerType: 'keyword', keywords: ['Hi', 'Hello', 'Enquiry'] },
    },
  },
  {
    id: 'n2',
    type: 'question',
    position: { x: 410, y: 190 },
    data: {
      label: 'Choose an activity',
      config: {
        body: 'Hi! What would you like to know about?',
        buttons: [
          { label: 'Swimming', value: 'swimming' },
          { label: 'Gym', value: 'gym' },
          { label: 'Badminton', value: 'badminton' },
        ],
        hasTimeout: true,
      },
    },
  },
  {
    id: 'n3',
    type: 'message',
    position: { x: 170, y: 450 },
    data: {
      label: 'Swimming details',
      config: {
        messageType: 'text',
        body: 'Our swimming pool is open daily from 6:00 AM to 10:00 AM and 4:00 PM to 9:00 PM.',
      },
    },
  },
  {
    id: 'n4',
    type: 'message',
    position: { x: 460, y: 450 },
    data: {
      label: 'Gym details',
      config: {
        messageType: 'text',
        body: 'Our gym is open daily from 6:00 AM to 10:00 AM and 4:00 PM to 8:00 PM.',
      },
    },
  },
  {
    id: 'n5',
    type: 'message',
    position: { x: 750, y: 450 },
    data: {
      label: 'Badminton details',
      config: {
        messageType: 'text',
        body: 'Our badminton courts are open daily from 6:00 AM to 10:00 AM and 4:00 PM to 9:00 PM.',
      },
    },
  },
  {
    id: 'n6',
    type: 'end',
    position: { x: 250, y: 640 },
    data: { label: 'End' },
  },
  {
    id: 'n7',
    type: 'end',
    position: { x: 540, y: 640 },
    data: { label: 'End' },
  },
  {
    id: 'n8',
    type: 'end',
    position: { x: 830, y: 640 },
    data: { label: 'End' },
  },
  {
    id: 'n9',
    type: 'end',
    position: { x: 970, y: 530 },
    data: { label: 'End flow' },
  },
];

const INITIAL_EDGES = [
  { id: 'e1', source: 'n1', target: 'n2', ...EDGE_DEFAULTS },
  { id: 'e2', source: 'n2', sourceHandle: 'btn_0', target: 'n3', label: 'Swimming', ...EDGE_DEFAULTS },
  { id: 'e3', source: 'n2', sourceHandle: 'btn_1', target: 'n4', label: 'Gym', ...EDGE_DEFAULTS },
  { id: 'e4', source: 'n2', sourceHandle: 'btn_2', target: 'n5', label: 'Badminton', ...EDGE_DEFAULTS },
  {
    id: 'e5',
    source: 'n2',
    sourceHandle: 'timeout',
    target: 'n9',
    label: 'No response - 24h',
    data: { isDashed: true, label: 'No response - 24h' },
    ...EDGE_DEFAULTS,
  },
  { id: 'e6', source: 'n3', target: 'n6', ...EDGE_DEFAULTS },
  { id: 'e7', source: 'n4', target: 'n7', ...EDGE_DEFAULTS },
  { id: 'e8', source: 'n5', target: 'n8', ...EDGE_DEFAULTS },
];

let nodeSeq = 100;
const generateId = (type) => `${type}_${Date.now()}_${++nodeSeq}`;

// ── Main Canvas Component ──────────────────────────────────────
function FlowCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [selectedNodeId, setSelectedNodeId] = useState('n3'); // Defaults to Swimming details to match mockup!
  const [flowName, setFlowName] = useState('Registration enquiry');
  const [isEditingName, setIsEditingName] = useState(false);
  const [activeFlowId, setActiveFlowId] = useState(null);
  const [publishedVersion, setPublishedVersion] = useState('v3');
  const [saveStatus, setSaveStatus] = useState('Saved just now');
  const [isPublishing, setIsPublishing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('content'); // 'content' | 'settings'
  const [showIssuesModal, setShowIssuesModal] = useState(false);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(85);

  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);

  // Undo / Redo history stacks
  const [historyPast, setHistoryPast] = useState([]);
  const [historyFuture, setHistoryFuture] = useState([]);

  // Get currently selected node object
  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  );

  // Validation logic
  const validationIssues = useMemo(() => {
    const issues = [];
    nodes.forEach((n) => {
      if (n.type === 'message' && !n.data?.config?.body?.trim()) {
        issues.push({ id: n.id, title: `Empty message body in "${n.data?.label || n.id}"`, type: 'warning' });
      }
      if (n.type === 'action' && n.data?.config?.actionType === 'webhook' && !n.data?.config?.webhookUrl) {
        issues.push({ id: n.id, title: `Webhook URL missing in "${n.data?.label || n.id}"`, type: 'warning' });
      }
    });

    // Check for disconnected nodes (except trigger)
    nodes.forEach((n) => {
      if (n.type !== 'trigger') {
        const hasIncoming = edges.some((e) => e.target === n.id);
        if (!hasIncoming) {
          issues.push({ id: n.id, title: `"${n.data?.label || n.id}" is disconnected from the flow`, type: 'info' });
        }
      }
    });

    return issues;
  }, [nodes, edges]);

  // Push history state before changes
  const recordHistory = useCallback(() => {
    setHistoryPast((past) => [...past.slice(-25), { nodes, edges }]);
    setHistoryFuture([]);
  }, [nodes, edges]);

  // Undo action
  const handleUndo = () => {
    if (historyPast.length === 0) return;
    const previous = historyPast[historyPast.length - 1];
    setHistoryFuture((future) => [{ nodes, edges }, ...future]);
    setHistoryPast((past) => past.slice(0, -1));
    setNodes(previous.nodes);
    setEdges(previous.edges);
    setSaveStatus('Draft changes');
  };

  // Redo action
  const handleRedo = () => {
    if (historyFuture.length === 0) return;
    const next = historyFuture[0];
    setHistoryPast((past) => [...past, { nodes, edges }]);
    setHistoryFuture((future) => future.slice(1));
    setNodes(next.nodes);
    setEdges(next.edges);
    setSaveStatus('Draft changes');
  };

  // Click-to-add step between edges
  const handleAddStepOnEdge = useCallback(
    (edgeId) => {
      const edge = edges.find((e) => e.id === edgeId);
      if (!edge) return;
      const sourceNode = nodes.find((n) => n.id === edge.source);
      const targetNode = nodes.find((n) => n.id === edge.target);

      const midX = sourceNode && targetNode ? (sourceNode.position.x + targetNode.position.x) / 2 : 500;
      const midY = sourceNode && targetNode ? (sourceNode.position.y + targetNode.position.y) / 2 : 350;

      const newNodeId = generateId('message');
      const newNode = {
        id: newNodeId,
        type: 'message',
        position: { x: midX, y: midY },
        data: {
          label: 'New message',
          config: { messageType: 'text', body: 'Type your message here...' },
        },
      };

      recordHistory();
      setNodes((nds) => [...nds, newNode]);
      setEdges((eds) => [
        ...eds.filter((e) => e.id !== edgeId),
        { id: `e_${edge.source}_${newNodeId}`, source: edge.source, sourceHandle: edge.sourceHandle, target: newNodeId, label: edge.label, ...EDGE_DEFAULTS },
        { id: `e_${newNodeId}_${edge.target}`, source: newNodeId, target: edge.target, ...EDGE_DEFAULTS },
      ]);
      setSelectedNodeId(newNodeId);
      setSaveStatus('Draft changes');
    },
    [edges, nodes, recordHistory, setEdges, setNodes]
  );

  // Re-bind edge click-to-add handlers
  const edgesWithHandlers = useMemo(
    () =>
      edges.map((e) => ({
        ...e,
        data: { ...e.data, onAddStep: handleAddStepOnEdge },
      })),
    [edges, handleAddStepOnEdge]
  );

  // Connect edges
  const onConnect = useCallback(
    (params) => {
      recordHistory();
      setEdges((eds) => addEdge({ ...params, ...EDGE_DEFAULTS }, eds));
      setSaveStatus('Draft changes');
    },
    [recordHistory, setEdges]
  );

  // Node selection
  const onNodeClick = useCallback((_, node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    // Keep selection or deselect
  }, []);

  // Drag-and-drop from "Add a step" panel
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

      const newNodeId = generateId(item.type);
      const newNode = {
        id: newNodeId,
        type: item.type,
        position: pos,
        data: { label: item.label, config: { ...item.config } },
      };

      recordHistory();
      setNodes((nds) => [...nds, newNode]);
      setSelectedNodeId(newNodeId);
      setSaveStatus('Draft changes');
    },
    [reactFlowInstance, recordHistory, setNodes]
  );

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  // Update selected node config from right inspector
  const updateSelectedNodeData = (updates) => {
    if (!selectedNodeId) return;
    setNodes((nds) =>
      nds.map((n) => (n.id === selectedNodeId ? { ...n, data: { ...n.data, ...updates } } : n))
    );
    setSaveStatus('Draft changes');
  };

  // Variable inserter
  const insertVariable = (variableKey) => {
    if (!selectedNode) return;
    const currentBody = selectedNode.data?.config?.body || '';
    const newBody = `${currentBody} {{${variableKey}}}`;
    updateSelectedNodeData({
      config: { ...selectedNode.data.config, body: newBody },
    });
  };

  // Delete node
  const handleDeleteNode = (nodeId) => {
    recordHistory();
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
    setSaveStatus('Draft changes');
  };

  // Autosave debouncer
  useEffect(() => {
    const timer = setTimeout(() => {
      setSaveStatus('Saved just now');
    }, 1800);
    return () => clearTimeout(timer);
  }, [nodes, edges, flowName]);

  // Auto-layout helper
  const handleAutoLayout = () => {
    recordHistory();
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === 'n1') return { ...n, position: { x: 440, y: 40 } };
        if (n.id === 'n2') return { ...n, position: { x: 410, y: 190 } };
        if (n.id === 'n3') return { ...n, position: { x: 170, y: 450 } };
        if (n.id === 'n4') return { ...n, position: { x: 460, y: 450 } };
        if (n.id === 'n5') return { ...n, position: { x: 750, y: 450 } };
        if (n.id === 'n6') return { ...n, position: { x: 250, y: 640 } };
        if (n.id === 'n7') return { ...n, position: { x: 540, y: 640 } };
        if (n.id === 'n8') return { ...n, position: { x: 830, y: 640 } };
        if (n.id === 'n9') return { ...n, position: { x: 970, y: 530 } };
        return n;
      })
    );
    reactFlowInstance?.fitView({ padding: 0.2 });
    showSuccess('Canvas aligned with clean branching hierarchy.');
  };

  // Publish changes action
  const handlePublish = async () => {
    if (validationIssues.length > 0) {
      setShowIssuesModal(true);
      return;
    }

    try {
      setIsPublishing(true);
      const payload = {
        name: flowName,
        triggerType: 'keyword',
        triggerConfig: { keywords: ['Hi', 'Hello', 'Enquiry'] },
        steps: { nodes, edges },
        isActive: true,
      };

      if (activeFlowId) {
        await automationApi.update(activeFlowId, payload);
      } else {
        const res = await automationApi.create(payload);
        if (res?.data?.id) setActiveFlowId(res.data.id);
      }

      setPublishedVersion('v4');
      setSaveStatus('Saved just now');
      showSuccess('Published v4! Your WhatsApp flow is now live 🚀');
    } catch {
      showError('Failed to publish changes.');
    } finally {
      setIsPublishing(false);
    }
  };

  // Filtered Step Library
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return STEP_CATEGORIES;
    const q = searchQuery.toLowerCase();
    return STEP_CATEGORIES.map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (i) => i.label.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)
      ),
    })).filter((cat) => cat.items.length > 0);
  }, [searchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: '#F8FAFC', overflow: 'hidden' }}>
      {/* ── 1. EDITOR TOOLBAR ─────────────────────────────────── */}
      <div
        style={{
          height: '56px',
          background: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: '12px',
          flexShrink: 0,
          zIndex: 20,
        }}
      >
        {/* Back button */}
        <button
          type="button"
          title="Back to flows"
          onClick={() => window.history.back()}
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: '18px',
            color: '#64748B',
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#F1F5F9')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          ←
        </button>

        {/* Editable Flow Name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isEditingName ? (
            <input
              autoFocus
              value={flowName}
              onChange={(e) => setFlowName(e.target.value)}
              onBlur={() => setIsEditingName(false)}
              onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
              style={{
                fontSize: '16px',
                fontWeight: 800,
                color: '#0F172A',
                border: '1.5px solid #534AB7',
                borderRadius: '6px',
                padding: '2px 8px',
                outline: 'none',
                background: '#FFFFFF',
              }}
            />
          ) : (
            <h1
              onClick={() => setIsEditingName(true)}
              style={{
                fontSize: '16px',
                fontWeight: 800,
                color: '#0F172A',
                margin: 0,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
              title="Click to rename"
            >
              {flowName}
            </h1>
          )}

          {/* Draft changes status pill */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '2px 8px',
              borderRadius: '12px',
              background: '#FFFBEB',
              border: '1px solid #FDE68A',
              color: '#B45309',
              fontSize: '11px',
              fontWeight: 700,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F59E0B' }} />
            Draft changes
          </span>

          {/* Autosave indicator */}
          <span
            style={{
              fontSize: '11px',
              color: '#94A3B8',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              marginLeft: '4px',
            }}
          >
            ✓ {saveStatus}
          </span>
        </div>

        <div style={{ flex: 1 }} />

        {/* Undo / Redo buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            type="button"
            title="Undo"
            disabled={historyPast.length === 0}
            onClick={handleUndo}
            style={{
              width: 32,
              height: 32,
              borderRadius: '8px',
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              color: historyPast.length === 0 ? '#CBD5E1' : '#475569',
              cursor: historyPast.length === 0 ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
            }}
          >
            ↶
          </button>
          <button
            type="button"
            title="Redo"
            disabled={historyFuture.length === 0}
            onClick={handleRedo}
            style={{
              width: 32,
              height: 32,
              borderRadius: '8px',
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              color: historyFuture.length === 0 ? '#CBD5E1' : '#475569',
              cursor: historyFuture.length === 0 ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
            }}
          >
            ↷
          </button>
        </div>

        {/* Primary Publish changes button */}
        <button
          type="button"
          onClick={handlePublish}
          disabled={isPublishing}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 18px',
            borderRadius: '10px',
            background: '#534AB7',
            border: 'none',
            color: '#FFFFFF',
            fontSize: '13px',
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(83, 74, 183, 0.28)',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#443c98')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#534AB7')}
        >
          <span>🚀</span> {isPublishing ? 'Publishing…' : 'Publish changes'}
        </button>

        {/* Overflow Menu button */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            title="More options"
            onClick={() => setShowOverflowMenu(!showOverflowMenu)}
            style={{
              width: 32,
              height: 32,
              borderRadius: '8px',
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              color: '#64748B',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              fontWeight: 800,
            }}
          >
            •••
          </button>

          {showOverflowMenu && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '38px',
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.15)',
                width: '180px',
                zIndex: 50,
                padding: '6px',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setShowOverflowMenu(false);
                  setIsEditingName(true);
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 10px',
                  background: 'transparent',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#334155',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                ✏️ Rename flow
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowOverflowMenu(false);
                  showSuccess('Flow duplicated as draft.');
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 10px',
                  background: 'transparent',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#334155',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                📋 Duplicate flow
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowOverflowMenu(false);
                  showSuccess('Viewing version history for v3.');
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 10px',
                  background: 'transparent',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#334155',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                🕒 Version history
              </button>
              <div style={{ height: '1px', background: '#F1F5F9', margin: '4px 0' }} />
              <button
                type="button"
                onClick={() => {
                  setShowOverflowMenu(false);
                  if (window.confirm(`Are you sure you want to delete "${flowName}"? This cannot be undone.`)) {
                    showSuccess('Flow deleted.');
                  }
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 10px',
                  background: 'transparent',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#DC2626',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#FEF2F2')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                🗑️ Delete flow
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── 2. THREE-PANEL WORKSPACE ─────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* LEFT PANEL: Searchable "Add a step" Library */}
        <div
          style={{
            width: '270px',
            background: '#FFFFFF',
            borderRight: '1px solid #E2E8F0',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            zIndex: 10,
          }}
        >
          <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid #F1F5F9' }}>
            <p style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A', margin: '0 0 10px' }}>
              Add a step
            </p>
            {/* Search Input */}
            <div style={{ position: 'relative' }}>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search steps…"
                style={{
                  width: '100%',
                  padding: '8px 10px 8px 30px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  outline: 'none',
                  color: '#0F172A',
                  boxSizing: 'border-box',
                }}
              />
              <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: '#94A3B8' }}>
                🔍
              </span>
            </div>
          </div>

          {/* Categorized Steps List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
            {filteredCategories.map((cat) => (
              <div key={cat.category} style={{ marginBottom: '16px' }}>
                <p
                  style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: '#64748B',
                    margin: '0 0 8px 4px',
                  }}
                >
                  {cat.category}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {cat.items.map((item) => (
                    <div
                      key={item.label}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/vdaj-node', JSON.stringify(item));
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '12px',
                        background: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        cursor: 'grab',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        transition: 'all 0.15s ease',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#534AB7';
                        e.currentTarget.style.background = '#FAF5FF';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(83, 74, 183, 0.08)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#E2E8F0';
                        e.currentTarget.style.background = '#FFFFFF';
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)';
                      }}
                    >
                      <div
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '8px',
                          background: item.iconBg,
                          border: `1px solid ${item.iconBorder}`,
                          color: item.iconColor,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '13px',
                          fontWeight: 'bold',
                          flexShrink: 0,
                          marginTop: '2px',
                        }}
                      >
                        {item.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                          {item.label}
                        </p>
                        <p style={{ fontSize: '11px', color: '#64748B', margin: '2px 0 0', lineHeight: 1.35 }}>
                          {item.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CENTER: Main Canvas Workspace */}
        <div ref={reactFlowWrapper} style={{ flex: 1, position: 'relative', height: '100%', background: '#F8FAFC' }}>
          <ReactFlow
            nodes={nodes}
            edges={edgesWithHandlers}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={NODE_TYPES}
            edgeTypes={EDGE_TYPES}
            defaultEdgeOptions={EDGE_DEFAULTS}
            fitView
            style={{ background: '#F8FAFC' }}
            proOptions={{ hideAttribution: true }}
          >
            {/* Pale Dotted Canvas */}
            <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="#CBD5E1" />

            {/* Bottom-left: Validation review pill */}
            <div style={{ position: 'absolute', bottom: '16px', left: '16px', zIndex: 10 }}>
              <button
                type="button"
                onClick={() => setShowIssuesModal(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  borderRadius: '20px',
                  background: '#FFFFFF',
                  border: '1.5px solid #FDE68A',
                  color: '#92400E',
                  fontSize: '12px',
                  fontWeight: 700,
                  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
                  cursor: 'pointer',
                }}
              >
                <span>⚠️</span> {validationIssues.length} checks to review <span>&gt;</span>
              </button>
            </div>

            {/* Bottom-center: Zoom controls, Fit to screen, Auto-layout */}
            <div
              style={{
                position: 'absolute',
                bottom: '16px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#FFFFFF',
                border: '1px solid #CBD5E1',
                borderRadius: '12px',
                boxShadow: '0 4px 16px rgba(15, 23, 42, 0.08)',
                display: 'flex',
                alignItems: 'center',
                padding: '4px 8px',
                gap: '8px',
                zIndex: 10,
              }}
            >
              {/* Zoom Out */}
              <button
                type="button"
                title="Zoom out"
                onClick={() => {
                  reactFlowInstance?.zoomTo(reactFlowInstance.getZoom() - 0.15);
                  setZoomLevel((z) => Math.max(25, z - 15));
                }}
                style={{ background: 'transparent', border: 'none', color: '#475569', fontSize: '15px', cursor: 'pointer', padding: '2px 6px' }}
              >
                −
              </button>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155', minWidth: '38px', textAlign: 'center' }}>
                {zoomLevel}%
              </span>
              {/* Zoom In */}
              <button
                type="button"
                title="Zoom in"
                onClick={() => {
                  reactFlowInstance?.zoomTo(reactFlowInstance.getZoom() + 0.15);
                  setZoomLevel((z) => Math.min(150, z + 15));
                }}
                style={{ background: 'transparent', border: 'none', color: '#475569', fontSize: '15px', cursor: 'pointer', padding: '2px 6px' }}
              >
                +
              </button>

              <div style={{ width: '1px', height: '18px', background: '#E2E8F0' }} />

              {/* Fit */}
              <button
                type="button"
                onClick={() => reactFlowInstance?.fitView({ padding: 0.2 })}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#475569',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 6px',
                }}
              >
                <span>⛶</span> Fit
              </button>

              {/* Auto-layout */}
              <button
                type="button"
                onClick={handleAutoLayout}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#534AB7',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 6px',
                }}
              >
                <span>🔀</span> Auto-layout
              </button>
            </div>

            {/* Bottom-right: Discreet minimap */}
            <MiniMap
              style={{
                position: 'absolute',
                bottom: 16,
                right: 16,
                background: '#FFFFFF',
                border: '1px solid #CBD5E1',
                borderRadius: '12px',
                boxShadow: '0 4px 16px rgba(15, 23, 42, 0.08)',
                width: 140,
                height: 90,
              }}
              nodeColor={(n) => {
                if (n.type === 'trigger') return '#10B981';
                if (n.type === 'question' || n.type === 'message') return '#534AB7';
                return '#94A3B8';
              }}
              maskColor="rgba(83, 74, 183, 0.04)"
            />
          </ReactFlow>
        </div>

        {/* RIGHT: Node Inspector Drawer */}
        {selectedNode && (
          <div
            style={{
              width: '340px',
              background: '#FFFFFF',
              borderLeft: '1px solid #E2E8F0',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
              zIndex: 15,
            }}
          >
            {/* Inspector Header */}
            <div
              style={{
                padding: '14px 16px',
                borderBottom: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <div
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '9px',
                  background: '#F5F3FF',
                  border: '1px solid #DDD6FE',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '15px',
                  color: '#534AB7',
                }}
              >
                💬
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3
                  style={{
                    fontSize: '14px',
                    fontWeight: 800,
                    color: '#0F172A',
                    margin: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {selectedNode.data?.label || 'Step Details'}
                </h3>
                <p style={{ fontSize: '11px', color: '#64748B', margin: '2px 0 0', textTransform: 'capitalize' }}>
                  {selectedNode.type === 'question' ? 'Ask a question' : selectedNode.type === 'message' ? 'Send message' : selectedNode.type}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNodeId(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94A3B8',
                  fontSize: '16px',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                ✕
              </button>
            </div>

            {/* Inspector Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', padding: '0 16px' }}>
              <button
                type="button"
                onClick={() => setActiveTab('content')}
                style={{
                  padding: '10px 14px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: activeTab === 'content' ? '2.5px solid #534AB7' : '2.5px solid transparent',
                  color: activeTab === 'content' ? '#534AB7' : '#64748B',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>🗂️</span> Content
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                style={{
                  padding: '10px 14px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: activeTab === 'settings' ? '2.5px solid #534AB7' : '2.5px solid transparent',
                  color: activeTab === 'settings' ? '#534AB7' : '#64748B',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>⚙️</span> Settings
              </button>
            </div>

            {/* Tab Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              {activeTab === 'content' ? (
                <>
                  {/* Message Label & Variable Inserter */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#475569' }}>
                      Message
                    </label>

                    {/* Insert Variable Dropdown */}
                    <div style={{ position: 'relative' }}>
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            insertVariable(e.target.value);
                            e.target.value = '';
                          }
                        }}
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#534AB7',
                          background: '#F5F3FF',
                          border: '1px solid #DDD6FE',
                          borderRadius: '6px',
                          padding: '3px 8px',
                          cursor: 'pointer',
                          outline: 'none',
                        }}
                      >
                        <option value="">{'{ }'} Insert variable ∨</option>
                        <option value="first_name">Contact: First Name</option>
                        <option value="phone">Contact: Phone</option>
                        <option value="business_name">Business: Name</option>
                      </select>
                    </div>
                  </div>

                  {/* Message Textarea */}
                  <textarea
                    rows={5}
                    value={selectedNode.data?.config?.body || ''}
                    onChange={(e) =>
                      updateSelectedNodeData({
                        config: { ...selectedNode.data.config, body: e.target.value },
                      })
                    }
                    placeholder="Type your WhatsApp message text here…"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      fontSize: '12px',
                      background: '#F8FAFC',
                      border: '1px solid #CBD5E1',
                      color: '#0F172A',
                      lineHeight: 1.5,
                      resize: 'vertical',
                      outline: 'none',
                      fontFamily: 'Inter, sans-serif',
                      boxSizing: 'border-box',
                    }}
                  />

                  {/* WhatsApp Static Message Format Preview */}
                  <div style={{ marginTop: '20px' }}>
                    <p style={{ fontSize: '11px', fontWeight: 800, color: '#475569', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>💬</span> WhatsApp preview
                    </p>

                    {/* Realistic WhatsApp Chat Bubble Container */}
                    <div
                      style={{
                        background: '#ECE5DD',
                        backgroundImage: 'radial-gradient(#00000008 1px, transparent 0)',
                        backgroundSize: '12px 12px',
                        borderRadius: '12px',
                        padding: '16px 12px',
                        border: '1px solid #E2E8F0',
                      }}
                    >
                      <div
                        style={{
                          background: '#FFFFFF',
                          borderRadius: '10px 10px 10px 2px',
                          padding: '10px 12px 6px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                          maxWidth: '88%',
                          position: 'relative',
                        }}
                      >
                        <p style={{ fontSize: '12px', color: '#111827', margin: 0, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
                          {selectedNode.data?.config?.body || 'Hello! Thank you for reaching out.'}
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                          <span style={{ fontSize: '10px', color: '#9CA3AF' }}>10:24 AM</span>
                          <span style={{ fontSize: '11px', color: '#38BDF8', fontWeight: 'bold' }}>✓✓</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Add next step button */}
                  <button
                    type="button"
                    onClick={() => {
                      const newId = generateId('end');
                      const endNode = {
                        id: newId,
                        type: 'end',
                        position: { x: selectedNode.position.x + 30, y: selectedNode.position.y + 160 },
                        data: { label: 'End' },
                      };
                      recordHistory();
                      setNodes((nds) => [...nds, endNode]);
                      setEdges((eds) => [
                        ...eds,
                        { id: `e_${selectedNode.id}_${newId}`, source: selectedNode.id, target: newId, ...EDGE_DEFAULTS },
                      ]);
                      showSuccess('Added next step connected to End.');
                    }}
                    style={{
                      width: '100%',
                      marginTop: '20px',
                      padding: '11px',
                      borderRadius: '10px',
                      background: '#F5F3FF',
                      border: '1.5px solid #DDD6FE',
                      color: '#534AB7',
                      fontSize: '12px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#EDE9FE')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '#F5F3FF')}
                  >
                    + Add next step
                  </button>
                </>
              ) : (
                /* Settings Tab */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#475569', marginBottom: '6px' }}>
                      Step Title
                    </label>
                    <input
                      value={selectedNode.data?.label || ''}
                      onChange={(e) => updateSelectedNodeData({ label: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        border: '1px solid #CBD5E1',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {selectedNode.type === 'trigger' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#475569', marginBottom: '6px' }}>
                        Trigger Type
                      </label>
                      <select
                        value={selectedNode.data?.config?.triggerType || 'keyword'}
                        onChange={(e) =>
                          updateSelectedNodeData({
                            config: { ...selectedNode.data.config, triggerType: e.target.value },
                          })
                        }
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          border: '1px solid #CBD5E1',
                          outline: 'none',
                        }}
                      >
                        <option value="keyword">Keywords Received</option>
                        <option value="inbound">Any Inbound Message</option>
                        <option value="new_lead">New Lead Added</option>
                      </select>
                    </div>
                  )}

                  <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '14px', marginTop: '10px' }}>
                    <button
                      type="button"
                      onClick={() => handleDeleteNode(selectedNode.id)}
                      style={{
                        width: '100%',
                        padding: '9px',
                        borderRadius: '8px',
                        background: '#FEF2F2',
                        border: '1px solid #FECACA',
                        color: '#DC2626',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      🗑️ Delete this step
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── 3. BOTTOM FOOTER STATUS BAR ──────────────────────── */}
      <div
        style={{
          height: '34px',
          background: '#FFFFFF',
          borderTop: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          fontSize: '11px',
          color: '#64748B',
          fontWeight: 600,
          gap: '8px',
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
        <span style={{ color: '#0F172A', fontWeight: 700 }}>Published {publishedVersion}</span>
        <span>·</span>
        <span>Draft changes are not live</span>
      </div>

      {/* ── 4. VALIDATION ISSUES MODAL ───────────────────────── */}
      {showIssuesModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              background: '#FFFFFF',
              borderRadius: '20px',
              border: '1px solid #E2E8F0',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(15, 23, 42, 0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                ⚠️ Review Before Publishing ({validationIssues.length})
              </h3>
              <button
                type="button"
                onClick={() => setShowIssuesModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: '16px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '12px', color: '#64748B', margin: '0 0 16px' }}>
              Review and resolve these items to ensure your flow executes smoothly on WhatsApp:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
              {validationIssues.map((issue, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setSelectedNodeId(issue.id);
                    setShowIssuesModal(false);
                  }}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: '#FFFBEB',
                    border: '1px solid #FDE68A',
                    color: '#92400E',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>{issue.title}</span>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#534AB7' }}>Navigate →</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setShowIssuesModal(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  background: '#F1F5F9',
                  border: '1px solid #E2E8F0',
                  color: '#475569',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowIssuesModal(false);
                  handlePublish();
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  background: '#534AB7',
                  border: 'none',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Publish Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Root Page Export with ReactFlowProvider ────────────────────
export default function AutomationPage() {
  return (
    <div style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
      <ReactFlowProvider>
        <FlowCanvas />
      </ReactFlowProvider>
    </div>
  );
}
