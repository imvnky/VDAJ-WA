/**
 * VDAJ Services — MNC-Grade Toast Notification System
 * High-contrast, enterprise-grade toasts with fixed dimensions,
 * crisp typography, actionable error diagnostics, and explicit status hierarchy.
 */

import React from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { clsx } from 'clsx';

// ============================================================
// TOASTER PROVIDER — Render once at App root
// ============================================================

export const VdajToaster = () => (
  <Toaster
    position="top-right"
    gutter={12}
    containerStyle={{ top: 24, right: 24, zIndex: 99999 }}
    toastOptions={{
      duration: 5000,
      style: {
        background: 'transparent',
        padding: 0,
        boxShadow: 'none',
        border: 'none',
        maxWidth: 'none',
      },
    }}
  />
);

// ============================================================
// ERROR CODE RESOLUTION MAP (Actionable hints for common errors)
// ============================================================

const ERROR_TIPS = {
  ERR_TEMPLATE_NO_OPTOUT: 'Include an opt-out instruction like "Reply STOP to unsubscribe" in the body or footer.',
  ERR_META_006: 'WhatsApp credentials (WABA ID or Token) are missing or not linked for this workspace.',
  ERR_META_AUTH: 'OAuth access token is invalid or expired. Check your Permanent Token in Settings.',
  ERR_VDAJ_VAL_001: 'Please check the required fields highlighted in red.',
  ERR_VDAJ_AUTH_001: 'Invalid email or password. Please verify your login credentials.',
  ERR_VDAJ_AUTH_002: 'Your session has expired. Please sign in again.',
  ERR_VDAJ_SRV_001: 'Internal server error. The backend team has been alerted.',
  ERR_VDAJ_TENANT_001: 'The requested client workspace could not be found.',
};

// ============================================================
// MNC TOAST COMPONENT
// ============================================================

const ToastContent = ({ id, type, title, message, errorCode, details, suggestion }) => {
  const configs = {
    success: {
      accentBorder: 'border-l-[#1D9E75]',
      iconBg: 'bg-[#E6F7F1] text-[#1D9E75] border border-[#A7F3D0]',
      titleColor: 'text-[#065F46]',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ),
    },
    error: {
      accentBorder: 'border-l-[#E11D48]',
      iconBg: 'bg-[#FFE4E6] text-[#E11D48] border border-[#FECDD3]',
      titleColor: 'text-[#9F1239]',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
    },
    warning: {
      accentBorder: 'border-l-[#D97706]',
      iconBg: 'bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]',
      titleColor: 'text-[#92400E]',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      ),
    },
    info: {
      accentBorder: 'border-l-[#534AB7]',
      iconBg: 'bg-[#EEECFC] text-[#534AB7] border border-[#DDD9F8]',
      titleColor: 'text-[#3C3489]',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  };

  const cfg = configs[type] || configs.info;
  const hint = suggestion || (errorCode && ERROR_TIPS[errorCode]);

  return (
    <div
      className={clsx(
        'w-[400px] max-w-[calc(100vw-32px)]',
        'bg-[#FFFFFF] border border-[#E2E8F0] border-l-4 rounded-xl',
        'p-4 shadow-[0_12px_32px_-4px_rgba(15,23,42,0.14),0_4px_12px_-2px_rgba(15,23,42,0.06)]',
        'transition-all duration-200 ease-out select-text flex items-start gap-3.5',
        cfg.accentBorder
      )}
      style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}
    >
      {/* Status Icon */}
      <div className={clsx('w-8 h-8 rounded-lg shrink-0 flex items-center justify-center mt-0.5', cfg.iconBg)}>
        {cfg.icon}
      </div>

      {/* Body Content */}
      <div className="flex-1 min-w-0 pr-1">
        {title && (
          <h4 className={clsx('font-semibold text-sm leading-tight tracking-tight mb-1', cfg.titleColor)}>
            {title}
          </h4>
        )}
        <p className="text-xs text-[#334155] leading-relaxed font-normal">
          {message}
        </p>

        {/* Detailed Validation / Error list if provided */}
        {Array.isArray(details) && details.length > 0 && (
          <ul className="mt-2 space-y-1 bg-[#F8FAFC] border border-[#E2E8F0] p-2 rounded-md">
            {details.map((item, idx) => (
              <li key={idx} className="text-[11px] text-[#475569] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#E11D48] shrink-0" />
                <span>{typeof item === 'string' ? item : item.msg || item.message}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Contextual Action Hint */}
        {hint && (
          <div className="mt-2 bg-[#F8FAFC] border border-[#E2E8F0] p-2 rounded-md text-[11px] text-[#475569] flex items-start gap-1.5">
            <span className="text-[#534AB7] font-bold shrink-0">Tip:</span>
            <span className="leading-snug">{hint}</span>
          </div>
        )}

        {/* Diagnostic Code Footer */}
        {errorCode && (
          <div className="mt-2.5 flex items-center gap-2">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#F1F5F9] text-[#475569] border border-[#CBD5E1] tracking-wide font-medium">
              CODE: {errorCode}
            </span>
          </div>
        )}
      </div>

      {/* Dismiss button */}
      <button
        type="button"
        onClick={() => toast.dismiss(id)}
        className="text-[#94A3B8] hover:text-[#0F172A] p-1 -mr-1 -mt-1 rounded-md hover:bg-[#F1F5F9] transition-colors shrink-0"
        title="Dismiss"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

// ============================================================
// EXPORTED TOAST FUNCTIONS
// ============================================================

export const showSuccess = (message, title = 'Success') =>
  toast.custom((t) => (
    <ToastContent id={t.id} type="success" title={title} message={message} />
  ), { duration: 4500 });

export const showError = (message, errorCode, title = 'Action Required', details = null, suggestion = null) =>
  toast.custom((t) => (
    <ToastContent
      id={t.id}
      type="error"
      title={title}
      message={message}
      errorCode={errorCode}
      details={details}
      suggestion={suggestion}
    />
  ), { duration: 8000 });

export const showWarning = (message, title = 'Notice') =>
  toast.custom((t) => (
    <ToastContent id={t.id} type="warning" title={title} message={message} />
  ), { duration: 6000 });

export const showInfo = (message, title = 'Information') =>
  toast.custom((t) => (
    <ToastContent id={t.id} type="info" title={title} message={message} />
  ), { duration: 5000 });

/**
 * Auto-parse Axios / API error responses and display diagnostics.
 */
export const showApiError = (axiosError) => {
  const data = axiosError?.response?.data;
  const message = data?.message || axiosError?.message || 'An unexpected error occurred. Please try again.';
  const errorCode = data?.errorCode || (axiosError?.response?.status ? `HTTP_${axiosError.response.status}` : undefined);
  const details = data?.errors || null;
  const suggestion = data?.suggestion || null;

  showError(message, errorCode, 'Action Required', details, suggestion);
};

export default toast;
