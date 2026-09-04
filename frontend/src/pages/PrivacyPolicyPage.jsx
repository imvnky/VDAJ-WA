/**
 * VDAJ Services LLP — Enterprise Privacy Policy
 * Route: /legal/privacy (public, no auth required)
 * MNC Grade UI/UX · Compliant with Meta Platform Terms & India DPDP Act 2023
 */

import React from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/atoms/Logo';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Sticky Executive Navigation */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 py-3.5 shadow-xs">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 no-underline">
            <Logo size={36} showWordmark={true} />
          </Link>

          <div className="flex items-center gap-4 text-sm font-medium">
            <Link
              to="/legal/terms"
              className="text-slate-600 hover:text-indigo-600 transition-colors hidden sm:inline-block"
            >
              Terms of Service
            </Link>
            <a
              href="https://www.vdajservices.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-600 hover:text-indigo-600 transition-colors hidden md:inline-block"
            >
              Main Website
            </a>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-all"
            >
              <span>Back to App</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        {/* Document Header Card */}
        <div className="bg-white rounded-2xl p-8 sm:p-10 border border-slate-200/80 shadow-xs mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold mb-4">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Legal Framework & Data Protection</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
            Privacy Policy
          </h1>

          <p className="text-sm text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span><strong>Entity:</strong> VDAJ Services LLP</span>
            <span>•</span>
            <span><strong>Effective Date:</strong> September 1, 2026</span>
            <span>•</span>
            <span className="text-emerald-700 font-medium">DPDP Act (India) & Meta Platform Aligned</span>
          </p>
        </div>

        {/* Document Content */}
        <div className="bg-white rounded-2xl p-8 sm:p-12 border border-slate-200/80 shadow-xs space-y-10 text-slate-700 leading-relaxed text-[15px]">
          {/* Section 1 */}
          <section id="introduction">
            <h2 className="text-xl font-bold text-slate-900 pb-2 border-b border-slate-200 flex items-center gap-2 mb-4">
              <span className="text-indigo-600 font-black">1.</span>
              <span>Introduction & Scope</span>
            </h2>
            <p className="mb-3">
              <strong>VDAJ Services LLP</strong> ("VDAJ", "we", "us", or "our") is a registered Limited Liability Partnership in India providing enterprise communication technology and operating as a WhatsApp Business Solution Provider (BSP) through official Meta Cloud APIs.
            </p>
            <p>
              This Privacy Policy governs the manner in which VDAJ Services LLP collects, utilizes, safeguards, and discloses information gathered from users, clients ("Business Operators"), and end-user recipients communicating through our platform. By utilizing our workspace or connecting a WhatsApp Business Account (WABA), you acknowledge and accept the practices described herein.
            </p>
          </section>

          {/* Section 2 */}
          <section id="data-collection">
            <h2 className="text-xl font-bold text-slate-900 pb-2 border-b border-slate-200 flex items-center gap-2 mb-4">
              <span className="text-indigo-600 font-black">2.</span>
              <span>Data We Collect</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-2 flex items-center gap-2">
                  <span className="text-indigo-600">🏢</span> Business Account Information
                </h3>
                <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4">
                  <li>Organization legal name, corporate email, billing address</li>
                  <li>WhatsApp Business Account (WABA) ID, Phone Number ID</li>
                  <li>Authorized administrative credentials and tenant API keys</li>
                  <li>Meta App ID and embedded signup OAuth verification tokens</li>
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-2 flex items-center gap-2">
                  <span className="text-emerald-600">💬</span> WhatsApp Communications Data
                </h3>
                <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4">
                  <li>Message templates submitted to Meta for approval</li>
                  <li>Campaign configuration parameters and broadcast variable mappings</li>
                  <li>Real-time message delivery receipts (sent, delivered, read, failed)</li>
                  <li>Inbound customer inquiries and agent resolution transcripts</li>
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-2 flex items-center gap-2">
                  <span className="text-blue-600">👥</span> Contact & Consent Records
                </h3>
                <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4">
                  <li>Recipient mobile telephone numbers in standard E.164 format</li>
                  <li>Contact names, classification tags, and attributes</li>
                  <li>Explicit opt-in timestamps and consent verification records</li>
                  <li>Permanent unsubscribe signals and "STOP" opt-out logs</li>
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-2 flex items-center gap-2">
                  <span className="text-purple-600">🛡️</span> Security & Telemetry Data
                </h3>
                <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4">
                  <li>HTTP-only JWT security tokens with automated 24h expiration</li>
                  <li>Client IP addresses, browser user-agents, audit log events</li>
                  <li>Meta Graph API webhook transaction logs and payload verification</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section id="usage">
            <h2 className="text-xl font-bold text-slate-900 pb-2 border-b border-slate-200 flex items-center gap-2 mb-4">
              <span className="text-indigo-600 font-black">3.</span>
              <span>How We Process Your Information</span>
            </h2>
            <ul className="space-y-2.5 list-none pl-0">
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-600 font-bold">✓</span>
                <div><strong>Service Delivery & Orchestration:</strong> Delivering authorized WhatsApp templates, campaigns, dynamic messaging workflows, and team inbox collaboration tools.</div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-600 font-bold">✓</span>
                <div><strong>Regulatory & Policy Adherence:</strong> Enforcing compliance with Meta Platform Policies, GDPR, and India Digital Personal Data Protection (DPDP) Act 2023, including automated opt-out processing.</div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-600 font-bold">✓</span>
                <div><strong>Cryptographic Security Validation:</strong> Authenticating HMAC-SHA256 signatures on all incoming webhooks from Meta to prevent unauthorized message spoofing.</div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-600 font-bold">✓</span>
                <div><strong>Operational Analytics:</strong> Presenting aggregated message lifecycle metrics (delivery success, read rates, failures) to tenant administrators. We do not profile or sell end-user data.</div>
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <section id="meta-cloud-api">
            <h2 className="text-xl font-bold text-slate-900 pb-2 border-b border-slate-200 flex items-center gap-2 mb-4">
              <span className="text-indigo-600 font-black">4.</span>
              <span>WhatsApp & Meta Platform Data Governance</span>
            </h2>
            <div className="p-5 rounded-xl bg-indigo-50/70 border border-indigo-100 text-slate-700 mb-4">
              <p className="font-semibold text-slate-900 mb-2">Our Strict Data Protection Guarantees:</p>
              <ul className="space-y-1.5 text-sm list-disc pl-5">
                <li>We <strong>NEVER</strong> sell, monetize, or lease WhatsApp contact data or conversation transcripts to third parties.</li>
                <li>We <strong>NEVER</strong> utilize WhatsApp conversation data for cross-platform advertising or targeted behavioral profiling.</li>
                <li>All messaging transactions occur directly against official Meta Cloud API endpoints using TLS 1.3 encryption.</li>
              </ul>
            </div>
            <p className="text-xs text-slate-500">
              Our data processing adheres strictly to the <a href="https://developers.facebook.com/terms/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">Meta Platform Terms</a> and the <a href="https://www.whatsapp.com/legal/business-policy/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">WhatsApp Business Policy</a>.
            </p>
          </section>

          {/* Section 5 */}
          <section id="data-retention">
            <h2 className="text-xl font-bold text-slate-900 pb-2 border-b border-slate-200 flex items-center gap-2 mb-4">
              <span className="text-indigo-600 font-black">5.</span>
              <span>Data Retention & Security Protocols</span>
            </h2>
            <div className="space-y-3">
              <p>
                <strong>Message Delivery Logs:</strong> Retained for a rolling period of 90 days for operational audit verification, after which raw message payloads are automatically archived or purged.
              </p>
              <p>
                <strong>Unsubscribe & Opt-Out Records:</strong> Retained indefinitely in our secure suppression index to honor recipient opt-out signals and prevent unsolicited messaging.
              </p>
              <p>
                <strong>Encryption & Infrastructure:</strong> All data in transit is protected via TLS 1.2+ encryption. Data at rest is encrypted using AES-256 in production databases. Webhook secrets and Meta tokens are strictly isolated with environment-level access controls.
              </p>
            </div>
          </section>

          {/* Section 6 */}
          <section id="user-rights">
            <h2 className="text-xl font-bold text-slate-900 pb-2 border-b border-slate-200 flex items-center gap-2 mb-4">
              <span className="text-indigo-600 font-black">6.</span>
              <span>Recipient & Business Operator Rights</span>
            </h2>
            <p className="mb-3">
              Under applicable data protection frameworks, including the India DPDP Act 2023 and GDPR, individuals retain explicit rights over their personal data:
            </p>
            <ul className="space-y-1.5 list-disc pl-5 mb-4">
              <li><strong>Right of Access & Correction:</strong> You may request review or correction of stored organizational or contact details.</li>
              <li><strong>Right of Erasure ("Right to be Forgotten"):</strong> Business clients may request complete workspace purging upon service termination.</li>
              <li><strong>Immediate Opt-Out:</strong> End-users may reply "STOP" or "UNSUBSCRIBE" to any WhatsApp communication to be added to the suppression list automatically.</li>
            </ul>
          </section>

          {/* Corporate Entity & Contact */}
          <section id="contact" className="p-6 rounded-2xl bg-slate-900 text-white mt-10">
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
              <span className="text-indigo-400">🏛️</span> Official Legal & Grievance Contact
            </h3>
            <p className="text-sm text-slate-300 mb-4">
              For any privacy inquiries, grievance redressal, or data protection officer (DPO) correspondence, contact us directly:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-300">
              <div>
                <strong className="text-white block">Corporate Entity:</strong>
                VDAJ Services LLP (Registered LLP in India)
              </div>
              <div>
                <strong className="text-white block">Grievance & Privacy Email:</strong>
                <a href="mailto:info@vdajservices.com" className="text-indigo-300 hover:underline">info@vdajservices.com</a>
              </div>
              <div>
                <strong className="text-white block">Official Website:</strong>
                <a href="https://www.vdajservices.com" target="_blank" rel="noopener noreferrer" className="text-indigo-300 hover:underline">https://www.vdajservices.com</a>
              </div>
              <div>
                <strong className="text-white block">Enterprise Operations:</strong>
                Maharashtra, India
              </div>
            </div>
          </section>
        </div>

        {/* Footer Navigation */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4 pt-4 border-t border-slate-200">
          <div>
            © 2026 VDAJ Services LLP. All rights reserved.
          </div>
          <div className="flex items-center gap-4">
            <Link to="/legal/terms" className="text-slate-600 hover:text-indigo-600">Terms of Service</Link>
            <Link to="/login" className="text-slate-600 hover:text-indigo-600">Client Portal</Link>
            <a href="https://www.vdajservices.com" className="text-slate-600 hover:text-indigo-600">vdajservices.com</a>
          </div>
        </div>
      </main>
    </div>
  );
}
