/**
 * VDAJ Services — Toast Notification System
 * Uses react-hot-toast + VDAJ error code display.
 * Shows error codes so users can report to support.
 */

import toast, { Toaster } from 'react-hot-toast';
import { clsx } from 'clsx';

// ============================================================
// TOASTER PROVIDER — Render once at App root
// ============================================================

export const VdajToaster = () => (
  <Toaster
    position="top-right"
    gutter={12}
    containerStyle={{ top: 20, right: 20 }}
    toastOptions={{
      duration: 5000,
      style: {
        background: 'transparent',
        padding: 0,
        boxShadow: 'none',
        border: 'none',
        maxWidth: '420px',
      },
    }}
  />
);

// ============================================================
// TOAST TEMPLATES
// ============================================================

const ToastContent = ({ type, title, message, errorCode }) => {
  const icons = {
    success: (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    warning: (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
    ),
    info: (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  const styles = {
    success: 'border-signal-teal/40 bg-signal-teal/10 text-teal-light',
    error:   'border-red-500/40 bg-red-500/10 text-red-400',
    warning: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
    info:    'border-brand/40 bg-brand/10 text-soft-aura',
  };

  return (
    <div
      className={clsx(
        'flex items-start gap-3 p-4 rounded-2xl border',
        'backdrop-blur-sm shadow-glass animate-slide-down',
        'bg-surface-card',
        styles[type]
      )}
    >
      <span className={clsx('mt-0.5', styles[type])}>{icons[type]}</span>
      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold text-sm text-aura-white">{title}</p>}
        <p className="text-sm text-aura-white/70 mt-0.5">{message}</p>
        {errorCode && (
          <p className="text-2xs font-mono text-aura-white/40 mt-1.5 select-all">
            Code: {errorCode}
          </p>
        )}
      </div>
    </div>
  );
};

// ============================================================
// EXPORTED TOAST FUNCTIONS
// ============================================================

export const showSuccess = (message, title = 'Success') =>
  toast.custom(() => <ToastContent type="success" title={title} message={message} />);

export const showError = (message, errorCode, title = 'Error') =>
  toast.custom(
    () => <ToastContent type="error" title={title} message={message} errorCode={errorCode} />,
    { duration: 8000 }
  );

export const showWarning = (message, title = 'Warning') =>
  toast.custom(() => <ToastContent type="warning" title={title} message={message} />);

export const showInfo = (message, title = 'Info') =>
  toast.custom(() => <ToastContent type="info" title={title} message={message} />);

/**
 * Auto-parse API error response and show toast with error code.
 * @param {object} axiosError - Axios error object
 */
export const showApiError = (axiosError) => {
  const data = axiosError?.response?.data;
  const message = data?.message || 'An unexpected error occurred.';
  const errorCode = data?.errorCode;
  showError(message, errorCode);
};

export default toast;
