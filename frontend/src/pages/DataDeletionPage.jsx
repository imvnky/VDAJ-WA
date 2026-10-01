/**
 * VDAJ Services LLP — User Data Deletion & Privacy Rights Charter
 * Route: /legal/data-deletion & /data-deletion (public, no auth required)
 * Compliant with Meta Platform Terms §4.b, GDPR Article 17, and India DPDP Act 2023.
 * Crafted with Impeccable & Taste standards: high-contrast, editorial typography, zero-slop layout.
 */

import React from 'react';
import PublicWebsiteNavbar from '../components/organisms/PublicWebsiteNavbar';
import PublicWebsiteFooter from '../components/organisms/PublicWebsiteFooter';

export default function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans selection:bg-[#534AB7]/15 selection:text-[#534AB7]">
      {/* Executive Header */}
      <PublicWebsiteNavbar />

      {/* Hero Header Dossier */}
      <div className="border-b border-slate-200/80 bg-white pt-10 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Breadcrumb Navigation */}
          <nav className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-5" aria-label="Breadcrumb">
            <a href="https://www.vdajservices.com" className="hover:text-[#534AB7] transition-colors">
              Enterprise Home
            </a>
            <span className="text-slate-300">/</span>
            <span>Trust & Compliance</span>
            <span className="text-slate-300">/</span>
            <span className="text-[#534AB7] font-semibold">User Data Deletion</span>
          </nav>

          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1D9E75]/10 border border-[#1D9E75]/25 text-[#1D9E75] text-xs font-semibold mb-4">
              <span className="w-2 h-2 rounded-full bg-[#1D9E75]"></span>
              <span>Meta Platform Terms §4.b · GDPR Art. 17 · India DPDP Act 2023</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
              User Data Deletion <br />
              <span className="text-[#534AB7]">Instructions & Protocols</span>
            </h1>
            <p className="mt-4 text-slate-600 text-base leading-relaxed max-w-2xl">
              In accordance with Meta Platform Terms §4.b and statutory data principal rights, this page outlines the procedures and technical mechanisms available to end-users and client organizations to request complete erasure of their personal identifiers and communications data.
            </p>
          </div>
        </div>
      </div>

      {/* Content Container */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14 space-y-8">
        
        {/* Mechanism 1: Instant Automated Self-Serve Erasure via WhatsApp */}
        <section className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-semibold text-[#1D9E75] px-2.5 py-0.5 rounded-md bg-[#1D9E75]/10 border border-[#1D9E75]/25">
              METHOD 01 (INSTANT)
            </span>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Instant Self-Service Opt-Out & Erasure via WhatsApp
            </h2>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            Any individual recipient receiving messages from a business workspace powered by VDAJ Services LLP can invoke an immediate, automated opt-out without contacting customer support:
          </p>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-mono space-y-2">
            <div><strong className="text-slate-800">Action:</strong> Reply directly to the WhatsApp chat with:</div>
            <div className="text-base font-bold text-[#534AB7] bg-white px-3 py-1.5 rounded-md border border-slate-200 inline-block">
              STOP
            </div>
            <div className="text-slate-500 text-[11px]">
              (Also recognized: <code className="text-slate-800 font-bold">UNSUBSCRIBE</code>, <code className="text-slate-800 font-bold">OPT-OUT</code>, <code className="text-slate-800 font-bold">CANCEL</code>)
            </div>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Our real-time webhook interceptor executes atomically in under 200ms: the contact status is set to Opted Out, a permanent suppression key is registered in our Redis index, the conversation is marked resolved, and all further campaign messaging is permanently halted.
          </p>
        </section>

        {/* Mechanism 2: Formal Statutory Deletion Request */}
        <section className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-semibold text-[#534AB7] px-2.5 py-0.5 rounded-md bg-[#534AB7]/10 border border-[#534AB7]/25">
              METHOD 02 (ADMINISTRATIVE)
            </span>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Formal Written Data Erasure Request (&ldquo;Right to be Forgotten&rdquo;)
            </h2>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            To request full database-level purging of all conversation records, telephone records, and metadata, please submit a written deletion request to our Data Protection Officer:
          </p>

          <div className="p-5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono">
              <div>
                <span className="text-slate-400 block uppercase tracking-wider text-[10px]">Email Recipient:</span>
                <a href="mailto:info@vdajservices.com" className="text-[#534AB7] font-semibold hover:underline">
                  info@vdajservices.com
                </a>
              </div>
              <div>
                <span className="text-slate-400 block uppercase tracking-wider text-[10px]">Subject Header:</span>
                <span className="text-slate-800 font-semibold">Data Deletion Request — [Phone Number]</span>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-200/80 text-slate-600">
              <strong className="text-slate-800">Required Information:</strong> Include your full international phone number (in +E.164 format, e.g. +91 80077 73138) and the name of the business you were communicating with.
            </div>
          </div>

          <div className="text-xs text-slate-500 space-y-1">
            <p><strong className="text-slate-700">Turnaround SLA:</strong> Acknowledgment within 24 business hours; complete purge execution within 7 business days.</p>
            <p><strong className="text-slate-700">Confirmation:</strong> A formal audit deletion certificate with a unique purge confirmation code will be dispatched to your email.</p>
          </div>
        </section>

        {/* Mechanism 3: Automatic Purge Lifecycle */}
        <section className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-semibold text-[#2563EB] px-2.5 py-0.5 rounded-md bg-blue-50 border border-blue-200">
              METHOD 03 (AUTOMATED)
            </span>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Automated 90-Day Retention Expiration
            </h2>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            By default, VDAJ Services LLP applies an automated data minimization purge protocol. Raw message delivery payloads, media references, and webhook payloads are automatically and irrevocably purged on a rolling 90-day lifecycle, retaining only aggregate high-level metrics (e.g. total delivered count) for billing audit compliance.
          </p>
        </section>

      </div>

      {/* Executive Footer */}
      <PublicWebsiteFooter />
    </div>
  );
}
