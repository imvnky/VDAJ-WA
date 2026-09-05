/**
 * VDAJ Services LLP — User Data Deletion & Privacy Rights
 * Route: /legal/data-deletion and /data-deletion (public, no auth required)
 * MNC Grade UI/UX · Compliant with Meta Platform Terms §4.b & India DPDP Act 2023
 */

import React from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/atoms/Logo';

export default function DataDeletionPage() {
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
            <span>Meta Platform Compliance · GDPR Art. 17 · India DPDP Act 2023</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
            User Data Deletion Instructions
          </h1>

          <p className="text-sm text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span><strong>Entity:</strong> VDAJ Services LLP</span>
            <span>·</span>
            <span><strong>Platform:</strong> VDAJ Communications Gateway</span>
            <span>·</span>
            <span><strong>Effective Date:</strong> September 1, 2026</span>
          </p>
        </div>

        {/* Content Body */}
        <div className="bg-white rounded-2xl p-8 sm:p-10 border border-slate-200/80 shadow-xs space-y-8 text-slate-700 leading-relaxed text-sm sm:text-base">
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-2">1. Overview & Commitment</h2>
            <p>
              In accordance with Meta Platform Terms (Section 4.b), the WhatsApp Business Messaging Policy, 
              the General Data Protection Regulation (GDPR Article 17 - Right to Erasure), and the Digital 
              Personal Data Protection (DPDP) Act 2023, <strong>VDAJ Services LLP</strong> provides clear, 
              accessible mechanisms for users and recipients to request the complete deletion of their personal 
              data processed through our WhatsApp communications platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">2. How to Request Data Deletion</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                <div className="flex items-center gap-2 font-bold text-slate-900 mb-1">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs">A</span>
                  <span>WhatsApp In-Chat Opt-Out</span>
                </div>
                <p className="text-xs text-slate-600">
                  Reply with <strong>STOP</strong>, <strong>UNSUBSCRIBE</strong>, or <strong>OPT OUT</strong> to any WhatsApp message sent through our gateway. Our automated compliance engine will instantly revoke consent and flag your number against future marketing broadcasts.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                <div className="flex items-center gap-2 font-bold text-slate-900 mb-1">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs">B</span>
                  <span>Direct Privacy Request by Email</span>
                </div>
                <p className="text-xs text-slate-600">
                  Send an email to <a href="mailto:privacy@vdajservices.com" className="text-indigo-600 font-semibold underline">privacy@vdajservices.com</a> with the subject line <em>"Data Deletion Request"</em>. Please specify your registered phone number (with country code) or organization email.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-2">3. Scope of Deleted Data</h2>
            <p className="mb-3">Upon receipt and verification of a verified erasure request, we securely purge:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-600 text-xs sm:text-sm">
              <li>Customer contact records, display names, and associated metadata.</li>
              <li>Historic two-way message content, interactive button selections, and media attachments.</li>
              <li>Device identifiers, IP audit records older than 30 days, and tracking tokens.</li>
              <li>Campaign audience segmentation entries and tags.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-2">4. Processing Timelines & Confirmation</h2>
            <div className="bg-indigo-50/70 border border-indigo-100 p-4 rounded-xl text-xs sm:text-sm space-y-2 text-indigo-950">
              <p>
                <strong>Acknowledgment:</strong> Your deletion request is acknowledged within <strong>48 hours</strong> with a unique tracking reference code.
              </p>
              <p>
                <strong>Execution SLA:</strong> Data is permanently expunged across active database partitions and replica clusters within <strong>30 days</strong>.
              </p>
              <p>
                <strong>Exemptions:</strong> Transactional accounting records or compliance audit trails required by statutory law (e.g., GST or telecom retention mandates) are retained in anonymized form solely for legal defense.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-2">5. Data Protection Officer (DPO) Contact</h2>
            <p className="text-slate-600">
              For escalation or inquiries regarding our data handling policies, reach our Privacy & Compliance Cell:
            </p>
            <div className="mt-2 text-xs sm:text-sm font-mono text-slate-700 bg-slate-50 border border-slate-200 p-3 rounded-lg">
              <div><strong>VDAJ Services LLP — Data Protection Officer</strong></div>
              <div>Email: <a href="mailto:privacy@vdajservices.com" className="text-indigo-600 underline">privacy@vdajservices.com</a> / <a href="mailto:admin@vdajservices.com" className="text-indigo-600 underline">admin@vdajservices.com</a></div>
              <div>Registered Office: 200, Sector 1, Pune / Bangalore, India</div>
            </div>
          </section>
        </div>

        {/* Footer Navigation */}
        <div className="mt-8 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-4">
          <p>© {new Date().getFullYear()} VDAJ Services LLP. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link to="/legal/privacy" className="hover:text-indigo-600 transition-colors">Privacy Policy</Link>
            <span>·</span>
            <Link to="/legal/terms" className="hover:text-indigo-600 transition-colors">Terms of Service</Link>
            <span>·</span>
            <a href="https://wa.vdajservices.com" className="hover:text-indigo-600 transition-colors">VDAJ Platform</a>
          </div>
        </div>
      </main>
    </div>
  );
}
