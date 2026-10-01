/**
 * VDAJ Services LLP — Public Website Executive Footer
 * Colorlib Locksmith corporate footer aesthetic in deep navy (#090E1A / #0F172A).
 * Fully aligned with Meta guidelines and corporate governance.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import Logo from '../atoms/Logo';

export default function PublicWebsiteFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#090E1A] text-slate-400 font-sans border-t border-white/10 pt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8 pb-14 border-b border-white/10">
          
          {/* Brand & Corporate Entity (2 cols on lg) */}
          <div className="lg:col-span-2 space-y-4">
            <Link to="/" className="inline-block no-underline">
              <Logo size={34} variant="light" showWordmark={true} />
            </Link>
            <p className="text-[13.5px] leading-relaxed text-slate-400 max-w-sm">
              <strong className="text-white">VDAJ Services LLP</strong> is an official enterprise communication technology provider delivering direct Meta WhatsApp Business Cloud API automation, multi-agent workspaces, and mission-critical cloud software systems.
            </p>
            
            <ul className="space-y-2 text-xs text-slate-300 pt-2">
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[#AFA9EC] shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
                </svg>
                <span>Registered LLP in Maharashtra, India</span>
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[#AFA9EC] shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 4V3z"/>
                </svg>
                <span>Phone: +91 80077 73138</span>
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[#AFA9EC] shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
                </svg>
                <span>Email: info@vdajservices.com</span>
              </li>
            </ul>
          </div>

          {/* Solutions Column */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-4 relative pb-2 after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-8 after:h-0.5 after:bg-[#534AB7]">
              Platform
            </h4>
            <ul className="space-y-2.5 text-[13px]">
              <li>
                <a href="https://www.vdajservices.com/#whatsapp" className="hover:text-white transition-colors">
                  WhatsApp Cloud Platform
                </a>
              </li>
              <li>
                <a href="https://www.vdajservices.com/#services" className="hover:text-white transition-colors">
                  Multi-Agent Team Inbox
                </a>
              </li>
              <li>
                <a href="https://www.vdajservices.com/#services" className="hover:text-white transition-colors">
                  Broadcast Campaigns
                </a>
              </li>
              <li>
                <a href="https://www.vdajservices.com/#architecture" className="hover:text-white transition-colors">
                  High-Throughput Webhooks
                </a>
              </li>
              <li>
                <a href="https://www.vdajservices.com/#services" className="hover:text-white transition-colors">
                  Automated Consent Workflows
                </a>
              </li>
            </ul>
          </div>

          {/* Legal & Compliance Column */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-4 relative pb-2 after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-8 after:h-0.5 after:bg-[#534AB7]">
              Trust & Legal
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
                  Aligned with India DPDP Act 2023 & Meta Terms
                </span>
              </li>
            </ul>
          </div>

          {/* Corporate & Support Column */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-4 relative pb-2 after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-8 after:h-0.5 after:bg-[#534AB7]">
              Client Access
            </h4>
            <ul className="space-y-2.5 text-[13px]">
              <li>
                <Link to="/login" className="hover:text-white font-semibold text-[#AFA9EC] transition-colors">
                  Client Portal Login →
                </Link>
              </li>
              <li>
                <a href="https://www.vdajservices.com" className="hover:text-white transition-colors">
                  Corporate Website
                </a>
              </li>
              <li>
                <a href="mailto:info@vdajservices.com" className="hover:text-white transition-colors">
                  Contact Technical Desk
                </a>
              </li>
              <li className="pt-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold bg-[#1D9E75]/20 text-[#26C18E] border border-[#1D9E75]/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1D9E75]"></span>
                  Cloud SLA: 99.99% Uptime
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar with Meta Trademark & Legal Disclaimer */}
        <div className="py-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>
            © {currentYear} <strong>VDAJ Services LLP</strong>. All rights reserved. Registered Limited Liability Partnership in India.
          </p>
          <p className="text-center md:text-right text-[11px] text-slate-500 max-w-xl">
            WhatsApp and Meta are registered trademarks of Meta Platforms, Inc. VDAJ Services LLP operates independently as an authorized enterprise technology provider utilizing official Meta WhatsApp Business Cloud APIs.
          </p>
        </div>
      </div>
    </footer>
  );
}
