'use client';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Shield,
    ArrowRight,
    MessageSquare,
    TrendingUp,
    CheckCircle,
    RotateCcw,
    Send,
    Mail,
    Smartphone,
    MousePointerClick,
    ThumbsUp,
    ThumbsDown,
    BarChart3,
    Zap,
    Star,
    RefreshCw
} from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { useBooking } from './QualificationProvider';

type DemoState = 'idle' | 'selected' | 'positive' | 'negative' | 'feedbackSent';

const SmartReviews: React.FC = () => {
    const { theme } = useTheme();
    const { openBooking } = useBooking();

    // Star demo state
    const [hoveredStar, setHoveredStar] = useState<number>(0);
    const [selectedRating, setSelectedRating] = useState<number>(0);
    const [demoState, setDemoState] = useState<DemoState>('idle');
    const [feedbackText, setFeedbackText] = useState<string>('');
    const [feedbackSubmitting, setFeedbackSubmitting] = useState<boolean>(false);
    const [activeStatIndex, setActiveStatIndex] = useState(0);
    const [statProgress, setStatProgress] = useState(0);
    const [expandedStep, setExpandedStep] = useState<number>(0);

    // Star click handler
    const handleStarClick = (rating: number) => {
        setSelectedRating(rating);
        setDemoState('selected');

        setTimeout(() => {
            if (rating >= 4) {
                setDemoState('positive');
            } else {
                setDemoState('negative');
            }
        }, 600);
    };

    const handleFeedbackSubmit = () => {
        setFeedbackSubmitting(true);
        setTimeout(() => {
            setDemoState('feedbackSent');
            setFeedbackSubmitting(false);
        }, 1200);
    };

    const resetDemo = () => {
        setHoveredStar(0);
        setSelectedRating(0);
        setDemoState('idle');
        setFeedbackText('');
        setFeedbackSubmitting(false);
    };

    // Review stats data for the tabbed showcase
    const reviewStats = [
        {
            id: 'visibility',
            icon: <TrendingUp className="w-5 h-5 md:w-6 md:h-6" />,
            stat: 'The Search',
            label: 'What Prospects See',
            title: '93% of Consumers Check Reviews First',
            description: "Before a prospect ever calls your office, they've already Googled you. Your star rating is the first — and often only — impression you get to make.",
            benefits: [
                'Reviews appear in local search results',
                'Star rating influences click-through rate',
                'Prospects compare you to competitors',
                'No reviews = no trust signal',
            ],
        },
        {
            id: 'opportunity',
            icon: <MessageSquare className="w-5 h-5 md:w-6 md:h-6" />,
            stat: 'The Ask',
            label: 'Automated Outreach',
            title: '72% Will Leave a Review — If You Just Ask',
            description: "Most of your satisfied clients would happily leave a 5-star review. The problem? Nobody ever asks them. Smart Reviews automates the ask at the perfect moment.",
            benefits: [
                'Automated requests via email & SMS',
                'Timed after positive experiences',
                'One-click process for the client',
                'No awkward manual asking',
            ],
        },
        {
            id: 'protection',
            icon: <ThumbsDown className="w-5 h-5 md:w-6 md:h-6" />,
            stat: 'The Shield',
            label: 'Reputation Defense',
            title: '1 Negative Review Costs You 22% of Leads',
            description: "A single bad review doesn't just sting — it actively drives away nearly a quarter of your potential clients. Smart Reviews intercepts negative feedback before it ever goes public.",
            benefits: [
                'Negative feedback routed privately',
                'Issues resolved before going public',
                'Google rating stays protected',
                'Turn complaints into improvements',
            ],
        },
    ];

    // Auto-progression for review stats tabs
    useEffect(() => {
        const duration = 10000;
        const interval = 100;
        const step = (interval / duration) * 100;

        const timer = setInterval(() => {
            setStatProgress((prev) => {
                if (prev >= 100) {
                    setActiveStatIndex((current) => (current + 1) % reviewStats.length);
                    return 0;
                }
                return prev + step;
            });
        }, interval);

        return () => clearInterval(timer);
    }, [activeStatIndex, reviewStats.length]);

    const handleStatTabClick = (index: number) => {
        setActiveStatIndex(index);
        setStatProgress(0);
        // On mobile, scroll the display area into view so user sees the content change
        if (window.innerWidth < 768) {
            const displayArea = document.getElementById('stat-display-area');
            if (displayArea) {
                displayArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    };

    // Inline star SVG component — desktop: hover + single click, mobile: double tap
    const StarIcon: React.FC<{ index: number; filled: boolean; hovered: boolean }> = ({ index, filled, hovered }) => (
        <motion.svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            className="cursor-pointer w-10 h-10 md:w-12 md:h-12 touch-manipulation select-none"
            animate={{ scale: hovered ? 1.15 : 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            whileTap={{ scale: 0.9 }}
            onPointerDown={(e) => {
                if (demoState !== 'idle') return;

                if (e.pointerType === 'touch') {
                    // Mobile: first tap previews, second tap on same star confirms
                    e.preventDefault();
                    if (hoveredStar === index) {
                        handleStarClick(index);
                    } else {
                        setHoveredStar(index);
                    }
                } else {
                    // Desktop mouse: single click fires immediately
                    handleStarClick(index);
                }
            }}
            onMouseEnter={() => demoState === 'idle' && setHoveredStar(index)}
            onMouseLeave={() => demoState === 'idle' && setHoveredStar(0)}
        >
            <path
                d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z"
                fill={filled || hovered ? '#fbbf24' : 'transparent'}
                stroke={filled || hovered ? '#f59e0b' : 'var(--text-muted)'}
                strokeWidth={filled || hovered ? '0.5' : '1.5'}
                className="transition-colors duration-200"
            />
        </motion.svg>
    );

    const starLabels = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

    const expandedStepCards = [
        { step: '01', title: 'Automated Request', description: 'Your customer receives an automated review request via email or SMS after their service.', bg: 'from-blue-950 via-blue-900 to-cyan-900' },
        { step: '02', title: 'Click the Link', description: 'They click the smart review link and see the interactive star rating banner on your website.', bg: 'from-indigo-950 via-indigo-900 to-violet-900' },
        { step: '03', title: 'Happy? Go to Google', description: '4-5 star ratings get redirected to your Google Reviews page to leave a public review.', bg: 'from-emerald-950 via-green-900 to-teal-900' },
        { step: '04', title: 'Unhappy? Private Feedback', description: '1-3 star ratings see a private feedback form. You hear the issue before Google does.', bg: 'from-amber-950 via-orange-900 to-red-900' },
    ];
    const StepIcons = [Send, MousePointerClick, ThumbsUp, Shield];

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
                            <span className="relative z-10 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--bg-main)]">
                                <svg width="14" height="14" viewBox="0 0 24 24" className="flex-shrink-0">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                </svg>
                                <span className="text-[var(--text-main)] text-[10px] md:text-xs font-black tracking-[0.2em] uppercase">Google Reviews</span>
                            </span>
                        </div>

                        <h1 className="text-[26px] sm:text-4xl md:text-6xl font-black text-[var(--text-main)] mb-6 leading-tight tracking-tighter" style={{ fontFamily: "'Syne', sans-serif" }}>
                            A $10M Client Just Googled You.{' '}
                            <br className="hidden md:block" /><span className="text-blue-500">3 Stars.</span> They Moved On.
                        </h1>

                        {/* Mobile-only: animated Google Reviews visual between headline and paragraph */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 1, ease: "circOut" }}
                            className="flex lg:hidden items-center justify-center my-8 relative"
                        >
                            <div className="absolute inset-0 bg-blue-500/10 blur-[80px] rounded-full" />
                            <div className="relative z-10 flex flex-col items-center gap-3">
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2, duration: 0.6 }}
                                    className="flex items-center gap-2"
                                >
                                    <svg width="36" height="36" viewBox="0 0 24 24">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                    </svg>
                                    <span className="text-xl font-bold text-[var(--text-main)]">Google Reviews</span>
                                </motion.div>
                                <div className="flex gap-2" style={{ perspective: '600px' }}>
                                    {[1, 2, 3, 4, 5].map((i) => (
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
                                            <svg
                                                width="40"
                                                height="40"
                                                viewBox="0 0 24 24"
                                                style={{ filter: 'drop-shadow(0 4px 8px rgba(251, 191, 36, 0.3))' }}
                                            >
                                                <path
                                                    d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z"
                                                    fill="#fbbf24"
                                                    stroke="#f59e0b"
                                                    strokeWidth="0.5"
                                                />
                                            </svg>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>

                        <p className="text-sm sm:text-lg md:text-xl text-[var(--text-muted)] mb-8 max-w-xl leading-relaxed">
                            Prospective clients don't settle. Before they ever call your office, they've already checked your reviews. CPA firms with weak ratings don't make the shortlist — no matter how good they actually are. Smart Reviews puts your reputation on autopilot so your Google profile matches the elite service you deliver.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-5">
                            <button
                                onClick={() => document.getElementById('smart-review-demo')?.scrollIntoView({ behavior: 'smooth' })}
                                className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 md:px-8 py-3 md:py-4 rounded-full text-sm font-bold hover:bg-blue-500 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-blue-600/20 group"
                            >
                                Try the Demo
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

                    {/* Right side decorative stars */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 1, ease: "circOut" }}
                        className="relative hidden lg:flex items-center justify-center"
                    >
                        <div className="absolute inset-0 bg-blue-500/10 blur-[100px] rounded-full" />
                        <div className="relative z-10 flex flex-col items-center gap-4">
                            {/* Google logo */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2, duration: 0.6 }}
                                className="flex items-center gap-3"
                            >
                                <svg width="56" height="56" viewBox="0 0 24 24">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                </svg>
                                <span className="text-3xl font-bold text-[var(--text-main)]">Google Reviews</span>
                            </motion.div>
                            {/* Stars with 3D floating */}
                            <div className="flex gap-3" style={{ perspective: '600px' }}>
                                {[1, 2, 3, 4, 5].map((i) => (
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
                                        <svg
                                            width="56"
                                            height="56"
                                            viewBox="0 0 24 24"
                                            style={{ filter: 'drop-shadow(0 4px 8px rgba(251, 191, 36, 0.3))' }}
                                        >
                                            <path
                                                d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z"
                                                fill="#fbbf24"
                                                stroke="#f59e0b"
                                                strokeWidth="0.5"
                                            />
                                        </svg>
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
                        <div className="inline-flex items-center gap-2 mb-4 md:mb-6 px-3 py-1 md:px-4 md:py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20">
                            <BarChart3 size={14} className="text-blue-400" />
                            <span className="text-blue-400 text-[9px] md:text-xs font-black tracking-[0.2em] uppercase">The Problem</span>
                        </div>
                        <h2 className="text-2xl md:text-5xl font-bold text-[var(--text-main)] mb-4 md:mb-6">
                            Reviews Make or Break Your <span className="text-blue-500">Growth</span>
                        </h2>
                        <p className="text-[var(--text-muted)] max-w-2xl mx-auto text-sm md:text-lg">
                            In a world where 93% of consumers say online reviews influence their decisions, silence from your happy clients is your biggest competitive disadvantage.
                        </p>
                    </div>

                    <div className="max-w-6xl mx-auto">
                        <div className={`relative rounded-[1.5rem] md:rounded-[3rem] border border-[var(--glass-border)] shadow-2xl overflow-hidden flex flex-col md:min-h-[600px] transition-colors duration-500 ${theme === 'dark' ? 'bg-[#050505]' : 'bg-white'}`}>

                            {/* Glowing Atmosphere */}
                            <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-full h-[300px] blur-[120px] pointer-events-none transition-opacity duration-500 ${theme === 'dark' ? 'bg-blue-500/5 opacity-100' : 'bg-blue-500/10 opacity-50'}`} />

                            {/* Display Area */}
                            <div id="stat-display-area" className="flex-grow grid lg:grid-cols-2 gap-5 md:gap-12 p-5 md:p-16 items-center">

                                {/* Left Side: Content Reveal */}
                                <div className="relative z-10 order-2 lg:order-1">
                                    <AnimatePresence mode="wait">
                                        <motion.div
                                            key={activeStatIndex}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -20 }}
                                            transition={{ duration: 0.4 }}
                                        >
                                            <div className="mb-4 md:mb-6 flex items-center gap-2 md:gap-3 text-blue-500">
                                                <div className="p-1.5 md:p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                                    {reviewStats[activeStatIndex].icon}
                                                </div>
                                                <span className="font-bold tracking-widest uppercase text-[10px] md:text-xs">{reviewStats[activeStatIndex].label}</span>
                                            </div>
                                            <h3 className="text-2xl md:text-4xl font-bold mb-4 md:mb-6 tracking-tight leading-tight text-[var(--text-main)]">
                                                {reviewStats[activeStatIndex].title}
                                            </h3>
                                            <p className="text-[var(--text-muted)] text-sm md:text-lg leading-relaxed mb-5 md:mb-8">
                                                {reviewStats[activeStatIndex].description}
                                            </p>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 md:gap-4">
                                                {reviewStats[activeStatIndex].benefits.map((benefit, i) => (
                                                    <div key={i} className="flex items-start gap-2 md:gap-2.5 text-xs md:text-sm font-semibold">
                                                        <CheckCircle size={14} className="text-blue-500 shrink-0 mt-0.5 md:w-4 md:h-4" />
                                                        <span className="text-[var(--text-main)] opacity-90">{benefit}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    </AnimatePresence>
                                </div>

                                {/* Right Side: Animated Scene Frame */}
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
                                            {/* Scene 1: Google Search Results */}
                                            {activeStatIndex === 0 && (
                                                <div className="w-full h-full flex items-center justify-center p-4 md:p-8">
                                                    <div className="w-full max-w-sm space-y-3">
                                                        {/* Search bar */}
                                                        <motion.div
                                                            initial={{ opacity: 0, y: -10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ duration: 0.5 }}
                                                            className="rounded-full bg-white/10 border border-white/20 px-4 py-2.5 flex items-center gap-3"
                                                        >
                                                            <svg width="16" height="16" viewBox="0 0 24 24">
                                                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                                            </svg>
                                                            <span className="text-white/50 text-xs md:text-sm">best CPA near me</span>
                                                        </motion.div>

                                                        {/* Competitor — thriving with 5 stars */}
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ delay: 0.2, duration: 0.5 }}
                                                            className="rounded-xl bg-green-500/10 border border-green-500/30 p-3 md:p-4"
                                                        >
                                                            <div className="text-green-400 text-[10px] md:text-xs mb-1">competitor.com</div>
                                                            <div className="text-white font-bold text-xs md:text-sm mb-1.5">Their CPA Firm</div>
                                                            <div className="flex items-center gap-0.5 mb-1">
                                                                {[1,2,3,4,5].map((s) => (
                                                                    <Star key={s} size={12} className="text-yellow-400 fill-yellow-400" />
                                                                ))}
                                                                <span className="text-white/50 text-[10px] md:text-xs ml-1.5">4.9 (128 reviews)</span>
                                                            </div>
                                                            <p className="text-white/40 text-[10px] md:text-xs">Award-winning accounting services...</p>
                                                        </motion.div>

                                                        {/* Your firm — buried with poor rating */}
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ delay: 0.4, duration: 0.5 }}
                                                            className="rounded-xl bg-red-500/10 border border-red-500/30 p-3 md:p-4"
                                                        >
                                                            <div className="text-red-400/70 text-[10px] md:text-xs mb-1">yourfirm.com</div>
                                                            <div className="text-white/60 font-bold text-xs md:text-sm mb-1.5">Your Firm</div>
                                                            <div className="flex items-center gap-0.5 mb-1">
                                                                {[1,2,3].map((s) => (
                                                                    <Star key={s} size={12} className="text-yellow-400/50 fill-yellow-400/50" />
                                                                ))}
                                                                {[4,5].map((s) => (
                                                                    <Star key={s} size={12} className="text-white/15" />
                                                                ))}
                                                                <span className="text-white/30 text-[10px] md:text-xs ml-1.5">3.1 (6 reviews)</span>
                                                            </div>
                                                            <p className="text-white/30 text-[10px] md:text-xs">Financial planning services...</p>
                                                        </motion.div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Scene 2: Automated Review Request */}
                                            {activeStatIndex === 1 && (
                                                <div className="w-full h-full flex items-center justify-center p-4 md:p-8">
                                                    <motion.div
                                                        initial={{ opacity: 0, scale: 0.9 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        transition={{ type: "spring", stiffness: 200, damping: 20 }}
                                                        className="w-[220px] md:w-[260px] rounded-[2rem] border border-white/20 bg-black/60 backdrop-blur p-5 space-y-3"
                                                    >
                                                        {/* Status bar */}
                                                        <div className="flex justify-between text-white/30 text-[10px] px-1">
                                                            <span>9:41</span>
                                                            <div className="flex gap-1.5 items-center">
                                                                <Smartphone size={10} />
                                                            </div>
                                                        </div>

                                                        {/* Notification */}
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 20 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ delay: 0.3, duration: 0.5 }}
                                                            className="rounded-2xl bg-white/10 border border-white/15 p-3 space-y-2"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center">
                                                                    <Star size={12} className="text-blue-400 fill-blue-400" />
                                                                </div>
                                                                <div>
                                                                    <div className="text-white text-[11px] font-semibold">Your Firm</div>
                                                                    <div className="text-white/30 text-[9px]">Just now</div>
                                                                </div>
                                                            </div>
                                                            <p className="text-white/60 text-[10px] md:text-[11px] leading-relaxed">
                                                                Hi Sarah, thank you for choosing us! We'd love to hear about your experience.
                                                            </p>
                                                            <div className="rounded-xl bg-blue-500 py-2 text-center text-white text-[10px] md:text-xs font-bold">
                                                                Leave a Review
                                                            </div>
                                                        </motion.div>

                                                        {/* Sent indicator */}
                                                        <motion.div
                                                            initial={{ opacity: 0 }}
                                                            animate={{ opacity: 1 }}
                                                            transition={{ delay: 0.8 }}
                                                            className="flex items-center justify-center gap-1.5 text-green-400/70 text-[10px] font-medium"
                                                        >
                                                            <Send size={10} />
                                                            <span>Sent automatically</span>
                                                        </motion.div>
                                                    </motion.div>
                                                </div>
                                            )}

                                            {/* Scene 3: Negative Review Impact */}
                                            {activeStatIndex === 2 && (
                                                <div className="w-full h-full flex items-center justify-center p-4 md:p-8">
                                                    <div className="w-full max-w-sm space-y-4">
                                                        {/* The negative review */}
                                                        <motion.div
                                                            initial={{ opacity: 0, x: -20 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            transition={{ duration: 0.5 }}
                                                            className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 md:p-4"
                                                        >
                                                            <div className="flex items-center gap-0.5 mb-2">
                                                                <Star size={12} className="text-yellow-400 fill-yellow-400" />
                                                                {[2,3,4,5].map((s) => (
                                                                    <Star key={s} size={12} className="text-white/15" />
                                                                ))}
                                                            </div>
                                                            <p className="text-white/50 text-[10px] md:text-xs italic">"Not a great experience. Would not recommend to others."</p>
                                                        </motion.div>

                                                        {/* Impact bar */}
                                                        <motion.div
                                                            initial={{ opacity: 0 }}
                                                            animate={{ opacity: 1 }}
                                                            transition={{ delay: 0.3 }}
                                                            className="space-y-2"
                                                        >
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-white/40 text-[10px] md:text-xs font-semibold uppercase tracking-wider">Potential Clients Lost</span>
                                                                <motion.span
                                                                    initial={{ opacity: 0 }}
                                                                    animate={{ opacity: 1 }}
                                                                    transition={{ delay: 1 }}
                                                                    className="text-red-400 text-lg md:text-2xl font-black"
                                                                >-22%</motion.span>
                                                            </div>
                                                            <div className="h-3 md:h-4 rounded-full bg-white/10 overflow-hidden">
                                                                <motion.div
                                                                    initial={{ width: '0%' }}
                                                                    animate={{ width: '22%' }}
                                                                    transition={{ duration: 1.5, delay: 0.5, ease: 'easeOut' }}
                                                                    className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                                                                />
                                                            </div>
                                                        </motion.div>

                                                        {/* Smart Reviews solution */}
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ delay: 0.8 }}
                                                            className="rounded-xl bg-green-500/10 border border-green-500/20 p-3 flex items-center gap-3"
                                                        >
                                                            <Shield size={18} className="text-green-400 flex-shrink-0" />
                                                            <div>
                                                                <div className="text-green-400 text-[10px] md:text-xs font-bold">With Smart Reviews</div>
                                                                <div className="text-white/50 text-[10px]">Negative feedback routed to a private form instead</div>
                                                            </div>
                                                        </motion.div>
                                                    </div>
                                                </div>
                                            )}
                                        </motion.div>
                                    </AnimatePresence>
                                </div>
                            </div>

                            {/* Interaction Tabs (Footer) */}
                            <div className={`smart-reviews-tabs border-t border-[var(--glass-border)] backdrop-blur-md grid grid-cols-3 transition-colors duration-500 ${theme === 'dark' ? 'bg-black/40' : 'bg-slate-50/50'}`}>
                                {reviewStats.map((stat, index) => (
                                    <button
                                        key={stat.id}
                                        onClick={() => handleStatTabClick(index)}
                                        className={`relative px-2 py-3 md:p-8 transition-all border-r border-[var(--glass-border)] last:border-r-0 text-left group hover:bg-white/5 ${activeStatIndex === index ? (theme === 'dark' ? 'bg-white/[0.03]' : 'bg-blue-500/5') : ''}`}
                                    >
                                        {/* Progress bar */}
                                        <div className={`absolute top-0 left-0 h-[2px] w-full ${theme === 'dark' ? 'bg-white/10' : 'bg-blue-500/10'}`}>
                                            {activeStatIndex === index && (
                                                <motion.div
                                                    className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                                                    initial={{ width: '0%' }}
                                                    animate={{ width: `${statProgress}%` }}
                                                    transition={{ ease: 'linear', duration: 0.1 }}
                                                />
                                            )}
                                        </div>

                                        <div className="flex flex-col gap-1">
                                            <span className={`text-[11px] md:text-sm font-bold uppercase tracking-[0.15em] md:tracking-[0.2em] transition-colors ${activeStatIndex === index ? 'text-blue-500' : (theme === 'dark' ? 'text-neutral-500 group-hover:text-neutral-300' : 'text-slate-400 group-hover:text-slate-600')}`}>
                                                {stat.stat}
                                            </span>
                                            <span className={`text-xs md:text-sm font-semibold transition-colors leading-tight ${activeStatIndex === index ? (theme === 'dark' ? 'text-white' : 'text-slate-900') : (theme === 'dark' ? 'text-neutral-400 group-hover:text-neutral-200' : 'text-slate-500 group-hover:text-slate-700')}`}>
                                                {stat.label}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </motion.section>

                {/* ── SECTION 3: Interactive Demo ── */}
                <motion.section
                    id="smart-review-demo"
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    className="mb-24"
                >
                    <div className="text-center mb-12">
                        <div className="inline-flex items-center gap-2 mb-4 md:mb-6 px-3 py-1 md:px-4 md:py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20">
                            <MousePointerClick size={14} className="text-blue-400" />
                            <span className="text-blue-400 text-[9px] md:text-xs font-black tracking-[0.2em] uppercase">Try It Yourself</span>
                        </div>
                        <h2 className="text-2xl md:text-5xl font-bold text-[var(--text-main)] mb-4">
                            See the Smart Review Banner <span className="text-blue-500">In Action</span>
                        </h2>
                        <p className="text-[var(--text-muted)] max-w-2xl mx-auto text-sm md:text-lg">
                            This is exactly what your customers would see. Click a star rating to experience both paths.
                        </p>
                    </div>

                    {/* The Demo Card */}
                    <div className="max-w-2xl mx-auto">
                        <div className="glass-card p-8 md:p-12 rounded-[2rem] md:rounded-[3rem] border border-[var(--glass-border)] relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-t from-blue-500/5 to-transparent pointer-events-none" />

                            <div className="relative z-10">
                                <AnimatePresence mode="wait">
                                    {/* STATE: idle — Star Selection */}
                                    {demoState === 'idle' && (
                                        <motion.div
                                            key="idle"
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="text-center"
                                        >
                                            {/* Google branding */}
                                            <div className="flex items-center justify-center gap-3 mb-5">
                                                <svg width="40" height="40" viewBox="0 0 24 24">
                                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                                </svg>
                                                <span className="text-xl font-semibold text-[var(--text-muted)]">Google Reviews</span>
                                            </div>
                                            <h3 className="text-xl md:text-2xl font-bold text-[var(--text-main)] mb-2">
                                                How was your experience?
                                            </h3>
                                            <p className="text-[var(--text-muted)] text-sm mb-8">
                                                Click a star to leave your Google review
                                            </p>
                                            <div className="flex justify-center gap-2 md:gap-3">
                                                {[1, 2, 3, 4, 5].map((index) => (
                                                    <StarIcon
                                                        key={index}
                                                        index={index}
                                                        filled={index <= selectedRating}
                                                        hovered={index <= hoveredStar}
                                                    />
                                                ))}
                                            </div>
                                            {hoveredStar > 0 && (
                                                <motion.p
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    className="mt-4 text-sm text-[var(--text-muted)]"
                                                >
                                                    {starLabels[hoveredStar]}
                                                </motion.p>
                                            )}
                                        </motion.div>
                                    )}

                                    {/* STATE: selected — Spinner transition */}
                                    {demoState === 'selected' && (
                                        <motion.div
                                            key="selected"
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.9 }}
                                            className="text-center py-8"
                                        >
                                            <div className="flex justify-center gap-1 mb-4">
                                                {[1, 2, 3, 4, 5].map((i) => (
                                                    <svg key={i} width="32" height="32" viewBox="0 0 24 24">
                                                        <path
                                                            d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z"
                                                            fill={i <= selectedRating ? '#fbbf24' : 'var(--glass-border)'}
                                                        />
                                                    </svg>
                                                ))}
                                            </div>
                                            <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto" />
                                        </motion.div>
                                    )}

                                    {/* STATE: positive (4-5 stars) — Google Redirect */}
                                    {demoState === 'positive' && (
                                        <motion.div
                                            key="positive"
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="text-center py-4"
                                        >
                                            {/* Confetti particles */}
                                            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                                                {/* Burst wave 1 — large bright pieces */}
                                                {Array.from({ length: 16 }).map((_, i) => {
                                                    const angle = (i / 16) * Math.PI * 2;
                                                    const radius = 60 + Math.random() * 80;
                                                    const colors = ['#fbbf24', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
                                                    const shapes = ['rounded-full', 'rounded-sm', 'rounded-full'];
                                                    return (
                                                        <motion.div
                                                            key={`burst1-${i}`}
                                                            className={`absolute w-2.5 h-2.5 md:w-3 md:h-3 ${shapes[i % 3]}`}
                                                            style={{
                                                                background: colors[i % 8],
                                                                left: '50%',
                                                                top: '35%',
                                                                boxShadow: `0 0 6px ${colors[i % 8]}80`,
                                                            }}
                                                            initial={{ x: 0, y: 0, opacity: 1, scale: 0, rotate: 0 }}
                                                            animate={{
                                                                x: Math.cos(angle) * radius,
                                                                y: Math.sin(angle) * radius,
                                                                opacity: [0, 1, 1, 0],
                                                                scale: [0, 1.5, 1, 0.3],
                                                                rotate: Math.random() * 360,
                                                            }}
                                                            transition={{ duration: 1.6, delay: i * 0.03, ease: "easeOut" }}
                                                        />
                                                    );
                                                })}
                                                {/* Burst wave 2 — small sparkle dots */}
                                                {Array.from({ length: 12 }).map((_, i) => {
                                                    const angle = ((i + 0.5) / 12) * Math.PI * 2;
                                                    const radius = 30 + Math.random() * 50;
                                                    const colors = ['#fde68a', '#93c5fd', '#6ee7b7', '#fcd34d', '#c4b5fd', '#f9a8d4'];
                                                    return (
                                                        <motion.div
                                                            key={`burst2-${i}`}
                                                            className="absolute w-1.5 h-1.5 rounded-full"
                                                            style={{
                                                                background: colors[i % 6],
                                                                left: '50%',
                                                                top: '35%',
                                                                boxShadow: `0 0 4px ${colors[i % 6]}`,
                                                            }}
                                                            initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                                                            animate={{
                                                                x: Math.cos(angle) * radius,
                                                                y: Math.sin(angle) * radius,
                                                                opacity: [0, 1, 1, 0],
                                                                scale: [0, 1.8, 0.8, 0],
                                                            }}
                                                            transition={{ duration: 1.2, delay: 0.15 + i * 0.04, ease: "easeOut" }}
                                                        />
                                                    );
                                                })}
                                            </div>

                                            <motion.div
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                                                className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center"
                                            >
                                                <CheckCircle size={32} className="text-green-500" />
                                            </motion.div>

                                            <h3 className="text-xl md:text-2xl font-bold text-[var(--text-main)] mb-2">
                                                Thank you!
                                            </h3>
                                            <p className="text-[var(--text-muted)] text-sm mb-6">
                                                Redirecting you to Google Reviews...
                                            </p>

                                            {/* Google branding pill */}
                                            <div className="inline-flex items-center gap-3 px-5 py-3 rounded-full bg-white dark:bg-white/10 border border-[var(--glass-border)] shadow-lg">
                                                <svg width="20" height="20" viewBox="0 0 24 24">
                                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                                </svg>
                                                <span className="text-sm font-semibold text-gray-700 dark:text-white/80">Google Reviews</span>
                                            </div>

                                            <p className="mt-6 text-[10px] text-[var(--text-muted)] opacity-60 uppercase tracking-widest font-bold">
                                                This is a demo — no actual redirect
                                            </p>
                                        </motion.div>
                                    )}

                                    {/* STATE: negative (1-3 stars) — Feedback Form */}
                                    {demoState === 'negative' && (
                                        <motion.div
                                            key="negative"
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            className="text-center"
                                        >
                                            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                                                <MessageSquare size={24} className="text-blue-400" />
                                            </div>
                                            <h3 className="text-xl md:text-2xl font-bold text-[var(--text-main)] mb-2">
                                                We Value Your Feedback
                                            </h3>
                                            <p className="text-[var(--text-muted)] text-sm mb-6">
                                                Help us improve. Your feedback goes directly to your team INTERNALLY — NOT as a Public Google review. The best part? Your customer has no idea it's being routed internally. To them, it just feels like a normal review experience.
                                            </p>
                                            <textarea
                                                value={feedbackText}
                                                onChange={(e) => setFeedbackText(e.target.value)}
                                                placeholder="What could we do better?"
                                                rows={4}
                                                className="w-full bg-[var(--glass-border)] border border-[var(--glass-border)] rounded-2xl px-6 py-4 text-[var(--text-main)] focus:outline-none focus:border-blue-500 transition-all font-medium resize-none mb-4 text-sm md:text-base"
                                            />
                                            <button
                                                onClick={handleFeedbackSubmit}
                                                disabled={feedbackSubmitting}
                                                className={`w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98] ${feedbackSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                                            >
                                                {feedbackSubmitting ? (
                                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                ) : (
                                                    <Send size={16} />
                                                )}
                                                {feedbackSubmitting ? 'Sending...' : 'Submit Feedback'}
                                            </button>
                                        </motion.div>
                                    )}

                                    {/* STATE: feedbackSent — Thank You */}
                                    {demoState === 'feedbackSent' && (
                                        <motion.div
                                            key="feedbackSent"
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="text-center py-4"
                                        >
                                            <motion.div
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                transition={{ type: "spring", stiffness: 200 }}
                                                className="w-16 h-16 mx-auto mb-6 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center"
                                            >
                                                <CheckCircle size={32} className="text-blue-500" />
                                            </motion.div>
                                            <h3 className="text-xl md:text-2xl font-bold text-[var(--text-main)] mb-2">
                                                Thank You for Your Feedback
                                            </h3>
                                            <p className="text-[var(--text-muted)] text-sm">
                                                Your response has been sent directly to the team. We appreciate your honesty and will use it to improve.
                                            </p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Reset button */}
                                {demoState !== 'idle' && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 0.5 }}
                                        className="mt-6 text-center"
                                    >
                                        <button
                                            onClick={resetDemo}
                                            className="inline-flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-widest hover:text-blue-400 transition-colors bg-transparent border-none p-0"
                                        >
                                            <RotateCcw size={14} />
                                            Try Again
                                        </button>
                                    </motion.div>
                                )}
                            </div>
                        </div>
                    </div>
                </motion.section>

                {/* ── SECTION 4: How It Works (Expanded Cards) ── */}
                <motion.section
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    className="mb-24"
                >
                    <div className="text-center mb-12">
                        <div className="inline-flex items-center gap-2 mb-4 md:mb-6 px-3 py-1 md:px-4 md:py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20">
                            <Zap size={14} className="text-blue-400" />
                            <span className="text-blue-400 text-[9px] md:text-xs font-black tracking-[0.2em] uppercase">How It Works</span>
                        </div>
                        <h2 className="text-2xl md:text-5xl font-bold text-[var(--text-main)] mb-4">
                            Four Steps to <span className="text-blue-500">5-Star Protection</span>
                        </h2>
                    </div>

                    {/* Desktop: Expanding Cards Row */}
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
                                    {/* Background gradient */}
                                    <div className={`absolute inset-0 bg-gradient-to-br ${item.bg}`} />

                                    {/* Large watermark icon */}
                                    <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white transition-opacity duration-500 ${isActive ? 'opacity-[0.06]' : 'opacity-[0.04]'}`}>
                                        <StepIcon size={200} strokeWidth={0.5} />
                                    </div>

                                    {/* Scene illustration (expanded only) */}
                                    <AnimatePresence>
                                        {isActive && (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.9 }}
                                                transition={{ duration: 0.5 }}
                                                className="absolute inset-0 flex items-center justify-center pb-44"
                                            >
                                                {/* Step 1: Phone with notifications */}
                                                {i === 0 && (
                                                    <div className="relative">
                                                        <div className="w-[150px] h-[250px] rounded-[26px] border-2 border-white/20 bg-black/50 backdrop-blur p-3.5 relative">
                                                            <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-12 h-1.5 rounded-full bg-white/15" />
                                                            <div className="mt-6 space-y-2.5">
                                                                <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="rounded-xl bg-blue-500/20 border border-blue-500/30 p-2.5">
                                                                    <div className="flex items-center gap-1.5 mb-1">
                                                                        <Mail size={10} className="text-blue-400" />
                                                                        <span className="text-white/70 text-[9px] font-semibold">Email</span>
                                                                    </div>
                                                                    <p className="text-white/40 text-[8px] leading-relaxed">Hi Sarah, thanks for choosing us! We'd love your feedback...</p>
                                                                </motion.div>
                                                                <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.5 }} className="rounded-xl bg-green-500/20 border border-green-500/30 p-2.5">
                                                                    <div className="flex items-center gap-1.5 mb-1">
                                                                        <Smartphone size={10} className="text-green-400" />
                                                                        <span className="text-white/70 text-[9px] font-semibold">SMS</span>
                                                                    </div>
                                                                    <p className="text-white/40 text-[8px] leading-relaxed">Leave a quick review! Tap here</p>
                                                                </motion.div>
                                                            </div>
                                                        </div>
                                                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.6, type: "spring" }} className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 rounded-full flex items-center justify-center text-white text-[11px] font-bold shadow-lg shadow-red-500/30">2</motion.div>
                                                    </div>
                                                )}

                                                {/* Step 2: Browser with star rating */}
                                                {i === 1 && (
                                                    <div className="relative">
                                                        <div className="w-[220px] rounded-xl border border-white/20 bg-black/50 backdrop-blur overflow-hidden">
                                                            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/10">
                                                                <div className="w-2 h-2 rounded-full bg-red-400/60" />
                                                                <div className="w-2 h-2 rounded-full bg-yellow-400/60" />
                                                                <div className="w-2 h-2 rounded-full bg-green-400/60" />
                                                                <div className="flex-1 mx-2 h-5 rounded-md bg-white/10 flex items-center px-2">
                                                                    <span className="text-white/30 text-[8px]">yourfirm.com/review</span>
                                                                </div>
                                                            </div>
                                                            <div className="p-5 text-center">
                                                                <p className="text-white/60 text-[10px] mb-1 font-semibold">How was your experience?</p>
                                                                <p className="text-white/30 text-[8px] mb-3">Tap a star to rate</p>
                                                                <div className="flex justify-center gap-1.5">
                                                                    {[1, 2, 3, 4, 5].map((s) => (
                                                                        <motion.div key={s} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + s * 0.1 }}>
                                                                            <Star size={18} className="text-yellow-400 fill-yellow-400" style={{ filter: 'drop-shadow(0 0 3px rgba(251,191,36,0.4))' }} />
                                                                        </motion.div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <motion.div initial={{ x: 30, y: 10, opacity: 0 }} animate={{ x: 15, y: 0, opacity: 1 }} transition={{ delay: 0.8, duration: 0.5 }} className="absolute -bottom-3 -right-4">
                                                            <MousePointerClick size={22} className="text-white/50" />
                                                        </motion.div>
                                                    </div>
                                                )}

                                                {/* Step 3: Google logo with golden stars */}
                                                {i === 2 && (
                                                    <div className="flex flex-col items-center gap-4">
                                                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }}>
                                                            <svg width="52" height="52" viewBox="0 0 24 24">
                                                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                                            </svg>
                                                        </motion.div>
                                                        <div className="flex gap-2">
                                                            {[1, 2, 3, 4, 5].map((s) => (
                                                                <motion.div key={s} initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.3 + s * 0.1, type: "spring" }}>
                                                                    <Star size={22} className="text-yellow-400 fill-yellow-400" style={{ filter: 'drop-shadow(0 0 6px rgba(251,191,36,0.5))' }} />
                                                                </motion.div>
                                                            ))}
                                                        </div>
                                                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }} className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/20 border border-green-500/30">
                                                            <CheckCircle size={14} className="text-green-400" />
                                                            <span className="text-green-400 text-[11px] font-bold">Redirecting to Google</span>
                                                        </motion.div>
                                                    </div>
                                                )}

                                                {/* Step 4: Shield with private feedback form */}
                                                {i === 3 && (
                                                    <div className="flex flex-col items-center gap-4">
                                                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }} className="relative">
                                                            <Shield size={52} className="text-amber-400/80" />
                                                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5, type: "spring" }} className="absolute -bottom-1 -right-1 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/30">
                                                                <span className="text-black text-[10px] font-black">!</span>
                                                            </motion.div>
                                                        </motion.div>
                                                        <div className="w-[180px] rounded-xl border border-white/15 bg-white/5 backdrop-blur p-3.5 space-y-2">
                                                            <p className="text-white/50 text-[9px] font-semibold mb-2">Private Feedback Form</p>
                                                            <motion.div initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ delay: 0.4, duration: 0.5 }} className="h-2.5 rounded bg-white/10" />
                                                            <motion.div initial={{ width: 0 }} animate={{ width: '70%' }} transition={{ delay: 0.5, duration: 0.5 }} className="h-2.5 rounded bg-white/10" />
                                                            <motion.div initial={{ width: 0 }} animate={{ width: '85%' }} transition={{ delay: 0.6, duration: 0.5 }} className="h-2.5 rounded bg-white/10" />
                                                            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.8 }} className="w-full py-2 rounded-lg bg-amber-500/30 border border-amber-500/40 flex items-center justify-center mt-1">
                                                                <span className="text-amber-300 text-[9px] font-bold">Send Private Feedback</span>
                                                            </motion.div>
                                                        </div>
                                                    </div>
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/* Bottom gradient for text */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

                                    {/* Collapsed: Vertical label */}
                                    <div className={`absolute inset-0 flex flex-col items-center justify-end pb-8 transition-all duration-500 ${isActive ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                                        <div className="text-white/60 mb-4">
                                            <StepIcon size={20} />
                                        </div>
                                        <span className="text-white/50 text-[11px] font-bold tracking-[0.2em] uppercase" style={{ writingMode: 'vertical-rl' as const, textOrientation: 'mixed' as const }}>
                                            {item.title}
                                        </span>
                                    </div>

                                    {/* Expanded: Full content at bottom */}
                                    <AnimatePresence>
                                        {isActive && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 30 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 30 }}
                                                transition={{ duration: 0.5, delay: 0.15 }}
                                                className="absolute bottom-0 left-0 right-0 p-8"
                                            >
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

                    {/* Mobile: Tap-to-expand accordion */}
                    <p className="md:hidden text-center text-[var(--text-main)] text-sm mb-4 font-bold tracking-wide">Double-Tap to expand</p>
                    <div className="md:hidden space-y-3">
                        {expandedStepCards.map((item, i) => {
                            const isActive = expandedStep === i;
                            const StepIcon = StepIcons[i];
                            return (
                                <div
                                    key={i}
                                    onClick={() => setExpandedStep(isActive ? -1 : i)}
                                    className="relative overflow-hidden rounded-2xl cursor-pointer border border-white/10"
                                >
                                    <div className={`absolute inset-0 bg-gradient-to-br pointer-events-none ${item.bg}`} />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />

                                    {/* Header row */}
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

                                    {/* Expanded content */}
                                    <AnimatePresence initial={false}>
                                        {isActive && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.4 }}
                                                className="overflow-hidden"
                                            >
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

                {/* ── SECTION 5: Benefits (3D Marquee) ── */}
                <motion.section
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    className="mb-24"
                >
                    <div className="text-center mb-12">
                        <h2 className="text-2xl md:text-5xl font-bold text-[var(--text-main)] mb-4">
                            Why Smart Reviews <span className="text-blue-500">Work</span>
                        </h2>
                    </div>

                    {/* 3D Marquee with overlaid benefit cards */}
                    <div className="relative overflow-hidden rounded-[1.5rem] md:rounded-[3rem] border border-[var(--glass-border)] h-[400px] md:h-[600px] lg:h-[700px]">
                        {/* Marquee keyframes */}
                        <style>{`
                            @keyframes marquee-scroll-left {
                                from { transform: translateX(0); }
                                to { transform: translateX(-50%); }
                            }
                            @keyframes marquee-scroll-right {
                                from { transform: translateX(-50%); }
                                to { transform: translateX(0); }
                            }
                            .marquee-3d-wrapper {
                                transform: rotateX(20deg) scale(0.7);
                                transform-style: preserve-3d;
                            }
                            @media (min-width: 768px) {
                                .marquee-3d-wrapper {
                                    transform: rotateX(25deg) scale(1.1);
                                }
                            }
                            .smart-reviews-tabs::-webkit-scrollbar { display: none; }
                        `}</style>

                        {/* 3D Perspective Wrapper */}
                        <div className="absolute inset-0 flex items-center justify-center overflow-hidden" style={{ perspective: '1200px' }}>
                            <div className="w-[250%] md:w-[160%] marquee-3d-wrapper">

                                {/* Row 1 - scrolls left */}
                                <div className="flex gap-2 md:gap-4 mb-2 md:mb-4" style={{ animation: 'marquee-scroll-left 45s linear infinite', width: 'max-content' }}>
                                    {[0, 1].map((dup) => (
                                        <div key={dup} className="flex gap-2 md:gap-4 flex-shrink-0">
                                            {/* 5-Star Rating */}
                                            <div className="w-[200px] h-[110px] rounded-2xl bg-gradient-to-br from-yellow-500/10 to-amber-500/5 border border-yellow-500/20 p-4 flex flex-col justify-center flex-shrink-0">
                                                <div className="flex gap-0.5 mb-2">{[1,2,3,4,5].map(s => <Star key={s} size={14} className="text-yellow-400 fill-yellow-400" />)}</div>
                                                <span className="text-white/70 text-sm font-bold">4.9 Rating</span>
                                                <span className="text-white/30 text-[10px]">128 Google Reviews</span>
                                            </div>
                                            {/* SMS Sent */}
                                            <div className="w-[180px] h-[110px] rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border border-blue-500/20 p-4 flex flex-col justify-center flex-shrink-0">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center"><Smartphone size={12} className="text-blue-400" /></div>
                                                    <span className="text-blue-400 text-[10px] font-bold">SMS Sent</span>
                                                </div>
                                                <p className="text-white/40 text-[9px]">Review request delivered to Sarah M.</p>
                                            </div>
                                            {/* New Review Alert */}
                                            <div className="w-[210px] h-[110px] rounded-2xl bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/20 p-4 flex flex-col justify-center flex-shrink-0">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <CheckCircle size={14} className="text-green-400" />
                                                    <span className="text-green-400 text-xs font-bold">New 5-Star Review!</span>
                                                </div>
                                                <p className="text-white/40 text-[9px]">"Exceptional service. Highly recommended to anyone!"</p>
                                            </div>
                                            {/* Google Badge */}
                                            <div className="w-[190px] h-[110px] rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 p-4 flex flex-col justify-center flex-shrink-0">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                                                    <span className="text-white/60 text-xs font-semibold">Google Reviews</span>
                                                </div>
                                                <div className="flex gap-0.5">{[1,2,3,4,5].map(s => <Star key={s} size={10} className="text-yellow-400 fill-yellow-400" />)}</div>
                                            </div>
                                            {/* Automated Workflow */}
                                            <div className="w-[170px] h-[110px] rounded-2xl bg-gradient-to-br from-violet-500/10 to-purple-500/5 border border-violet-500/20 p-4 flex flex-col justify-center flex-shrink-0">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Zap size={14} className="text-violet-400" />
                                                    <span className="text-violet-400 text-[10px] font-bold">Automated</span>
                                                </div>
                                                <p className="text-white/40 text-[9px]">Review request sent 24h after service</p>
                                            </div>
                                            {/* Email Preview */}
                                            <div className="w-[200px] h-[110px] rounded-2xl bg-gradient-to-br from-sky-500/10 to-blue-500/5 border border-sky-500/20 p-4 flex flex-col justify-center flex-shrink-0">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Mail size={14} className="text-sky-400" />
                                                    <span className="text-sky-400 text-[10px] font-bold">Email Request</span>
                                                </div>
                                                <p className="text-white/40 text-[9px]">Hi James, we'd love to hear about your experience...</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Row 2 - scrolls right */}
                                <div className="flex gap-2 md:gap-4 mb-2 md:mb-4" style={{ animation: 'marquee-scroll-right 50s linear infinite', width: 'max-content' }}>
                                    {[0, 1].map((dup) => (
                                        <div key={dup} className="flex gap-2 md:gap-4 flex-shrink-0">
                                            {/* Shield Protection */}
                                            <div className="w-[190px] h-[110px] rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/5 border border-blue-500/20 p-4 flex flex-col justify-center flex-shrink-0">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Shield size={14} className="text-blue-400" />
                                                    <span className="text-blue-400 text-[10px] font-bold">Rating Protected</span>
                                                </div>
                                                <p className="text-white/40 text-[9px]">Negative feedback intercepted and routed privately</p>
                                            </div>
                                            {/* Review Count */}
                                            <div className="w-[160px] h-[110px] rounded-2xl bg-gradient-to-br from-emerald-500/10 to-green-500/5 border border-emerald-500/20 p-4 flex flex-col justify-center flex-shrink-0">
                                                <span className="text-3xl font-black text-emerald-400/80 mb-1">127</span>
                                                <span className="text-white/40 text-[10px] font-semibold">Total Reviews</span>
                                            </div>
                                            {/* Private Feedback */}
                                            <div className="w-[200px] h-[110px] rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 p-4 flex flex-col justify-center flex-shrink-0">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <MessageSquare size={14} className="text-amber-400" />
                                                    <span className="text-amber-400 text-[10px] font-bold">Private Feedback</span>
                                                </div>
                                                <p className="text-white/40 text-[9px]">"The wait time was longer than expected..."</p>
                                            </div>
                                            {/* Growth Metric */}
                                            <div className="w-[170px] h-[110px] rounded-2xl bg-gradient-to-br from-green-500/10 to-teal-500/5 border border-green-500/20 p-4 flex flex-col justify-center flex-shrink-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <TrendingUp size={14} className="text-green-400" />
                                                    <span className="text-green-400 text-lg font-black">+43%</span>
                                                </div>
                                                <span className="text-white/40 text-[10px]">Review growth this quarter</span>
                                            </div>
                                            {/* Customer Card */}
                                            <div className="w-[200px] h-[110px] rounded-2xl bg-gradient-to-br from-pink-500/10 to-rose-500/5 border border-pink-500/20 p-4 flex flex-col justify-center flex-shrink-0">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-7 h-7 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-400 text-[10px] font-bold">JD</div>
                                                    <div>
                                                        <span className="text-white/60 text-[10px] font-semibold block">James D.</span>
                                                        <div className="flex gap-0.5">{[1,2,3,4,5].map(s => <Star key={s} size={8} className="text-yellow-400 fill-yellow-400" />)}</div>
                                                    </div>
                                                </div>
                                                <p className="text-white/40 text-[9px]">"Best CPA firm in the city!"</p>
                                            </div>
                                            {/* Auto Schedule */}
                                            <div className="w-[180px] h-[110px] rounded-2xl bg-gradient-to-br from-cyan-500/10 to-teal-500/5 border border-cyan-500/20 p-4 flex flex-col justify-center flex-shrink-0">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <RefreshCw size={14} className="text-cyan-400" />
                                                    <span className="text-cyan-400 text-[10px] font-bold">Auto-Scheduled</span>
                                                </div>
                                                <p className="text-white/40 text-[9px]">Next batch: 12 requests queued for tomorrow</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Row 3 - scrolls left (slower) */}
                                <div className="flex gap-2 md:gap-4 mb-2 md:mb-4" style={{ animation: 'marquee-scroll-left 55s linear infinite', width: 'max-content' }}>
                                    {[0, 1].map((dup) => (
                                        <div key={dup} className="flex gap-2 md:gap-4 flex-shrink-0">
                                            {/* Response Rate */}
                                            <div className="w-[180px] h-[110px] rounded-2xl bg-gradient-to-br from-indigo-500/10 to-blue-500/5 border border-indigo-500/20 p-4 flex flex-col justify-center flex-shrink-0">
                                                <span className="text-3xl font-black text-indigo-400/80 mb-1">72%</span>
                                                <span className="text-white/40 text-[10px] font-semibold">Response Rate</span>
                                            </div>
                                            {/* Redirect Success */}
                                            <div className="w-[210px] h-[110px] rounded-2xl bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/20 p-4 flex flex-col justify-center flex-shrink-0">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <ThumbsUp size={14} className="text-green-400" />
                                                    <span className="text-green-400 text-[10px] font-bold">Redirected to Google</span>
                                                </div>
                                                <p className="text-white/40 text-[9px]">Happy customer sent to leave a public review</p>
                                            </div>
                                            {/* Issue Resolved */}
                                            <div className="w-[190px] h-[110px] rounded-2xl bg-gradient-to-br from-teal-500/10 to-cyan-500/5 border border-teal-500/20 p-4 flex flex-col justify-center flex-shrink-0">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <CheckCircle size={14} className="text-teal-400" />
                                                    <span className="text-teal-400 text-[10px] font-bold">Issue Resolved</span>
                                                </div>
                                                <p className="text-white/40 text-[9px]">Client concern addressed before going public</p>
                                            </div>
                                            {/* Rating Comparison */}
                                            <div className="w-[200px] h-[110px] rounded-2xl bg-gradient-to-br from-yellow-500/10 to-amber-500/5 border border-yellow-500/20 p-4 flex flex-col justify-center flex-shrink-0">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-white/50 text-[10px] font-semibold">Before</span>
                                                    <span className="text-white/50 text-[10px] font-semibold">After</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-white/30 text-lg font-bold">3.2</span>
                                                    <ArrowRight size={14} className="text-yellow-400/50" />
                                                    <span className="text-yellow-400 text-lg font-bold">4.9</span>
                                                </div>
                                            </div>
                                            {/* Notification Bell */}
                                            <div className="w-[170px] h-[110px] rounded-2xl bg-gradient-to-br from-rose-500/10 to-pink-500/5 border border-rose-500/20 p-4 flex flex-col justify-center flex-shrink-0">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Star size={14} className="text-rose-400 fill-rose-400" />
                                                    <span className="text-rose-400 text-[10px] font-bold">Milestone!</span>
                                                </div>
                                                <p className="text-white/40 text-[9px]">You've reached 100+ five-star reviews</p>
                                            </div>
                                            {/* One-Click */}
                                            <div className="w-[190px] h-[110px] rounded-2xl bg-gradient-to-br from-purple-500/10 to-violet-500/5 border border-purple-500/20 p-4 flex flex-col justify-center flex-shrink-0">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <MousePointerClick size={14} className="text-purple-400" />
                                                    <span className="text-purple-400 text-[10px] font-bold">One-Click Review</span>
                                                </div>
                                                <p className="text-white/40 text-[9px]">Frictionless experience for your clients</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Row 4 - scrolls right (slowest) */}
                                <div className="flex gap-2 md:gap-4" style={{ animation: 'marquee-scroll-right 60s linear infinite', width: 'max-content' }}>
                                    {[0, 1].map((dup) => (
                                        <div key={dup} className="flex gap-2 md:gap-4 flex-shrink-0">
                                            {/* Competitor Edge */}
                                            <div className="w-[200px] h-[110px] rounded-2xl bg-gradient-to-br from-blue-500/10 to-sky-500/5 border border-blue-500/20 p-4 flex flex-col justify-center flex-shrink-0">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <TrendingUp size={14} className="text-blue-400" />
                                                    <span className="text-blue-400 text-[10px] font-bold">Outrank Competitors</span>
                                                </div>
                                                <p className="text-white/40 text-[9px]">Higher ratings = higher search visibility</p>
                                            </div>
                                            {/* Trust Signal */}
                                            <div className="w-[180px] h-[110px] rounded-2xl bg-gradient-to-br from-emerald-500/10 to-green-500/5 border border-emerald-500/20 p-4 flex flex-col justify-center flex-shrink-0">
                                                <span className="text-3xl font-black text-emerald-400/80 mb-1">93%</span>
                                                <span className="text-white/40 text-[10px] font-semibold">Trust Online Reviews</span>
                                            </div>
                                            {/* Feedback Loop */}
                                            <div className="w-[190px] h-[110px] rounded-2xl bg-gradient-to-br from-amber-500/10 to-yellow-500/5 border border-amber-500/20 p-4 flex flex-col justify-center flex-shrink-0">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <RefreshCw size={14} className="text-amber-400" />
                                                    <span className="text-amber-400 text-[10px] font-bold">Feedback Loop</span>
                                                </div>
                                                <p className="text-white/40 text-[9px]">Learn, improve, earn better reviews</p>
                                            </div>
                                            {/* Happy Client */}
                                            <div className="w-[200px] h-[110px] rounded-2xl bg-gradient-to-br from-green-500/10 to-teal-500/5 border border-green-500/20 p-4 flex flex-col justify-center flex-shrink-0">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 text-[10px] font-bold">SM</div>
                                                    <div>
                                                        <span className="text-white/60 text-[10px] font-semibold block">Sarah M.</span>
                                                        <div className="flex gap-0.5">{[1,2,3,4,5].map(s => <Star key={s} size={8} className="text-yellow-400 fill-yellow-400" />)}</div>
                                                    </div>
                                                </div>
                                                <p className="text-white/40 text-[9px]">"Could not be happier with the service!"</p>
                                            </div>
                                            {/* Send Notification */}
                                            <div className="w-[180px] h-[110px] rounded-2xl bg-gradient-to-br from-indigo-500/10 to-violet-500/5 border border-indigo-500/20 p-4 flex flex-col justify-center flex-shrink-0">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Send size={14} className="text-indigo-400" />
                                                    <span className="text-indigo-400 text-[10px] font-bold">Batch Sent</span>
                                                </div>
                                                <p className="text-white/40 text-[9px]">15 review requests sent this week</p>
                                            </div>
                                            {/* Star Climb */}
                                            <div className="w-[170px] h-[110px] rounded-2xl bg-gradient-to-br from-yellow-500/10 to-orange-500/5 border border-yellow-500/20 p-4 flex flex-col justify-center flex-shrink-0">
                                                <div className="flex items-center gap-1 mb-1">
                                                    {[1,2,3,4,5].map(s => <Star key={s} size={12} className="text-yellow-400 fill-yellow-400" />)}
                                                </div>
                                                <span className="text-yellow-400 text-lg font-black">5.0</span>
                                                <span className="text-white/30 text-[9px]">Perfect rating achieved</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                            </div>
                        </div>

                        {/* Soft vignette — edge fades only so marquee stays visible */}
                        <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to bottom, var(--bg-main) 0%, transparent 20%, transparent 80%, var(--bg-main) 100%)' }} />
                        <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to right, var(--bg-main) 0%, transparent 15%, transparent 85%, var(--bg-main) 100%)' }} />

                        {/* Overlaid Benefit Cards */}
                        <div className="absolute inset-0 flex items-center justify-center p-3 md:p-8">
                            <div className="grid grid-cols-2 gap-2 md:gap-5 max-w-3xl w-full">
                                {[
                                    { icon: <Shield size={16} className="text-blue-400 md:w-[22px] md:h-[22px]" />, title: 'Protect Your Google Rating', description: 'Negative experiences get routed to private feedback instead of public reviews. Your rating stays intact.', iconDark: 'bg-blue-500/10 border-blue-500/20', iconLight: 'bg-blue-50 border-blue-200' },
                                    { icon: <RefreshCw size={16} className="text-emerald-400 md:w-[22px] md:h-[22px]" />, title: 'Turn Feedback Into Improvement', description: 'Every piece of critical feedback is an opportunity to fix issues and win back clients before they leave.', iconDark: 'bg-emerald-500/10 border-emerald-500/20', iconLight: 'bg-emerald-50 border-emerald-200' },
                                    { icon: <Zap size={16} className="text-violet-400 md:w-[22px] md:h-[22px]" />, title: 'Automate the Ask', description: "Stop relying on memory or sticky notes. Every client gets asked for a review automatically at the right time.", iconDark: 'bg-violet-500/10 border-violet-500/20', iconLight: 'bg-violet-50 border-violet-200' },
                                    { icon: <Star size={16} className="text-yellow-400 fill-yellow-400 md:w-[22px] md:h-[22px]" />, title: 'More 5-Star Reviews', description: 'Happy clients who are asked leave reviews. It is that simple. Watch your star count climb.', iconDark: 'bg-yellow-500/10 border-yellow-500/20', iconLight: 'bg-yellow-50 border-yellow-200' },
                                ].map((item, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, y: 20 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: 0.2 + i * 0.1 }}
                                        className={`p-2.5 md:p-6 rounded-xl md:rounded-3xl border backdrop-blur-xl transition-all hover:scale-[1.02] ${theme === 'dark' ? 'bg-black/70 border-white/10 hover:border-white/20' : 'bg-white/80 border-black/10 hover:border-black/20'}`}
                                    >
                                        <div className={`w-8 h-8 md:w-12 md:h-12 mb-2 md:mb-4 rounded-lg md:rounded-xl flex items-center justify-center border ${theme === 'dark' ? item.iconDark : item.iconLight}`}>
                                            {item.icon}
                                        </div>
                                        <h3 className="text-[11px] md:text-base font-bold text-[var(--text-main)] mb-1 md:mb-2 leading-tight">{item.title}</h3>
                                        <p className="text-[var(--text-muted)] text-[9px] md:text-xs leading-relaxed hidden sm:block">{item.description}</p>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </div>
                </motion.section>

                {/* ── SECTION 6: Final CTA ── */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center"
                >
                    <div className="max-w-4xl mx-auto p-6 md:p-20 rounded-[1.5rem] md:rounded-[3rem] border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-t from-blue-500/10 to-transparent pointer-events-none" />
                        <div className="relative z-10">
                            <h2 className="text-xl md:text-5xl font-bold text-[var(--text-main)] mb-4 md:mb-8 tracking-tight leading-tight">
                                Ready to Turn Happy Clients Into <br className="hidden md:block" /><span className="text-blue-500">5-Star Marketing Machines?</span>
                            </h2>
                            <p className="text-sm md:text-xl text-[var(--text-muted)] mb-6 md:mb-12 max-w-2xl mx-auto leading-relaxed font-medium">
                                Let us set up Smart Reviews for your business. We will show you exactly how it works and what kind of impact it can have on your Google presence.
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

            </div>
        </div>
    );
};

export default SmartReviews;
