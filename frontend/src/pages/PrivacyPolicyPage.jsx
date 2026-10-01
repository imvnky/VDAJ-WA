/**
 * VDAJ Services LLP — Enterprise Privacy Policy & Trust Charter
 * Route: /legal/privacy & /privacy (public, no auth required)
 * Compliant with Meta Platform Terms §4.a, WhatsApp Business Policy, and India DPDP Act 2023.
 * Crafted with Impeccable & Taste standards: high-contrast, editorial typography, zero-slop layout.
 */

import React, { useState, useEffect } from 'react';
import PublicWebsiteNavbar from '../components/organisms/PublicWebsiteNavbar';
import PublicWebsiteFooter from '../components/organisms/PublicWebsiteFooter';

const SECTIONS = [
  { id: 'scope', num: '01', title: 'Entity Scope & Authority' },
  { id: 'architecture', num: '02', title: 'Technical Architecture & Flow' },
  { id: 'data-collected', num: '03', title: 'Data Collected & Processed' },
  { id: 'meta-governance', num: '04', title: 'Meta Platform Governance' },
  { id: 'consent-optout', num: '05', title: 'Consent & STOP Protocols' },
  { id: 'security', num: '06', title: 'Cryptographic Security' },
  { id: 'retention', num: '07', title: 'Retention & Purge Lifecycle' },
  { id: 'rights', num: '08', title: 'Statutory Data Principal Rights' },
  { id: 'grievance', num: '09', title: 'Designated Grievance Officer' },
];

export default function PrivacyPolicyPage() {
  const [activeSection, setActiveSection] = useState('scope');

  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY + 180;
      for (let i = SECTIONS.length - 1; i >= 0; i--) {
        const el = document.getElementById(SECTIONS[i].id);
        if (el && el.offsetTop <= scrollPos) {
          setActiveSection(SECTIONS[i].id);
          break;
        }
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) {
      window.scrollTo({
        top: el.offsetTop - 90,
        behavior: 'smooth',
      });
    }
  };

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
            <span className="text-[#534AB7] font-semibold">Privacy Policy</span>
          </nav>

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1D9E75]/10 border border-[#1D9E75]/25 text-[#1D9E75] text-xs font-semibold mb-4">
                <span className="w-2 h-2 rounded-full bg-[#1D9E75]"></span>
                <span>Meta Platform Terms Aligned · India DPDP Act 2023 · ISO/IEC 27001</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
                Privacy Policy & <br />
                <span className="text-[#534AB7]">Data Protection Charter</span>
              </h1>
              <p className="mt-4 text-slate-600 text-base leading-relaxed max-w-2xl">
                This comprehensive governance document details the statutory principles, cryptographic protocols, and technical boundaries governing data handled by VDAJ Services LLP as an enterprise technology provider utilizing official Meta WhatsApp Business Cloud APIs.
              </p>
            </div>

            {/* Document Metadata & Print Utility */}
            <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-3 shrink-0">
              <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-3 space-y-1">
                <div><span className="text-slate-400 font-medium">Entity:</span> <strong className="text-slate-800">VDAJ Services LLP</strong></div>
                <div><span className="text-slate-400 font-medium">Effective Date:</span> <strong className="text-slate-800">September 1, 2026</strong></div>
                <div><span className="text-slate-400 font-medium">Version:</span> <strong className="text-slate-800">2.4.0 (Enterprise)</strong></div>
                <div><span className="text-slate-400 font-medium">Jurisdiction:</span> <strong className="text-slate-800">Maharashtra, India</strong></div>
              </div>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-[#534AB7] px-4 py-2 rounded-lg border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 transition-all shadow-xs"
              >
                <svg className="w-4 h-4 text-[#534AB7]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                <span>Print Official PDF</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main 2-Column Body Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          
          {/* Left Column: Sticky Table of Contents (Desktop) */}
          <aside className="hidden lg:block lg:col-span-4 xl:col-span-3 sticky top-22">
            <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-xs">
              <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Contents Overview
                </span>
                <span className="text-[11px] font-semibold text-[#534AB7] bg-[#534AB7]/10 px-2 py-0.5 rounded-full">
                  9 Clauses
                </span>
              </div>
              <nav className="space-y-0.5">
                {SECTIONS.map((sec) => (
                  <button
                    key={sec.id}
                    onClick={() => scrollTo(sec.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all flex items-center gap-2.5 ${
                      activeSection === sec.id
                        ? 'bg-[#534AB7]/10 text-[#534AB7] font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-mono text-[11px] text-slate-400 shrink-0 font-normal">
                      {sec.num}
                    </span>
                    <span className="truncate">{sec.title}</span>
                  </button>
                ))}
              </nav>

              <div className="pt-4 mt-3 border-t border-slate-100 text-[11px] text-slate-500 leading-normal">
                Statutory inquiries: <br />
                <a href="mailto:info@vdajservices.com" className="text-[#534AB7] font-semibold hover:underline">
                  info@vdajservices.com
                </a>
              </div>
            </div>
          </aside>

          {/* Right Column: Formal Legal Charter */}
          <article className="lg:col-span-8 xl:col-span-9 bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-10 lg:p-14 shadow-xs space-y-12">
            
            {/* Section 01 */}
            <section id="scope" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-semibold text-[#534AB7] px-2.5 py-0.5 rounded-md bg-[#534AB7]/10 border border-[#534AB7]/20">
                  SECTION 01
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Entity Scope & Regulatory Authority
                </h2>
              </div>
              <p className="text-[15px] text-slate-600 leading-relaxed">
                <strong className="text-slate-900">VDAJ Services LLP</strong> (&ldquo;VDAJ&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) is a formally registered Limited Liability Partnership organized under the Limited Liability Partnership Act, 2008 of the Republic of India, maintaining operations in Maharashtra, India.
              </p>
              <p className="text-[15px] text-slate-600 leading-relaxed">
                VDAJ operates as an authorized enterprise technology provider and technical intermediary delivering cloud-native business infrastructure, including official integration with the <strong className="text-slate-900">Meta WhatsApp Business Cloud API</strong>, multi-agent unified messaging inboxes, and high-throughput broadcast orchestration systems.
              </p>
              
              <div className="bg-[#F8FAFC] border-l-4 border-[#534AB7] rounded-r-xl p-4 text-xs sm:text-sm text-slate-700 leading-relaxed">
                <strong className="text-slate-900">Statutory Applicability:</strong> This Policy applies to all direct corporate clients (&ldquo;Business Operators&rdquo;), their authorized personnel, and all end-user consumer recipients receiving or dispatching WhatsApp communications through or hosted on our platform infrastructure.
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* Section 02 */}
            <section id="architecture" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-semibold text-[#534AB7] px-2.5 py-0.5 rounded-md bg-[#534AB7]/10 border border-[#534AB7]/20">
                  SECTION 02
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Technical Architecture & Data Flow
                </h2>
              </div>
              <p className="text-[15px] text-slate-600 leading-relaxed">
                Our infrastructure operates strictly as a secure technical conduit between Business Operators, our distributed cloud database, and Meta Platforms, Inc. official Cloud API endpoints.
              </p>
              
              {/* Architecture Blueprint Steps */}
              <div className="p-5 sm:p-6 rounded-xl bg-slate-50 border border-slate-200/80 space-y-4">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Enterprise Data Flow & Processing Lifecycle
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  <div className="p-4 rounded-lg bg-white border border-slate-200/80 shadow-xs space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#1D9E75]/15 text-[#1D9E75] font-bold text-xs flex items-center justify-center">1</span>
                      <span className="font-semibold text-xs text-slate-900">Outbound Dispatch</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Authorized campaign message submitted via secure HTTPS API using tenant-isolated bearer authentication.
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-white border border-slate-200/80 shadow-xs space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#534AB7]/15 text-[#534AB7] font-bold text-xs flex items-center justify-center">2</span>
                      <span className="font-semibold text-xs text-slate-900">Meta Cloud API</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Payload relayed over TLS 1.3 to Meta Graph API servers (<code className="text-slate-800 font-mono text-[11px]">graph.facebook.com/v20.0</code>) for delivery.
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-white border border-slate-200/80 shadow-xs space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#2563EB]/15 text-[#2563EB] font-bold text-xs flex items-center justify-center">3</span>
                      <span className="font-semibold text-xs text-slate-900">Inbound Webhook</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Delivery telemetry and customer replies cryptographically verified via HMAC-SHA256 signatures before persistence.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* Section 03 */}
            <section id="data-collected" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-semibold text-[#534AB7] px-2.5 py-0.5 rounded-md bg-[#534AB7]/10 border border-[#534AB7]/20">
                  SECTION 03
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Information Collected & Processed
                </h2>
              </div>
              <p className="text-[15px] text-slate-600 leading-relaxed">
                To provide enterprise messaging and satisfy statutory compliance frameworks, VDAJ collects and processes strictly limited data categories:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div className="p-5 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#534AB7]"></span>
                    <h3 className="font-semibold text-sm text-slate-900">Business Account Credentials</h3>
                  </div>
                  <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside leading-relaxed">
                    <li>Corporate entity name, authorized administrator email, billing records.</li>
                    <li>WhatsApp Business Account (WABA) ID, Phone Number ID.</li>
                    <li>Meta System Access Tokens and embedded onboarding credentials.</li>
                    <li>Cryptographic API keys and session identifiers.</li>
                  </ul>
                </div>

                <div className="p-5 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#1D9E75]"></span>
                    <h3 className="font-semibold text-sm text-slate-900">Recipient & Telemetry Data</h3>
                  </div>
                  <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside leading-relaxed">
                    <li>Recipient phone numbers strictly in international E.164 format.</li>
                    <li>Message delivery receipts (queued, sent, delivered, read, failed).</li>
                    <li>Customer 2-way conversation transcripts within active 24h service windows.</li>
                    <li>Pre-approved message template variables and broadcast assignment logs.</li>
                  </ul>
                </div>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* Section 04 */}
            <section id="meta-governance" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-semibold text-[#534AB7] px-2.5 py-0.5 rounded-md bg-[#534AB7]/10 border border-[#534AB7]/20">
                  SECTION 04
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Meta WhatsApp Platform Governance & Zero Data Brokering
                </h2>
              </div>
              <div className="p-6 rounded-xl bg-[#F4F3FF]/70 border border-[#AFA9EC]/40 space-y-3.5">
                <h3 className="text-slate-900 font-bold text-sm tracking-tight">
                  Our Irrevocable Enterprise Data Guarantee:
                </h3>
                <ul className="text-xs sm:text-sm text-slate-700 space-y-2.5">
                  <li className="flex items-start gap-2.5">
                    <svg className="w-4 h-4 text-[#1D9E75] shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                    </svg>
                    <span><strong className="text-slate-900">Zero Data Monetization:</strong> We NEVER sell, lease, rent, trade, or transfer customer lists, recipient telephone numbers, or message content to any third parties or data brokers.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <svg className="w-4 h-4 text-[#1D9E75] shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                    </svg>
                    <span><strong className="text-slate-900">No Cross-Platform Profiling:</strong> We do not construct behavioural profiles across corporate workspaces or cross-reference numbers for advertising purposes.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <svg className="w-4 h-4 text-[#1D9E75] shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                    </svg>
                    <span><strong className="text-slate-900">No AI Model Training on Private Data:</strong> Customer conversation content is NEVER used to train, tune, or improve public foundation machine learning models.</span>
                  </li>
                </ul>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* Section 05 */}
            <section id="consent-optout" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-semibold text-[#534AB7] px-2.5 py-0.5 rounded-md bg-[#534AB7]/10 border border-[#534AB7]/20">
                  SECTION 05
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Explicit Opt-In & Automated STOP Opt-Out Protocols
                </h2>
              </div>
              <p className="text-[15px] text-slate-600 leading-relaxed">
                In strict compliance with Meta WhatsApp Business Policies and the India Digital Personal Data Protection (DPDP) Act 2023:
              </p>
              <div className="space-y-3.5">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-sm">
                  <strong className="text-slate-900">1. Verified Prior Consent:</strong> Business Operators must obtain verified, unambiguous opt-in consent from individuals before dispatching marketing or transactional broadcasts. The platform maintains audit trails recording consent timestamps and sources.
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-sm space-y-2">
                  <div>
                    <strong className="text-slate-900">2. Real-Time STOP Interceptor:</strong> When any recipient texts keywords such as <span className="font-mono font-bold text-[#534AB7] bg-[#534AB7]/10 px-1.5 py-0.5 rounded">STOP</span>, <span className="font-mono font-bold text-[#534AB7] bg-[#534AB7]/10 px-1.5 py-0.5 rounded">UNSUBSCRIBE</span>, <span className="font-mono font-bold text-[#534AB7] bg-[#534AB7]/10 px-1.5 py-0.5 rounded">OPT-OUT</span>, or <span className="font-mono font-bold text-[#534AB7] bg-[#534AB7]/10 px-1.5 py-0.5 rounded">CANCEL</span>, our platform immediately:
                  </div>
                  <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside leading-relaxed pl-1">
                    <li>Updates the contact status to <span className="text-red-600 font-bold">Opted Out</span> in the database.</li>
                    <li>Writes an immutable suppression entry in the high-speed Redis block index.</li>
                    <li>Automatically resolves any open conversation in the Team Inbox.</li>
                    <li>Permanently blocks all future automated campaign broadcasts to that number.</li>
                  </ul>
                </div>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* Section 06 */}
            <section id="security" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-semibold text-[#534AB7] px-2.5 py-0.5 rounded-md bg-[#534AB7]/10 border border-[#534AB7]/20">
                  SECTION 06
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Cryptographic Security & Infrastructure Safeguards
                </h2>
              </div>
              <p className="text-[15px] text-slate-600 leading-relaxed">
                VDAJ implements enterprise-grade technical and organizational controls to protect stored records and real-time transit streams:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <div className="text-slate-900 font-semibold text-xs">HMAC-SHA256 Webhook Verification</div>
                  <p className="text-xs text-slate-600 leading-relaxed">Every incoming Meta webhook is verified against the shared app secret before ingest. Unauthorized payloads are immediately rejected.</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <div className="text-slate-900 font-semibold text-xs">AES-256 Storage & TLS 1.3 Transport</div>
                  <p className="text-xs text-slate-600 leading-relaxed">All operational databases are protected with AES-256 at rest. All API interactions enforce TLS 1.3 transport security.</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <div className="text-slate-900 font-semibold text-xs">Strict Tenant Isolation</div>
                  <p className="text-xs text-slate-600 leading-relaxed">Each enterprise client is segmented by unique tenant identifiers. Cross-tenant data leakage is cryptographically and procedurally prevented.</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <div className="text-slate-900 font-semibold text-xs">Role-Based Access Control (RBAC)</div>
                  <p className="text-xs text-slate-600 leading-relaxed">Administrative operations are guarded by least-privilege RBAC schemas, automated session revocation, and security audit logs.</p>
                </div>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* Section 07 */}
            <section id="retention" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-semibold text-[#534AB7] px-2.5 py-0.5 rounded-md bg-[#534AB7]/10 border border-[#534AB7]/20">
                  SECTION 07
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Data Retention & Purge Lifecycle
                </h2>
              </div>
              <p className="text-[15px] text-slate-600 leading-relaxed">
                We enforce automated data retention lifecycles to prevent unnecessary long-term storage of communication logs:
              </p>
              <ul className="text-xs sm:text-sm text-slate-600 space-y-2 list-disc list-inside leading-relaxed">
                <li><strong className="text-slate-900">Message Delivery Telemetry:</strong> Retained for a rolling period of 90 days for operational auditing and delivery analytics, after which message payloads are automatically purged.</li>
                <li><strong className="text-slate-900">Opt-Out & Suppression Index:</strong> Retained indefinitely in our secure suppression registry to strictly honor recipient refusal and prevent accidental future outreach.</li>
                <li><strong className="text-slate-900">Workspace Data Purge:</strong> When an enterprise client terminates service, all associated contact databases, templates, and logs are deleted within 30 days.</li>
              </ul>
            </section>

            <hr className="border-slate-100" />

            {/* Section 08 */}
            <section id="rights" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-semibold text-[#534AB7] px-2.5 py-0.5 rounded-md bg-[#534AB7]/10 border border-[#534AB7]/20">
                  SECTION 08
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Statutory Data Principal Rights (DPDP Act 2023 & GDPR)
                </h2>
              </div>
              <p className="text-[15px] text-slate-600 leading-relaxed">
                In accordance with applicable statutory frameworks, data principals (both business users and end-consumers) possess enforceable rights:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <div className="text-slate-900 font-semibold text-xs">Right to Access</div>
                  <p className="text-xs text-slate-600 leading-relaxed">Request confirmation and a summary of personal data currently retained within our platform infrastructure.</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <div className="text-slate-900 font-semibold text-xs">Right to Correction</div>
                  <p className="text-xs text-slate-600 leading-relaxed">Request the rectification or updating of inaccurate, outdated, or incomplete personal identifiers.</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <div className="text-slate-900 font-semibold text-xs">Right to Erasure</div>
                  <p className="text-xs text-slate-600 leading-relaxed">Request the complete deletion of personal records (&ldquo;Right to be Forgotten&rdquo;) as described in our Data Deletion policy.</p>
                </div>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* Section 09 */}
            <section id="grievance" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-semibold text-[#534AB7] px-2.5 py-0.5 rounded-md bg-[#534AB7]/10 border border-[#534AB7]/20">
                  SECTION 09
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Designated Grievance Officer & Statutory Contact
                </h2>
              </div>
              <p className="text-[15px] text-slate-600 leading-relaxed">
                Pursuant to Section 5 of the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021 and Section 12 of the Digital Personal Data Protection Act, 2023, VDAJ Services LLP has designated a Grievance Redressal Officer:
              </p>

              {/* Official Corporate Contact Card */}
              <div className="p-6 rounded-xl bg-slate-50 border border-slate-200/80 space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-200">
                  <div className="w-9 h-9 rounded-lg bg-[#534AB7]/10 border border-[#534AB7]/25 flex items-center justify-center text-[#534AB7]">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-slate-900 font-bold text-sm leading-tight">
                      VDAJ Services LLP — Grievance Redressal Cell
                    </h3>
                    <p className="text-xs text-slate-500">
                      Corporate Legal, Compliance & Information Security Division
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                  <div>
                    <span className="text-slate-400 block uppercase tracking-wider text-[10px]">Entity:</span>
                    <span className="text-slate-800 font-semibold">VDAJ Services LLP</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block uppercase tracking-wider text-[10px]">Official Grievance Email:</span>
                    <a href="mailto:info@vdajservices.com" className="text-[#534AB7] font-semibold hover:underline">
                      info@vdajservices.com
                    </a>
                  </div>
                  <div>
                    <span className="text-slate-400 block uppercase tracking-wider text-[10px]">Corporate Jurisdiction:</span>
                    <span className="text-slate-800 font-semibold">Maharashtra, Republic of India</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block uppercase tracking-wider text-[10px]">SLA Response Window:</span>
                    <span className="text-[#1D9E75] font-semibold">Acknowledgment within 24h · Resolution within 15 days</span>
                  </div>
                </div>
              </div>
            </section>

          </article>
        </div>
      </div>

      {/* Executive Footer */}
      <PublicWebsiteFooter />
    </div>
  );
}
