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
      setAuth(res.data.user, res.data.tenant || null, res.data.token);
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
          'radial-gradient(ellipse at top left, rgba(83,74,183,0.12) 0%, transparent 60%)',
          'radial-gradient(ellipse at bottom right, rgba(29,158,117,0.08) 0%, transparent 60%)',
          '#F8F7FF',
        ].join(', '),
      }}
    >
      <div className="w-full max-w-md" style={{ animation: 'slideUp 0.35s ease-out both' }}>

        {/* ── Logo lockup ───────────────────────────────────── */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <Logo size={46} />
          <p className="text-xs font-semibold uppercase tracking-wider text-[#5A5A6E]">
            Enterprise WhatsApp Communication Platform
          </p>
        </div>

        {/* ── Session-expired banner ────────────────────────── */}
        {sessionExpired && (
          <div
            className="mb-4 px-4 py-3 rounded-xl flex items-center gap-2.5 bg-amber-50 border border-amber-200 text-amber-800"
            style={{ animation: 'fadeIn 0.25s ease-out' }}
          >
            <svg className="w-4 h-4 shrink-0 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-xs font-medium">
              Your session expired. Please log in again.
            </p>
          </div>
        )}

        {/* ── Login card ────────────────────────────────────── */}
        <div
          className="rounded-3xl p-8 sm:p-10 bg-white"
          style={{
            border: '1px solid #E6E4F5',
            boxShadow: '0 20px 45px -15px rgba(83, 74, 183, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04)',
          }}
        >
          <h2 className="text-2xl font-bold tracking-tight text-[#0F0F0F] mb-1">
            Welcome back
          </h2>
          <p className="text-sm text-[#5A5A6E] mb-6">
            Sign in to access your business messaging dashboard.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Email */}
            <div>
              <Input
                id="login-email"
                type="email"
                label="Email address"
                placeholder="admin@vdajservices.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                error={errors.email}
                required
                leftIcon={
                  <svg className="w-4 h-4 text-[#9494A8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                }
              />
            </div>

            {/* Password */}
            <div>
              <Input
                id="login-password"
                type="password"
                label="Password"
                placeholder="Enter your password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                error={errors.password}
                required
                leftIcon={
                  <svg className="w-4 h-4 text-[#9494A8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
              className="mt-6 font-bold"
            >
              Sign In
            </Button>
          </form>

          {/* Security footnote */}
          <p className="text-center text-2xs text-[#9494A8] mt-6 flex items-center justify-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-[#1D9E75]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Enterprise Grade Security · High-Performance Meta Cloud API
          </p>
        </div>

        {/* Legal Footer */}
        <div className="flex items-center justify-center gap-3 mt-6 text-xs text-[#9494A8]">
          <a href="/legal/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-[#534AB7] transition-colors">Privacy</a>
          <span>·</span>
          <a href="/legal/terms" target="_blank" rel="noopener noreferrer" className="hover:text-[#534AB7] transition-colors">Terms</a>
          <span>·</span>
          <span>© {new Date().getFullYear()} VDAJ Services LLP</span>
        </div>
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
