'use client';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import type { FirmBrandConfig } from './firmBrandConfigs';

interface FirmNavbarProps {
  config: FirmBrandConfig;
  navigate?: (view: string, slug?: string) => void;
}

const FirmNavbar: React.FC<FirmNavbarProps> = ({ config, navigate }) => {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const { colors, fonts, navLinks, style, firmName } = config;

  const bgStyle: React.CSSProperties =
    style === 'glass'
      ? {
          background: colors.navBg,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${colors.border}`,
        }
      : {
          background: colors.navBg,
          borderBottom: `1px solid ${colors.border}`,
        };

  const handleNavigate = (view: string) => {
    if (navigate) {
      navigate(view as any);
    } else {
      router.push(view === 'home' ? '/' : `/${view}`);
    }
  };

  // Nexli logo (matches home page style)
  const NexliLogo = () => (
    <svg className="w-6 h-6 md:w-7 md:h-7" viewBox="0 0 48 48" fill="none">
      <defs>
        <linearGradient id="logo-grad-firm" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>
      </defs>
      <path d="M4 36L20 24L4 12L4 20L12 24L4 28L4 36Z" fill="#2563EB" />
      <path d="M12 36L28 24L12 12L12 18L18 24L12 30L12 36Z" fill="url(#logo-grad-firm)" />
      <path d="M20 36L44 24L20 12L20 18L32 24L20 30L20 36Z" fill="#06B6D4" />
    </svg>
  );

  return (
    <>
      {/* ===== Firm Navbar ===== */}
      <nav
        className="fixed top-0 left-0 right-0 z-[100]"
        style={bgStyle}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="flex items-center justify-between h-16 md:h-[4.5rem]">
            {/* Firm name / logo */}
            <div
              className="text-lg md:text-xl font-bold tracking-tight shrink-0"
              style={{
                color: colors.text,
                fontFamily: fonts.heading,
              }}
            >
              {firmName}
            </div>

            {/* Desktop nav links - styled as buttons */}
            <div className="hidden md:flex items-center gap-2">
              {navLinks.map((link) => (
                <button
                  key={link}
                  className="px-4 py-2 rounded-full text-sm font-semibold transition-all border cursor-default"
                  style={{
                    color: colors.text,
                    fontFamily: fonts.body,
                    borderColor: colors.border,
                    backgroundColor: 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = `${colors.accent}20`;
                    e.currentTarget.style.borderColor = colors.accent;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderColor = colors.border;
                  }}
                >
                  {link}
                </button>
              ))}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2 md:gap-3">
              {/* Portfolio back link (desktop) */}
              <button
                onClick={() => handleNavigate('portfolio')}
                className="hidden md:flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all border cursor-pointer"
                style={{
                  color: colors.accent,
                  borderColor: colors.accent,
                  backgroundColor: 'transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.accent;
                  e.currentTarget.style.color = style === 'minimal' ? '#ffffff' : '#ffffff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = colors.accent;
                }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Portfolio
              </button>

              {/* Mobile hamburger */}
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="md:hidden p-2 transition-colors border-none bg-transparent"
                style={{ color: colors.textMuted }}
                onMouseEnter={(e) => { e.currentTarget.style.color = colors.text; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = colors.textMuted; }}
              >
                {isOpen ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile expanded menu */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="md:hidden overflow-hidden"
              style={{
                borderTop: `1px solid ${colors.border}`,
                background: colors.navBg,
              }}
            >
              <div className="px-4 py-4 flex flex-col gap-2">
                {navLinks.map((link) => (
                  <button
                    key={link}
                    className="flex items-center justify-between py-3 px-4 rounded-xl text-left text-base font-semibold transition-colors border"
                    style={{
                      color: colors.text,
                      fontFamily: fonts.body,
                      borderColor: colors.border,
                      backgroundColor: 'transparent',
                    }}
                  >
                    {link}
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.3 }}>
                      <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                ))}

                {/* Portfolio link removed from hamburger — now a sticky button below Nexli logo */}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ===== Sticky Nexli Logo - below firm navbar, top-left ===== */}
      <button
        onClick={() => handleNavigate('home')}
        className="fixed top-[4.25rem] md:top-[5rem] left-3 md:left-6 z-[101] flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full backdrop-blur-md border no-underline cursor-pointer transition-all duration-300 shadow-lg hover:scale-[1.03] active:scale-[0.97]"
        style={{
          background: 'rgba(0,0,0,0.25)',
          borderColor: 'rgba(255,255,255,0.1)',
        }}
        title="Back to Nexli"
      >
        <NexliLogo />
        <span
          className="text-sm md:text-base font-black tracking-tighter text-white"
          style={{ fontFamily: "'Syne', sans-serif" }}
        >
          NEXLI
        </span>
      </button>

      {/* ===== Sticky "Back to Portfolio" button - mobile only, below Nexli logo ===== */}
      <button
        onClick={() => handleNavigate('portfolio')}
        className="md:hidden fixed top-[6.75rem] left-3 z-[101] flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md border no-underline cursor-pointer transition-all duration-300 shadow-lg hover:scale-[1.03] active:scale-[0.97]"
        style={{
          background: 'rgba(0,0,0,0.25)',
          borderColor: 'rgba(255,255,255,0.1)',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <path d="M10 12L6 8L10 4" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-xs font-bold text-white tracking-wide">
          Portfolio
        </span>
      </button>
    </>
  );
};

export default FirmNavbar;
