'use client';
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import FirmNavbar from './FirmNavbar';
import { meridianConfig } from './firmBrandConfigs';

// ---------------------------------------------------------------------------
// Floating Particles – generated client-side only to avoid hydration mismatch
// ---------------------------------------------------------------------------
function generateParticles() {
  return Array.from({ length: 18 }, (_, i) => ({
    id: i,
    size: Math.random() * 4 + 2,
    x: Math.random() * 100,
    y: Math.random() * 60,
    duration: Math.random() * 12 + 14,
    delay: Math.random() * -20,
    opacity: Math.random() * 0.35 + 0.08,
    color: ['#f97316', '#fbbf24', '#ef4444', '#06b6d4'][i % 4],
  }));
}

function generateFloatingLines() {
  return Array.from({ length: 6 }, (_, i) => ({
    id: i,
    width: Math.random() * 120 + 40,
    x: Math.random() * 90,
    y: Math.random() * 50 + 5,
    rotation: Math.random() * 40 - 20,
    duration: Math.random() * 16 + 18,
    delay: Math.random() * -14,
    opacity: Math.random() * 0.12 + 0.04,
    color: ['#f97316', '#ef4444'][i % 2],
  }));
}

// ---------------------------------------------------------------------------
// Inline SVG Icons
// ---------------------------------------------------------------------------
const ShieldIcon = () => (
  <svg
    width="40"
    height="40"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#06b6d4"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 2l7 4v5c0 5.25-3.5 9.74-7 11-3.5-1.26-7-5.75-7-11V6l7-4z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

const LockIcon = () => (
  <svg
    width="40"
    height="40"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#06b6d4"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
    <circle cx="12" cy="16" r="1" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg
    width="40"
    height="40"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#06b6d4"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

// ---------------------------------------------------------------------------
// Shared animation helpers
// ---------------------------------------------------------------------------
const sectionVariants = {
  hidden: { opacity: 0, y: 60 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] as [number, number, number, number] },
  },
};

const cardScale = {
  hidden: { opacity: 0, scale: 0.92, y: 40 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  },
};

const staggerContainer = {
  visible: {
    transition: { staggerChildren: 0.15 },
  },
};

// ---------------------------------------------------------------------------
// Keyframe injection (runs once)
// ---------------------------------------------------------------------------
const KEYFRAMES_ID = 'meridian-keyframes';

function injectKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(KEYFRAMES_ID)) return;

  const style = document.createElement('style');
  style.id = KEYFRAMES_ID;
  style.textContent = `
    @keyframes meridianFloat {
      0%, 100% { transform: translateY(0px) translateX(0px); }
      25% { transform: translateY(-18px) translateX(8px); }
      50% { transform: translateY(-8px) translateX(-6px); }
      75% { transform: translateY(-22px) translateX(4px); }
    }
    @keyframes meridianLineDrift {
      0%, 100% { transform: translateX(0px) rotate(var(--rot)); }
      50% { transform: translateX(30px) rotate(calc(var(--rot) + 8deg)); }
    }
    @keyframes meridianPulseGlow {
      0%, 100% { box-shadow: 0 0 8px rgba(6,182,212,0.25), inset 0 0 8px rgba(6,182,212,0.08); }
      50% { box-shadow: 0 0 20px rgba(6,182,212,0.45), inset 0 0 14px rgba(6,182,212,0.15); }
    }
    @keyframes meridianCountUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function HeroSection() {
  const [particles, setParticles] = useState<ReturnType<typeof generateParticles>>([]);
  const [lines, setLines] = useState<ReturnType<typeof generateFloatingLines>>([]);

  useEffect(() => {
    setParticles(generateParticles());
    setLines(generateFloatingLines());
  }, []);

  return (
    <section
      className="relative overflow-hidden pt-20"
      style={{ background: '#0c0c0c', minHeight: '100vh' }}
    >
      {/* Warm gradient overlay – orange to red horizon */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 120% 60% at 50% 0%, rgba(249,115,22,0.35) 0%, rgba(239,68,68,0.22) 40%, transparent 70%)',
        }}
      />

      {/* Secondary softer glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 40% at 60% 10%, rgba(251,191,36,0.12) 0%, transparent 60%)',
        }}
      />

      {/* Floating particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full pointer-events-none"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.x}%`,
            top: `${p.y}%`,
            backgroundColor: p.color,
            opacity: p.opacity,
            animation: `meridianFloat ${p.duration}s ease-in-out ${p.delay}s infinite`,
          }}
        />
      ))}

      {/* Floating lines */}
      {lines.map((l) => (
        <div
          key={`line-${l.id}`}
          className="absolute pointer-events-none"
          style={{
            width: l.width,
            height: 1.5,
            left: `${l.x}%`,
            top: `${l.y}%`,
            backgroundColor: l.color,
            opacity: l.opacity,
            borderRadius: 1,
            transform: `rotate(${l.rotation}deg)`,
            animation: `meridianLineDrift ${l.duration}s ease-in-out ${l.delay}s infinite`,
          }}
        />
      ))}

      {/* Hero content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
          className="font-black uppercase leading-none tracking-tight"
          style={{
            color: '#fbbf24',
            fontSize: 'clamp(3.2rem, 10vw, 8rem)',
            lineHeight: 0.95,
            maxWidth: 900,
          }}
        >
          Go Where
          <br />
          Your Money
          <br />
          Grows
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
          className="mt-8 text-lg md:text-xl max-w-xl"
          style={{ color: 'rgba(255,255,255,0.75)' }}
        >
          Where ambitious investors find their edge. Advisory, planning, and
          growth&nbsp;&mdash; all under one roof.
        </motion.p>

        <motion.a
          href="#get-started"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.97 }}
          className="mt-10 inline-block px-10 py-4 rounded-full font-bold text-base text-white cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, #f97316, #ef4444)',
            boxShadow: '0 8px 30px rgba(249,115,22,0.35)',
          }}
        >
          Get started
        </motion.a>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

const services = [
  {
    title: 'Wealth Advisory',
    description:
      'Personalized strategies for high-net-worth individuals. One-on-one guidance from certified advisors.',
    gradient: 'linear-gradient(180deg, rgba(249,115,22,0.35) 0%, transparent 50%)',
    accent: '#f97316',
  },
  {
    title: 'Portfolio Management',
    description:
      'Active management with real-time rebalancing. Data-driven decisions for optimal returns.',
    gradient: 'linear-gradient(180deg, rgba(6,182,212,0.35) 0%, transparent 50%)',
    accent: '#06b6d4',
  },
  {
    title: 'Retirement Planning',
    description:
      'Your future, mapped out. Comprehensive planning that grows with your life.',
    gradient: 'linear-gradient(180deg, rgba(239,68,68,0.35) 0%, transparent 50%)',
    accent: '#ef4444',
  },
];

function ServicesSection() {
  return (
    <section style={{ background: '#141414' }} className="py-28 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.h2
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="text-4xl md:text-5xl font-black text-white text-center mb-16"
        >
          Everything you need
        </motion.h2>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {services.map((s) => (
            <motion.div
              key={s.title}
              variants={cardScale}
              whileHover={{ y: -6, transition: { duration: 0.3 } }}
              className="relative rounded-2xl overflow-hidden border"
              style={{
                background: '#1a1a1a',
                borderColor: 'rgba(255,255,255,0.07)',
              }}
            >
              {/* Gradient top glow */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: s.gradient }}
              />

              <div className="relative z-10 p-8 flex flex-col min-h-[280px]">
                <h3
                  className="text-2xl font-bold mb-3"
                  style={{ color: '#ffffff' }}
                >
                  {s.title}
                </h3>
                <p
                  className="text-sm leading-relaxed flex-1"
                  style={{ color: 'rgba(255,255,255,0.6)' }}
                >
                  {s.description}
                </p>
                <a
                  href="#"
                  className="mt-6 text-sm font-semibold inline-flex items-center gap-1"
                  style={{ color: s.accent }}
                >
                  Learn more
                  <span aria-hidden="true">&rarr;</span>
                </a>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

const badges = [
  { label: 'SEC Registered', Icon: ShieldIcon },
  { label: 'SOC 2 Certified', Icon: LockIcon },
  { label: 'Fiduciary Standard', Icon: CheckCircleIcon },
];

function TrustSection() {
  return (
    <section style={{ background: '#181818' }} className="py-28 px-6">
      <div className="max-w-5xl mx-auto text-center">
        <motion.h2
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="text-4xl md:text-5xl font-black text-white mb-4"
        >
          Built on trust
        </motion.h2>

        <motion.p
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="text-base md:text-lg mb-16"
          style={{ color: 'rgba(255,255,255,0.55)' }}
        >
          Meridian Financial is a registered, regulated investment advisory firm
        </motion.p>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-14"
        >
          {badges.map(({ label, Icon }) => (
            <motion.div
              key={label}
              variants={cardScale}
              className="flex flex-col items-center gap-4 rounded-xl p-8 border"
              style={{
                background: 'rgba(255,255,255,0.03)',
                borderColor: 'rgba(6,182,212,0.2)',
                animation: 'meridianPulseGlow 4s ease-in-out infinite',
              }}
            >
              <Icon />
              <span
                className="text-sm font-bold uppercase tracking-widest"
                style={{ color: 'rgba(255,255,255,0.85)' }}
              >
                {label}
              </span>
            </motion.div>
          ))}
        </motion.div>

        <motion.p
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="text-sm max-w-2xl mx-auto leading-relaxed"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          Your assets are held with regulated custodians and protected by
          industry-leading security protocols. Meridian Financial operates under
          a fiduciary duty, meaning we are legally obligated to act in your best
          interest at all times.
        </motion.p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

const metrics = [
  { value: '$8.2B', label: 'Assets Under Management' },
  { value: '12.4%', label: 'Avg. Annual Return' },
  { value: '3,500+', label: 'Active Clients' },
];

function PerformanceSection() {
  return (
    <section className="relative py-28 px-6 overflow-hidden" style={{ background: '#0c0c0c' }}>
      {/* Subtle orange radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(249,115,22,0.08) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 max-w-5xl mx-auto text-center">
        <motion.h2
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="text-4xl md:text-5xl font-black text-white mb-16"
        >
          Results that speak
        </motion.h2>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-10"
        >
          {metrics.map((m) => (
            <motion.div key={m.label} variants={cardScale} className="flex flex-col items-center">
              <span
                className="text-5xl md:text-6xl font-black"
                style={{ color: '#fbbf24' }}
              >
                {m.value}
              </span>
              <span
                className="mt-3 text-sm uppercase tracking-widest font-medium"
                style={{ color: 'rgba(255,255,255,0.45)' }}
              >
                {m.label}
              </span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function CTASection() {
  return (
    <section
      className="relative py-28 px-6 overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #f97316, #ef4444)',
      }}
    >
      {/* Subtle noise overlay to add texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-10"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 40%, rgba(255,255,255,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 60%, rgba(0,0,0,0.12) 0%, transparent 50%)',
        }}
      />

      <div className="relative z-10 max-w-3xl mx-auto text-center">
        <motion.h2
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          className="text-4xl md:text-5xl font-black text-white mb-4"
        >
          Your financial future starts&nbsp;here
        </motion.h2>

        <motion.p
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="text-lg mb-10"
          style={{ color: 'rgba(255,255,255,0.85)' }}
        >
          Open an account today&nbsp;&mdash; it&rsquo;s free to start
        </motion.p>

        <motion.a
          href="#get-started"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.97 }}
          className="inline-block px-10 py-4 rounded-full font-bold text-base cursor-pointer"
          style={{
            background: '#ffffff',
            color: '#0c0c0c',
            boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
          }}
        >
          Get Started
        </motion.a>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

const footerLinks = ['About', 'Careers', 'Security', 'Contact'];

const SocialPlaceholder = ({ label }: { label: string }) => (
  <a
    href="#"
    aria-label={label}
    className="flex items-center justify-center rounded-full border transition-colors"
    style={{
      width: 36,
      height: 36,
      borderColor: 'rgba(255,255,255,0.15)',
      color: 'rgba(255,255,255,0.45)',
    }}
  >
    {/* Minimal SVG icon placeholders */}
    {label === 'Twitter' && (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    )}
    {label === 'LinkedIn' && (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    )}
    {label === 'Instagram' && (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    )}
  </a>
);

function FooterSection() {
  return (
    <footer style={{ background: '#0a0a0a' }} className="py-16 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-10">
          {/* Brand */}
          <div className="text-center md:text-left">
            <span className="text-xl font-black text-white tracking-tight">
              Meridian Financial
            </span>
            <p
              className="mt-2 text-xs"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              Advisory &middot; Planning &middot; Growth
            </p>
          </div>

          {/* Nav links */}
          <nav className="flex gap-8">
            {footerLinks.map((link) => (
              <a
                key={link}
                href="#"
                className="text-sm transition-colors hover:text-white"
                style={{ color: 'rgba(255,255,255,0.45)' }}
              >
                {link}
              </a>
            ))}
          </nav>

          {/* Social icons */}
          <div className="flex gap-3">
            <SocialPlaceholder label="Twitter" />
            <SocialPlaceholder label="LinkedIn" />
            <SocialPlaceholder label="Instagram" />
          </div>
        </div>

        {/* Divider */}
        <div
          className="mt-12 mb-6 h-px"
          style={{ background: 'rgba(255,255,255,0.07)' }}
        />

        <p
          className="text-center text-xs"
          style={{ color: 'rgba(255,255,255,0.25)' }}
        >
          &copy; {new Date().getFullYear()} Meridian Financial Inc. All rights
          reserved. This is a fictional company created for demonstration purposes.
        </p>
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

interface MeridianFinancialProps {
  navigate?: (view: string, slug?: string) => void;
}

const MeridianFinancial: React.FC<MeridianFinancialProps> = ({ navigate: navigateProp }) => {
  useEffect(() => {
    injectKeyframes();
  }, []);

  return (
    <div
      style={{
        fontFamily:
          "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: '#ffffff',
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      <FirmNavbar config={meridianConfig} navigate={navigateProp} />
      <HeroSection />
      <ServicesSection />
      <TrustSection />
      <PerformanceSection />
      <CTASection />
      <FooterSection />
    </div>
  );
};

export default MeridianFinancial;
