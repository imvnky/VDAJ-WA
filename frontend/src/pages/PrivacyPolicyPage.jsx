/**
 * VDAJ Services LLP — Enterprise Privacy Policy & Trust Charter
 * Route: /legal/privacy & /privacy (public, no auth required)
 * Compliant with Meta Platform Terms §4.a, WhatsApp Business Policy, and India DPDP Act 2023.
 * Colorlib Locksmith corporate MNC architecture: crisp, high-trust light theme with VDAJ branding.
 */

import React, { useState, useEffect } from 'react';
import PublicWebsiteNavbar from '../components/organisms/PublicWebsiteNavbar';
import PublicWebsiteFooter from '../components/organisms/PublicWebsiteFooter';

const SECTIONS = [
  { id: 'scope', title: '01. Entity Scope & Regulatory Authority' },
  { id: 'architecture', title: '02. Technical Architecture & Data Flow' },
  { id: 'data-collected', title: '03. Information Collected & Processed' },
  { id: 'meta-governance', title: '04. Meta WhatsApp Platform Governance' },
  { id: 'consent-optout', title: '05. Explicit Consent & Automated Opt-Out' },
  { id: 'security', title: '06. Cryptographic Security & Infrastructure' },
  { id: 'retention', title: '07. Data Retention & Purge Lifecycle' },
  { id: 'rights', title: '08. Statutory Data Principal Rights' },
  { id: 'grievance', title: '09. Designated Grievance Officer' },
];

export default function PrivacyPolicyPage() {
  const [activeSection, setActiveSection] = useState('scope');

  useEffect(() => {
    const handleScroll = () => {
      const scrollPos = window.scrollY + 200;
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
        top: el.offsetTop - 100,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans selection:bg-[#534AB7]/20 selection:text-[#534AB7]">
      {/* Executive Header */}
      <PublicWebsiteNavbar />

      {/* Hero Header Dossier (Clean White Corporate Banner) */}
      <div className="border-b border-slate-200 bg-white pt-10 pb-12 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Breadcrumb Navigation */}
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-5">
            <a href="https://www.vdajservices.com" className="hover:text-[#534AB7] transition-colors">
              Enterprise Home
            </a>
            <span>/</span>
            <span>Trust & Compliance</span>
            <span>/</span>
            <span className="text-[#534AB7] font-bold">Privacy Policy</span>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1D9E75]/10 border border-[#1D9E75]/30 text-[#1D9E75] text-xs font-bold mb-4">
                <span className="w-2 h-2 rounded-full bg-[#1D9E75]"></span>
                <span>Meta Platform Terms Aligned · India DPDP Act 2023 · ISO/IEC 27001</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#0F172A] tracking-tight leading-tight uppercase font-['Rajdhani',sans-serif]">
                Privacy Policy & <br />
                <span className="text-[#534AB7]">
                  Data Protection Charter
                </span>
              </h1>
              <p className="mt-4 text-slate-600 text-sm sm:text-base leading-relaxed">
                This comprehensive governance document details the statutory principles, cryptographic protocols, and technical boundaries governing data handled by VDAJ Services LLP as an enterprise technology provider utilizing official Meta WhatsApp Business Cloud APIs.
              </p>
            </div>

            {/* Document Metadata & Print Utility */}
            <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-3 shrink-0">
              <div className="text-xs font-mono text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 space-y-1 shadow-sm">
                <div><strong>Entity:</strong> VDAJ Services LLP</div>
                <div><strong>Effective Date:</strong> September 1, 2026</div>
                <div><strong>Document Version:</strong> 2.4.0 (Enterprise)</div>
                <div><strong>Jurisdiction:</strong> Maharashtra, India</div>
              </div>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 hover:text-[#534AB7] px-4 py-2 rounded border border-slate-300 hover:border-[#534AB7] bg-white hover:bg-slate-50 shadow-sm transition-all"
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
          
          {/* Left Column: Sticky Table of Contents (Desktop) */}
          <aside className="hidden lg:block lg:col-span-4 xl:col-span-3">
            <div className="sticky top-24 p-5 rounded-lg bg-white border border-slate-200 shadow-sm space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 px-2 font-['Rajdhani',sans-serif]">
                Table of Contents
              </p>
              <nav className="space-y-1">
                {SECTIONS.map((sec) => (
                  <button
                    key={sec.id}
                    onClick={() => scrollTo(sec.id)}
                    className={`w-full text-left px-3 py-2 rounded text-xs font-medium transition-all flex items-center justify-between ${
                      activeSection === sec.id
                        ? 'bg-[#534AB7]/10 text-[#534AB7] font-bold border-l-3 border-[#534AB7]'
                        : 'text-slate-600 hover:text-[#534AB7] hover:bg-slate-50'
                    }`}
                  >
                    <span className="truncate">{sec.title}</span>
                    {activeSection === sec.id && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#534AB7] shrink-0"></span>
                    )}
                  </button>
                ))}
              </nav>

              <div className="pt-4 mt-4 border-t border-slate-200 px-2 text-[11px] text-slate-500">
                Statutory inquiries: <br />
                <a href="mailto:info@vdajservices.com" className="text-[#534AB7] font-semibold hover:underline font-mono">
                  info@vdajservices.com
                </a>
              </div>
            </div>
          </aside>

          {/* Right Column: Formal Legal Prose & Technical Architecture */}
          <article className="lg:col-span-8 xl:col-span-9 bg-white border border-slate-200 rounded-lg p-6 sm:p-10 lg:p-12 shadow-sm space-y-12 text-slate-700 text-sm sm:text-base leading-relaxed">
            
            {/* Section 01 */}
            <section id="scope" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-[#534AB7] px-2.5 py-0.5 rounded bg-[#534AB7]/10 border border-[#534AB7]/30">
                  SECTION 01
                </span>
                <h2 className="text-2xl font-bold text-[#0F172A] tracking-tight font-['Rajdhani',sans-serif] uppercase">
                  Entity Scope & Regulatory Authority
                </h2>
              </div>
              <p>
                <strong>VDAJ Services LLP</strong> (&ldquo;VDAJ&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) is a formally registered Limited Liability Partnership organized under the Limited Liability Partnership Act, 2008 of the Republic of India, maintaining operations in Maharashtra, India.
              </p>
              <p>
                VDAJ operates as an authorized enterprise technology provider and technical intermediary delivering cloud-native business infrastructure, including official integration with the <strong>Meta WhatsApp Business Cloud API</strong>, multi-agent unified messaging inboxes, and high-throughput broadcast orchestration systems.
              </p>
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
                <strong>Statutory Applicability:</strong> This Policy applies to all direct corporate clients (&ldquo;Business Operators&rdquo;), their authorized personnel, and all end-user consumer recipients receiving or dispatching WhatsApp communications through or hosted on our platform infrastructure.
              </div>
            </section>

            <hr className="border-slate-200" />

            {/* Section 02 */}
            <section id="architecture" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-[#534AB7] px-2.5 py-0.5 rounded bg-[#534AB7]/10 border border-[#534AB7]/30">
                  SECTION 02
                </span>
                <h2 className="text-2xl font-bold text-[#0F172A] tracking-tight font-['Rajdhani',sans-serif] uppercase">
                  Technical Architecture & Data Flow
                </h2>
              </div>
              <p>
                Our infrastructure operates strictly as a secure technical conduit between Business Operators, our distributed cloud database, and Meta Platforms, Inc. official Cloud API endpoints.
              </p>
              
              {/* Architecture Blueprint Card */}
              <div className="p-6 rounded-lg bg-slate-50 border border-slate-200 space-y-4 font-mono text-xs">
                <div className="text-[#534AB7] font-bold text-sm font-sans uppercase">
                  Enterprise Data Flow & Processing Lifecycle:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-slate-700">
                  <div className="p-3.5 rounded bg-white border border-slate-200 shadow-sm space-y-1">
                    <span className="text-[#1D9E75] font-bold">1. Outbound Dispatch</span>
                    <p className="text-[11px] text-slate-600 font-sans">
                      Authorized campaign message submitted via secure HTTPS API using tenant-isolated bearer authentication.
                    </p>
                  </div>
                  <div className="p-3.5 rounded bg-white border border-slate-200 shadow-sm space-y-1">
                    <span className="text-[#534AB7] font-bold">2. Meta Cloud API</span>
                    <p className="text-[11px] text-slate-600 font-sans">
                      Payload relayed over TLS 1.3 to Meta Graph API servers (<code className="text-slate-800">graph.facebook.com/v20.0</code>) for delivery.
                    </p>
                  </div>
                  <div className="p-3.5 rounded bg-white border border-slate-200 shadow-sm space-y-1">
                    <span className="text-[#2563EB] font-bold">3. Inbound Webhook</span>
                    <p className="text-[11px] text-slate-600 font-sans">
                      Delivery telemetry and customer replies cryptographically verified via HMAC-SHA256 signatures before persistence.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <hr className="border-slate-200" />

            {/* Section 03 */}
            <section id="data-collected" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-[#534AB7] px-2.5 py-0.5 rounded bg-[#534AB7]/10 border border-[#534AB7]/30">
                  SECTION 03
                </span>
                <h2 className="text-2xl font-bold text-[#0F172A] tracking-tight font-['Rajdhani',sans-serif] uppercase">
                  Information Collected & Processed
                </h2>
              </div>
              <p>
                To provide enterprise messaging and satisfy statutory compliance frameworks, VDAJ collects and processes strictly limited data categories:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                  <h3 className="text-[#0F172A] font-bold text-base flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#534AB7]"></span>
                    Business Account Credentials
                  </h3>
                  <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                    <li>Corporate entity name, authorized administrator email, billing records.</li>
                    <li>WhatsApp Business Account (WABA) ID, Phone Number ID.</li>
                    <li>Meta System Access Tokens and embedded onboarding credentials.</li>
                    <li>Cryptographic API keys and session identifiers.</li>
                  </ul>
                </div>

                <div className="p-5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                  <h3 className="text-[#0F172A] font-bold text-base flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#1D9E75]"></span>
                    Recipient & Communications Telemetry
                  </h3>
                  <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                    <li>Recipient phone numbers strictly in international E.164 format.</li>
                    <li>Message delivery lifecycle receipts (queued, sent, delivered, read, failed).</li>
                    <li>Customer 2-way conversation transcripts within active 24h service windows.</li>
                    <li>Pre-approved message template variables and broadcast assignment logs.</li>
                  </ul>
                </div>
              </div>
            </section>

            <hr className="border-slate-200" />

            {/* Section 04 */}
            <section id="meta-governance" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-[#534AB7] px-2.5 py-0.5 rounded bg-[#534AB7]/10 border border-[#534AB7]/30">
                  SECTION 04
                </span>
                <h2 className="text-2xl font-bold text-[#0F172A] tracking-tight font-['Rajdhani',sans-serif] uppercase">
                  Meta WhatsApp Platform Governance & Zero Data Brokering
                </h2>
              </div>
              <div className="p-6 rounded-lg bg-[#F4F3FF] border border-[#AFA9EC]/50 space-y-3">
                <h3 className="text-[#0F172A] font-bold text-base uppercase font-['Rajdhani',sans-serif]">
                  Our Irrevocable Enterprise Data Guarantee:
                </h3>
                <ul className="text-xs sm:text-sm text-slate-700 space-y-2.5">
                  <li className="flex items-start gap-2">
                    <span className="text-[#1D9E75] font-bold">✓</span>
                    <span><strong>Zero Data Monetization:</strong> We NEVER sell, lease, rent, trade, or transfer customer lists, recipient telephone numbers, or message content to any third parties or data brokers.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#1D9E75] font-bold">✓</span>
                    <span><strong>No Cross-Platform Profiling:</strong> We do not construct behavioural profiles across corporate workspaces or cross-reference numbers for advertising purposes.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#1D9E75] font-bold">✓</span>
                    <span><strong>No AI Model Training on Private Data:</strong> Customer conversation content is NEVER used to train, tune, or improve public foundation machine learning models.</span>
                  </li>
                </ul>
              </div>
            </section>

            <hr className="border-slate-200" />

            {/* Section 05 */}
            <section id="consent-optout" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-[#534AB7] px-2.5 py-0.5 rounded bg-[#534AB7]/10 border border-[#534AB7]/30">
                  SECTION 05
                </span>
                <h2 className="text-2xl font-bold text-[#0F172A] tracking-tight font-['Rajdhani',sans-serif] uppercase">
                  Explicit Opt-In & Automated STOP Opt-Out Protocols
                </h2>
              </div>
              <p>
                In strict compliance with Meta WhatsApp Business Policies and the India Digital Personal Data Protection (DPDP) Act 2023:
              </p>
              <div className="space-y-3 text-sm">
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <strong className="text-[#0F172A]">1. Verified Prior Consent:</strong> Business Operators must obtain verified, unambiguous opt-in consent from individuals before dispatching marketing or transactional broadcasts. The platform maintains audit trails recording consent timestamps and sources.
                </div>
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <strong className="text-[#0F172A]">2. Real-Time STOP Interceptor:</strong> When any recipient texts keywords such as <code className="text-[#534AB7] font-bold">STOP</code>, <code className="text-[#534AB7] font-bold">UNSUBSCRIBE</code>, <code className="text-[#534AB7] font-bold">OPT-OUT</code>, or <code className="text-[#534AB7] font-bold">CANCEL</code>, our platform immediately:
                  <ul className="mt-2 text-xs text-slate-600 space-y-1 list-disc list-inside">
                    <li>Updates the contact status to <span className="text-red-600 font-bold">Opted Out</span> in the database.</li>
                    <li>Writes an immutable suppression entry in the high-speed Redis block index.</li>
                    <li>Automatically resolves any open conversation in the Team Inbox.</li>
                    <li>Permanently blocks all future automated campaign broadcasts to that number.</li>
                  </ul>
                </div>
              </div>
            </section>

            <hr className="border-slate-200" />

            {/* Section 06 */}
            <section id="security" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-[#534AB7] px-2.5 py-0.5 rounded bg-[#534AB7]/10 border border-[#534AB7]/30">
                  SECTION 06
                </span>
                <h2 className="text-2xl font-bold text-[#0F172A] tracking-tight font-['Rajdhani',sans-serif] uppercase">
                  Cryptographic Security & Infrastructure Safeguards
                </h2>
              </div>
              <p>
                VDAJ implements enterprise-grade technical and organizational controls to protect stored records and real-time transit streams:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <div className="text-[#0F172A] font-bold">HMAC-SHA256 Webhook Verification</div>
                  <p className="text-slate-600 font-sans">Every incoming Meta webhook is verified against the shared app secret before ingest. Unauthorized payloads are immediately rejected.</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <div className="text-[#0F172A] font-bold">AES-256 Storage & TLS 1.3 Transport</div>
                  <p className="text-slate-600 font-sans">All operational databases are protected with AES-256 at rest. All API interactions enforce TLS 1.3 transport security.</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <div className="text-[#0F172A] font-bold">Strict Tenant Isolation</div>
                  <p className="text-slate-600 font-sans">Each enterprise client is segmented by unique tenant identifiers. Cross-tenant data leakage is cryptographically and procedurally prevented.</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <div className="text-[#0F172A] font-bold">Role-Based Access Control (RBAC)</div>
                  <p className="text-slate-600 font-sans">Administrative operations are guarded by least-privilege RBAC schemas, automated session revocation, and security audit logs.</p>
                </div>
              </div>
            </section>

            <hr className="border-slate-200" />

            {/* Section 07 */}
            <section id="retention" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-[#534AB7] px-2.5 py-0.5 rounded bg-[#534AB7]/10 border border-[#534AB7]/30">
                  SECTION 07
                </span>
                <h2 className="text-2xl font-bold text-[#0F172A] tracking-tight font-['Rajdhani',sans-serif] uppercase">
                  Data Retention & Purge Lifecycle
                </h2>
              </div>
              <p>
                We enforce automated data retention lifecycles to prevent unnecessary long-term storage of communication logs:
              </p>
              <ul className="text-xs sm:text-sm text-slate-600 space-y-2 list-disc list-inside">
                <li><strong className="text-slate-900">Message Delivery Telemetry:</strong> Retained for a rolling period of 90 days for operational auditing and delivery analytics, after which message payloads are automatically purged.</li>
                <li><strong className="text-slate-900">Opt-Out & Suppression Index:</strong> Retained indefinitely in our secure suppression registry to strictly honor recipient refusal and prevent accidental future outreach.</li>
                <li><strong className="text-slate-900">Workspace Data Purge:</strong> When an enterprise client terminates service, all associated contact databases, templates, and logs are deleted within 30 days.</li>
              </ul>
            </section>

            <hr className="border-slate-200" />

            {/* Section 08 */}
            <section id="rights" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-[#534AB7] px-2.5 py-0.5 rounded bg-[#534AB7]/10 border border-[#534AB7]/30">
                  SECTION 08
                </span>
                <h2 className="text-2xl font-bold text-[#0F172A] tracking-tight font-['Rajdhani',sans-serif] uppercase">
                  Statutory Data Principal Rights (DPDP Act 2023 & GDPR)
                </h2>
              </div>
              <p>
                In accordance with applicable statutory frameworks, data principals (both business users and end-consumers) possess enforceable rights:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <div className="text-[#0F172A] font-bold">Right to Access</div>
                  <p className="text-slate-600 font-sans">Request confirmation and a summary of personal data currently retained within our platform infrastructure.</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <div className="text-[#0F172A] font-bold">Right to Correction</div>
                  <p className="text-slate-600 font-sans">Request the rectification or updating of inaccurate, outdated, or incomplete personal identifiers.</p>
                </div>
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <div className="text-[#0F172A] font-bold">Right to Erasure</div>
                  <p className="text-slate-600 font-sans">Request the complete deletion of personal records (&ldquo;Right to be Forgotten&rdquo;) as described in our Data Deletion policy.</p>
                </div>
              </div>
            </section>

            <hr className="border-slate-200" />

            {/* Section 09 */}
            <section id="grievance" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-[#534AB7] px-2.5 py-0.5 rounded bg-[#534AB7]/10 border border-[#534AB7]/30">
                  SECTION 09
                </span>
                <h2 className="text-2xl font-bold text-[#0F172A] tracking-tight font-['Rajdhani',sans-serif] uppercase">
                  Designated Grievance Officer & Statutory Contact
                </h2>
              </div>
              <p>
                Pursuant to Section 5 of the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021 and Section 12 of the Digital Personal Data Protection Act, 2023, VDAJ Services LLP has designated a Grievance Redressal Officer:
              </p>

              {/* Official Corporate Contact Card */}
              <div className="p-6 sm:p-8 rounded-lg bg-slate-50 border border-slate-200 space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-200">
                  <div className="w-10 h-10 rounded-lg bg-[#534AB7]/10 border border-[#534AB7]/30 flex items-center justify-center text-[#534AB7]">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-[#0F172A] font-bold text-base leading-tight uppercase font-['Rajdhani',sans-serif]">
                      VDAJ Services LLP — Grievance Redressal Cell
                    </h3>
                    <p className="text-xs text-slate-500">
                      Corporate Legal, Compliance & Information Security Division
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                  <div>
                    <span className="text-slate-500 block uppercase tracking-wider text-[10px]">Entity:</span>
                    <span className="text-slate-900 font-semibold">VDAJ Services LLP</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block uppercase tracking-wider text-[10px]">Official Grievance Email:</span>
                    <a href="mailto:info@vdajservices.com" className="text-[#534AB7] font-semibold hover:underline">
                      info@vdajservices.com
                    </a>
                  </div>
                  <div>
                    <span className="text-slate-500 block uppercase tracking-wider text-[10px]">Corporate Jurisdiction:</span>
                    <span className="text-slate-900 font-semibold">Maharashtra, Republic of India</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block uppercase tracking-wider text-[10px]">SLA Response Window:</span>
                    <span className="text-[#1D9E75] font-semibold">Acknowledgment within 24h · Resolution within 15 days</span>
                  </div>
                </div>
              </div>
            </section>

          </article>
        </div>
      </div>

      {/* MNC Website Executive Footer */}
      <PublicWebsiteFooter />
    </div>
  );
}
