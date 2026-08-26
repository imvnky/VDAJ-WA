/**
 * VDAJ Services — Reusable ErrorState & EmptyState Components
 * Replaces generic "An unexpected error occurred" toasts with
 * actionable, diagnostic inline error panels showing HTTP code,
 * server message, and error code for support reference.
 */

import React from 'react';

// ── ErrorState — for API/network failures ─────────────────────
export function ErrorState({
  title = 'Failed to load data',
  message = 'An unexpected error occurred.',
  httpCode = null,
  errorCode = null,
  onRetry = null,
  className = '',
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-16 px-6 rounded-2xl text-center ${className}`}
      style={{ background: 'var(--bg-card)', border: '1px solid rgba(239,68,68,0.25)' }}
    >
      {/* Icon */}
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
      >
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="#f87171" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>

      {/* HTTP badge */}
      {httpCode && (
        <span
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-bold mb-3"
          style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}
        >
          HTTP {httpCode}
        </span>
      )}

      <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{title}</p>
      <p className="text-xs mt-1.5 max-w-md" style={{ color: 'var(--text-secondary)' }}>{message}</p>

      {/* Error code for support */}
      {errorCode && (
        <p className="text-2xs font-mono mt-2 select-all" style={{ color: 'var(--text-muted)' }}>
          Code: {errorCode}
        </p>
      )}

      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-5 h-8 px-5 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
          style={{ background: '#534AB7', color: '#fff' }}
        >
          ↻ Retry
        </button>
      )}
    </div>
  );
}

// ── EmptyState — for zero-data states ────────────────────────
export function EmptyState({
  icon = '📭',
  title = 'No data yet',
  message = '',
  action = null,
  className = '',
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-16 px-6 rounded-2xl text-center ${className}`}
      style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)' }}
    >
      <span className="text-5xl mb-4">{icon}</span>
      <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{title}</p>
      {message && <p className="text-xs mt-1.5 max-w-md" style={{ color: 'var(--text-muted)' }}>{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ── parseApiError — extract meaningful error info from Axios error ─
export function parseApiError(err) {
  const status = err?.response?.status;
  const data   = err?.response?.data;
  const message = data?.message
    || (status === 404 ? 'Resource not found.'
      : status === 403 ? 'You do not have permission to access this resource.'
      : status === 401 ? 'Your session has expired. Please log in again.'
      : status >= 500 ? 'A server error occurred. Our team has been notified.'
      : err?.message || 'An unexpected error occurred.');
  return {
    httpCode:  status || null,
    errorCode: data?.errorCode || null,
    message,
  };
}

// ── SectionError — inline section-level error (smaller, for cards) ─
export function SectionError({ message, httpCode, errorCode, onRetry }) {
  return (
    <div
      className="flex items-center gap-3 p-4 rounded-xl"
      style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}
    >
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="#f87171" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold" style={{ color: '#f87171' }}>
          {httpCode ? `Error ${httpCode} — ` : ''}{message}
        </p>
        {errorCode && (
          <p className="text-2xs font-mono mt-0.5 select-all" style={{ color: 'var(--text-muted)' }}>
            {errorCode}
          </p>
        )}
      </div>
      {onRetry && (
        <button onClick={onRetry} className="text-xs font-semibold hover:opacity-70 shrink-0" style={{ color: '#AFA9EC' }}>
          Retry
        </button>
      )}
    </div>
  );
}
