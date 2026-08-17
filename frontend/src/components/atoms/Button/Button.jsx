/**
 * VDAJ Services — Atomic Button Component
 * Task 4: Fully reusable with all variants, sizes, loading, icon support.
 * Built with Tailwind + VDAJ brand kit.
 */

import React from 'react';
import { clsx } from 'clsx'; // or use a simple cn utility

// ============================================================
// VARIANT STYLES MAP
// ============================================================

const VARIANTS = {
  primary: [
    'bg-brand-gradient text-aura-white',
    'shadow-brand-sm hover:shadow-brand-md',
    'hover:brightness-110 active:brightness-95',
    'border border-brand/40',
  ],
  secondary: [
    'bg-transparent text-soft-aura',
    'border border-brand/40',
    'hover:bg-brand/10 hover:border-brand/60',
    'active:bg-brand/20',
  ],
  teal: [
    'bg-teal-gradient text-aura-white',
    'shadow-teal-sm hover:shadow-teal-md',
    'hover:brightness-110 active:brightness-95',
    'border border-teal/40',
  ],
  ghost: [
    'bg-transparent text-aura-white/70',
    'hover:bg-surface-elevated hover:text-aura-white',
    'active:bg-surface-border',
    'border border-transparent',
  ],
  danger: [
    'bg-red-600 text-white',
    'hover:bg-red-700 active:bg-red-800',
    'shadow-[0_1px_8px_rgba(239,68,68,0.25)] hover:shadow-[0_4px_20px_rgba(239,68,68,0.35)]',
    'border border-red-500/40',
  ],
  glass: [
    'glass-card text-aura-white/90',
    'hover:bg-brand/10 hover:border-brand/40',
    'active:scale-[0.98]',
  ],
};

const SIZES = {
  xs:  'h-7  px-3   text-xs  gap-1.5 rounded-lg',
  sm:  'h-9  px-4   text-sm  gap-2   rounded-xl',
  md:  'h-11 px-5   text-sm  gap-2   rounded-xl',
  lg:  'h-12 px-6   text-base gap-2.5 rounded-2xl',
  xl:  'h-14 px-8   text-lg  gap-3   rounded-2xl',
  icon:'h-10 w-10  p-0     rounded-xl', // Square icon-only button
};

// ============================================================
// SPINNER
// ============================================================

const Spinner = ({ size }) => {
  const dim = size === 'xs' || size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  return (
    <svg
      className={clsx(dim, 'animate-spin text-current opacity-80')}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
};

// ============================================================
// BUTTON COMPONENT
// ============================================================

/**
 * @param {object} props
 * @param {'primary'|'secondary'|'teal'|'ghost'|'danger'|'glass'} props.variant
 * @param {'xs'|'sm'|'md'|'lg'|'xl'|'icon'} props.size
 * @param {boolean} props.loading - Shows spinner, disables interaction
 * @param {boolean} props.disabled
 * @param {boolean} props.fullWidth
 * @param {React.ReactNode} props.leftIcon - Icon element shown before label
 * @param {React.ReactNode} props.rightIcon - Icon element shown after label
 * @param {string} props.className - Additional Tailwind classes
 * @param {string} props.type - 'button' | 'submit' | 'reset'
 * @param {Function} props.onClick
 * @param {React.ReactNode} props.children
 */
const Button = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  className = '',
  type = 'button',
  onClick,
  children,
  ...rest
}) => {
  const isDisabled = disabled || loading;
  const variantClasses = VARIANTS[variant] || VARIANTS.primary;
  const sizeClasses = SIZES[size] || SIZES.md;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      aria-busy={loading}
      className={clsx(
        // Base
        'inline-flex items-center justify-center font-semibold',
        'transition-all duration-200 ease-out',
        'focus-ring select-none cursor-pointer',
        // Size
        sizeClasses,
        // Variant
        ...variantClasses,
        // States
        isDisabled && 'opacity-50 cursor-not-allowed pointer-events-none',
        fullWidth && 'w-full',
        // Custom
        className
      )}
      {...rest}
    >
      {loading ? (
        <Spinner size={size} />
      ) : leftIcon ? (
        <span className="shrink-0 text-current opacity-90">{leftIcon}</span>
      ) : null}

      {/* Label — hide when icon-only */}
      {size !== 'icon' && children && (
        <span className={clsx(loading && 'opacity-70')}>{children}</span>
      )}

      {!loading && rightIcon && (
        <span className="shrink-0 text-current opacity-90">{rightIcon}</span>
      )}
    </button>
  );
};

export default Button;

// ============================================================
// NAMED PRESET EXPORTS (convenience wrappers)
// ============================================================

export const PrimaryButton = (props) => <Button variant="primary" {...props} />;
export const SecondaryButton = (props) => <Button variant="secondary" {...props} />;
export const TealButton = (props) => <Button variant="teal" {...props} />;
export const GhostButton = (props) => <Button variant="ghost" {...props} />;
export const DangerButton = (props) => <Button variant="danger" {...props} />;
export const GlassButton = (props) => <Button variant="glass" {...props} />;
