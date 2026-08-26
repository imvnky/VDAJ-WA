/**
 * VDAJ Services — App.jsx v2
 * React Router v6 with RBAC protection + all V1 pages.
 */

import React, { useEffect } from 'react';
import { Component } from 'react';

// ── Error Boundary ───────────────────────────────────────────
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f1a', padding: '2rem' }}>
          <div style={{ maxWidth: 600, width: '100%', background: '#1a1a2e', border: '1px solid #ef4444', borderRadius: 16, padding: '2rem' }}>
            <h1 style={{ color: '#ef4444', fontSize: '1.25rem', fontWeight: 700, marginBottom: 8 }}>⚠️ Something went wrong</h1>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: 16 }}>A runtime error occurred. Copy the details below and report it:</p>
            <pre style={{ background: '#0f0f1a', color: '#fbbf24', padding: '1rem', borderRadius: 8, fontSize: '0.75rem', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {this.state.error?.toString()}
            </pre>
            <button onClick={() => window.location.href = '/login'}
              style={{ marginTop: 16, padding: '0.5rem 1.5rem', background: '#534AB7', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
              Back to Login
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { authApi } from './lib/api';
import useAuthStore from './store/authStore';
import { VdajToaster } from './components/atoms/Toast/Toast.jsx';

// Layouts
import DashboardLayout from './layouts/DashboardLayout';

// Pages
import LoginPage          from './pages/LoginPage';
import DashboardPage      from './pages/DashboardPage';
import InboxPage          from './pages/InboxPage';
import CampaignsPage      from './pages/CampaignsPage';
import ContactsPage       from './pages/ContactsPage';
import ContactDetailPage  from './pages/ContactDetailPage';
import SettingsPage       from './pages/SettingsPage';
import ActivityLogPage    from './pages/ActivityLogPage';
import WhatsAppLogsPage   from './pages/WhatsAppLogsPage';
import TemplatesPage      from './pages/TemplatesPage';
import MetaOnboardingPage from './pages/MetaOnboardingPage';
import AdminQueuePage     from './pages/AdminQueuePage';
import AutomationPage     from './pages/AutomationPage';
import AnalyticsPage      from './pages/AnalyticsPage';
import CommercePage       from './pages/CommercePage';
import SuperAdminTenantsPage from './pages/admin/SuperAdminTenantsPage';
import SuperAdminUsersPage   from './pages/admin/SuperAdminUsersPage';
import PrivacyPolicyPage  from './pages/PrivacyPolicyPage';
import TermsOfServicePage from './pages/TermsOfServicePage';

// ── Loading Spinner ───────────────────────────────────────────
function FullPageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-2xl bg-brand-gradient animate-pulse shadow-brand-lg" />
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-2 h-2 rounded-full bg-brand/60 animate-bounce"
              style={{ animationDelay: `${i * 120}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Auth Guard ────────────────────────────────────────────────
function RequireAuth() {
  const { isAuthenticated, isLoading } = useAuthStore();
  if (isLoading) return <FullPageLoader />;
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}

// ── RBAC Guard ────────────────────────────────────────────────
function RequireRole({ roles }) {
  const { user } = useAuthStore();
  if (!user || !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

// ── Root Redirect ─────────────────────────────────────────────
function RootRedirect() {
  const { isAuthenticated, isLoading } = useAuthStore();
  if (isLoading) return <FullPageLoader />;
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
}

// ── App ───────────────────────────────────────────────────────
export default function App() {
  const { setAuth, clearAuth, startImpersonation } = useAuthStore();

  useEffect(() => {
    // Check for an existing session (e.g. returning user with valid cookie).
    authApi.me({ silent: true })
      .then((res) => {
        const u = res.data?.user;
        const t = res.data?.tenant || null;
        setAuth(u, t);

        // Restore impersonation banner if the session is a scoped impersonation token
        if (u?.isImpersonating && t) {
          startImpersonation({ id: t.id, name: t.name, slug: t.slug });
        }
      })
      .catch(() => {
        // Only clear auth if user wasn't already authenticated by login flow
        // But always ensure isLoading is set to false
        const { isAuthenticated } = useAuthStore.getState();
        if (!isAuthenticated) {
          clearAuth(); // sets isLoading=false + isAuthenticated=false
        } else {
          useAuthStore.getState().setLoading(false);
        }
      });
  }, []); // eslint-disable-line


  return (
    <ErrorBoundary>
    <BrowserRouter>
      <VdajToaster />
      <Routes>
        {/* Public */}
        <Route path="/login"          element={<LoginPage />} />
        <Route path="/"               element={<RootRedirect />} />
        {/* Legal — public, no auth required for Meta App Review */}
        <Route path="/legal/privacy"  element={<PrivacyPolicyPage />} />
        <Route path="/legal/terms"    element={<TermsOfServicePage />} />

        {/* Protected */}
        <Route element={<RequireAuth />}>
          <Route element={<DashboardLayout />}>
            {/* Core */}
            <Route path="/dashboard"      element={<DashboardPage />} />
            <Route path="/inbox"          element={<InboxPage />} />
            <Route path="/campaigns"      element={<CampaignsPage />} />
            <Route path="/contacts"       element={<ContactsPage />} />
            <Route path="/contacts/:id"   element={<ContactDetailPage />} />
            <Route path="/settings"        element={<SettingsPage />} />
            <Route path="/logs"            element={<WhatsAppLogsPage />} />
            <Route path="/activity"        element={<ActivityLogPage />} />
            <Route path="/templates"      element={<TemplatesPage />} />
            <Route path="/whatsapp-setup" element={<MetaOnboardingPage />} />

            {/* Growth */}
            <Route path="/automation"     element={<AutomationPage />} />
            <Route path="/analytics"      element={<AnalyticsPage />} />
            <Route path="/commerce"       element={<CommercePage />} />

            {/* Admin only — super_admin */}
            <Route element={<RequireRole roles={['super_admin']} />}>
              <Route path="/admin/queue"   element={<AdminQueuePage />} />
              <Route path="/admin/tenants" element={<SuperAdminTenantsPage />} />
              <Route path="/admin/users"   element={<SuperAdminUsersPage />} />
            </Route>
          </Route>
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center p-6"
      style={{ background: 'var(--bg-base)' }}>
      <p className="text-8xl font-black text-gradient mb-4">404</p>
      <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Page not found</p>
      <p className="text-sm mt-2 mb-8" style={{ color: 'var(--text-muted)' }}>The page you're looking for doesn't exist.</p>
      <a href="/dashboard" className="btn-primary px-6 py-3 rounded-xl text-sm font-semibold">← Back to Dashboard</a>
    </div>
  );
}
