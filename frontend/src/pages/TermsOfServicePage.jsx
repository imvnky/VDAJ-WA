/**
 * VDAJ Services LLP — Enterprise Terms of Service
 * Route: /legal/terms (public, no auth required)
 * MNC Grade UI/UX · Compliant with Meta Platform Terms & India DPDP Act 2023
 */

import React from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/atoms/Logo';

export default function TermsOfServicePage() {
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
              to="/legal/privacy"
              className="text-slate-600 hover:text-indigo-600 transition-colors hidden sm:inline-block"
            >
              Privacy Policy
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
            <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
            <span>Enterprise Master Services Agreement</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
            Terms of Service
          </h1>

          <p className="text-sm text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span><strong>Entity:</strong> VDAJ Services LLP</span>
            <span>•</span>
            <span><strong>Effective Date:</strong> September 1, 2026</span>
            <span>•</span>
            <span className="text-indigo-700 font-medium">Meta Cloud API Tier-1 Terms Governed</span>
          </p>
        </div>

        {/* Document Content */}
        <div className="bg-white rounded-2xl p-8 sm:p-12 border border-slate-200/80 shadow-xs space-y-10 text-slate-700 leading-relaxed text-[15px]">
          {/* Section 1 */}
          <section id="acceptance">
            <h2 className="text-xl font-bold text-slate-900 pb-2 border-b border-slate-200 flex items-center gap-2 mb-4">
              <span className="text-indigo-600 font-black">1.</span>
              <span>Acceptance of Master Terms</span>
            </h2>
            <p className="mb-3">
              By accessing, registering with, or utilizing the services provided by <strong>VDAJ Services LLP</strong> ("Platform", "we", "us", or "our"), you ("Client", "Business Operator", or "Subscriber") agree to be legally bound by these Terms of Service. If you do not agree to these terms, you must not access or utilize our services.
            </p>
            <p>
              VDAJ Services LLP is an officially incorporated Limited Liability Partnership in India operating an enterprise messaging management and automation suite integrated with the Meta WhatsApp Business Cloud API.
            </p>
          </section>

          {/* Section 2 */}
          <section id="services-scope">
            <h2 className="text-xl font-bold text-slate-900 pb-2 border-b border-slate-200 flex items-center gap-2 mb-4">
              <span className="text-indigo-600 font-black">2.</span>
              <span>Platform Services & Capabilities</span>
            </h2>
            <p className="mb-4">Our enterprise service infrastructure provides:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm">
                <strong className="text-slate-900 block mb-1">⚡ Meta Cloud API Connectivity</strong>
                Direct high-throughput routing through official Meta WhatsApp Business Platform endpoints.
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm">
                <strong className="text-slate-900 block mb-1">📢 Broadcast & Campaign Engine</strong>
                Multi-tenant recipient segmentation, schedule queueing, and delivery confirmation logging.
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm">
                <strong className="text-slate-900 block mb-1">💬 Collaborative Multi-Agent Inbox</strong>
                Unified conversation threads, agent assignment, quick canned responses, and tag organization.
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm">
                <strong className="text-slate-900 block mb-1">🛡️ Automated Consent & Opt-Out</strong>
                Enforcement of GDPR and DPDP opt-in management with real-time unsubscribe suppression.
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section id="acceptable-use">
            <h2 className="text-xl font-bold text-slate-900 pb-2 border-b border-slate-200 flex items-center gap-2 mb-4">
              <span className="text-indigo-600 font-black">3.</span>
              <span>WhatsApp & Meta Platform Acceptable Use Policy</span>
            </h2>
            <p className="mb-3">
              Subscribers must strictly adhere to all applicable Meta platform governance policies, including:
            </p>
            <ul className="list-disc pl-5 space-y-1 mb-4 text-sm text-indigo-700 font-medium">
              <li><a href="https://www.whatsapp.com/legal/business-policy/" target="_blank" rel="noopener noreferrer" className="hover:underline">WhatsApp Business Policy</a></li>
              <li><a href="https://developers.facebook.com/terms/" target="_blank" rel="noopener noreferrer" className="hover:underline">Meta Platform Terms & Developer Agreement</a></li>
              <li><a href="https://www.whatsapp.com/legal/commerce-policy/" target="_blank" rel="noopener noreferrer" className="hover:underline">WhatsApp Commerce Policy</a></li>
            </ul>

            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-sm mb-4">
              <strong className="block text-rose-950 font-bold mb-1.5">🚫 Strictly Prohibited Actions:</strong>
              <ul className="space-y-1 list-disc pl-4 text-xs sm:text-sm text-rose-800">
                <li>Transmission of unsolicited commercial communications ("Spam") to recipients without verifiable opt-in consent.</li>
                <li>Importing or messaging scraped, purchased, rented, or third-party harvested telephone lists.</li>
                <li>Failing to honor recipient unsubscribe requests ("STOP", "CANCEL", "UNSUBSCRIBE") immediately.</li>
                <li>Disseminating misleading, fraudulent, defamatory, or prohibited category commodities.</li>
                <li>Circumventing Meta message template review or tampering with approved template parameters.</li>
              </ul>
            </div>
          </section>

          {/* Section 4 */}
          <section id="consent-obligations">
            <h2 className="text-xl font-bold text-slate-900 pb-2 border-b border-slate-200 flex items-center gap-2 mb-4">
              <span className="text-indigo-600 font-black">4.</span>
              <span>Mandatory Consent & Opt-In Compliance</span>
            </h2>
            <p className="mb-3">
              The Client maintains sole legal responsibility as the <strong>Data Controller</strong> for obtaining and maintaining documented prior affirmative consent from every individual prior to initiating WhatsApp outbound messages.
            </p>
            <p className="text-sm text-slate-600">
              VDAJ Services LLP reserves the contractual right to immediately throttle, pause, or suspend any tenant account whose opt-out rate exceeds 5% or who incurs Meta quality rating degradation (Red/Low quality flag).
            </p>
          </section>

          {/* Section 5 */}
          <section id="sla">
            <h2 className="text-xl font-bold text-slate-900 pb-2 border-b border-slate-200 flex items-center gap-2 mb-4">
              <span className="text-indigo-600 font-black">5.</span>
              <span>Service Level Target (99.9% Cloud Availability)</span>
            </h2>
            <p className="mb-2">
              We target <strong>99.9% monthly uptime</strong> for our core API middleware, webhook receivers, and platform dashboard.
            </p>
            <p className="text-sm text-slate-600">
              Downstream message delivery times and carrier handshakes are governed by Meta Cloud API infrastructure and recipient mobile networks. Scheduled maintenance windows are broadcast at least 24 hours in advance.
            </p>
          </section>

          {/* Section 6 */}
          <section id="liability">
            <h2 className="text-xl font-bold text-slate-900 pb-2 border-b border-slate-200 flex items-center gap-2 mb-4">
              <span className="text-indigo-600 font-black">6.</span>
              <span>Limitation of Liability</span>
            </h2>
            <div className="p-4 rounded-xl bg-slate-100 border border-slate-300/80 text-xs sm:text-sm text-slate-700 font-mono">
              TO THE MAXIMUM EXTENT PERMISSIBLE BY APPLICABLE LAW, VDAJ SERVICES LLP AND ITS DIRECTORS, EMPLOYEES, AND PARTNERS SHALL NOT BE LIABLE FOR ANY INDIRECT, CONSEQUENTIAL, INCIDENTAL, OR PUNITIVE DAMAGES, LOSS OF PROFITS, OR DATA INTERRUPTION ARISING FROM THE USE OR INABILITY TO USE THE PLATFORM. TOTAL LIABILITY UNDER ANY CLAIM SHALL BE CONFINED TO THE FEES PAID BY THE CLIENT IN THE 30 DAYS PRECEDING THE CLAIM.
            </div>
          </section>

          {/* Contact Section */}
          <section id="contact" className="p-6 rounded-2xl bg-slate-900 text-white mt-10">
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
              <span className="text-indigo-400">⚖️</span> Legal & Contractual Inquiries
            </h3>
            <p className="text-sm text-slate-300 mb-4">
              For enterprise contract inquiries, SLA negotiations, or legal questions regarding these Terms:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-300">
              <div>
                <strong className="text-white block">Corporate Entity:</strong>
                VDAJ Services LLP (Registered LLP in India)
              </div>
              <div>
                <strong className="text-white block">Legal & Enterprise Email:</strong>
                <a href="mailto:info@vdajservices.com" className="text-indigo-300 hover:underline">info@vdajservices.com</a>
              </div>
              <div>
                <strong className="text-white block">Official Domain:</strong>
                <a href="https://www.vdajservices.com" target="_blank" rel="noopener noreferrer" className="text-indigo-300 hover:underline">https://www.vdajservices.com</a>
              </div>
              <div>
                <strong className="text-white block">Headquarters:</strong>
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
            <Link to="/legal/privacy" className="text-slate-600 hover:text-indigo-600">Privacy Policy</Link>
            <Link to="/login" className="text-slate-600 hover:text-indigo-600">Client Portal</Link>
            <a href="https://www.vdajservices.com" className="text-slate-600 hover:text-indigo-600">vdajservices.com</a>
          </div>
        </div>
      </main>
    </div>
  );
}
