'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight, Globe, Cpu, Star, CheckCircle, Zap, Clock, Bot, Calendar, Send, TrendingUp, FileText, Shield, Droplets, Monitor } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { useBooking } from './QualificationProvider';
import { Timeline } from './ui/Timeline';

const Services: React.FC = () => {
    const { theme } = useTheme();
    const router = useRouter();
    const { openBooking } = useBooking();

    // Google G with animated stars component for Step 3
    const GoogleReviewAnimation = () => {
        return (
            <div className="flex flex-col items-center justify-center gap-2 md:gap-4 py-4 md:py-8">
                <motion.div
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                >
                    <svg className="w-10 h-10 md:w-16 md:h-16" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                </motion.div>
                <div className="flex gap-1 md:gap-2">
                    {[1, 2, 3, 4, 5].map((s) => (
                        <motion.div
                            key={s}
                            initial={{ scale: 0, rotate: -30 }}
                            whileInView={{ scale: 1, rotate: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.3 + s * 0.1, type: "spring", stiffness: 200 }}
                        >
                            <Star
                                className="w-5 h-5 md:w-7 md:h-7 text-yellow-400 fill-yellow-400"
                                style={{ filter: 'drop-shadow(0 0 8px rgba(251,191,36,0.6))' }}
                            />
                        </motion.div>
                    ))}
                </div>
                <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.9 }}
                    className={`text-xs md:text-sm font-semibold ${theme === 'dark' ? 'text-white/70' : 'text-slate-600'}`}
                >
                    5-Star Reviews on Autopilot
                </motion.p>
            </div>
        );
    };

    // Timeline data for Digital Rainmaker System
    const timelineData = [
        {
            title: "Step 1",
            content: (
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
                            <Globe className="w-6 h-6 text-blue-500" />
                        </div>
                        <h4 className={`text-xl md:text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                            A Premium Website
                        </h4>
                    </div>
                    <p className={`mb-6 text-sm md:text-base leading-relaxed ${theme === 'dark' ? 'text-neutral-300' : 'text-slate-600'}`}>
                        Designed specifically for the financial services trust threshold (not a template, not a generic small business site). Your website should work as hard as you do.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                        {[
                            "Custom design tailored to your firm",
                            "Mobile-responsive & lightning fast",
                            "SEO-optimized structure",
                            "Integrated booking systems",
                            "Conversion-focused layouts",
                            "Trust signals & social proof"
                        ].map((benefit, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm">
                                <CheckCircle size={16} className="text-blue-500 shrink-0 mt-0.5" />
                                <span className={theme === 'dark' ? 'text-neutral-300' : 'text-slate-600'}>{benefit}</span>
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className={`rounded-xl p-4 border ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}
                        >
                            <TrendingUp className="w-8 h-8 text-blue-500 mb-2" />
                            <p className={`text-xs font-semibold ${theme === 'dark' ? 'text-white/70' : 'text-slate-500'}`}>
                                Convert visitors into booked consultations before the first call
                            </p>
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.1 }}
                            className={`rounded-xl p-4 border ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}
                        >
                            <Zap className="w-8 h-8 text-cyan-500 mb-2" />
                            <p className={`text-xs font-semibold ${theme === 'dark' ? 'text-white/70' : 'text-slate-500'}`}>
                                Stand out from competitors with outdated sites
                            </p>
                        </motion.div>
                    </div>

                    <button
                        onClick={() => router.push('/portfolio')}
                        className="inline-flex items-center gap-1.5 text-blue-500 text-sm font-bold hover:text-blue-400 transition-colors bg-transparent border-none p-0 cursor-pointer mt-6"
                    >
                        See Our Portfolio
                        <ArrowRight size={14} />
                    </button>
                </div>
            ),
        },
        {
            title: "Step 2",
            content: (
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                            <Cpu className="w-6 h-6 text-cyan-500" />
                        </div>
                        <h4 className={`text-xl md:text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                            An AI Automation Layer
                        </h4>
                    </div>
                    <p className={`mb-6 text-sm md:text-base leading-relaxed ${theme === 'dark' ? 'text-neutral-300' : 'text-slate-600'}`}>
                        That processes every inbound inquiry 24/7, follows up automatically, vets and nurtures prospects through intelligent sequences, and books qualified appointments to your calendar — without your staff lifting a finger.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                        {[
                            "24/7 inbound inquiry processing",
                            "Automated follow-up sequences",
                            "Intelligent prospect vetting & nurturing",
                            "Automated appointment booking",
                            "AI chat assistant for your site",
                            "Zero-touch prospect qualification",
                            "Secure client document collection"
                        ].map((benefit, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm">
                                <CheckCircle size={16} className="text-cyan-500 shrink-0 mt-0.5" />
                                <span className={theme === 'dark' ? 'text-neutral-300' : 'text-slate-600'}>{benefit}</span>
                            </div>
                        ))}
                    </div>
                    <div className={`rounded-2xl p-6 border ${theme === 'dark' ? 'bg-gradient-to-br from-cyan-950/50 to-blue-950/50 border-white/10' : 'bg-gradient-to-br from-cyan-50 to-blue-50 border-slate-200'}`}>
                        <div className="flex flex-wrap gap-4 justify-center">
                            {[
                                { icon: Clock, label: "24/7 Response" },
                                { icon: Bot, label: "AI Assistant" },
                                { icon: Send, label: "Auto Follow-up" },
                                { icon: Calendar, label: "Smart Booking" },
                                { icon: FileText, label: "Doc Vault" },
                            ].map((item, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    whileInView={{ opacity: 1, scale: 1 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.1 }}
                                    className="flex flex-col items-center gap-2"
                                >
                                    <div className={`p-3 rounded-xl ${theme === 'dark' ? 'bg-white/10' : 'bg-white shadow-sm'}`}>
                                        <item.icon className="w-6 h-6 text-cyan-500" />
                                    </div>
                                    <span className={`text-xs font-semibold ${theme === 'dark' ? 'text-white/70' : 'text-slate-600'}`}>
                                        {item.label}
                                    </span>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    {/* Document Portal callout */}
                    <div className={`rounded-2xl p-5 mt-6 border-2 border-dashed ${theme === 'dark' ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-cyan-500/40 bg-cyan-50'}`}>
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-cyan-500/20 shrink-0">
                                <Shield className="w-5 h-5 text-cyan-500" />
                            </div>
                            <div>
                                <p className={`font-bold mb-1 ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`}>
                                    Secure Document Collection
                                </p>
                                <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-neutral-300' : 'text-slate-600'}`}>
                                    Stop emailing W-2s. Collect client documents through your firm's own branded portal with AES-256 encryption and per-firm isolated storage.
                                </p>
                                <button
                                    onClick={() => router.push('/document-portal')}
                                    className="inline-flex items-center gap-1.5 text-cyan-500 text-sm font-bold hover:text-cyan-400 transition-colors bg-transparent border-none p-0 cursor-pointer"
                                >
                                    See the Demo
                                    <ArrowRight size={14} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => router.push('/ai-automations')}
                        className="inline-flex items-center gap-1.5 text-cyan-500 text-sm font-bold hover:text-cyan-400 transition-colors bg-transparent border-none p-0 cursor-pointer mt-6"
                    >
                        See AI Automations
                        <ArrowRight size={14} />
                    </button>
                </div>
            ),
        },
        {
            title: "Step 3",
            content: (
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                            <Star className="w-6 h-6 text-yellow-500" />
                        </div>
                        <h4 className={`text-xl md:text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                            A Google Review Amplification Engine
                        </h4>
                    </div>
                    <p className={`mb-6 text-sm md:text-base leading-relaxed ${theme === 'dark' ? 'text-neutral-300' : 'text-slate-600'}`}>
                        That automatically requests and routes Google reviews from satisfied clients, turning your happiest tax season clients into a compounding trust asset that reinforces your reputation year-round.
                    </p>

                    {/* The Secret Weapon callout */}
                    <div className={`rounded-2xl p-5 mb-6 border-2 border-dashed ${theme === 'dark' ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-yellow-500/40 bg-yellow-50'}`}>
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-yellow-500/20">
                                <Zap className="w-5 h-5 text-yellow-500" />
                            </div>
                            <div>
                                <p className={`font-bold mb-1 ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-600'}`}>
                                    Your Secret Weapon
                                </p>
                                <p className={`text-sm ${theme === 'dark' ? 'text-neutral-300' : 'text-slate-600'}`}>
                                    Nobody in the CPA web design world is talking about systematically engineering Google reviews as a trust amplification mechanism. Most CPAs have 4 to 12 reviews sitting on Google. The firms dominating local search have 80 or more.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                        {[
                            "Automated review requests via SMS & email",
                            "Triggers at the perfect moment",
                            "Happy clients routed to Google",
                            "Unhappy feedback stays private",
                            "Protect your Google rating",
                            "Compound your trust signals"
                        ].map((benefit, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm">
                                <CheckCircle size={16} className="text-yellow-500 shrink-0 mt-0.5" />
                                <span className={theme === 'dark' ? 'text-neutral-300' : 'text-slate-600'}>{benefit}</span>
                            </div>
                        ))}
                    </div>

                    {/* Google G with animated stars */}
                    <div className={`rounded-2xl border overflow-hidden ${theme === 'dark' ? 'bg-gradient-to-br from-slate-900 to-slate-950 border-white/10' : 'bg-gradient-to-br from-slate-100 to-white border-slate-200'}`}>
                        <GoogleReviewAnimation />
                        <div className={`px-4 pb-4 md:px-6 md:pb-6 flex items-center justify-center`}>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                viewport={{ once: true }}
                                transition={{ delay: 1, type: "spring", stiffness: 200 }}
                                className="relative inline-flex items-center rounded-full overflow-hidden p-[1px] md:p-[1.5px]"
                            >
                                {/* Rotating glow border */}
                                <span
                                    className="absolute inset-[-100%] animate-[shimmer_8s_linear_infinite] opacity-80"
                                    style={{
                                        background: 'conic-gradient(from 0deg at 50% 50%, #4285F4, #34A853, #FBBC05, #EA4335, #4285F4)'
                                    }}
                                />
                                {/* Outer glow effect */}
                                <span
                                    className="absolute inset-[-100%] animate-[shimmer_8s_linear_infinite] blur-md opacity-40"
                                    style={{
                                        background: 'conic-gradient(from 0deg at 50% 50%, #4285F4, #34A853, #FBBC05, #EA4335, #4285F4)'
                                    }}
                                />
                                {/* Inner pill content */}
                                <span className="relative z-10 inline-flex items-center gap-1.5 md:gap-2 px-3 py-1.5 md:px-5 md:py-2.5 rounded-full bg-[var(--bg-main)]">
                                    <svg className="w-3.5 h-3.5 md:w-[18px] md:h-[18px] flex-shrink-0" viewBox="0 0 24 24">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                    </svg>
                                    <span className="text-[var(--text-main)] text-[10px] md:text-sm font-black tracking-[0.1em] md:tracking-[0.15em] uppercase">Google Reviews</span>
                                </span>
                            </motion.div>
                        </div>
                    </div>

                    <button
                        onClick={() => router.push('/smart-reviews')}
                        className="inline-flex items-center gap-1.5 text-yellow-500 text-sm font-bold hover:text-yellow-400 transition-colors bg-transparent border-none p-0 cursor-pointer mt-6"
                    >
                        See Smart Reviews
                        <ArrowRight size={14} />
                    </button>
                </div>
            ),
        },
    ];

    // Google G SVG component for the hero sub-icons
    const GoogleGIcon = ({ size = 20, className = '' }: { size?: number; className?: string }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
    );

    // Hero sub-icons: each service's signature icon with its color
    const heroSubIcons = [
        { Icon: Monitor, color: 'blue', label: 'Website' },
        { Icon: Bot, color: 'violet', label: 'AI' },
        { Icon: Shield, color: 'cyan', label: 'Portal' },
        { Icon: null, color: 'amber', label: 'Reviews', isGoogle: true },
    ];

    const getIconColors = (color: string) => {
        const map: Record<string, { bg: string; border: string; text: string; shadow: string; glow: string }> = {
            blue: { bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: 'text-blue-400', shadow: 'rgba(37, 99, 235, 0.3)', glow: 'rgba(37, 99, 235, 0.4)' },
            violet: { bg: 'bg-violet-500/20', border: 'border-violet-500/30', text: 'text-violet-400', shadow: 'rgba(139, 92, 246, 0.3)', glow: 'rgba(139, 92, 246, 0.4)' },
            cyan: { bg: 'bg-cyan-500/20', border: 'border-cyan-500/30', text: 'text-cyan-400', shadow: 'rgba(6, 182, 212, 0.3)', glow: 'rgba(6, 182, 212, 0.4)' },
            amber: { bg: 'bg-amber-500/20', border: 'border-amber-500/30', text: 'text-amber-400', shadow: 'rgba(245, 158, 11, 0.3)', glow: 'rgba(245, 158, 11, 0.4)' },
        };
        return map[color] || map.blue;
    };

    return (
        <div className="pb-20 overflow-hidden">
            {/* ── SECTION 1: Hero — two-column layout matching other pages ── */}
            <section className="min-h-screen bg-[var(--bg-main)] transition-colors duration-300 pt-32 pb-20">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center mb-24">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.8, ease: 'circOut' }}
                        >
                            {/* Shimmer badge */}
                            <div className="relative inline-flex items-center mb-6 rounded-full overflow-hidden p-[1.5px]">
                                <span
                                    className="absolute inset-[-100%] animate-[shimmer_8s_linear_infinite] opacity-80"
                                    style={{
                                        background: 'conic-gradient(from 0deg at 50% 50%, #3B82F6, #8B5CF6, #06B6D4, #F59E0B, #3B82F6)'
                                    }}
                                />
                                <span
                                    className="absolute inset-[-100%] animate-[shimmer_8s_linear_infinite] blur-md opacity-40"
                                    style={{
                                        background: 'conic-gradient(from 0deg at 50% 50%, #3B82F6, #8B5CF6, #06B6D4, #F59E0B, #3B82F6)'
                                    }}
                                />
                                <span className="relative z-10 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--bg-main)]">
                                    <Droplets size={14} className="text-blue-400" />
                                    <span className="text-[var(--text-main)] text-[10px] md:text-xs font-black tracking-[0.2em] uppercase">Digital Rainmaker System</span>
                                </span>
                            </div>

                            <h1
                                className="text-[26px] sm:text-4xl md:text-6xl font-black text-[var(--text-main)] mb-6 leading-tight tracking-tighter"
                                style={{ fontFamily: "'Syne', sans-serif" }}
                            >
                                The Digital{' '}
                                <br className="hidden md:block" />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-violet-500 to-cyan-500">Rainmaker System.</span>
                            </h1>

                            {/* Mobile floating icons */}
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 1, ease: 'circOut' }}
                                className="flex lg:hidden items-center justify-center my-8 relative"
                            >
                                <div className="absolute inset-0 bg-blue-500/10 blur-[80px] rounded-full" />
                                <div className="relative z-10 flex flex-col items-center gap-3">
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
                                    >
                                        <Droplets size={48} className="text-blue-400" style={{ filter: 'drop-shadow(0 0 20px rgba(59, 130, 246, 0.4))' }} />
                                    </motion.div>
                                    <div className="flex gap-3" style={{ perspective: '600px' }}>
                                        {heroSubIcons.map((item, i) => {
                                            const colors = getIconColors(item.color);
                                            return (
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
                                                        y: { delay: 0.8 + i * 0.15, duration: 3 + i * 0.4, repeat: Infinity, ease: 'easeInOut' },
                                                        rotateX: { delay: 0.8 + i * 0.15, duration: 3.5 + i * 0.3, repeat: Infinity, ease: 'easeInOut' },
                                                        rotateY: { delay: 0.8 + i * 0.15, duration: 4 + i * 0.5, repeat: Infinity, ease: 'easeInOut' },
                                                    }}
                                                    style={{ transformStyle: 'preserve-3d' }}
                                                >
                                                    <div
                                                        className={`w-10 h-10 rounded-xl ${colors.bg} ${colors.border} border flex items-center justify-center`}
                                                        style={{ filter: `drop-shadow(0 4px 8px ${colors.shadow})` }}
                                                    >
                                                        {item.isGoogle ? (
                                                            <GoogleGIcon size={20} />
                                                        ) : item.Icon ? (
                                                            <item.Icon size={20} className={colors.text} />
                                                        ) : null}
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </motion.div>

                            <p className="text-sm sm:text-lg md:text-xl text-[var(--text-muted)] mb-8 max-w-xl leading-relaxed">
                                Your firm&apos;s business amplification system. A premium website, AI automation, and Google review engine — working together to process, vet, and nurture every inbound opportunity at light speed.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-3 sm:gap-5">
                                <button
                                    onClick={openBooking}
                                    className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 md:px-8 py-3 md:py-4 rounded-full text-sm font-bold hover:bg-blue-500 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-blue-600/20 group"
                                >
                                    See How It Works
                                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                                </button>
                            </div>
                        </motion.div>

                        {/* Right: floating icons (desktop) */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 1, ease: 'circOut' }}
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
                                    <Droplets size={48} className="text-blue-400" style={{ filter: 'drop-shadow(0 0 20px rgba(59, 130, 246, 0.4))' }} />
                                    <span className="text-3xl font-bold text-[var(--text-main)]">Rainmaker System</span>
                                </motion.div>
                                <div className="flex gap-3" style={{ perspective: '600px' }}>
                                    {heroSubIcons.map((item, i) => {
                                        const colors = getIconColors(item.color);
                                        return (
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
                                                    y: { delay: 0.8 + i * 0.15, duration: 3 + i * 0.4, repeat: Infinity, ease: 'easeInOut' },
                                                    rotateX: { delay: 0.8 + i * 0.15, duration: 3.5 + i * 0.3, repeat: Infinity, ease: 'easeInOut' },
                                                    rotateY: { delay: 0.8 + i * 0.15, duration: 4 + i * 0.5, repeat: Infinity, ease: 'easeInOut' },
                                                    rotateZ: { delay: 0.8 + i * 0.15, duration: 5 + i * 0.4, repeat: Infinity, ease: 'easeInOut' },
                                                }}
                                                style={{ transformStyle: 'preserve-3d' }}
                                            >
                                                <div
                                                    className={`w-14 h-14 rounded-2xl ${colors.bg} ${colors.border} border flex items-center justify-center`}
                                                    style={{ filter: `drop-shadow(0 4px 8px ${colors.shadow})` }}
                                                >
                                                    {item.isGoogle ? (
                                                        <GoogleGIcon size={28} />
                                                    ) : item.Icon ? (
                                                        <item.Icon size={28} className={colors.text} />
                                                    ) : null}
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Digital Rainmaker System Timeline */}
            <section className={`${theme === 'dark' ? 'bg-black' : 'bg-white'}`}>
                <Timeline data={timelineData} />
            </section>

            {/* Closing CTA Section */}
            <section className="px-4 md:px-6 mt-16 md:mt-32 text-center">
                <div className="max-w-4xl mx-auto p-6 md:p-20 rounded-[1.5rem] md:rounded-[3rem] border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-t from-blue-500/10 to-transparent pointer-events-none" />

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                    >
                        <h2 className="text-xl md:text-5xl font-bold mb-4 md:mb-8 tracking-tight leading-tight">
                            Build Your Vision. <br className="hidden md:block" /> <span className="text-blue-500">Automate Your Firm.</span>
                        </h2>
                        <p className="text-sm md:text-xl text-[var(--text-muted)] mb-6 md:mb-12 max-w-2xl mx-auto leading-relaxed font-medium">
                            Most firms bundle all three for a complete digital transformation. But if you need to start with just one — that works too. Let's talk about what makes sense for your firm.
                        </p>

                        <button
                            onClick={openBooking}
                            className="inline-flex items-center gap-2 md:gap-3 bg-blue-600 text-white px-6 md:px-10 py-3 md:py-5 rounded-full text-sm md:text-lg font-bold hover:bg-blue-500 hover:scale-105 transition-all shadow-xl shadow-blue-600/25 active:scale-95 group"
                        >
                            Book a Consultation
                            <ArrowRight size={16} className="md:w-5 md:h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </motion.div>
                </div>
            </section>
        </div>
    );
};

export default Services;
