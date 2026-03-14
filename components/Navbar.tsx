'use client';

import React, { useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ChevronRight, Sun, Moon, Mail, Check } from 'lucide-react';
import { useTheme } from './ThemeProvider';

const VIEW_TO_PATH: Record<string, string> = {
  home: '/',
  portfolio: '/portfolio',
  services: '/rainmaker',
  blog: '/blog',
  guide: '/free-guide',
  aiAutomations: '/ai-automations',
  smartReviews: '/smart-reviews',
  documentPortal: '/document-portal',
  privacy: '/privacy',
  terms: '/terms',
};

const PATH_TO_VIEW: Record<string, string> = Object.fromEntries(
  Object.entries(VIEW_TO_PATH).map(([k, v]) => [v, k])
);

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  // Derive currentView from pathname
  const currentView = PATH_TO_VIEW[pathname] || 'home';

  const handleEmailClick = useCallback(() => {
    navigator.clipboard.writeText('mail@nexli.net');
    window.location.href = 'mailto:mail@nexli.net';
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 2000);
  }, []);

  const navLinks: { label: string; view: string; hasGoogleIcon?: boolean }[] = [
    { label: 'Rainmaker™', view: 'services' },
    { label: 'Portfolio', view: 'portfolio' },
    { label: 'AI Automations', view: 'aiAutomations' },
    { label: 'Doc Portal', view: 'documentPortal' },
    { label: 'Google Reviews', view: 'smartReviews', hasGoogleIcon: true },
    { label: 'Free Guide', view: 'guide' as const },
  ];

  const navigateTo = (view: string) => {
    const path = VIEW_TO_PATH[view] || '/';
    router.push(path);
  };

  const handleNavClick = (link: typeof navLinks[0]) => {
    setIsOpen(false);
    navigateTo(link.view);
  };

  return (
    <>
      {/* Desktop Logo - Top Left */}
      <div className="fixed top-8 left-8 z-[110] hidden md:block">
        <button
          onClick={() => navigateTo('home')}
          className={`flex items-center gap-2 group cursor-pointer backdrop-blur-md px-4 py-2 rounded-full border no-underline transition-colors duration-300 ${theme === 'dark'
            ? 'bg-black/20 border-white/5'
            : 'bg-[var(--glass-bg)] border-[var(--glass-border)]'
            }`}
        >
          {theme === 'dark' ? (
            <svg className="w-8 h-8" viewBox="0 0 48 48" fill="none">
              <defs>
                <linearGradient id="logo-grad-nav" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#2563EB"></stop>
                  <stop offset="100%" stopColor="#06B6D4"></stop>
                </linearGradient>
              </defs>
              <path d="M4 36L20 24L4 12L4 20L12 24L4 28L4 36Z" fill="#2563EB"></path>
              <path d="M12 36L28 24L12 12L12 18L18 24L12 30L12 36Z" fill="url(#logo-grad-nav)"></path>
              <path d="M20 36L44 24L20 12L20 18L32 24L20 30L20 36Z" fill="#06B6D4"></path>
            </svg>
          ) : (
            <img
              src="/logos/icon-light.svg"
              alt="Nexli"
              className="w-8 h-8"
            />
          )}
          <span className="text-xl font-black tracking-tighter text-[var(--text-main)]" style={{ fontFamily: "'Syne', sans-serif" }}>NEXLI</span>
        </button>
      </div>

      {/* Floating Center Nav - Combined for Desktop and Mobile Expansion */}
      <div className="fixed top-6 md:top-8 left-1/2 -translate-x-1/2 z-[100] w-[90%] md:w-max">
        <motion.nav
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "circOut" }}
          className={`glass-nav flex flex-col md:flex-row items-center p-2 gap-2 md:gap-6 rounded-[2rem] md:rounded-full shadow-2xl px-4 md:px-6 transition-all duration-500 overflow-hidden ${isOpen ? 'max-h-[500px]' : 'max-h-[64px] md:max-h-none'}`}
        >
          {/* Main Bar (Items visible at all times) */}
          <div className="w-full flex items-center justify-between md:justify-start gap-4 md:gap-6">

            {/* Mobile Logo Identification */}
            <button
              onClick={() => { setIsOpen(false); navigateTo('home'); }}
              className={`flex md:hidden items-center gap-2 group cursor-pointer backdrop-blur-md px-3 py-1.5 rounded-full border no-underline transition-colors duration-300 ${theme === 'dark'
                ? 'bg-black/20 border-white/5'
                : 'bg-[var(--glass-bg)] border-[var(--glass-border)]'
                }`}
            >
              {theme === 'dark' ? (
                <svg className="w-6 h-6" viewBox="0 0 48 48" fill="none">
                  <defs>
                    <linearGradient id="logo-grad-mobile" x1="0%" y1="100%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#2563EB"></stop>
                      <stop offset="100%" stopColor="#06B6D4"></stop>
                    </linearGradient>
                  </defs>
                  <path d="M4 36L20 24L4 12L4 20L12 24L4 28L4 36Z" fill="#2563EB"></path>
                  <path d="M12 36L28 24L12 12L12 18L18 24L12 30L12 36Z" fill="url(#logo-grad-mobile)"></path>
                  <path d="M20 36L44 24L20 12L20 18L32 24L20 30L20 36Z" fill="#06B6D4"></path>
                </svg>
              ) : (
                <img
                  src="/logos/icon-light.svg"
                  alt="Nexli"
                  className="w-6 h-6"
                />
              )}
              <span className="text-sm font-black tracking-tighter text-[var(--text-main)]" style={{ fontFamily: "'Syne', sans-serif" }}>NEXLI</span>
            </button>

            {/* Desktop Links (Hidden on mobile) */}
            <div className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <button
                  key={link.label}
                  onClick={() => handleNavClick(link)}
                  className={`text-sm tracking-tight transition-all bg-transparent border-none p-0 px-3 py-1 rounded-full flex items-center gap-1.5 ${(link.view === currentView && link.view !== 'home')
                    ? 'text-blue-500 bg-blue-500/10 font-bold'
                    : 'text-[var(--text-muted)] font-semibold hover:text-[var(--text-main)]'
                    }`}
                >
                  {link.hasGoogleIcon && (
                    <svg width="14" height="14" viewBox="0 0 24 24" className="flex-shrink-0">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                  )}
                  {link.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              {/* Email Button */}
              <button
                onClick={handleEmailClick}
                className="relative p-2 rounded-full bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all duration-300"
                aria-label="Email us"
              >
                {emailCopied ? <Check size={18} className="text-green-500" /> : <Mail size={18} />}
              </button>

              {/* Theme Toggle Button */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full bg-[var(--glass-bg)] border border-[var(--glass-border)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all duration-300"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              <button
                onClick={() => {
                  setIsOpen(false);
                  if (pathname !== '/') {
                    router.push('/');
                    setTimeout(() => {
                      const isMobile = window.innerWidth < 768;
                      if (isMobile) {
                        document.getElementById('book-mobile')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      } else {
                        document.getElementById('book')?.scrollIntoView({ behavior: 'smooth' });
                      }
                    }, 500);
                  } else {
                    const isMobile = window.innerWidth < 768;
                    if (isMobile) {
                      document.getElementById('book-mobile')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    } else {
                      document.getElementById('book')?.scrollIntoView({ behavior: 'smooth' });
                    }
                  }
                }}
                className="bg-blue-600 text-white px-4 md:px-6 py-2 md:py-2.5 rounded-full text-[10px] md:text-sm font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-500 hover:scale-[1.02] active:scale-[0.98] transition-all whitespace-nowrap"
              >
                Book Now
              </button>

              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="md:hidden p-2 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors focus:outline-none"
              >
                {isOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>

          {/* Expanded Mobile Menu */}
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="w-full flex md:hidden flex-col pt-4 pb-4 border-t border-[var(--glass-border)]"
              >
                {navLinks.map((link) => (
                  <button
                    key={link.label}
                    onClick={() => handleNavClick(link)}
                    className={`flex items-center justify-between py-3.5 px-2 rounded-xl text-left transition-colors ${(link.view === currentView && link.view !== 'home')
                      ? 'bg-blue-500/10 text-blue-500 font-bold text-lg'
                      : 'text-[var(--text-main)] text-base font-semibold'
                      }`}
                  >
                    <span className="flex items-center gap-2">
                      {link.hasGoogleIcon && (
                        <svg width="16" height="16" viewBox="0 0 24 24" className="flex-shrink-0">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                      )}
                      {link.label}
                    </span>
                    <ChevronRight size={16} className="text-[var(--text-muted)] opacity-50" />
                  </button>
                ))}

                {/* Email / Get in Touch */}
                <button
                  onClick={handleEmailClick}
                  className="flex items-center justify-between py-3.5 px-2 rounded-xl text-left transition-colors mt-2 border-t border-[var(--glass-border)] pt-4"
                >
                  <div className="flex items-center gap-3">
                    <Mail size={16} className="text-blue-500" />
                    <span className="text-[var(--text-main)] text-base font-semibold">
                      {emailCopied ? 'Copied!' : 'mail@nexli.net'}
                    </span>
                  </div>
                  {emailCopied
                    ? <Check size={16} className="text-green-500" />
                    : <ChevronRight size={16} className="text-[var(--text-muted)] opacity-50" />
                  }
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.nav>
      </div>
    </>
  );
};

export default Navbar;
