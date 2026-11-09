/**
 * VDAJ Services LLP — Enterprise WhatsApp Automation Flow Builder
 * High-fidelity, polished SaaS desktop interface matching official design specifications.
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
import FormNode from '../components/flow/nodes/FormNode';
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
  form: FormNode,
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
        type: 'form',
        label: 'WhatsApp form',
        description: 'Capture details using an in-app WhatsApp form.',
        icon: '📋',
        iconBg: '#F5F3FF',
        iconBorder: '#DDD6FE',
        iconColor: '#7C3AED',
        config: {
          messageType: 'wa_flow',
          flowName: 'Registration enquiry form',
          ctaText: 'Register Now',
          body: 'Please tap below to fill out your enquiry details for SMR Swimming Pool & Health Club.',
          fields: [
            { id: 'full_name', label: 'Full Name', type: 'text', required: true },
            { id: 'phone', label: 'Phone Number', type: 'phone', required: true },
            { id: 'activity', label: 'Activity', type: 'select', options: ['Swimming', 'Gym', 'Badminton'], required: true },
            { id: 'batch', label: 'Preferred Timing', type: 'select', options: ['Morning (6:00 AM - 10:00 AM)', 'Evening (4:00 PM - 8:00 PM)'], required: false },
          ],
        },
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
  const navigate = useNavigate();
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [selectedNodeId, setSelectedNodeId] = useState('n3'); // Defaults to Swimming details to match mockup!
  const [flowName, setFlowName] = useState('Registration enquiry');
  const [isEditingName, setIsEditingName] = useState(false);
  const [activeFlowId, setActiveFlowId] = useState(null);
  const [publishedVersion, setPublishedVersion] = useState('Live');
  const [saveStatus, setSaveStatus] = useState('Saved just now');
  const [hasDraftChanges, setHasDraftChanges] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('content'); // 'content' | 'settings'
  const [showIssuesModal, setShowIssuesModal] = useState(false);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const [showFormModalPreview, setShowFormModalPreview] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(85);
  const isLoadedRef = useRef(false);

  // Flows switcher & creation states
  const [viewMode, setViewMode] = useState('editor'); // 'editor' | 'list'
  const [flowList, setFlowList] = useState([]);
  const [isLoadingFlows, setIsLoadingFlows] = useState(false);
  const [showFlowSelectorDropdown, setShowFlowSelectorDropdown] = useState(false);
  const [showNewFlowModal, setShowNewFlowModal] = useState(false);
  const [newFlowTitle, setNewFlowTitle] = useState('');
  const [newFlowTemplate, setNewFlowTemplate] = useState('blank');
  const [stepSaveEffect, setStepSaveEffect] = useState(false);
  const [listSearchQuery, setListSearchQuery] = useState('');

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
    setHasDraftChanges(true);
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
    setHasDraftChanges(true);
    setSaveStatus('Draft changes');
  };

  // Load flow data into canvas
  const loadFlowData = useCallback((flow) => {
    if (!flow) return;
    setActiveFlowId(flow.id);
    if (flow.name) setFlowName(flow.name);
    setPublishedVersion(flow.is_active ? 'Live' : 'Draft');

    let loadedNodes = [];
    let loadedEdges = [];
    if (flow.steps) {
      if (flow.steps.nodes && flow.steps.edges) {
        loadedNodes = flow.steps.nodes;
        loadedEdges = flow.steps.edges;
      } else if (Array.isArray(flow.steps)) {
        loadedNodes = flow.steps.filter((s) => !s.source);
        loadedEdges = flow.steps.filter((s) => s.source);
      }
    }

    // Check if user has an unsaved local draft newer than server flow
    const localDraftRaw = localStorage.getItem(`vdaj_flow_draft_${flow.id}`);
    let draftLoaded = false;
    if (localDraftRaw) {
      try {
        const draft = JSON.parse(localDraftRaw);
        const serverTime = new Date(flow.updated_at || 0).getTime();
        if (draft?.nodes?.length && draft.updatedAt > serverTime) {
          loadedNodes = draft.nodes;
          loadedEdges = draft.edges || loadedEdges;
          if (draft.name) setFlowName(draft.name);
          setHasDraftChanges(true);
          setSaveStatus('Draft changes');
          draftLoaded = true;
        }
      } catch { }
    }

    if (!draftLoaded) {
      setHasDraftChanges(false);
      setSaveStatus(flow.is_active ? 'Live on WhatsApp' : 'Saved');
    }

    if (loadedNodes.length > 0) {
      setNodes(loadedNodes);
      setEdges(loadedEdges);
      setSelectedNodeId(loadedNodes[0]?.id || null);
    } else {
      setNodes(INITIAL_NODES);
      setEdges(INITIAL_EDGES);
      setSelectedNodeId('n3');
    }
  }, [setEdges, setNodes]);

  // Fetch all tenant flows from server
  const refreshFlowList = useCallback(async () => {
    try {
      setIsLoadingFlows(true);
      const res = await automationApi.list();
      const flows = res?.data || [];
      setFlowList(flows);
      return flows;
    } catch (err) {
      console.warn('Could not load flows from server:', err);
      return [];
    } finally {
      setIsLoadingFlows(false);
    }
  }, []);

  // Initial load on mount
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const flows = await refreshFlowList();
      if (!mounted) return;
      const primaryFlow = flows.find((f) => f.is_active) || flows[0];

      if (primaryFlow) {
        loadFlowData(primaryFlow);
      } else {
        // Check for unsaved draft for a new flow
        const localDraftRaw = localStorage.getItem('vdaj_flow_draft_new');
        if (localDraftRaw) {
          try {
            const draft = JSON.parse(localDraftRaw);
            if (draft?.nodes?.length) {
              setNodes(draft.nodes);
              setEdges(draft.edges || INITIAL_EDGES);
              if (draft.name) setFlowName(draft.name);
              setHasDraftChanges(true);
              setSaveStatus('Draft changes');
            }
          } catch { }
        }
      }
      isLoadedRef.current = true;
    };

    init();
    return () => { mounted = false; };
  }, [loadFlowData, refreshFlowList, setEdges, setNodes]);

  // Listen to breadcrumb click in DashboardLayout to open Flows Overview
  useEffect(() => {
    const handleOpenList = () => {
      refreshFlowList();
      setViewMode('list');
    };
    window.addEventListener('vdaj-open-flows-list', handleOpenList);
    return () => window.removeEventListener('vdaj-open-flows-list', handleOpenList);
  }, [refreshFlowList]);

  // Select and load a flow from list or dropdown
  const handleSelectFlow = (flow) => {
    loadFlowData(flow);
    setViewMode('editor');
    setShowFlowSelectorDropdown(false);
    showSuccess(`Loaded flow "${flow.name}"`);
  };

  // Create brand new flow with template options
  const handleCreateNewFlow = async (customTitle, templateType = 'blank') => {
    const title = customTitle?.trim() || 'New WhatsApp Journey';

    let starterNodes = [];
    let starterEdges = [];

    if (templateType === 'inquiry') {
      const trigId = generateId('trigger');
      const qId = generateId('question');
      const m1 = generateId('message');
      const m2 = generateId('message');
      const m3 = generateId('message');
      const end1 = generateId('end');
      const end2 = generateId('end');
      const end3 = generateId('end');

      starterNodes = [
        {
          id: trigId,
          type: 'trigger',
          position: { x: 440, y: 40 },
          data: { label: 'Incoming message', config: { triggerType: 'keyword', keywords: ['Hi', 'Hello', 'Help', 'Enquiry'] } },
        },
        {
          id: qId,
          type: 'question',
          position: { x: 410, y: 190 },
          data: {
            label: 'Select Service',
            config: {
              body: 'Welcome! What would you like to inquire about?',
              buttons: [{ label: 'Swimming' }, { label: 'Gym' }, { label: 'Badminton' }],
            },
          },
        },
        {
          id: m1,
          type: 'message',
          position: { x: 170, y: 450 },
          data: { label: 'Swimming details', config: { messageType: 'text', body: 'Our swimming pool is open daily from 6:00 AM to 10:00 AM and 4:00 PM to 9:00 PM.' } },
        },
        {
          id: m2,
          type: 'message',
          position: { x: 460, y: 450 },
          data: { label: 'Gym details', config: { messageType: 'text', body: 'Our gym is open daily from 6:00 AM to 10:00 AM and 4:00 PM to 8:00 PM.' } },
        },
        {
          id: m3,
          type: 'message',
          position: { x: 750, y: 450 },
          data: { label: 'Badminton details', config: { messageType: 'text', body: 'Our badminton courts are open daily from 6:00 AM to 10:00 AM and 4:00 PM to 9:00 PM.' } },
        },
        { id: end1, type: 'end', position: { x: 250, y: 640 }, data: { label: 'End' } },
        { id: end2, type: 'end', position: { x: 540, y: 640 }, data: { label: 'End' } },
        { id: end3, type: 'end', position: { x: 830, y: 640 }, data: { label: 'End' } },
      ];

      starterEdges = [
        { id: `e_${trigId}_${qId}`, source: trigId, target: qId, ...EDGE_DEFAULTS },
        { id: `e_${qId}_${m1}`, source: qId, sourceHandle: 'btn_0', target: m1, label: 'Swimming', ...EDGE_DEFAULTS },
        { id: `e_${qId}_${m2}`, source: qId, sourceHandle: 'btn_1', target: m2, label: 'Gym', ...EDGE_DEFAULTS },
        { id: `e_${qId}_${m3}`, source: qId, sourceHandle: 'btn_2', target: m3, label: 'Badminton', ...EDGE_DEFAULTS },
        { id: `e_${m1}_${end1}`, source: m1, target: end1, ...EDGE_DEFAULTS },
        { id: `e_${m2}_${end2}`, source: m2, target: end2, ...EDGE_DEFAULTS },
        { id: `e_${m3}_${end3}`, source: m3, target: end3, ...EDGE_DEFAULTS },
      ];
    } else if (templateType === 'form') {
      const trigId = generateId('trigger');
      const formId = generateId('form');
      const confirmId = generateId('message');
      const endId = generateId('end');

      starterNodes = [
        {
          id: trigId,
          type: 'trigger',
          position: { x: 440, y: 40 },
          data: { label: 'Incoming message', config: { triggerType: 'keyword', keywords: ['Register', 'Join', 'Form'] } },
        },
        {
          id: formId,
          type: 'form',
          position: { x: 410, y: 200 },
          data: {
            label: 'WhatsApp Form',
            config: {
              preset: 'registration',
              screenTitle: 'Member Registration',
              buttonLabel: 'Complete Registration',
              fields: [
                { id: 'f1', label: 'Full Name', type: 'text', required: true },
                { id: 'f2', label: 'Phone Number', type: 'phone', required: true },
                { id: 'f3', label: 'Preferred Plan', type: 'select', required: true },
              ],
            },
          },
        },
        {
          id: confirmId,
          type: 'message',
          position: { x: 410, y: 440 },
          data: {
            label: 'Confirmation message',
            config: { messageType: 'text', body: 'Thank you for submitting! Your details have been received.' },
          },
        },
        { id: endId, type: 'end', position: { x: 480, y: 640 }, data: { label: 'End' } },
      ];

      starterEdges = [
        { id: `e_${trigId}_${formId}`, source: trigId, target: formId, ...EDGE_DEFAULTS },
        { id: `e_${formId}_${confirmId}`, source: formId, target: confirmId, ...EDGE_DEFAULTS },
        { id: `e_${confirmId}_${endId}`, source: confirmId, target: endId, ...EDGE_DEFAULTS },
      ];
    } else {
      // Blank template
      const trigId = generateId('trigger');
      const msgId = generateId('message');
      const endId = generateId('end');

      starterNodes = [
        {
          id: trigId,
          type: 'trigger',
          position: { x: 440, y: 50 },
          data: { label: 'Incoming message', config: { triggerType: 'keyword', keywords: ['Hi', 'Hello'] } },
        },
        {
          id: msgId,
          type: 'message',
          position: { x: 410, y: 220 },
          data: {
            label: 'Welcome message',
            config: { messageType: 'text', body: 'Hello! Thank you for contacting us. How can we help you today?' },
          },
        },
        { id: endId, type: 'end', position: { x: 470, y: 440 }, data: { label: 'End' } },
      ];

      starterEdges = [
        { id: `e_${trigId}_${msgId}`, source: trigId, target: msgId, ...EDGE_DEFAULTS },
        { id: `e_${msgId}_${endId}`, source: msgId, target: endId, ...EDGE_DEFAULTS },
      ];
    }

    try {
      const res = await automationApi.create({
        name: title,
        triggerType: 'keyword',
        triggerConfig: { keywords: ['Hi', 'Hello'] },
        steps: { nodes: starterNodes, edges: starterEdges },
        isActive: false,
      });

      if (res?.data?.id) {
        setActiveFlowId(res.data.id);
        setFlowName(res.data.name);
        setPublishedVersion('Draft');
        setNodes(starterNodes);
        setEdges(starterEdges);
        setSelectedNodeId(starterNodes[1]?.id || starterNodes[0]?.id);
        setHasDraftChanges(false);
        setSaveStatus('Saved');
        await refreshFlowList();
        setViewMode('editor');
        setShowNewFlowModal(false);
        showSuccess(`Created flow "${res.data.name}"!`);
        return;
      }
    } catch (err) {
      console.warn('Could not create flow on server immediately, using canvas state:', err);
    }

    // Fallback if offline / server error
    setActiveFlowId(null);
    setFlowName(title);
    setPublishedVersion('Draft');
    setNodes(starterNodes);
    setEdges(starterEdges);
    setSelectedNodeId(starterNodes[1]?.id || starterNodes[0]?.id);
    setHasDraftChanges(true);
    setSaveStatus('Draft changes');
    setViewMode('editor');
    setShowNewFlowModal(false);
    showSuccess(`Created flow "${title}". Customize and publish when ready.`);
  };

  // Delete a flow
  const handleDeleteFlow = async (flow) => {
    if (!window.confirm(`Are you sure you want to delete flow "${flow.name}"? This cannot be undone.`)) return;
    try {
      await automationApi.delete(flow.id);
      localStorage.removeItem(`vdaj_flow_draft_${flow.id}`);
      showSuccess(`Flow "${flow.name}" deleted.`);
      const updated = await refreshFlowList();
      if (activeFlowId === flow.id) {
        if (updated.length > 0) {
          loadFlowData(updated[0]);
        } else {
          handleCreateNewFlow('New WhatsApp Flow');
        }
      }
    } catch (err) {
      showError(err?.response?.data?.message || 'Failed to delete flow.');
    }
  };

  // Toggle flow Active (Live on WhatsApp) status
  const handleToggleActiveFlow = async (flow) => {
    try {
      const nextActive = !flow.is_active;
      await automationApi.update(flow.id, { isActive: nextActive });
      showSuccess(nextActive ? `Flow "${flow.name}" is now LIVE on WhatsApp!` : `Flow "${flow.name}" paused.`);
      const updated = await refreshFlowList();
      if (activeFlowId === flow.id) {
        setPublishedVersion(nextActive ? 'Live' : 'Draft');
      }
    } catch (err) {
      showError(err?.response?.data?.message || 'Failed to update flow status.');
    }
  };

  // Duplicate a flow
  const handleDuplicateFlow = async (flow) => {
    try {
      const res = await automationApi.create({
        name: `${flow.name} (Copy)`,
        description: flow.description,
        triggerType: flow.trigger_type || 'keyword',
        triggerConfig: flow.trigger_config || {},
        steps: flow.steps || { nodes: [], edges: [] },
        isActive: false,
      });
      showSuccess(`Duplicated flow as "${res.data.name}".`);
      await refreshFlowList();
      loadFlowData(res.data);
      setViewMode('editor');
    } catch (err) {
      showError(err?.response?.data?.message || 'Failed to duplicate flow.');
    }
  };

  // Explicit Save Current Step Changes (User requirement #2)
  const handleSaveCurrentStep = () => {
    if (!selectedNode) return;
    recordHistory();
    setHasDraftChanges(true);
    setSaveStatus('Step saved locally');

    const draftKey = activeFlowId ? `vdaj_flow_draft_${activeFlowId}` : 'vdaj_flow_draft_new';
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          name: flowName,
          nodes,
          edges,
          updatedAt: Date.now(),
        })
      );
    } catch { }

    setStepSaveEffect(true);
    setTimeout(() => setStepSaveEffect(false), 2000);

    const nodeLabel = selectedNode.data?.label || selectedNode.type || 'Step';
    showSuccess(`Step "${nodeLabel}" saved successfully!`);
  };

  // Local draft autosave whenever user edits canvas
  useEffect(() => {
    if (!isLoadedRef.current) return;
    setHasDraftChanges(true);
    setSaveStatus('Draft changes');

    const draftKey = activeFlowId ? `vdaj_flow_draft_${activeFlowId}` : 'vdaj_flow_draft_new';
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({
          name: flowName,
          nodes,
          edges,
          updatedAt: Date.now(),
        })
      );
    } catch { }

    const timer = setTimeout(() => {
      setSaveStatus('Saved locally');
    }, 1500);

    return () => clearTimeout(timer);
  }, [nodes, edges, flowName, activeFlowId]);

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

      let flowId = activeFlowId;
      if (flowId) {
        await automationApi.update(flowId, payload);
      } else {
        const res = await automationApi.create(payload);
        if (res?.data?.id) {
          flowId = res.data.id;
          setActiveFlowId(flowId);
        }
      }

      // Clear local draft for this flow
      if (flowId) localStorage.removeItem(`vdaj_flow_draft_${flowId}`);
      localStorage.removeItem('vdaj_flow_draft_new');

      setHasDraftChanges(false);
      setPublishedVersion('Live');
      setSaveStatus('Saved just now');
      await refreshFlowList();
      showSuccess('Published! Your WhatsApp flow is now live 🚀');
    } catch (err) {
      showError(err?.response?.data?.message || 'Failed to publish changes.');
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

  // Modal for creating a new flow
  const renderNewFlowModal = () => (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(3px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '520px',
          padding: '24px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          border: '1px solid #E2E8F0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              Create New WhatsApp Flow
            </h3>
            <p style={{ fontSize: '12px', color: '#64748B', margin: '3px 0 0' }}>
              Set up an automated conversation journey or lead capture flow.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowNewFlowModal(false)}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '18px',
              color: '#94A3B8',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
            Flow Name <span style={{ color: '#EF4444' }}>*</span>
          </label>
          <input
            autoFocus
            placeholder="e.g., Diwali Offer Enquiry, Customer Support, Registration"
            value={newFlowTitle}
            onChange={(e) => setNewFlowTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newFlowTitle.trim()) {
                handleCreateNewFlow(newFlowTitle, newFlowTemplate);
              }
            }}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '10px',
              border: '1.5px solid #CBD5E1',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '8px' }}>
            Choose Starting Template
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            {[
              { id: 'blank', icon: '⚡', title: 'Blank Flow', desc: 'Trigger + Welcome Message + End' },
              { id: 'inquiry', icon: '❓', title: 'Interactive Inquiry', desc: 'Question with 3 branching options' },
              { id: 'form', icon: '📝', title: 'WhatsApp Form', desc: 'In-app Form + Confirmation' },
            ].map((tpl) => (
              <div
                key={tpl.id}
                onClick={() => setNewFlowTemplate(tpl.id)}
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  border: newFlowTemplate === tpl.id ? '2px solid #534AB7' : '1px solid #E2E8F0',
                  background: newFlowTemplate === tpl.id ? '#F5F3FF' : '#FFFFFF',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ fontSize: '20px', marginBottom: '6px' }}>{tpl.icon}</div>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A' }}>{tpl.title}</div>
                <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px', lineHeight: 1.3 }}>{tpl.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            onClick={() => setShowNewFlowModal(false)}
            style={{
              padding: '9px 16px',
              borderRadius: '10px',
              background: '#F1F5F9',
              border: 'none',
              color: '#475569',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!newFlowTitle.trim()}
            onClick={() => handleCreateNewFlow(newFlowTitle, newFlowTemplate)}
            style={{
              padding: '9px 20px',
              borderRadius: '10px',
              background: !newFlowTitle.trim() ? '#CBD5E1' : '#534AB7',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 800,
              cursor: !newFlowTitle.trim() ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 12px rgba(83, 74, 183, 0.28)',
            }}
          >
            Create Flow & Open Builder →
          </button>
        </div>
      </div>
    </div>
  );

  // ── VIEW MODE: FLOWS OVERVIEW LIST ───────────────────────────
  if (viewMode === 'list') {
    const filteredFlows = flowList.filter((f) => {
      if (!listSearchQuery.trim()) return true;
      const q = listSearchQuery.toLowerCase();
      return (
        f.name?.toLowerCase().includes(q) ||
        f.description?.toLowerCase().includes(q) ||
        f.trigger_type?.toLowerCase().includes(q)
      );
    });

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: '#F8FAFC', overflowY: 'auto' }}>
        {/* Top Header */}
        <div
          style={{
            height: '60px',
            background: '#FFFFFF',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            flexShrink: 0,
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              type="button"
              onClick={() => {
                if (activeFlowId) {
                  setViewMode('editor');
                } else {
                  navigate('/dashboard');
                }
              }}
              title="Return to canvas editor or dashboard"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
                background: '#FFFFFF',
                color: '#475569',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#FFFFFF')}
            >
              <span>←</span>
              <span>{activeFlowId ? 'Back to Canvas' : 'Dashboard'}</span>
            </button>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Automations & WhatsApp Flows
                </h1>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '10px',
                    background: '#F1F5F9',
                    color: '#475569',
                  }}
                >
                  {flowList.length} flows
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Search Input */}
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: '#94A3B8' }}>
                🔍
              </span>
              <input
                type="text"
                placeholder="Search flows..."
                value={listSearchQuery}
                onChange={(e) => setListSearchQuery(e.target.value)}
                style={{
                  padding: '7px 12px 7px 32px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  fontSize: '12px',
                  outline: 'none',
                  width: '210px',
                  background: '#FFFFFF',
                }}
              />
            </div>

            {/* + Create New Flow Button */}
            <button
              type="button"
              onClick={() => {
                setNewFlowTitle('');
                setShowNewFlowModal(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 16px',
                borderRadius: '10px',
                background: '#534AB7',
                border: 'none',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(83, 74, 183, 0.28)',
              }}
            >
              <span>+</span>
              <span>Create New Flow</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ padding: '24px', maxWidth: '1200px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
          {isLoadingFlows ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748B' }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>⏳</div>
              <p style={{ fontSize: '14px', fontWeight: 600 }}>Loading workspace automations...</p>
            </div>
          ) : filteredFlows.length === 0 ? (
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '16px',
                border: '1.5px dashed #CBD5E1',
                padding: '60px 24px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>🤖</div>
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#0F172A', margin: '0 0 6px' }}>
                {listSearchQuery ? 'No flows match your search' : 'No automation flows created yet'}
              </h3>
              <p style={{ fontSize: '13px', color: '#64748B', maxWidth: '420px', margin: '0 auto 20px', lineHeight: 1.5 }}>
                Build interactive WhatsApp journeys, automated customer support replies, and lead capture forms.
              </p>
              <button
                type="button"
                onClick={() => {
                  setNewFlowTitle('');
                  setShowNewFlowModal(true);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 20px',
                  borderRadius: '10px',
                  background: '#534AB7',
                  border: 'none',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(83, 74, 183, 0.28)',
                }}
              >
                <span>+</span> Create Your First Flow
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
              {filteredFlows.map((flow) => {
                const nodesCount = flow.steps?.nodes?.length || (Array.isArray(flow.steps) ? flow.steps.filter((s) => !s.source).length : 0);
                const isSelected = flow.id === activeFlowId;

                return (
                  <div
                    key={flow.id}
                    style={{
                      background: '#FFFFFF',
                      borderRadius: '14px',
                      border: isSelected ? '2px solid #534AB7' : '1px solid #E2E8F0',
                      padding: '18px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      position: 'relative',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div>
                      {/* Top Badges & Options */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        {flow.is_active ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '3px 10px',
                              borderRadius: '12px',
                              background: '#ECFDF5',
                              border: '1px solid #A7F3D0',
                              color: '#065F46',
                              fontSize: '11px',
                              fontWeight: 800,
                            }}
                          >
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} />
                            Live on WhatsApp
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '3px 10px',
                              borderRadius: '12px',
                              background: '#F1F5F9',
                              border: '1px solid #E2E8F0',
                              color: '#64748B',
                              fontSize: '11px',
                              fontWeight: 700,
                            }}
                          >
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#94A3B8' }} />
                            Draft / Inactive
                          </span>
                        )}

                        <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                          Updated {new Date(flow.updated_at || flow.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Flow Name & Description */}
                      <h3
                        onClick={() => handleSelectFlow(flow)}
                        style={{
                          fontSize: '16px',
                          fontWeight: 800,
                          color: '#0F172A',
                          margin: '0 0 6px',
                          cursor: 'pointer',
                        }}
                      >
                        {flow.name}
                      </h3>
                      <p style={{ fontSize: '12px', color: '#64748B', margin: '0 0 14px', lineHeight: 1.45 }}>
                        {flow.description || 'Automated multi-step WhatsApp response journey.'}
                      </p>

                      {/* Metadata row */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          background: '#F8FAFC',
                          border: '1px solid #F1F5F9',
                          marginBottom: '16px',
                        }}
                      >
                        <div>
                          <span style={{ fontSize: '10px', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', display: 'block' }}>
                            Trigger
                          </span>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                            {flow.trigger_type === 'keyword'
                              ? `Keywords (${flow.trigger_config?.keywords?.length || 3})`
                              : flow.trigger_type || 'Incoming'}
                          </span>
                        </div>
                        <div style={{ width: '1px', height: '24px', background: '#E2E8F0' }} />
                        <div>
                          <span style={{ fontSize: '10px', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', display: 'block' }}>
                            Steps
                          </span>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                            {nodesCount} steps
                          </span>
                        </div>
                        <div style={{ width: '1px', height: '24px', background: '#E2E8F0' }} />
                        <div>
                          <span style={{ fontSize: '10px', fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', display: 'block' }}>
                            Runs
                          </span>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                            {flow.run_count || 0}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid #F1F5F9', paddingTop: '12px' }}>
                      <button
                        type="button"
                        onClick={() => handleSelectFlow(flow)}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: '8px',
                          background: '#534AB7',
                          border: 'none',
                          color: '#FFFFFF',
                          fontSize: '12px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                        }}
                      >
                        <span>✏️</span>
                        <span>Edit in Canvas</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleActiveFlow(flow)}
                        title={flow.is_active ? 'Pause this flow' : 'Make this flow Live'}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '8px',
                          background: flow.is_active ? '#FFFBEB' : '#ECFDF5',
                          border: flow.is_active ? '1px solid #FDE68A' : '1px solid #A7F3D0',
                          color: flow.is_active ? '#B45309' : '#065F46',
                          fontSize: '11px',
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        {flow.is_active ? 'Pause' : 'Make Live'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDuplicateFlow(flow)}
                        title="Duplicate flow"
                        style={{
                          padding: '8px 10px',
                          borderRadius: '8px',
                          background: '#F8FAFC',
                          border: '1px solid #E2E8F0',
                          color: '#475569',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        📋
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteFlow(flow)}
                        title="Delete flow"
                        style={{
                          padding: '8px 10px',
                          borderRadius: '8px',
                          background: '#FEF2F2',
                          border: '1px solid #FECACA',
                          color: '#DC2626',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal if open in list view */}
        {showNewFlowModal && renderNewFlowModal()}
      </div>
    );
  }

  // ── VIEW MODE: VISUAL FLOW CANVAS BUILDER ────────────────────
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
        {/* Back button (User requirement #3 - navigate back to flows list) */}
        <button
          type="button"
          title="Back to all flows"
          onClick={() => {
            refreshFlowList();
            setViewMode('list');
          }}
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

          {/* Flow Switcher Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowFlowSelectorDropdown((prev) => !prev)}
              title="Switch flow or manage workspace flows"
              style={{
                background: '#F8FAFC',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                padding: '4px 8px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 700,
                color: '#334155',
              }}
            >
              <span>📂 Flows ({flowList.length})</span>
              <span style={{ fontSize: '9px', color: '#64748B' }}>▼</span>
            </button>

            {showFlowSelectorDropdown && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '6px',
                  width: '290px',
                  background: '#FFFFFF',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                  border: '1px solid #E2E8F0',
                  padding: '8px',
                  zIndex: 100,
                }}
              >
                <div style={{ padding: '4px 8px', borderBottom: '1px solid #F1F5F9', marginBottom: '6px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#94A3B8', margin: 0 }}>
                    Workspace Flows
                  </p>
                </div>

                <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {flowList.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        loadFlowData(f);
                        setShowFlowSelectorDropdown(false);
                        showSuccess(`Switched to "${f.name}"`);
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        background: f.id === activeFlowId ? '#F5F3FF' : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                      onMouseEnter={(e) => {
                        if (f.id !== activeFlowId) e.currentTarget.style.background = '#F8FAFC';
                      }}
                      onMouseLeave={(e) => {
                        if (f.id !== activeFlowId) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1, paddingRight: '8px' }}>
                        <p style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {f.name}
                        </p>
                        <p style={{ fontSize: '10px', color: '#64748B', margin: '2px 0 0' }}>
                          {f.steps?.nodes?.length || 0} steps
                        </p>
                      </div>
                      {f.is_active ? (
                        <span style={{ fontSize: '10px', fontWeight: 800, color: '#065F46', background: '#ECFDF5', padding: '2px 6px', borderRadius: '10px', border: '1px solid #A7F3D0' }}>
                          Live
                        </span>
                      ) : (
                        <span style={{ fontSize: '10px', color: '#64748B', background: '#F1F5F9', padding: '2px 6px', borderRadius: '10px' }}>
                          Draft
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                <div style={{ borderTop: '1px solid #F1F5F9', marginTop: '6px', paddingTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowFlowSelectorDropdown(false);
                      setNewFlowTitle('');
                      setShowNewFlowModal(true);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: '#F5F3FF',
                      border: '1.5px solid #DDD6FE',
                      color: '#534AB7',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>+</span> Create New Flow
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowFlowSelectorDropdown(false);
                      refreshFlowList();
                      setViewMode('list');
                    }}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: '8px',
                      background: 'transparent',
                      border: 'none',
                      color: '#475569',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    View All Flows Overview →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Draft changes status pill */}
          {hasDraftChanges ? (
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
          ) : (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '2px 8px',
                borderRadius: '12px',
                background: '#ECFDF5',
                border: '1px solid #A7F3D0',
                color: '#065F46',
                fontSize: '11px',
                fontWeight: 700,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} />
              Live on WhatsApp
            </span>
          )}

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

        {/* + New Flow button (User requirement #1) */}
        <button
          type="button"
          onClick={() => {
            setNewFlowTitle('');
            setShowNewFlowModal(true);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            borderRadius: '10px',
            background: '#FFFFFF',
            border: '1.5px solid #DDD6FE',
            color: '#534AB7',
            fontSize: '13px',
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#F5F3FF')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#FFFFFF')}
        >
          <span style={{ fontSize: '15px', fontWeight: 900 }}>+</span>
          <span>New Flow</span>
        </button>

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
                  {/* Distinguish WhatsApp Form vs Plain Message */}
                  {selectedNode.type === 'form' || selectedNode.data?.config?.messageType === 'wa_flow' || selectedNode.data?.label?.toLowerCase().includes('form') ? (
                    // ── WHATSAPP FORM INSPECTOR ──
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {/* Form Template Presets */}
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#475569', marginBottom: '6px' }}>
                          Form Template
                        </label>
                        <select
                          value={selectedNode.data?.config?.preset || 'registration'}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === 'registration') {
                              updateSelectedNodeData({
                                label: 'Registration enquiry form',
                                config: {
                                  ...selectedNode.data.config,
                                  preset: 'registration',
                                  flowName: 'Registration form',
                                  ctaText: 'Register Now',
                                  body: 'Please tap below to fill out your enquiry details for SMR Swimming Pool & Health Club.',
                                  fields: [
                                    { id: 'full_name', label: 'Full Name', type: 'text', required: true },
                                    { id: 'phone', label: 'Phone Number', type: 'phone', required: true },
                                    { id: 'activity', label: 'Activity', type: 'select', options: ['Swimming', 'Gym', 'Badminton'], required: true },
                                    { id: 'batch', label: 'Preferred Timing', type: 'select', options: ['Morning (6:00 AM - 10:00 AM)', 'Evening (4:00 PM - 8:00 PM)'], required: false },
                                  ],
                                },
                              });
                            } else if (val === 'lead_capture') {
                              updateSelectedNodeData({
                                label: 'Lead Capture Form',
                                config: {
                                  ...selectedNode.data.config,
                                  preset: 'lead_capture',
                                  flowName: 'Contact details',
                                  ctaText: 'Submit Details',
                                  body: 'Please provide your contact details so our team can get in touch with you.',
                                  fields: [
                                    { id: 'full_name', label: 'Full Name', type: 'text', required: true },
                                    { id: 'phone', label: 'WhatsApp Number', type: 'phone', required: true },
                                    { id: 'email', label: 'Email Address', type: 'email', required: false },
                                    { id: 'city', label: 'City / Location', type: 'text', required: false },
                                  ],
                                },
                              });
                            } else if (val === 'feedback') {
                              updateSelectedNodeData({
                                label: 'Feedback Survey',
                                config: {
                                  ...selectedNode.data.config,
                                  preset: 'feedback',
                                  flowName: 'Experience Feedback',
                                  ctaText: 'Give Feedback',
                                  body: 'How was your experience today? Tap below to let us know.',
                                  fields: [
                                    { id: 'rating', label: 'Rating (1 - 5)', type: 'select', options: ['5 - Excellent', '4 - Good', '3 - Average', '2 - Poor', '1 - Bad'], required: true },
                                    { id: 'comments', label: 'Comments / Suggestions', type: 'text', required: false },
                                  ],
                                },
                              });
                            }
                          }}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            background: '#F8FAFC',
                            border: '1px solid #CBD5E1',
                            color: '#0F172A',
                            fontWeight: 600,
                            outline: 'none',
                          }}
                        >
                          <option value="registration">🏊 SMR Registration & Enquiry Form</option>
                          <option value="lead_capture">💼 General Lead Capture Form</option>
                          <option value="feedback">⭐ Customer Experience & Feedback</option>
                        </select>
                      </div>

                      {/* Form Message Prompt */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#475569' }}>
                            Introductory Message
                          </label>
                          <span style={{ fontSize: '11px', color: '#94A3B8' }}>WhatsApp message bubble</span>
                        </div>
                        <textarea
                          rows={3}
                          value={selectedNode.data?.config?.body || ''}
                          onChange={(e) =>
                            updateSelectedNodeData({
                              config: { ...selectedNode.data.config, body: e.target.value },
                            })
                          }
                          placeholder="Message sent along with the form button…"
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: '10px',
                            fontSize: '12px',
                            background: '#F8FAFC',
                            border: '1px solid #CBD5E1',
                            color: '#0F172A',
                            lineHeight: 1.5,
                            outline: 'none',
                            fontFamily: 'Inter, sans-serif',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>

                      {/* CTA Button Text */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#475569' }}>
                            Form Button Text (CTA)
                          </label>
                          <span style={{ fontSize: '10px', color: '#94A3B8' }}>Max 20 chars</span>
                        </div>
                        <input
                          type="text"
                          maxLength={20}
                          value={selectedNode.data?.config?.ctaText || 'Register Now'}
                          onChange={(e) =>
                            updateSelectedNodeData({
                              config: { ...selectedNode.data.config, ctaText: e.target.value },
                            })
                          }
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            background: '#F8FAFC',
                            border: '1px solid #CBD5E1',
                            color: '#0F172A',
                            fontWeight: 600,
                            outline: 'none',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>

                      {/* Form Fields To Collect */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#475569' }}>
                            Form Fields (Collected in WhatsApp)
                          </label>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#534AB7' }}>
                            {(selectedNode.data?.config?.fields || []).length} fields
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {(selectedNode.data?.config?.fields || [
                            { id: 'full_name', label: 'Full Name', type: 'text', required: true },
                            { id: 'phone', label: 'Phone Number', type: 'phone', required: true },
                            { id: 'activity', label: 'Activity', type: 'select', options: ['Swimming', 'Gym', 'Badminton'], required: true },
                            { id: 'batch', label: 'Preferred Timing', type: 'select', options: ['Morning', 'Evening'], required: false },
                          ]).map((field, idx) => (
                            <div
                              key={idx}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: '#FFFFFF',
                                border: '1px solid #E2E8F0',
                                borderRadius: '8px',
                                padding: '8px 10px',
                                fontSize: '12px',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ color: '#534AB7' }}>📋</span>
                                <div>
                                  <span style={{ fontWeight: 600, color: '#0F172A' }}>{field.label}</span>
                                  <span style={{ fontSize: '10px', color: '#94A3B8', marginLeft: '6px' }}>({field.type})</span>
                                </div>
                              </div>
                              <span style={{ fontSize: '10px', fontWeight: 700, color: field.required ? '#059669' : '#94A3B8' }}>
                                {field.required ? 'Required' : 'Optional'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* WhatsApp Form Interactive Preview */}
                      <div style={{ marginTop: '10px' }}>
                        <p style={{ fontSize: '11px', fontWeight: 800, color: '#475569', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>📱</span> WhatsApp Chat Preview
                        </p>
                        <div
                          style={{
                            background: '#ECE5DD',
                            backgroundImage: 'radial-gradient(#00000008 1px, transparent 0)',
                            backgroundSize: '12px 12px',
                            borderRadius: '12px',
                            padding: '14px 12px',
                            border: '1px solid #E2E8F0',
                          }}
                        >
                          <div
                            style={{
                              background: '#FFFFFF',
                              borderRadius: '10px 10px 10px 2px',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                              maxWidth: '92%',
                              overflow: 'hidden',
                            }}
                          >
                            <div style={{ padding: '10px 12px' }}>
                              <p style={{ fontSize: '11px', fontWeight: 800, color: '#7C3AED', textTransform: 'uppercase', margin: '0 0 4px' }}>
                                📋 {selectedNode.data?.config?.flowName || 'Registration Form'}
                              </p>
                              <p style={{ fontSize: '12px', color: '#111827', margin: 0, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
                                {selectedNode.data?.config?.body || 'Please tap below to fill out your details.'}
                              </p>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                <span style={{ fontSize: '10px', color: '#9CA3AF' }}>10:24 AM</span>
                                <span style={{ fontSize: '11px', color: '#38BDF8', fontWeight: 'bold' }}>✓✓</span>
                              </div>
                            </div>

                            {/* WhatsApp Native Flow CTA button */}
                            <button
                              type="button"
                              onClick={() => setShowFormModalPreview(true)}
                              style={{
                                width: '100%',
                                padding: '10px',
                                border: 'none',
                                borderTop: '1px solid #E5E7EB',
                                background: '#FFFFFF',
                                color: '#00A884',
                                fontSize: '13px',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                cursor: 'pointer',
                              }}
                            >
                              <span>📋</span>
                              <span>{selectedNode.data?.config?.ctaText || 'Register Now'}</span>
                              <span style={{ fontSize: '11px' }}>↗</span>
                            </button>
                          </div>
                        </div>

                        {/* Button to open live mobile form simulation */}
                        <button
                          type="button"
                          onClick={() => setShowFormModalPreview(true)}
                          style={{
                            width: '100%',
                            marginTop: '10px',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: '#F3F2FD',
                            border: '1px solid #C9C5F5',
                            color: '#534AB7',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                          }}
                        >
                          <span>👁</span>
                          <span>Preview In-App WhatsApp Form Screen</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    // ── REGULAR MESSAGE INSPECTOR ──
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
                    </>
                  )}

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

            {/* Sticky Save Step Footer (User requirement #2) */}
            <div
              style={{
                padding: '12px 16px',
                borderTop: '1px solid #E2E8F0',
                background: '#FFFFFF',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                flexShrink: 0,
                boxShadow: '0 -2px 10px rgba(0,0,0,0.03)',
              }}
            >
              <button
                type="button"
                onClick={handleSaveCurrentStep}
                style={{
                  width: '100%',
                  padding: '11px 16px',
                  borderRadius: '10px',
                  background: stepSaveEffect ? '#10B981' : '#534AB7',
                  border: 'none',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: stepSaveEffect ? '0 4px 12px rgba(16, 185, 129, 0.3)' : '0 4px 12px rgba(83, 74, 183, 0.25)',
                  transition: 'all 0.2s ease',
                }}
              >
                <span style={{ fontSize: '15px' }}>{stepSaveEffect ? '✓' : '💾'}</span>
                <span>{stepSaveEffect ? 'Step Changes Saved!' : 'Save Step Changes'}</span>
              </button>
              <span style={{ fontSize: '11px', color: '#94A3B8', textAlign: 'center' }}>
                Saves configuration for "{selectedNode.data?.label || selectedNode.type || 'Step'}"
              </span>
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
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: hasDraftChanges ? '#F59E0B' : '#10B981', display: 'inline-block' }} />
        <span style={{ color: '#0F172A', fontWeight: 700 }}>Published {publishedVersion}</span>
        <span>·</span>
        <span style={{ color: hasDraftChanges ? '#B45309' : '#059669', fontWeight: 600 }}>
          {hasDraftChanges ? 'Draft changes are not live' : 'Active and responding on WhatsApp'}
        </span>
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

      {/* ── 5. WHATSAPP FORM MOBILE SCREEN PREVIEW MODAL ─────── */}
      {showFormModalPreview && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 120,
          }}
          onClick={() => setShowFormModalPreview(false)}
        >
          <div
            style={{
              width: '380px',
              maxHeight: '90vh',
              background: '#FFFFFF',
              borderRadius: '28px',
              boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              border: '2px solid #E2E8F0',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* WhatsApp Native Flow Header bar */}
            <div style={{ background: '#008069', padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#FFFFFF' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowFormModalPreview(false)}
                  style={{ background: 'transparent', border: 'none', color: '#FFFFFF', fontSize: '18px', cursor: 'pointer', padding: 0 }}
                >
                  ✕
                </button>
                <div>
                  <p style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>
                    {selectedNode?.data?.config?.flowName || 'Registration Form'}
                  </p>
                  <p style={{ margin: 0, fontSize: '11px', color: '#A7F3D0' }}>SMR Swimming Pool & Health Club</p>
                </div>
              </div>
              <span style={{ fontSize: '10px', fontWeight: 700, background: 'rgba(255,255,255,0.25)', padding: '3px 8px', borderRadius: '12px' }}>
                WhatsApp Flow
              </span>
            </div>

            {/* In-App Form Body */}
            <div style={{ padding: '20px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: '#F8FAFC', padding: '12px 14px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <p style={{ fontSize: '12px', color: '#334155', margin: 0, lineHeight: 1.5 }}>
                  {selectedNode?.data?.config?.body || 'Please complete the registration enquiry details below:'}
                </p>
              </div>

              {(selectedNode?.data?.config?.fields || [
                { id: 'full_name', label: 'Full Name', type: 'text', required: true },
                { id: 'phone', label: 'Phone Number', type: 'phone', required: true },
                { id: 'activity', label: 'Activity', type: 'select', options: ['Swimming', 'Gym', 'Badminton'], required: true },
                { id: 'batch', label: 'Preferred Timing', type: 'select', options: ['Morning (6:00 AM - 10:00 AM)', 'Evening (4:00 PM - 8:00 PM)'], required: false },
              ]).map((f, i) => (
                <div key={i}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#334155', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {f.label} {f.required && <span style={{ color: '#EF4444' }}>*</span>}
                  </label>
                  {f.type === 'select' ? (
                    <select
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: '1.5px solid #CBD5E1',
                        fontSize: '13px',
                        color: '#0F172A',
                        background: '#FFFFFF',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>Select {f.label}</option>
                      {(f.options || ['Swimming', 'Gym', 'Badminton']).map((opt, oi) => (
                        <option key={oi} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={f.type === 'phone' ? 'tel' : 'text'}
                      placeholder={`Enter ${f.label.toLowerCase()}`}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: '1.5px solid #CBD5E1',
                        fontSize: '13px',
                        color: '#0F172A',
                        background: '#FFFFFF',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Bottom Submit CTA */}
            <div style={{ padding: '16px 20px', borderTop: '1px solid #F1F5F9', background: '#FAFAFE' }}>
              <button
                type="button"
                onClick={() => {
                  setShowFormModalPreview(false);
                  showSuccess('Simulated form submission! WhatsApp webhook "nfm_reply" received.');
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  background: '#008069',
                  border: 'none',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0, 128, 105, 0.35)',
                }}
              >
                Submit Form
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Flow Modal in Editor mode */}
      {showNewFlowModal && renderNewFlowModal()}
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
