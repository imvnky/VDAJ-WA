/**
 * VDAJ Services — InboxPage (Phase 2)
 *
 * Phase 1 features preserved:
 *  - 24-hour service window enforcement
 *  - Template picker modal
 *  - Real-time WS new_message events
 *
 * Phase 2 additions:
 *  - Filter bar: All | Assigned to Me | Unassigned  +  Open | Pending | Resolved
 *  - Agent assignment dropdown in chat header
 *  - Status change (Open / Pending / Resolve)
 *  - WS CONVERSATION_ASSIGNED event updates list in real-time
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { clsx } from 'clsx';
import { inboxApi, teamApi, templateApi, WS_BASE } from '../lib/api';
import useAuthStore from '../store/authStore';
import { showSuccess, showError } from '../components/atoms/Toast/Toast.jsx';

// ── Helpers ──────────────────────────────────────────────────
function timeAgo(ts) {
  if (!ts) return '';
  const diff = (Date.now() - new Date(ts)) / 1000;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

function Avatar({ name, phone }) {
  const letter = (name || phone || '?')[0]?.toUpperCase();
  const hue = (phone?.charCodeAt(phone.length - 1) || 0) % 360;
  return (
    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
      style={{ background: `hsl(${hue},55%,40%)` }}>
      {letter}
    </div>
  );
}

const STATUS_CFG = {
  open:     { label: 'Open',     color: '#1D9E75', bg: 'rgba(29,158,117,0.12)' },
  pending:  { label: 'Pending',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  resolved: { label: 'Resolved', color: '#6b7280', bg: 'rgba(100,100,100,0.1)'  },
};

function StatusPill({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.open;
  return (
    <span className="text-2xs font-bold px-2 py-0.5 rounded-full"
      style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

// ── 24-Hour Service Window hook ───────────────────────────────
function useServiceWindow(lastInboundAt) {
  const [remaining, setRemaining] = useState(null);

  useEffect(() => {
    if (!lastInboundAt) { setRemaining(null); return; }
    const tick = () => {
      const elapsed = (Date.now() - new Date(lastInboundAt)) / 1000;
      setRemaining(Math.max(0, 86400 - elapsed));
    };
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, [lastInboundAt]);

  if (remaining === null) return { expired: true, hoursLeft: 0, minutesLeft: 0, status: 'no_inbound' };
  if (remaining <= 0)     return { expired: true, hoursLeft: 0, minutesLeft: 0, status: 'expired' };

  const hoursLeft   = Math.floor(remaining / 3600);
  const minutesLeft = Math.floor((remaining % 3600) / 60);
  const status      = remaining < 4 * 3600 ? 'warning' : 'ok';

  return { expired: false, hoursLeft, minutesLeft, status };
}

// ── Service Window Banner ─────────────────────────────────────
function ServiceWindowBanner({ lastInboundAt }) {
  const { expired, hoursLeft, minutesLeft, status } = useServiceWindow(lastInboundAt);

  if (expired) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 shrink-0"
        style={{ background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.2)' }}>
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="#f87171" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p className="text-xs font-semibold" style={{ color: '#f87171' }}>
          ⚠️ 24-hour service window has expired.{' '}
          <span className="font-normal" style={{ color: 'rgba(248,113,113,0.7)' }}>
            Only pre-approved templates can be sent.
          </span>
        </p>
      </div>
    );
  }

  const isWarning = status === 'warning';
  const color  = isWarning ? '#f59e0b' : '#1D9E75';
  const bg     = isWarning ? 'rgba(245,158,11,0.08)' : 'rgba(29,158,117,0.08)';
  const border = isWarning ? 'rgba(245,158,11,0.2)' : 'rgba(29,158,117,0.2)';

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 shrink-0"
      style={{ background: bg, borderBottom: `1px solid ${border}` }}>
      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="text-xs font-semibold" style={{ color }}>
        Service window: {hoursLeft}h {minutesLeft}m remaining
      </p>
    </div>
  );
}

// ── Template Picker Modal ─────────────────────────────────────
function TemplatePicker({ templates, onSend, onClose }) {
  const [selected,  setSelected]  = useState(null);
  const [variables, setVariables] = useState({});
  const [sending,   setSending]   = useState(false);

  const extractVars = (body = '') => {
    const matches = [...body.matchAll(/\{\{(\d+)\}\}/g)];
    return [...new Set(matches.map((m) => m[1]))].sort((a, b) => +a - +b);
  };

  const varKeys  = selected ? extractVars(selected.body_text) : [];
  const buildBody = () => {
    if (!selected) return '';
    return selected.body_text.replace(/\{\{(\d+)\}\}/g, (_, n) => variables[n] || `{{${n}}}`);
  };

  const handleSend = async () => {
    if (!selected) return;
    setSending(true);
    try { await onSend(selected, buildBody()); onClose(); } finally { setSending(false); }
  };

  const approved = templates.filter((t) => (t.status || '').toLowerCase() === 'approved');

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl animate-scale-in"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--bg-border)' }}>
          <div>
            <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Send Template Message</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              24-hr window expired — only approved templates can be sent.
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:opacity-70"
            style={{ background: 'var(--bg-elevated)' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--text-muted)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {approved.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                No approved templates. Create and get one approved first.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {approved.map((t) => (
                  <button key={t.id} onClick={() => { setSelected(t); setVariables({}); }}
                    className="w-full text-left px-4 py-3 rounded-xl border transition-all"
                    style={{
                      background: selected?.id === t.id ? 'rgba(83,74,183,0.08)' : 'var(--bg-elevated)',
                      borderColor: selected?.id === t.id ? '#534AB7' : 'var(--bg-border)',
                    }}>
                    <p className="text-sm font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{t.name}</p>
                    <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{t.body_text}</p>
                    <div className="flex gap-1.5 mt-1.5">
                      <span className="text-2xs px-1.5 py-0.5 rounded-md font-semibold"
                        style={{ background: 'rgba(29,158,117,0.12)', color: '#1D9E75' }}>{t.category}</span>
                      <span className="text-2xs px-1.5 py-0.5 rounded-md font-semibold"
                        style={{ background: 'rgba(83,74,183,0.12)', color: '#AFA9EC' }}>{t.language}</span>
                    </div>
                  </button>
                ))}
              </div>
              {selected && varKeys.length > 0 && (
                <div className="space-y-3 pt-2 border-t" style={{ borderColor: 'var(--bg-border)' }}>
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Fill template variables:</p>
                  {varKeys.map((k) => (
                    <div key={k}>
                      <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>{`{{${k}}}`}</label>
                      <input value={variables[k] || ''} onChange={(e) => setVariables((v) => ({ ...v, [k]: e.target.value }))}
                        placeholder={`Value for {{${k}}}`}
                        className="w-full h-9 rounded-xl px-3 text-sm outline-none"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)' }} />
                    </div>
                  ))}
                </div>
              )}
              {selected && (
                <div className="rounded-xl px-4 py-3" style={{ background: '#005C4B', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <p className="text-xs font-semibold mb-1 text-white/50">Preview</p>
                  <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">{buildBody()}</p>
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t"
          style={{ borderColor: 'var(--bg-border)', background: 'var(--bg-elevated)' }}>
          <button onClick={onClose} className="h-10 px-4 rounded-xl text-sm font-semibold hover:opacity-70 transition-all"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)', color: 'var(--text-secondary)' }}>
            Cancel
          </button>
          <button onClick={handleSend} disabled={!selected || sending}
            className="h-10 px-5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#534AB7,#3B3499)' }}>
            {sending ? 'Sending…' : 'Send Template'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Conversation Card ─────────────────────────────────────────
function ConvoCard({ conv, active, onClick }) {
  return (
    <button onClick={onClick} className={clsx(
      'w-full flex items-start gap-3 px-4 py-3.5 text-left transition-colors border-b',
      active ? 'border-l-2 border-l-brand' : 'hover:opacity-80'
    )} style={{
      borderBottomColor: 'var(--bg-border)',
      background: active ? 'rgba(83,74,183,0.08)' : 'transparent',
    }}>
      <Avatar name={conv.display_name} phone={conv.phone_e164} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
            {conv.display_name || conv.phone_e164}
          </p>
          <span className="text-2xs shrink-0" style={{ color: 'var(--text-muted)' }}>
            {timeAgo(conv.last_message_at)}
          </span>
        </div>
        <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          {conv.last_message_preview || 'No messages yet'}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {conv.assigned_first && (
            <span className="text-2xs" style={{ color: '#AFA9EC' }}>
              👤 {conv.assigned_first}
            </span>
          )}
          {conv.status !== 'open' && <StatusPill status={conv.status} />}
          {conv.unread_count > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand text-2xs font-bold text-white">
              {conv.unread_count > 9 ? '9+' : conv.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Message Bubble ────────────────────────────────────────────
function MessageBubble({ msg }) {
  const isOut = msg.direction === 'outbound';
  const statusIcon = { sent: '✓', delivered: '✓✓', read: <span className="text-[#26C18E] font-bold">✓✓</span>, failed: '✗' };
  return (
    <div className={clsx('flex', isOut ? 'justify-end' : 'justify-start')}>
      <div className={clsx(
        'max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm',
        isOut
          ? 'rounded-tr-sm bg-[#534AB7] text-white border border-[#4338CA]'
          : 'rounded-tl-sm bg-white text-[#0F0F0F] border border-[#E6E4F5]'
      )}>
        {msg.sender_name && !isOut && (
          <p className="text-2xs font-bold mb-1 text-[#534AB7]">{msg.sender_name}</p>
        )}
        <p className={clsx('text-sm leading-relaxed whitespace-pre-wrap break-words', isOut ? 'text-white' : 'text-[#0F0F0F]')}>
          {msg.body}
        </p>
        <div className="flex items-center justify-end gap-1.5 mt-1">
          <span className={clsx('text-2xs', isOut ? 'text-white/70' : 'text-[#9494A8]')}>
            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {isOut && <span className="text-2xs">{statusIcon[msg.status] || '✓'}</span>}
        </div>
      </div>
    </div>
  );
}

// ── Agent Assignment Dropdown ─────────────────────────────────
function AssignDropdown({ agents, currentAssignedTo, onAssign, loading }) {
  const [open, setOpen] = useState(false);
  const dropRef = useRef(null);

  useEffect(() => {
    const fn = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const current = agents.find((a) => a.id === currentAssignedTo);

  return (
    <div className="relative" ref={dropRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={loading}
        className="flex items-center gap-2 h-8 px-3 rounded-lg text-xs font-semibold transition-all hover:opacity-80 disabled:opacity-50"
        style={{ background: 'rgba(83,74,183,0.1)', color: '#AFA9EC', border: '1px solid rgba(83,74,183,0.2)' }}>
        <span>👤</span>
        <span className="max-w-[100px] truncate">
          {loading ? 'Assigning…' : current ? `${current.first_name} ${current.last_name || ''}`.trim() : 'Unassigned'}
        </span>
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-52 rounded-xl overflow-hidden z-40 shadow-xl"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)' }}>
          <div className="p-1">
            {/* Unassign option */}
            <button
              onClick={() => { onAssign(null); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors hover:opacity-80"
              style={{
                color: !currentAssignedTo ? '#AFA9EC' : 'var(--text-secondary)',
                background: !currentAssignedTo ? 'rgba(83,74,183,0.1)' : 'transparent',
              }}>
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0"
                style={{ background: 'var(--bg-elevated)' }}>—</span>
              <span className="font-medium">Unassigned</span>
              {!currentAssignedTo && <span className="ml-auto text-2xs">✓</span>}
            </button>
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => { onAssign(agent.id); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors hover:opacity-80"
                style={{
                  color: agent.id === currentAssignedTo ? '#AFA9EC' : 'var(--text-secondary)',
                  background: agent.id === currentAssignedTo ? 'rgba(83,74,183,0.1)' : 'transparent',
                }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ background: 'hsl(270,55%,45%)' }}>
                  {(agent.first_name?.[0] || agent.email?.[0] || 'A').toUpperCase()}
                </div>
                <div className="min-w-0 text-left">
                  <p className="font-medium truncate">{[agent.first_name, agent.last_name].filter(Boolean).join(' ')}</p>
                  <p className="text-2xs opacity-60 truncate">{agent.role}</p>
                </div>
                {agent.id === currentAssignedTo && <span className="ml-auto text-2xs shrink-0">✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────
function EmptyInbox() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
      <svg className="w-20 h-20 opacity-10" viewBox="0 0 100 100" fill="none">
        <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="3"/>
        <path d="M30 40 Q50 20 70 40 Q80 60 60 70 L50 90 L40 70 Q20 60 30 40Z" fill="currentColor" fillOpacity="0.3"/>
        <circle cx="40" cy="50" r="3" fill="currentColor"/>
        <circle cx="50" cy="50" r="3" fill="currentColor"/>
        <circle cx="60" cy="50" r="3" fill="currentColor"/>
      </svg>
      <div>
        <p className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>No conversations found</p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Try a different filter or wait for customers to message you.
        </p>
      </div>
    </div>
  );
}

// ── Main InboxPage ────────────────────────────────────────────
const FILTER_TABS = [
  { key: 'all',         label: 'All'            },
  { key: 'mine',        label: 'Assigned to Me' },
  { key: 'unassigned',  label: 'Unassigned'     },
];

const STATUS_TABS = [
  { key: 'open',     label: 'Open'     },
  { key: 'pending',  label: 'Pending'  },
  { key: 'resolved', label: 'Resolved' },
];

export default function InboxPage() {
  const { user }           = useAuthStore();
  const [conversations,     setConversations]     = useState([]);
  const [activeConv,        setActiveConv]        = useState(null);
  const [messages,          setMessages]          = useState([]);
  const [replyText,         setReplyText]         = useState('');
  const [loading,           setLoading]           = useState(true);
  const [sending,           setSending]           = useState(false);
  const [wsStatus,          setWsStatus]          = useState('disconnected');
  const [templates,         setTemplates]         = useState([]);
  const [agents,            setAgents]            = useState([]);
  const [showPicker,        setShowPicker]        = useState(false);
  const [assigning,         setAssigning]         = useState(false);

  // Phase 2 filters
  const [filterTab,  setFilterTab]  = useState(user?.role === 'agent' ? 'mine' : 'all');
  const [statusTab,  setStatusTab]  = useState('open');
  const [searchText, setSearchText] = useState('');

  const wsRef          = useRef(null);
  const messagesEndRef = useRef(null);
  const replyRef       = useRef(null);

  const window24      = useServiceWindow(activeConv?.last_inbound_at);
  const windowExpired = window24.expired;

  // ── Load team members (for assignment dropdown) ───────────
  useEffect(() => {
    teamApi.list({ silent: true })
      .then((res) => setAgents(res?.data || []))
      .catch(() => {});
  }, []);

  // ── Load conversations ────────────────────────────────────
  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        filter: filterTab,
        limit:  50,
      };
      if (statusTab !== 'all') params.status = statusTab;
      if (searchText.trim())   params.search  = searchText.trim();

      const res = await inboxApi.conversations(params, { silent: true });
      setConversations(res?.data || []);
    } catch {} finally { setLoading(false); }
  }, [filterTab, statusTab, searchText]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  useEffect(() => {
    templateApi.list({ silent: true }).then((r) => setTemplates(r?.data || [])).catch(() => {});
  }, []);

  // ── WebSocket ─────────────────────────────────────────────
  useEffect(() => {
    if (!user?.tenantId && user?.role !== 'super_admin') return;
    let ws;
    let retryTimeout;

    const connect = () => {
      try {
        const tenantQuery = user?.tenantId ? `tenantId=${user.tenantId}` : 'tenantId=all';
        ws = new WebSocket(`${WS_BASE}/ws/inbox?${tenantQuery}`);
        wsRef.current = ws;
        ws.onopen  = () => setWsStatus('connected');
        ws.onclose = () => { setWsStatus('disconnected'); retryTimeout = setTimeout(connect, 5000); };
        ws.onerror = () => setWsStatus('error');
        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);

            if (payload.type === 'new_message') {
              const msg = payload.data;
              setMessages((prev) => {
                if (prev.length && prev[0]?.conversation_id === msg.conversation_id)
                  return [...prev, msg];
                return prev;
              });
              setConversations((prev) =>
                prev.map((c) =>
                  c.id === msg.conversation_id
                    ? {
                        ...c,
                        last_message_preview: msg.body?.slice(0, 100),
                        last_message_at: msg.created_at,
                        unread_count: (c.unread_count || 0) + 1,
                        ...(msg.direction === 'inbound' ? { last_inbound_at: msg.created_at } : {}),
                      }
                    : c
                )
              );
            }

            // Phase 2: real-time assignment updates
            if (payload.type === 'CONVERSATION_ASSIGNED') {
              const { conversationId, assignedTo } = payload.data;
              const assignedAgent = agents.find((a) => a.id === assignedTo);
              setConversations((prev) =>
                prev.map((c) =>
                  c.id === conversationId
                    ? {
                        ...c,
                        assigned_to:    assignedTo,
                        assigned_first: assignedAgent?.first_name || null,
                        assigned_last:  assignedAgent?.last_name  || null,
                        assigned_email: assignedAgent?.email      || null,
                      }
                    : c
                )
              );
              // Update active conversation too
              setActiveConv((prev) =>
                prev?.id === conversationId ? { ...prev, assigned_to: assignedTo } : prev
              );
            }

            if (payload.type === 'CONVERSATION_STATUS_CHANGED') {
              const { conversationId, status } = payload.data;
              setConversations((prev) =>
                prev.map((c) => c.id === conversationId ? { ...c, status } : c)
              );
            }
          } catch {}
        };
      } catch {}
    };

    connect();
    return () => { ws?.close(); clearTimeout(retryTimeout); };
  }, [user?.tenantId, agents]);

  // ── Scroll ────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Select conversation ───────────────────────────────────
  const selectConv = async (conv) => {
    setActiveConv(conv);
    setMessages([]);
    try {
      const res = await inboxApi.messages(conv.id);
      setMessages(res?.data || []);
      setConversations((cs) => cs.map((c) => c.id === conv.id ? { ...c, unread_count: 0 } : c));
    } catch {}
    replyRef.current?.focus();
  };

  // ── Send reply ────────────────────────────────────────────
  const sendReply = async () => {
    if (!replyText.trim() || !activeConv || windowExpired) return;
    setSending(true);
    try {
      const res = await inboxApi.reply(activeConv.id, replyText.trim());
      setMessages((ms) => [...ms, res.data]);
      setReplyText('');
      setConversations((cs) =>
        cs.map((c) =>
          c.id === activeConv.id
            ? { ...c, last_message_preview: replyText.slice(0, 100), last_message_at: new Date().toISOString() }
            : c
        )
      );
    } catch {} finally { setSending(false); }
  };

  const sendTemplate = async (template, resolvedBody) => {
    if (!activeConv) return;
    const res = await inboxApi.reply(activeConv.id, resolvedBody, 'template');
    setMessages((ms) => [...ms, res.data]);
    setConversations((cs) =>
      cs.map((c) =>
        c.id === activeConv.id
          ? { ...c, last_message_preview: resolvedBody.slice(0, 100), last_message_at: new Date().toISOString() }
          : c
      )
    );
    showSuccess('Template sent successfully.');
  };

  // ── Assign agent ──────────────────────────────────────────
  const handleAssign = async (agentId) => {
    if (!activeConv) return;
    setAssigning(true);
    try {
      await inboxApi.assign(activeConv.id, agentId || null);
      const agent = agents.find((a) => a.id === agentId);
      setActiveConv((prev) => ({ ...prev, assigned_to: agentId || null }));
      setConversations((cs) =>
        cs.map((c) =>
          c.id === activeConv.id
            ? {
                ...c,
                assigned_to:    agentId || null,
                assigned_first: agent?.first_name || null,
                assigned_last:  agent?.last_name  || null,
              }
            : c
        )
      );
      showSuccess(agentId ? `Assigned to ${agent?.first_name || 'agent'}.` : 'Conversation unassigned.');
    } catch {} finally { setAssigning(false); }
  };

  // ── Update status ─────────────────────────────────────────
  const handleStatusChange = async (newStatus) => {
    if (!activeConv) return;
    try {
      await inboxApi.updateStatus(activeConv.id, newStatus);
      setActiveConv((prev) => ({ ...prev, status: newStatus }));
      setConversations((cs) => cs.map((c) => c.id === activeConv.id ? { ...c, status: newStatus } : c));
      if (newStatus === 'resolved') { setActiveConv(null); loadConversations(); }
      showSuccess(`Status updated to "${newStatus}".`);
    } catch {}
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); }
  };

  // ── Tab pill ──────────────────────────────────────────────
  const tabStyle = (active) => ({
    background: active ? '#534AB7' : '#F8F7FF',
    color:      active ? '#FFFFFF' : '#5A5A6E',
    border:     `1px solid ${active ? '#534AB7' : '#E6E4F5'}`,
  });

  return (
    <div className="h-[calc(100vh-4rem)] flex rounded-2xl overflow-hidden bg-white"
      style={{ border: '1px solid #E6E4F5' }}>

      {/* ── Left: Conversation List ── */}
      <div className="w-80 flex flex-col shrink-0 border-r" style={{ borderColor: 'var(--bg-border)' }}>

        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: 'var(--bg-border)' }}>
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Inbox</h1>
            <p className="text-2xs flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
              <span className={clsx('w-1.5 h-1.5 rounded-full',
                wsStatus === 'connected' ? 'bg-teal-light animate-pulse' : 'bg-red-400')} />
              {wsStatus === 'connected' ? 'Live' : 'Connecting…'}
            </p>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 mb-2">
            {FILTER_TABS.map((tab) => (
              <button key={tab.key}
                onClick={() => setFilterTab(tab.key)}
                className="flex-1 h-7 rounded-lg text-2xs font-semibold transition-all"
                style={tabStyle(filterTab === tab.key)}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Status tabs */}
          <div className="flex gap-1">
            {STATUS_TABS.map((tab) => (
              <button key={tab.key}
                onClick={() => setStatusTab(tab.key)}
                className="flex-1 h-7 rounded-lg text-2xs font-semibold transition-all"
                style={tabStyle(statusTab === tab.key)}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="space-y-0">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="px-4 py-3.5 border-b flex gap-3" style={{ borderColor: 'var(--bg-border)' }}>
                  <div className="w-10 h-10 rounded-full animate-pulse" style={{ background: 'var(--bg-elevated)' }} />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 rounded animate-pulse w-2/3" style={{ background: 'var(--bg-elevated)' }} />
                    <div className="h-2.5 rounded animate-pulse w-full" style={{ background: 'var(--bg-elevated)' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <EmptyInbox />
          ) : (
            conversations.map((c) => (
              <ConvoCard key={c.id} conv={c} active={activeConv?.id === c.id} onClick={() => selectConv(c)} />
            ))
          )}
        </div>
      </div>

      {/* ── Right: Chat Thread ── */}
      {!activeConv ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3" style={{ background: 'var(--bg-base)' }}>
          <svg className="w-16 h-16 opacity-10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
          </svg>
          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Select a conversation</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Choose from the left to start chatting</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-w-0" style={{ background: 'var(--bg-base)' }}>
          {/* Thread Header */}
          <div className="flex items-center gap-3 px-5 py-3 border-b shrink-0"
            style={{ borderColor: 'var(--bg-border)', background: 'var(--bg-card)' }}>
            <Avatar name={activeConv.display_name} phone={activeConv.phone_e164} />
            <div className="min-w-0">
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                {activeConv.display_name || activeConv.phone_e164}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-2xs" style={{ color: 'var(--text-muted)' }}>{activeConv.phone_e164}</p>
                <StatusPill status={activeConv.status} />
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
              {/* Assignment dropdown */}
              <AssignDropdown
                agents={agents}
                currentAssignedTo={activeConv.assigned_to}
                onAssign={handleAssign}
                loading={assigning}
              />

              {/* Status actions */}
              {activeConv.status !== 'pending' && (
                <button
                  onClick={() => handleStatusChange('pending')}
                  className="h-8 px-3 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                  style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}>
                  ⏸ Pending
                </button>
              )}
              {activeConv.status !== 'open' && (
                <button
                  onClick={() => handleStatusChange('open')}
                  className="h-8 px-3 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                  style={{ background: 'rgba(29,158,117,0.1)', color: '#1D9E75', border: '1px solid rgba(29,158,117,0.25)' }}>
                  ↩ Reopen
                </button>
              )}
              {activeConv.status !== 'resolved' && (
                <button
                  onClick={() => handleStatusChange('resolved')}
                  className="h-8 px-3 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                  style={{ background: 'rgba(29,158,117,0.15)', color: '#26C18E', border: '1px solid rgba(29,158,117,0.3)' }}>
                  ✓ Resolve
                </button>
              )}
            </div>
          </div>

          {/* 24-hr window banner */}
          <ServiceWindowBanner lastInboundAt={activeConv.last_inbound_at} />

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {messages.map((m) => <MessageBubble key={m.id} msg={m} />)}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply Composer */}
          <div className="p-4 border-t shrink-0"
            style={{ borderColor: 'var(--bg-border)', background: 'var(--bg-card)' }}>
            {windowExpired ? (
              <div>
                <div className="flex items-center gap-3 p-3 rounded-2xl"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(239,68,68,0.25)' }}>
                  <svg className="w-4 h-4 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <p className="flex-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                    Free-form messaging disabled. Use a pre-approved template.
                  </p>
                  <button onClick={() => setShowPicker(true)}
                    className="shrink-0 h-9 px-4 rounded-xl text-xs font-bold text-white transition-all hover:brightness-110"
                    style={{ background: 'linear-gradient(135deg,#534AB7,#3B3499)' }}>
                    📋 Use Template
                  </button>
                </div>
                <p className="text-2xs mt-2 text-center" style={{ color: 'var(--text-muted)' }}>
                  24-hour service window has closed · Only pre-approved templates are permitted by Meta
                </p>
              </div>
            ) : (
              <div>
                <div className="flex items-end gap-3 p-3 rounded-2xl bg-[#F8F7FF] border border-[#E6E4F5]">
                  <textarea
                    ref={replyRef}
                    rows={2}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a reply… (Enter to send, Shift+Enter for newline)"
                    className="flex-1 bg-transparent text-sm resize-none outline-none text-[#0F0F0F] placeholder:text-[#9494A8]"
                  />
                  <button onClick={() => setShowPicker(true)} title="Send a template"
                    className="w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0 hover:bg-[#F3F2FD] bg-white border border-[#E6E4F5] text-[#534AB7]">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </button>
                  <button onClick={sendReply} disabled={sending || !replyText.trim()}
                    className="w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0 font-bold"
                    style={{
                      background: sending || !replyText.trim() ? '#E6E4F5' : '#534AB7',
                      color: sending || !replyText.trim() ? '#9494A8' : '#FFFFFF',
                      cursor: sending || !replyText.trim() ? 'not-allowed' : 'pointer',
                    }}>
                    {sending ? (
                      <svg className="w-4 h-4 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                      </svg>
                    )}
                  </button>
                </div>
                <p className="text-2xs mt-2 text-center text-[#9494A8]">
                  Replies send via WhatsApp Business API · 24h service window applies
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {showPicker && (
        <TemplatePicker
          templates={templates}
          onSend={sendTemplate}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
