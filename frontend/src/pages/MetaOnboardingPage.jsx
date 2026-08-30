/**
 * VDAJ Services — MetaOnboardingPage
 * Connect WhatsApp Business Account via Meta Embedded Signup SDK.
 *
 * Production Embedded Signup flow (Meta-documented):
 *  1. Load FB SDK
 *  2. Attach window 'message' listener BEFORE calling FB.login — receives
 *     the WABA ID + Phone Number ID from Meta's popup once the user completes
 *     the Embedded Signup flow (sessionInfoVersion: '2' required)
 *  3. Call FB.login with config_id and response_type:'code'
 *  4. On success, exchange the auth code server-side for a System User Token
 *  5. Store wabaId + phoneNumberId from the message event
 */

import React, { useState, useEffect, useRef } from 'react';
import { authApi, tenantApi } from '../lib/api';
import useAuthStore from '../store/authStore';
import { showSuccess, showError } from '../components/atoms/Toast/Toast.jsx';
import { PrimaryButton } from '../components/atoms/Button/Button.jsx';

const META_APP_ID = import.meta.env.VITE_META_APP_ID;
const SDK_VERSION = 'v21.0'; // Must match backend META_API_VERSION

function StatusCard({ label, value, status, icon }) {
  const colors = {
    connected: { border: 'rgba(29,158,117,0.35)', bg: 'rgba(29,158,117,0.06)' },
    warning:   { border: 'rgba(245,158,11,0.35)', bg: 'rgba(245,158,11,0.06)'  },
    missing:   { border: 'var(--bg-border)',       bg: 'var(--bg-card)'         },
  };
  const c = colors[status] || colors.missing;
  return (
    <div style={{ border: `1px solid ${c.border}`, background: c.bg, borderRadius: 16, padding: '1.25rem', display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px 0' }}>{label}</p>
        <p style={{ fontSize: 13, fontWeight: 700, color: value ? 'var(--text-primary)' : 'var(--text-muted)', fontStyle: value ? 'normal' : 'italic', margin: 0 }}>
          {value || 'Not configured'}
        </p>
      </div>
    </div>
  );
}

export default function MetaOnboardingPage() {
  const { tenant, setAuth, user } = useAuthStore();
  const [sdkReady,   setSdkReady]   = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [tenantData, setTenantData] = useState(tenant);

  // Capture WABA info from Meta's postMessage during Embedded Signup
  const sessionInfoRef = useRef({ wabaId: null, phoneNumberId: null });

  // ── Load Meta FB SDK ──────────────────────────────────────────
  useEffect(() => {
    if (window.FB && document.getElementById('fb-sdk')) {
      setSdkReady(true);
      return;
    }
    window.fbAsyncInit = () => {
      window.FB?.init({ appId: META_APP_ID, autoLogAppEvents: true, xfbml: true, version: SDK_VERSION });
      setSdkReady(true);
    };
    const script   = document.createElement('script');
    script.id      = 'fb-sdk';
    script.src     = 'https://connect.facebook.net/en_US/sdk.js';
    script.async   = true;
    script.defer   = true;
    document.body.appendChild(script);
  }, []);

  // ── Reload tenant data (silent) ────────────────────────────────
  useEffect(() => {
    tenantApi.me({ silent: true }).then((r) => setTenantData(r?.data || tenant)).catch(() => {});
  }, []);

  // ── Meta Embedded Signup message listener ──────────────────────
  // Meta sends a postMessage from facebook.com when the business completes
  // (or cancels) the Embedded Signup flow.
  // Payload: { type: 'WA_EMBEDDED_SIGNUP', event: 'FINISH'|'CANCEL'|'ERROR',
  //            data: { phone_number_id, waba_id } }
  // Reference: https://developers.facebook.com/docs/whatsapp/embedded-signup
  useEffect(() => {
    function handleMetaMessage(event) {
      if (!['https://www.facebook.com', 'https://web.facebook.com'].includes(event.origin)) return;
      let data;
      try { data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; }
      catch { return; }
      if (data?.type !== 'WA_EMBEDDED_SIGNUP') return;

      if (data.event === 'FINISH') {
        const { phone_number_id, waba_id } = data.data || {};
        sessionInfoRef.current = { wabaId: waba_id || null, phoneNumberId: phone_number_id || null };
        console.info('[VDAJ] Embedded Signup session info received:', { waba_id, phone_number_id });
      } else if (data.event === 'CANCEL') {
        console.info('[VDAJ] Embedded Signup cancelled by user.');
      } else if (data.event === 'ERROR') {
        console.error('[VDAJ] Embedded Signup error:', data.data);
      }
    }
    window.addEventListener('message', handleMetaMessage);
    return () => window.removeEventListener('message', handleMetaMessage);
  }, []);

  // ── Trigger Meta Embedded Signup ───────────────────────────────
  const handleConnect = () => {
    if (!sdkReady || !window.FB) {
      showError('Meta SDK not loaded. Check VITE_META_APP_ID in your .env file.', 'ERR_META_AUTH');
      return;
    }
    if (!META_APP_ID) {
      showError('VITE_META_APP_ID is not set in frontend .env.', 'ERR_META_CFG');
      return;
    }
    sessionInfoRef.current = { wabaId: null, phoneNumberId: null };
    setConnecting(true);

    window.FB.login(
      async (response) => {
        if (response?.authResponse?.code) {
          const code = response.authResponse.code;
          const { wabaId, phoneNumberId } = sessionInfoRef.current;

          if (!wabaId || !phoneNumberId) {
            showError(
              'Could not retrieve WABA ID or Phone Number ID from Meta. ' +
              'Please complete the full Embedded Signup flow — do not close the popup early.',
              'ERR_META_SIGNUP'
            );
            setConnecting(false);
            return;
          }

          try {
            await authApi.metaCallback(code, wabaId, phoneNumberId);
            showSuccess('WhatsApp Business Account connected successfully! ✅');
            const refreshed = await tenantApi.me();
            const newTenant = refreshed?.data || tenantData;
            setTenantData(newTenant);
            setAuth(user, newTenant);
          } catch {
            // Toast shown by interceptor
          }
        } else {
          showError('Meta login was cancelled or failed. Please try again.', 'ERR_META_AUTH');
        }
        setConnecting(false);
      },
      {
        config_id:                      META_APP_ID,
        response_type:                  'code',
        override_default_response_type: true,
        extras: {
          setup:              {},
          featureType:        '',
          sessionInfoVersion: '2',   // Required — enables postMessage with WABA/phone IDs
        },
      }
    );
  };

  const isConnected = Boolean(tenantData?.waba_id && tenantData?.phone_number_id);

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>WhatsApp Setup</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
          Connect your WhatsApp Business Account to start sending messages.
        </p>
      </div>

      {/* Connected Banner */}
      {isConnected && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 1.25rem', borderRadius: 16, background: 'rgba(29,158,117,0.1)', border: '1px solid rgba(29,158,117,0.3)', marginBottom: '1.5rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(29,158,117,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg style={{ width: 18, height: 18, color: '#1D9E75' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#1D9E75', margin: 0 }}>WhatsApp Business Connected</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Your account is active and ready to send messages.</p>
          </div>
        </div>
      )}

      {/* Status Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatusCard label="WhatsApp Business Account ID" value={tenantData?.waba_id} status={tenantData?.waba_id ? 'connected' : 'missing'}
          icon={<svg style={{ width: 20, height: 20, color: tenantData?.waba_id ? '#1D9E75' : 'var(--text-muted)' }} fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12.05 2.049C6.495 2.049 2 6.545 2 12.1c0 1.784.47 3.458 1.292 4.913L2 22l5.237-1.373A9.99 9.99 0 0012.05 22c5.554 0 10.05-4.495 10.05-10.05S17.604 2.049 12.05 2.049z" /></svg>}
        />
        <StatusCard label="Phone Number ID" value={tenantData?.phone_number_id} status={tenantData?.phone_number_id ? 'connected' : 'missing'}
          icon={<svg style={{ width: 20, height: 20, color: tenantData?.phone_number_id ? '#1D9E75' : 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>}
        />
      </div>

      {/* How it works */}
      <div style={{ borderRadius: 20, border: '1px solid var(--bg-border)', background: 'var(--bg-card)', padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 1rem 0' }}>How This Works</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[
            { num: '1', title: 'Click "Connect WhatsApp"', desc: 'A Meta popup opens. Log in with your Facebook Business account.' },
            { num: '2', title: 'Complete the full Embedded Signup flow', desc: 'Select your WABA and phone number. Do NOT close the popup early — wait for it to complete.' },
            { num: '3', title: 'Authorize VDAJ Services', desc: 'Grant permission to manage your WhatsApp account. We store only your System User Token.' },
            { num: '4', title: 'Start Sending', desc: 'Account is linked. Go to Campaigns and launch your first message.' },
          ].map((step) => (
            <div key={step.num} style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(83,74,183,0.15)', border: '1px solid rgba(83,74,183,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#AFA9EC', flexShrink: 0 }}>
                {step.num}
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{step.title}</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', padding: '1.5rem', borderRadius: 20, border: '1px solid var(--bg-border)', background: 'var(--bg-card)' }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {isConnected ? 'Reconnect WhatsApp Account' : 'Connect your WhatsApp Business Account'}
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            {isConnected
              ? 'Use this if your token has expired or you want to update the connected number.'
              : 'Uses Meta Embedded Signup. Secure OAuth2 — your Facebook password is never shared with us.'}
          </p>
        </div>
        <PrimaryButton onClick={handleConnect} loading={connecting} disabled={!sdkReady} size="lg"
          leftIcon={<svg style={{ width: 18, height: 18 }} fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12.05 2.049C6.495 2.049 2 6.545 2 12.1c0 1.784.47 3.458 1.292 4.913L2 22l5.237-1.373A9.99 9.99 0 0012.05 22c5.554 0 10.05-4.495 10.05-10.05S17.604 2.049 12.05 2.049z" /></svg>}>
          {!sdkReady ? 'Loading SDK…' : isConnected ? 'Reconnect WhatsApp' : 'Connect WhatsApp'}
        </PrimaryButton>
      </div>

      <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: '1rem' }}>
        Your Meta credentials are encrypted at rest. VDAJ never stores your Facebook password.
      </p>
    </div>
  );
}
