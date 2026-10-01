/**
 * VDAJ Services LLP — Enterprise Terms of Service
 * Route: /legal/terms & /terms (public, no auth required)
 * Compliant with Meta Platform Terms, WhatsApp Business Policies, and India Law.
 * Crafted with Impeccable & Taste standards: high-contrast, editorial typography, zero-slop layout.
 */

import React, { useState, useEffect } from 'react';
import PublicWebsiteNavbar from '../components/organisms/PublicWebsiteNavbar';
import PublicWebsiteFooter from '../components/organisms/PublicWebsiteFooter';

const SECTIONS = [
  { id: 'agreement', num: '01', title: 'Binding Master Agreement' },
  { id: 'services', num: '02', title: 'Meta Cloud API Infrastructure' },
  { id: 'obligations', num: '03', title: 'Client Obligations & Use Rules' },
  { id: 'consent', num: '04', title: 'Opt-In & STOP Compliance' },
  { id: 'security', num: '05', title: 'Credentials & Multi-Tenancy' },
  { id: 'sla', num: '06', title: 'Service Availability & 99.99% SLA' },
  { id: 'ip', num: '07', title: 'Intellectual Property & Licensure' },
  { id: 'liability', num: '08', title: 'Indemnification & Liability' },
  { id: 'governing-law', num: '09', title: 'Governing Law & Jurisdiction' },
];

export default function TermsOfServicePage() {
  const [activeSection, setActiveSection] = useState('agreement');

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
            <span className="text-[#534AB7] font-semibold">Terms of Service</span>
          </nav>

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#534AB7]/10 border border-[#534AB7]/25 text-[#534AB7] text-xs font-semibold mb-4">
                <span className="w-2 h-2 rounded-full bg-[#534AB7]"></span>
                <span>Enterprise Master Services Agreement · Commercial Terms</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
                Enterprise <br />
                <span className="text-[#534AB7]">Terms of Service</span>
              </h1>
              <p className="mt-4 text-slate-600 text-base leading-relaxed max-w-2xl">
                These Enterprise Terms of Service govern the provision, deployment, and operational consumption of enterprise communication infrastructures, Meta WhatsApp Cloud API gateways, and cloud software solutions provided by VDAJ Services LLP.
              </p>
            </div>

            {/* Document Metadata & Print Utility */}
            <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-3 shrink-0">
              <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-3 space-y-1">
                <div><span className="text-slate-400 font-medium">Provider:</span> <strong className="text-slate-800">VDAJ Services LLP</strong></div>
                <div><span className="text-slate-400 font-medium">Effective Date:</span> <strong className="text-slate-800">September 1, 2026</strong></div>
                <div><span className="text-slate-400 font-medium">Governing Code:</span> <strong className="text-slate-800">Indian Contract Act, 1872</strong></div>
                <div><span className="text-slate-400 font-medium">Arbitration Seat:</span> <strong className="text-slate-800">Maharashtra, India</strong></div>
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
                  Clauses Overview
                </span>
                <span className="text-[11px] font-semibold text-[#534AB7] bg-[#534AB7]/10 px-2 py-0.5 rounded-full">
                  9 Articles
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
                Legal & Contract Enquiries: <br />
                <a href="mailto:info@vdajservices.com" className="text-[#534AB7] font-semibold hover:underline">
                  info@vdajservices.com
                </a>
              </div>
            </div>
          </aside>

          {/* Right Column: Formal Legal Charter */}
          <article className="lg:col-span-8 xl:col-span-9 bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-10 lg:p-14 shadow-xs space-y-12">
            
            {/* Section 01 */}
            <section id="agreement" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-semibold text-[#534AB7] px-2.5 py-0.5 rounded-md bg-[#534AB7]/10 border border-[#534AB7]/20">
                  SECTION 01
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Binding Master Agreement
                </h2>
              </div>
              <p className="text-[15px] text-slate-600 leading-relaxed">
                By establishing an enterprise workspace, accessing the VDAJ portal, connecting an official WhatsApp Business Account (WABA), or initiating API calls through our infrastructure, you (&ldquo;Client&rdquo;, &ldquo;Business Operator&rdquo;) enter into a legally binding contractual agreement with <strong className="text-slate-900">VDAJ Services LLP</strong> (&ldquo;VDAJ&rdquo;, &ldquo;Provider&rdquo;).
              </p>
              <p className="text-[15px] text-slate-600 leading-relaxed">
                If you are entering into this Agreement on behalf of a corporate entity, you represent and warrant that you possess full corporate authorization to bind that entity to these Terms.
              </p>
            </section>

            <hr className="border-slate-100" />

            {/* Section 02 */}
            <section id="services" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-semibold text-[#534AB7] px-2.5 py-0.5 rounded-md bg-[#534AB7]/10 border border-[#534AB7]/20">
                  SECTION 02
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Meta Cloud API Infrastructure & Intermediary Role
                </h2>
              </div>
              <p className="text-[15px] text-slate-600 leading-relaxed">
                VDAJ delivers cloud-hosted integration software connecting Client systems to the Meta WhatsApp Business Cloud API. Client acknowledges and agrees that:
              </p>
              <ul className="text-xs sm:text-sm text-slate-600 space-y-2 list-disc list-inside leading-relaxed">
                <li>VDAJ operates as a technology infrastructure provider and technical intermediary under the Information Technology Act, 2000.</li>
                <li>WhatsApp messaging services depend on the operational status of Meta Platforms, Inc. systems and network telecommunications carriers.</li>
                <li>Client must independently comply with the <a href="https://www.whatsapp.com/legal/business-policy/" target="_blank" rel="noopener noreferrer" className="text-[#534AB7] font-semibold hover:underline">WhatsApp Business Policy</a> and <a href="https://developers.facebook.com/terms/" target="_blank" rel="noopener noreferrer" className="text-[#534AB7] font-semibold hover:underline">Meta Platform Terms</a>.</li>
              </ul>
            </section>

            <hr className="border-slate-100" />

            {/* Section 03 */}
            <section id="obligations" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-semibold text-[#534AB7] px-2.5 py-0.5 rounded-md bg-[#534AB7]/10 border border-[#534AB7]/20">
                  SECTION 03
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Client Obligations & Acceptable Messaging Rules
                </h2>
              </div>
              <p className="text-[15px] text-slate-600 leading-relaxed">
                Client agrees to maintain rigorous operational compliance when utilizing our broadcast and messaging infrastructure. Client shall NOT:
              </p>
              <div className="p-5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs text-slate-600">
                <ul className="space-y-1.5 list-disc list-inside leading-relaxed">
                  <li>Transmit unsolicited bulk messages (&ldquo;spam&rdquo;) or send to numbers obtained through scraping or third-party lead brokers.</li>
                  <li>Distribute content that is fraudulent, deceptive, harassing, defamatory, or in violation of intellectual property rights.</li>
                  <li>Promote prohibited goods or services as defined by Meta Commerce and WhatsApp policies (including narcotics, weapons, unauthorized gambling, or unapproved financial schemes).</li>
                  <li>Attempt to bypass rate limits, compromise tenant isolation, reverse-engineer proprietary algorithms, or conduct penetration tests without prior written consent.</li>
                </ul>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* Section 04 */}
            <section id="consent" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-semibold text-[#534AB7] px-2.5 py-0.5 rounded-md bg-[#534AB7]/10 border border-[#534AB7]/20">
                  SECTION 04
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Mandatory Opt-In & Automated STOP Compliance
                </h2>
              </div>
              <p className="text-[15px] text-slate-600 leading-relaxed">
                In strict adherence to the India Digital Personal Data Protection (DPDP) Act 2023:
              </p>
              <div className="space-y-3.5 text-sm">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                  <strong className="text-slate-900">Verifiable Consent Proof:</strong> Client is solely responsible for collecting, logging, and preserving verifiable opt-in records prior to adding any phone number to active audience lists.
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                  <strong className="text-slate-900">Non-Interference with Automated Opt-Out:</strong> Client shall not alter, disable, or circumvent the automated STOP keyword interceptor. Any attempt to re-message an opted-out recipient constitutes a material breach resulting in immediate workspace suspension.
                </div>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* Section 05 */}
            <section id="security" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-semibold text-[#534AB7] px-2.5 py-0.5 rounded-md bg-[#534AB7]/10 border border-[#534AB7]/20">
                  SECTION 05
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Account Credentials & Multi-Tenant Security
                </h2>
              </div>
              <p className="text-[15px] text-slate-600 leading-relaxed">
                Client is exclusively responsible for maintaining the confidentiality of administrative credentials, bearer tokens, and webhook secrets. Client must immediately report any suspected credential compromise to <a href="mailto:info@vdajservices.com" className="text-[#534AB7] font-semibold hover:underline">info@vdajservices.com</a>.
              </p>
            </section>

            <hr className="border-slate-100" />

            {/* Section 06 */}
            <section id="sla" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-semibold text-[#534AB7] px-2.5 py-0.5 rounded-md bg-[#534AB7]/10 border border-[#534AB7]/20">
                  SECTION 06
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Service Availability & 99.99% Cloud SLA
                </h2>
              </div>
              <p className="text-[15px] text-slate-600 leading-relaxed">
                VDAJ targets a <strong className="text-slate-900">99.99% Cloud Service Level Objective (SLO)</strong> for core API gateways and message queue workers. Scheduled maintenance windows are communicated at least 48 hours in advance. Unplanned network carrier disruptions on Meta or telecom tier-1 carriers are excluded from downtime calculations.
              </p>
            </section>

            <hr className="border-slate-100" />

            {/* Section 07 */}
            <section id="ip" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-semibold text-[#534AB7] px-2.5 py-0.5 rounded-md bg-[#534AB7]/10 border border-[#534AB7]/20">
                  SECTION 07
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Intellectual Property & API Licensure
                </h2>
              </div>
              <p className="text-[15px] text-slate-600 leading-relaxed">
                VDAJ retains all right, title, and interest in and to the platform codebase, distributed queue architecture, user interfaces, documentation, and trademarks. Client receives a limited, non-exclusive, revocable, non-transferable license to access the platform during the active subscription term.
              </p>
            </section>

            <hr className="border-slate-100" />

            {/* Section 08 */}
            <section id="liability" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-semibold text-[#534AB7] px-2.5 py-0.5 rounded-md bg-[#534AB7]/10 border border-[#534AB7]/20">
                  SECTION 08
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Indemnification & Limitation of Liability
                </h2>
              </div>
              <p className="text-[15px] text-slate-600 leading-relaxed">
                To the maximum extent permitted by applicable law, VDAJ shall not be liable for indirect, incidental, punitive, or consequential damages resulting from message delivery latency, carrier filter rejections, or account suspensions imposed by Meta for Client policy violations. Total aggregate liability is limited to fees paid by Client in the three (3) months preceding the claim.
              </p>
            </section>

            <hr className="border-slate-100" />

            {/* Section 09 */}
            <section id="governing-law" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-semibold text-[#534AB7] px-2.5 py-0.5 rounded-md bg-[#534AB7]/10 border border-[#534AB7]/20">
                  SECTION 09
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Governing Law & Dispute Jurisdiction
                </h2>
              </div>
              <p className="text-[15px] text-slate-600 leading-relaxed">
                This Agreement is governed by and construed in accordance with the laws of the Republic of India. Any dispute arising out of or in connection with this Agreement shall be resolved through arbitration under the Arbitration and Conciliation Act, 1996 in Maharashtra, India.
              </p>
            </section>

          </article>
        </div>
      </div>

      {/* Executive Footer */}
      <PublicWebsiteFooter />
    </div>
  );
}
