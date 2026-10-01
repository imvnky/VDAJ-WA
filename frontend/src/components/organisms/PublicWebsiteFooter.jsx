/**
 * VDAJ Services LLP — Public Website Executive Footer
 * Shared MNC-grade footer matching corporate governance and Meta guidelines.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import Logo from '../atoms/Logo';

export default function PublicWebsiteFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#050508] border-t border-white/[0.08] text-slate-400 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8 mb-12">
          
          {/* Brand & Corporate Entity (2 cols on lg) */}
          <div className="lg:col-span-2 space-y-4">
            <Link to="/" className="inline-block no-underline">
              <Logo size={34} variant="light" showWordmark={true} />
            </Link>
            <p className="text-[13.5px] leading-relaxed text-slate-400 max-w-sm">
              <strong className="text-slate-200">VDAJ Services LLP</strong> is an official enterprise communication technology provider delivering direct Meta WhatsApp Business Cloud API automation, multi-agent workspaces, and mission-critical cloud software systems.
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-500 pt-1">
              <span className="inline-block w-2 h-2 rounded-full bg-[#1D9E75] shadow-[0_0_8px_#1D9E75]"></span>
              <span>Registered Limited Liability Partnership · Maharashtra, India</span>
            </div>
          </div>

          {/* Solutions Column */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-4">
              Enterprise Solutions
            </h4>
            <ul className="space-y-2.5 text-[13px]">
              <li>
                <a href="https://www.vdajservices.com/#whatsapp" className="hover:text-white transition-colors">
                  WhatsApp Cloud Platform
                </a>
              </li>
              <li>
                <a href="https://www.vdajservices.com/#it-solutions" className="hover:text-white transition-colors">
                  Custom Cloud Engineering
                </a>
              </li>
              <li>
                <a href="https://www.vdajservices.com/#architecture" className="hover:text-white transition-colors">
                  High-Throughput Webhooks
                </a>
              </li>
              <li>
                <a href="https://www.vdajservices.com/#compliance" className="hover:text-white transition-colors">
                  Automated Consent Workflows
                </a>
              </li>
              <li>
                <a href="https://www.vdajservices.com/#features" className="hover:text-white transition-colors">
                  Multi-Agent Team Inbox
                </a>
              </li>
            </ul>
          </div>

          {/* Legal & Compliance Column */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-4">
              Trust & Compliance
            </h4>
            <ul className="space-y-2.5 text-[13px]">
              <li>
                <Link to="/legal/privacy" className="hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/legal/terms" className="hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/legal/data-deletion" className="hover:text-white transition-colors">
                  User Data Deletion
                </Link>
              </li>
              <li>
                <span className="text-xs text-slate-500 block pt-1">
                  Aligned with India DPDP Act 2023 & Meta Platform Policies
                </span>
              </li>
            </ul>
          </div>

          {/* Corporate & Support Column */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-4">
              Corporate & Governance
            </h4>
            <ul className="space-y-2.5 text-[13px]">
              <li>
                <a href="mailto:info@vdajservices.com" className="hover:text-white transition-colors">
                  info@vdajservices.com
                </a>
              </li>
              <li>
                <a href="https://www.vdajservices.com" className="hover:text-white transition-colors">
                  Corporate Website
                </a>
              </li>
              <li>
                <Link to="/login" className="hover:text-white transition-colors">
                  Client Portal Login
                </Link>
              </li>
              <li className="pt-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#1D9E75]/10 text-[#26C18E] border border-[#1D9E75]/25">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1D9E75]"></span>
                  Cloud Uptime: 99.99% SLA
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar with Meta Trademark & Legal Disclaimer */}
        <div className="pt-8 border-t border-white/[0.06] flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>
            © {currentYear} VDAJ Services LLP. All rights reserved.
          </p>
          <p className="text-center md:text-right text-[11px] text-slate-600 max-w-xl">
            WhatsApp and Meta are registered trademarks of Meta Platforms, Inc. VDAJ Services LLP operates independently as an authorized enterprise technology provider utilizing official Meta WhatsApp Business Cloud APIs.
          </p>
        </div>
      </div>
    </footer>
  );
}
