'use client';
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { CheckCircle, Send, ArrowRight, Download } from 'lucide-react';
import { useTheme } from './ThemeProvider';

const FreeGuide: React.FC = () => {
    const router = useRouter();
    const { theme } = useTheme();
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        marketingSmsOptIn: false,
        nonMarketingSmsOptIn: false
    });
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Validate phone number if either SMS consent is checked
        if ((formData.marketingSmsOptIn || formData.nonMarketingSmsOptIn) && !formData.phone.trim()) {
            setError('Phone number is required when opting in to SMS messages.');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch('/api/forms/guide', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    firstName: formData.firstName,
                    lastName: formData.lastName,
                    email: formData.email,
                    phone: formData.phone,
                    marketingSmsOptIn: formData.marketingSmsOptIn,
                    nonMarketingSmsOptIn: formData.nonMarketingSmsOptIn,
                }),
            });

            if (response.ok) {
                if (typeof (window as any).fbq === 'function') {
                  (window as any).fbq('track', 'Lead', {
                    content_name: 'Free Guide - 5 Automations',
                  });
                }
                setSubmitted(true);
            } else {
                throw new Error('Form submission failed');
            }
        } catch (error) {
            console.error('Error submitting form:', error);
            alert('There was an error sending the guide. Please try again or contact us.');
        } finally {
            setLoading(false);
        }
    };

    const benefits = [
        { text: "The $36K math — why 5 hours of weekly admin is costing you $78K/year", icon: <ArrowRight size={18} className="text-blue-500" /> },
        { text: "SMS vs. Email: leverage 98% open rates instead of fighting for 20%", icon: <ArrowRight size={18} className="text-blue-500" /> },
        { text: "Copy-and-paste email + SMS templates for reminders, onboarding & follow-ups", icon: <ArrowRight size={18} className="text-blue-500" /> },
        { text: "Reduce no-shows by 30-50% with a simple appointment reminder sequence", icon: <ArrowRight size={18} className="text-blue-500" /> },
        { text: "The AI chatbot + missed call text back system (78% buy from whoever responds first)", icon: <ArrowRight size={18} className="text-blue-500" /> },
        { text: "BONUS: The smart review system that fills your Google profile with 5-star reviews", icon: <ArrowRight size={18} className="text-blue-500" /> }
    ];

    return (
        <div className="min-h-screen bg-[var(--bg-main)] transition-colors duration-300 pt-32 pb-20">
            <div className="max-w-7xl mx-auto px-6">
                {/* Hero Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center mb-24">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8, ease: "circOut" }}
                    >
                        <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20">
                            <span className="text-blue-400 text-[10px] md:text-xs font-black tracking-[0.2em] uppercase">Free Resource</span>
                        </div>
                        <h1 className="text-3xl md:text-5xl font-black text-[var(--text-main)] mb-6 leading-tight tracking-tighter" style={{ fontFamily: "'Syne', sans-serif" }}>
                            The 5 Automations Every Advisory Firm Needs <span className="text-blue-500">(+ The AI Assistant That Handles the Rest)</span>
                        </h1>
                        <p className="text-base md:text-lg text-[var(--text-muted)] mb-8 max-w-xl leading-relaxed">
                            If you bill $300/hour and spend just 5 hours a week on admin — that's $78,000/year gone. This guide gives you the exact systems to get it back.
                        </p>

                        <div className="flex flex-col gap-4 mb-8">
                            {benefits.map((benefit, index) => (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 + (index * 0.1) }}
                                    className="flex items-start gap-3"
                                >
                                    <div className="mt-1">{benefit.icon}</div>
                                    <p className="text-[var(--text-main)] font-medium text-base md:text-lg">{benefit.text}</p>
                                </motion.div>
                            ))}
                        </div>

                        <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 inline-block">
                            <p className="text-[var(--text-muted)] text-sm font-bold uppercase tracking-widest">
                                Built for CPAs & accounting firms who'd rather serve clients than chase admin.
                            </p>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 1, ease: "circOut" }}
                        className="relative"
                    >
                        <div className="absolute inset-0 bg-blue-500/20 blur-[100px] rounded-full" />
                        <img
                            src={theme === 'dark' ? "/guide_mockup.webp" : "/guide_mockup_light.webp"}
                            alt="The 5 Automations Every Advisory Firm Needs Guide"
                            className={`relative z-10 w-full max-w-[550px] mx-auto drop-shadow-[0_0_50px_rgba(37,99,235,0.3)] floating-animation ${theme === 'dark' ? 'mix-blend-screen' : 'mix-blend-multiply'}`}
                            loading="lazy"
                        />
                    </motion.div>
                </div>

                {/* Form Section */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="max-w-3xl mx-auto"
                >
                    <div className="glass-card p-8 md:p-16 rounded-[48px] border border-[var(--glass-border)] shadow-3xl relative overflow-hidden text-center">
                        {!submitted ? (
                            <>
                                <h2 className="text-2xl md:text-4xl font-black text-[var(--text-main)] mb-4" style={{ fontFamily: "'Syne', sans-serif" }}>Get Instant Access</h2>
                                <p className="text-[var(--text-muted)] mb-10">Enter your details below and we'll send the guide to your inbox immediately.</p>

                                <form onSubmit={handleSubmit} className="space-y-6 text-left">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-[var(--text-muted)] opacity-50 uppercase tracking-[0.2em] ml-2">First Name</label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="John"
                                                value={formData.firstName}
                                                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                                className="w-full bg-[var(--glass-border)] border border-[var(--glass-border)] rounded-2xl px-6 py-4 text-[var(--text-main)] focus:outline-none focus:border-blue-500 transition-all font-medium"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-[var(--text-muted)] opacity-50 uppercase tracking-[0.2em] ml-2">Last Name</label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="Doe"
                                                value={formData.lastName}
                                                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                                className="w-full bg-[var(--glass-border)] border border-[var(--glass-border)] rounded-2xl px-6 py-4 text-[var(--text-main)] focus:outline-none focus:border-blue-500 transition-all font-medium"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-[var(--text-muted)] opacity-50 uppercase tracking-[0.2em] ml-2">Email Address</label>
                                            <input
                                                type="email"
                                                required
                                                placeholder="john@yourfirm.com"
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                className="w-full bg-[var(--glass-border)] border border-[var(--glass-border)] rounded-2xl px-6 py-4 text-[var(--text-main)] focus:outline-none focus:border-blue-500 transition-all font-medium"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-[var(--text-muted)] opacity-50 uppercase tracking-[0.2em] ml-2">Phone Number (Optional)</label>
                                            <input
                                                type="tel"
                                                placeholder="+1 (555) 000-0000"
                                                value={formData.phone}
                                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                                className="w-full bg-[var(--glass-border)] border border-[var(--glass-border)] rounded-2xl px-6 py-4 text-[var(--text-main)] focus:outline-none focus:border-blue-500 transition-all font-medium"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        {error && (
                                            <div className="p-3 md:p-4 bg-red-500/10 border border-red-500/20 rounded-xl md:rounded-2xl">
                                                <p className="text-red-500 text-xs md:text-sm font-bold text-center">{error}</p>
                                            </div>
                                        )}

                                        {/* Marketing SMS Consent */}
                                        <div
                                            className="flex items-start gap-3 p-4 glass-card rounded-2xl border border-[var(--glass-border)] transition-colors cursor-pointer hover:border-blue-500/30"
                                            onClick={() => {
                                                setFormData(prev => ({ ...prev, marketingSmsOptIn: !prev.marketingSmsOptIn }));
                                            }}
                                        >
                                            <div className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${formData.marketingSmsOptIn ? 'bg-blue-600 border-blue-600' : 'border-[var(--glass-border)]'}`}>
                                                {formData.marketingSmsOptIn && <CheckCircle className="text-white" size={14} />}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-[var(--text-main)] text-[9px] md:text-xs font-medium leading-relaxed text-left">
                                                    I consent to receive marketing text messages from <strong>Nexli Automation LLC</strong> at the phone number provided. Frequency may vary. Message & data rates may apply. Text HELP for assistance, reply STOP to opt out.
                                                </p>
                                            </div>
                                        </div>

                                        {/* Non-Marketing SMS Consent */}
                                        <div
                                            className="flex items-start gap-3 p-4 glass-card rounded-2xl border border-[var(--glass-border)] transition-colors cursor-pointer hover:border-blue-500/30"
                                            onClick={() => {
                                                setFormData(prev => ({ ...prev, nonMarketingSmsOptIn: !prev.nonMarketingSmsOptIn }));
                                            }}
                                        >
                                            <div className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${formData.nonMarketingSmsOptIn ? 'bg-blue-600 border-blue-600' : 'border-[var(--glass-border)]'}`}>
                                                {formData.nonMarketingSmsOptIn && <CheckCircle className="text-white" size={14} />}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-[var(--text-main)] text-[9px] md:text-xs font-medium leading-relaxed text-left">
                                                    I consent to receive non-marketing text messages from <strong>Nexli Automation LLC</strong> about Marketing. Message & data rates may apply. Text HELP for assistance, reply STOP to opt out.
                                                </p>
                                            </div>
                                        </div>

                                        <p className="px-2 text-[var(--text-muted)] opacity-50 text-[8px] md:text-[9px] leading-relaxed italic text-center">
                                            View our{' '}
                                            <button type="button" onClick={() => router.push('/privacy')} className="underline hover:text-blue-500 transition-colors bg-transparent border-none p-0 italic text-[var(--text-muted)] opacity-100 text-[8px] md:text-[9px] cursor-pointer">Privacy Policy</button>{' '}and{' '}
                                            <button type="button" onClick={() => router.push('/terms')} className="underline hover:text-blue-500 transition-colors bg-transparent border-none p-0 italic text-[var(--text-muted)] opacity-100 text-[8px] md:text-[9px] cursor-pointer">Terms & Conditions</button>.
                                        </p>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className={`w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-6 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-2xl shadow-blue-600/20 active:scale-[0.98] uppercase tracking-widest text-sm ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                                    >
                                        {loading ? (
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <Download size={18} />
                                        )}
                                        {loading ? 'Sending...' : 'Send Me The Guide'}
                                    </button>
                                    <p className="text-center text-[var(--text-muted)] opacity-50 text-[10px] uppercase font-bold tracking-widest pt-2">
                                        We'll email you the guide instantly. No spam, unsubscribe anytime.
                                    </p>
                                </form>
                            </>
                        ) : (
                            <div className="py-10">
                                <div className="w-20 h-20 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center mx-auto mb-8 text-green-500">
                                    <CheckCircle size={40} />
                                </div>
                                <h3 className="text-3xl font-bold text-[var(--text-main)] mb-4">Check Your Inbox!</h3>
                                <p className="text-[var(--text-muted)] text-xl max-w-md mx-auto leading-relaxed">
                                    The guide is on its way to <strong>{formData.email}</strong>. If you don't see it in a few minutes, check your spam folder.
                                </p>
                                <button
                                    onClick={() => setSubmitted(false)}
                                    className="mt-8 text-blue-500 font-black uppercase tracking-[0.2em] text-xs hover:text-blue-400 transition-colors"
                                >
                                    Download again
                                </button>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default FreeGuide;
