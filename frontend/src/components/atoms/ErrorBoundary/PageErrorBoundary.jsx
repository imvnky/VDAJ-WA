/**
 * VDAJ Services — PageErrorBoundary
 * Isolated component-level and page-level Error Boundary with
 * light theme styling, copyable diagnostic stack trace, and reload/retry actions.
 */

import React, { Component } from 'react';

export default class PageErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[PageErrorBoundary Caught Error]:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo } = this.state;
      const errorMessage = error?.message || error?.toString() || 'Unknown rendering error';
      const componentStack = errorInfo?.componentStack || '';

      return (
        <div className="w-full flex-1 min-h-[400px] flex items-center justify-center p-4 sm:p-8 animate-fade-in">
          <div
            className="w-full max-w-2xl rounded-2xl p-6 sm:p-8 shadow-sm border"
            style={{
              background: '#FFFFFF',
              borderColor: '#E6E4F5',
              boxShadow: '0 4px 20px -2px rgba(83, 74, 183, 0.08)',
            }}
          >
            {/* Header Icon & Title */}
            <div className="flex items-start gap-4 mb-5">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: '#FEE2E2', border: '1px solid #FECDD3', color: '#DC2626' }}
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold text-[#0F0F0F] tracking-tight">
                    This section encountered an error
                  </h2>
                  <span className="text-2xs font-mono font-semibold px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
                    RENDER_ERROR
                  </span>
                </div>
                <p className="text-xs text-[#5A5A6E] mt-1 leading-relaxed">
                  The application isolated this issue to prevent crashing the navigation or entire dashboard. You can retry loading or inspect the diagnostic trace below.
                </p>
              </div>
            </div>

            {/* Diagnostic Message */}
            <div className="mb-5 p-3.5 rounded-xl bg-[#F8F7FF] border border-[#E6E4F5]">
              <p className="text-2xs font-bold uppercase tracking-wider text-[#9494A8] mb-1">
                Failure Diagnostic
              </p>
              <p className="text-xs font-mono font-semibold text-[#0F0F0F] break-words">
                {errorMessage}
              </p>
            </div>

            {/* Collapsible Stack Trace */}
            {componentStack && (
              <details className="mb-6 group">
                <summary className="text-xs font-semibold text-[#534AB7] cursor-pointer select-none hover:underline inline-flex items-center gap-1.5">
                  <span>View component stack trace</span>
                  <span className="transition-transform duration-200 group-open:rotate-180 text-[10px]">▼</span>
                </summary>
                <div className="mt-2.5 p-3 rounded-xl bg-[#0F0F1A] border border-[#2A2A40] overflow-x-auto max-h-48 text-[11px] font-mono text-[#AFA9EC] leading-relaxed whitespace-pre-wrap select-all">
                  {componentStack}
                </div>
              </details>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-3 border-t border-[#E6E4F5] flex-wrap justify-end">
              <button
                type="button"
                onClick={this.handleReload}
                className="h-9 px-4 rounded-xl text-xs font-semibold text-[#5A5A6E] hover:text-[#0F0F0F] bg-[#F8F7FF] hover:bg-[#F3F2FD] border border-[#E6E4F5] transition-colors cursor-pointer"
              >
                Reload Entire Page
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="h-9 px-5 rounded-xl text-xs font-semibold text-white transition-all shadow-sm cursor-pointer hover:opacity-95"
                style={{ background: '#534AB7' }}
              >
                ↻ Try Reloading Section
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
