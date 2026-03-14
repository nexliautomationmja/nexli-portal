'use client';
import React, { useEffect, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';
import FirmNavbar from './FirmNavbar';
import { summitTaxConfig } from './firmBrandConfigs';

/* ------------------------------------------------------------------ */
/*  Color tokens                                                       */
/* ------------------------------------------------------------------ */
const COLORS = {
  primary: '#7c3aed',
  light: '#a78bfa',
  dark: '#4c1d95',
  deepDark: '#1e1b4b',
  white: '#ffffff',
  offWhite: '#f5f3ff',
  gray: '#f9fafb',
  textMuted: '#6b7280',
};

/* ------------------------------------------------------------------ */
/*  Shared animation variants                                          */
/* ------------------------------------------------------------------ */
const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.15, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
};

/* ================================================================== */
/*  INLINE SVG CHARTS                                                  */
/* ================================================================== */

/* ---------- Donut Chart ------------------------------------------- */
const DONUT_DATA = [
  { label: 'Federal', pct: 42, color: '#4c1d95' },
  { label: 'State', pct: 28, color: '#7c3aed' },
  { label: 'Deductions', pct: 18, color: '#a78bfa' },
  { label: 'Credits', pct: 12, color: '#c4b5fd' },
];

const DONUT_RADIUS = 80;
const DONUT_STROKE = 28;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

function DonutChart() {
  const [isInView, setIsInView] = useState(false);

  let cumulative = 0;
  const segments = DONUT_DATA.map((d) => {
    const offset = cumulative;
    cumulative += d.pct;
    return { ...d, offset };
  });

  return (
    <motion.div
      onViewportEnter={() => setIsInView(true)}
      viewport={{ once: true, amount: 0.4 }}
      className="flex flex-col items-center"
    >
      <svg viewBox="0 0 220 220" width="260" height="260">
        {/* Background ring */}
        <circle
          cx="110"
          cy="110"
          r={DONUT_RADIUS}
          fill="none"
          stroke="#ede9fe"
          strokeWidth={DONUT_STROKE}
        />

        {/* Data segments */}
        {segments.map((seg, idx) => {
          const dashLength = (seg.pct / 100) * DONUT_CIRCUMFERENCE;
          const gapLength = DONUT_CIRCUMFERENCE - dashLength;
          const rotateAngle = (seg.offset / 100) * 360 - 90;

          return (
            <circle
              key={idx}
              cx="110"
              cy="110"
              r={DONUT_RADIUS}
              fill="none"
              stroke={seg.color}
              strokeWidth={DONUT_STROKE}
              strokeDasharray={`${dashLength} ${gapLength}`}
              strokeDashoffset={isInView ? 0 : DONUT_CIRCUMFERENCE}
              strokeLinecap="butt"
              transform={`rotate(${rotateAngle} 110 110)`}
              style={{
                transition: `stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1) ${idx * 0.2}s`,
              }}
            />
          );
        })}

        {/* Center text */}
        <text
          x="110"
          y="105"
          textAnchor="middle"
          fill={COLORS.dark}
          fontSize="22"
          fontWeight="bold"
          fontFamily="system-ui, sans-serif"
        >
          Tax
        </text>
        <text
          x="110"
          y="126"
          textAnchor="middle"
          fill={COLORS.textMuted}
          fontSize="13"
          fontFamily="system-ui, sans-serif"
        >
          Breakdown
        </text>
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 mt-4">
        {DONUT_DATA.map((d) => (
          <div key={d.label} className="flex items-center gap-2 text-sm">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ backgroundColor: d.color }}
            />
            <span className="text-gray-600">
              {d.label} <span className="font-semibold">{d.pct}%</span>
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ---------- Bar Chart --------------------------------------------- */
const BAR_DATA = [
  { year: '2021', value: 45 },
  { year: '2022', value: 62 },
  { year: '2023', value: 84 },
  { year: '2024', value: 105 },
  { year: '2025', value: 125 },
];
const BAR_MAX = 140;
const CHART_W = 380;
const CHART_H = 220;
const BAR_BOTTOM = CHART_H - 30;
const BAR_TOP = 20;
const BAR_WIDTH = 40;
const BAR_GAP = (CHART_W - 50 - BAR_DATA.length * BAR_WIDTH) / (BAR_DATA.length - 1);

function BarChart() {
  const [isInView, setIsInView] = useState(false);

  return (
    <motion.div
      onViewportEnter={() => setIsInView(true)}
      viewport={{ once: true, amount: 0.4 }}
      className="flex flex-col items-center"
    >
      <h4
        className="text-base font-semibold mb-3"
        style={{ color: COLORS.dark }}
      >
        Tax Savings Over Time
      </h4>

      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        width="100%"
        style={{ maxWidth: 420 }}
      >
        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.primary} />
            <stop offset="100%" stopColor={COLORS.dark} />
          </linearGradient>
        </defs>

        {/* Y-axis gridlines */}
        {[0, 35, 70, 105, 140].map((tick) => {
          const y =
            BAR_BOTTOM -
            ((tick / BAR_MAX) * (BAR_BOTTOM - BAR_TOP));
          return (
            <g key={tick}>
              <line
                x1="42"
                y1={y}
                x2={CHART_W - 10}
                y2={y}
                stroke="#e5e7eb"
                strokeWidth="1"
              />
              <text
                x="38"
                y={y + 4}
                textAnchor="end"
                fill={COLORS.textMuted}
                fontSize="10"
                fontFamily="system-ui, sans-serif"
              >
                ${tick}K
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {BAR_DATA.map((d, idx) => {
          const x = 50 + idx * (BAR_WIDTH + BAR_GAP);
          const barHeight =
            (d.value / BAR_MAX) * (BAR_BOTTOM - BAR_TOP);
          const y = BAR_BOTTOM - barHeight;

          return (
            <g key={d.year}>
              {/* Bar */}
              <rect
                x={x}
                y={isInView ? y : BAR_BOTTOM}
                width={BAR_WIDTH}
                height={isInView ? barHeight : 0}
                rx="4"
                fill="url(#barGrad)"
                style={{
                  transition: `y 0.8s cubic-bezier(0.4,0,0.2,1) ${idx * 0.12}s, height 0.8s cubic-bezier(0.4,0,0.2,1) ${idx * 0.12}s`,
                }}
              />

              {/* Value label */}
              <text
                x={x + BAR_WIDTH / 2}
                y={isInView ? y - 6 : BAR_BOTTOM - 6}
                textAnchor="middle"
                fill={COLORS.primary}
                fontSize="11"
                fontWeight="600"
                fontFamily="system-ui, sans-serif"
                style={{
                  transition: `y 0.8s cubic-bezier(0.4,0,0.2,1) ${idx * 0.12}s`,
                  opacity: isInView ? 1 : 0,
                  transitionProperty: 'y, opacity',
                }}
              >
                ${d.value}K
              </text>

              {/* Year label */}
              <text
                x={x + BAR_WIDTH / 2}
                y={BAR_BOTTOM + 16}
                textAnchor="middle"
                fill={COLORS.textMuted}
                fontSize="11"
                fontFamily="system-ui, sans-serif"
              >
                {d.year}
              </text>
            </g>
          );
        })}
      </svg>
    </motion.div>
  );
}

/* ================================================================== */
/*  SERVICE CARD ICONS (inline SVG)                                    */
/* ================================================================== */
function ShieldCheckIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke={COLORS.primary}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke={COLORS.primary}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01" />
    </svg>
  );
}

function ChartLineIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke={COLORS.primary}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 3v18h18" />
      <path d="M7 16l4-6 4 4 5-8" />
    </svg>
  );
}

/* ================================================================== */
/*  FLOATING SHAPES (hero background)                                  */
/* ================================================================== */
function FloatingShapes() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Circle 1 */}
      <div
        className="absolute rounded-full opacity-10"
        style={{
          width: 300,
          height: 300,
          top: '-5%',
          right: '-5%',
          background: COLORS.light,
          animation: 'floatA 18s ease-in-out infinite',
        }}
      />
      {/* Circle 2 */}
      <div
        className="absolute rounded-full opacity-[0.07]"
        style={{
          width: 200,
          height: 200,
          bottom: '10%',
          left: '5%',
          background: COLORS.white,
          animation: 'floatB 22s ease-in-out infinite',
        }}
      />
      {/* Triangle SVG */}
      <svg
        className="absolute opacity-[0.08]"
        style={{
          width: 160,
          height: 160,
          top: '60%',
          right: '15%',
          animation: 'floatC 20s ease-in-out infinite',
        }}
        viewBox="0 0 100 100"
      >
        <polygon points="50,5 95,95 5,95" fill={COLORS.white} />
      </svg>
      {/* Small circle */}
      <div
        className="absolute rounded-full opacity-[0.12]"
        style={{
          width: 80,
          height: 80,
          top: '25%',
          left: '20%',
          border: `2px solid ${COLORS.light}`,
          animation: 'floatA 15s ease-in-out infinite reverse',
        }}
      />
      {/* Diamond */}
      <svg
        className="absolute opacity-[0.06]"
        style={{
          width: 100,
          height: 100,
          bottom: '20%',
          right: '40%',
          animation: 'floatB 25s ease-in-out infinite',
        }}
        viewBox="0 0 100 100"
      >
        <rect
          x="15"
          y="15"
          width="70"
          height="70"
          rx="4"
          fill={COLORS.white}
          transform="rotate(45 50 50)"
        />
      </svg>
    </div>
  );
}

/* ================================================================== */
/*  KEYFRAMES (injected once)                                          */
/* ================================================================== */
const KEYFRAMES_CSS = `
@keyframes floatA {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50%      { transform: translateY(-30px) rotate(6deg); }
}
@keyframes floatB {
  0%, 100% { transform: translateY(0) translateX(0); }
  33%      { transform: translateY(-20px) translateX(15px); }
  66%      { transform: translateY(10px) translateX(-10px); }
}
@keyframes floatC {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50%      { transform: translateY(-25px) rotate(-8deg); }
}
`;

/* ================================================================== */
/*  MAIN COMPONENT                                                     */
/* ================================================================== */
interface SummitTaxGroupProps {
  navigate?: (view: string, slug?: string) => void;
}

const SummitTaxGroup: React.FC<SummitTaxGroupProps> = ({ navigate }) => {
  /* Inject keyframes once */
  useEffect(() => {
    const id = 'summit-tax-keyframes';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.textContent = KEYFRAMES_CSS;
      document.head.appendChild(style);
    }
    return () => {
      const el = document.getElementById(id);
      if (el) el.remove();
    };
  }, []);

  /* ---------------------------------------------------------------- */
  /*  SERVICES DATA                                                    */
  /* ---------------------------------------------------------------- */
  const services = [
    {
      icon: <ShieldCheckIcon />,
      title: 'Tax Planning & Strategy',
      description:
        'Proactive tax strategies tailored to your unique financial situation. We analyze every opportunity to minimize your liability and maximize your savings year-round.',
    },
    {
      icon: <BuildingIcon />,
      title: 'Business Advisory',
      description:
        'From entity structuring to financial forecasting, our team guides growing businesses through complex decisions with clarity and confidence.',
    },
    {
      icon: <ChartLineIcon />,
      title: 'Audit & Compliance',
      description:
        'Stay ahead of regulatory changes with our comprehensive audit preparation and compliance management. We ensure accuracy so you never miss a beat.',
    },
  ];

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */
  return (
    <div className="w-full overflow-x-hidden" style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      <FirmNavbar config={summitTaxConfig} navigate={navigate} />

      {/* ============================================================ */}
      {/*  1. HERO SECTION                                             */}
      {/* ============================================================ */}
      <section
        className="relative min-h-[92vh] flex items-center justify-center px-6 pt-28 pb-24"
        style={{
          background: `linear-gradient(135deg, ${COLORS.dark} 0%, ${COLORS.primary} 60%, ${COLORS.light} 100%)`,
        }}
      >
        <FloatingShapes />

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
            className="text-5xl sm:text-6xl md:text-7xl font-extrabold text-white leading-tight tracking-tight"
          >
            Your Taxes. Optimized.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
            className="mt-6 text-lg sm:text-xl text-white/80 max-w-xl mx-auto leading-relaxed"
          >
            Strategic tax planning and advisory for businesses and individuals.
            Data-driven insights that save you more.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
            className="mt-10 flex flex-wrap justify-center gap-4"
          >
            <button
              className="px-8 py-3.5 rounded-lg font-semibold text-base shadow-lg transition-transform hover:scale-105 active:scale-95"
              style={{ backgroundColor: COLORS.white, color: COLORS.primary }}
            >
              Get Started
            </button>
            <button
              className="px-8 py-3.5 rounded-lg font-semibold text-base border-2 border-white/60 text-white bg-transparent transition-all hover:bg-white/10 hover:border-white hover:scale-105 active:scale-95"
            >
              See Our Results
            </button>
          </motion.div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  2. DASHBOARD PREVIEW SECTION                                */}
      {/* ============================================================ */}
      <section className="relative py-24 px-6" style={{ background: COLORS.white }}>
        <div className="max-w-6xl mx-auto">
          {/* Section heading */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
            custom={0}
            className="text-center mb-16"
          >
            <h2
              className="text-3xl sm:text-4xl font-bold"
              style={{ color: COLORS.dark }}
            >
              Smart tools. Smarter results.
            </h2>
            <p className="mt-3 text-gray-500 max-w-lg mx-auto">
              Our intelligent dashboard gives you real-time visibility into your
              tax position so you can act with confidence.
            </p>
          </motion.div>

          {/* Charts row */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start"
          >
            {/* Donut chart */}
            <motion.div
              variants={fadeUp}
              custom={0}
              className="rounded-2xl p-8 shadow-md border border-gray-100"
              style={{ background: COLORS.offWhite }}
            >
              <h3
                className="text-base font-semibold mb-4 text-center"
                style={{ color: COLORS.dark }}
              >
                Tax Liability Breakdown
              </h3>
              <DonutChart />
            </motion.div>

            {/* Bar chart */}
            <motion.div
              variants={fadeUp}
              custom={1}
              className="rounded-2xl p-8 shadow-md border border-gray-100"
              style={{ background: COLORS.offWhite }}
            >
              <BarChart />
            </motion.div>
          </motion.div>

          {/* Metric cards */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={staggerContainer}
            className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-14"
          >
            {[
              { value: '$125K+', label: 'Average Client Savings' },
              { value: '98%', label: 'Filing Accuracy' },
              { value: '2,400+', label: 'Returns Filed' },
            ].map((m, idx) => (
              <motion.div
                key={m.label}
                variants={fadeUp}
                custom={idx}
                className="relative rounded-xl p-6 shadow-sm border border-gray-100 overflow-hidden"
                style={{
                  background: 'rgba(255,255,255,0.75)',
                  backdropFilter: 'blur(12px)',
                }}
              >
                {/* Purple left accent */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
                  style={{ background: COLORS.primary }}
                />
                <p
                  className="text-3xl font-bold"
                  style={{ color: COLORS.primary }}
                >
                  {m.value}
                </p>
                <p className="mt-1 text-sm text-gray-500">{m.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  3. SERVICES GRID SECTION                                    */}
      {/* ============================================================ */}
      <section
        className="py-24 px-6"
        style={{ background: COLORS.gray }}
      >
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={fadeUp}
            custom={0}
            className="text-center mb-14"
          >
            <h2
              className="text-3xl sm:text-4xl font-bold"
              style={{ color: COLORS.dark }}
            >
              What We Do
            </h2>
            <p className="mt-3 text-gray-500 max-w-lg mx-auto">
              Comprehensive tax and advisory services designed to protect and
              grow your wealth.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {services.map((svc, idx) => (
              <motion.div
                key={svc.title}
                variants={fadeUp}
                custom={idx}
                whileHover={{ scale: 1.04, borderColor: COLORS.primary }}
                className="rounded-2xl bg-white p-8 shadow-sm border-2 border-transparent transition-colors cursor-default"
              >
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center mb-5"
                  style={{ background: COLORS.offWhite }}
                >
                  {svc.icon}
                </div>
                <h3
                  className="text-xl font-bold mb-3"
                  style={{ color: COLORS.dark }}
                >
                  {svc.title}
                </h3>
                <p className="text-gray-500 leading-relaxed text-sm">
                  {svc.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  4. CTA SECTION                                              */}
      {/* ============================================================ */}
      <section
        className="py-24 px-6 text-center"
        style={{
          background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.dark} 100%)`,
        }}
      >
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
          variants={fadeUp}
          custom={0}
          className="max-w-2xl mx-auto"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
            Ready to optimize your tax strategy?
          </h2>
          <p className="mt-4 text-white/70 text-lg">
            Join thousands of clients who save smarter every year with Summit
            Tax Group.
          </p>
          <motion.button
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.96 }}
            className="mt-10 inline-block px-10 py-4 rounded-lg font-bold text-lg shadow-xl transition-shadow hover:shadow-2xl"
            style={{ backgroundColor: COLORS.white, color: COLORS.primary }}
          >
            Get Your Free Tax Assessment
          </motion.button>
        </motion.div>
      </section>

      {/* ============================================================ */}
      {/*  5. FOOTER                                                   */}
      {/* ============================================================ */}
      <footer
        className="py-14 px-6 text-center"
        style={{ background: COLORS.deepDark }}
      >
        <div className="max-w-4xl mx-auto">
          <p className="text-2xl font-bold text-white tracking-tight">
            Summit Tax Group
          </p>
          <p className="mt-2 text-sm text-white/50">
            Strategic tax planning &amp; advisory
          </p>
          <div className="mt-8 border-t border-white/10 pt-6">
            <p className="text-xs text-white/30">
              &copy; {new Date().getFullYear()} Summit Tax Group. All rights
              reserved. This is a demo site.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default SummitTaxGroup;
