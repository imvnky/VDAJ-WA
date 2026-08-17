/**
 * VDAJ Services — InboxPage
 * Real-time two-way chat via WebSocket + REST fallback.
 * Conversation list sidebar + thread panel + inline reply.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { clsx } from 'clsx';
import { inboxApi, WS_BASE } from '../lib/api';
import useAuthStore from '../store/authStore';
import { showSuccess } from '../components/atoms/Toast/Toast.jsx';

// ── Helpers ──────────────────────────────────────────────────
function timeAgo(ts) {
  if (!ts) return '';
  const diff = (Date.now() - new Date(ts)) / 1000;
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)return `${Math.floor(diff / 3600)}h ago`;
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

// ── Conversation Card ─────────────────────────────────────────
function ConvoCard({ conv, active, onClick }) {
  return (
    <button onClick={onClick} className={clsx(
      'w-full flex items-start gap-3 px-4 py-3.5 text-left transition-colors border-b',
      active ? 'bg-brand/10 border-l-2 border-l-brand' : 'hover:opacity-80'
    )} style={{ borderBottomColor: 'var(--bg-border)', background: active ? undefined : undefined }}>
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
        {conv.unread_count > 0 && (
          <span className="mt-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand text-2xs font-bold text-white">
            {conv.unread_count > 9 ? '9+' : conv.unread_count}
          </span>
        )}
      </div>
    </button>
  );
}

// ── Message Bubble ────────────────────────────────────────────
function MessageBubble({ msg }) {
  const isOut = msg.direction === 'outbound';
  const statusIcon = { sent: '✓', delivered: '✓✓', read: <span style={{ color: '#53BDEB' }}>✓✓</span>, failed: '✗' };
  return (
    <div className={clsx('flex', isOut ? 'justify-end' : 'justify-start')}>
      <div className={clsx('max-w-[75%] rounded-2xl px-3.5 py-2.5', isOut ? 'rounded-tr-sm' : 'rounded-tl-sm')}
        style={{ background: isOut ? '#005C4B' : 'var(--bg-elevated)', border: `1px solid var(--bg-border)` }}>
        {msg.sender_name && !isOut && (
          <p className="text-2xs font-semibold mb-1" style={{ color: '#AFA9EC' }}>{msg.sender_name}</p>
        )}
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words"
          style={{ color: isOut ? '#fff' : 'var(--text-primary)' }}>
          {msg.body}
        </p>
        <div className="flex items-center justify-end gap-1 mt-1">
          <span className="text-2xs" style={{ color: isOut ? 'rgba(255,255,255,0.4)' : 'var(--text-muted)' }}>
            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {isOut && <span className="text-2xs">{statusIcon[msg.status] || '✓'}</span>}
        </div>
      </div>
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
        <p className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>No conversations yet</p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          When customers message you, they'll appear here in real-time.
        </p>
      </div>
    </div>
  );
}

// ── Main InboxPage ────────────────────────────────────────────
export default function InboxPage() {
  const { user } = useAuthStore();
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [wsStatus, setWsStatus] = useState('disconnected');
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);
  const replyRef = useRef(null);

  // ── Load conversations ────────────────────────────────────
  const loadConversations = useCallback(async () => {
    try {
      const res = await inboxApi.conversations({ limit: 50 });
      setConversations(res?.data || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // ── WebSocket connection ──────────────────────────────────
  useEffect(() => {
    if (!user?.tenantId) return;
    let ws;
    let retryTimeout;

    const connect = () => {
      try {
        ws = new WebSocket(`${WS_BASE}/ws/inbox?tenantId=${user.tenantId}`);
        wsRef.current = ws;

        ws.onopen = () => { setWsStatus('connected'); };
        ws.onclose = () => {
          setWsStatus('disconnected');
          retryTimeout = setTimeout(connect, 5000); // Auto-reconnect
        };
        ws.onerror = () => setWsStatus('error');

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload.type === 'new_message') {
              const msg = payload.data;
              // Update message thread if viewing that conversation
              setMessages((prev) => {
                if (prev.length && prev[0]?.conversation_id === msg.conversation_id) {
                  return [...prev, msg];
                }
                return prev;
              });
              // Refresh conversation list for unread badge
              setConversations((prev) =>
                prev.map((c) =>
                  c.id === msg.conversation_id
                    ? { ...c, last_message_preview: msg.body?.slice(0, 100), last_message_at: msg.created_at, unread_count: (c.unread_count || 0) + 1 }
                    : c
                )
              );
            }
          } catch {}
        };
      } catch {}
    };

    connect();
    return () => { ws?.close(); clearTimeout(retryTimeout); };
  }, [user?.tenantId]);

  // ── Scroll to bottom on new messages ─────────────────────
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
    if (!replyText.trim() || !activeConv) return;
    setSending(true);
    try {
      const res = await inboxApi.reply(activeConv.id, replyText.trim());
      setMessages((ms) => [...ms, res.data]);
      setReplyText('');
      setConversations((cs) =>
        cs.map((c) => c.id === activeConv.id ? { ...c, last_message_preview: replyText.slice(0, 100), last_message_at: new Date().toISOString() } : c)
      );
    } catch {} finally { setSending(false); }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); }
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex rounded-2xl overflow-hidden"
      style={{ border: '1px solid var(--bg-border)', background: 'var(--bg-card)' }}>

      {/* ── Left: Conversation List ── */}
      <div className="w-80 flex flex-col shrink-0 border-r" style={{ borderColor: 'var(--bg-border)' }}>
        {/* Header */}
        <div className="px-4 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--bg-border)' }}>
          <div>
            <h1 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Inbox</h1>
            <p className="text-2xs flex items-center gap-1.5 mt-0.5" style={{ color: 'var(--text-muted)' }}>
              <span className={clsx('w-1.5 h-1.5 rounded-full', wsStatus === 'connected' ? 'bg-teal-light animate-pulse' : 'bg-red-400')} />
              {wsStatus === 'connected' ? 'Live' : 'Connecting…'}
            </p>
          </div>
        </div>

        {/* List */}
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
          <div className="flex items-center gap-3 px-5 py-3.5 border-b shrink-0"
            style={{ borderColor: 'var(--bg-border)', background: 'var(--bg-card)' }}>
            <Avatar name={activeConv.display_name} phone={activeConv.phone_e164} />
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                {activeConv.display_name || activeConv.phone_e164}
              </p>
              <p className="text-2xs" style={{ color: 'var(--text-muted)' }}>{activeConv.phone_e164}</p>
            </div>
            <div className="ml-auto flex gap-2">
              <button
                onClick={async () => { await inboxApi.resolve(activeConv.id); setActiveConv(null); loadConversations(); showSuccess('Conversation resolved.'); }}
                className="h-8 px-3 rounded-lg text-xs font-semibold transition-all"
                style={{ background: 'rgba(29,158,117,0.15)', color: '#26C18E', border: '1px solid rgba(29,158,117,0.3)' }}>
                ✓ Resolve
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {messages.map((m) => <MessageBubble key={m.id} msg={m} />)}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply Composer */}
          <div className="p-4 border-t shrink-0" style={{ borderColor: 'var(--bg-border)', background: 'var(--bg-card)' }}>
            <div className="flex items-end gap-3 p-3 rounded-2xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}>
              <textarea
                ref={replyRef}
                rows={2}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a reply… (Enter to send, Shift+Enter for newline)"
                className="flex-1 bg-transparent text-sm resize-none outline-none"
                style={{ color: 'var(--text-primary)' }}
              />
              <button
                onClick={sendReply}
                disabled={sending || !replyText.trim()}
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0"
                style={{
                  background: sending || !replyText.trim() ? 'var(--bg-border)' : 'linear-gradient(135deg,#534AB7,#3B3499)',
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
            <p className="text-2xs mt-2 text-center" style={{ color: 'var(--text-muted)' }}>
              Replies send via WhatsApp Business API · 24h service window applies
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
