'use client';
import React from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { FileText, ArrowLeft } from 'lucide-react';

const TermsAndConditions: React.FC = () => {
    const router = useRouter();
    return (
        <section className="min-h-screen py-32 bg-[var(--bg-main)] transition-colors duration-300">
            <div className="max-w-4xl mx-auto px-6">
                <button
                    onClick={() => router.push('/')}
                    className="flex items-center gap-2 text-blue-500 font-bold mb-12 hover:gap-3 transition-all uppercase tracking-widest text-xs"
                >
                    <ArrowLeft size={16} />
                    Back to Home
                </button>

                <div className="mb-16">
                    <div className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20">
                        <FileText className="text-blue-400" size={16} />
                        <span className="text-blue-400 text-xs font-black tracking-[0.2em] uppercase">Partnership Terms</span>
                    </div>
                    <h1 className="text-[var(--text-main)] text-5xl md:text-7xl font-bold mb-8">Terms & Conditions</h1>
                    <p className="text-[var(--text-muted)] text-xl leading-relaxed">
                        Effective Date: January 18, 2026
                    </p>
                </div>

                <div className="space-y-12 text-[var(--text-muted)] leading-relaxed text-lg">
                    <section className="space-y-4">
                        <h2 className="text-2xl font-bold text-[var(--text-main)]">1. Scope of Service</h2>
                        <p>
                            Nexli Automation LLC ("Nexli") provides high-end website design, strategic client nurturing, and AI automation services specifically for CPAs and accounting firms. By accessing our services, you agree to these terms.
                        </p>
                    </section>

                    <section className="space-y-4 p-8 glass-card rounded-3xl border border-blue-500/20 bg-blue-500/5">
                        <h2 className="text-2xl font-bold text-blue-500">2. Fees and Payment Model</h2>
                        <p className="text-[var(--text-main)] font-medium">
                            We operate on a transparent performance-based and retainer model:
                        </p>
                        <ul className="list-disc pl-6 space-y-3">
                            <li>
                                <strong className="text-[var(--text-main)]">Setup Fee:</strong> A non-refundable strategic setup fee is required upfront before work commences. This covers the initial audit, custom architecture design, and systems integration.
                            </li>
                            <li>
                                <strong className="text-[var(--text-main)]">Monthly Retainer:</strong> Upon completion of the initial setup and "go-live," the client moves to a monthly recurring retainer. This covers ongoing automation maintenance, CRM management, hosting, and continuous optimization.
                            </li>
                            <li>
                                <strong className="text-[var(--text-main)]">Cancellation:</strong> Monthly retainers may be cancelled with 30 days written notice.
                            </li>
                        </ul>
                    </section>

                    <section className="space-y-4 p-8 glass-card rounded-3xl border border-blue-500/10">
                        <h2 className="text-2xl font-bold text-[var(--text-main)]">3. SMS Communications (A2P 10DLC)</h2>
                        <p>
                            If you opt-in to receive SMS notifications from Nexli through our web forms:
                        </p>
                        <ul className="list-disc pl-6 space-y-2">
                            <li><strong>Age Requirement:</strong> You must be 18 years of age or older to consent to SMS communications.</li>
                            <li>You agree to receive automated messages including appointment reminders, account alerts, and strategy session confirmations.</li>
                            <li><strong>Message & Data Rates:</strong> Message and data rates may apply.</li>
                            <li><strong>Frequency:</strong> Message frequency may vary based on your interaction with our systems.</li>
                            <li><strong>Help:</strong> Text <span className="text-blue-500 font-bold">HELP</span> at any time for assistance, or contact us at <strong>mail@nexli.net</strong>.</li>
                            <li><strong>Opt-Out:</strong> Text <span className="text-blue-500 font-bold">STOP</span> to <strong>+1 321-241-2945</strong> to cancel. You will receive one final text confirming your request.</li>
                            <li><strong>Carrier Disclaimer:</strong> Carriers are not liable for delayed or undelivered messages.</li>
                        </ul>
                        <p className="text-sm mt-4">
                            For more information on how we handle your data, please review our{' '}
                            <button
                                onClick={() => router.push('/privacy')}
                                className="text-blue-500 underline hover:text-blue-400 transition-colors bg-transparent border-none p-0 cursor-pointer text-sm"
                            >
                                Privacy Policy
                            </button>.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-bold text-[var(--text-main)]">4. Intellectual Property</h2>
                        <p>
                            Upon full payment of the setup fee, Nexli grants the client a license to use the custom-built web assets and automation workflows. Nexli retains title to all underlying proprietary AI frameworks and code libraries used in the assembly of the final product.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-bold text-[var(--text-main)]">5. Limitation of Liability</h2>
                        <p>
                            Nexli shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, or goodwill, arising out of your use of our services.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-bold text-[var(--text-main)]">6. Governing Law</h2>
                        <p>
                            These Terms shall be governed by and defined in accordance with the laws of the United States. Nexli and yourself irrevocably consent that the courts shall have exclusive jurisdiction to resolve any dispute which may arise in connection with these terms.
                        </p>
                    </section>

                    {/* Related Links */}
                    <section className="pt-8 mt-8 border-t border-[var(--glass-border)]">
                        <p className="text-center text-[var(--text-muted)] text-sm">
                            For information about how we collect and use your data, please review our{' '}
                            <button
                                onClick={() => router.push('/privacy')}
                                className="text-blue-500 underline hover:text-blue-400 transition-colors bg-transparent border-none p-0 cursor-pointer font-bold"
                            >
                                Privacy Policy
                            </button>.
                        </p>
                    </section>
                </div>
            </div>
        </section>
    );
};

export default TermsAndConditions;
