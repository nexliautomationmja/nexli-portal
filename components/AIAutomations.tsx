'use client';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Zap,
    ArrowRight,
    PhoneOff,
    MessageSquare,
    Clock,
    CheckCircle,
    Send,
    Mail,
    Smartphone,
    MousePointerClick,
    BarChart3,
    CalendarCheck,
    Users,
    Bot,
    PhoneIncoming,
    PhoneMissed,
    Timer,
    TrendingUp,
    Star,
    Bell,
    Globe,
    ChevronDown,
    RotateCcw,
} from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { useBooking } from './QualificationProvider';

type DemoTab = 'missed-call' | 'website-lead';
type MissedCallStep = 'idle' | 'ringing' | 'missed' | 'texted' | 'booked';
type WebLeadStep = 'idle' | 'form-filled' | 'auto-reply' | 'nurture' | 'booked';

const AIAutomations: React.FC = () => {
    const { theme } = useTheme();
    const { openBooking } = useBooking();

    // Demo state
    const [demoTab, setDemoTab] = useState<DemoTab>('missed-call');
    const [missedCallStep, setMissedCallStep] = useState<MissedCallStep>('idle');
    const [webLeadStep, setWebLeadStep] = useState<WebLeadStep>('idle');
    const [activeStatIndex, setActiveStatIndex] = useState(0);
    const [statProgress, setStatProgress] = useState(0);
    const [expandedStep, setExpandedStep] = useState<number>(0);
    const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

    // Problem stats data
    const problemStats = [
        {
            id: 'speed',
            icon: <Timer className="w-5 h-5 md:w-6 md:h-6" />,
            stat: 'The Race',
            label: 'Speed to Lead',
            title: '78% of Clients Choose the First Firm to Respond',
            description: "When a prospect reaches out, a 5-minute response window is all you get. After that, your odds of converting drop by 400%. Most firms take hours — or never respond at all.",
            benefits: [
                'Response time is the #1 conversion factor',
                'After 5 minutes, lead quality drops 80%',
                'Competitors respond while you sleep',
                'Every hour of delay costs you clients',
            ],
        },
        {
            id: 'missed',
            icon: <PhoneMissed className="w-5 h-5 md:w-6 md:h-6" />,
            stat: 'The Leak',
            label: 'Revenue Lost Daily',
            title: '62% of Calls to Small Firms Go Unanswered',
            description: "Your phone rings during a client meeting, at lunch, after 5pm. Each missed call is a potential $10,000+ client walking straight to your competitor. And they almost never call back.",
            benefits: [
                'Average firm misses 6+ calls per day',
                'Only 20% of missed callers leave voicemail',
                'Each missed call = $1,200+ in lost revenue',
                'After-hours calls are highest intent',
            ],
        },
        {
            id: 'followup',
            icon: <MessageSquare className="w-5 h-5 md:w-6 md:h-6" />,
            stat: 'The Gap',
            label: 'Follow-Up Failure',
            title: '80% of Sales Need 5+ Follow-Ups — Most Firms Do One',
            description: "The money is in the follow-up, but 44% of professionals give up after a single attempt. Meanwhile, leads that receive consistent nurturing spend 47% more when they finally convert.",
            benefits: [
                '44% of firms stop after one follow-up',
                'Nurtured leads produce 50% more revenue',
                'Consistent follow-up builds trust over time',
                'Manual follow-up is the first thing that slips',
            ],
        },
    ];

    // Auto-progression for stats tabs
    useEffect(() => {
        const duration = 10000;
        const interval = 100;
        const step = (interval / duration) * 100;

        const timer = setInterval(() => {
            setStatProgress((prev) => {
                if (prev >= 100) {
                    setActiveStatIndex((current) => (current + 1) % problemStats.length);
                    return 0;
                }
                return prev + step;
            });
        }, interval);

        return () => clearInterval(timer);
    }, [activeStatIndex, problemStats.length]);

    const handleStatTabClick = (index: number) => {
        setActiveStatIndex(index);
        setStatProgress(0);
        if (window.innerWidth < 768) {
            const displayArea = document.getElementById('automation-stat-display');
            if (displayArea) {
                displayArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    };

    // Missed call demo flow
    const runMissedCallDemo = () => {
        setMissedCallStep('ringing');
        setTimeout(() => setMissedCallStep('missed'), 1500);
        setTimeout(() => setMissedCallStep('texted'), 3000);
        setTimeout(() => setMissedCallStep('booked'), 5500);
    };

    // Website lead demo flow
    const runWebLeadDemo = () => {
        setWebLeadStep('form-filled');
        setTimeout(() => setWebLeadStep('auto-reply'), 2000);
        setTimeout(() => setWebLeadStep('nurture'), 4000);
        setTimeout(() => setWebLeadStep('booked'), 6500);
    };

    const resetDemo = () => {
        setMissedCallStep('idle');
        setWebLeadStep('idle');
    };

    // How It Works cards
    const expandedStepCards = [
        { step: '01', title: 'Lead Comes In', description: 'A prospect calls, fills a form, or messages your business. Day or night, weekday or weekend — every lead is captured instantly.', bg: 'from-violet-950 via-purple-900 to-indigo-900' },
        { step: '02', title: 'Instant Response', description: 'Within seconds, your AI responds via SMS or email. Missed calls get an instant text-back. Form fills get a personalized reply. No lead waits.', bg: 'from-purple-950 via-violet-900 to-fuchsia-900' },
        { step: '03', title: 'Smart Nurture', description: 'Automated follow-up sequences keep your firm top-of-mind. Personalized messages go out on a schedule — building trust without lifting a finger.', bg: 'from-indigo-950 via-blue-900 to-violet-900' },
        { step: '04', title: 'Booked & Closed', description: 'The prospect books a consultation through your scheduling link. You show up prepared. The automation handled everything else.', bg: 'from-fuchsia-950 via-pink-900 to-purple-900' },
    ];
    const StepIcons = [PhoneIncoming, Zap, Send, CalendarCheck];

    // Features grid
    const features = [
        { icon: <PhoneMissed className="w-4 h-4 md:w-5 md:h-5" />, title: 'Missed-Call Text-Back', description: 'Every missed call triggers an instant SMS reply with your booking link. Never lose an after-hours lead again.', color: 'violet' },
        { icon: <Send className="w-4 h-4 md:w-5 md:h-5" />, title: 'Lead Nurture Sequences', description: 'Automated SMS and email sequences that keep prospects warm over days and weeks until they are ready to commit.', color: 'purple' },
        { icon: <CalendarCheck className="w-4 h-4 md:w-5 md:h-5" />, title: 'Auto-Booking', description: 'Prospects can book directly from any automated message. Your calendar fills itself while you focus on client work.', color: 'indigo' },
        { icon: <Mail className="w-4 h-4 md:w-5 md:h-5" />, title: 'Follow-Up SMS & Email', description: 'Appointment reminders, post-meeting follow-ups, and re-engagement campaigns — all on autopilot.', color: 'fuchsia' },
        { icon: <BarChart3 className="w-4 h-4 md:w-5 md:h-5" />, title: 'Pipeline Tracking', description: 'See every lead, their status, and which automations are active. Full visibility into your growth engine.', color: 'blue' },
        { icon: <Star className="w-4 h-4 md:w-5 md:h-5" />, title: 'Review Requests', description: 'After a great engagement, automatically request a Google review. Build your reputation while you sleep.', color: 'amber' },
    ];

    const colorMap: Record<string, { iconDark: string; iconLight: string; text: string }> = {
        violet: { iconDark: 'bg-violet-500/10 border-violet-500/20', iconLight: 'bg-violet-50 border-violet-200', text: 'text-violet-400' },
        purple: { iconDark: 'bg-purple-500/10 border-purple-500/20', iconLight: 'bg-purple-50 border-purple-200', text: 'text-purple-400' },
        indigo: { iconDark: 'bg-indigo-500/10 border-indigo-500/20', iconLight: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-400' },
        fuchsia: { iconDark: 'bg-fuchsia-500/10 border-fuchsia-500/20', iconLight: 'bg-fuchsia-50 border-fuchsia-200', text: 'text-fuchsia-400' },
        blue: { iconDark: 'bg-blue-500/10 border-blue-500/20', iconLight: 'bg-blue-50 border-blue-200', text: 'text-blue-400' },
        amber: { iconDark: 'bg-amber-500/10 border-amber-500/20', iconLight: 'bg-amber-50 border-amber-200', text: 'text-amber-400' },
    };

    // FAQ items
    const faqItems = [
        {
            question: 'Will my clients think the messages are impersonal?',
            answer: 'Not at all. Every message is written in your firm\'s voice with your branding. Clients see your name, your tone, and your personality. Most never realize it\'s automated — they just appreciate the fast, professional response.',
        },
        {
            question: 'Is this hard to set up?',
            answer: 'We handle everything. Setup takes less than 48 hours and requires zero technical knowledge from you. We configure your automations, write your message sequences, and connect everything to your existing phone number and calendar.',
        },
        {
            question: 'Is client data secure and compliant?',
            answer: 'Absolutely. All data is encrypted in transit and at rest. Our platform is built for professional services firms and follows industry best practices for data protection. Your client information never touches third-party servers.',
        },
        {
            question: 'What if I want to change the messaging or turn something off?',
            answer: 'You have full control. Pause, edit, or customize any automation at any time through your dashboard. Want to tweak the missed-call text? Change a nurture sequence? It takes seconds. And our team is always available to help.',
        },
    ];

    return (
        <div className="min-h-screen bg-[var(--bg-main)] transition-colors duration-300 pt-32 pb-20">
            <div className="max-w-7xl mx-auto px-6">

                {/* ── SECTION 1: Hero ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center mb-24">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8, ease: "circOut" }}
                    >
                        <div className="relative inline-flex items-center mb-6 rounded-full overflow-hidden p-[1.5px]">
                            <span
                                className="absolute inset-[-100%] animate-[shimmer_8s_linear_infinite] opacity-80"
                                style={{
                                    background: 'conic-gradient(from 0deg at 50% 50%, #8B5CF6, #7C3AED, #6D28D9, #A78BFA, #8B5CF6)'
                                }}
                            />
                            <span
                                className="absolute inset-[-100%] animate-[shimmer_8s_linear_infinite] blur-md opacity-40"
                                style={{
                                    background: 'conic-gradient(from 0deg at 50% 50%, #8B5CF6, #7C3AED, #6D28D9, #A78BFA, #8B5CF6)'
                                }}
                            />
                            <span className="relative z-10 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--bg-main)]">
                                <Bot size={14} className="text-violet-400" />
                                <span className="text-[var(--text-main)] text-[10px] md:text-xs font-black tracking-[0.2em] uppercase">AI Automations</span>
                            </span>
                        </div>

                        <h1 className="text-[26px] sm:text-4xl md:text-6xl font-black text-[var(--text-main)] mb-6 leading-tight tracking-tighter" style={{ fontFamily: "'Syne', sans-serif" }}>
                            Every Missed Call Is a{' '}
                            <br className="hidden md:block" /><span className="text-violet-500">Lost Client.</span> We Fix That.
                        </h1>

                        {/* Mobile-only animated visual */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 1, ease: "circOut" }}
                            className="flex lg:hidden items-center justify-center my-8 relative"
                        >
                            <div className="absolute inset-0 bg-violet-500/10 blur-[80px] rounded-full" />
                            <div className="relative z-10 flex flex-col items-center gap-3">
                                <motion.div
                                    initial={{ opacity: 0, scale: 0 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                                >
                                    <Bot size={48} className="text-violet-400" style={{ filter: 'drop-shadow(0 0 20px rgba(139, 92, 246, 0.4))' }} />
                                </motion.div>
                                <div className="flex gap-3" style={{ perspective: '600px' }}>
                                    {[PhoneOff, Zap, MessageSquare, CalendarCheck, CheckCircle].map((Icon, i) => (
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
                                            <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center" style={{ filter: 'drop-shadow(0 4px 8px rgba(139, 92, 246, 0.3))' }}>
                                                <Icon size={20} className="text-violet-400" />
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>

                        <p className="text-sm sm:text-lg md:text-xl text-[var(--text-muted)] mb-8 max-w-xl leading-relaxed">
                            Your firm loses thousands every month from missed calls, slow responses, and forgotten follow-ups. Our AI automations respond to every lead in seconds, nurture them around the clock, and book appointments while you focus on what you do best.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-5">
                            <button
                                onClick={() => document.getElementById('automation-demo')?.scrollIntoView({ behavior: 'smooth' })}
                                className="flex items-center justify-center gap-2 bg-violet-600 text-white px-6 md:px-8 py-3 md:py-4 rounded-full text-sm font-bold hover:bg-violet-500 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-violet-600/20 group"
                            >
                                See the Demo
                                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                            <button
                                onClick={openBooking}
                                className="flex items-center justify-center gap-2 px-6 md:px-8 py-3 md:py-4 rounded-full text-sm font-bold text-[var(--text-main)] border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-md hover:border-violet-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
                            >
                                Book Now
                            </button>
                        </div>
                    </motion.div>

                    {/* Right side decorative icons */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 1, ease: "circOut" }}
                        className="relative hidden lg:flex items-center justify-center"
                    >
                        <div className="absolute inset-0 bg-violet-500/10 blur-[100px] rounded-full" />
                        <div className="relative z-10 flex flex-col items-center gap-4">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2, duration: 0.6 }}
                                className="flex items-center gap-3"
                            >
                                <Bot size={48} className="text-violet-400" />
                                <span className="text-3xl font-bold text-[var(--text-main)]">AI Automations</span>
                            </motion.div>
                            <div className="flex gap-3" style={{ perspective: '600px' }}>
                                {[PhoneOff, Zap, MessageSquare, CalendarCheck, CheckCircle].map((Icon, i) => (
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
                                            className="w-14 h-14 rounded-2xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center"
                                            style={{ filter: 'drop-shadow(0 4px 8px rgba(139, 92, 246, 0.3))' }}
                                        >
                                            <Icon size={28} className="text-violet-400" />
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* ── SECTION 2: Problem/Stats ── */}
                <motion.section
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, ease: "circOut" }}
                    className="mb-24"
                >
                    <div className="text-center mb-12">
                        <div className="inline-flex items-center gap-2 mb-4 md:mb-6 px-3 py-1 md:px-4 md:py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20">
                            <BarChart3 size={14} className="text-violet-400" />
                            <span className="text-violet-400 text-[9px] md:text-xs font-black tracking-[0.2em] uppercase">The Problem</span>
                        </div>
                        <h2 className="text-2xl md:text-5xl font-bold text-[var(--text-main)] mb-4 md:mb-6">
                            Slow Response = <span className="text-violet-500">Lost Revenue</span>
                        </h2>
                        <p className="text-[var(--text-muted)] max-w-2xl mx-auto text-sm md:text-lg">
                            In professional services, the firm that responds first almost always wins the client. Here&apos;s what happens when you don&apos;t.
                        </p>
                    </div>

                    <div className="max-w-6xl mx-auto">
                        <div className={`relative rounded-[1.5rem] md:rounded-[3rem] border border-[var(--glass-border)] shadow-2xl overflow-hidden flex flex-col md:min-h-[600px] transition-colors duration-500 ${theme === 'dark' ? 'bg-[#050505]' : 'bg-white'}`}>

                            <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-full h-[300px] blur-[120px] pointer-events-none transition-opacity duration-500 ${theme === 'dark' ? 'bg-violet-500/5 opacity-100' : 'bg-violet-500/10 opacity-50'}`} />

                            <div id="automation-stat-display" className="flex-grow grid lg:grid-cols-2 gap-5 md:gap-12 p-5 md:p-16 items-center">
                                {/* Left: Content */}
                                <div className="relative z-10 order-2 lg:order-1">
                                    <AnimatePresence mode="wait">
                                        <motion.div
                                            key={activeStatIndex}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -20 }}
                                            transition={{ duration: 0.4 }}
                                        >
                                            <div className="mb-4 md:mb-6 flex items-center gap-2 md:gap-3 text-violet-500">
                                                <div className="p-1.5 md:p-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
                                                    {problemStats[activeStatIndex].icon}
                                                </div>
                                                <span className="font-bold tracking-widest uppercase text-[10px] md:text-xs">{problemStats[activeStatIndex].label}</span>
                                            </div>
                                            <h3 className="text-2xl md:text-4xl font-bold mb-4 md:mb-6 tracking-tight leading-tight text-[var(--text-main)]">
                                                {problemStats[activeStatIndex].title}
                                            </h3>
                                            <p className="text-[var(--text-muted)] text-sm md:text-lg leading-relaxed mb-5 md:mb-8">
                                                {problemStats[activeStatIndex].description}
                                            </p>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 md:gap-4">
                                                {problemStats[activeStatIndex].benefits.map((benefit, i) => (
                                                    <div key={i} className="flex items-start gap-2 md:gap-2.5 text-xs md:text-sm font-semibold">
                                                        <CheckCircle size={14} className="text-violet-500 shrink-0 mt-0.5 md:w-4 md:h-4" />
                                                        <span className="text-[var(--text-main)] opacity-90">{benefit}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    </AnimatePresence>
                                </div>

                                {/* Right: Scene */}
                                <div className="relative z-10 order-1 lg:order-2 h-full min-h-[260px] md:min-h-[300px] flex items-center justify-center">
                                    <AnimatePresence mode="wait">
                                        <motion.div
                                            key={activeStatIndex}
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 1.1 }}
                                            transition={{ duration: 0.5, ease: "easeOut" }}
                                            className="w-full h-full aspect-auto rounded-xl md:rounded-2xl border border-[var(--glass-border)] bg-gradient-to-br from-slate-900 to-slate-950 relative overflow-hidden flex items-center justify-center shadow-inner"
                                        >
                                            {/* Scene 1: Speed — countdown timer */}
                                            {activeStatIndex === 0 && (
                                                <div className="w-full h-full flex items-center justify-center p-4 md:p-8">
                                                    <div className="w-full max-w-sm space-y-3">
                                                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-4">
                                                            <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Time since lead inquiry</span>
                                                        </motion.div>
                                                        {/* Your firm — fast response */}
                                                        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="rounded-xl bg-violet-500/10 border border-violet-500/30 p-3 md:p-4">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="text-violet-400 text-xs font-bold">Your Firm (with Nexli)</span>
                                                                <span className="text-violet-300 text-lg font-black">0:05</span>
                                                            </div>
                                                            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                                                                <motion.div initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ delay: 0.4, duration: 1 }} className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500" />
                                                            </div>
                                                            <div className="flex items-center gap-1.5 mt-2">
                                                                <CheckCircle size={12} className="text-green-400" />
                                                                <span className="text-green-400 text-[10px] font-semibold">SMS sent instantly</span>
                                                            </div>
                                                        </motion.div>
                                                        {/* Competitor — slow */}
                                                        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }} className="rounded-xl bg-red-500/10 border border-red-500/30 p-3 md:p-4">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="text-red-400/70 text-xs font-bold">Average Competitor</span>
                                                                <span className="text-red-300/70 text-lg font-black">4:32:00</span>
                                                            </div>
                                                            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                                                                <motion.div initial={{ width: 0 }} animate={{ width: '15%' }} transition={{ delay: 0.7, duration: 2 }} className="h-full rounded-full bg-red-500/50" />
                                                            </div>
                                                            <div className="flex items-center gap-1.5 mt-2">
                                                                <Clock size={12} className="text-red-400/50" />
                                                                <span className="text-red-400/50 text-[10px] font-semibold">Still waiting to respond...</span>
                                                            </div>
                                                        </motion.div>
                                                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="text-center pt-2">
                                                            <span className="text-white/30 text-[9px]">78% of clients choose the first responder</span>
                                                        </motion.div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Scene 2: Missed calls — phone ringing */}
                                            {activeStatIndex === 1 && (
                                                <div className="w-full h-full flex items-center justify-center p-4 md:p-8">
                                                    <div className="flex flex-col items-center gap-4">
                                                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }} className="relative">
                                                            <div className="w-20 h-20 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                                                                <motion.div animate={{ rotate: [0, -10, 10, -10, 10, 0] }} transition={{ delay: 0.3, duration: 0.6, repeat: 2 }}>
                                                                    <PhoneOff size={36} className="text-red-400" />
                                                                </motion.div>
                                                            </div>
                                                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5, type: "spring" }} className="absolute -top-1 -right-1 w-7 h-7 bg-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-500/30 text-white text-[11px] font-bold">6</motion.div>
                                                        </motion.div>
                                                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="text-white/60 text-sm font-semibold text-center">6 missed calls today</motion.p>
                                                        <div className="space-y-2 w-full max-w-[240px]">
                                                            {['John P. — 9:14 AM', 'Maria S. — 11:30 AM', 'Robert K. — 2:45 PM'].map((call, i) => (
                                                                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 + i * 0.2 }} className="flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                                                                    <PhoneMissed size={12} className="text-red-400" />
                                                                    <span className="text-white/40 text-[10px]">{call}</span>
                                                                    <span className="ml-auto text-red-400/60 text-[9px]">No reply</span>
                                                                </motion.div>
                                                            ))}
                                                        </div>
                                                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20">
                                                            <span className="text-red-400 text-[10px] font-bold">Est. lost revenue: $7,200+</span>
                                                        </motion.div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Scene 3: Follow-up gap */}
                                            {activeStatIndex === 2 && (
                                                <div className="w-full h-full flex items-center justify-center p-4 md:p-8">
                                                    <div className="w-full max-w-[280px] space-y-3">
                                                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center mb-2">
                                                            <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Lead follow-up timeline</span>
                                                        </motion.div>
                                                        {[
                                                            { day: 'Day 1', action: 'Initial response', status: 'sent', color: 'violet' },
                                                            { day: 'Day 3', action: 'Follow-up #1', status: 'sent', color: 'violet' },
                                                            { day: 'Day 7', action: 'Value-add email', status: 'sent', color: 'violet' },
                                                            { day: 'Day 14', action: 'Check-in SMS', status: 'sent', color: 'violet' },
                                                            { day: 'Day 21', action: 'Meeting booked!', status: 'booked', color: 'green' },
                                                        ].map((item, i) => (
                                                            <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.15 }} className="flex items-center gap-3">
                                                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${item.color === 'green' ? 'bg-green-400' : 'bg-violet-400'}`} />
                                                                <div className="flex-1 flex items-center justify-between rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                                                                    <div>
                                                                        <span className="text-white/60 text-[10px] font-bold block">{item.day}</span>
                                                                        <span className="text-white/30 text-[9px]">{item.action}</span>
                                                                    </div>
                                                                    {item.status === 'booked' ? (
                                                                        <CheckCircle size={14} className="text-green-400" />
                                                                    ) : (
                                                                        <Send size={10} className="text-violet-400/60" />
                                                                    )}
                                                                </div>
                                                            </motion.div>
                                                        ))}
                                                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }} className="text-center pt-1">
                                                            <span className="text-white/30 text-[9px]">100% automated. Zero manual effort.</span>
                                                        </motion.div>
                                                    </div>
                                                </div>
                                            )}
                                        </motion.div>
                                    </AnimatePresence>
                                </div>
                            </div>

                            {/* Tab Navigation */}
                            <div className="relative z-10 border-t border-[var(--glass-border)]">
                                <div className="flex overflow-x-auto no-scrollbar" style={{ scrollbarWidth: 'none' }}>
                                    {problemStats.map((stat, i) => (
                                        <button
                                            key={stat.id}
                                            onClick={() => handleStatTabClick(i)}
                                            className={`flex-1 min-w-[120px] flex flex-col items-center gap-1.5 md:gap-2 px-3 md:px-6 py-3 md:py-5 text-center transition-all relative ${activeStatIndex === i ? 'text-violet-400' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
                                        >
                                            <div className="flex items-center gap-1.5 md:gap-2">
                                                <span className="[&>svg]:w-3.5 [&>svg]:h-3.5 md:[&>svg]:w-4 md:[&>svg]:h-4">{stat.icon}</span>
                                                <span className="text-[10px] md:text-sm font-bold whitespace-nowrap">{stat.stat}</span>
                                            </div>
                                            {/* Progress bar */}
                                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-transparent">
                                                {activeStatIndex === i && (
                                                    <motion.div
                                                        className="h-full bg-violet-500 rounded-full"
                                                        initial={{ width: '0%' }}
                                                        animate={{ width: `${statProgress}%` }}
                                                        transition={{ duration: 0.1, ease: 'linear' }}
                                                    />
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.section>

                {/* ── SECTION 3: Interactive Demo ── */}
                <motion.section
                    id="automation-demo"
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    className="mb-24"
                >
                    <div className="text-center mb-12">
                        <div className="inline-flex items-center gap-2 mb-4 md:mb-6 px-3 py-1 md:px-4 md:py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20">
                            <MousePointerClick size={14} className="text-violet-400" />
                            <span className="text-violet-400 text-[9px] md:text-xs font-black tracking-[0.2em] uppercase">Interactive Demo</span>
                        </div>
                        <h2 className="text-2xl md:text-5xl font-bold text-[var(--text-main)] mb-4 md:mb-6">
                            Watch Your <span className="text-violet-500">AI in Action</span>
                        </h2>
                        <p className="text-[var(--text-muted)] max-w-2xl mx-auto text-sm md:text-lg">
                            See exactly what happens when a lead reaches out. Pick a scenario below.
                        </p>
                    </div>

                    <div className="max-w-4xl mx-auto">
                        <div className={`rounded-[1.5rem] md:rounded-[3rem] border border-[var(--glass-border)] shadow-2xl overflow-hidden transition-colors duration-500 ${theme === 'dark' ? 'bg-[#050505]' : 'bg-white'}`}>

                            {/* Tab switcher */}
                            <div className="flex border-b border-[var(--glass-border)]">
                                <button
                                    onClick={() => { setDemoTab('missed-call'); resetDemo(); }}
                                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 text-sm font-bold transition-all ${demoTab === 'missed-call' ? 'text-violet-400 border-b-2 border-violet-500' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
                                >
                                    <PhoneOff size={16} />
                                    <span className="hidden sm:inline">Missed Call</span>
                                    <span className="sm:hidden">Missed Call</span>
                                </button>
                                <button
                                    onClick={() => { setDemoTab('website-lead'); resetDemo(); }}
                                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 text-sm font-bold transition-all ${demoTab === 'website-lead' ? 'text-violet-400 border-b-2 border-violet-500' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
                                >
                                    <Globe size={16} />
                                    <span className="hidden sm:inline">Website Lead</span>
                                    <span className="sm:hidden">Web Lead</span>
                                </button>
                            </div>

                            {/* Demo content */}
                            <div className="p-5 md:p-10 min-h-[400px] md:min-h-[500px]">
                                <AnimatePresence mode="wait">
                                    {/* MISSED CALL FLOW */}
                                    {demoTab === 'missed-call' && (
                                        <motion.div key="missed-call" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                            {missedCallStep === 'idle' && (
                                                <div className="flex flex-col items-center justify-center gap-6 py-8">
                                                    <div className="w-24 h-24 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                                                        <PhoneIncoming size={40} className="text-violet-400" />
                                                    </div>
                                                    <div className="text-center">
                                                        <h3 className="text-xl md:text-2xl font-bold text-[var(--text-main)] mb-2">It&apos;s 7:42 PM. Your phone rings.</h3>
                                                        <p className="text-[var(--text-muted)] text-sm max-w-md">You&apos;re at dinner with your family. A high-value prospect just called. Watch what happens next.</p>
                                                    </div>
                                                    <button onClick={runMissedCallDemo} className="flex items-center gap-2 bg-violet-600 text-white px-8 py-3 rounded-full text-sm font-bold hover:bg-violet-500 transition-all shadow-lg shadow-violet-600/20 group">
                                                        Simulate Missed Call
                                                        <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                                                    </button>
                                                </div>
                                            )}

                                            {missedCallStep === 'ringing' && (
                                                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center gap-4 py-8">
                                                    <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 0.5, repeat: 3 }} className="w-24 h-24 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                                                        <PhoneIncoming size={40} className="text-green-400" />
                                                    </motion.div>
                                                    <p className="text-green-400 text-lg font-bold">Incoming call...</p>
                                                    <p className="text-[var(--text-muted)] text-sm">Sarah M. — (555) 867-5309</p>
                                                </motion.div>
                                            )}

                                            {missedCallStep === 'missed' && (
                                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center gap-4 py-8">
                                                    <div className="w-24 h-24 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                                                        <PhoneMissed size={40} className="text-red-400" />
                                                    </div>
                                                    <p className="text-red-400 text-lg font-bold">Missed call</p>
                                                    <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm">
                                                        <Clock size={14} />
                                                        <span>Nexli AI detected missed call. Responding in 3 seconds...</span>
                                                    </div>
                                                    <div className="w-5 h-5 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
                                                </motion.div>
                                            )}

                                            {missedCallStep === 'texted' && (
                                                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center gap-5 py-4">
                                                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20">
                                                        <CheckCircle size={14} className="text-green-400" />
                                                        <span className="text-green-400 text-xs font-bold">Instant SMS sent to Sarah M.</span>
                                                    </div>
                                                    {/* Phone mockup */}
                                                    <div className="w-[260px] md:w-[300px] rounded-[2rem] border border-white/20 bg-black/60 backdrop-blur p-5 space-y-3">
                                                        <div className="flex justify-between text-white/30 text-[10px] px-1">
                                                            <span>7:42 PM</span>
                                                            <Smartphone size={10} />
                                                        </div>
                                                        <div className="rounded-2xl bg-white/10 border border-white/15 p-3 space-y-2">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-7 h-7 rounded-full bg-violet-500/20 flex items-center justify-center">
                                                                    <Bot size={12} className="text-violet-400" />
                                                                </div>
                                                                <div>
                                                                    <div className="text-white text-[11px] font-semibold">Your Firm</div>
                                                                    <div className="text-white/30 text-[9px]">Just now</div>
                                                                </div>
                                                            </div>
                                                            <p className="text-white/60 text-[10px] md:text-[11px] leading-relaxed">
                                                                Hi Sarah! Sorry we missed your call. We&apos;re available to help — would you like to book a quick consultation? Tap below to pick a time that works:
                                                            </p>
                                                            <div className="rounded-xl bg-violet-500 py-2.5 text-center text-white text-[10px] md:text-xs font-bold cursor-pointer hover:bg-violet-400 transition-colors">
                                                                Book a Consultation
                                                            </div>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}

                                            {missedCallStep === 'booked' && (
                                                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center gap-5 py-6">
                                                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }} className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                                                        <CalendarCheck size={36} className="text-green-500" />
                                                    </motion.div>
                                                    <h3 className="text-xl md:text-2xl font-bold text-[var(--text-main)]">Appointment Booked!</h3>
                                                    <div className={`rounded-2xl border p-5 w-full max-w-sm ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                                                        <div className="flex items-center gap-3 mb-3">
                                                            <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-400 text-sm font-bold">SM</div>
                                                            <div>
                                                                <p className="text-[var(--text-main)] text-sm font-bold">Sarah M.</p>
                                                                <p className="text-[var(--text-muted)] text-[10px]">New Client Consultation</p>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2 text-sm">
                                                            <div className="flex items-center gap-2 text-[var(--text-muted)]">
                                                                <CalendarCheck size={14} className="text-violet-400" />
                                                                <span>Tomorrow, 10:00 AM</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-[var(--text-muted)]">
                                                                <Clock size={14} className="text-violet-400" />
                                                                <span>30 minutes</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <p className="text-[var(--text-muted)] text-xs text-center max-w-sm">
                                                        Total time from missed call to booked appointment: <span className="text-violet-400 font-bold">47 seconds</span>. All automated.
                                                    </p>
                                                </motion.div>
                                            )}
                                        </motion.div>
                                    )}

                                    {/* WEBSITE LEAD FLOW */}
                                    {demoTab === 'website-lead' && (
                                        <motion.div key="website-lead" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                            {webLeadStep === 'idle' && (
                                                <div className="flex flex-col items-center justify-center gap-6 py-8">
                                                    <div className="w-24 h-24 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                                                        <Globe size={40} className="text-violet-400" />
                                                    </div>
                                                    <div className="text-center">
                                                        <h3 className="text-xl md:text-2xl font-bold text-[var(--text-main)] mb-2">A prospect fills your contact form.</h3>
                                                        <p className="text-[var(--text-muted)] text-sm max-w-md">It&apos;s 11 PM on a Sunday. They need a CPA. Watch how your AI converts them into a booked client.</p>
                                                    </div>
                                                    <button onClick={runWebLeadDemo} className="flex items-center gap-2 bg-violet-600 text-white px-8 py-3 rounded-full text-sm font-bold hover:bg-violet-500 transition-all shadow-lg shadow-violet-600/20 group">
                                                        Simulate Lead
                                                        <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                                                    </button>
                                                </div>
                                            )}

                                            {webLeadStep === 'form-filled' && (
                                                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center gap-5 py-4">
                                                    <div className="w-full max-w-sm rounded-xl border border-white/20 bg-black/50 backdrop-blur overflow-hidden">
                                                        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/10">
                                                            <div className="w-2 h-2 rounded-full bg-red-400/60" />
                                                            <div className="w-2 h-2 rounded-full bg-yellow-400/60" />
                                                            <div className="w-2 h-2 rounded-full bg-green-400/60" />
                                                            <div className="flex-1 mx-2 h-5 rounded-md bg-white/10 flex items-center px-2">
                                                                <span className="text-white/30 text-[8px]">yourfirm.com/contact</span>
                                                            </div>
                                                        </div>
                                                        <div className="p-5 space-y-3">
                                                            <p className="text-white/70 text-xs font-bold">Contact Us</p>
                                                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="h-8 rounded-lg bg-white/10 border border-white/15 flex items-center px-3">
                                                                <span className="text-white/40 text-[10px]">James K.</span>
                                                            </motion.div>
                                                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="h-8 rounded-lg bg-white/10 border border-white/15 flex items-center px-3">
                                                                <span className="text-white/40 text-[10px]">james.k@email.com</span>
                                                            </motion.div>
                                                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="h-8 rounded-lg bg-white/10 border border-white/15 flex items-center px-3">
                                                                <span className="text-white/40 text-[10px]">I need help with my business taxes...</span>
                                                            </motion.div>
                                                            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.8 }} className="rounded-lg bg-violet-500 py-2.5 text-center text-white text-xs font-bold">
                                                                Submit
                                                            </motion.div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[var(--text-muted)] text-xs">
                                                        <div className="w-4 h-4 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
                                                        <span>Form submitted. AI responding...</span>
                                                    </div>
                                                </motion.div>
                                            )}

                                            {webLeadStep === 'auto-reply' && (
                                                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center gap-5 py-4">
                                                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20">
                                                        <CheckCircle size={14} className="text-green-400" />
                                                        <span className="text-green-400 text-xs font-bold">Auto-reply sent in 4 seconds</span>
                                                    </div>
                                                    <div className="flex flex-col sm:flex-row gap-4 w-full max-w-lg">
                                                        {/* Email */}
                                                        <div className="flex-1 rounded-xl border border-white/15 bg-black/40 backdrop-blur p-4 space-y-2">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <Mail size={14} className="text-violet-400" />
                                                                <span className="text-white/60 text-[10px] font-bold">Email Sent</span>
                                                            </div>
                                                            <p className="text-white/40 text-[9px] leading-relaxed">Hi James, thank you for reaching out! We specialize in business tax services and would love to help. I&apos;ve included a link below to book a free consultation...</p>
                                                        </div>
                                                        {/* SMS */}
                                                        <div className="flex-1 rounded-xl border border-white/15 bg-black/40 backdrop-blur p-4 space-y-2">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <Smartphone size={14} className="text-violet-400" />
                                                                <span className="text-white/60 text-[10px] font-bold">SMS Sent</span>
                                                            </div>
                                                            <p className="text-white/40 text-[9px] leading-relaxed">Hi James! Thanks for contacting us. We&apos;d love to discuss your business tax needs. Book a time here: yourfirm.com/book</p>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}

                                            {webLeadStep === 'nurture' && (
                                                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center gap-5 py-4">
                                                    <p className="text-violet-400 text-xs font-bold uppercase tracking-widest">Nurture Sequence Active</p>
                                                    <div className="w-full max-w-sm space-y-2">
                                                        {[
                                                            { time: '4 sec', msg: 'Instant reply with booking link', done: true },
                                                            { time: 'Day 2', msg: 'Helpful tax tip + gentle follow-up', done: true },
                                                            { time: 'Day 5', msg: 'Client success story + calendar link', done: true },
                                                            { time: 'Day 8', msg: '"Still thinking? Here\'s what we can do..."', active: true },
                                                        ].map((item, i) => (
                                                            <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.2 }} className={`flex items-center gap-3 rounded-xl border p-3 ${item.active ? 'border-violet-500/30 bg-violet-500/10' : 'border-white/10 bg-white/5'}`}>
                                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${item.done ? 'bg-green-500/20' : 'bg-violet-500/20'}`}>
                                                                    {item.done ? <CheckCircle size={14} className="text-green-400" /> : <Send size={14} className="text-violet-400" />}
                                                                </div>
                                                                <div className="flex-1">
                                                                    <span className="text-white/30 text-[9px] font-bold block">{item.time}</span>
                                                                    <span className="text-white/60 text-[10px]">{item.msg}</span>
                                                                </div>
                                                            </motion.div>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            )}

                                            {webLeadStep === 'booked' && (
                                                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center gap-5 py-6">
                                                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }} className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                                                        <CalendarCheck size={36} className="text-green-500" />
                                                    </motion.div>
                                                    <h3 className="text-xl md:text-2xl font-bold text-[var(--text-main)]">Consultation Booked!</h3>
                                                    <div className={`rounded-2xl border p-5 w-full max-w-sm ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                                                        <div className="flex items-center gap-3 mb-3">
                                                            <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-400 text-sm font-bold">JK</div>
                                                            <div>
                                                                <p className="text-[var(--text-main)] text-sm font-bold">James K.</p>
                                                                <p className="text-[var(--text-muted)] text-[10px]">Business Tax Consultation</p>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2 text-sm">
                                                            <div className="flex items-center gap-2 text-[var(--text-muted)]">
                                                                <CalendarCheck size={14} className="text-violet-400" />
                                                                <span>Wednesday, 2:00 PM</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-[var(--text-muted)]">
                                                                <TrendingUp size={14} className="text-green-400" />
                                                                <span className="text-green-400 font-semibold">Converted from nurture sequence</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <p className="text-[var(--text-muted)] text-xs text-center max-w-sm">
                                                        From Sunday night form fill to Wednesday booking — <span className="text-violet-400 font-bold">100% automated</span>. You never touched a thing.
                                                    </p>
                                                </motion.div>
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Reset */}
                                {(missedCallStep !== 'idle' || webLeadStep !== 'idle') && (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-6 text-center">
                                        <button onClick={resetDemo} className="inline-flex items-center gap-2 text-violet-500 font-bold text-xs uppercase tracking-widest hover:text-violet-400 transition-colors bg-transparent border-none p-0">
                                            <RotateCcw size={14} />
                                            Try Again
                                        </button>
                                    </motion.div>
                                )}
                            </div>
                        </div>
                    </div>
                </motion.section>

                {/* ── SECTION 4: How It Works ── */}
                <motion.section
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    className="mb-24"
                >
                    <div className="text-center mb-12">
                        <div className="inline-flex items-center gap-2 mb-4 md:mb-6 px-3 py-1 md:px-4 md:py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20">
                            <Zap size={14} className="text-violet-400" />
                            <span className="text-violet-400 text-[9px] md:text-xs font-black tracking-[0.2em] uppercase">How It Works</span>
                        </div>
                        <h2 className="text-2xl md:text-5xl font-bold text-[var(--text-main)] mb-4">
                            From Lead to Client in <span className="text-violet-500">Four Steps</span>
                        </h2>
                    </div>

                    {/* Desktop: Expanding Cards */}
                    <div className="hidden md:flex gap-3 h-[520px] max-w-6xl mx-auto">
                        {expandedStepCards.map((item, i) => {
                            const isActive = expandedStep === i;
                            const StepIcon = StepIcons[i];
                            return (
                                <div
                                    key={i}
                                    className={`relative overflow-hidden rounded-[2rem] cursor-pointer border transition-[flex] duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] ${isActive ? 'flex-[4] border-white/20' : 'flex-[1] border-white/10 hover:border-white/15'}`}
                                    onMouseEnter={() => setExpandedStep(i)}
                                >
                                    <div className={`absolute inset-0 bg-gradient-to-br ${item.bg}`} />
                                    <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white transition-opacity duration-500 ${isActive ? 'opacity-[0.06]' : 'opacity-[0.04]'}`}>
                                        <StepIcon size={200} strokeWidth={0.5} />
                                    </div>

                                    {/* Scene illustrations */}
                                    <AnimatePresence>
                                        {isActive && (
                                            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.5 }} className="absolute inset-0 flex items-center justify-center pb-44">
                                                {i === 0 && (
                                                    <div className="relative">
                                                        <div className="w-[150px] h-[250px] rounded-[26px] border-2 border-white/20 bg-black/50 backdrop-blur p-3.5 relative">
                                                            <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-12 h-1.5 rounded-full bg-white/15" />
                                                            <div className="mt-6 space-y-2.5">
                                                                <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="rounded-xl bg-violet-500/20 border border-violet-500/30 p-2.5">
                                                                    <div className="flex items-center gap-1.5 mb-1">
                                                                        <PhoneIncoming size={10} className="text-violet-400" />
                                                                        <span className="text-white/70 text-[9px] font-semibold">Missed Call</span>
                                                                    </div>
                                                                    <p className="text-white/40 text-[8px]">Sarah M. — 7:42 PM</p>
                                                                </motion.div>
                                                                <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.5 }} className="rounded-xl bg-blue-500/20 border border-blue-500/30 p-2.5">
                                                                    <div className="flex items-center gap-1.5 mb-1">
                                                                        <Globe size={10} className="text-blue-400" />
                                                                        <span className="text-white/70 text-[9px] font-semibold">Web Form</span>
                                                                    </div>
                                                                    <p className="text-white/40 text-[8px]">James K. — 11:08 PM</p>
                                                                </motion.div>
                                                            </div>
                                                        </div>
                                                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.6, type: "spring" }} className="absolute -top-2 -right-2 w-7 h-7 bg-violet-500 rounded-full flex items-center justify-center text-white text-[11px] font-bold shadow-lg shadow-violet-500/30">2</motion.div>
                                                    </div>
                                                )}
                                                {i === 1 && (
                                                    <div className="flex flex-col items-center gap-3">
                                                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }}>
                                                            <Zap size={52} className="text-violet-400" />
                                                        </motion.div>
                                                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/20 border border-green-500/30">
                                                            <span className="text-green-400 text-lg font-black">0:05</span>
                                                        </motion.div>
                                                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="text-white/40 text-[10px] text-center">Response time</motion.p>
                                                        <div className="flex gap-2">
                                                            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 }} className="px-3 py-1.5 rounded-lg bg-violet-500/20 border border-violet-500/30">
                                                                <div className="flex items-center gap-1.5">
                                                                    <Smartphone size={10} className="text-violet-300" />
                                                                    <span className="text-violet-300 text-[9px] font-bold">SMS</span>
                                                                </div>
                                                            </motion.div>
                                                            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 }} className="px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/30">
                                                                <div className="flex items-center gap-1.5">
                                                                    <Mail size={10} className="text-blue-300" />
                                                                    <span className="text-blue-300 text-[9px] font-bold">Email</span>
                                                                </div>
                                                            </motion.div>
                                                        </div>
                                                    </div>
                                                )}
                                                {i === 2 && (
                                                    <div className="flex flex-col items-center gap-3 w-[200px]">
                                                        {['Day 1 — Welcome + booking', 'Day 3 — Value content', 'Day 7 — Success story', 'Day 14 — Check-in'].map((msg, j) => (
                                                            <motion.div key={j} initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + j * 0.15 }} className="w-full flex items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                                                                <Send size={10} className="text-violet-400 flex-shrink-0" />
                                                                <span className="text-white/50 text-[9px]">{msg}</span>
                                                            </motion.div>
                                                        ))}
                                                    </div>
                                                )}
                                                {i === 3 && (
                                                    <div className="flex flex-col items-center gap-4">
                                                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }}>
                                                            <CalendarCheck size={52} className="text-green-400" />
                                                        </motion.div>
                                                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/20 border border-green-500/30">
                                                            <CheckCircle size={14} className="text-green-400" />
                                                            <span className="text-green-400 text-[11px] font-bold">Consultation Booked</span>
                                                        </motion.div>
                                                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="text-white/40 text-[10px] text-center max-w-[180px]">Zero manual work. Client shows up ready to sign.</motion.p>
                                                    </div>
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

                                    {/* Collapsed label */}
                                    <div className={`absolute inset-0 flex flex-col items-center justify-end pb-8 transition-all duration-500 ${isActive ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                                        <div className="text-white/60 mb-4"><StepIcon size={20} /></div>
                                        <span className="text-white/50 text-[11px] font-bold tracking-[0.2em] uppercase" style={{ writingMode: 'vertical-rl' as const, textOrientation: 'mixed' as const }}>{item.title}</span>
                                    </div>

                                    {/* Expanded content */}
                                    <AnimatePresence>
                                        {isActive && (
                                            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }} transition={{ duration: 0.5, delay: 0.15 }} className="absolute bottom-0 left-0 right-0 p-8">
                                                <div className="text-white/10 text-8xl font-black leading-none mb-2 select-none">{item.step}</div>
                                                <div className="flex items-center gap-3 mb-3">
                                                    <div className="text-white/90"><StepIcon size={24} /></div>
                                                    <h3 className="text-2xl font-bold text-white">{item.title}</h3>
                                                </div>
                                                <p className="text-white/60 text-sm leading-relaxed max-w-md">{item.description}</p>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            );
                        })}
                    </div>

                    {/* Mobile: Accordion */}
                    <p className="md:hidden text-center text-[var(--text-main)] text-sm mb-4 font-bold tracking-wide">Tap to expand</p>
                    <div className="md:hidden space-y-3">
                        {expandedStepCards.map((item, i) => {
                            const isActive = expandedStep === i;
                            const StepIcon = StepIcons[i];
                            return (
                                <div key={i} onClick={() => setExpandedStep(isActive ? -1 : i)} className="relative overflow-hidden rounded-2xl cursor-pointer border border-white/10">
                                    <div className={`absolute inset-0 bg-gradient-to-br pointer-events-none ${item.bg}`} />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                                    <div className="relative z-10 flex items-center gap-4 px-5 py-4">
                                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                                            <StepIcon size={18} className="text-white/80" />
                                        </div>
                                        <div className="flex-1">
                                            <span className="text-white/30 text-[9px] font-black tracking-widest">STEP {item.step}</span>
                                            <h3 className="text-white text-sm font-bold">{item.title}</h3>
                                        </div>
                                        <motion.div animate={{ rotate: isActive ? 180 : 0 }} transition={{ duration: 0.3 }} className="text-white/30">
                                            <ArrowRight size={16} className="rotate-90" />
                                        </motion.div>
                                    </div>
                                    <AnimatePresence initial={false}>
                                        {isActive && (
                                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.4 }} className="overflow-hidden">
                                                <div className="relative z-10 px-5 pb-5">
                                                    <p className="text-white/60 text-sm leading-relaxed">{item.description}</p>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            );
                        })}
                    </div>
                </motion.section>

                {/* ── SECTION 5: Features Grid ── */}
                <motion.section
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    className="mb-24"
                >
                    <div className="text-center mb-12">
                        <h2 className="text-2xl md:text-5xl font-bold text-[var(--text-main)] mb-4">
                            Six Automations. <span className="text-violet-500">Zero Manual Work.</span>
                        </h2>
                        <p className="text-[var(--text-muted)] max-w-2xl mx-auto text-sm md:text-lg">
                            Every automation runs 24/7 so you can focus on serving clients, not chasing leads.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 max-w-5xl mx-auto">
                        {features.map((feature, i) => {
                            const colors = colorMap[feature.color];
                            return (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: 0.1 + i * 0.08 }}
                                    className={`p-5 md:p-6 rounded-2xl md:rounded-3xl border backdrop-blur-xl transition-all hover:scale-[1.02] ${theme === 'dark' ? 'bg-black/70 border-white/10 hover:border-white/20' : 'bg-white/80 border-black/10 hover:border-black/20'}`}
                                >
                                    <div className={`w-10 h-10 md:w-12 md:h-12 mb-3 md:mb-4 rounded-xl flex items-center justify-center border ${theme === 'dark' ? colors.iconDark : colors.iconLight}`}>
                                        <span className={colors.text}>{feature.icon}</span>
                                    </div>
                                    <h3 className="text-sm md:text-base font-bold text-[var(--text-main)] mb-1.5 md:mb-2">{feature.title}</h3>
                                    <p className="text-[var(--text-muted)] text-xs md:text-sm leading-relaxed">{feature.description}</p>
                                </motion.div>
                            );
                        })}
                    </div>
                </motion.section>

                {/* ── SECTION 6: FAQ ── */}
                <motion.section
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    className="mb-24"
                >
                    <div className="text-center mb-12">
                        <div className="inline-flex items-center gap-2 mb-4 md:mb-6 px-3 py-1 md:px-4 md:py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20">
                            <Users size={14} className="text-violet-400" />
                            <span className="text-violet-400 text-[9px] md:text-xs font-black tracking-[0.2em] uppercase">Common Questions</span>
                        </div>
                        <h2 className="text-2xl md:text-5xl font-bold text-[var(--text-main)] mb-4">
                            Built for <span className="text-violet-500">Your Peace of Mind</span>
                        </h2>
                    </div>

                    <div className="max-w-3xl mx-auto space-y-3">
                        {faqItems.map((item, i) => (
                            <div
                                key={i}
                                className={`rounded-2xl border transition-all ${expandedFaq === i ? (theme === 'dark' ? 'border-violet-500/30 bg-violet-500/5' : 'border-violet-500/30 bg-violet-50/50') : 'border-[var(--glass-border)] bg-[var(--glass-bg)]'}`}
                            >
                                <button
                                    onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                                    className="w-full flex items-center justify-between gap-4 px-5 md:px-6 py-4 md:py-5 text-left"
                                >
                                    <span className="text-sm md:text-base font-bold text-[var(--text-main)]">{item.question}</span>
                                    <motion.div animate={{ rotate: expandedFaq === i ? 180 : 0 }} transition={{ duration: 0.3 }} className="text-[var(--text-muted)] flex-shrink-0">
                                        <ChevronDown size={18} />
                                    </motion.div>
                                </button>
                                <AnimatePresence initial={false}>
                                    {expandedFaq === i && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.3 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="px-5 md:px-6 pb-4 md:pb-5">
                                                <p className="text-[var(--text-muted)] text-sm leading-relaxed">{item.answer}</p>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ))}
                    </div>
                </motion.section>

                {/* ── SECTION 7: Final CTA ── */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center"
                >
                    <div className="max-w-4xl mx-auto p-6 md:p-20 rounded-[1.5rem] md:rounded-[3rem] border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-t from-violet-500/10 to-transparent pointer-events-none" />
                        <div className="relative z-10">
                            <h2 className="text-xl md:text-5xl font-bold text-[var(--text-main)] mb-4 md:mb-8 tracking-tight leading-tight">
                                Ready to Stop Losing Leads <br className="hidden md:block" /><span className="text-violet-500">and Start Growing on Autopilot?</span>
                            </h2>
                            <p className="text-sm md:text-xl text-[var(--text-muted)] mb-6 md:mb-12 max-w-2xl mx-auto leading-relaxed font-medium">
                                Let us show you exactly how AI automations will work for your firm. We&apos;ll map out your lead flow, set up your automations, and have everything running in under 48 hours.
                            </p>
                            <button
                                onClick={openBooking}
                                className="inline-flex items-center gap-2 md:gap-3 bg-violet-600 text-white px-6 md:px-10 py-3 md:py-5 rounded-full text-sm md:text-lg font-bold hover:bg-violet-500 hover:scale-105 transition-all shadow-xl shadow-violet-600/25 active:scale-95 group"
                            >
                                See It In Action
                                <ArrowRight size={16} className="md:w-5 md:h-5 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>
                </motion.section>

            </div>
        </div>
    );
};

export default AIAutomations;
