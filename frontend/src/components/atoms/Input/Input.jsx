/**
 * VDAJ Services — Atomic Input Component
 * Task 4: Full-featured input with label, helper text, error state, icon slots, and all input types.
 * Built with Tailwind + VDAJ brand kit.
 */

import React, { forwardRef, useState, useId } from 'react';
import { clsx } from 'clsx';

// ============================================================
// SIZE MAP
// ============================================================

const INPUT_SIZES = {
  sm: 'h-9  text-sm  rounded-lg  px-3',
  md: 'h-11 text-sm  rounded-xl  px-4',
  lg: 'h-13 text-base rounded-xl px-4',
};

const LABEL_SIZES = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-sm',
};

// ============================================================
// EYE ICON (for password toggle)
// ============================================================

const EyeIcon = ({ open }) =>
  open ? (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );

// ============================================================
// INPUT COMPONENT
// ============================================================

/**
 * @param {object} props
 * @param {string} props.label - Visible label text
 * @param {string} props.helperText - Shown below input (neutral)
 * @param {string} props.error - Error message string (overrides helperText, shows red state)
 * @param {React.ReactNode} props.leftIcon - Icon/element inside left of input
 * @param {React.ReactNode} props.rightElement - Element inside right (custom action)
 * @param {'sm'|'md'|'lg'} props.size
 * @param {boolean} props.required - Appends * to label
 * @param {boolean} props.disabled
 * @param {boolean} props.readOnly
 * @param {string} props.className - Additional wrapper classes
 * @param {string} props.inputClassName - Additional input-specific classes
 * @param {'text'|'email'|'password'|'number'|'tel'|'search'|'url'} props.type
 */
const Input = forwardRef(
  (
    {
      label,
      helperText,
      error,
      leftIcon,
      rightElement,
      size = 'md',
      required = false,
      disabled = false,
      readOnly = false,
      className = '',
      inputClassName = '',
      type = 'text',
      placeholder,
      id: externalId,
      ...rest
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = externalId || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const resolvedType = isPassword ? (showPassword ? 'text' : 'password') : type;

    const hasError = Boolean(error);
    const hasLeft = Boolean(leftIcon);
    const hasRight = Boolean(rightElement) || isPassword;

    const inputBaseClasses = clsx(
      // Layout
      'w-full bg-surface-elevated text-aura-white placeholder:text-aura-white/30',
      'border transition-all duration-200 outline-none',
      // Size
      INPUT_SIZES[size],
      // Padding adjustments for icons
      hasLeft && 'pl-10',
      hasRight && 'pr-10',
      // State — normal
      !hasError && !disabled && [
        'border-surface-border',
        'hover:border-brand/50',
        'focus:border-brand focus:ring-2 focus:ring-brand/20',
      ],
      // State — error
      hasError && [
        'border-red-500/60',
        'focus:border-red-500 focus:ring-2 focus:ring-red-500/20',
      ],
      // State — disabled
      disabled && 'opacity-50 cursor-not-allowed bg-surface-card border-surface-border',
      // State — read-only
      readOnly && 'cursor-default bg-surface-card',
      // Custom
      inputClassName
    );

    return (
      <div className={clsx('flex flex-col gap-1.5', className)}>
        {/* LABEL */}
        {label && (
          <label
            htmlFor={inputId}
            className={clsx(
              'font-medium text-aura-white/80',
              LABEL_SIZES[size],
              disabled && 'opacity-50'
            )}
          >
            {label}
            {required && <span className="ml-1 text-red-400" aria-hidden="true">*</span>}
          </label>
        )}

        {/* INPUT WRAPPER */}
        <div className="relative flex items-center">
          {/* Left Icon */}
          {hasLeft && (
            <span className="absolute left-3 text-aura-white/40 pointer-events-none" aria-hidden="true">
              {leftIcon}
            </span>
          )}

          {/* The Input */}
          <input
            ref={ref}
            id={inputId}
            type={resolvedType}
            disabled={disabled}
            readOnly={readOnly}
            required={required}
            placeholder={placeholder}
            aria-invalid={hasError}
            aria-describedby={hasError ? errorId : helperText ? helperId : undefined}
            className={inputBaseClasses}
            {...rest}
          />

          {/* Right: password toggle or custom element */}
          {(hasRight) && (
            <span className="absolute right-3 flex items-center">
              {isPassword ? (
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-aura-white/40 hover:text-soft-aura transition-colors focus-ring rounded"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  <EyeIcon open={showPassword} />
                </button>
              ) : (
                rightElement
              )}
            </span>
          )}
        </div>

        {/* HELPER / ERROR TEXT */}
        {hasError ? (
          <p id={errorId} role="alert" className="text-xs text-red-400 flex items-center gap-1">
            <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </p>
        ) : helperText ? (
          <p id={helperId} className="text-xs text-aura-white/40">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;

// ============================================================
// TEXTAREA VARIANT
// ============================================================

export const Textarea = forwardRef(
  ({ label, helperText, error, required, disabled, className = '', inputClassName = '', id: externalId, ...rest }, ref) => {
    const generatedId = useId();
    const inputId = externalId || generatedId;
    const errorId = `${inputId}-error`;
    const hasError = Boolean(error);

    return (
      <div className={clsx('flex flex-col gap-1.5', className)}>
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-aura-white/80">
            {label}
            {required && <span className="ml-1 text-red-400" aria-hidden="true">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          disabled={disabled}
          required={required}
          aria-invalid={hasError}
          aria-describedby={hasError ? errorId : undefined}
          className={clsx(
            'w-full min-h-[120px] bg-surface-elevated text-aura-white placeholder:text-aura-white/30',
            'border rounded-xl px-4 py-3 text-sm resize-y transition-all duration-200 outline-none',
            !hasError ? [
              'border-surface-border hover:border-brand/50',
              'focus:border-brand focus:ring-2 focus:ring-brand/20',
            ] : [
              'border-red-500/60 focus:border-red-500 focus:ring-2 focus:ring-red-500/20',
            ],
            disabled && 'opacity-50 cursor-not-allowed',
            inputClassName
          )}
          {...rest}
        />
        {hasError && (
          <p id={errorId} role="alert" className="text-xs text-red-400">{error}</p>
        )}
        {!hasError && helperText && (
          <p className="text-xs text-aura-white/40">{helperText}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

// ============================================================
// SELECT VARIANT
// ============================================================

export const Select = forwardRef(
  ({ label, helperText, error, required, disabled, options = [], placeholder, className = '', inputClassName = '', id: externalId, ...rest }, ref) => {
    const generatedId = useId();
    const inputId = externalId || generatedId;
    const hasError = Boolean(error);

    return (
      <div className={clsx('flex flex-col gap-1.5', className)}>
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-aura-white/80">
            {label}
            {required && <span className="ml-1 text-red-400">*</span>}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={inputId}
            disabled={disabled}
            required={required}
            aria-invalid={hasError}
            className={clsx(
              'w-full h-11 bg-surface-elevated text-aura-white appearance-none cursor-pointer',
              'border rounded-xl px-4 pr-10 text-sm transition-all duration-200 outline-none',
              !hasError ? [
                'border-surface-border hover:border-brand/50',
                'focus:border-brand focus:ring-2 focus:ring-brand/20',
              ] : [
                'border-red-500/60 focus:border-red-500 focus:ring-2 focus:ring-red-500/20',
              ],
              disabled && 'opacity-50 cursor-not-allowed',
              inputClassName
            )}
            {...rest}
          >
            {placeholder && <option value="" disabled>{placeholder}</option>}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>
          {/* Chevron */}
          <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-aura-white/40">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        </div>
        {hasError && <p role="alert" className="text-xs text-red-400">{error}</p>}
        {!hasError && helperText && <p className="text-xs text-aura-white/40">{helperText}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';
