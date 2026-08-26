/**
 * VDAJ Services — Terms of Service Page
 * Route: /legal/terms (public, no auth required)
 * Required for Meta App Review and Embedded Signup verification.
 */

import React from 'react';

export default function TermsOfServicePage() {
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
          Terms of Service
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: '2.5rem' }}>
          Last updated: August 26, 2025 · Effective Date: August 26, 2025
        </p>

        <Section title="1. Acceptance of Terms">
          <p>By accessing or using the VDAJ Services LLP Platform ("Platform"), you ("Business Operator" or "User") agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not use the Platform.</p>
          <p>The Platform is operated by VDAJ Services LLP, a registered Limited Liability Partnership in India, acting as a WhatsApp Business Solution Provider (BSP).</p>
        </Section>

        <Section title="2. Platform Description">
          <p>The VDAJ Platform provides:</p>
          <ul>
            <li>WhatsApp Business API access via Meta's Cloud API</li>
            <li>Campaign management for bulk WhatsApp messaging</li>
            <li>Inbox for customer conversation management</li>
            <li>Contact list management with GDPR/DPDP-compliant opt-in tracking</li>
            <li>Message template management and Meta approval workflow</li>
            <li>Automation and AI-powered response capabilities</li>
            <li>Analytics and delivery reporting</li>
          </ul>
        </Section>

        <Section title="3. WhatsApp Business API Acceptable Use">
          <p>By using our Platform, you agree to comply with all applicable WhatsApp and Meta policies:</p>
          <ul>
            <li><a href="https://www.whatsapp.com/legal/business-policy/" target="_blank" rel="noopener noreferrer" style={{ color: '#AFA9EC' }}>WhatsApp Business Policy</a></li>
            <li><a href="https://developers.facebook.com/terms/" target="_blank" rel="noopener noreferrer" style={{ color: '#AFA9EC' }}>Meta Platform Terms</a></li>
            <li><a href="https://www.whatsapp.com/legal/commerce-policy/" target="_blank" rel="noopener noreferrer" style={{ color: '#AFA9EC' }}>WhatsApp Commerce Policy</a></li>
          </ul>
          <p>Specifically, you agree that you will NOT:</p>
          <ul>
            <li>Send unsolicited messages ("spam") to users who have not explicitly opted in</li>
            <li>Use the Platform for illegal, deceptive, or abusive messaging</li>
            <li>Send messages that violate Meta's prohibited content policies</li>
            <li>Circumvent opt-out requests — all unsubscribe signals must be honored within 24 hours</li>
            <li>Impersonate Meta, WhatsApp, or any business you are not authorized to represent</li>
            <li>Use unauthorized Meta trademarks in your business name or branding</li>
          </ul>
        </Section>

        <Section title="4. Consent & Opt-In Requirements">
          <p>You are solely responsible for:</p>
          <ul>
            <li>Obtaining valid, documented opt-in consent from every contact before sending marketing messages</li>
            <li>Maintaining a record of how and when each contact opted in</li>
            <li>Including compliant opt-out language in all marketing templates (e.g., "Reply STOP to unsubscribe")</li>
            <li>Immediately honoring opt-out requests received through any channel</li>
          </ul>
          <p>VDAJ reserves the right to suspend accounts with opt-out rates exceeding 5% or with documented consent violations.</p>
        </Section>

        <Section title="5. Account Responsibility">
          <ul>
            <li>You are responsible for maintaining the security of your account credentials</li>
            <li>You must notify us immediately of any unauthorized access at <a href="mailto:support@vdajservices.com" style={{ color: '#AFA9EC' }}>support@vdajservices.com</a></li>
            <li>You are responsible for all activities conducted under your account</li>
            <li>Sharing account credentials with unauthorized parties is prohibited</li>
          </ul>
        </Section>

        <Section title="6. Service Level & Availability">
          <ul>
            <li>We target 99.5% monthly uptime for the API and Inbox services</li>
            <li>Scheduled maintenance will be announced 24 hours in advance where possible</li>
            <li>Message delivery depends on Meta's WhatsApp infrastructure; we are not liable for Meta-side outages</li>
            <li>We provide a 30-day rolling credit for extended downtime beyond our SLA</li>
          </ul>
        </Section>

        <Section title="7. Data Processing">
          <p>By using the Platform, you appoint VDAJ Services LLP as a Data Processor for contact data you upload. We will process this data only as directed by you and in accordance with our <a href="/legal/privacy" style={{ color: '#AFA9EC' }}>Privacy Policy</a>.</p>
          <p>You remain the Data Controller responsible for ensuring your use of the Platform complies with GDPR, India DPDP Act 2023, and all applicable data protection laws in your jurisdiction.</p>
        </Section>

        <Section title="8. Prohibited Uses">
          <p>The following uses of the Platform are strictly prohibited:</p>
          <ul>
            <li>Sending messages to purchased, scraped, or rented contact lists</li>
            <li>Operating a WhatsApp spamming service or reselling API access without authorization</li>
            <li>Sending content that promotes violence, hate speech, or illegal activities</li>
            <li>Circumventing Meta's template approval process</li>
            <li>Using the Platform to send messages in bulk to users in countries where you lack legal authorization to do so</li>
          </ul>
        </Section>

        <Section title="9. Suspension & Termination">
          <ul>
            <li>We may suspend accounts immediately for violations of these Terms or WhatsApp Business Policy</li>
            <li>Meta may independently suspend or terminate your WABA for policy violations</li>
            <li>Terminated accounts will have their data retained for 30 days before deletion</li>
            <li>You may terminate your account at any time by contacting support</li>
          </ul>
        </Section>

        <Section title="10. Limitation of Liability">
          <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, VDAJ SERVICES LLP SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES ARISING FROM YOUR USE OF THE PLATFORM. OUR TOTAL LIABILITY IS LIMITED TO THE AMOUNT PAID BY YOU IN THE 30 DAYS PRECEDING THE CLAIM.</p>
        </Section>

        <Section title="11. Contact">
          <p><strong>VDAJ Services LLP</strong><br />
          Email: <a href="mailto:legal@vdajservices.com" style={{ color: '#AFA9EC' }}>legal@vdajservices.com</a><br />
          Support: <a href="mailto:support@vdajservices.com" style={{ color: '#AFA9EC' }}>support@vdajservices.com</a><br />
          Website: <a href="https://vdajservices.com" style={{ color: '#AFA9EC' }}>https://vdajservices.com</a></p>
        </Section>

        <div style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: '1.5rem', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
          <a href="/legal/privacy" style={{ color: '#AFA9EC', textDecoration: 'none' }}>Privacy Policy</a>
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
