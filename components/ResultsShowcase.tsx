'use client';
import React from 'react';
import { motion } from 'framer-motion';
import {
  UserPlus,
  TrendingUp,
  Calendar,
  DollarSign,
  Users,
  Mail,
  Sparkles,
  ArrowUpRight
} from 'lucide-react';
import { AnimatedList } from './AnimatedList';

interface NotificationItem {
  icon: React.ReactNode;
  gradient: string;
  title: string;
  description: string;
  time: string;
}

const notifications: NotificationItem[] = [
  {
    icon: <UserPlus className="w-4 h-4 text-white" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.2))' }} />,
    gradient: "linear-gradient(to bottom, #34d399, #059669)",
    title: "New Client Onboarded",
    description: "Dr. Sarah Mitchell — $1.8M portfolio",
    time: "Just now"
  },
  {
    icon: <TrendingUp className="w-4 h-4 text-white" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.2))' }} />,
    gradient: "linear-gradient(to bottom, #60a5fa, #2563eb)",
    title: "AUM Milestone Reached",
    description: "+$4.2M this quarter from inbound pipeline",
    time: "2m ago"
  },
  {
    icon: <Calendar className="w-4 h-4 text-white" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.2))' }} />,
    gradient: "linear-gradient(to bottom, #a78bfa, #7c3aed)",
    title: "Discovery Call Booked",
    description: "Business owner, $2.5M+ liquid assets",
    time: "5m ago"
  },
  {
    icon: <DollarSign className="w-4 h-4 text-white" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.2))' }} />,
    gradient: "linear-gradient(to bottom, #fbbf24, #d97706)",
    title: "Prospect Converted",
    description: "Website visitor → $3.1M account",
    time: "12m ago"
  },
  {
    icon: <Users className="w-4 h-4 text-white" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.2))' }} />,
    gradient: "linear-gradient(to bottom, #fb7185, #e11d48)",
    title: "Client Referral Received",
    description: "From James W. — Retired executive",
    time: "18m ago"
  },
  {
    icon: <Mail className="w-4 h-4 text-white" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.2))' }} />,
    gradient: "linear-gradient(to bottom, #22d3ee, #0891b2)",
    title: "Inquiry Auto-Processed",
    description: "Prospect vetted and qualified by AI",
    time: "24m ago"
  },
  {
    icon: <Sparkles className="w-4 h-4 text-white" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.2))' }} />,
    gradient: "linear-gradient(to bottom, #818cf8, #4f46e5)",
    title: "5-Star Review Posted",
    description: "\"Best decision for our family's wealth\"",
    time: "31m ago"
  },
  {
    icon: <ArrowUpRight className="w-4 h-4 text-white" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.2))' }} />,
    gradient: "linear-gradient(to bottom, #2dd4bf, #0d9488)",
    title: "Organic Traffic Surge",
    description: "+340% website visitors this month",
    time: "45m ago"
  }
];

const NotificationCard: React.FC<{ item: NotificationItem }> = ({ item }) => (
  <div className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)] backdrop-blur-md shadow-lg hover:scale-[1.02] transition-transform cursor-default">
    {/* iOS-style icon with gradient and subtle depth */}
    <div
      className="shrink-0 w-10 h-10 rounded-[10px] flex items-center justify-center relative overflow-hidden"
      style={{
        background: item.gradient,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15), inset 0 1px 1px rgba(255,255,255,0.2)'
      }}
    >
      {/* Top highlight for that iOS glossy feel */}
      <div
        className="absolute inset-x-0 top-0 h-1/2 rounded-t-[10px]"
        style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.3), transparent)' }}
      />
      {/* Icon */}
      <span className="relative z-10">{item.icon}</span>
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-[var(--text-main)] truncate">
        {item.title}
      </p>
      <p className="text-xs text-[var(--text-muted)] truncate">
        {item.description}
      </p>
    </div>
    <span className="shrink-0 text-[10px] text-[var(--text-muted)] font-medium">
      {item.time}
    </span>
  </div>
);

const ResultsShowcase: React.FC = () => {
  return (
    <section className="px-6 mb-16 md:mb-24">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          {/* Left: Copy */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6 leading-[1.1]">
              This Is What <span className="text-blue-500">Growth</span> Looks Like
            </h2>
            <p className="text-lg md:text-xl text-[var(--text-muted)] leading-relaxed mb-6">
              While you focus on serving clients, your digital presence works around the clock —
              capturing inbound inquiries, booking calls, and building trust before you ever
              pick up the phone.
            </p>
            <p className="text-base text-[var(--text-muted)] leading-relaxed hidden md:block">
              These aren't vanity metrics. These are the results that compound into
              <span className="text-[var(--text-main)] font-semibold"> real AUM growth</span> and a
              practice that runs itself.
            </p>
          </motion.div>

          {/* Right: Animated Notifications */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            {/* Glow effect behind the list */}
            <div className="absolute inset-0 bg-blue-500/10 blur-3xl rounded-full pointer-events-none" />

            {/* The animated list - constrained height on mobile */}
            <div className="relative max-w-md mx-auto lg:mx-0 lg:ml-auto max-h-[280px] md:max-h-none overflow-hidden">
              {/* Fade out gradient at bottom for mobile */}
              <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[var(--bg-main)] to-transparent z-10 md:hidden pointer-events-none" />

              <AnimatedList delay={2500} maxVisible={3}>
                {notifications.map((notification, index) => (
                  <NotificationCard key={index} item={notification} />
                ))}
              </AnimatedList>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default ResultsShowcase;
