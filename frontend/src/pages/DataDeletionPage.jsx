/**
 * VDAJ Services LLP — User Data Deletion & Privacy Rights Charter
 * Route: /legal/data-deletion & /data-deletion (public, no auth required)
 * Compliant with Meta Platform Terms §4.b, GDPR Article 17, and India DPDP Act 2023.
 * Fortune-500 Tier-1 MNC UI/UX Architecture.
 */

import React from 'react';
import PublicWebsiteNavbar from '../components/organisms/PublicWebsiteNavbar';
import PublicWebsiteFooter from '../components/organisms/PublicWebsiteFooter';

export default function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-[#08080C] text-slate-200 font-sans selection:bg-[#534AB7]/40 selection:text-white">
      {/* MNC Website Executive Header */}
      <PublicWebsiteNavbar />

      {/* Hero Header */}
      <div className="relative border-b border-white/[0.08] bg-gradient-to-b from-[#0F0F1A] via-[#0B0B14] to-[#08080C] pt-12 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mb-6">
            <a href="https://www.vdajservices.com" className="hover:text-white transition-colors">
              Enterprise Home
            </a>
            <span>/</span>
            <span className="text-slate-400">Trust & Compliance</span>
            <span>/</span>
            <span className="text-[#AFA9EC] font-semibold">User Data Deletion</span>
          </div>

          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1D9E75]/10 border border-[#1D9E75]/30 text-[#26C18E] text-xs font-semibold mb-4">
              <span className="w-2 h-2 rounded-full bg-[#1D9E75]"></span>
              <span>Meta Platform Terms §4.b · GDPR Art. 17 · India DPDP Act 2023</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
              User Data Deletion <br />
              <span className="bg-gradient-to-r from-white via-[#AFA9EC] to-[#26C18E] bg-clip-text text-transparent">
                Instructions & Protocols
              </span>
            </h1>
            <p className="mt-4 text-slate-400 text-sm sm:text-base leading-relaxed">
              In accordance with Meta Platform Terms §4.b and statutory data principal rights, this page outlines the procedures and technical mechanisms available to end-users and client organizations to request complete erasure of their personal identifiers and communications data.
            </p>
          </div>
        </div>
      </div>

      {/* Content Container */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 space-y-12">
        
        {/* Mechanism 1: Instant Automated Self-Serve Erasure via WhatsApp */}
        <section className="p-6 sm:p-8 rounded-2xl bg-[#0E0E16] border border-white/[0.08] space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold text-[#26C18E] px-2.5 py-0.5 rounded bg-[#1D9E75]/20 border border-[#1D9E75]/40">
              METHOD 01 (INSTANT)
            </span>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Instant Self-Service Opt-Out & Erasure via WhatsApp
            </h2>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            Any individual recipient receiving messages from a business workspace powered by VDAJ Services LLP can invoke an immediate, automated opt-out without contacting customer support:
          </p>
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs font-mono space-y-2">
            <div><strong>Action:</strong> Reply directly to the WhatsApp chat with:</div>
            <div className="text-base font-bold text-[#AFA9EC]">STOP</div>
            <div className="text-slate-400 text-[11px]">
              (Also recognized: <code className="text-white">UNSUBSCRIBE</code>, <code className="text-white">OPT-OUT</code>, <code className="text-white">CANCEL</code>)
            </div>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Our real-time webhook interceptor executes atomically in under 200ms: the contact status is set to Opted Out, a permanent suppression key is registered in our Redis index, the conversation is marked resolved, and all further campaign messaging is permanently halted.
          </p>
        </section>

        {/* Mechanism 2: Formal Statutory Deletion Request */}
        <section className="p-6 sm:p-8 rounded-2xl bg-[#0E0E16] border border-white/[0.08] space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold text-[#AFA9EC] px-2.5 py-0.5 rounded bg-[#534AB7]/20 border border-[#534AB7]/40">
              METHOD 02 (ADMINISTRATIVE)
            </span>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Formal Written Data Erasure Request (&ldquo;Right to be Forgotten&rdquo;)
            </h2>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            To request full database-level purging of all conversation records, telephone records, and metadata, please submit a written deletion request to our Data Protection Officer:
          </p>

          <div className="p-5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
              <div>
                <span className="text-slate-500 block uppercase tracking-wider text-[10px]">Email Recipient:</span>
                <a href="mailto:info@vdajservices.com" className="text-[#AFA9EC] font-semibold hover:underline">
                  info@vdajservices.com
                </a>
              </div>
              <div>
                <span className="text-slate-500 block uppercase tracking-wider text-[10px]">Subject Header:</span>
                <span className="text-slate-200">Data Deletion Request — [Phone Number]</span>
              </div>
            </div>
            <div className="pt-2 border-t border-white/[0.06] text-slate-400">
              <strong>Required Information:</strong> Include your full international phone number (in +E.164 format, e.g. +91 98765 43210) and the name of the business you were communicating with.
            </div>
          </div>

          <div className="text-xs text-slate-400 space-y-1">
            <p><strong>Turnaround SLA:</strong> Acknowledgment within 24 business hours; complete purge execution within 7 business days.</p>
            <p><strong>Confirmation:</strong> A formal audit deletion certificate with a unique purge confirmation code will be dispatched to your email.</p>
          </div>
        </section>

        {/* Mechanism 3: Automatic Purge Lifecycle */}
        <section className="p-6 sm:p-8 rounded-2xl bg-[#0E0E16] border border-white/[0.08] space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold text-[#60A5FA] px-2.5 py-0.5 rounded bg-blue-500/20 border border-blue-500/40">
              METHOD 03 (AUTOMATED)
            </span>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Automated 90-Day Retention Expiration
            </h2>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            By default, VDAJ Services LLP applies an automated data minimization purge protocol. Raw message delivery payloads, media references, and webhook payloads are automatically and irrevocably purged on a rolling 90-day lifecycle, retaining only aggregate high-level metrics (e.g. total delivered count) for billing audit compliance.
          </p>
        </section>

      </div>

      {/* MNC Website Executive Footer */}
      <PublicWebsiteFooter />
    </div>
  );
}
