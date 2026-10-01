/**
 * VDAJ Services LLP — Enterprise Terms of Service
 * Route: /legal/terms & /terms (public, no auth required)
 * Compliant with Meta Platform Terms, WhatsApp Business Policies, and India Law.
 * Colorlib Locksmith corporate MNC architecture: crisp, high-trust light theme with VDAJ branding.
 */

import React, { useState, useEffect } from 'react';
import PublicWebsiteNavbar from '../components/organisms/PublicWebsiteNavbar';
import PublicWebsiteFooter from '../components/organisms/PublicWebsiteFooter';

const SECTIONS = [
  { id: 'agreement', title: '01. Binding Master Agreement' },
  { id: 'services', title: '02. Meta Cloud API Infrastructure' },
  { id: 'obligations', title: '03. Client Obligations & Acceptable Use' },
  { id: 'consent', title: '04. Mandatory Opt-In & STOP Compliance' },
  { id: 'security', title: '05. Account Credentials & Multi-Tenancy' },
  { id: 'sla', title: '06. Service Availability & 99.99% Cloud SLA' },
  { id: 'ip', title: '07. Intellectual Property & API Licensure' },
  { id: 'liability', title: '08. Indemnification & Limitation of Liability' },
  { id: 'governing-law', title: '09. Governing Law & Dispute Jurisdiction' },
];

export default function TermsOfServicePage() {
  const [activeSection, setActiveSection] = useState('agreement');

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
            <span className="text-[#534AB7] font-bold">Terms of Service</span>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#534AB7]/10 border border-[#534AB7]/30 text-[#534AB7] text-xs font-bold mb-4">
                <span className="w-2 h-2 rounded-full bg-[#534AB7]"></span>
                <span>Enterprise Master Services Agreement · Commercial Terms</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#0F172A] tracking-tight leading-tight uppercase font-['Rajdhani',sans-serif]">
                Enterprise <br />
                <span className="text-[#534AB7]">
                  Terms of Service
                </span>
              </h1>
              <p className="mt-4 text-slate-600 text-sm sm:text-base leading-relaxed">
                These Enterprise Terms of Service govern the provision, deployment, and operational consumption of enterprise communication infrastructures, Meta WhatsApp Cloud API gateways, and cloud software solutions provided by VDAJ Services LLP.
              </p>
            </div>

            {/* Document Metadata & Print Utility */}
            <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-3 shrink-0">
              <div className="text-xs font-mono text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 space-y-1 shadow-sm">
                <div><strong>Provider:</strong> VDAJ Services LLP</div>
                <div><strong>Effective Date:</strong> September 1, 2026</div>
                <div><strong>Governing Code:</strong> Indian Contract Act, 1872</div>
                <div><strong>Seat of Arbitration:</strong> Maharashtra, India</div>
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
                Legal & Contract Enquiries: <br />
                <a href="mailto:info@vdajservices.com" className="text-[#534AB7] font-semibold hover:underline font-mono">
                  info@vdajservices.com
                </a>
              </div>
            </div>
          </aside>

          {/* Right Column: Formal Legal Prose */}
          <article className="lg:col-span-8 xl:col-span-9 bg-white border border-slate-200 rounded-lg p-6 sm:p-10 lg:p-12 shadow-sm space-y-12 text-slate-700 text-sm sm:text-base leading-relaxed">
            
            {/* Section 01 */}
            <section id="agreement" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-[#534AB7] px-2.5 py-0.5 rounded bg-[#534AB7]/10 border border-[#534AB7]/30">
                  SECTION 01
                </span>
                <h2 className="text-2xl font-bold text-[#0F172A] tracking-tight font-['Rajdhani',sans-serif] uppercase">
                  Binding Master Agreement
                </h2>
              </div>
              <p>
                By establishing an enterprise workspace, accessing the VDAJ portal, connecting an official WhatsApp Business Account (WABA), or initiating API calls through our infrastructure, you (&ldquo;Client&rdquo;, &ldquo;Business Operator&rdquo;) enter into a legally binding contractual agreement with <strong>VDAJ Services LLP</strong> (&ldquo;VDAJ&rdquo;, &ldquo;Provider&rdquo;).
              </p>
              <p>
                If you are entering into this Agreement on behalf of a corporate entity, you represent and warrant that you possess full corporate authorization to bind that entity to these Terms.
              </p>
            </section>

            <hr className="border-slate-200" />

            {/* Section 02 */}
            <section id="services" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-[#534AB7] px-2.5 py-0.5 rounded bg-[#534AB7]/10 border border-[#534AB7]/30">
                  SECTION 02
                </span>
                <h2 className="text-2xl font-bold text-[#0F172A] tracking-tight font-['Rajdhani',sans-serif] uppercase">
                  Meta Cloud API Infrastructure & Intermediary Role
                </h2>
              </div>
              <p>
                VDAJ delivers cloud-hosted integration software connecting Client systems to the Meta WhatsApp Business Cloud API. Client acknowledges and agrees that:
              </p>
              <ul className="text-xs sm:text-sm text-slate-600 space-y-2 list-disc list-inside">
                <li>VDAJ operates as a technology infrastructure provider and technical intermediary under the Information Technology Act, 2000.</li>
                <li>WhatsApp messaging services depend on the operational status of Meta Platforms, Inc. systems and network telecommunications carriers.</li>
                <li>Client must independently comply with the <a href="https://www.whatsapp.com/legal/business-policy/" target="_blank" rel="noopener noreferrer" className="text-[#534AB7] font-semibold hover:underline">WhatsApp Business Policy</a> and <a href="https://developers.facebook.com/terms/" target="_blank" rel="noopener noreferrer" className="text-[#534AB7] font-semibold hover:underline">Meta Platform Terms</a>.</li>
              </ul>
            </section>

            <hr className="border-slate-200" />

            {/* Section 03 */}
            <section id="obligations" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-[#534AB7] px-2.5 py-0.5 rounded bg-[#534AB7]/10 border border-[#534AB7]/30">
                  SECTION 03
                </span>
                <h2 className="text-2xl font-bold text-[#0F172A] tracking-tight font-['Rajdhani',sans-serif] uppercase">
                  Client Obligations & Acceptable Messaging Rules
                </h2>
              </div>
              <p>
                Client agrees to maintain rigorous operational compliance when utilizing our broadcast and messaging infrastructure. Client shall NOT:
              </p>
              <div className="p-5 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs text-slate-600">
                <ul className="space-y-1.5 list-disc list-inside">
                  <li>Transmit unsolicited bulk messages (&ldquo;spam&rdquo;) or send to numbers obtained through scraping or third-party lead brokers.</li>
                  <li>Distribute content that is fraudulent, deceptive, harassing, defamatory, or in violation of intellectual property rights.</li>
                  <li>Promote prohibited goods or services as defined by Meta Commerce and WhatsApp policies (including narcotics, weapons, unauthorized gambling, or unapproved financial schemes).</li>
                  <li>Attempt to bypass rate limits, compromise tenant isolation, reverse-engineer proprietary algorithms, or conduct penetration tests without prior written consent.</li>
                </ul>
              </div>
            </section>

            <hr className="border-slate-200" />

            {/* Section 04 */}
            <section id="consent" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-[#534AB7] px-2.5 py-0.5 rounded bg-[#534AB7]/10 border border-[#534AB7]/30">
                  SECTION 04
                </span>
                <h2 className="text-2xl font-bold text-[#0F172A] tracking-tight font-['Rajdhani',sans-serif] uppercase">
                  Mandatory Opt-In & Automated STOP Compliance
                </h2>
              </div>
              <p>
                In strict adherence to the India Digital Personal Data Protection (DPDP) Act 2023:
              </p>
              <div className="space-y-3 text-sm">
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <strong className="text-[#0F172A]">Verifiable Consent Proof:</strong> Client is solely responsible for collecting, logging, and preserving verifiable opt-in records prior to adding any phone number to active audience lists.
                </div>
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <strong className="text-[#0F172A]">Non-Interference with Automated Opt-Out:</strong> Client shall not alter, disable, or circumvent the automated STOP keyword interceptor. Any attempt to re-message an opted-out recipient constitutes a material breach resulting in immediate workspace suspension.
                </div>
              </div>
            </section>

            <hr className="border-slate-200" />

            {/* Section 05 */}
            <section id="security" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-[#534AB7] px-2.5 py-0.5 rounded bg-[#534AB7]/10 border border-[#534AB7]/30">
                  SECTION 05
                </span>
                <h2 className="text-2xl font-bold text-[#0F172A] tracking-tight font-['Rajdhani',sans-serif] uppercase">
                  Account Credentials & Multi-Tenant Security
                </h2>
              </div>
              <p>
                Client is exclusively responsible for maintaining the confidentiality of administrative credentials, bearer tokens, and webhook secrets. Client must immediately report any suspected credential compromise to <a href="mailto:info@vdajservices.com" className="text-[#534AB7] font-semibold hover:underline font-mono">info@vdajservices.com</a>.
              </p>
            </section>

            <hr className="border-slate-200" />

            {/* Section 06 */}
            <section id="sla" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-[#534AB7] px-2.5 py-0.5 rounded bg-[#534AB7]/10 border border-[#534AB7]/30">
                  SECTION 06
                </span>
                <h2 className="text-2xl font-bold text-[#0F172A] tracking-tight font-['Rajdhani',sans-serif] uppercase">
                  Service Availability & 99.99% Cloud SLA
                </h2>
              </div>
              <p>
                VDAJ targets a <strong>99.99% Cloud Service Level Objective (SLO)</strong> for core API gateways and message queue workers. Scheduled maintenance windows are communicated at least 48 hours in advance. Unplanned network carrier disruptions on Meta or telecom tier-1 carriers are excluded from downtime calculations.
              </p>
            </section>

            <hr className="border-slate-200" />

            {/* Section 07 */}
            <section id="ip" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-[#534AB7] px-2.5 py-0.5 rounded bg-[#534AB7]/10 border border-[#534AB7]/30">
                  SECTION 07
                </span>
                <h2 className="text-2xl font-bold text-[#0F172A] tracking-tight font-['Rajdhani',sans-serif] uppercase">
                  Intellectual Property & API Licensure
                </h2>
              </div>
              <p>
                VDAJ retains all right, title, and interest in and to the platform codebase, distributed queue architecture, user interfaces, documentation, and trademarks. Client receives a limited, non-exclusive, revocable, non-transferable license to access the platform during the active subscription term.
              </p>
            </section>

            <hr className="border-slate-200" />

            {/* Section 08 */}
            <section id="liability" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-[#534AB7] px-2.5 py-0.5 rounded bg-[#534AB7]/10 border border-[#534AB7]/30">
                  SECTION 08
                </span>
                <h2 className="text-2xl font-bold text-[#0F172A] tracking-tight font-['Rajdhani',sans-serif] uppercase">
                  Indemnification & Limitation of Liability
                </h2>
              </div>
              <p>
                To the maximum extent permitted by applicable law, VDAJ shall not be liable for indirect, incidental, punitive, or consequential damages resulting from message delivery latency, carrier filter rejections, or account suspensions imposed by Meta for Client policy violations. Total aggregate liability is limited to fees paid by Client in the three (3) months preceding the claim.
              </p>
            </section>

            <hr className="border-slate-200" />

            {/* Section 09 */}
            <section id="governing-law" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-[#534AB7] px-2.5 py-0.5 rounded bg-[#534AB7]/10 border border-[#534AB7]/30">
                  SECTION 09
                </span>
                <h2 className="text-2xl font-bold text-[#0F172A] tracking-tight font-['Rajdhani',sans-serif] uppercase">
                  Governing Law & Dispute Jurisdiction
                </h2>
              </div>
              <p>
                This Agreement is governed by and construed in accordance with the laws of the Republic of India. Any dispute arising out of or in connection with this Agreement shall be resolved through arbitration under the Arbitration and Conciliation Act, 1996 in Maharashtra, India.
              </p>
            </section>

          </article>
        </div>
      </div>

      {/* MNC Website Executive Footer */}
      <PublicWebsiteFooter />
    </div>
  );
}
