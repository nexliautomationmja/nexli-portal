'use client';
import React from 'react';
import { motion } from 'framer-motion';
import FirmNavbar from './FirmNavbar';
import { harborConfig } from './firmBrandConfigs';

// ─── SVG Illustrations ────────────────────────────────────────────────────────

const GlobeIllustration = () => (
  <svg viewBox="0 0 400 400" fill="none" className="w-full max-w-md mx-auto">
    {/* Globe circle */}
    <circle cx="200" cy="200" r="150" stroke="#e5e7eb" strokeWidth="1.5" fill="none" />
    <ellipse cx="200" cy="200" rx="150" ry="60" stroke="#e5e7eb" strokeWidth="1" fill="none" />
    <ellipse cx="200" cy="200" rx="60" ry="150" stroke="#e5e7eb" strokeWidth="1" fill="none" />
    <line x1="50" y1="200" x2="350" y2="200" stroke="#e5e7eb" strokeWidth="1" />
    <line x1="200" y1="50" x2="200" y2="350" stroke="#e5e7eb" strokeWidth="1" />
    {/* Location pins */}
    <circle cx="140" cy="140" r="6" fill="#84cc16" />
    <circle cx="260" cy="160" r="6" fill="#84cc16" />
    <circle cx="180" cy="240" r="6" fill="#84cc16" />
    <circle cx="300" cy="200" r="6" fill="#65a30d" />
    <circle cx="120" cy="200" r="6" fill="#65a30d" />
    <circle cx="220" cy="120" r="5" fill="#84cc16" opacity="0.7" />
    <circle cx="250" cy="260" r="5" fill="#84cc16" opacity="0.7" />
    <circle cx="160" cy="180" r="4" fill="#65a30d" opacity="0.5" />
    <circle cx="280" cy="140" r="4" fill="#65a30d" opacity="0.5" />
    {/* Connection arcs */}
    <path d="M140 140 Q 200 100 260 160" stroke="#84cc16" strokeWidth="1" fill="none" opacity="0.4" strokeDasharray="4 4" />
    <path d="M260 160 Q 290 200 250 260" stroke="#84cc16" strokeWidth="1" fill="none" opacity="0.4" strokeDasharray="4 4" />
    <path d="M120 200 Q 160 160 220 120" stroke="#65a30d" strokeWidth="1" fill="none" opacity="0.3" strokeDasharray="4 4" />
  </svg>
);

const NetworkIllustration = () => (
  <svg viewBox="0 0 300 240" fill="none" className="w-full max-w-xs mx-auto">
    {/* Nodes */}
    <circle cx="150" cy="60" r="12" fill="#84cc16" />
    <circle cx="60" cy="140" r="10" fill="#84cc16" opacity="0.8" />
    <circle cx="240" cy="140" r="10" fill="#84cc16" opacity="0.8" />
    <circle cx="100" cy="200" r="8" fill="#65a30d" opacity="0.6" />
    <circle cx="200" cy="200" r="8" fill="#65a30d" opacity="0.6" />
    <circle cx="150" cy="140" r="14" fill="#65a30d" />
    {/* Connections */}
    <line x1="150" y1="60" x2="150" y2="140" stroke="#d1d5db" strokeWidth="1.5" />
    <line x1="150" y1="60" x2="60" y2="140" stroke="#d1d5db" strokeWidth="1.5" />
    <line x1="150" y1="60" x2="240" y2="140" stroke="#d1d5db" strokeWidth="1.5" />
    <line x1="60" y1="140" x2="100" y2="200" stroke="#d1d5db" strokeWidth="1" />
    <line x1="240" y1="140" x2="200" y2="200" stroke="#d1d5db" strokeWidth="1" />
    <line x1="150" y1="140" x2="100" y2="200" stroke="#d1d5db" strokeWidth="1" />
    <line x1="150" y1="140" x2="200" y2="200" stroke="#d1d5db" strokeWidth="1" />
    <line x1="60" y1="140" x2="150" y2="140" stroke="#d1d5db" strokeWidth="1" />
    <line x1="240" y1="140" x2="150" y2="140" stroke="#d1d5db" strokeWidth="1" />
    {/* Inner dots */}
    <circle cx="150" cy="140" r="5" fill="#fff" />
    <circle cx="150" cy="60" r="5" fill="#fff" />
  </svg>
);

const PricingCardIllustration = () => (
  <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm max-w-xs mx-auto">
    <div className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-2">Annual Fee</div>
    <div className="text-6xl font-black text-black tracking-tight">0.25<span className="text-3xl">%</span></div>
    <div className="mt-4 space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-full bg-[#84cc16] flex items-center justify-center">
          <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" fill="none">
            <path d="M2 6L5 9L10 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span className="text-sm text-gray-600">No hidden charges</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-full bg-[#84cc16] flex items-center justify-center">
          <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" fill="none">
            <path d="M2 6L5 9L10 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span className="text-sm text-gray-600">Flat-fee structure</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-full bg-[#84cc16] flex items-center justify-center">
          <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" fill="none">
            <path d="M2 6L5 9L10 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span className="text-sm text-gray-600">Cancel anytime</span>
      </div>
    </div>
  </div>
);

const AdvisorIllustration = () => (
  <svg viewBox="0 0 240 240" fill="none" className="w-full max-w-[200px] mx-auto">
    {/* Head */}
    <circle cx="120" cy="80" r="36" fill="#f3f4f6" stroke="#e5e7eb" strokeWidth="1.5" />
    {/* Body */}
    <path d="M60 200 Q60 150 120 140 Q180 150 180 200" fill="#f3f4f6" stroke="#e5e7eb" strokeWidth="1.5" />
    {/* Badge */}
    <circle cx="120" cy="170" r="16" fill="#84cc16" />
    <svg viewBox="0 0 12 12" x="113" y="163" width="14" height="14" fill="none">
      <path d="M2 6L5 9L10 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    {/* Signal arcs */}
    <path d="M170 60 Q190 80 170 100" stroke="#84cc16" strokeWidth="1.5" fill="none" opacity="0.4" />
    <path d="M180 50 Q205 80 180 110" stroke="#84cc16" strokeWidth="1.5" fill="none" opacity="0.25" />
    <path d="M190 40 Q220 80 190 120" stroke="#84cc16" strokeWidth="1.5" fill="none" opacity="0.15" />
    {/* 24/7 label */}
    <rect x="155" y="30" rx="10" ry="10" width="50" height="22" fill="#84cc16" />
    <text x="180" y="45" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="700">24/7</text>
  </svg>
);

// ─── Animation Variants ───────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0 },
};

const fadeLeft = {
  hidden: { opacity: 0, x: -60 },
  visible: { opacity: 1, x: 0 },
};

const fadeRight = {
  hidden: { opacity: 0, x: 60 },
  visible: { opacity: 1, x: 0 },
};

const stagger = {
  visible: {
    transition: { staggerChildren: 0.15 },
  },
};

// ─── Main Component ───────────────────────────────────────────────────────────

interface HarborWealthProps {
  navigate?: (view: string, slug?: string) => void;
}

const HarborWealth: React.FC<HarborWealthProps> = ({ navigate: navigateProp }) => {
  return (
    <div
      className="min-h-screen bg-white font-sans text-black antialiased overflow-x-hidden"
      style={{
        '--bg-main': '#ffffff',
        '--text-main': '#0f172a',
        '--text-muted': 'rgba(15, 23, 42, 0.7)',
        '--glass-bg': 'rgba(255, 255, 255, 0.7)',
        '--glass-border': 'rgba(15, 23, 42, 0.1)',
        colorScheme: 'light',
      } as React.CSSProperties}
    >
      <FirmNavbar config={harborConfig} navigate={navigateProp} />

      {/* ── Hero Section ─────────────────────────────────────────────────── */}
      <section className="relative bg-white px-6 pt-28 pb-16 md:pt-36 md:pb-24">
        <div className="max-w-6xl mx-auto text-center">
          <motion.h1
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black uppercase leading-[0.9] tracking-tight text-black"
          >
            Wealth for here,
            <br />
            there and
            <br />
            everywhere
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
            className="mt-8 text-lg md:text-xl text-gray-500 max-w-xl mx-auto leading-relaxed"
          >
            40 countries. Global markets. Get the wealth management built to grow
            your money round the world.
          </motion.p>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <button className="px-8 py-3.5 bg-[#84cc16] text-black font-semibold rounded-full text-base hover:bg-[#65a30d] transition-colors">
              Open an account
            </button>
            <button className="px-8 py-3.5 bg-white text-black font-semibold rounded-full text-base border-2 border-black hover:bg-gray-50 transition-colors">
              Start planning
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
            className="mt-16 md:mt-20"
          >
            <GlobeIllustration />
          </motion.div>
        </div>
      </section>

      {/* ── Features Section ─────────────────────────────────────────────── */}
      <section className="bg-[#fafafa] px-6 py-20 md:py-32">
        <div className="max-w-6xl mx-auto">
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp}
            transition={{ duration: 0.7 }}
            className="text-4xl md:text-5xl font-black text-black mb-20 md:mb-28"
          >
            Why Harbor Wealth
          </motion.h2>

          {/* Feature 1 — Text Left, Illustration Right */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
            className="grid md:grid-cols-2 gap-12 md:gap-20 items-center mb-24 md:mb-32"
          >
            <motion.div variants={fadeLeft} transition={{ duration: 0.7 }}>
              <h3 className="text-3xl md:text-4xl font-black text-black mb-4">
                Global Portfolio Access
              </h3>
              <p className="text-lg text-gray-500 leading-relaxed">
                Invest in 40+ markets worldwide. Diversify across currencies,
                sectors, and geographies with a single account.
              </p>
            </motion.div>
            <motion.div variants={fadeRight} transition={{ duration: 0.7 }}>
              <NetworkIllustration />
            </motion.div>
          </motion.div>

          {/* Feature 2 — Illustration Left, Text Right */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
            className="grid md:grid-cols-2 gap-12 md:gap-20 items-center mb-24 md:mb-32"
          >
            <motion.div variants={fadeLeft} transition={{ duration: 0.7 }} className="order-2 md:order-1">
              <PricingCardIllustration />
            </motion.div>
            <motion.div variants={fadeRight} transition={{ duration: 0.7 }} className="order-1 md:order-2">
              <h3 className="text-3xl md:text-4xl font-black text-black mb-4">
                Transparent Pricing
              </h3>
              <p className="text-lg text-gray-500 leading-relaxed">
                No hidden fees. No surprises. See exactly what you pay with our
                flat-fee structure — starting at 0.25%.
              </p>
            </motion.div>
          </motion.div>

          {/* Feature 3 — Text Left, Illustration Right */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
            className="grid md:grid-cols-2 gap-12 md:gap-20 items-center"
          >
            <motion.div variants={fadeLeft} transition={{ duration: 0.7 }}>
              <h3 className="text-3xl md:text-4xl font-black text-black mb-4">
                Expert Guidance
              </h3>
              <p className="text-lg text-gray-500 leading-relaxed">
                Certified advisors available 24/7. Get personalized wealth
                strategies backed by decades of experience.
              </p>
            </motion.div>
            <motion.div variants={fadeRight} transition={{ duration: 0.7 }}>
              <AdvisorIllustration />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Stats / Impact Section ───────────────────────────────────────── */}
      <section className="bg-white px-6 py-20 md:py-28 border-t border-b border-gray-200">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={stagger}
            className="grid grid-cols-2 md:grid-cols-4 gap-10 md:gap-6 text-center"
          >
            {[
              { value: '40+', label: 'Countries' },
              { value: '$12B', label: 'Assets Managed' },
              { value: '50K+', label: 'Clients Worldwide' },
              { value: '0.25%', label: 'Starting Fee' },
            ].map((stat) => (
              <motion.div
                key={stat.label}
                variants={fadeUp}
                transition={{ duration: 0.6 }}
              >
                <div className="text-4xl md:text-5xl lg:text-6xl font-black text-[#84cc16] tracking-tight">
                  {stat.value}
                </div>
                <div className="mt-2 text-sm md:text-base text-gray-400 font-medium">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── How It Works Section ─────────────────────────────────────────── */}
      <section className="bg-[#f5f5f5] px-6 py-20 md:py-32">
        <div className="max-w-5xl mx-auto">
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp}
            transition={{ duration: 0.7 }}
            className="text-4xl md:text-5xl font-black uppercase text-black text-center mb-16 md:mb-24 tracking-tight"
          >
            Get started in minutes
          </motion.h2>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={stagger}
            className="relative grid md:grid-cols-3 gap-12 md:gap-8"
          >
            {/* Dashed connector line (visible on md+) */}
            <div
              className="hidden md:block absolute top-10 left-[calc(16.667%+20px)] right-[calc(16.667%+20px)] border-t-2 border-dashed border-gray-300"
              aria-hidden="true"
            />

            {[
              {
                step: '1',
                title: 'Open Your Account',
                desc: 'Sign up online in under 5 minutes. No paperwork, no branch visit needed.',
              },
              {
                step: '2',
                title: 'Build Your Strategy',
                desc: 'Work with our advisors or use our AI tools to create a personalized plan.',
              },
              {
                step: '3',
                title: 'Watch It Grow',
                desc: 'Track your portfolio 24/7 and get real-time updates on your wealth.',
              },
            ].map((item) => (
              <motion.div
                key={item.step}
                variants={fadeUp}
                transition={{ duration: 0.6 }}
                className="relative text-center"
              >
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-[#84cc16] flex items-center justify-center mx-auto mb-6 relative z-10">
                  <span className="text-2xl md:text-3xl font-black text-white">
                    {item.step}
                  </span>
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-black mb-3">
                  {item.title}
                </h3>
                <p className="text-base text-gray-500 leading-relaxed max-w-xs mx-auto">
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── CTA Section ──────────────────────────────────────────────────── */}
      <section className="bg-[#84cc16] px-6 py-20 md:py-28">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={fadeUp}
            transition={{ duration: 0.7 }}
            className="text-3xl md:text-5xl font-black text-black mb-10 tracking-tight"
          >
            Ready to grow your wealth globally?
          </motion.h2>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
            variants={fadeUp}
            transition={{ duration: 0.7, delay: 0.15 }}
          >
            <button className="px-10 py-4 bg-white text-black font-semibold rounded-full text-lg hover:bg-gray-100 transition-colors shadow-sm">
              Open an account — it's free
            </button>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="bg-white border-t border-gray-200 px-6 py-12">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-xl font-black text-black tracking-tight">
            Harbor Wealth
          </div>
          <nav className="flex items-center gap-8">
            {['About', 'Pricing', 'Careers', 'Legal'].map((link) => (
              <a
                key={link}
                href="#"
                className="text-sm text-gray-400 hover:text-black transition-colors"
              >
                {link}
              </a>
            ))}
          </nav>
          <div className="text-sm text-gray-400">
            &copy; {new Date().getFullYear()} Harbor Wealth. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HarborWealth;
