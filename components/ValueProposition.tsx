'use client';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Monitor, Bot, Zap, ArrowRight, AlertCircle, CheckCircle } from 'lucide-react';

const painPoints = [
  {
    id: "01",
    painTitle: "Your Clients Finally See You as the Premium Firm You Are.",
    painDescription: "Right now, your website is screaming 'I'm stuck in 2015'—and it's costing you high-value clients who judge your expertise by your digital presence. When prospects land on your homepage, they don't see the CPA who saves business owners six figures in taxes. They see another dated template that looks like everyone else's.",
    statistic: "73%",
    statisticLabel: "of prospects research your website before booking a call—and decide in 7 seconds whether you're worth their time",
    solutionTitle: "Premium Website That Commands Respect",
    solutionDescription: "We build custom websites that position you as the obvious choice for discerning clients. Strategic design, compelling copy, and modern functionality that communicates your expertise before you ever speak—so prospects see credibility, not just another accountant.",
    solutionBullets: [
      "Custom design that reflects your unique value and positions you as a premium firm",
      "Conversion-optimized layouts that turn visitors into consultation bookings",
      "Mobile-first builds that impress prospects researching you on the go"
    ],
    icon: <Monitor className="text-orange-500" size={32} />,
    color: "from-orange-500/20",
    video: "/videos/premium-firm.mp4",
    image: "/logos/Nexli Value Prop 1 .webp",
    mobileImage: "/logos/Nexli Value Prop 1-mobile.webp"
  },
  {
    id: "02",
    painTitle: "No More Chasing Clients for Missing Documents or Playing Email Tag During Tax Season.",
    painDescription: "You became a CPA to do strategic tax planning—not to send the third follow-up email asking for the same W-2. Every hour spent chasing documents, organizing files, and playing email ping-pong is an hour you're not doing billable work. This reactive chaos is suffocating your revenue and burning you out.",
    statistic: "40%",
    statisticLabel: "of a CPA's time during tax season is wasted on document management and administrative follow-up",
    solutionTitle: "Document Collection on Autopilot",
    solutionDescription: "Go from reactive chaos to proactive control. Intelligent systems that automatically request documents, send smart reminders, and organize everything by client—so you get your time back and your clients actually enjoy working with you.",
    solutionBullets: [
      "Automated document requests with smart follow-ups that eliminate email ping-pong",
      "Branded client portals where clients upload once and you never chase again",
      "Real-time tracking dashboard so you always know what's missing—without digging through email"
    ],
    icon: <Bot className="text-blue-500" size={32} />,
    color: "from-blue-500/20",
    video: "/videos/beach-video-cpa-5s.mp4",
    image: "/logos/Nexli Value Prop 2.webp",
    mobileImage: "/logos/Nexli Value Prop 2-mobile.webp"
  },
  {
    id: "03",
    painTitle: "Your Reputation Grows on Autopilot While You Focus on What You Do Best.",
    painDescription: "You know you need more Google reviews—but right now you have maybe three reviews from 2019. High-value prospects are comparing you to competitors with 47 five-star reviews and glowing testimonials. You know reviews drive trust and bookings, but you have no system to actually get them.",
    statistics: [
      { value: "5x", label: "more likely to book a consultation when you have 20+ recent reviews vs. 3 old ones" },
      { value: "92%", label: "of prospects read online reviews before choosing a CPA—and recency matters" }
    ],
    solutionTitle: "Google Review Engine That Runs Itself",
    solutionDescription: "Stop manually asking for reviews and hoping clients remember. Intelligent automation requests reviews at the perfect moment—right after tax filing or a big win—so your reputation grows on autopilot while you focus on delivering exceptional service.",
    solutionBullets: [
      "Automated review requests sent at the perfect moment (post-filing, after a big refund)",
      "One-click Google review links that make it effortless for happy clients to leave feedback",
      "Smart sequences that follow up with clients who haven't responded—without you lifting a finger"
    ],
    icon: <Zap className="text-green-500" size={32} />,
    color: "from-green-500/20",
    video: "/videos/value-prop-2.mp4",
    image: "/logos/Nexli Value Prop Section 3.webp",
    mobileImage: "/logos/Nexli Value Prop 3-mobile.webp"
  }
];

// Auto-sliding stat carousel component
const StatCarousel: React.FC<{ statistics: { value: string; label: string }[] }> = ({ statistics }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % statistics.length);
    }, 4000); // Change every 4 seconds

    return () => clearInterval(interval);
  }, [statistics.length]);

  return (
    <div className="relative overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-3 md:gap-6 p-4 md:p-6 glass-card rounded-xl md:rounded-3xl border border-[var(--glass-border)]"
        >
          <div className="text-2xl md:text-4xl font-black text-blue-500">{statistics[currentIndex].value}</div>
          <div className="h-8 md:h-10 w-[1px] bg-[var(--glass-border)]" />
          <p className="text-[var(--text-muted)] text-[9px] md:text-xs font-bold leading-tight uppercase tracking-wide">{statistics[currentIndex].label}</p>
        </motion.div>
      </AnimatePresence>
      {/* Carousel indicators */}
      <div className="flex justify-center gap-2 mt-3">
        {statistics.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            className={`w-1.5 h-1.5 rounded-full transition-all ${idx === currentIndex ? 'bg-blue-500 w-4' : 'bg-blue-500/30'}`}
          />
        ))}
      </div>
    </div>
  );
};

const ValueProposition: React.FC = () => {
  return (
    <section className="py-12 md:py-32 bg-[var(--bg-main)] transition-colors duration-300" id="solutions">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-12 md:mb-24 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 mb-4 md:mb-6 px-3 py-1 md:px-4 md:py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20"
          >
            <span className="text-blue-400 text-[9px] md:text-xs font-black tracking-[0.2em] uppercase">The Problems We Solve</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, ease: "circOut" }}
            className="text-[var(--text-main)] max-w-4xl mx-auto leading-tight text-2xl md:text-5xl lg:text-7xl font-bold"
          >
            Stop Losing Clients to Firms With <span className="text-blue-500 underline decoration-blue-500/30 underline-offset-8">Better Systems</span>
          </motion.h2>
        </div>

        <div className="space-y-20 md:space-y-48">
          {painPoints.map((point, idx) => (
            <motion.div
              key={point.id}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8, ease: "circOut" }}
              className={`grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-20 items-center ${idx % 2 === 1 ? 'lg:flex-row-reverse' : ''}`}
            >
              {/* Content Side */}
              <div className={`space-y-6 md:space-y-10 ${idx % 2 === 1 ? 'lg:order-2' : ''}`}>
                <div className="space-y-4 md:space-y-6">
                  <div className="flex items-center gap-3 md:gap-4">
                    <span className="text-4xl md:text-7xl font-black text-[var(--text-main)] opacity-5 select-none">{point.id}</span>
                    <div className="h-[1px] md:h-[2px] w-6 md:w-12 bg-blue-500/20" />
                    <span className="text-blue-400/80 text-[9px] md:text-xs font-black uppercase tracking-[0.2em]">The Inefficiency</span>
                  </div>
                  <h3 className="text-xl md:text-4xl font-bold text-[var(--text-main)] leading-tight">
                    {point.painTitle}
                  </h3>
                  <p className="text-[var(--text-muted)] leading-relaxed text-sm md:text-lg">
                    {point.painDescription}
                  </p>

                  {(point as any).statistics ? (
                    <StatCarousel statistics={(point as any).statistics} />
                  ) : (
                    <div className="flex items-center gap-3 md:gap-6 p-4 md:p-6 glass-card rounded-xl md:rounded-3xl border border-[var(--glass-border)]">
                      <div className="text-2xl md:text-4xl font-black text-blue-500">{(point as any).statistic}</div>
                      <div className="h-8 md:h-10 w-[1px] bg-[var(--glass-border)]" />
                      <p className="text-[var(--text-muted)] text-[9px] md:text-xs font-bold leading-tight uppercase tracking-wide">{(point as any).statisticLabel}</p>
                    </div>
                  )}
                </div>

                <div className="glass-card p-5 md:p-10 rounded-2xl md:rounded-[40px] border border-[var(--glass-border)] shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="flex items-center gap-4 mb-4 md:mb-6">
                    <div className="p-2 md:p-3 bg-blue-500/10 rounded-lg md:rounded-2xl border border-blue-500/20">
                      {React.cloneElement(point.icon as React.ReactElement<any>, { size: 20, className: 'text-blue-400' })}
                    </div>
                    <div>
                      <span className="text-blue-400 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] block mb-1">The High-End Fix</span>
                      <h4 className="text-base md:text-xl font-bold text-[var(--text-main)]">{point.solutionTitle}</h4>
                    </div>
                  </div>
                  <p className="text-[var(--text-muted)] text-xs md:text-base leading-relaxed mb-6 md:mb-8">
                    {point.solutionDescription}
                  </p>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    {point.solutionBullets.map((bullet, i) => (
                      <li key={i} className="flex items-start gap-2 md:gap-3 text-[var(--text-muted)] text-[10px] md:text-sm font-medium">
                        <CheckCircle className="text-blue-500 mt-0.5 flex-shrink-0" size={12} />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Image/Video Side */}
              <div className={`relative ${idx % 2 === 1 ? 'lg:order-1' : ''} group`}>
                <div className={`relative rounded-2xl md:rounded-[40px] overflow-hidden border border-[var(--glass-border)] shadow-3xl ${(point as any).video ? 'aspect-square md:aspect-video lg:aspect-[4/3]' : 'aspect-[4/5] md:aspect-video lg:aspect-[4/3]'}`}>
                  {(point as any).video ? (
                    /* Video */
                    <video
                      src={(point as any).video}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <>
                      {/* Desktop Image */}
                      <img
                        src={point.image}
                        alt={point.solutionTitle}
                        className="hidden md:block w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                        loading="lazy"
                      />
                      {/* Mobile Image */}
                      <img
                        src={(point as any).mobileImage}
                        alt={point.solutionTitle}
                        className="block md:hidden w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                        loading="lazy"
                      />
                    </>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-main)] via-transparent to-transparent opacity-60 dark:opacity-60" />
                </div>
                {/* Visual Flair */}
                <div className={`absolute inset-0 bg-blue-500/5 blur-[80px] -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-1000`} />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ValueProposition;
