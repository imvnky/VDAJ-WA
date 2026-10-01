/**
 * VDAJ Services LLP — Public Website Executive Navigation Bar
 * Shared MNC-grade header across vdajservices.com and public legal portals.
 * Strictly decoupled from app internal routes.
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
    <header className="sticky top-0 z-50 bg-[#08080C]/90 backdrop-blur-xl border-b border-white/[0.08] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-6">
        
        {/* Brand Logo Lockup */}
        <Link to="/" className="flex items-center gap-3 no-underline group">
          <Logo size={36} variant="light" showWordmark={true} />
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-7 text-[13.5px] font-medium tracking-wide">
          <a
            href="https://www.vdajservices.com/#whatsapp"
            className="text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
          >
            <span>WhatsApp Platform</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-[#1D9E75]/15 text-[#26C18E] border border-[#1D9E75]/30">
              Meta Live
            </span>
          </a>
          <a
            href="https://www.vdajservices.com/#it-solutions"
            className="text-slate-300 hover:text-white transition-colors"
          >
            IT Solutions
          </a>
          <a
            href="https://www.vdajservices.com/#architecture"
            className="text-slate-300 hover:text-white transition-colors"
          >
            Architecture
          </a>
          <a
            href="https://www.vdajservices.com/#compliance"
            className="text-slate-300 hover:text-white transition-colors"
          >
            Compliance
          </a>
          <Link
            to="/legal/privacy"
            className={`transition-colors ${
              isPrivacy ? 'text-white font-semibold' : 'text-slate-300 hover:text-white'
            }`}
          >
            Privacy
          </Link>
          <Link
            to="/legal/terms"
            className={`transition-colors ${
              isTerms ? 'text-white font-semibold' : 'text-slate-300 hover:text-white'
            }`}
          >
            Terms
          </Link>
        </nav>

        {/* Desktop Action CTAs */}
        <div className="hidden sm:flex items-center gap-3">
          <a
            href="mailto:info@vdajservices.com"
            className="text-[13px] font-medium text-slate-300 hover:text-white px-3.5 py-2 rounded-lg border border-white/[0.08] hover:border-white/[0.2] bg-white/[0.03] transition-all"
          >
            Contact Sales
          </a>
          <Link
            to={isAuthenticated ? '/dashboard' : '/login'}
            className="inline-flex items-center gap-2 text-[13px] font-semibold text-white px-4 py-2 rounded-lg bg-gradient-to-r from-[#534AB7] to-[#3B3499] hover:from-[#5E54CE] hover:to-[#4338CA] border border-[#AFA9EC]/30 shadow-[0_2px_14px_rgba(83,74,183,0.35)] hover:shadow-[0_4px_20px_rgba(83,74,183,0.55)] transition-all"
          >
            <span>{isAuthenticated ? 'Enter Portal' : 'Client Portal'}</span>
            <span className="text-white/80">→</span>
          </Link>
        </div>

        {/* Mobile Hamburger Toggle */}
        <div className="flex sm:hidden items-center gap-2">
          <Link
            to={isAuthenticated ? '/dashboard' : '/login'}
            className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg bg-[#534AB7]"
          >
            Portal
          </Link>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05]"
            aria-label="Toggle Navigation"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
        <div className="lg:hidden border-t border-white/[0.08] bg-[#0B0B12]/98 px-5 py-4 space-y-3">
          <a
            href="https://www.vdajservices.com/#whatsapp"
            className="block text-sm text-slate-300 hover:text-white py-1.5"
            onClick={() => setMobileMenuOpen(false)}
          >
            WhatsApp Platform
          </a>
          <a
            href="https://www.vdajservices.com/#it-solutions"
            className="block text-sm text-slate-300 hover:text-white py-1.5"
            onClick={() => setMobileMenuOpen(false)}
          >
            IT Solutions
          </a>
          <a
            href="https://www.vdajservices.com/#architecture"
            className="block text-sm text-slate-300 hover:text-white py-1.5"
            onClick={() => setMobileMenuOpen(false)}
          >
            Architecture
          </a>
          <a
            href="https://www.vdajservices.com/#compliance"
            className="block text-sm text-slate-300 hover:text-white py-1.5"
            onClick={() => setMobileMenuOpen(false)}
          >
            Compliance
          </a>
          <Link
            to="/legal/privacy"
            className={`block text-sm py-1.5 ${isPrivacy ? 'text-white font-semibold' : 'text-slate-300'}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            Privacy Policy
          </Link>
          <Link
            to="/legal/terms"
            className={`block text-sm py-1.5 ${isTerms ? 'text-white font-semibold' : 'text-slate-300'}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            Terms of Service
          </Link>
          <Link
            to="/legal/data-deletion"
            className={`block text-sm py-1.5 ${isDeletion ? 'text-white font-semibold' : 'text-slate-300'}`}
            onClick={() => setMobileMenuOpen(false)}
          >
            Data Deletion Instructions
          </Link>
          <div className="pt-2 border-t border-white/[0.06]">
            <a
              href="mailto:info@vdajservices.com"
              className="block text-center text-xs font-medium text-slate-300 py-2 rounded-lg bg-white/[0.05]"
            >
              Contact Sales (info@vdajservices.com)
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
