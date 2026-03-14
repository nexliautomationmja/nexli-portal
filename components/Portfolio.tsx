'use client';
import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Monitor, Layout, Code, Palette, Globe } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useBooking } from './QualificationProvider';
import PortfolioPreview from './portfolio/PortfolioPreview';
import SummitTaxGroup from './portfolio/SummitTaxGroup';
import ClarityAdvisory from './portfolio/ClarityAdvisory';
import MeridianFinancial from './portfolio/MeridianFinancial';
import HarborWealth from './portfolio/HarborWealth';

const firms = [
  {
    title: 'Summit Tax Group',
    subtitle: 'CPA Firm',
    slug: 'summit-tax-group',
    accentColor: '#7c3aed',
    component: SummitTaxGroup,
  },
  {
    title: 'Clarity Advisory',
    subtitle: 'CPA Firm',
    slug: 'clarity-advisory',
    accentColor: '#d4a853',
    component: ClarityAdvisory,
  },
  {
    title: 'Meridian Financial',
    subtitle: 'CPA Firm',
    slug: 'meridian-financial',
    accentColor: '#f97316',
    component: MeridianFinancial,
  },
  {
    title: 'Harbor Wealth',
    subtitle: 'Accounting Firm',
    slug: 'harbor-wealth',
    accentColor: '#84cc16',
    component: HarborWealth,
  },
];

const Portfolio: React.FC = () => {
    const router = useRouter();
  const { openBooking } = useBooking();

  const heroIcons = [Monitor, Layout, Code, Palette, Globe];

  return (
    <div className="min-h-screen bg-[var(--bg-main)] transition-colors duration-300 pt-32 pb-0">
      <div className="max-w-7xl mx-auto px-6">

        {/* ── Hero Section ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center mb-16">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "circOut" }}
          >
            {/* Shimmer badge */}
            <div className="relative inline-flex items-center mb-6 rounded-full overflow-hidden p-[1.5px]">
              <span
                className="absolute inset-[-100%] animate-[shimmer_8s_linear_infinite] opacity-80"
                style={{
                  background: 'conic-gradient(from 0deg at 50% 50%, #2563EB, #06B6D4, #3B82F6, #0EA5E9, #2563EB)'
                }}
              />
              <span
                className="absolute inset-[-100%] animate-[shimmer_8s_linear_infinite] blur-md opacity-40"
                style={{
                  background: 'conic-gradient(from 0deg at 50% 50%, #2563EB, #06B6D4, #3B82F6, #0EA5E9, #2563EB)'
                }}
              />
              <span className="relative z-10 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--bg-main)]">
                <Monitor size={14} className="text-blue-400" />
                <span className="text-[var(--text-main)] text-[10px] md:text-xs font-black tracking-[0.2em] uppercase">Premium Websites</span>
              </span>
            </div>

            <h1 className="text-[26px] sm:text-4xl md:text-6xl font-black text-[var(--text-main)] mb-6 leading-tight tracking-tighter" style={{ fontFamily: "'Syne', sans-serif" }}>
              Websites That Turn Visitors Into{' '}
              <br className="hidden md:block" /><span className="text-blue-500">High-Value Clients.</span>
            </h1>

            {/* Mobile floating icons */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, ease: "circOut" }}
              className="flex lg:hidden items-center justify-center my-8 relative"
            >
              <div className="absolute inset-0 bg-blue-500/10 blur-[80px] rounded-full" />
              <div className="relative z-10 flex flex-col items-center gap-3">
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                >
                  <Monitor size={48} className="text-blue-400" style={{ filter: 'drop-shadow(0 0 20px rgba(37, 99, 235, 0.4))' }} />
                </motion.div>
                <div className="flex gap-3" style={{ perspective: '600px' }}>
                {heroIcons.map((Icon, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{
                      opacity: 1,
                      y: [0, -6, 0],
                      rotateX: [0, 4, 0],
                      rotateY: [0, i % 2 === 0 ? 6 : -6, 0],
                    }}
                    transition={{
                      opacity: { delay: 0.3 + i * 0.15, duration: 0.6 },
                      y: { delay: 0.8 + i * 0.15, duration: 3 + i * 0.4, repeat: Infinity, ease: "easeInOut" },
                      rotateX: { delay: 0.8 + i * 0.15, duration: 3.5 + i * 0.3, repeat: Infinity, ease: "easeInOut" },
                      rotateY: { delay: 0.8 + i * 0.15, duration: 4 + i * 0.5, repeat: Infinity, ease: "easeInOut" },
                    }}
                    style={{ transformStyle: 'preserve-3d' }}
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center" style={{ filter: 'drop-shadow(0 4px 8px rgba(37, 99, 235, 0.3))' }}>
                      <Icon size={20} className="text-blue-400" />
                    </div>
                  </motion.div>
                ))}
                </div>
              </div>
            </motion.div>

            <p className="text-sm sm:text-lg md:text-xl text-[var(--text-muted)] mb-8 max-w-xl leading-relaxed">
              No templates. No shortcuts. Every website is custom-designed for CPAs and accounting firms who want a digital presence that matches the caliber of service they deliver.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-5">
              <button
                onClick={() => document.getElementById('portfolio-grid')?.scrollIntoView({ behavior: 'smooth' })}
                className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 md:px-8 py-3 md:py-4 rounded-full text-sm font-bold hover:bg-blue-500 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-blue-600/20 group"
              >
                Explore Projects
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={openBooking}
                className="flex items-center justify-center gap-2 px-6 md:px-8 py-3 md:py-4 rounded-full text-sm font-bold text-[var(--text-main)] border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-md hover:border-blue-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Book Now
              </button>
            </div>
          </motion.div>

          {/* Right: floating icons (desktop) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: "circOut" }}
            className="relative hidden lg:flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-blue-500/10 blur-[100px] rounded-full" />
            <div className="relative z-10 flex flex-col items-center gap-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="flex items-center gap-3"
              >
                <Monitor size={48} className="text-blue-400" />
                <span className="text-3xl font-bold text-[var(--text-main)]">Premium Websites</span>
              </motion.div>
              <div className="flex gap-3" style={{ perspective: '600px' }}>
                {heroIcons.map((Icon, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{
                      opacity: 1,
                      y: [0, -6, 0],
                      rotateX: [0, 4, 0],
                      rotateY: [0, i % 2 === 0 ? 6 : -6, 0],
                      rotateZ: [0, i % 2 === 0 ? 2 : -2, 0],
                    }}
                    transition={{
                      opacity: { delay: 0.3 + i * 0.15, duration: 0.6 },
                      y: { delay: 0.8 + i * 0.15, duration: 3 + i * 0.4, repeat: Infinity, ease: "easeInOut" },
                      rotateX: { delay: 0.8 + i * 0.15, duration: 3.5 + i * 0.3, repeat: Infinity, ease: "easeInOut" },
                      rotateY: { delay: 0.8 + i * 0.15, duration: 4 + i * 0.5, repeat: Infinity, ease: "easeInOut" },
                      rotateZ: { delay: 0.8 + i * 0.15, duration: 5 + i * 0.4, repeat: Infinity, ease: "easeInOut" },
                    }}
                    style={{ transformStyle: 'preserve-3d' }}
                  >
                    <div
                      className="w-14 h-14 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center"
                      style={{ filter: 'drop-shadow(0 4px 8px rgba(37, 99, 235, 0.3))' }}
                    >
                      <Icon size={28} className="text-blue-400" />
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Portfolio Grid */}
      <section id="portfolio-grid" className="max-w-6xl mx-auto px-6 md:px-6 pt-8 pb-32">
        <div className="grid grid-cols-2 gap-5 md:gap-8">
          {firms.map((firm, index) => (
            <motion.div
              key={firm.slug}
              className="w-full"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{
                duration: 0.7,
                delay: index * 0.15,
                ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
              }}
            >
              <PortfolioPreview
                title={firm.title}
                subtitle={firm.subtitle}
                slug={firm.slug}
                accentColor={firm.accentColor}
                onNavigate={(slug: string) => router.push(`/portfolio/${slug}`)}
              >
                <firm.component />
              </PortfolioPreview>
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-24 text-center"
        >
          <div className="max-w-4xl mx-auto p-6 md:p-20 rounded-[1.5rem] md:rounded-[3rem] border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-t from-blue-500/10 to-transparent pointer-events-none" />
            <div className="relative z-10">
              <h2 className="text-xl md:text-5xl font-bold text-[var(--text-main)] mb-4 md:mb-8 tracking-tight leading-tight">
                Want a Website Like These? <br className="hidden md:block" /><span className="text-blue-500">Let&apos;s Build Yours.</span>
              </h2>
              <p className="text-sm md:text-xl text-[var(--text-muted)] mb-6 md:mb-12 max-w-2xl mx-auto leading-relaxed font-medium">
                Every project is custom-designed to amplify what's already working.
                No templates, no shortcuts — just premium systems built for your firm.
              </p>
              <button
                onClick={openBooking}
                className="inline-flex items-center gap-2 md:gap-3 bg-blue-600 text-white px-6 md:px-10 py-3 md:py-5 rounded-full text-sm md:text-lg font-bold hover:bg-blue-500 hover:scale-105 transition-all shadow-xl shadow-blue-600/25 active:scale-95 group"
              >
                Book a Consultation
                <ArrowRight size={16} className="md:w-5 md:h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </motion.section>
      </section>
    </div>
  );
};

export default Portfolio;
