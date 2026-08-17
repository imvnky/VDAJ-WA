/**
 * VDAJ Services — LoginPage
 * Centered branded card. Handles POST /auth/login via HTTP-only cookie.
 *
 * Contrast fix: all card text uses CSS variable tokens so it is always
 * legible in Light, Dark, and Colorful themes.
 *
 * Logo: official <Logo /> component replaces the generic WA chat bubble.
 */

import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../lib/api';
import useAuthStore from '../store/authStore';
import { showSuccess } from '../components/atoms/Toast/Toast.jsx';
import Button from '../components/atoms/Button/Button.jsx';
import Input from '../components/atoms/Input/Input.jsx';
import Logo from '../components/atoms/Logo.jsx';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuth } = useAuthStore();

  const [form, setForm]       = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors]   = useState({});

  const sessionExpired = searchParams.get('session') === 'expired';

  const validate = () => {
    const e = {};
    if (!form.email)                          e.email    = 'Email is required.';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email  = 'Enter a valid email.';
    if (!form.password)                       e.password = 'Password is required.';
    return e;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    try {
      const res = await authApi.login(form.email, form.password);
      setAuth(res.data.user, res.data.tenant || null);
      showSuccess('Welcome back!');
      navigate('/dashboard');
    } catch {
      // Toast fired by the Axios interceptor
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: [
          'radial-gradient(ellipse at top left, rgba(83,74,183,0.22) 0%, transparent 55%)',
          'radial-gradient(ellipse at bottom right, rgba(29,158,117,0.12) 0%, transparent 55%)',
          '#0F0F0F',
        ].join(', '),
      }}
    >
      <div className="w-full max-w-md" style={{ animation: 'slideUp 0.35s ease-out both' }}>

        {/* ── Logo lockup ───────────────────────────────────── */}
        <div className="flex flex-col items-center mb-8 gap-4">
          <Logo size={48} />
          <p className="text-sm" style={{ color: 'rgba(175,169,236,0.65)' }}>
            WhatsApp Bulk Messaging Platform
          </p>
        </div>

        {/* ── Session-expired banner ────────────────────────── */}
        {sessionExpired && (
          <div
            className="mb-4 px-4 py-3 rounded-xl flex items-center gap-2.5"
            style={{
              background: 'rgba(245,158,11,0.10)',
              border: '1px solid rgba(245,158,11,0.30)',
              animation: 'fadeIn 0.25s ease-out',
            }}
          >
            <svg className="w-4 h-4 shrink-0" style={{ color: '#fbbf24' }} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-xs" style={{ color: '#fbbf24' }}>
              Your session expired. Please log in again.
            </p>
          </div>
        )}

        {/* ── Login card ────────────────────────────────────── */}
        <div
          className="rounded-2xl p-8"
          style={{
            // Glassmorphism card — readable in all themes via CSS var tokens
            background: 'var(--bg-card)',
            border: '1px solid var(--bg-border)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
            backdropFilter: 'blur(24px)',
          }}
        >
          {/* Card heading — always Deep Black in light, Aura White in dark */}
          <h2
            className="text-xl font-bold mb-1"
            style={{ color: 'var(--text-primary)' }}
          >
            Welcome back
          </h2>
          <p
            className="text-sm mb-6"
            style={{ color: 'var(--text-muted)' }}
          >
            Sign in to your account to continue.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Email */}
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-semibold mb-1.5"
                style={{ color: 'var(--text-secondary)' }}
              >
                Email address
              </label>
              <Input
                id="login-email"
                type="email"
                placeholder="you@company.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                error={errors.email}
                required
                leftIcon={
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                }
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold mb-1.5"
                style={{ color: 'var(--text-secondary)' }}
              >
                Password
              </label>
              <Input
                id="login-password"
                type="password"
                placeholder="Enter your password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                error={errors.password}
                required
                leftIcon={
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                }
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              className="mt-6"
              style={{
                // Soft Aura focus ring via box-shadow on the wrapping button
                '--tw-ring-color': '#AFA9EC',
              }}
            >
              Sign In
            </Button>
          </form>

          {/* Security footnote */}
          <p
            className="text-center text-xs mt-6"
            style={{ color: 'var(--text-muted)', opacity: 0.6 }}
          >
            Protected by VDAJ Security · JWT HTTP-only cookies
          </p>
        </div>

        {/* Footer */}
        <p
          className="text-center mt-6"
          style={{ fontSize: '11px', color: 'rgba(248,247,255,0.25)' }}
        >
          © {new Date().getFullYear()} VDAJ Services. All rights reserved.
        </p>
      </div>

      {/* Keyframe animations (injected once — no CSS file change needed) */}
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
