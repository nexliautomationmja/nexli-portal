'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, useInView } from 'framer-motion';
import { useTheme } from '../ThemeProvider';
import FirmNavbar from './FirmNavbar';
import { clarityConfig } from './firmBrandConfigs';

// ---------------------------------------------------------------------------
// Animated Counter Hook
// ---------------------------------------------------------------------------
function useAnimatedCounter(
  target: number,
  duration: number = 2000,
  isInView: boolean,
  decimals: number = 0
): string {
  const [value, setValue] = useState(0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!isInView || hasAnimated.current) return;
    hasAnimated.current = true;

    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(eased * target);
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        setValue(target);
      }
    }

    requestAnimationFrame(tick);
  }, [isInView, target, duration]);

  return value.toFixed(decimals);
}

// ---------------------------------------------------------------------------
// Section wrapper for consistent spacing
// ---------------------------------------------------------------------------
const Section: React.FC<{
  children: React.ReactNode;
  bg?: string;
  className?: string;
  id?: string;
}> = ({ children, bg = '#0a0e1a', className = '', id }) => (
  <section
    id={id}
    className={`relative overflow-hidden ${className}`}
    style={{ backgroundColor: bg }}
  >
    {children}
  </section>
);

// ---------------------------------------------------------------------------
// Star rating SVG
// ---------------------------------------------------------------------------
const Stars: React.FC = () => (
  <div className="flex gap-1 mb-4">
    {[...Array(5)].map((_, i) => (
      <svg
        key={i}
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="#c9a96e"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
      </svg>
    ))}
  </div>
);

// ---------------------------------------------------------------------------
// Small Arrow-Right icon
// ---------------------------------------------------------------------------
const ArrowRight: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

// ---------------------------------------------------------------------------
// Small Arrow-Up icon (for chat input)
// ---------------------------------------------------------------------------
const ArrowUp: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <line x1="12" y1="19" x2="12" y2="5" />
    <polyline points="5 12 12 5 19 12" />
  </svg>
);

// ---------------------------------------------------------------------------
// ClarityAdvisory Landing Page
// ---------------------------------------------------------------------------
interface ClarityAdvisoryProps {
  navigate?: (view: string, slug?: string) => void;
}

const ClarityAdvisory: React.FC<ClarityAdvisoryProps> = ({ navigate: navigateProp }) => {
  const { theme } = useTheme();

  // Palette
  const navy = '#0a0e1a';
  const navyLight = '#0f1629';
  const navyDeep = '#050810';
  const cream = '#f5f0eb';
  const creamMuted = '#e8e0d5';
  const creamDark = '#b8a99a';
  const gold = '#c9a96e';
  const serif = 'Georgia, "Times New Roman", serif';
  const sans = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

  // Framer motion variants
  const fadeUp = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0 },
  };

  const stagger = {
    visible: {
      transition: { staggerChildren: 0.15 },
    },
  };

  // -----------------------------------------------------------------------
  // HERO
  // -----------------------------------------------------------------------
  const HeroSection = () => (
    <Section bg={navy} className="min-h-screen flex items-center justify-center pt-20">
      {/* Radial orb glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${gold}18 0%, ${gold}08 40%, transparent 70%)`,
        }}
      />

      <div className="relative z-10 max-w-3xl mx-auto px-6 py-32 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
          className="text-5xl md:text-7xl font-light leading-tight mb-8"
          style={{ fontFamily: serif, color: cream }}
        >
          <em className="font-normal" style={{ fontStyle: 'italic' }}>
            Own
          </em>{' '}
          your financial future.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
          className="text-lg md:text-xl leading-relaxed mb-10 max-w-2xl mx-auto"
          style={{ fontFamily: sans, color: creamDark }}
        >
          Clarity Advisory is your AI-powered financial partner. Track spending,
          investments, and net worth — all from one intelligent platform.
        </motion.p>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
          className="mb-10"
        >
          <button
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-sm font-semibold tracking-wide transition-all duration-300 hover:scale-105 cursor-pointer"
            style={{
              fontFamily: sans,
              color: cream,
              border: `1px solid ${gold}60`,
              background: `linear-gradient(135deg, ${gold}15 0%, transparent 100%)`,
            }}
          >
            Get Started
            <ArrowRight />
          </button>
        </motion.div>

        {/* AI Chat Input */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.6, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
          className="max-w-md mx-auto"
        >
          <div
            className="flex items-center gap-3 px-5 py-3.5 rounded-2xl"
            style={{
              background: `${navyLight}cc`,
              border: `1px solid ${creamDark}20`,
            }}
          >
            <span
              className="flex-1 text-left text-sm"
              style={{ fontFamily: sans, color: `${creamDark}80` }}
            >
              Where am I overspending?
            </span>
            <div
              className="flex items-center justify-center w-8 h-8 rounded-full"
              style={{
                background: `${gold}25`,
                border: `1px solid ${gold}40`,
                color: cream,
              }}
            >
              <ArrowUp className="opacity-70" />
            </div>
          </div>
        </motion.div>
      </div>
    </Section>
  );

  // -----------------------------------------------------------------------
  // FEATURES
  // -----------------------------------------------------------------------
  const FeaturesSection = () => {
    const features = [
      {
        title: 'Track Everything',
        description:
          'Sync all your finances. Connect all accounts to see your finances in one place.',
        visual: (
          <div
            className="rounded-xl p-4 mt-4"
            style={{
              background: `${navy}cc`,
              border: `1px solid ${creamDark}15`,
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span
                className="text-xs font-medium"
                style={{ color: creamDark, fontFamily: sans }}
              >
                Total Balance
              </span>
              <span
                className="text-[10px] px-2 py-0.5 rounded-full"
                style={{
                  background: '#10b98120',
                  color: '#10b981',
                  fontFamily: sans,
                }}
              >
                +2.4%
              </span>
            </div>
            <div
              className="text-2xl font-semibold"
              style={{ color: cream, fontFamily: sans }}
            >
              $48,250
            </div>
            <div
              className="text-[10px] mt-1"
              style={{ color: `${creamDark}60`, fontFamily: sans }}
            >
              Checking, Savings, Investments
            </div>
          </div>
        ),
      },
      {
        title: 'AI Insights',
        description:
          'Turn questions into answers you trust. Personalized advice grounded in your data.',
        visual: (
          <div className="mt-4 space-y-3">
            <div
              className="rounded-xl px-4 py-3 text-xs leading-relaxed max-w-[85%]"
              style={{
                background: `${gold}15`,
                border: `1px solid ${gold}25`,
                color: cream,
                fontFamily: sans,
              }}
            >
              Based on your data, you could save $340/mo by refinancing your
              auto loan.
            </div>
            <div
              className="rounded-xl px-4 py-3 text-xs leading-relaxed max-w-[70%] ml-auto"
              style={{
                background: `${creamDark}10`,
                border: `1px solid ${creamDark}15`,
                color: creamDark,
                fontFamily: sans,
              }}
            >
              Show me options
            </div>
          </div>
        ),
      },
      {
        title: 'Grow Your Money',
        description:
          'Monitor your portfolio in real time and dive deeper into every position.',
        visual: (
          <div
            className="rounded-xl p-4 mt-4"
            style={{
              background: `${navy}cc`,
              border: `1px solid ${creamDark}15`,
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <span
                className="text-xs font-medium"
                style={{ color: creamDark, fontFamily: sans }}
              >
                Portfolio
              </span>
              <span
                className="text-xs font-semibold"
                style={{ color: '#10b981', fontFamily: sans }}
              >
                +12.3%
              </span>
            </div>
            <svg
              viewBox="0 0 200 60"
              className="w-full"
              style={{ height: '60px' }}
            >
              <defs>
                <linearGradient
                  id="chartGradient"
                  x1="0%"
                  y1="0%"
                  x2="0%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor={gold} stopOpacity="0.3" />
                  <stop offset="100%" stopColor={gold} stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0 55 Q20 50, 40 45 T80 35 T120 25 T160 18 T200 8"
                fill="none"
                stroke={gold}
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M0 55 Q20 50, 40 45 T80 35 T120 25 T160 18 T200 8 L200 60 L0 60 Z"
                fill="url(#chartGradient)"
              />
            </svg>
          </div>
        ),
      },
    ];

    return (
      <Section bg={navyLight} className="py-24 md:py-32">
        <div className="max-w-6xl mx-auto px-6">
          {/* Section badge */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp}
            transition={{ duration: 0.7 }}
            className="text-center mb-16"
          >
            <span
              className="inline-block text-[11px] font-bold tracking-[0.25em] uppercase px-5 py-2 rounded-full mb-6"
              style={{
                fontFamily: sans,
                color: gold,
                border: `1px solid ${gold}30`,
                background: `${gold}08`,
              }}
            >
              SIMPLIFY YOUR MONEY
            </span>
          </motion.div>

          {/* Feature cards */}
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
          >
            {features.map((feature, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                className="rounded-2xl p-6 relative"
                style={{
                  background: `linear-gradient(135deg, ${navy}cc 0%, ${navyLight}ee 100%)`,
                  border: `1px solid ${creamDark}12`,
                  borderLeft: `3px solid ${gold}60`,
                  backdropFilter: 'blur(10px)',
                }}
              >
                <h3
                  className="text-xl font-semibold mb-2"
                  style={{ fontFamily: serif, color: cream }}
                >
                  {feature.title}
                </h3>
                <p
                  className="text-sm leading-relaxed"
                  style={{ fontFamily: sans, color: creamDark }}
                >
                  {feature.description}
                </p>
                {feature.visual}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </Section>
    );
  };

  // -----------------------------------------------------------------------
  // STATS
  // -----------------------------------------------------------------------
  const StatsSection = () => {
    const ref = useRef<HTMLDivElement>(null);
    const isInView = useInView(ref, { once: true, margin: '-100px' });

    const assetsValue = useAnimatedCounter(2.4, 2000, isInView, 1);
    const clientsValue = useAnimatedCounter(15, 2000, isInView, 0);
    const retentionValue = useAnimatedCounter(99.2, 2000, isInView, 1);
    const ratingValue = useAnimatedCounter(4.9, 2000, isInView, 1);

    const stats = [
      { value: `$${assetsValue}B`, label: 'Assets Monitored' },
      { value: `${clientsValue}K+`, label: 'Active Clients' },
      { value: `${retentionValue}%`, label: 'Client Retention' },
      { value: `${ratingValue}/5`, label: 'App Store Rating' },
    ];

    return (
      <Section bg={navy}>
        {/* Subtle top/bottom gradient border */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(180deg, ${navyLight}40 0%, transparent 20%, transparent 80%, ${navyLight}40 100%)`,
          }}
        />

        <div
          ref={ref}
          className="relative z-10 max-w-6xl mx-auto px-6 py-20 md:py-28"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 text-center">
            {stats.map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.7,
                  delay: i * 0.1,
                  ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
                }}
              >
                <div
                  className="text-4xl md:text-5xl font-bold mb-2"
                  style={{ fontFamily: sans, color: gold }}
                >
                  {stat.value}
                </div>
                <div
                  className="text-sm tracking-wide"
                  style={{ fontFamily: sans, color: creamDark }}
                >
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>
    );
  };

  // -----------------------------------------------------------------------
  // TESTIMONIALS
  // -----------------------------------------------------------------------
  const TestimonialsSection = () => {
    const testimonials = [
      {
        quote:
          'I was able to connect all my accounts and now I can see everything in one place. The AI insights are incredible.',
        author: 'Sarah W.',
      },
      {
        quote:
          'Clarity makes financial planning feel effortless. The forecasting tools helped me plan for retirement with confidence.',
        author: 'James R.',
      },
      {
        quote:
          'One app for everything. Finally a financial tool that doesn\'t feel overwhelming.',
        author: 'Michelle T.',
      },
    ];

    return (
      <Section bg={navy} className="py-24 md:py-32">
        <div className="max-w-6xl mx-auto px-6">
          <motion.h2
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={fadeUp}
            transition={{ duration: 0.7 }}
            className="text-3xl md:text-4xl font-light text-center mb-16"
            style={{ fontFamily: serif, color: cream }}
          >
            What people say
          </motion.h2>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
          >
            {testimonials.map((t, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                className="rounded-2xl p-6"
                style={{
                  background: `linear-gradient(135deg, ${navyLight}cc 0%, ${navy}ee 100%)`,
                  border: `1px solid ${creamDark}15`,
                  backdropFilter: 'blur(10px)',
                }}
              >
                <Stars />
                <p
                  className="text-sm leading-relaxed mb-6"
                  style={{ fontFamily: sans, color: creamMuted }}
                >
                  "{t.quote}"
                </p>
                <span
                  className="text-xs font-semibold tracking-wide"
                  style={{ fontFamily: sans, color: gold }}
                >
                  — {t.author}
                </span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </Section>
    );
  };

  // -----------------------------------------------------------------------
  // CTA
  // -----------------------------------------------------------------------
  const CTASection = () => (
    <Section
      bg={navy}
      className="py-24 md:py-32"
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(180deg, ${navy} 0%, ${navyLight} 50%, ${navy} 100%)`,
        }}
      />

      <div className="relative z-10 max-w-2xl mx-auto px-6 text-center">
        <motion.h2
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={fadeUp}
          transition={{ duration: 0.7 }}
          className="text-3xl md:text-5xl font-light leading-tight mb-6"
          style={{ fontFamily: serif, color: cream }}
        >
          Start your financial journey today
        </motion.h2>

        <motion.p
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={fadeUp}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="text-lg mb-10"
          style={{ fontFamily: sans, color: creamDark }}
        >
          $1 for your first year — limited time
        </motion.p>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={fadeUp}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          <button
            className="inline-flex items-center gap-2 px-10 py-4 rounded-full text-sm font-bold tracking-wide transition-all duration-300 hover:scale-105 cursor-pointer"
            style={{
              fontFamily: sans,
              color: navy,
              background: `linear-gradient(135deg, ${gold} 0%, ${creamMuted} 100%)`,
              border: 'none',
            }}
          >
            Get Started
            <ArrowRight />
          </button>
        </motion.div>
      </div>
    </Section>
  );

  // -----------------------------------------------------------------------
  // FOOTER
  // -----------------------------------------------------------------------
  const FooterSection = () => (
    <Section bg={navyDeep} className="py-16">
      <div className="max-w-6xl mx-auto px-6 text-center">
        <div
          className="text-2xl font-light mb-4"
          style={{ fontFamily: serif, color: cream }}
        >
          Clarity Advisory
        </div>
        <div
          className="text-xs tracking-wide"
          style={{ fontFamily: sans, color: `${creamDark}60` }}
        >
          &copy; {new Date().getFullYear()} Clarity Advisory. All rights
          reserved.
        </div>
      </div>
    </Section>
  );

  // -----------------------------------------------------------------------
  // RENDER
  // -----------------------------------------------------------------------
  return (
    <div style={{ fontFamily: sans, color: cream, background: navy }}>
      <FirmNavbar config={clarityConfig} navigate={navigateProp} />
      <HeroSection />
      <FeaturesSection />
      <StatsSection />
      <TestimonialsSection />
      <CTASection />
      <FooterSection />
    </div>
  );
};

export default ClarityAdvisory;
