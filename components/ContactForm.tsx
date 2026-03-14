'use client';
import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Send, CheckCircle } from 'lucide-react';
import { useTheme } from './ThemeProvider';

const ContactForm: React.FC = () => {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    websiteUrl: '',
    firmType: '',
    phone: '',
    marketingSmsOptIn: false,
    nonMarketingSmsOptIn: false
  });

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleUrlBlur = () => {
    let url = formData.websiteUrl.trim();
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
      setFormData(prev => ({ ...prev, websiteUrl: `https://${url}` }));
    }
  };

  const handleAuditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate phone number if either SMS consent is checked
    if ((formData.marketingSmsOptIn || formData.nonMarketingSmsOptIn) && !formData.phone.trim()) {
      setError('Phone number is required when opting in to SMS messages.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/forms/audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        if (typeof (window as any).fbq === 'function') {
          (window as any).fbq('track', 'SubmitApplication', {
            content_name: 'Website Brand Audit',
          });
        }
        setSubmitted(true);
      } else {
        console.error('Webhook submission failed');
        // Still show success to user for better UX, or could add an error state
        setSubmitted(true);
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  const { theme } = useTheme();

  return (
    <section className="py-10 md:py-32 bg-[var(--bg-main)] transition-colors duration-300" id="brand-audit">
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        <div className="text-center mb-6 md:mb-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-3 mb-4 md:mb-6 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20"
          >
            {theme === 'dark' ? (
              <svg className="w-5 h-5 md:w-6 md:h-6" viewBox="0 0 48 48" fill="none">
                <defs>
                  <linearGradient id="logo-grad-audit" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#2563EB"></stop>
                    <stop offset="100%" stopColor="#06B6D4"></stop>
                  </linearGradient>
                </defs>
                <path d="M4 36L20 24L4 12L4 20L12 24L4 28L4 36Z" fill="#2563EB"></path>
                <path d="M12 36L28 24L12 12L12 18L18 24L12 30L12 36Z" fill="url(#logo-grad-audit)"></path>
                <path d="M20 36L44 24L20 12L20 18L32 24L20 30L20 36Z" fill="#06B6D4"></path>
              </svg>
            ) : (
              <img
                src="/logos/icon-light.svg"
                alt="Nexli"
                className="w-5 h-5 md:w-6 md:h-6"
              />
            )}
            <span className="text-blue-400 text-[10px] md:text-sm font-black tracking-[0.2em] uppercase">Nexli Brand Audit</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, ease: "circOut" }}
            className="text-[var(--text-main)] mb-4 md:mb-6 text-2xl md:text-5xl font-bold"
          >
            What's Your Website's <span className="text-blue-500">Real Score?</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-[var(--text-muted)] max-w-2xl mx-auto text-sm md:text-lg px-4"
          >
            Most businesses fail this audit. Find out what's driving high-quality prospects away.
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass-card p-4 md:p-16 rounded-2xl md:rounded-[48px] border border-[var(--glass-border)] shadow-3xl"
        >
          {!submitted ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="text-center mb-5 md:mb-16">
                <h3 className="text-lg md:text-3xl font-black text-[var(--text-main)] mb-2 md:mb-4">Request Your Website & Brand Audit</h3>
                <p className="text-[var(--text-muted)] text-xs md:text-base">Get an expert evaluation of your digital presence and a performance roadmap tailored to your practice.</p>
              </div>

              <form onSubmit={handleAuditSubmit} className="space-y-4 md:space-y-8 max-w-2xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-8">
                  <div className="space-y-1 md:space-y-3">
                    <label className="text-[8px] md:text-[10px] font-black text-[var(--text-muted)] opacity-50 uppercase tracking-[0.2em] ml-2">Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="John Smith"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-[var(--glass-border)] border border-[var(--glass-border)] rounded-xl md:rounded-2xl px-4 md:px-6 py-3 md:py-5 text-[var(--text-main)] focus:outline-none focus:border-blue-500 transition-all font-medium text-sm md:text-base"
                    />
                  </div>
                  <div className="space-y-1 md:space-y-3">
                    <label className="text-[8px] md:text-[10px] font-black text-[var(--text-muted)] opacity-50 uppercase tracking-[0.2em] ml-2">Work Email</label>
                    <input
                      type="email"
                      required
                      placeholder="john@yourfirm.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-[var(--glass-border)] border border-[var(--glass-border)] rounded-xl md:rounded-2xl px-4 md:px-6 py-3 md:py-5 text-[var(--text-main)] focus:outline-none focus:border-blue-500 transition-all font-medium text-sm md:text-base"
                    />
                  </div>
                </div>

                <div className="space-y-1 md:space-y-3">
                  <label className="text-[8px] md:text-[10px] font-black text-[var(--text-muted)] opacity-50 uppercase tracking-[0.2em] ml-2">Firm Type</label>
                  <select
                    required
                    value={formData.firmType}
                    onChange={(e) => setFormData({ ...formData, firmType: e.target.value })}
                    className="w-full bg-[var(--glass-border)] border border-[var(--glass-border)] rounded-xl md:rounded-2xl px-4 md:px-6 py-3 md:py-5 text-[var(--text-main)] focus:outline-none focus:border-blue-500 transition-all font-medium text-sm md:text-base appearance-none cursor-pointer"
                  >
                    <option value="" disabled>Select your firm type</option>
                    <option value="Wealth Management">Wealth Management</option>
                    <option value="CPA Firm">CPA Firm</option>
                    <option value="Financial Advisor">Financial Advisor</option>
                  </select>
                </div>

                <div className="space-y-1 md:space-y-3">
                  <label className="text-[8px] md:text-[10px] font-black text-[var(--text-muted)] opacity-50 uppercase tracking-[0.2em] ml-2">Firm Website URL</label>
                  <input
                    type="url"
                    required
                    placeholder="https://www.yourfirm.com"
                    value={formData.websiteUrl}
                    onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                    onBlur={handleUrlBlur}
                    className="w-full bg-[var(--glass-border)] border border-[var(--glass-border)] rounded-xl md:rounded-2xl px-4 md:px-6 py-3 md:py-5 text-[var(--text-main)] focus:outline-none focus:border-blue-500 transition-all font-medium text-sm md:text-base"
                  />
                </div>

                <div className="space-y-1 md:space-y-3">
                  <label className="text-[8px] md:text-[10px] font-black text-[var(--text-muted)] opacity-50 uppercase tracking-[0.2em] ml-2">Mobile Phone Number (Optional)</label>
                  <input
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-[var(--glass-border)] border border-[var(--glass-border)] rounded-xl md:rounded-2xl px-4 md:px-6 py-3 md:py-5 text-[var(--text-main)] focus:outline-none focus:border-blue-500 transition-all font-medium text-sm md:text-base"
                  />
                </div>

                <div className="space-y-2 md:space-y-4">
                  {error && (
                    <div className="p-3 md:p-4 bg-red-500/10 border border-red-500/20 rounded-xl md:rounded-2xl">
                      <p className="text-red-500 text-xs md:text-sm font-bold text-center">{error}</p>
                    </div>
                  )}

                  {/* Marketing SMS Consent */}
                  <div
                    className="flex items-start gap-2 md:gap-3 p-3 md:p-4 glass-card rounded-xl md:rounded-2xl border border-[var(--glass-border)] transition-colors cursor-pointer hover:border-blue-500/30"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, marketingSmsOptIn: !prev.marketingSmsOptIn }));
                    }}
                  >
                    <div className={`mt-0.5 w-4 h-4 md:w-5 md:h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${formData.marketingSmsOptIn ? 'bg-blue-600 border-blue-600' : 'border-[var(--glass-border)]'}`}>
                      {formData.marketingSmsOptIn && <CheckCircle className="text-white" size={12} />}
                    </div>
                    <div className="flex-1">
                      <p className="text-[var(--text-main)] text-[8px] md:text-xs font-medium leading-tight md:leading-relaxed">
                        I consent to receive marketing text messages from <strong>Nexli Automation LLC</strong> at the phone number provided. Frequency may vary. Message & data rates may apply. Text HELP for assistance, reply STOP to opt out.
                      </p>
                    </div>
                  </div>

                  {/* Non-Marketing SMS Consent */}
                  <div
                    className="flex items-start gap-2 md:gap-3 p-3 md:p-4 glass-card rounded-xl md:rounded-2xl border border-[var(--glass-border)] transition-colors cursor-pointer hover:border-blue-500/30"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, nonMarketingSmsOptIn: !prev.nonMarketingSmsOptIn }));
                    }}
                  >
                    <div className={`mt-0.5 w-4 h-4 md:w-5 md:h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${formData.nonMarketingSmsOptIn ? 'bg-blue-600 border-blue-600' : 'border-[var(--glass-border)]'}`}>
                      {formData.nonMarketingSmsOptIn && <CheckCircle className="text-white" size={12} />}
                    </div>
                    <div className="flex-1">
                      <p className="text-[var(--text-main)] text-[8px] md:text-xs font-medium leading-tight md:leading-relaxed">
                        I consent to receive non-marketing text messages from <strong>Nexli Automation LLC</strong> about Marketing. Message & data rates may apply. Text HELP for assistance, reply STOP to opt out.
                      </p>
                    </div>
                  </div>

                  <p className="px-2 text-[var(--text-muted)] opacity-50 text-[7px] md:text-[9px] leading-relaxed italic text-center">
                    View our{' '}
                    <button type="button" onClick={() => router.push('/privacy')} className="underline hover:text-blue-500 transition-colors bg-transparent border-none p-0 italic text-[var(--text-muted)] opacity-100 text-[7px] md:text-[9px] cursor-pointer">Privacy Policy</button>{' '}and{' '}
                    <button type="button" onClick={() => router.push('/terms')} className="underline hover:text-blue-500 transition-colors bg-transparent border-none p-0 italic text-[var(--text-muted)] opacity-100 text-[7px] md:text-[9px] cursor-pointer">Terms & Conditions</button>.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-3 md:py-6 rounded-xl md:rounded-2xl flex items-center justify-center gap-2 md:gap-3 transition-all shadow-2xl shadow-blue-600/20 active:scale-[0.98] uppercase tracking-widest text-[10px] md:text-sm ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {loading ? (
                    <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Send size={14} className="md:w-4 md:h-4" />
                  )}
                  {loading ? 'Sending...' : 'Get My Free Audit'}
                </button>

                <p className="text-center text-[var(--text-muted)] opacity-30 text-[7px] md:text-[10px] font-black uppercase tracking-[0.1em]">
                  Elite Partners Only • NDA Guaranteed • RESPONSE IN 24H
                </p>
              </form>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-12 md:py-20 text-center"
            >
              <div className="w-16 h-16 md:w-20 md:h-20 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 md:mb-8 text-green-500">
                <CheckCircle size={40} />
              </div>
              <h3 className="text-2xl md:text-4xl font-bold text-[var(--text-main)] mb-4 md:mb-6">Thanks!</h3>
              <p className="text-[var(--text-muted)] text-base md:text-xl max-w-md mx-auto leading-relaxed px-4">
                Your Website & Brand Audit is on the way. Check your inbox.
              </p>
              <button
                onClick={() => setSubmitted(false)}
                className="mt-8 md:mt-12 text-blue-500 font-black uppercase tracking-[0.2em] text-[10px] md:text-xs hover:text-blue-400 transition-colors"
              >
                Back to form
              </button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </section>
  );
};

export default ContactForm;
