/**
 * VDAJ Services — Privacy Policy Page
 * Route: /legal/privacy (public, no auth required)
 * Required for Meta App Review and Embedded Signup verification.
 */

import React from 'react';

export default function PrivacyPolicyPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base, #0f0f1a)', color: 'var(--text-primary, #fff)', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <header style={{ background: 'rgba(83,74,183,0.08)', borderBottom: '1px solid rgba(83,74,183,0.2)', padding: '1rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg,#534AB7,#26C18E)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 900, fontSize: 14 }}>V</span>
          </div>
          <span style={{ fontWeight: 800, fontSize: 15 }}>VDAJ Services LLP</span>
        </div>
        <a href="/login" style={{ color: '#AFA9EC', fontSize: 13, textDecoration: 'none' }}>← Back to App</a>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 800, margin: '0 auto', padding: '3rem 2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '0.5rem', background: 'linear-gradient(135deg,#AFA9EC,#26C18E)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Privacy Policy
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: '2.5rem' }}>
          Last updated: August 26, 2025 · Effective Date: August 26, 2025
        </p>

        <Section title="1. Introduction">
          <p>VDAJ Services LLP ("VDAJ", "we", "us", or "our") operates the VDAJ WhatsApp Business Platform ("Platform"), a WhatsApp Business Solution Provider (BSP) service that enables businesses to communicate with their customers via the WhatsApp Business API.</p>
          <p>This Privacy Policy explains how we collect, use, disclose, and safeguard information when you use our Platform. By using the Platform, you agree to the collection and use of information in accordance with this Policy.</p>
        </Section>

        <Section title="2. Data We Collect">
          <SubSection title="2.1 Business Account Information">
            <ul>
              <li>Business name, email address, phone number</li>
              <li>WhatsApp Business Account (WABA) ID and Phone Number ID</li>
              <li>Meta App ID and associated credentials</li>
              <li>Billing and subscription information</li>
            </ul>
          </SubSection>
          <SubSection title="2.2 Message & Campaign Data">
            <ul>
              <li>Message templates submitted for Meta approval</li>
              <li>Campaign configurations (recipient lists, scheduling, template variables)</li>
              <li>Delivery status data: sent, delivered, read, failed timestamps</li>
              <li>Opt-out records and unsubscribe signals received via WhatsApp</li>
            </ul>
          </SubSection>
          <SubSection title="2.3 Contact Data (Processed on Behalf of Businesses)">
            <ul>
              <li>End-user phone numbers (E.164 format)</li>
              <li>End-user names and optional tags provided by the business</li>
              <li>Consent records: opt-in source, opt-in proof, opt-in timestamp</li>
              <li>Conversation history within the Platform Inbox</li>
            </ul>
          </SubSection>
          <SubSection title="2.4 Technical & Usage Data">
            <ul>
              <li>IP addresses, browser type, session tokens (HTTP-only cookies)</li>
              <li>API request logs with timestamps and response codes</li>
              <li>Webhook event payloads from Meta Graph API</li>
            </ul>
          </SubSection>
        </Section>

        <Section title="3. How We Use Your Data">
          <ul>
            <li><strong>Service Delivery:</strong> To process WhatsApp message campaigns, manage contact lists, and provide the Inbox functionality.</li>
            <li><strong>Compliance Enforcement:</strong> To maintain GDPR, India DPDP Act 2023, and Meta Business Platform policy adherence — including opt-out processing within 24 hours of receipt.</li>
            <li><strong>Analytics:</strong> To provide aggregated delivery metrics (sent, delivered, read, failed counts) to the business operator. We do not profile end-users.</li>
            <li><strong>Security:</strong> To validate HMAC-SHA256 webhook signatures from Meta, preventing unauthorized message injection.</li>
            <li><strong>Support:</strong> To diagnose technical issues when requested by the business operator.</li>
          </ul>
        </Section>

        <Section title="4. WhatsApp & Meta Platform Data Usage">
          <p>We access WhatsApp Business API data solely to:</p>
          <ul>
            <li>Send and receive messages on behalf of our business clients</li>
            <li>Process delivery status webhooks (sent, delivered, read, failed)</li>
            <li>Verify webhook endpoint connectivity for Meta App Review</li>
          </ul>
          <p><strong>We do not:</strong></p>
          <ul>
            <li>Use WhatsApp conversation data for advertising or third-party analytics</li>
            <li>Sell or share end-user data with third parties outside the scope of service delivery</li>
            <li>Retain message content beyond what is operationally required</li>
          </ul>
          <p>Data access and usage comply with the <a href="https://developers.facebook.com/terms/" target="_blank" rel="noopener noreferrer" style={{ color: '#AFA9EC' }}>Meta Platform Terms</a> and <a href="https://www.whatsapp.com/legal/business-policy/" target="_blank" rel="noopener noreferrer" style={{ color: '#AFA9EC' }}>WhatsApp Business Policy</a>.</p>
        </Section>

        <Section title="5. Data Retention">
          <ul>
            <li><strong>Message logs:</strong> Retained for 90 days, then automatically purged</li>
            <li><strong>Contact opt-out records:</strong> Retained indefinitely to honor unsubscribe requests</li>
            <li><strong>Account data:</strong> Retained until account deletion is requested</li>
            <li><strong>Session data:</strong> HTTP-only JWT cookies expire after 24 hours of inactivity</li>
          </ul>
        </Section>

        <Section title="6. Data Security">
          <ul>
            <li>All data is transmitted over TLS 1.2+</li>
            <li>Webhook payloads are verified with HMAC-SHA256 signatures</li>
            <li>Passwords are hashed using bcrypt (minimum 12 rounds)</li>
            <li>Database access is restricted to authorized personnel only</li>
            <li>Railway.app production infrastructure is used with environment-variable secret management</li>
          </ul>
        </Section>

        <Section title="7. Your Rights">
          <p>As a business operator or end-user, you have the following rights:</p>
          <ul>
            <li><strong>Access:</strong> Request a copy of the personal data we hold about you</li>
            <li><strong>Correction:</strong> Request correction of inaccurate data</li>
            <li><strong>Deletion:</strong> Request deletion of your data (subject to legal retention obligations)</li>
            <li><strong>Opt-Out:</strong> End-users may reply "STOP" to any WhatsApp message to opt out. We process opt-outs within 24 hours.</li>
          </ul>
          <p>To exercise these rights, contact: <a href="mailto:info@vdajservices.com" style={{ color: '#AFA9EC' }}>info@vdajservices.com</a></p>
        </Section>

        <Section title="8. Contact Information">
          <p><strong>VDAJ Services LLP</strong><br />
          Data Controller & Processor<br />
          Email: <a href="mailto:info@vdajservices.com" style={{ color: '#AFA9EC' }}>info@vdajservices.com</a><br />
          Website: <a href="https://vdajservices.com" style={{ color: '#AFA9EC' }}>https://vdajservices.com</a></p>
        </Section>

        <div style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: '1.5rem', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
          <a href="/legal/terms" style={{ color: '#AFA9EC', textDecoration: 'none' }}>Terms of Service</a>
          <a href="/login" style={{ color: '#AFA9EC', textDecoration: 'none' }}>← Back to Platform</a>
          <span>© 2025 VDAJ Services LLP</span>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: '2rem' }}>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#AFA9EC', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(83,74,183,0.2)' }}>{title}</h2>
      <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 1.75, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>{children}</div>
    </section>
  );
}

function SubSection({ title, children }) {
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.85)', marginBottom: '0.25rem' }}>{title}</h3>
      <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 1.7 }}>{children}</div>
    </div>
  );
}
