'use client';

import React from 'react';
import Link from 'next/link';
import { useTheme } from './ThemeProvider';
import SocialDock from './SocialDock';

const Footer: React.FC = () => {
  const { theme } = useTheme();

  return (
    <footer className="py-20 border-t border-[var(--glass-border)] bg-[var(--footer-bg)] relative overflow-hidden transition-colors duration-300">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,var(--accent-glow)_0%,transparent_50%)]" />
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-center gap-12">
          <Link
            href="/"
            className="flex items-center gap-3 no-underline group cursor-pointer"
          >
            {theme === 'dark' ? (
              <svg className="w-10 h-10" viewBox="0 0 48 48" fill="none">
                <defs>
                  <linearGradient id="logo-grad-footer" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#2563EB"></stop>
                    <stop offset="100%" stopColor="#06B6D4"></stop>
                  </linearGradient>
                </defs>
                <path d="M4 36L20 24L4 12L4 20L12 24L4 28L4 36Z" fill="#2563EB"></path>
                <path d="M12 36L28 24L12 12L12 18L18 24L12 30L12 36Z" fill="url(#logo-grad-footer)"></path>
                <path d="M20 36L44 24L20 12L20 18L32 24L20 30L20 36Z" fill="#06B6D4"></path>
              </svg>
            ) : (
              <img
                src="/logos/icon-light.svg"
                alt="Nexli"
                className="w-10 h-10"
              />
            )}
            <span className="text-3xl font-black tracking-tighter text-[var(--text-main)]" style={{ fontFamily: "'Syne', sans-serif" }}>NEXLI</span>
          </Link>
          <SocialDock
            instagramUrl="https://www.instagram.com/nexliautomation"
          />
          <div className="flex gap-10 text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.2em]">
            <Link
              href="/blog"
              className="hover:text-blue-500 transition-colors uppercase tracking-[0.2em]"
            >
              Blog
            </Link>
            <Link
              href="/privacy"
              className="hover:text-blue-500 transition-colors uppercase tracking-[0.2em]"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="hover:text-blue-500 transition-colors uppercase tracking-[0.2em]"
            >
              Terms and Conditions
            </Link>
            <div className="text-green-500/50 flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
              A2P COMPLIANT
            </div>
          </div>
          <div className="text-[var(--text-muted)] text-[10px] font-black uppercase tracking-[0.2em]">
            © 2026 Nexli Automation LLC. High-End Automation for Elite Advisors.
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
