/**
 * VDAJ Services — App.jsx v2
 * React Router v6 with RBAC protection + all V1 pages.
 */

import React, { useEffect } from 'react';
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
  const { setAuth, clearAuth } = useAuthStore();

  useEffect(() => {
    // Check for an existing session (e.g. returning user with valid cookie).
    // Use { silent: true } to suppress the 401 error toast on /login page.
    // Guard: only clear auth if login hasn't happened in the meantime (race-condition fix).
    authApi.me({ silent: true })
      .then((res) => setAuth(res.data?.user, res.data?.tenant || null))
      .catch(() => {
        // Only reset if we haven't already been authenticated by a manual login.
        const { isAuthenticated } = useAuthStore.getState();
        if (!isAuthenticated) clearAuth();
      });
  }, []); // eslint-disable-line

  return (
    <BrowserRouter>
      <VdajToaster />
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/"      element={<RootRedirect />} />

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

            {/* Admin only */}
            <Route element={<RequireRole roles={['super_admin', 'tenant_admin']} />}>
              <Route path="/admin/queue" element={<AdminQueuePage />} />
            </Route>
          </Route>
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
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
