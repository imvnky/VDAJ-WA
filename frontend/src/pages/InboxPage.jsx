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
import { ErrorState, parseApiError } from '../components/atoms/ErrorState/ErrorState.jsx';

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
      'w-full flex items-start gap-3 px-4 py-3.5 text-left transition-all border-b cursor-pointer',
      active
        ? 'bg-[#F5F3FF] border-l-[3px] border-l-[#534AB7] border-b-slate-100'
        : 'hover:bg-slate-50/80 border-l-[3px] border-l-transparent border-b-slate-100'
    )}>
      <Avatar name={conv.display_name} phone={conv.phone_e164} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={clsx("text-sm font-semibold truncate", active ? "text-[#534AB7]" : "text-slate-900")}>
            {conv.display_name || conv.phone_e164}
          </p>
          <span className="text-[11px] font-medium text-slate-400 shrink-0">
            {timeAgo(conv.last_message_at)}
          </span>
        </div>
        <p className="text-xs truncate mt-0.5 text-slate-500">
          {conv.last_message_preview || 'No messages yet'}
        </p>
        <div className="flex items-center justify-between gap-2 mt-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {conv.assigned_first ? (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-[#534AB7] border border-indigo-100/80 inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#534AB7]" />
                {conv.assigned_first}
              </span>
            ) : (
              <span className="text-[10px] text-slate-400">Unassigned</span>
            )}
            {conv.status !== 'open' && <StatusPill status={conv.status} />}
          </div>
          {conv.unread_count > 0 && (
            <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-[#534AB7] text-[10px] font-bold text-white shadow-xs">
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
  const statusIcon = {
    sent: <span className="text-white/70">✓</span>,
    delivered: <span className="text-white/80">✓✓</span>,
    read: <span className="text-[#34D399] font-bold">✓✓</span>,
    failed: <span className="text-rose-300 font-bold">✗</span>
  };

  return (
    <div className={clsx('flex w-full', isOut ? 'justify-end' : 'justify-start')}>
      <div className={clsx(
        'max-w-[78%] rounded-2xl px-4 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-all',
        isOut
          ? 'rounded-tr-xs bg-gradient-to-r from-[#534AB7] to-[#4338CA] text-white'
          : 'rounded-tl-xs bg-white text-slate-900 border border-slate-200/90'
      )}>
        {msg.sender_name && !isOut && (
          <p className="text-[11px] font-bold mb-1 text-[#534AB7] tracking-tight">{msg.sender_name}</p>
        )}
        <p className={clsx('text-sm leading-relaxed whitespace-pre-wrap break-words', isOut ? 'text-white' : 'text-slate-800')}>
          {msg.body}
        </p>
        <div className="flex items-center justify-end gap-1.5 mt-1 select-none">
          <span className={clsx('text-[10px] font-medium', isOut ? 'text-white/70' : 'text-slate-400')}>
            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {isOut && <span className="text-[11px] leading-none inline-flex items-center">{statusIcon[msg.status] || '✓'}</span>}
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
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={loading}
        className="flex items-center gap-2 h-8 px-2.5 rounded-lg text-xs font-semibold transition-all hover:bg-slate-100/80 disabled:opacity-50 border border-slate-200 bg-white text-slate-700 cursor-pointer shadow-2xs"
      >
        <span className="w-5 h-5 rounded-full bg-indigo-50 text-[#534AB7] flex items-center justify-center text-[10px] font-bold shrink-0">
          {current ? (current.first_name?.[0] || 'A').toUpperCase() : '👤'}
        </span>
        <span className="max-w-[110px] truncate text-slate-800">
          {loading ? 'Assigning…' : current ? `${current.first_name} ${current.last_name || ''}`.trim() : 'Unassigned'}
        </span>
        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-56 rounded-xl overflow-hidden z-50 shadow-xl border border-slate-200 bg-white p-1.5 animate-scale-in">
          <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
            Assign Conversation
          </div>
          {/* Unassign option */}
          <button
            type="button"
            onClick={() => { onAssign(null); setOpen(false); }}
            className={clsx(
              "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-left",
              !currentAssignedTo ? "bg-indigo-50 text-[#534AB7] font-semibold" : "text-slate-600 hover:bg-slate-50"
            )}
          >
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 bg-slate-100 text-slate-400">—</span>
            <span className="flex-1">Unassigned</span>
            {!currentAssignedTo && <span className="text-[#534AB7] text-xs font-bold">✓</span>}
          </button>
          <div className="my-1 border-t border-slate-100" />
          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {agents.map((agent) => {
              const isSelected = agent.id === currentAssignedTo;
              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => { onAssign(agent.id); setOpen(false); }}
                  className={clsx(
                    "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-left",
                    isSelected ? "bg-indigo-50 text-[#534AB7] font-semibold" : "text-slate-700 hover:bg-slate-50"
                  )}
                >
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 bg-[#534AB7]">
                    {(agent.first_name?.[0] || agent.email?.[0] || 'A').toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate leading-tight text-slate-800">
                      {[agent.first_name, agent.last_name].filter(Boolean).join(' ')}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate capitalize">{agent.role || 'Agent'}</p>
                  </div>
                  {isSelected && <span className="text-[#534AB7] text-xs font-bold shrink-0">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────
function EmptyInbox({ onReset }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </div>
      <p className="font-bold text-sm text-slate-800">No conversations found</p>
      <p className="text-xs mt-1 text-slate-500 max-w-[200px] leading-relaxed">
        Try adjusting your filter or search query.
      </p>
      {onReset && (
        <button
          onClick={onReset}
          className="mt-3 text-xs font-semibold text-[#534AB7] hover:underline cursor-pointer"
        >
          Reset Filters
        </button>
      )}
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

  const [convError,         setConvError]         = useState(null);

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
      const convList = res?.data || [];
      setConversations(convList);
      setConvError(null);

      // Handle ?phone= URL query parameter to auto-select or initiate chat
      const urlParams = new URLSearchParams(window.location.search);
      const queryPhone = urlParams.get('phone');
      if (queryPhone && !activeConv) {
        const cleanQuery = queryPhone.replace(/\D/g, '');
        const matched = convList.find((c) => (c.phone_e164 && c.phone_e164.replace(/\D/g, '').includes(cleanQuery)));
        if (matched) {
          setActiveConv(matched);
        } else {
          // If not yet in list, initiate and prepend
          inboxApi.initiate({ phone: queryPhone }).then((initRes) => {
            if (initRes?.data) {
              setConversations((prev) => [initRes.data, ...prev.filter((p) => p.id !== initRes.data.id)]);
              setActiveConv(initRes.data);
            }
          }).catch(() => {});
        }
      }
    } catch (err) {
      setConvError(parseApiError(err));
    } finally { setLoading(false); }
  }, [filterTab, statusTab, searchText, activeConv]);

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

  return (
    <div className="flex-1 min-h-0 flex rounded-2xl overflow-hidden bg-white shadow-xs border border-slate-200/90">

      {/* ── Left: Conversation List ── */}
      <div className="w-80 md:w-88 flex flex-col shrink-0 border-r border-slate-200/80 bg-white min-h-0">

        {/* Header with Search and Segmented Filters */}
        <div className="p-3.5 border-b border-slate-200/80 space-y-2.5 shrink-0 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 tracking-tight">Inbox</h1>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-700">
                {conversations.length}
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/60">
              <span className={clsx('w-1.5 h-1.5 rounded-full',
                wsStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-400')} />
              <span className="text-[10px] font-semibold text-emerald-700">
                {wsStatus === 'connected' ? 'Live' : 'Connecting…'}
              </span>
            </div>
          </div>

          {/* Quick Search */}
          <div className="relative">
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search conversations..."
              className="w-full h-8 pl-8 pr-7 rounded-lg text-xs bg-white border border-slate-200/90 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#534AB7] focus:ring-1 focus:ring-[#534AB7]/20 transition-all shadow-2xs"
            />
            <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchText && (
              <button
                type="button"
                onClick={() => setSearchText('')}
                className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 p-0.5 text-xs leading-none cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Segmented Status Slider */}
          <div className="bg-slate-200/70 p-0.5 rounded-lg flex gap-0.5">
            {STATUS_TABS.map((tab) => {
              const active = statusTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusTab(tab.key)}
                  className={clsx(
                    "flex-1 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5",
                    active
                      ? "bg-white text-slate-900 shadow-2xs font-bold"
                      : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  <span className={clsx("w-1.5 h-1.5 rounded-full",
                    tab.key === 'open' ? (active ? "bg-emerald-500" : "bg-emerald-300") :
                    tab.key === 'pending' ? (active ? "bg-amber-500" : "bg-amber-300") :
                    (active ? "bg-slate-500" : "bg-slate-300")
                  )} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Scope Pills */}
          <div className="flex items-center gap-1">
            {FILTER_TABS.map((tab) => {
              const active = filterTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilterTab(tab.key)}
                  className={clsx(
                    "flex-1 py-1 px-1.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer text-center truncate",
                    active
                      ? "bg-[#534AB7] text-white shadow-2xs"
                      : "bg-white text-slate-600 hover:bg-slate-100/70 border border-slate-200/60"
                  )}
                >
                  {tab.key === 'all' && 'All Chats'}
                  {tab.key === 'mine' && '👤 Mine'}
                  {tab.key === 'unassigned' && '⭕ Unassigned'}
                </button>
              );
            })}
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-slate-100">
          {loading ? (
            <div className="space-y-0">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="px-4 py-3.5 border-b border-slate-100 flex gap-3">
                  <div className="w-10 h-10 rounded-full animate-pulse bg-slate-100 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 rounded animate-pulse w-2/3 bg-slate-100" />
                    <div className="h-2.5 rounded animate-pulse w-full bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : convError ? (
            <div className="p-4">
              <ErrorState
                title="Failed to load conversations"
                message={convError.message}
                httpCode={convError.httpCode}
                errorCode={convError.errorCode}
                onRetry={loadConversations}
              />
            </div>
          ) : conversations.length === 0 ? (
            <EmptyInbox onReset={() => { setFilterTab('all'); setStatusTab('open'); setSearchText(''); }} />
          ) : (
            conversations.map((c) => (
              <ConvoCard key={c.id} conv={c} active={activeConv?.id === c.id} onClick={() => selectConv(c)} />
            ))
          )}
        </div>
      </div>

      {/* ── Right: Chat Thread ── */}
      {!activeConv ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-[#FAF5FF]/30 via-white to-[#F8FAFC]">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#534AB7] to-[#3B3499] text-white flex items-center justify-center shadow-lg shadow-indigo-500/15 mb-5 relative">
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12.05 2.049C6.495 2.049 2 6.545 2 12.1c0 1.784.47 3.458 1.292 4.913L2 22l5.237-1.373A9.99 9.99 0 0012.05 22c5.554 0 10.05-4.495 10.05-10.05S17.604 2.049 12.05 2.049z"/>
            </svg>
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white"></span>
            </span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight mb-1.5">
            VDAJ Enterprise Live Inbox
          </h2>
          <p className="text-xs text-slate-500 max-w-sm leading-relaxed mb-6">
            Select a conversation from the sidebar to view complete chat history, assign teammates, and reply in real-time via WhatsApp Cloud API.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg w-full">
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs text-left">
              <span className="text-sm block mb-1">⚡</span>
              <p className="text-xs font-bold text-slate-800">24h Meta Window</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Automated session compliance & templates</p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs text-left">
              <span className="text-sm block mb-1">🛡️</span>
              <p className="text-xs font-bold text-slate-800">Cloud API v21.0</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Direct Meta WhatsApp Business API</p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs text-left">
              <span className="text-sm block mb-1">👥</span>
              <p className="text-xs font-bold text-slate-800">Live Routing</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Seamless agent workload distribution</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-w-0 bg-[#F8FAFC]">
          {/* Thread Header */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-200/80 bg-white shrink-0 shadow-2xs">
            <Avatar name={activeConv.display_name} phone={activeConv.phone_e164} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-slate-900 truncate">
                  {activeConv.display_name || activeConv.phone_e164}
                </p>
                <StatusPill status={activeConv.status} />
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">{activeConv.phone_e164}</p>
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
                  type="button"
                  onClick={() => handleStatusChange('pending')}
                  className="h-8 px-2.5 rounded-lg text-xs font-semibold transition-all hover:bg-amber-100/70 border border-amber-200 bg-amber-50 text-amber-800 cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                >
                  ⏸ Pending
                </button>
              )}
              {activeConv.status !== 'open' && (
                <button
                  type="button"
                  onClick={() => handleStatusChange('open')}
                  className="h-8 px-2.5 rounded-lg text-xs font-semibold transition-all hover:bg-emerald-100/70 border border-emerald-200 bg-emerald-50 text-emerald-800 cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                >
                  ↩ Reopen
                </button>
              )}
              {activeConv.status !== 'resolved' && (
                <button
                  type="button"
                  onClick={() => handleStatusChange('resolved')}
                  className="h-8 px-2.5 rounded-lg text-xs font-semibold transition-all hover:bg-slate-200/80 border border-slate-300 bg-white text-slate-700 cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                >
                  ✓ Resolve
                </button>
              )}
            </div>
          </div>

          {/* 24-hr window banner */}
          <ServiceWindowBanner lastInboundAt={activeConv.last_inbound_at} />

          {/* Messages */}
          <div className="flex-1 overflow-y-auto min-h-0 p-5 space-y-3.5">
            {messages.map((m) => <MessageBubble key={m.id} msg={m} />)}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply Composer */}
          <div className="p-3.5 border-t border-slate-200/80 bg-white shrink-0">
            {windowExpired ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50/80 border border-amber-200/80">
                  <svg className="w-5 h-5 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-amber-900">24-hour customer window is closed</p>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      Meta WhatsApp policy requires an approved template to reopen this conversation.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPicker(true)}
                    className="shrink-0 h-8 px-3 rounded-lg text-xs font-bold text-white transition-all hover:brightness-110 shadow-xs cursor-pointer bg-gradient-to-r from-[#534AB7] to-[#4338CA] inline-flex items-center gap-1.5"
                  >
                    <span>📋</span>
                    <span>Send Template</span>
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-end gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/90 focus-within:border-[#534AB7] focus-within:ring-2 focus-within:ring-[#534AB7]/10 transition-all shadow-2xs">
                  <textarea
                    ref={replyRef}
                    rows={2}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a reply… (Enter to send, Shift+Enter for newline)"
                    className="flex-1 bg-transparent text-xs sm:text-sm resize-none outline-none text-slate-900 placeholder:text-slate-400 py-1"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPicker(true)}
                    title="Send a pre-approved template"
                    className="h-9 px-2.5 rounded-lg flex items-center gap-1.5 transition-all shrink-0 hover:bg-slate-200/60 bg-white border border-slate-200 text-[#534AB7] text-xs font-semibold cursor-pointer shadow-2xs"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="hidden sm:inline">Templates</span>
                  </button>
                  <button
                    type="button"
                    onClick={sendReply}
                    disabled={sending || !replyText.trim()}
                    className={clsx(
                      "w-9 h-9 rounded-lg flex items-center justify-center transition-all shrink-0 font-bold shadow-2xs cursor-pointer",
                      sending || !replyText.trim()
                        ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                        : "bg-[#534AB7] hover:bg-[#4338CA] text-white"
                    )}
                  >
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
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1.5 px-1">
                  <span>WhatsApp Cloud API Active</span>
                  <span>Enter ↵ to send • Shift+Enter for newline</span>
                </div>
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
