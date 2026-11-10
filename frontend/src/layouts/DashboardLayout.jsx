/**
 * VDAJ Services — Updated DashboardLayout with:
 * - Theme switcher (3-mode cycle button in topbar)
 * - Full RBAC sidebar with all V1 nav links
 * - Billing lockout banner
 * - Colorful mode support
 */

import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import useAuthStore from '../store/authStore';
import { authApi } from '../lib/api';
import { showSuccess } from '../components/atoms/Toast/Toast.jsx';
import PageErrorBoundary from '../components/atoms/ErrorBoundary/PageErrorBoundary.jsx';
import Logo from '../components/atoms/Logo.jsx';
import NotificationBell, { useNotificationWS } from '../components/NotificationBell.jsx';
import UpdateBanner from '../components/organisms/UpdateBanner.jsx';
import ImpersonationBanner from '../components/ImpersonationBanner.jsx';
import WorkspaceSwitcher from '../components/organisms/WorkspaceSwitcher.jsx';
import UserProfileDropdown from '../components/organisms/UserProfileDropdown.jsx';

const NAV_ITEMS = [
  {
    section: 'Main',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: <HomeIcon /> },
      { to: '/inbox', label: 'Inbox', icon: <InboxIcon />, badge: 'Live', feature: 'inbox' },
      { to: '/campaigns', label: 'Campaigns', icon: <CampaignIcon />, feature: 'campaigns' },
      { to: '/contacts', label: 'Contacts', icon: <ContactsIcon />, feature: 'contacts' },
      { to: '/templates', label: 'Templates', icon: <TemplateIcon />, feature: 'templates' },
    ],
  },
  {
    section: 'Growth',
    items: [
      { to: '/automation', label: 'Automation', icon: <AutoIcon />, badge: 'New', feature: 'automation' },
      { to: '/analytics', label: 'Analytics', icon: <AnalyticsIcon />, feature: 'analytics' },
      { to: '/commerce', label: 'Commerce', icon: <CommerceIcon />, badge: 'Beta', feature: 'commerce' },
    ],
  },
  {
    section: 'Management',
    items: [
      { to: '/whatsapp-setup', label: 'WhatsApp Setup', icon: <WaIcon />, badge: 'Setup' },
      { to: '/team', label: 'Team', icon: <UsersIcon /> },
      { to: '/compliance', label: 'Compliance', icon: <ComplianceIcon /> },
      { to: '/activity', label: 'Audit Trail', icon: <AuditIcon /> },
      { to: '/logs', label: 'Message Logs', icon: <LogIcon />, feature: 'logs' },
      { to: '/settings', label: 'Settings', icon: <SettingsIcon /> },
    ],
  },
  {
    section: 'Platform Governance',
    role: ['super_admin'],  // entire section is super_admin only
    items: [
      { to: '/admin/tenants', label: 'Clients', icon: <ClientsIcon /> },
      { to: '/admin/users', label: 'Platform Users', icon: <UsersIcon /> },
      { to: '/admin/queue', label: 'Queue Monitor', icon: <QueueIcon /> },
      { to: '/activity', label: 'Audit Trail', icon: <AuditIcon /> },
    ],
  },
];

// ─── Main Layout ───────────────────────────────────────────────
export default function DashboardLayout() {
  const { user, tenant, isImpersonating, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAutomationPage = location.pathname.startsWith('/automation');
  const [isCollapsed, setIsCollapsed] = useState(isAutomationPage);
  const isFullBleed = location.pathname.startsWith('/inbox') || isAutomationPage;

  useEffect(() => {
    if (isAutomationPage) setIsCollapsed(true);
  }, [isAutomationPage]);

  // If Super Admin is in Platform Mode and hits /dashboard, direct them to /admin/tenants
  useEffect(() => {
    if (user?.role === 'super_admin' && !isImpersonating && location.pathname === '/dashboard') {
      navigate('/admin/tenants', { replace: true });
    }
  }, [user, isImpersonating, location.pathname, navigate]);

  const handleLogout = async () => {
    try { await authApi.logout(); } catch { }
    clearAuth();
    showSuccess('Logged out successfully.');
    navigate('/login');
  };

  // Mount global WS notification listener (message, WABA, campaign, template events)
  useNotificationWS();

  const sidebarStyle = {
    background: '#FFFFFF',
    borderRight: '1px solid #E2E8F0',
  };

  const topbarStyle = {
    background: 'rgba(255, 255, 255, 0.85)',
    borderBottom: '1px solid #E2E8F0',
    backdropFilter: 'blur(12px)',
  };

  return (
    <>
      <UpdateBanner />
      <ImpersonationBanner />
      <div className="flex h-screen overflow-hidden" style={{ background: '#F8FAFC' }}>
        {/* Mobile overlay */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* ── SIDEBAR ── */}
        <aside
          className={clsx(
            'fixed lg:relative z-40 h-full flex flex-col transition-all duration-300 shadow-[1px_0_4px_0_rgba(0,0,0,0.02)]',
            isCollapsed ? 'w-[72px]' : 'w-64',
            mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          )}
          style={sidebarStyle}
        >
          {/* Logo Area */}
          <div className={clsx(
            "flex items-center shrink-0 border-b border-slate-200/80",
            isCollapsed ? "justify-center py-4 px-2" : "gap-3 px-5 py-4"
          )}>
            <Logo size={32} showWordmark={!isCollapsed} />
            {!isCollapsed && (
              <button className="ml-auto lg:hidden text-slate-400 hover:text-slate-800" onClick={() => setMobileOpen(false)}>✕</button>
            )}
          </div>

          {/* Nav */}
          <nav className={clsx(
            "flex-1 overflow-y-auto no-scrollbar",
            isCollapsed ? "py-4 px-2 space-y-4" : "px-3 py-3 space-y-4"
          )}>
            {NAV_ITEMS.map((section) => {
              const isPlatformMode = user?.role === 'super_admin' && !isImpersonating;

              // In Platform Mode, only show Platform Governance
              if (isPlatformMode) {
                if (section.section !== 'Platform Governance') return null;
              } else {
                // In Client Workspace Mode (or regular tenant user), hide Platform Governance
                if (section.section === 'Platform Governance') return null;
              }

              if (section.role && !section.role.includes(user?.role)) return null;
              const enabledFeats = tenant?.enabledFeatures || null;
              const visibleItems = section.items.filter((item) => {
                if (item.role && !item.role.includes(user?.role)) return false;
                if (item.feature && user?.role !== 'super_admin' && enabledFeats) {
                  return enabledFeats.includes(item.feature);
                }
                return true;
              });
              if (visibleItems.length === 0) return null;
              return (
                <div key={section.section}>
                  {!isCollapsed && (
                    <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {section.section}
                    </p>
                  )}
                  {visibleItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      title={isCollapsed ? item.label : undefined}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) => clsx(
                        'flex items-center rounded-lg text-xs transition-all duration-150 mb-1',
                        isCollapsed
                          ? 'justify-center w-10 h-10 mx-auto'
                          : 'gap-3 px-3 py-2',
                        isActive
                          ? 'bg-slate-100 text-slate-900 font-semibold shadow-xs border border-slate-200/60'
                          : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 font-medium'
                      )}
                    >
                      {({ isActive }) => (
                        <>
                          <span className={clsx("shrink-0", isCollapsed ? "w-5 h-5" : "w-4 h-4", isActive ? "text-[#534AB7]" : "text-slate-500 opacity-90")}>
                            {item.icon}
                          </span>
                          {!isCollapsed && <span className="flex-1">{item.label}</span>}
                          {!isCollapsed && item.badge && (
                            <span className={clsx(
                              'text-[10px] px-1.5 py-0.5 rounded-full font-bold border',
                              item.badge === 'Live' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80' :
                                item.badge === 'New' ? 'bg-indigo-50 text-indigo-700 border-indigo-200/80' :
                                  item.badge === 'Beta' ? 'bg-amber-50 text-amber-700 border-amber-200/80' :
                                    'bg-slate-100 text-slate-700 border-slate-200'
                            )}>
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              );
            })}
          </nav>

          {/* Collapse toggle / Legal Footer */}
          <div className={clsx("shrink-0 border-t border-slate-200/80 mt-auto", isCollapsed ? "p-2 text-center" : "px-4 py-3")}>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              title={isCollapsed ? "Expand navigation" : "Collapse navigation"}
              className="w-full flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 text-xs font-semibold transition-colors gap-1.5"
            >
              <span>{isCollapsed ? '»' : '«'}</span>
              {!isCollapsed && <span>Collapse</span>}
            </button>
            {!isCollapsed && (
              <div className="flex items-center gap-2 flex-wrap text-[10px] text-slate-400 mt-2 px-1">
                <a href="/legal/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-slate-600 transition-colors">Privacy</a>
                <span>·</span>
                <a href="/legal/terms" target="_blank" rel="noopener noreferrer" className="hover:text-slate-600 transition-colors">Terms</a>
                <span>·</span>
                <span>VDAJ Services LLP</span>
              </div>
            )}
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Topbar */}
          <header className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 h-16 shrink-0 z-20" style={topbarStyle}>
            <button className="lg:hidden p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50" onClick={() => setMobileOpen(true)}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Breadcrumb or Workspace Switcher */}
            {isAutomationPage ? (
              <div
                className="flex items-center gap-2 cursor-pointer select-none"
                onClick={() => window.dispatchEvent(new CustomEvent('vdaj-open-flows-list'))}
                title="Click to view all automations & flows"
              >
                <span className="text-xs font-semibold text-slate-500 hover:text-[#534AB7] transition-colors">Automation</span>
                <span className="text-slate-300">/</span>
                <span className="text-xs font-bold text-slate-900 hover:text-[#534AB7] transition-colors">Flows</span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <WorkspaceSwitcher />
                <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 font-medium pl-1 border-l border-slate-200">
                  <span>Dashboard</span>
                  <span className="text-slate-300">/</span>
                  <span className="text-slate-700 font-semibold capitalize">
                    {location.pathname.replace('/', '').replace(/-/g, ' ') || 'Overview'}
                  </span>
                </div>
              </div>
            )}

            <div className="flex-1" />

            {/* Quick Search shortcut box */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100/70 border border-slate-200/70 text-xs text-slate-400 w-52 hover:border-slate-300 transition-colors cursor-pointer"
              onClick={() => navigate('/campaigns')} title="Quick search">
              <span className="text-slate-400">🔍</span>
              <span className="flex-1 text-left text-slate-500 text-xs">Search...</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white text-[10px] font-bold text-slate-400 border border-slate-200 shadow-2xs">⌘K</kbd>
            </div>

            {/* In automation page, place WorkspaceSwitcher on the right */}
            {isAutomationPage && <WorkspaceSwitcher />}

            <NotificationBell />

            {/* Meta Live Connection Status badge */}
            <span className="hidden sm:inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-2xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {user?.role === 'super_admin' && !isImpersonating ? 'Platform Mode' : 'Meta Live'}
            </span>

            {/* User Profile Dropdown */}
            <UserProfileDropdown />
          </header>

          {/* Page content */}
          <main className={clsx(
            "flex-1 min-h-0 flex flex-col",
            isFullBleed ? "overflow-hidden p-0 w-full" : "overflow-y-auto p-4 sm:p-6 lg:px-8 lg:py-7 w-full min-w-0"
          )}>
            <PageErrorBoundary key={location.pathname}>
              <Outlet />
            </PageErrorBoundary>
          </main>
        </div>
      </div>
    </>
  );
}

function HomeIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>; }
function InboxIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>; }
function CampaignIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>; }
function ContactsIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>; }
function TemplateIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>; }
function AutoIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>; }
function AnalyticsIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>; }
function CommerceIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>; }
function WaIcon() { return <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12.05 2.049C6.495 2.049 2 6.545 2 12.1c0 1.784.47 3.458 1.292 4.913L2 22l5.237-1.373A9.99 9.99 0 0012.05 22c5.554 0 10.05-4.495 10.05-10.05S17.604 2.049 12.05 2.049z" /></svg>; }
function QueueIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>; }
function SettingsIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>; }
function LogIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>; }
function ClientsIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>; }
function UsersIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>; }
function AuditIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>; }
function ComplianceIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>; }
