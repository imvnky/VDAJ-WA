/**
 * VDAJ Services — MetaOnboardingPage
 * Connect WhatsApp Business Account via Meta Embedded Signup SDK.
 */

import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { authApi, tenantApi } from '../lib/api';
import useAuthStore from '../store/authStore';
import { showSuccess, showError } from '../components/atoms/Toast/Toast.jsx';
import Button, { PrimaryButton } from '../components/atoms/Button/Button.jsx';

const META_APP_ID = import.meta.env.VITE_META_APP_ID;

function StatusCard({ label, value, icon, status }) {
  const colors = {
    connected: 'border-signal-teal/30 bg-signal-teal/5',
    warning:   'border-amber-500/30 bg-amber-500/5',
    missing:   'border-surface-border bg-surface-card',
  };
  return (
    <div className={clsx('rounded-2xl border p-5 flex items-start gap-4', colors[status] || colors.missing)}>
      <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
        status === 'connected' ? 'bg-signal-teal/20' : status === 'warning' ? 'bg-amber-500/20' : 'bg-surface-elevated')}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-aura-white/40 font-medium uppercase tracking-wider">{label}</p>
        <p className={clsx('text-sm font-bold mt-0.5', value ? 'text-aura-white' : 'text-aura-white/30 italic')}>
          {value || 'Not configured'}
        </p>
      </div>
    </div>
  );
}

export default function MetaOnboardingPage() {
  const { tenant, setAuth, user } = useAuthStore();
  const [sdkReady, setSdkReady] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [tenantData, setTenantData] = useState(tenant);

  // Load Meta SDK
  useEffect(() => {
    if (document.getElementById('fb-sdk')) { setSdkReady(true); return; }
    window.fbAsyncInit = () => {
      window.FB?.init({ appId: META_APP_ID, autoLogAppEvents: true, xfbml: true, version: 'v19.0' });
      setSdkReady(true);
    };
    const script = document.createElement('script');
    script.id = 'fb-sdk';
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
    return () => {};
  }, []);

  // Reload tenant data
  useEffect(() => {
    tenantApi.me({ silent: true }).then((r) => setTenantData(r?.data || tenant)).catch(() => {});
  }, []);

  const handleConnect = () => {
    if (!sdkReady || !window.FB) {
      showError('Meta SDK not loaded. Check your Meta App ID in .env.', 'ERR_META_AUTH');
      return;
    }
    setConnecting(true);

    window.FB.login(
      async (response) => {
        if (response.authResponse?.code) {
          try {
            // The frontend callback also needs wabaId + phoneNumberId from the embedded signup flow
            // These come from the FB.login callback in production via the embedded signup session
            const code = response.authResponse.code;
            // In a real Embedded Signup flow, wabaId & phoneNumberId come from the session params
            const wabaId = response.authResponse?.grantedScopes?.wabaId || prompt('Enter your WABA ID (from Meta):');
            const phoneNumberId = response.authResponse?.grantedScopes?.phoneNumberId || prompt('Enter your Phone Number ID (from Meta):');

            await authApi.metaCallback(code, wabaId, phoneNumberId);
            showSuccess('WhatsApp Business Account connected successfully!');

            // Refresh tenant
            const refreshed = await tenantApi.me();
            setTenantData(refreshed?.data || tenantData);
            setAuth(user, refreshed?.data);
          } catch {
            // Toast by interceptor
          }
        } else {
          showError('Meta login was cancelled or failed.', 'ERR_META_AUTH');
        }
        setConnecting(false);
      },
      {
        config_id: META_APP_ID,
        response_type: 'code',
        override_default_response_type: true,
        extras: { setup: {}, featureType: '', sessionInfoVersion: '2' },
      }
    );
  };

  const isConnected = Boolean(tenantData?.waba_id && tenantData?.phone_number_id);

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-aura-white">WhatsApp Setup</h1>
        <p className="text-sm text-aura-white/40 mt-1">Connect your WhatsApp Business Account to start sending messages.</p>
      </div>

      {/* Connected Banner */}
      {isConnected && (
        <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-signal-teal/10 border border-signal-teal/30 animate-fade-in">
          <div className="w-9 h-9 rounded-xl bg-signal-teal/20 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-signal-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-signal-teal">WhatsApp Business Connected</p>
            <p className="text-xs text-aura-white/50 mt-0.5">Your account is active and ready to send messages.</p>
          </div>
        </div>
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatusCard
          label="WhatsApp Business Account ID"
          value={tenantData?.waba_id}
          status={tenantData?.waba_id ? 'connected' : 'missing'}
          icon={
            <svg className={clsx('w-5 h-5', tenantData?.waba_id ? 'text-signal-teal' : 'text-aura-white/30')} fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12.05 2.049C6.495 2.049 2 6.545 2 12.1c0 1.784.47 3.458 1.292 4.913L2 22l5.237-1.373A9.99 9.99 0 0012.05 22c5.554 0 10.05-4.495 10.05-10.05S17.604 2.049 12.05 2.049z" />
            </svg>
          }
        />
        <StatusCard
          label="Phone Number ID"
          value={tenantData?.phone_number_id}
          status={tenantData?.phone_number_id ? 'connected' : 'missing'}
          icon={
            <svg className={clsx('w-5 h-5', tenantData?.phone_number_id ? 'text-signal-teal' : 'text-aura-white/30')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          }
        />
      </div>

      {/* How it works */}
      <div className="glass-card p-6">
        <h2 className="text-sm font-bold text-aura-white mb-4">How This Works</h2>
        <div className="space-y-4">
          {[
            { num: '1', title: 'Click "Connect WhatsApp"', desc: 'A Meta popup opens. Log in with your Facebook Business account.' },
            { num: '2', title: 'Select your WhatsApp Business Account', desc: 'Choose your WABA and the phone number you want to use.' },
            { num: '3', title: 'Authorize VDAJ Services', desc: 'Grant permission. We store only your System User Token — never your password.' },
            { num: '4', title: 'Start Sending', desc: 'Your account is linked. Go to Campaigns and launch your first message.' },
          ].map((step) => (
            <div key={step.num} className="flex items-start gap-4">
              <div className="w-7 h-7 rounded-full bg-brand/20 border border-brand/30 flex items-center justify-center text-xs font-bold text-soft-aura shrink-0">
                {step.num}
              </div>
              <div>
                <p className="text-sm font-semibold text-aura-white">{step.title}</p>
                <p className="text-xs text-aura-white/40 mt-0.5">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="flex flex-col sm:flex-row items-center gap-4 p-6 glass-card">
        <div className="flex-1">
          <p className="text-sm font-bold text-aura-white">
            {isConnected ? 'Reconnect WhatsApp Account' : 'Connect your WhatsApp Business Account'}
          </p>
          <p className="text-xs text-aura-white/40 mt-1">
            {isConnected ? 'Use this if your token has expired.' : 'Uses Meta Embedded Signup. Secure OAuth2 flow.'}
          </p>
        </div>
        <PrimaryButton
          onClick={handleConnect}
          loading={connecting}
          disabled={!sdkReady}
          size="lg"
          leftIcon={
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12.05 2.049C6.495 2.049 2 6.545 2 12.1c0 1.784.47 3.458 1.292 4.913L2 22l5.237-1.373A9.99 9.99 0 0012.05 22c5.554 0 10.05-4.495 10.05-10.05S17.604 2.049 12.05 2.049z" />
            </svg>
          }
        >
          {sdkReady ? (isConnected ? 'Reconnect WhatsApp' : 'Connect WhatsApp') : 'Loading SDK…'}
        </PrimaryButton>
      </div>

      <p className="text-center text-xs text-aura-white/20">
        Your Meta credentials are encrypted at rest. VDAJ never stores your Facebook password.
      </p>
    </div>
  );
}
