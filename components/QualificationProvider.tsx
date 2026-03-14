'use client';
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, CheckCircle, XCircle, Building2, Users, Target, DollarSign, Briefcase, Star, Crown, X } from 'lucide-react';
import { useTheme } from './ThemeProvider';

// ---------------------------------------------------------------------------
// Qualification types & data
// ---------------------------------------------------------------------------
type QualificationStatus = 'pending' | 'qualified' | 'not-qualified';

interface QualificationAnswers {
  usBased: boolean | null;
  hasClients: boolean | null;
  decisionRole: string | null;
  annualRevenue: string | null;
  firmServices: string[] | null;
  hasGoogleReviews: boolean | null;
  goal: string | null;
}

const DISQUALIFYING_GOAL = 'lead-generation';

const qualificationQuestions = [
  {
    key: 'usBased' as const,
    icon: <Building2 className="text-blue-400" size={20} />,
    question: 'Is your firm based in the United States?',
    description: 'We currently serve US-based CPA firms and accounting practices.',
  },
  {
    key: 'hasClients' as const,
    icon: <Users className="text-blue-400" size={20} />,
    question: 'Do you currently have an established client base?',
    description: 'Our systems are built to amplify firms that are already serving clients.',
  },
];

const annualRevenueOptions = [
  { value: 'under-250k', label: 'Under $250K per year' },
  { value: '250k-500k', label: '$250K – $500K per year' },
  { value: '500k-1m', label: '$500K – $1M per year' },
  { value: '1m-5m', label: '$1M – $5M per year' },
  { value: '5m+', label: '$5M+ per year' },
];

const DISQUALIFYING_REVENUE = 'under-250k';

const decisionRoleOptions = [
  { value: 'sole-owner', label: "I'm the sole owner — I make all the decisions" },
  { value: 'partner-authority', label: "I'm a partner with authority to make this decision" },
  { value: 'partner-need-approval', label: "I'm a partner but other partners would need to weigh in" },
  { value: 'not-decision-maker', label: "I'm not involved in decisions like this" },
];

const DISQUALIFYING_ROLE = 'not-decision-maker';

const firmServiceOptions = [
  { value: 'tax-prep', label: 'Tax preparation & tax planning' },
  { value: 'advisory', label: 'Advisory & consulting services' },
  { value: 'financial-services', label: 'Financial services (audits, assurance, compilations)' },
  { value: 'bookkeeping-only', label: 'Bookkeeping & payroll services' },
];

const DISQUALIFYING_SERVICE = 'bookkeeping-only';

const goalOptions = [
  { value: 'process-nurture', label: 'Better systems to process & nurture inbound inquiries' },
  { value: 'streamline-ops', label: 'Streamline operations and reduce manual work' },
  { value: 'digital-presence', label: "Amplify our firm's digital presence & client experience" },
  { value: DISQUALIFYING_GOAL, label: 'We need help generating new leads and finding clients' },
];

// Map raw answer values to human-readable labels for Cal.com notes
function formatAnswersAsNotes(answers: QualificationAnswers): string {
  const roleLabel = decisionRoleOptions.find((o) => o.value === answers.decisionRole)?.label ?? answers.decisionRole;
  const revenueLabel = annualRevenueOptions.find((o) => o.value === answers.annualRevenue)?.label ?? answers.annualRevenue;
  const servicesLabel = answers.firmServices
    ?.map((s) => firmServiceOptions.find((o) => o.value === s)?.label ?? s)
    .join(', ');
  const goalLabel = goalOptions.find((o) => o.value === answers.goal)?.label ?? answers.goal;

  const lines = [
    '--- Prequalification Answers ---',
    `US Based: ${answers.usBased ? 'Yes' : 'No'}`,
    `Has Established Clients: ${answers.hasClients ? 'Yes' : 'No'}`,
    `Decision Role: ${roleLabel ?? 'N/A'}`,
    `Annual Revenue: ${revenueLabel ?? 'N/A'}`,
    `Firm Services: ${servicesLabel ?? 'N/A'}`,
    `Google Reviews: ${answers.hasGoogleReviews === null ? 'N/A' : answers.hasGoogleReviews ? 'Yes' : 'No'}`,
    `Primary Goal: ${goalLabel ?? 'N/A'}`,
  ];
  return lines.join('\n');
}

const GHL_WEBHOOK_URL = 'https://services.leadconnectorhq.com/hooks/yamjttuJWWdstfF9N0zu/webhook-trigger/c08ab845-6f7c-4016-bdf0-bbcb6b5782e6';

async function sendQualificationToGHL(answers: QualificationAnswers, qualified: boolean) {
  try {
    await fetch(GHL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'qualification-gate',
        qualified,
        us_based: answers.usBased,
        has_clients: answers.hasClients,
        decision_role: answers.decisionRole,
        annual_revenue: answers.annualRevenue,
        firm_services: answers.firmServices?.join(', ') ?? '',
        has_google_reviews: answers.hasGoogleReviews,
        goal: answers.goal,
        submitted_at: new Date().toISOString(),
      }),
    });
  } catch {
    // Silently fail — don't block the user experience
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
interface QualificationContextType {
  openBooking: () => void;
  qualificationStatus: QualificationStatus;
}

const QualificationContext = createContext<QualificationContextType | undefined>(undefined);

export const useBooking = () => {
  const context = useContext(QualificationContext);
  if (!context) throw new Error('useBooking must be used within a QualificationProvider');
  return context;
};

// ---------------------------------------------------------------------------
// Qualification Gate (modal version)
// ---------------------------------------------------------------------------
function QualificationGateModal({ onResult }: { onResult: (status: QualificationStatus, answers: QualificationAnswers) => void }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<QualificationAnswers>({
    usBased: null,
    hasClients: null,
    decisionRole: null,
    annualRevenue: null,
    firmServices: null,
    hasGoogleReviews: null,
    goal: null,
  });
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  const handleYesNo = (key: 'usBased' | 'hasClients', value: boolean) => {
    const updated = { ...answers, [key]: value };
    setAnswers(updated);
    if (!value) {
      sendQualificationToGHL(updated, false);
      onResult('not-qualified', updated);
      return;
    }
    setStep((s) => s + 1);
  };

  const handleDecisionRole = (value: string) => {
    const updated = { ...answers, decisionRole: value };
    setAnswers(updated);
    if (value === DISQUALIFYING_ROLE) {
      sendQualificationToGHL(updated, false);
      onResult('not-qualified', updated);
    } else {
      setStep(3);
    }
  };

  const handleAnnualRevenue = (value: string) => {
    const updated = { ...answers, annualRevenue: value };
    setAnswers(updated);
    if (value === DISQUALIFYING_REVENUE) {
      sendQualificationToGHL(updated, false);
      onResult('not-qualified', updated);
    } else {
      setStep(4);
    }
  };

  const toggleService = (value: string) => {
    setSelectedServices((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const handleFirmServicesContinue = () => {
    if (selectedServices.length === 0) return;
    const updated = { ...answers, firmServices: selectedServices };
    setAnswers(updated);
    if (selectedServices.length === 1 && selectedServices[0] === DISQUALIFYING_SERVICE) {
      sendQualificationToGHL(updated, false);
      onResult('not-qualified', updated);
    } else {
      setStep(5);
    }
  };

  const handleGoogleReviews = (value: boolean) => {
    const updated = { ...answers, hasGoogleReviews: value };
    setAnswers(updated);
    setStep(6);
  };

  const handleGoal = (value: string) => {
    const updated = { ...answers, goal: value };
    setAnswers(updated);
    if (value === DISQUALIFYING_GOAL) {
      sendQualificationToGHL(updated, false);
      onResult('not-qualified', updated);
    } else {
      sendQualificationToGHL(updated, true);
      onResult('qualified', updated);
    }
  };

  const totalSteps = 7;

  return (
    <div className="w-full max-w-2xl mx-auto px-4">
      <div className="text-center mb-6 md:mb-10">
        <div className="w-14 h-14 md:w-16 md:h-16 mx-auto mb-4 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
          <Target className="text-blue-400" size={28} />
        </div>
        <h3 className="text-[var(--text-main)] text-lg md:text-2xl font-bold mb-2">
          Tell Us About Your Firm
        </h3>
        <p className="text-[var(--text-muted)] text-xs md:text-sm max-w-md mx-auto">
          We work exclusively with established CPA firms. A few quick questions to make sure we&apos;re the right fit.
        </p>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-2 mb-8">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === step ? 'w-8 bg-blue-500' : i < step ? 'w-4 bg-blue-500/50' : 'w-4 bg-[var(--glass-border)]'
            }`}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Steps 0 & 1: Yes/No */}
        {step < 2 && (
          <motion.div
            key={`q-${step}`}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div className="flex items-start gap-3 md:gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 flex-shrink-0">
                {qualificationQuestions[step].icon}
              </div>
              <div>
                <p className="text-[var(--text-main)] font-bold text-sm md:text-lg">
                  {qualificationQuestions[step].question}
                </p>
                <p className="text-[var(--text-muted)] text-xs md:text-sm mt-1">
                  {qualificationQuestions[step].description}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <button
                onClick={() => handleYesNo(qualificationQuestions[step].key, true)}
                className="flex items-center justify-center gap-2 p-3 md:p-4 rounded-xl md:rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-main)] font-bold text-sm md:text-base hover:border-blue-500/40 hover:bg-blue-500/5 active:scale-[0.98] transition-all cursor-pointer"
              >
                <CheckCircle size={16} className="text-green-500" />
                Yes
              </button>
              <button
                onClick={() => handleYesNo(qualificationQuestions[step].key, false)}
                className="flex items-center justify-center gap-2 p-3 md:p-4 rounded-xl md:rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-main)] font-bold text-sm md:text-base hover:border-red-500/40 hover:bg-red-500/5 active:scale-[0.98] transition-all cursor-pointer"
              >
                <XCircle size={16} className="text-red-400" />
                No
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 2: Decision role */}
        {step === 2 && (
          <motion.div
            key="q-decision"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <div className="flex items-start gap-3 md:gap-4 mb-2">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 flex-shrink-0">
                <Crown className="text-blue-400" size={20} />
              </div>
              <div>
                <p className="text-[var(--text-main)] font-bold text-sm md:text-lg">
                  What&apos;s your role in the firm&apos;s decision-making?
                </p>
                <p className="text-[var(--text-muted)] text-xs md:text-sm mt-1">
                  This helps us understand who will be involved in evaluating and implementing our system.
                </p>
              </div>
            </div>
            <div className="space-y-2 md:space-y-3">
              {decisionRoleOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleDecisionRole(opt.value)}
                  className="w-full text-left p-3 md:p-4 rounded-xl md:rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-main)] font-medium text-xs md:text-sm hover:border-blue-500/40 hover:bg-blue-500/5 active:scale-[0.99] transition-all cursor-pointer"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Step 3: Annual revenue */}
        {step === 3 && (
          <motion.div
            key="q-revenue"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <div className="flex items-start gap-3 md:gap-4 mb-2">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 flex-shrink-0">
                <DollarSign className="text-blue-400" size={20} />
              </div>
              <div>
                <p className="text-[var(--text-main)] font-bold text-sm md:text-lg">
                  What is your firm&apos;s approximate annual revenue?
                </p>
                <p className="text-[var(--text-muted)] text-xs md:text-sm mt-1">
                  This helps us understand if our system is the right investment for your firm right now.
                </p>
              </div>
            </div>
            <div className="space-y-2 md:space-y-3">
              {annualRevenueOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleAnnualRevenue(opt.value)}
                  className="w-full text-left p-3 md:p-4 rounded-xl md:rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-main)] font-medium text-xs md:text-sm hover:border-blue-500/40 hover:bg-blue-500/5 active:scale-[0.99] transition-all cursor-pointer"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Step 4: Firm services (multi-select) */}
        {step === 4 && (
          <motion.div
            key="q-services"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <div className="flex items-start gap-3 md:gap-4 mb-2">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 flex-shrink-0">
                <Briefcase className="text-blue-400" size={20} />
              </div>
              <div>
                <p className="text-[var(--text-main)] font-bold text-sm md:text-lg">
                  What are your firm&apos;s primary services?
                </p>
                <p className="text-[var(--text-muted)] text-xs md:text-sm mt-1">
                  Select all that apply. Our system is built around document-heavy practices that collect forms, tax records, and financial documents from clients.
                </p>
              </div>
            </div>
            <div className="space-y-2 md:space-y-3">
              {firmServiceOptions.map((opt) => {
                const isSelected = selectedServices.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    onClick={() => toggleService(opt.value)}
                    className={`w-full text-left p-3 md:p-4 rounded-xl md:rounded-2xl border font-medium text-xs md:text-sm active:scale-[0.99] transition-all cursor-pointer flex items-center gap-3 ${
                      isSelected
                        ? 'border-blue-500/50 bg-blue-500/10 text-[var(--text-main)]'
                        : 'border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-main)] hover:border-blue-500/40 hover:bg-blue-500/5'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      isSelected ? 'border-blue-500 bg-blue-500' : 'border-[var(--text-muted)]/30'
                    }`}>
                      {isSelected && (
                        <CheckCircle size={14} className="text-white" />
                      )}
                    </div>
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <button
              onClick={handleFirmServicesContinue}
              disabled={selectedServices.length === 0}
              className={`w-full flex items-center justify-center gap-2 p-3 md:p-4 rounded-xl md:rounded-2xl text-sm font-bold transition-all ${
                selectedServices.length > 0
                  ? 'bg-blue-600 text-white hover:bg-blue-500 active:scale-[0.98] shadow-lg shadow-blue-600/20 cursor-pointer'
                  : 'bg-[var(--glass-bg)] text-[var(--text-muted)] border border-[var(--glass-border)] cursor-not-allowed opacity-50'
              }`}
            >
              Continue
              <ArrowRight size={16} />
            </button>
          </motion.div>
        )}

        {/* Step 5: Google Reviews */}
        {step === 5 && (
          <motion.div
            key="q-reviews"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div className="flex items-start gap-3 md:gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 flex-shrink-0">
                <Star className="text-blue-400" size={20} />
              </div>
              <div>
                <p className="text-[var(--text-main)] font-bold text-sm md:text-lg">
                  Does your firm currently have a Google Business Profile with reviews?
                </p>
                <p className="text-[var(--text-muted)] text-xs md:text-sm mt-1">
                  Google reviews are a key part of how high-value clients evaluate firms online. This helps us understand your current presence.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <button
                onClick={() => handleGoogleReviews(true)}
                className="flex items-center justify-center gap-2 p-3 md:p-4 rounded-xl md:rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-main)] font-bold text-sm md:text-base hover:border-blue-500/40 hover:bg-blue-500/5 active:scale-[0.98] transition-all cursor-pointer"
              >
                <CheckCircle size={16} className="text-green-500" />
                Yes
              </button>
              <button
                onClick={() => handleGoogleReviews(false)}
                className="flex items-center justify-center gap-2 p-3 md:p-4 rounded-xl md:rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-main)] font-bold text-sm md:text-base hover:border-blue-500/40 hover:bg-blue-500/5 active:scale-[0.98] transition-all cursor-pointer"
              >
                <XCircle size={16} className="text-red-400" />
                No
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 6: Goal selection */}
        {step === 6 && (
          <motion.div
            key="q-goal"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <div className="flex items-start gap-3 md:gap-4 mb-2">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 flex-shrink-0">
                <Target className="text-blue-400" size={20} />
              </div>
              <div>
                <p className="text-[var(--text-main)] font-bold text-sm md:text-lg">
                  Which best describes what you&apos;re looking for?
                </p>
                <p className="text-[var(--text-muted)] text-xs md:text-sm mt-1">
                  This helps us prepare for your strategy session.
                </p>
              </div>
            </div>
            <div className="space-y-2 md:space-y-3">
              {goalOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleGoal(opt.value)}
                  className="w-full text-left p-3 md:p-4 rounded-xl md:rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-main)] font-medium text-xs md:text-sm hover:border-blue-500/40 hover:bg-blue-500/5 active:scale-[0.99] transition-all cursor-pointer"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Not Qualified (modal version)
// ---------------------------------------------------------------------------
function NotQualifiedModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="w-full max-w-2xl mx-auto px-4 text-center">
      <div className="w-16 h-16 md:w-20 md:h-20 mx-auto mb-6 rounded-2xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
        <Building2 className="text-orange-400" size={32} />
      </div>
      <h3 className="text-[var(--text-main)] text-lg md:text-2xl font-bold mb-3">
        We Might Not Be the Right Fit — Yet
      </h3>
      <p className="text-[var(--text-muted)] text-sm md:text-base max-w-lg mx-auto mb-8 leading-relaxed">
        Our Digital Rainmaker system is built specifically for established, US-based CPA firms who need to amplify the business they&apos;re already getting — not generate it from scratch.
        If that&apos;s not where you are right now, no worries. We&apos;ve got a free resource that can help you get there.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <a
          href="/free-guide"
          className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-6 md:px-8 py-3 md:py-4 rounded-full text-sm font-bold hover:bg-blue-500 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-blue-600/20 group"
        >
          Get Our Free Guide
          <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
        </a>
        <button
          onClick={onClose}
          className="inline-flex items-center justify-center gap-2 px-6 md:px-8 py-3 md:py-4 rounded-full text-sm font-bold text-[var(--text-muted)] border border-[var(--glass-border)] bg-[var(--glass-bg)] hover:border-blue-500/30 active:scale-[0.98] transition-all"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export default function QualificationProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [qualificationStatus, setQualificationStatus] = useState<QualificationStatus>('pending');
  const answersRef = useRef<QualificationAnswers | null>(null);
  const [calInitialized, setCalInitialized] = useState(false);

  // Initialize Cal.com embed script once
  useEffect(() => {
    (function (C: any, A: string, L: string) {
      let p = function (a: any, ar: any) { a.q.push(ar); };
      let d = C.document;
      C.Cal = C.Cal || function () {
        let cal = C.Cal;
        let ar = arguments;
        if (!cal.loaded) {
          cal.ns = {};
          cal.q = cal.q || [];
          d.head.appendChild(d.createElement("script")).src = A;
          cal.loaded = true;
        }
        if (ar[0] === L) {
          const api = function () { p(api, arguments); };
          const namespace = ar[1];
          api.q = api.q || [];
          if (typeof namespace === "string") {
            cal.ns[namespace] = cal.ns[namespace] || api;
            p(cal.ns[namespace], ar);
            p(cal, ["initNamespace", namespace]);
          } else p(cal, ar);
          return;
        }
        p(cal, ar);
      };
    })(window, "https://app.cal.com/embed/embed.js", "init");

    const Cal = (window as any).Cal;
    Cal("init", "nexli-demo", { origin: "https://app.cal.com" });

    // Track successful bookings with Facebook Pixel + send prequalification data to GHL
    Cal("on", {
      action: "bookingSuccessful",
      callback: (e: any) => {
        if (typeof (window as any).fbq === 'function') {
          (window as any).fbq('track', 'Schedule', {
            content_name: 'Strategy Session Booking',
          });
        }

        // Send prequalification answers to GHL with booking info
        const savedAnswers = answersRef.current;
        const bookingData = e?.detail?.data ?? {};
        if (savedAnswers) {
          fetch(GHL_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              source: 'booking-with-qualification',
              qualified: true,
              booking_uid: bookingData.uid ?? '',
              booking_confirmed: bookingData.confirmed ?? true,
              us_based: savedAnswers.usBased,
              has_clients: savedAnswers.hasClients,
              decision_role: savedAnswers.decisionRole,
              annual_revenue: savedAnswers.annualRevenue,
              firm_services: savedAnswers.firmServices?.join(', ') ?? '',
              has_google_reviews: savedAnswers.hasGoogleReviews,
              goal: savedAnswers.goal,
              qualification_notes: formatAnswersAsNotes(savedAnswers),
              submitted_at: new Date().toISOString(),
            }),
          }).catch(() => {});
        }

        // Redirect to booking-confirmed with attendee info for GHL intel tracking
        const attendeeEmail = bookingData.booking?.attendees?.[0]?.email
          || bookingData.attendees?.[0]?.email
          || '';
        const attendeeName = bookingData.booking?.attendees?.[0]?.name
          || bookingData.attendees?.[0]?.name
          || '';
        const params = new URLSearchParams();
        if (attendeeEmail) params.set('email', attendeeEmail);
        if (attendeeName) params.set('name', attendeeName);
        const qs = params.toString();
        window.location.href = `/booking-confirmed${qs ? `?${qs}` : ''}`;
      },
    });

    setCalInitialized(true);
  }, []);

  const openCalPopup = useCallback(() => {
    const Cal = (window as any).Cal;
    const savedAnswers = answersRef.current;
    const notes = savedAnswers ? formatAnswersAsNotes(savedAnswers) : undefined;
    const calLink = notes
      ? `nexli-automation-6fgn8j/nexli-demo?notes=${encodeURIComponent(notes)}`
      : 'nexli-automation-6fgn8j/nexli-demo';

    if (Cal && Cal.ns && Cal.ns["nexli-demo"]) {
      Cal.ns["nexli-demo"]("modal", {
        calLink,
        config: { "layout": "month_view", "theme": theme },
      });
    } else {
      window.open(`https://cal.com/${calLink}`, "_blank");
    }
  }, [theme]);

  const openBooking = useCallback(() => {
    if (qualificationStatus === 'qualified') {
      openCalPopup();
    } else {
      setQualificationStatus('pending');
      setIsOpen(true);
    }
  }, [qualificationStatus, openCalPopup]);

  const handleResult = useCallback((status: QualificationStatus, answers: QualificationAnswers) => {
    setQualificationStatus(status);
    answersRef.current = answers;
    if (status === 'qualified') {
      setIsOpen(false);
      setTimeout(() => {
        openCalPopup();
      }, 300);
    }
  }, [openCalPopup]);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    // Reset to pending if they were not-qualified so they can try again later
    if (qualificationStatus === 'not-qualified') {
      setTimeout(() => setQualificationStatus('pending'), 300);
    }
  }, [qualificationStatus]);

  return (
    <QualificationContext.Provider value={{ openBooking, qualificationStatus }}>
      {children}

      {/* Fullscreen Qualification Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center"
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={closeModal}
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3 }}
              className="relative z-10 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto glass-card rounded-2xl md:rounded-[48px] border border-[var(--glass-border)] shadow-3xl p-6 md:p-12"
            >
              {/* Close button */}
              <button
                onClick={closeModal}
                className="absolute top-4 right-4 md:top-6 md:right-6 w-8 h-8 rounded-full bg-[var(--glass-bg)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-blue-500/30 transition-all z-20"
              >
                <X size={16} />
              </button>

              {qualificationStatus !== 'not-qualified' ? (
                <QualificationGateModal onResult={handleResult} />
              ) : (
                <NotQualifiedModal onClose={closeModal} />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </QualificationContext.Provider>
  );
}
