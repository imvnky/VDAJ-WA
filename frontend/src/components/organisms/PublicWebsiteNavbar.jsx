/**
 * VDAJ Services LLP — Public Website Executive Navigation Bar
 * Colorlib Locksmith corporate aesthetic with VDAJ Services LLP branding.
 * Top utility contact bar + pristine white navbar with brand colors.
 */

import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Logo from '../atoms/Logo';
import useAuthStore from '../../store/authStore';

export default function PublicWebsiteNavbar() {
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isPrivacy = location.pathname.includes('/privacy');
  const isTerms = location.pathname.includes('/terms');
  const isDeletion = location.pathname.includes('/data-deletion');

  return (
    <div className="w-full">
      {/* Top Utility Bar (Locksmith Style Contact Strip) */}
      <div className="bg-[#0F172A] text-slate-300 text-xs py-2 border-b border-white/10 hidden sm:block font-sans">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <a
              href="tel:+918007773138"
              className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
            >
              <svg className="w-3.5 h-3.5 text-[#AFA9EC]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2a1 1 0 011.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.24.2 2.45.57 3.57a1 1 0 01-.24 1.02l-2.21 2.2z"/>
              </svg>
              <span>Hotline: +91 80077 73138</span>
            </a>
            <a
              href="mailto:info@vdajservices.com"
              className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
            >
              <svg className="w-3.5 h-3.5 text-[#AFA9EC]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
              </svg>
              <span>info@vdajservices.com</span>
            </a>
            <span className="inline-flex items-center gap-1.5 text-slate-400">
              <svg className="w-3.5 h-3.5 text-[#AFA9EC]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
              <span>Maharashtra, India</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#1D9E75]/20 text-[#26C18E] font-semibold border border-[#1D9E75]/35 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1D9E75]"></span>
              Official Meta Tech Provider
            </span>
            <span className="text-slate-500">|</span>
            <span className="text-[11px] text-slate-400">DPDP Act 2023 Compliant</span>
          </div>
        </div>
      </div>

      {/* Main Executive White Navbar */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-6">
          
          {/* Brand Logo Lockup */}
          <Link to="/" className="flex items-center gap-3 no-underline group">
            <Logo size={36} variant="dark" showWordmark={true} />
          </Link>

          {/* Desktop Navigation Links (Locksmith Bold Uppercase Typography) */}
          <nav className="hidden lg:flex items-center gap-7 text-[14px] font-bold uppercase tracking-wider text-slate-800">
            <a
              href="https://www.vdajservices.com/#whatsapp"
              className="text-slate-700 hover:text-[#534AB7] transition-colors flex items-center gap-1.5 py-1 relative group"
            >
              <span>WhatsApp Platform</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#1D9E75]/10 text-[#1D9E75] border border-[#1D9E75]/20">
                Meta Live
              </span>
            </a>
            <a
              href="https://www.vdajservices.com/#services"
              className="text-slate-700 hover:text-[#534AB7] transition-colors py-1"
            >
              Services
            </a>
            <a
              href="https://www.vdajservices.com/#architecture"
              className="text-slate-700 hover:text-[#534AB7] transition-colors py-1"
            >
              Architecture
            </a>
            <a
              href="https://www.vdajservices.com/#governance"
              className="text-slate-700 hover:text-[#534AB7] transition-colors py-1"
            >
              About LLP
            </a>
            <Link
              to="/legal/privacy"
              className={`py-1 transition-colors relative ${
                isPrivacy
                  ? 'text-[#534AB7] font-extrabold after:content-[""] after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-[#534AB7]'
                  : 'text-slate-700 hover:text-[#534AB7]'
              }`}
            >
              Privacy Policy
            </Link>
            <Link
              to="/legal/terms"
              className={`py-1 transition-colors relative ${
                isTerms
                  ? 'text-[#534AB7] font-extrabold after:content-[""] after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-[#534AB7]'
                  : 'text-slate-700 hover:text-[#534AB7]'
              }`}
            >
              Terms
            </Link>
          </nav>

          {/* Desktop Action CTAs */}
          <div className="hidden sm:flex items-center gap-3">
            <a
              href="mailto:info@vdajservices.com"
              className="text-[13px] font-bold uppercase tracking-wider text-slate-700 hover:text-[#534AB7] px-3.5 py-2 rounded border border-slate-300 hover:border-[#534AB7] hover:bg-[#534AB7]/5 transition-all"
            >
              Contact Sales
            </a>
            <Link
              to={isAuthenticated ? '/dashboard' : '/login'}
              className="inline-flex items-center gap-2 text-[13px] font-bold uppercase tracking-wider text-white px-4 py-2 rounded bg-[#534AB7] hover:bg-[#4338CA] shadow-[0_4px_12px_rgba(83,74,183,0.25)] hover:shadow-[0_6px_18px_rgba(83,74,183,0.35)] transition-all"
            >
              <span>{isAuthenticated ? 'Enter Portal' : 'Client Portal'}</span>
              <span className="text-white/90">→</span>
            </Link>
          </div>

          {/* Mobile Hamburger Toggle */}
          <div className="flex lg:hidden items-center gap-2">
            <Link
              to={isAuthenticated ? '/dashboard' : '/login'}
              className="text-xs font-bold uppercase text-white px-3 py-1.5 rounded bg-[#534AB7]"
            >
              Portal
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded text-slate-700 hover:text-[#534AB7] hover:bg-slate-100"
              aria-label="Toggle Navigation"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 bg-white px-5 py-4 space-y-3 font-bold uppercase text-sm">
            <a
              href="https://www.vdajservices.com/#whatsapp"
              className="block text-slate-700 hover:text-[#534AB7] py-1.5"
              onClick={() => setMobileMenuOpen(false)}
            >
              WhatsApp Platform
            </a>
            <a
              href="https://www.vdajservices.com/#services"
              className="block text-slate-700 hover:text-[#534AB7] py-1.5"
              onClick={() => setMobileMenuOpen(false)}
            >
              Services
            </a>
            <a
              href="https://www.vdajservices.com/#architecture"
              className="block text-slate-700 hover:text-[#534AB7] py-1.5"
              onClick={() => setMobileMenuOpen(false)}
            >
              Architecture
            </a>
            <a
              href="https://www.vdajservices.com/#governance"
              className="block text-slate-700 hover:text-[#534AB7] py-1.5"
              onClick={() => setMobileMenuOpen(false)}
            >
              About LLP
            </a>
            <Link
              to="/legal/privacy"
              className={`block py-1.5 ${isPrivacy ? 'text-[#534AB7]' : 'text-slate-700 hover:text-[#534AB7]'}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Privacy Policy
            </Link>
            <Link
              to="/legal/terms"
              className={`block py-1.5 ${isTerms ? 'text-[#534AB7]' : 'text-slate-700 hover:text-[#534AB7]'}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Terms of Service
            </Link>
            <Link
              to="/legal/data-deletion"
              className={`block py-1.5 ${isDeletion ? 'text-[#534AB7]' : 'text-slate-700 hover:text-[#534AB7]'}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Data Deletion Instructions
            </Link>
            <div className="pt-2 border-t border-slate-200">
              <a
                href="mailto:info@vdajservices.com"
                className="block text-center text-xs font-bold uppercase text-slate-700 py-2 rounded bg-slate-100"
              >
                Contact Sales (info@vdajservices.com)
              </a>
            </div>
          </div>
        )}
      </header>
    </div>
  );
}
