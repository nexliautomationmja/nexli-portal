'use client';
import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from './ThemeProvider';

const CARDS = [
    { amount: '$50K', label: 'Lost Client', network: 'visa' as const },
    { amount: '$120K', label: 'Missed Retainer', network: 'mastercard' as const },
    { amount: '$75K', label: 'Referral Gone', network: 'visa' as const },
    { amount: '$200K', label: 'Walked Away', network: 'mastercard' as const },
    { amount: '$90K', label: 'Never Called', network: 'visa' as const },
    { amount: '$150K', label: 'Chose Competitor', network: 'mastercard' as const },
    { amount: '$300K', label: 'Lost Engagement', network: 'visa' as const },
    { amount: '$65K', label: 'No Follow-Up', network: 'mastercard' as const },
];

const ChipSVG: React.FC = () => (
    <svg width="32" height="24" viewBox="0 0 32 24" fill="none" className="flex-shrink-0">
        <rect x="0.5" y="0.5" width="31" height="23" rx="3.5" fill="var(--glass-bg)" stroke="var(--glass-border)" />
        <rect x="4" y="4" width="10" height="7" rx="1" fill="none" stroke="var(--text-muted)" strokeWidth="0.8" opacity="0.4" />
        <rect x="4" y="13" width="10" height="7" rx="1" fill="none" stroke="var(--text-muted)" strokeWidth="0.8" opacity="0.4" />
        <line x1="9" y1="4" x2="9" y2="20" stroke="var(--text-muted)" strokeWidth="0.8" opacity="0.3" />
        <line x1="4" y1="12" x2="14" y2="12" stroke="var(--text-muted)" strokeWidth="0.8" opacity="0.3" />
        <rect x="18" y="7" width="10" height="10" rx="1" fill="none" stroke="var(--text-muted)" strokeWidth="0.8" opacity="0.25" />
    </svg>
);

const VisaLogo: React.FC = () => (
    <svg width="40" height="14" viewBox="0 0 80 26" fill="none">
        <path d="M33.6 1L27.2 25H21.6L28 1H33.6ZM56.8 16.4L59.6 8.4L61.2 16.4H56.8ZM62.8 25H68L63.6 1H58.8C57.6 1 56.6 1.8 56.2 2.8L47.6 25H53.2L54.4 21.6H61.2L62.8 25ZM49.2 17.2C49.2 10.6 40 10.2 40 7.2C40 6.2 41 5.2 43 5C44 4.8 47 5 49.6 6.2L50.8 1.4C49.4 0.8 47.6 0.4 45.2 0.4C40 0.4 36.2 3.4 36.2 7.6C36.2 10.8 39 12.4 41 13.6C43.2 14.8 44 15.6 44 16.8C44 18.4 42 19.2 40.4 19.2C37.8 19.2 36.4 18.6 34.2 17.6L33 22.6C35.4 23.6 37.6 24 40.2 24C45.8 24 49.2 21.2 49.2 17.2ZM24 1L15.6 25H10L5.8 5.4C5.6 4.2 5.2 3.8 4.2 3.2C2.6 2.4 0 1.4 0 1.4L0.2 1H9C10.4 1 11.6 2 11.8 3.4L14 16L19.6 1H24Z" fill="var(--text-muted)" fillOpacity="0.5" />
    </svg>
);

const MastercardLogo: React.FC = () => (
    <svg width="36" height="22" viewBox="0 0 36 22" fill="none">
        <circle cx="13" cy="11" r="10" fill="#EB001B" fillOpacity="0.4" />
        <circle cx="23" cy="11" r="10" fill="#F79E1B" fillOpacity="0.4" />
        <path d="M18 3.2C19.9 4.8 21.2 7 21.6 9.5H14.4C14.8 7 16.1 4.8 18 3.2ZM18 18.8C16.1 17.2 14.8 15 14.4 12.5H21.6C21.2 15 19.9 17.2 18 18.8Z" fill="#FF5F00" fillOpacity="0.5" />
    </svg>
);

const CreditCard: React.FC<{ amount: string; label: string; network: 'visa' | 'mastercard' }> = ({ amount, label, network }) => {
    return (
        <div
            className="flex-shrink-0 w-[200px] md:w-[250px] h-[125px] md:h-[150px] rounded-2xl md:rounded-3xl relative overflow-hidden mx-3 md:mx-4 bg-[var(--glass-bg)] border border-[var(--glass-border)] backdrop-blur-md"
        >
            {/* Card chip */}
            <div className="absolute top-4 left-4">
                <ChipSVG />
            </div>
            {/* Network logo */}
            <div className="absolute top-4 right-4">
                {network === 'visa' ? <VisaLogo /> : <MastercardLogo />}
            </div>
            {/* Amount */}
            <div className="absolute bottom-4 left-4">
                <div className="text-2xl md:text-3xl font-black tracking-tight text-[var(--text-main)]" style={{ fontFamily: "'Syne', sans-serif" }}>
                    {amount}
                </div>
                <div className="text-[10px] md:text-xs font-bold uppercase tracking-[0.15em] mt-0.5 text-red-400/80">
                    {label}
                </div>
            </div>
            {/* Card number dots */}
            <div className="absolute bottom-5 right-4 flex gap-3">
                {[0, 1, 2, 3].map((group) => (
                    <div key={group} className="flex gap-0.5">
                        {[0, 1, 2, 3].map((dot) => (
                            <div key={dot} className="w-[3px] h-[3px] rounded-full bg-[var(--text-muted)] opacity-20" />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};

const CardShredder: React.FC = () => {
    const { theme } = useTheme();
    const allCards = [...CARDS, ...CARDS];

    return (
        <section className="relative py-16 md:py-24 overflow-hidden bg-[var(--bg-main)]">
            {/* Section header */}
            <div className="max-w-4xl mx-auto px-6 text-center mb-10 md:mb-14 relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                >
                    <p className="text-red-500 text-[10px] md:text-xs font-black tracking-[0.25em] uppercase mb-3 md:mb-4">
                        Every month without a strategy
                    </p>
                    <h2
                        className="text-2xl sm:text-3xl md:text-5xl font-black text-[var(--text-main)] tracking-tight leading-tight mb-3 md:mb-4"
                        style={{ fontFamily: "'Syne', sans-serif" }}
                    >
                        Your Online Presence Is{' '}
                        <motion.span
                            className="text-red-500 inline-block"
                            animate={{ scale: [1, 1.03, 1] }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        >
                            Shredding Revenue
                        </motion.span>
                    </h2>
                    <p className="text-sm md:text-lg text-[var(--text-muted)] max-w-2xl mx-auto">
                        While you wait to "get around to it," prospects are Googling your firm, judging what they find, and booking with someone else.
                    </p>
                </motion.div>
            </div>

            {/* Card stream container */}
            <div className="relative">
                {/* Shredder beam - center vertical line */}
                <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 z-20 flex flex-col items-center pointer-events-none">
                    <div
                        className="absolute inset-0 w-[2px]"
                        style={{
                            background: 'linear-gradient(180deg, transparent 0%, #ef4444 20%, #f97316 50%, #ef4444 80%, transparent 100%)',
                            boxShadow: '0 0 30px 10px rgba(239,68,68,0.3), 0 0 60px 20px rgba(239,68,68,0.1)',
                        }}
                    />
                    <motion.div
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute inset-0 w-[4px] -ml-[1px]"
                        style={{
                            background: 'linear-gradient(180deg, transparent 0%, #ef4444 30%, #f97316 50%, #ef4444 70%, transparent 100%)',
                            filter: 'blur(4px)',
                        }}
                    />
                </div>

                {/* Left fade mask */}
                <div
                    className="absolute left-0 top-0 bottom-0 w-24 md:w-40 z-10 pointer-events-none"
                    style={{
                        background: theme === 'dark'
                            ? 'linear-gradient(to right, #020617, transparent)'
                            : 'linear-gradient(to right, #ffffff, transparent)',
                    }}
                />

                {/* Right fade mask */}
                <div
                    className="absolute right-0 top-0 bottom-0 w-24 md:w-40 z-10 pointer-events-none"
                    style={{
                        background: theme === 'dark'
                            ? 'linear-gradient(to left, #020617, transparent)'
                            : 'linear-gradient(to left, #ffffff, transparent)',
                    }}
                />

                {/* Single row - scrolling left */}
                <div className="relative overflow-hidden">
                    <div
                        className="flex animate-[scroll-left_35s_linear_infinite]"
                        style={{ width: 'max-content' }}
                    >
                        {allCards.map((card, i) => (
                            <CreditCard key={`row-${i}`} amount={card.amount} label={card.label} network={card.network} />
                        ))}
                    </div>
                </div>

                {/* Floating particles around the shredder beam */}
                <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-20 z-30 pointer-events-none overflow-hidden">
                    {[...Array(12)].map((_, i) => {
                        // Deterministic pseudo-random values based on index to avoid hydration mismatch
                        const seed = (i * 7 + 3) % 12;
                        const left = 30 + (seed / 12) * 40;
                        const top = ((i * 13 + 5) % 12) / 12 * 100;
                        const yOffset = -30 - (seed / 12) * 40;
                        const xOffset = ((seed / 12) - 0.5) * 30;
                        const duration = 2 + (seed / 12) * 2;
                        const delay = (i / 12) * 3;
                        return (
                        <motion.div
                            key={i}
                            className="absolute w-1 h-1 rounded-full"
                            style={{
                                background: i % 2 === 0 ? '#ef4444' : '#f97316',
                                left: `${left}%`,
                                top: `${top}%`,
                            }}
                            animate={{
                                y: [0, yOffset, 0],
                                x: [0, xOffset, 0],
                                opacity: [0, 0.8, 0],
                                scale: [0, 1, 0],
                            }}
                            transition={{
                                duration,
                                repeat: Infinity,
                                delay,
                                ease: 'easeInOut',
                            }}
                        />
                    );})}
                </div>
            </div>

            {/* Bottom stat line */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="max-w-4xl mx-auto px-6 text-center mt-10 md:mt-14"
            >
                <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-red-500/5 border border-red-500/10">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-red-400 text-xs md:text-sm font-bold">
                        The average CPA firm loses $435K+ per year from client attrition — retaining clients and streamlining operations beats the revolving door every time (CPA Trendlines)
                    </span>
                </div>
            </motion.div>

            <style>{`
                @keyframes scroll-left {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
            `}</style>
        </section>
    );
};

export default CardShredder;
