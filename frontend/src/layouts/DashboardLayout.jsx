/**
 * VDAJ Services — Updated DashboardLayout with:
 * - Theme switcher (3-mode cycle button in topbar)
 * - Full RBAC sidebar with all V1 nav links
 * - Billing lockout banner
 * - Colorful mode support
 */

import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import useAuthStore from '../store/authStore';
import { authApi } from '../lib/api';
import { showSuccess } from '../components/atoms/Toast/Toast.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import Logo from '../components/atoms/Logo.jsx';
import NotificationBell, { useNotificationWS } from '../components/NotificationBell.jsx';
import UpdateBanner from '../components/organisms/UpdateBanner.jsx';

// ─── Theme Switcher Button ─────────────────────────────────────
function ThemeSwitcher() {
  const { theme, cycleTheme } = useTheme();
  const icons = { dark: '🌙', light: '☀️', colorful: '🎨' };
  const labels = { dark: 'Dark', light: 'Light', colorful: 'Colorful' };
  return (
    <button
      onClick={cycleTheme}
      title={`Switch theme (current: ${labels[theme]})`}
      className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-sm font-medium transition-all duration-200"
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--bg-border)',
        color: 'var(--text-secondary)',
      }}
    >
      <span className="text-base">{icons[theme]}</span>
      <span className="hidden sm:block text-xs">{labels[theme]}</span>
    </button>
  );
}

// ─── Nav Items ─────────────────────────────────────────────────
const NAV_ITEMS = [
  {
    section: 'Main',
    items: [
      { to: '/dashboard',      label: 'Dashboard',     icon: <HomeIcon /> },
      { to: '/inbox',          label: 'Inbox',          icon: <InboxIcon />,   badge: 'Live' },
      { to: '/campaigns',      label: 'Campaigns',      icon: <CampaignIcon /> },
      { to: '/contacts',       label: 'Contacts',       icon: <ContactsIcon /> },
      { to: '/templates',      label: 'Templates',      icon: <TemplateIcon /> },
    ],
  },
  {
    section: 'Growth',
    items: [
      { to: '/automation',     label: 'Automation',     icon: <AutoIcon />,    badge: 'New' },
      { to: '/analytics',      label: 'Analytics',      icon: <AnalyticsIcon /> },
      { to: '/commerce',       label: 'Commerce',       icon: <CommerceIcon />, badge: 'Beta' },
    ],
  },
  {
    section: 'Setup',
    items: [
      { to: '/settings',       label: 'Settings',        icon: <SettingsIcon /> },
      { to: '/logs',           label: 'Message Logs',    icon: <LogIcon /> },
      { to: '/whatsapp-setup', label: 'WhatsApp',        icon: <WaIcon /> },
      { to: '/admin/queue',    label: 'Queue Monitor',   icon: <QueueIcon />, role: ['super_admin'] },
    ],
  },
];

// ─── Main Layout ───────────────────────────────────────────────
export default function DashboardLayout() {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme } = useTheme();

  const handleLogout = async () => {
    try { await authApi.logout(); } catch {}
    clearAuth();
    showSuccess('Logged out successfully.');
    navigate('/login');
  };

  // Mount global WS notification listener (message, WABA, campaign, template events)
  useNotificationWS();

  const isColorful = theme === 'colorful';

  const sidebarStyle = {
    background: 'var(--sidebar-bg)',
    borderRight: '1px solid var(--bg-border)',
  };

  const topbarStyle = {
    background: 'var(--topbar-bg)',
    // Explicit border — visible in all 3 theme modes, overrides var(--bg-border) default
    borderBottom: '1px solid var(--bg-border)',
    boxShadow: 'inset 0 -1px 0 0 #E6E4F5',
    backdropFilter: 'blur(12px)',
  };

  return (
    <>
      <UpdateBanner />
      <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── SIDEBAR ── */}
      <aside
        className={clsx(
          'fixed lg:relative z-40 h-full w-64 flex flex-col transition-transform duration-300',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
        style={sidebarStyle}
      >
        {/* Logo Area */}
        <div className="flex items-center gap-3 px-5 py-5 shrink-0">
          <Logo size={36} />
          <button className="ml-auto lg:hidden" onClick={() => setMobileOpen(false)} style={{ color: isColorful ? '#fff' : 'var(--text-muted)' }}>✕</button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-5 no-scrollbar">
          {NAV_ITEMS.map((section) => (
            <div key={section.section}>
              <p className="px-2 mb-1 text-2xs font-bold uppercase tracking-widest"
                style={{ color: isColorful ? 'rgba(255,255,255,0.65)' : 'var(--text-muted)' }}>
                {section.section}
              </p>
              {section.items.map((item) => {
                if (item.role && !item.role.includes(user?.role)) return null;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) => clsx(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 mb-0.5',
                      isActive
                        ? (isColorful ? 'bg-white/18 text-white font-semibold' : 'bg-brand/15 text-brand-light font-semibold')
                        : 'hover:opacity-80'
                    )}
                    style={({ isActive }) => ({
                      color: isActive
                        ? (isColorful ? '#fff' : '#AFA9EC')
                        : (isColorful ? 'rgba(255,255,255,0.75)' : 'var(--sidebar-text)'),
                      background: isActive ? 'var(--sidebar-active)' : undefined,
                    })}
                  >
                    <span className="w-4 h-4 shrink-0 opacity-90">{item.icon}</span>
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span className={clsx(
                        'text-2xs px-1.5 py-0.5 rounded-md font-bold',
                        item.badge === 'Live' ? 'bg-teal/20 text-teal-light' : 'bg-brand/20 text-brand-light'
                      )}>
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User Card */}
        <div className="px-3 py-3 shrink-0 border-t" style={{ borderColor: isColorful ? 'rgba(255,255,255,0.1)' : 'var(--bg-border)' }}>
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl"
            style={{ background: isColorful ? 'rgba(255,255,255,0.08)' : 'var(--bg-elevated)' }}>
            <div className="w-8 h-8 rounded-full bg-brand-gradient flex items-center justify-center text-xs font-bold text-white shrink-0">
              {user?.firstName?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: isColorful ? '#fff' : 'var(--text-primary)' }}>
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-2xs truncate" style={{ color: isColorful ? 'rgba(255,255,255,0.45)' : 'var(--text-muted)' }}>
                {user?.role?.replace('_', ' ')}
              </p>
            </div>
            <button onClick={handleLogout} title="Logout"
              className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
              style={{ color: isColorful ? '#fff' : 'var(--text-secondary)' }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="flex items-center gap-4 px-4 sm:px-6 h-16 shrink-0 z-20" style={topbarStyle}>
          <button className="lg:hidden" onClick={() => setMobileOpen(true)} style={{ color: 'var(--text-secondary)' }}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex-1" />

          <NotificationBell />
          <ThemeSwitcher />

          {/* Subscription badge */}
          <span className="hidden sm:flex items-center gap-1.5 h-7 px-3 rounded-full text-2xs font-semibold"
            style={{ background: 'rgba(29,158,117,0.15)', color: '#26C18E', border: '1px solid rgba(29,158,117,0.3)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-teal-light animate-pulse" />
            Trial Active
          </span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
    </>
  );
}

// ─── SVG Icons (inline, tiny) ─────────────────────────────────
function HomeIcon()     { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>; }
function InboxIcon()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/></svg>; }
function CampaignIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg>; }
function ContactsIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>; }
function TemplateIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>; }
function AutoIcon()     { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>; }
function AnalyticsIcon(){ return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>; }
function CommerceIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>; }
function WaIcon()       { return <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12.05 2.049C6.495 2.049 2 6.545 2 12.1c0 1.784.47 3.458 1.292 4.913L2 22l5.237-1.373A9.99 9.99 0 0012.05 22c5.554 0 10.05-4.495 10.05-10.05S17.604 2.049 12.05 2.049z"/></svg>; }
function QueueIcon()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>; }
function SettingsIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>; }
function LogIcon()      { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>; }
