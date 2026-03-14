'use client';
import React from 'react';
import { motion } from 'framer-motion';
import { Quote, Star } from 'lucide-react';

const testimonials = [
  {
    name: "Michael R., CPA",
    firm: "Summit Tax Advisors",
    initials: "MR",
    color: "#4F46E5",
    revenue: "$85M Revenue",
    text: "Our old website was 'fine'—but fine doesn't close high-value clients. The new site Nexli built positions us as the premium choice we actually are. We've booked 3 new consultations in the first month alone."
  },
  {
    name: "Sarah L., CPA",
    firm: "Lighthouse Accounting Group",
    initials: "SL",
    color: "#0891B2",
    revenue: "$120M Revenue",
    text: "I was spending 2+ hours a day on meeting prep and follow-ups. Their automations gave me that time back. Now I actually leave the office at 5pm and my client communication is better than ever."
  },
  {
    name: "James T., CPA",
    firm: "Cornerstone Tax Partners",
    initials: "JT",
    color: "#059669",
    revenue: "$200M+ Revenue",
    text: "The brand audit was right—we were losing 12+ hours a week to admin. The automated sequences they built now handle lead nurturing 24/7. Our consultation booking rate is up 40%."
  },
  {
    name: "Patricia M., EA",
    firm: "Meridian Accounting Partners",
    initials: "PM",
    color: "#D97706",
    revenue: "$65M Revenue",
    text: "What sold me was that they actually understand our industry. No generic templates—they built systems that work with how CPA firms actually operate. The ROI was obvious within 60 days."
  }
];

const Testimonials: React.FC = () => {
  return (
    <section className="relative py-12 md:py-32 overflow-hidden bg-[var(--bg-main)] transition-colors duration-300" id="testimonials">
      {/* Background Refinement */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_20%_20%,var(--accent-glow)_0%,transparent_50%)]" />
        <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_80%_80%,var(--accent-glow)_0%,transparent_50%)]" />
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-12 md:mb-24">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 mb-4 md:mb-6 px-3 py-1 md:px-4 md:py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20"
          >
            <span className="text-blue-400 text-[9px] md:text-xs font-black tracking-[0.2em] uppercase">The Impact</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, ease: "circOut" }}
            className="text-[var(--text-main)] mb-4 md:mb-6 text-2xl md:text-5xl font-bold"
          >
            Firms That Demanded <span className="text-blue-500">More</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-[var(--text-muted)] max-w-2xl mx-auto text-sm md:text-lg px-4"
          >
            From established CPA firms to high-growth practices, see how market leaders are reclaiming their time and elevating their operations.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-8">
          {testimonials.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.8, ease: "circOut" }}
              className="glass-card p-5 md:p-10 rounded-2xl md:rounded-[40px] relative border border-[var(--glass-border)] group transition-all"
            >
              <Quote className="absolute top-8 right-10 text-[var(--text-main)] opacity-5 group-hover:text-blue-500/10 transition-colors hidden sm:block" size={64} />

              <div className="flex gap-1 mb-5 md:mb-8">
                {[...Array(5)].map((_, j) => (
                  <Star key={j} className="text-blue-500 fill-blue-500" size={10} />
                ))}
              </div>

              <p className="text-[var(--text-main)]/90 leading-relaxed mb-6 md:mb-10 text-base md:text-xl font-medium italic transition-colors">
                "{item.text}"
              </p>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pt-6 md:pt-8 border-t border-[var(--glass-border)] gap-4">
                <div className="flex items-center gap-3 md:gap-5">
                  <div
                    className="w-10 h-10 md:w-14 md:h-14 rounded-lg md:rounded-2xl flex items-center justify-center font-black text-[var(--text-main)] text-xs md:text-base shadow-2xl border border-[var(--glass-border)]"
                    style={{ backgroundColor: `${item.color}33`, borderColor: item.color }}
                  >
                    <span style={{ color: item.color }}>{item.initials}</span>
                  </div>
                  <div>
                    <div className="text-[var(--text-main)] font-bold text-sm md:text-lg">{item.name}</div>
                    <div className="text-[var(--text-muted)] text-[10px] md:text-sm font-medium">{item.firm}</div>
                  </div>
                </div>
                <div className="sm:text-right">
                  <div className="text-[var(--text-muted)] opacity-50 text-[8px] md:text-[10px] font-black uppercase tracking-widest mb-0.5 md:mb-1">Portfolio</div>
                  <div className="text-blue-400 font-black text-sm md:text-lg">{item.revenue}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Key Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12 md:mt-32 grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-12 p-6 md:p-12 glass-card rounded-2xl md:rounded-[48px] border border-[var(--glass-border)]"
        >
          {[
            { label: "Firms Served", val: "50+" },
            { label: "Revenue Managed", val: "$2B+" },
            { label: "Weekly Time Saved", val: "12hrs" },
            { label: "Conversion Lift", val: "35%" }
          ].map((stat, i) => (
            <div key={i} className="text-center group">
              <div className="text-xl md:text-5xl font-black text-[var(--text-main)] mb-1.5 md:mb-3 group-hover:text-blue-500 transition-colors uppercase">{stat.val}</div>
              <div className="text-[var(--text-muted)] text-[7px] md:text-[10px] font-black uppercase tracking-[0.2em]">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default Testimonials;
