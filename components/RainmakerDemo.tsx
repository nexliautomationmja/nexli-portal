'use client';
import React, { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, ArrowRight, PhoneOff, PhoneIncoming, PhoneMissed,
  CheckCircle, Send, Mail, Smartphone, CalendarCheck, Clock,
  Bot, RotateCcw, Globe, MessageSquare, BarChart3, Star,
  Shield, Upload, FileText, Lock, Eye, Copy, ChevronRight, Brain,
  Download, Search, X, Users, FolderLock, ShieldCheck, History,
  Key, Bell, ClipboardList, Activity, Camera, Play, Pause, ChevronDown,
} from 'lucide-react';
import Image from 'next/image';
import { useTheme } from './ThemeProvider';
import { allForms, allStates, type TaxForm } from '../data/taxForms';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type ActiveTab = 'ai-automations' | 'document-portal' | 'smart-reviews';
type MissedCallStep = 'scenario' | 'ringing' | 'missed' | 'detected' | 'texted' | 'booked';
type WebLeadStep = 'scenario' | 'form-filled' | 'auto-reply' | 'nurture' | 'booked';
type DocDemoView = 'overview' | 'clients' | 'documents' | 'send-request' | 'forms' | 'security';
type ReviewDemoState = 'idle' | 'selected' | 'positive' | 'negative' | 'feedbackSent';

// ---------------------------------------------------------------------------
// Tab config
// ---------------------------------------------------------------------------
const tabs: { id: ActiveTab; label: string; shortLabel: string; Icon: React.ElementType }[] = [
  { id: 'ai-automations', label: 'AI Automations', shortLabel: 'AI', Icon: Zap },
  { id: 'document-portal', label: 'Document Portal', shortLabel: 'Docs', Icon: Shield },
  { id: 'smart-reviews', label: 'Smart Reviews', shortLabel: 'Reviews', Icon: Star },
];

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
const RainmakerDemo: React.FC = () => {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<ActiveTab>('ai-automations');

  // ── Intro voice message state ──
  const introAudioRef = useRef<HTMLAudioElement | null>(null);
  const [introPlaying, setIntroPlaying] = useState(false);
  const [showIntroTranscript, setShowIntroTranscript] = useState(false);

  // ── AI Automations state ──
  const [demoTab, setDemoTab] = useState<'missed-call' | 'website-lead'>('missed-call');
  const [missedCallStep, setMissedCallStep] = useState<MissedCallStep>('scenario');
  const [webLeadStep, setWebLeadStep] = useState<WebLeadStep>('scenario');

  // ── Document Portal Dashboard state ──
  const [docView, setDocView] = useState<DocDemoView>('overview');
  const [docFilter, setDocFilter] = useState<'all' | 'new' | 'reviewed' | 'archived'>('all');
  const [sendStep, setSendStep] = useState<'select' | 'generated' | 'delivery' | 'sent'>('select');
  const [sendClient, setSendClient] = useState<string | null>(null);
  const [sendMethod, setSendMethod] = useState<'sms' | 'email' | null>(null);
  const [sendUploadMode, setSendUploadMode] = useState<'standard' | 'guided'>('standard');
  const [demoFormScope, setDemoFormScope] = useState<'federal' | 'state'>('federal');
  const [demoFormSearch, setDemoFormSearch] = useState('');
  const [demoFormState, setDemoFormState] = useState('All');
  const [demoSelectedForm, setDemoSelectedForm] = useState<TaxForm | null>(null);
  const [selectedClientName, setSelectedClientName] = useState<string | null>(null);

  // ── Smart Reviews state ──
  const [hoveredStar, setHoveredStar] = useState(0);
  const [selectedRating, setSelectedRating] = useState(0);
  const [reviewState, setReviewState] = useState<ReviewDemoState>('idle');
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  // ── Tab switch resets ──
  const handleTabChange = (tab: ActiveTab) => {
    setMissedCallStep('scenario');
    setWebLeadStep('scenario');
    setDemoTab('missed-call');
    setDocView('overview');
    setDocFilter('all');
    setSendStep('select');
    setSendClient(null);
    setSendMethod(null);
    setSendUploadMode('standard');
    setDemoFormScope('federal');
    setDemoFormSearch('');
    setDemoFormState('All');
    setDemoSelectedForm(null);
    setSelectedClientName(null);
    setHoveredStar(0);
    setSelectedRating(0);
    setReviewState('idle');
    setFeedbackText('');
    setFeedbackSubmitting(false);
    setActiveTab(tab);
  };

  // ── AI: Step sequences for progress indicator ──
  const missedCallSteps: MissedCallStep[] = ['scenario', 'ringing', 'missed', 'detected', 'texted', 'booked'];
  const webLeadSteps: WebLeadStep[] = ['scenario', 'form-filled', 'auto-reply', 'nurture', 'booked'];

  const resetAiDemo = () => {
    setMissedCallStep('scenario');
    setWebLeadStep('scenario');
  };

  // ── Doc Portal: Reset ──
  const resetDocDemo = () => {
    setDocView('overview');
    setDocFilter('all');
    setSendStep('select');
    setSendClient(null);
    setSendMethod(null);
    setSendUploadMode('standard');
    setDemoFormScope('federal');
    setDemoFormSearch('');
    setDemoFormState('All');
    setDemoSelectedForm(null);
    setSelectedClientName(null);
  };

  // ── Smart Reviews: Star click ──
  const handleStarClick = (rating: number) => {
    setSelectedRating(rating);
    setReviewState('selected');
    setTimeout(() => {
      setReviewState(rating >= 4 ? 'positive' : 'negative');
    }, 600);
  };

  const handleFeedbackSubmit = () => {
    setFeedbackSubmitting(true);
    setTimeout(() => {
      setReviewState('feedbackSent');
      setFeedbackSubmitting(false);
    }, 1200);
  };

  const resetReviewDemo = () => {
    setHoveredStar(0);
    setSelectedRating(0);
    setReviewState('idle');
    setFeedbackText('');
    setFeedbackSubmitting(false);
  };

  // ── Star component ──
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
        if (reviewState !== 'idle') return;
        if (e.pointerType === 'touch') {
          e.preventDefault();
          if (hoveredStar === index) handleStarClick(index);
          else setHoveredStar(index);
        } else {
          handleStarClick(index);
        }
      }}
      onMouseEnter={() => reviewState === 'idle' && setHoveredStar(index)}
      onMouseLeave={() => reviewState === 'idle' && setHoveredStar(0)}
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

  // Document Portal dashboard sidebar config
  const docDashboardSections: { id: DocDemoView; label: string; Icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', Icon: BarChart3 },
    { id: 'clients', label: 'Clients', Icon: Users },
    { id: 'documents', label: 'Documents', Icon: FileText },
    { id: 'send-request', label: 'Send Request', Icon: Send },
    { id: 'forms', label: 'Forms Library', Icon: ClipboardList },
    { id: 'security', label: 'Security', Icon: Shield },
  ];

  // Document Portal data
  const demoDocuments = [
    { name: 'W-2_2025.pdf', client: 'Sarah M.', date: 'Mar 5, 2026', status: 'New' as const },
    { name: '1099-INT_Chase.pdf', client: 'Sarah M.', date: 'Mar 5, 2026', status: 'New' as const },
    { name: '1099-INT_Fidelity.pdf', client: 'James K.', date: 'Mar 4, 2026', status: 'New' as const },
    { name: 'Bank_Statement_Jan.pdf', client: 'Lisa P.', date: 'Mar 3, 2026', status: 'Reviewed' as const },
    { name: 'W-2_Employer.pdf', client: 'Robert T.', date: 'Mar 2, 2026', status: 'Reviewed' as const },
    { name: 'Mortgage_1098.pdf', client: 'Maria C.', date: 'Feb 28, 2026', status: 'Reviewed' as const },
    { name: 'Tax_Return_2024.pdf', client: 'James K.', date: 'Feb 25, 2026', status: 'Archived' as const },
    { name: 'Schedule_C_2025.pdf', client: 'David L.', date: 'Feb 20, 2026', status: 'Archived' as const },
  ];

  const filteredDocs = docFilter === 'all' ? demoDocuments : demoDocuments.filter(d => d.status.toLowerCase() === docFilter);

  // Client vault data — each client with their stored documents
  const clientVault = [
    { name: 'Sarah M.', email: 'sarah.m@email.com', phone: '(555) 867-5309', status: 'Active' as const, docCount: 8, lastActivity: 'Mar 5, 2026',
      documents: [
        { name: 'W-2_2025.pdf', year: '2025', date: 'Mar 5, 2026', status: 'New' as const },
        { name: '1099-INT_Chase.pdf', year: '2025', date: 'Mar 5, 2026', status: 'New' as const },
        { name: 'W-2_2024.pdf', year: '2024', date: 'Feb 10, 2025', status: 'Archived' as const },
        { name: '1099-DIV_Vanguard.pdf', year: '2024', date: 'Feb 8, 2025', status: 'Archived' as const },
        { name: 'Tax_Return_2024.pdf', year: '2024', date: 'Apr 12, 2025', status: 'Archived' as const },
        { name: 'Bank_Statement_Q4.pdf', year: '2024', date: 'Jan 15, 2025', status: 'Archived' as const },
        { name: 'Mortgage_1098.pdf', year: '2024', date: 'Jan 28, 2025', status: 'Archived' as const },
        { name: 'Tax_Return_2023.pdf', year: '2023', date: 'Apr 10, 2024', status: 'Archived' as const },
      ],
    },
    { name: 'James K.', email: 'james.k@email.com', phone: '(555) 234-5678', status: 'Active' as const, docCount: 6, lastActivity: 'Mar 4, 2026',
      documents: [
        { name: '1099-INT_Fidelity.pdf', year: '2025', date: 'Mar 4, 2026', status: 'New' as const },
        { name: 'Schedule_C_2025.pdf', year: '2025', date: 'Mar 1, 2026', status: 'Reviewed' as const },
        { name: 'Tax_Return_2024.pdf', year: '2024', date: 'Feb 25, 2025', status: 'Archived' as const },
        { name: 'W-2_2024.pdf', year: '2024', date: 'Feb 5, 2025', status: 'Archived' as const },
        { name: '1099-NEC_Consulting.pdf', year: '2024', date: 'Feb 12, 2025', status: 'Archived' as const },
        { name: 'Tax_Return_2023.pdf', year: '2023', date: 'Apr 8, 2024', status: 'Archived' as const },
      ],
    },
    { name: 'Lisa P.', email: 'lisa.p@email.com', phone: '(555) 345-6789', status: 'Active' as const, docCount: 4, lastActivity: 'Mar 3, 2026',
      documents: [
        { name: 'Bank_Statement_Jan.pdf', year: '2025', date: 'Mar 3, 2026', status: 'Reviewed' as const },
        { name: 'W-2_2025.pdf', year: '2025', date: 'Feb 28, 2026', status: 'Reviewed' as const },
        { name: 'Tax_Return_2024.pdf', year: '2024', date: 'Mar 20, 2025', status: 'Archived' as const },
        { name: '1099-INT_BofA.pdf', year: '2024', date: 'Feb 14, 2025', status: 'Archived' as const },
      ],
    },
    { name: 'Robert T.', email: 'robert.t@email.com', phone: '(555) 456-7890', status: 'Active' as const, docCount: 3, lastActivity: 'Mar 2, 2026',
      documents: [
        { name: 'W-2_Employer.pdf', year: '2025', date: 'Mar 2, 2026', status: 'Reviewed' as const },
        { name: 'Tax_Return_2024.pdf', year: '2024', date: 'Apr 1, 2025', status: 'Archived' as const },
        { name: 'W-2_2024.pdf', year: '2024', date: 'Feb 3, 2025', status: 'Archived' as const },
      ],
    },
    { name: 'Maria C.', email: 'maria.c@email.com', phone: '(555) 567-8901', status: 'Active' as const, docCount: 3, lastActivity: 'Feb 28, 2026',
      documents: [
        { name: 'Mortgage_1098.pdf', year: '2025', date: 'Feb 28, 2026', status: 'Reviewed' as const },
        { name: 'Tax_Return_2024.pdf', year: '2024', date: 'Mar 28, 2025', status: 'Archived' as const },
        { name: '1098_Mortgage_2024.pdf', year: '2024', date: 'Jan 22, 2025', status: 'Archived' as const },
      ],
    },
    { name: 'David L.', email: 'david.l@email.com', phone: '(555) 678-9012', status: 'Pending' as const, docCount: 1, lastActivity: 'Feb 20, 2026',
      documents: [
        { name: 'Schedule_C_2025.pdf', year: '2025', date: 'Feb 20, 2026', status: 'Archived' as const },
      ],
    },
  ];

  const selectedClientData = selectedClientName ? clientVault.find(c => c.name === selectedClientName) : null;

  const filteredForms = useMemo(() => {
    let forms = allForms.filter(f => demoFormScope === 'federal' ? !f.state : !!f.state);
    if (demoFormScope === 'state' && demoFormState !== 'All') {
      forms = forms.filter(f => f.state === demoFormState);
    }
    if (demoFormSearch) {
      const q = demoFormSearch.toLowerCase();
      forms = forms.filter(f => f.name.toLowerCase().includes(q) || f.number.toLowerCase().includes(q) || f.description.toLowerCase().includes(q));
    }
    return forms.slice(0, 20);
  }, [demoFormScope, demoFormState, demoFormSearch]);

  const sendClients = [
    { name: 'Sarah M.', email: 'sarah.m@email.com', status: 'Pending Docs' },
    { name: 'James K.', email: 'james.k@email.com', status: 'Complete' },
    { name: 'Lisa P.', email: 'lisa.p@email.com', status: 'In Progress' },
    { name: 'David L.', email: 'david.l@email.com', status: 'Not Started' },
  ];

  // AI features grid (condensed)
  const aiFeatures = [
    { icon: <PhoneMissed className="w-4 h-4" />, title: 'Missed-Call Text-Back', description: 'Instant SMS reply with booking link for every missed call.', color: 'violet' },
    { icon: <Send className="w-4 h-4" />, title: 'Lead Nurture', description: 'Automated follow-up sequences over days and weeks.', color: 'purple' },
    { icon: <CalendarCheck className="w-4 h-4" />, title: 'Auto-Booking', description: 'Prospects book directly from any automated message.', color: 'indigo' },
    { icon: <BarChart3 className="w-4 h-4" />, title: 'Pipeline Tracking', description: 'Full visibility into every lead and automation.', color: 'blue' },
  ];

  const colorMap: Record<string, string> = {
    violet: 'bg-violet-500/10 border-violet-500/20 text-violet-400',
    purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
    indigo: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
    blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
  };

  // ── Step Progress Indicator ──
  const StepProgress: React.FC<{ steps: string[]; currentStep: string }> = ({ steps, currentStep }) => {
    const currentIdx = steps.indexOf(currentStep);
    return (
      <div className="flex items-center justify-center gap-1 mb-6">
        {steps.map((_, i) => (
          <React.Fragment key={i}>
            <div className={`w-3 h-3 rounded-full transition-all duration-300 flex items-center justify-center ${
              i < currentIdx ? 'bg-green-500 scale-100' :
              i === currentIdx ? 'bg-violet-500 scale-110 ring-4 ring-violet-500/20' :
              theme === 'dark' ? 'bg-white/15' : 'bg-slate-200'
            }`}>
              {i < currentIdx && <CheckCircle size={8} className="text-white" />}
            </div>
            {i < steps.length - 1 && (
              <div className={`w-6 md:w-10 h-[2px] rounded-full transition-all duration-300 ${
                i < currentIdx ? 'bg-green-500/50' :
                theme === 'dark' ? 'bg-white/10' : 'bg-slate-200'
              }`} />
            )}
          </React.Fragment>
        ))}
        <span className={`ml-3 text-[10px] font-bold ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>
          {currentIdx + 1} / {steps.length}
        </span>
      </div>
    );
  };

  // ── Insight / Stat Callout Box ──
  const InsightBox: React.FC<{ children: React.ReactNode; color?: 'violet' | 'green' | 'red' | 'blue' }> = ({ children, color = 'violet' }) => {
    const colors = {
      violet: theme === 'dark' ? 'bg-violet-500/10 border-violet-500/20 text-violet-300' : 'bg-violet-50 border-violet-200 text-violet-700',
      green: theme === 'dark' ? 'bg-green-500/10 border-green-500/20 text-green-300' : 'bg-green-50 border-green-200 text-green-700',
      red: theme === 'dark' ? 'bg-red-500/10 border-red-500/20 text-red-300' : 'bg-red-50 border-red-200 text-red-700',
      blue: theme === 'dark' ? 'bg-blue-500/10 border-blue-500/20 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-700',
    };
    return (
      <div className={`rounded-xl border p-3 md:p-4 text-xs md:text-sm leading-relaxed ${colors[color]}`}>
        {children}
      </div>
    );
  };

  // ── Next Step Button ──
  const NextStepButton: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
    <button
      onClick={onClick}
      className="flex items-center gap-2 bg-violet-600 text-white px-6 py-3 rounded-full text-sm font-bold hover:bg-violet-500 transition-all shadow-lg shadow-violet-600/20 group mt-2"
    >
      {label}
      <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
    </button>
  );

  return (
    <div className={`relative rounded-[1.5rem] md:rounded-[2.5rem] border border-[var(--glass-border)] shadow-2xl overflow-hidden transition-colors duration-500 ${theme === 'dark' ? 'bg-[#050505]' : 'bg-white'}`}>
      <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-full h-[200px] blur-[100px] pointer-events-none transition-opacity duration-500 ${theme === 'dark' ? 'bg-green-500/5 opacity-100' : 'bg-green-500/10 opacity-50'}`} />

      <div className="relative z-10 p-4 md:p-8">
        {/* System intro — title + animated arrow + Justine voice message */}
        <div className="mb-6">
          <div className="text-center mb-5">
            <h3 className={`text-base md:text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              See How the System Works — <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-violet-500 to-cyan-500">Hands On</span>
            </h3>
            <p className={`text-xs md:text-sm mb-4 ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'}`}>
              Tap play to hear Justine walk you through it, then explore each pillar yourself.
            </p>
            <motion.div
              animate={{ y: [0, 6, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              className="flex justify-center"
            >
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-blue-500 via-violet-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
                <ArrowRight size={18} className="text-white rotate-90" />
              </div>
            </motion.div>
          </div>

          <div className="flex items-start gap-3 max-w-xl mx-auto">
            <Image src="/justine-headshot.png" alt="Justine" width={36} height={36} className="w-8 h-8 md:w-9 md:h-9 rounded-full object-cover border border-green-500/30 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 space-y-2">
              <p className={`text-[10px] font-bold ml-1 ${theme === 'dark' ? 'text-white/40' : 'text-slate-400'}`}>Justine, COO</p>
              <div className={`rounded-2xl rounded-bl-md px-4 py-3 ${theme === 'dark' ? 'bg-white/[0.04] border border-white/10' : 'bg-slate-50 border border-slate-200'}`}>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (!introAudioRef.current) return;
                      if (introPlaying) {
                        introAudioRef.current.pause();
                        setIntroPlaying(false);
                      } else {
                        introAudioRef.current.play();
                        setIntroPlaying(true);
                      }
                    }}
                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors bg-green-500/20 hover:bg-green-500/30"
                  >
                    {introPlaying ? (
                      <Pause size={16} className="text-green-400" />
                    ) : (
                      <Play size={16} className="text-green-400 ml-0.5" />
                    )}
                  </button>

                  {/* Waveform bars */}
                  <div className="flex items-center gap-[2px] h-8 flex-1 min-w-0">
                    {Array.from({ length: 48 }).map((_, i) => {
                      const h = 20 + Math.sin(i * 0.7) * 35 + Math.sin(i * 1.4) * 20 + Math.cos(i * 0.5) * 10;
                      return (
                        <div
                          key={i}
                          className={`flex-1 min-w-[2px] rounded-full transition-all duration-200 ${
                            introPlaying ? 'bg-green-400/90' : 'bg-green-400/40'
                          }`}
                          style={{ height: `${Math.max(15, h)}%` }}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
              <audio
                ref={introAudioRef}
                src="/audio/rainmaker-demo-intro.mp3"
                onEnded={() => setIntroPlaying(false)}
              />

              {/* Transcript toggle */}
              <button
                type="button"
                onClick={() => setShowIntroTranscript(!showIntroTranscript)}
                className={`flex items-center gap-1.5 text-xs hover:text-green-400 transition-colors ml-1 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}
              >
                <ChevronDown size={14} className={`transition-transform duration-300 ${showIntroTranscript ? 'rotate-180' : ''}`} />
                {showIntroTranscript ? 'Hide transcript' : 'Read transcript'}
              </button>

              <AnimatePresence>
                {showIntroTranscript && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className={`rounded-2xl rounded-bl-md p-4 ${theme === 'dark' ? 'bg-white/[0.04] border border-white/10' : 'bg-slate-50 border border-slate-200'}`}>
                      <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                        It starts with a beautifully designed website that captures the leads you&apos;re already getting. From there, AI automations respond, nurture, and push prospects further down the journey to book — automatically. Built into your site is a secure document portal with AES-256 quantum-resistant, military-grade encryption, so only you can see what your clients send. Finally, our Google Review Amplification Engine stacks 4- and 5-star reviews while routing 3 stars and below as private internal feedback — so your reputation only goes up. Explore each pillar below.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex justify-center mb-6 md:mb-8">
          <div className={`inline-flex items-center p-1.5 rounded-2xl border ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-5 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all ${
                    isActive
                      ? 'bg-green-600 text-white shadow-lg shadow-green-600/20'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  <tab.Icon size={14} />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          {/* ════════════════════════════════════════════════════════════════ */}
          {/* AI AUTOMATIONS TAB                                              */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {activeTab === 'ai-automations' && (
            <motion.div
              key="ai"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Sub-tab switcher: Missed Call / Website Lead */}
              <div className="flex border-b border-[var(--glass-border)] mb-6">
                <button
                  onClick={() => { setDemoTab('missed-call'); setMissedCallStep('scenario'); setWebLeadStep('scenario'); }}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-xs md:text-sm font-bold transition-all ${
                    demoTab === 'missed-call' ? 'text-violet-400 border-b-2 border-violet-500' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  <PhoneOff size={14} />
                  Missed Call
                </button>
                <button
                  onClick={() => { setDemoTab('website-lead'); setMissedCallStep('scenario'); setWebLeadStep('scenario'); }}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-xs md:text-sm font-bold transition-all ${
                    demoTab === 'website-lead' ? 'text-violet-400 border-b-2 border-violet-500' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  <Globe size={14} />
                  Website Lead
                </button>
              </div>

              {/* Demo area */}
              <div className="min-h-[480px] md:min-h-[540px]">
                <AnimatePresence mode="wait">
                  {/* ── MISSED CALL FLOW ── */}
                  {demoTab === 'missed-call' && (
                    <motion.div key="mc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <StepProgress steps={missedCallSteps} currentStep={missedCallStep} />

                      <AnimatePresence mode="wait">
                        {/* Step 1: The Scenario */}
                        {missedCallStep === 'scenario' && (
                          <motion.div key="mc-scenario" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex flex-col items-center justify-center gap-5 py-4">
                            <div className="w-20 h-20 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                              <PhoneIncoming size={36} className="text-violet-400" />
                            </div>
                            <div className="text-center max-w-md">
                              <div className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold mb-3 ${theme === 'dark' ? 'bg-white/10 text-white/50' : 'bg-slate-100 text-slate-500'}`}>7:42 PM</div>
                              <h3 className="text-lg md:text-xl font-bold text-[var(--text-main)] mb-3">It&apos;s 7:42 PM. Your phone rings.</h3>
                              <p className="text-[var(--text-muted)] text-sm leading-relaxed">
                                You&apos;re at dinner with your family. A potential <span className="text-violet-400 font-semibold">$10,000+</span> client just called your office. In most firms, this lead disappears forever — <span className="font-semibold text-[var(--text-main)]">80% of missed callers never call back</span>. Let&apos;s see what happens when Nexli AI is running.
                              </p>
                            </div>
                            <NextStepButton label="See What Happens" onClick={() => setMissedCallStep('ringing')} />
                          </motion.div>
                        )}

                        {/* Step 2: The Ring */}
                        {missedCallStep === 'ringing' && (
                          <motion.div key="mc-ringing" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex flex-col items-center justify-center gap-5 py-4">
                            <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 0.6, repeat: Infinity }} className="w-20 h-20 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                              <PhoneIncoming size={36} className="text-green-400" />
                            </motion.div>
                            <div className="text-center max-w-md">
                              <h3 className="text-lg md:text-xl font-bold text-[var(--text-main)] mb-3">Incoming call from Sarah M.</h3>
                              <p className="text-[var(--text-muted)] text-sm leading-relaxed">
                                Sarah M. is a small business owner looking for a new CPA. She found your firm on Google, liked your reviews, and decided to call. But you&apos;re off the clock.
                              </p>
                            </div>
                            <p className="text-green-400 text-sm font-semibold">(555) 867-5309</p>
                            <NextStepButton label="You Can't Answer" onClick={() => setMissedCallStep('missed')} />
                          </motion.div>
                        )}

                        {/* Step 3: The Miss */}
                        {missedCallStep === 'missed' && (
                          <motion.div key="mc-missed" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex flex-col items-center justify-center gap-5 py-4">
                            <div className="w-20 h-20 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                              <PhoneMissed size={36} className="text-red-400" />
                            </div>
                            <div className="text-center max-w-md">
                              <h3 className="text-lg md:text-xl font-bold text-red-400 mb-3">Call missed.</h3>
                              <p className="text-[var(--text-muted)] text-sm leading-relaxed">
                                With a traditional firm, Sarah would get voicemail — if she even bothers to leave one. Only 20% do. She&apos;d Google the next firm and call them instead. But you have <span className="text-violet-400 font-semibold">Nexli AI</span> watching.
                              </p>
                            </div>
                            <InsightBox color="red">
                              <span className="font-bold">62% of calls to small firms go unanswered.</span> Each missed call = <span className="font-bold">$1,200+</span> in lost revenue on average.
                            </InsightBox>
                            <NextStepButton label="Watch Nexli AI Respond" onClick={() => setMissedCallStep('detected')} />
                          </motion.div>
                        )}

                        {/* Step 4: AI Detection */}
                        {missedCallStep === 'detected' && (
                          <motion.div key="mc-detected" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex flex-col items-center justify-center gap-5 py-4">
                            <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 1.2, repeat: Infinity }} className="w-20 h-20 rounded-full bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
                              <Brain size={36} className="text-violet-400" />
                            </motion.div>
                            <div className="text-center max-w-md">
                              <h3 className="text-lg md:text-xl font-bold text-[var(--text-main)] mb-3">Nexli AI detected the missed call.</h3>
                              <p className="text-[var(--text-muted)] text-sm leading-relaxed">
                                Within <span className="text-violet-400 font-semibold">3 seconds</span> of the missed call, Nexli&apos;s AI engine detected it and is now crafting a personalized SMS response. No human intervention needed. This happens <span className="font-semibold text-[var(--text-main)]">24/7 — nights, weekends, holidays</span>.
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="w-5 h-5 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
                              <span className="text-violet-400 text-sm font-semibold">Composing response...</span>
                            </div>
                            <NextStepButton label="See the Text Message" onClick={() => setMissedCallStep('texted')} />
                          </motion.div>
                        )}

                        {/* Step 5: Instant Text-Back */}
                        {missedCallStep === 'texted' && (
                          <motion.div key="mc-texted" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex flex-col items-center justify-center gap-5 py-4">
                            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20">
                              <CheckCircle size={14} className="text-green-400" />
                              <span className="text-green-400 text-xs font-bold">Instant SMS sent to Sarah M.</span>
                            </div>
                            <div className="text-center max-w-md mb-2">
                              <h3 className="text-lg md:text-xl font-bold text-[var(--text-main)] mb-3">Instant SMS sent to Sarah M.</h3>
                              <p className="text-[var(--text-muted)] text-sm leading-relaxed">
                                Sarah receives a personalized text within seconds. It acknowledges the missed call, provides a direct booking link, and feels human — not robotic. The message is customized to your firm&apos;s voice and branding.
                              </p>
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
                                <div className="rounded-xl bg-violet-500 py-2.5 text-center text-white text-[10px] md:text-xs font-bold">
                                  Book a Consultation
                                </div>
                              </div>
                            </div>
                            <InsightBox color="green">
                              <span className="font-bold">Why this works:</span> 98% of texts are read within 3 minutes. Email open rates? 20%. SMS wins every time.
                            </InsightBox>
                            <NextStepButton label="See the Result" onClick={() => setMissedCallStep('booked')} />
                          </motion.div>
                        )}

                        {/* Step 6: Booked */}
                        {missedCallStep === 'booked' && (
                          <motion.div key="mc-booked" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex flex-col items-center justify-center gap-5 py-4">
                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }} className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                              <CalendarCheck size={32} className="text-green-500" />
                            </motion.div>
                            <h3 className="text-lg md:text-xl font-bold text-[var(--text-main)]">Appointment Booked!</h3>
                            <div className="text-center max-w-md mb-2">
                              <p className="text-[var(--text-muted)] text-sm leading-relaxed">
                                Sarah tapped the link and booked a consultation for tomorrow morning. Total time from missed call to booked appointment: <span className="text-violet-400 font-bold">47 seconds</span>. Zero human effort. Your AI handled everything while you enjoyed dinner.
                              </p>
                            </div>
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
                            <InsightBox color="violet">
                              <span className="font-bold">What just happened:</span> Missed call → AI detection → Instant SMS → Prospect books → You show up prepared. All automated. All while you were offline.
                            </InsightBox>
                            <div className="flex gap-3 mt-2">
                              <button onClick={() => { setDemoTab('website-lead'); setWebLeadStep('scenario'); }} className="flex items-center gap-2 bg-violet-600 text-white px-5 py-3 rounded-full text-sm font-bold hover:bg-violet-500 transition-all shadow-lg shadow-violet-600/20 group">
                                Try Website Lead Demo
                                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                              </button>
                              <button onClick={() => setMissedCallStep('scenario')} className="flex items-center gap-2 px-5 py-3 rounded-full text-sm font-bold border border-[var(--glass-border)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all">
                                <RotateCcw size={14} />
                                Start Over
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}

                  {/* ── WEBSITE LEAD FLOW ── */}
                  {demoTab === 'website-lead' && (
                    <motion.div key="wl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <StepProgress steps={webLeadSteps} currentStep={webLeadStep} />

                      <AnimatePresence mode="wait">
                        {/* Step 1: The Scenario */}
                        {webLeadStep === 'scenario' && (
                          <motion.div key="wl-scenario" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex flex-col items-center justify-center gap-5 py-4">
                            <div className="w-20 h-20 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                              <Globe size={36} className="text-violet-400" />
                            </div>
                            <div className="text-center max-w-md">
                              <div className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold mb-3 ${theme === 'dark' ? 'bg-white/10 text-white/50' : 'bg-slate-100 text-slate-500'}`}>11:00 PM — Sunday</div>
                              <h3 className="text-lg md:text-xl font-bold text-[var(--text-main)] mb-3">11 PM Sunday. A prospect finds your website.</h3>
                              <p className="text-[var(--text-muted)] text-sm leading-relaxed">
                                James K. needs help with his business taxes. He&apos;s been Googling CPAs and lands on your site. He fills out your contact form. It&apos;s late Sunday night — <span className="font-semibold text-[var(--text-main)]">nobody&apos;s in the office</span>. In most firms, this lead sits in an inbox until Monday morning. By then, James has already contacted three other firms.
                              </p>
                            </div>
                            <NextStepButton label="Watch the Form Fill" onClick={() => setWebLeadStep('form-filled')} />
                          </motion.div>
                        )}

                        {/* Step 2: Form Submitted */}
                        {webLeadStep === 'form-filled' && (
                          <motion.div key="wl-form" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex flex-col items-center justify-center gap-5 py-4">
                            <div className="text-center max-w-md mb-2">
                              <h3 className="text-lg md:text-xl font-bold text-[var(--text-main)] mb-3">Contact form submitted.</h3>
                              <p className="text-[var(--text-muted)] text-sm leading-relaxed">
                                James provided his name, email, and a brief description of what he needs. Your website captured the lead. Now what? With most firms — nothing until someone manually checks the inbox. With <span className="text-violet-400 font-semibold">Nexli AI</span>, the response is already being crafted.
                              </p>
                            </div>
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
                              <span>AI responding in 4 seconds...</span>
                            </div>
                            <NextStepButton label="See the AI Response" onClick={() => setWebLeadStep('auto-reply')} />
                          </motion.div>
                        )}

                        {/* Step 3: Instant Dual Response */}
                        {webLeadStep === 'auto-reply' && (
                          <motion.div key="wl-reply" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex flex-col items-center justify-center gap-5 py-4">
                            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20">
                              <CheckCircle size={14} className="text-green-400" />
                              <span className="text-green-400 text-xs font-bold">Auto-reply sent in 4 seconds</span>
                            </div>
                            <div className="text-center max-w-md mb-2">
                              <h3 className="text-lg md:text-xl font-bold text-[var(--text-main)] mb-3">Auto-reply sent in 4 seconds — via both Email and SMS.</h3>
                              <p className="text-[var(--text-muted)] text-sm leading-relaxed">
                                James receives a personalized email AND a text message simultaneously. Both reference his specific inquiry about business taxes. Both include a link to book a consultation. This happens whether it&apos;s <span className="font-semibold text-[var(--text-main)]">3 AM on Christmas or 2 PM on a Tuesday</span>.
                              </p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-lg">
                              <div className={`flex-1 rounded-xl border p-4 space-y-2 ${theme === 'dark' ? 'border-white/15 bg-black/40 backdrop-blur' : 'border-slate-200 bg-slate-50'}`}>
                                <div className="flex items-center gap-2 mb-2">
                                  <Mail size={14} className="text-violet-400" />
                                  <span className={`text-[10px] font-bold ${theme === 'dark' ? 'text-white/60' : 'text-slate-600'}`}>Email Sent</span>
                                </div>
                                <p className={`text-[9px] leading-relaxed ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'}`}>Hi James, thank you for reaching out! We specialize in business tax services and would love to help. I&apos;ve included a link below to book a free consultation...</p>
                              </div>
                              <div className={`flex-1 rounded-xl border p-4 space-y-2 ${theme === 'dark' ? 'border-white/15 bg-black/40 backdrop-blur' : 'border-slate-200 bg-slate-50'}`}>
                                <div className="flex items-center gap-2 mb-2">
                                  <Smartphone size={14} className="text-violet-400" />
                                  <span className={`text-[10px] font-bold ${theme === 'dark' ? 'text-white/60' : 'text-slate-600'}`}>SMS Sent</span>
                                </div>
                                <p className={`text-[9px] leading-relaxed ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'}`}>Hi James! Thanks for contacting us. We&apos;d love to discuss your business tax needs. Book a time here: yourfirm.com/book</p>
                              </div>
                            </div>
                            <InsightBox color="green">
                              <span className="font-bold">78% of clients choose the first firm to respond.</span> At 4 seconds, you&apos;re not just first — you&apos;re instant.
                            </InsightBox>
                            <NextStepButton label="See the Nurture Sequence" onClick={() => setWebLeadStep('nurture')} />
                          </motion.div>
                        )}

                        {/* Step 4: Smart Nurture */}
                        {webLeadStep === 'nurture' && (
                          <motion.div key="wl-nurture" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex flex-col items-center justify-center gap-5 py-4">
                            <div className="text-center max-w-md mb-2">
                              <h3 className="text-lg md:text-xl font-bold text-[var(--text-main)] mb-3">Smart Nurture Sequence Activated.</h3>
                              <p className="text-[var(--text-muted)] text-sm leading-relaxed">
                                James didn&apos;t book immediately — that&apos;s normal. <span className="font-semibold text-[var(--text-main)]">80% of sales require 5+ touchpoints.</span> Most firms give up after one. Nexli&apos;s nurture sequence keeps your firm top-of-mind with valuable, personalized messages over the next two weeks.
                              </p>
                            </div>
                            <div className="w-full max-w-sm space-y-2">
                              {[
                                { time: '4 sec', msg: 'Instant reply with booking link', why: 'First impression — speed = trust', done: true },
                                { time: 'Day 2', msg: 'Helpful tax tip + gentle follow-up', why: 'Provides value, builds trust', done: true },
                                { time: 'Day 5', msg: 'Calendar link + what to expect on the call', why: 'Reduces friction, removes unknowns', done: true },
                                { time: 'Day 8', msg: 'Final value-add message', why: 'Last nudge — creates urgency', active: true },
                              ].map((item, i) => (
                                <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.15 }} className={`flex items-center gap-3 rounded-xl border p-3 ${
                                  item.active
                                    ? theme === 'dark' ? 'border-violet-500/30 bg-violet-500/10' : 'border-violet-300 bg-violet-50'
                                    : theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'
                                }`}>
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${item.done ? 'bg-green-500/20' : 'bg-violet-500/20'}`}>
                                    {item.done ? <CheckCircle size={14} className="text-green-400" /> : <Send size={14} className="text-violet-400" />}
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className={`text-[9px] font-bold ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>{item.time}</span>
                                      <span className={`text-[8px] italic ${theme === 'dark' ? 'text-violet-400/60' : 'text-violet-500/70'}`}>{item.why}</span>
                                    </div>
                                    <span className={`text-[10px] ${theme === 'dark' ? 'text-white/60' : 'text-slate-600'}`}>{item.msg}</span>
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                            <NextStepButton label="See the Result" onClick={() => setWebLeadStep('booked')} />
                          </motion.div>
                        )}

                        {/* Step 5: Booked */}
                        {webLeadStep === 'booked' && (
                          <motion.div key="wl-booked" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex flex-col items-center justify-center gap-5 py-4">
                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }} className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                              <CalendarCheck size={32} className="text-green-500" />
                            </motion.div>
                            <h3 className="text-lg md:text-xl font-bold text-[var(--text-main)]">Consultation Booked!</h3>
                            <div className="text-center max-w-md mb-2">
                              <p className="text-[var(--text-muted)] text-sm leading-relaxed">
                                On Day 3, James booked his consultation. The nurture sequence built enough trust and urgency. From an 11 PM Sunday form fill to a booked consultation — <span className="text-violet-400 font-bold">zero human effort</span>. The AI handled the entire conversation.
                              </p>
                            </div>
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
                                  <span>Monday, 2:00 PM</span>
                                </div>
                                <div className="flex items-center gap-2 text-[var(--text-muted)]">
                                  <Clock size={14} className="text-violet-400" />
                                  <span>30 minutes</span>
                                </div>
                              </div>
                            </div>
                            <InsightBox color="violet">
                              <span className="font-bold">What just happened:</span> Website form → Instant dual response → Smart nurture over days → Prospect books → You show up prepared. All automated.
                            </InsightBox>
                            <div className="flex gap-3 mt-2">
                              <button onClick={() => setWebLeadStep('scenario')} className="flex items-center gap-2 px-5 py-3 rounded-full text-sm font-bold border border-[var(--glass-border)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all">
                                <RotateCcw size={14} />
                                Start Over
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Feature grid */}
              <div className="grid grid-cols-2 gap-3 mt-6">
                {aiFeatures.map((f, i) => (
                  <div key={i} className={`rounded-xl border p-3 ${theme === 'dark' ? 'bg-white/[0.02] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                    <div className={`w-8 h-8 rounded-lg border flex items-center justify-center mb-2 ${colorMap[f.color]}`}>
                      {f.icon}
                    </div>
                    <p className="text-xs font-bold text-[var(--text-main)] mb-0.5">{f.title}</p>
                    <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">{f.description}</p>
                  </div>
                ))}
              </div>

              <a href="/ai-automations" className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-violet-400 transition-colors mt-4">
                Explore the full AI Automations page
                <ChevronRight size={12} />
              </a>
            </motion.div>
          )}

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* DOCUMENT PORTAL TAB — Interactive CPA Dashboard                 */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {activeTab === 'document-portal' && (
            <motion.div
              key="docs"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Dashboard Header */}
              <div className={`relative flex items-center gap-3 mb-4 pb-3 ${theme === 'dark' ? 'bg-gradient-to-r from-cyan-500/[0.03] via-transparent to-blue-500/[0.03]' : ''}`}>
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.3)] animate-[pulse_3s_ease-in-out_infinite]">
                  <Shield size={16} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className={`text-sm font-bold block ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Summit Tax Group</span>
                  <span className={`text-[10px] block ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'}`}>CPA Dashboard — Document Management</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Bell size={16} className={theme === 'dark' ? 'text-white/40' : 'text-slate-400'} />
                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_6px_rgba(239,68,68,0.6)]" />
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.15)] animate-[pulse_4s_ease-in-out_infinite]">
                    <Lock size={10} className="text-emerald-500" />
                    <span className="text-emerald-500 text-[9px] font-bold">Encrypted</span>
                  </div>
                </div>
                {/* Shimmer gradient line */}
                <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
              </div>

              {/* Dashboard Layout: Sidebar + Content */}
              <div className="flex gap-0">
                {/* Sidebar */}
                <div className="shrink-0 w-10 md:w-36 relative py-1 space-y-0.5">
                  {/* Gradient separator line */}
                  <div className={`absolute top-0 right-0 bottom-0 w-[1px] ${theme === 'dark' ? 'bg-gradient-to-b from-transparent via-cyan-500/20 to-transparent' : 'bg-gradient-to-b from-transparent via-cyan-300/40 to-transparent'}`} />
                  {docDashboardSections.map((section) => {
                    const isActive = docView === section.id;
                    return (
                      <button
                        key={section.id}
                        onClick={() => { setDocView(section.id); setDemoSelectedForm(null); setSelectedClientName(null); }}
                        className={`w-full flex items-center gap-2 px-2 md:px-3 py-2 rounded-l-lg transition-all text-left ${
                          isActive
                            ? theme === 'dark' ? 'bg-gradient-to-r from-cyan-500/15 to-transparent border-r-2 border-r-cyan-500 text-cyan-400' : 'bg-gradient-to-r from-cyan-50 to-transparent border-r-2 border-r-cyan-500 text-cyan-700'
                            : theme === 'dark' ? 'text-white/40 hover:text-white/60 hover:bg-white/5' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {isActive && <div className="w-1 h-1 rounded-full bg-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.8)] shrink-0 hidden md:block" />}
                        <section.Icon size={14} className="shrink-0" />
                        <span className="hidden md:inline text-[11px] font-bold truncate">{section.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Main Content Area */}
                <div className="flex-1 min-h-[420px] md:min-h-[480px] pl-3 md:pl-5 relative overflow-hidden">
                  {/* Floating background particles */}
                  {theme === 'dark' && (
                    <>
                      <div className="absolute top-10 right-8 w-32 h-32 rounded-full bg-cyan-500/[0.03] blur-3xl animate-[float-particle_12s_ease-in-out_infinite] pointer-events-none" />
                      <div className="absolute bottom-20 left-4 w-24 h-24 rounded-full bg-blue-500/[0.04] blur-3xl animate-[float-particle_15s_ease-in-out_infinite_2s] pointer-events-none" />
                      <div className="absolute top-1/2 right-1/4 w-20 h-20 rounded-full bg-violet-500/[0.03] blur-3xl animate-[float-particle_10s_ease-in-out_infinite_4s] pointer-events-none" />
                    </>
                  )}
                  <AnimatePresence mode="wait">

                    {/* ── OVERVIEW ── */}
                    {docView === 'overview' && (
                      <motion.div key="dv-overview" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-2 mb-4">
                          {[
                            { label: 'Active Clients', value: '24', icon: Users, color: 'text-cyan-500', bg: 'bg-cyan-500/10', gradient: 'from-cyan-400 to-blue-500', glow: 'hover:shadow-[0_0_20px_rgba(6,182,212,0.15)]' },
                            { label: 'Docs Collected', value: '156', icon: FileText, color: 'text-emerald-500', bg: 'bg-emerald-500/10', gradient: 'from-emerald-400 to-teal-500', glow: 'hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]' },
                            { label: 'Pending Review', value: '8', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10', gradient: 'from-amber-400 to-orange-500', glow: 'hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]' },
                            { label: 'This Month', value: '34', icon: Activity, color: 'text-blue-500', bg: 'bg-blue-500/10', gradient: 'from-blue-400 to-violet-500', glow: 'hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]' },
                          ].map((stat, i) => (
                            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                              className={`rounded-xl border p-3 transition-all duration-300 ${stat.glow} hover:border-cyan-500/30 ${theme === 'dark' ? 'bg-white/[0.02] border-white/10' : 'bg-slate-50 border-slate-200'}`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className={`text-[9px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>{stat.label}</span>
                                <div className={`w-6 h-6 rounded-md ${stat.bg} flex items-center justify-center`}>
                                  <stat.icon size={11} className={stat.color} />
                                </div>
                              </div>
                              <p className={`text-xl font-black bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent`}>{stat.value}</p>
                            </motion.div>
                          ))}
                        </div>

                        {/* Recent Activity */}
                        <div className={`rounded-xl border p-3 mb-4 ${theme === 'dark' ? 'bg-white/[0.02] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                          <p className={`text-[10px] font-bold uppercase tracking-wider mb-3 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Recent Activity</p>
                          <div className="space-y-2.5">
                            {[
                              { msg: 'Sarah M. uploaded W-2_2025.pdf', time: '5 min ago', color: 'bg-cyan-500', glow: 'shadow-[0_0_6px_rgba(6,182,212,0.6)]' },
                              { msg: 'Document encrypted with AES-256', time: '5 min ago', color: 'bg-emerald-500', glow: 'shadow-[0_0_6px_rgba(16,185,129,0.6)]' },
                              { msg: 'CPA notified via email', time: '5 min ago', color: 'bg-blue-500', glow: 'shadow-[0_0_6px_rgba(59,130,246,0.6)]' },
                              { msg: 'James K. uploaded 1099-INT_Fidelity.pdf', time: '1h ago', color: 'bg-cyan-500', glow: 'shadow-[0_0_6px_rgba(6,182,212,0.6)]' },
                              { msg: 'Secure link sent to Lisa P. via SMS', time: '2h ago', color: 'bg-violet-500', glow: 'shadow-[0_0_6px_rgba(139,92,246,0.6)]' },
                              { msg: 'Robert T. completed all uploads', time: '3h ago', color: 'bg-emerald-500', glow: 'shadow-[0_0_6px_rgba(16,185,129,0.6)]' },
                            ].map((item, i) => (
                              <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.06 }} className="flex items-start gap-2.5">
                                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${item.color} ${item.glow}`} />
                                <div className="flex-1 min-w-0">
                                  <span className={`text-[11px] block truncate ${theme === 'dark' ? 'text-white/60' : 'text-slate-600'}`}>{item.msg}</span>
                                  <span className={`text-[9px] ${theme === 'dark' ? 'text-white/20' : 'text-slate-400'}`}>{item.time}</span>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="flex gap-2">
                          <button onClick={() => setDocView('send-request')} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_12px_rgba(6,182,212,0.1)] hover:shadow-[0_0_20px_rgba(6,182,212,0.25)] ${
                            theme === 'dark' ? 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20' : 'bg-cyan-50 border border-cyan-200 text-cyan-600 hover:bg-cyan-100'
                          }`}>
                            <Send size={12} /> Send Request
                          </button>
                          <button onClick={() => setDocView('forms')} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_12px_rgba(139,92,246,0.1)] hover:shadow-[0_0_20px_rgba(139,92,246,0.25)] ${
                            theme === 'dark' ? 'bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/20' : 'bg-violet-50 border border-violet-200 text-violet-600 hover:bg-violet-100'
                          }`}>
                            <ClipboardList size={12} /> Forms Library
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {/* ── CLIENTS ── */}
                    {docView === 'clients' && (
                      <motion.div key="dv-clients" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
                        {selectedClientData ? (
                          /* Client Detail — their document vault */
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <button onClick={() => setSelectedClientName(null)} className={`flex items-center gap-1 text-[10px] font-bold mb-3 ${theme === 'dark' ? 'text-white/40 hover:text-white/60' : 'text-slate-400 hover:text-slate-600'}`}>
                              <ChevronRight size={10} className="rotate-180" /> All Clients
                            </button>

                            {/* Client header card */}
                            <div className={`rounded-xl border p-3 mb-4 relative overflow-hidden ${theme === 'dark' ? 'bg-gradient-to-r from-cyan-500/10 via-transparent to-blue-500/10 border-cyan-500/20' : 'bg-gradient-to-r from-cyan-50 via-white to-blue-50 border-cyan-200'}`}>
                              {/* Top accent line */}
                              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-500 to-blue-500" />
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ring-2 ring-cyan-500/30 ${theme === 'dark' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-cyan-100 text-cyan-700'}`}>
                                  {selectedClientData.name.charAt(0)}{selectedClientData.name.split(' ')[1]?.charAt(0)}
                                </div>
                                <div className="flex-1">
                                  <p className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{selectedClientData.name}</p>
                                  <p className={`text-[9px] ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'}`}>{selectedClientData.email} · {selectedClientData.phone}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-lg font-black bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">{selectedClientData.docCount}</p>
                                  <p className={`text-[8px] font-bold ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Documents</p>
                                </div>
                              </div>
                            </div>

                            {/* Year grouping */}
                            {(() => {
                              const years = [...new Set(selectedClientData.documents.map(d => d.year))].sort((a, b) => b.localeCompare(a));
                              return years.map(year => (
                                <div key={year} className="mb-3">
                                  <p className={`text-[9px] font-bold uppercase tracking-wider mb-1.5 flex items-center gap-2 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>
                                    <span>{year} Tax Year</span>
                                    <span className={`px-1.5 py-0.5 rounded text-[8px] ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-100'}`}>
                                      {selectedClientData.documents.filter(d => d.year === year).length} files
                                    </span>
                                  </p>
                                  <div className={`rounded-xl border overflow-hidden ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
                                    {selectedClientData.documents.filter(d => d.year === year).map((doc, i) => (
                                      <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                                        className={`flex items-center gap-2 px-3 py-2 ${i > 0 ? `border-t ${theme === 'dark' ? 'border-white/5' : 'border-slate-100'}` : ''} ${
                                          doc.status === 'New'
                                            ? theme === 'dark' ? 'border-l-2 border-l-cyan-500 bg-cyan-500/5' : 'border-l-2 border-l-cyan-500 bg-cyan-50/50'
                                            : ''
                                        }`}
                                      >
                                        <FileText size={13} className="text-cyan-500 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                          <span className={`text-[11px] font-semibold block truncate ${theme === 'dark' ? 'text-white/80' : 'text-slate-700'}`}>{doc.name}</span>
                                          <span className={`text-[9px] ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>{doc.date}</span>
                                        </div>
                                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
                                          doc.status === 'New' ? 'bg-cyan-500/20 text-cyan-400' :
                                          doc.status === 'Reviewed' ? 'bg-emerald-500/20 text-emerald-400' :
                                          theme === 'dark' ? 'bg-white/10 text-white/30' : 'bg-slate-100 text-slate-400'
                                        }`}>{doc.status}</span>
                                        <div className="flex items-center gap-0.5">
                                          <button className={`p-1 rounded transition-colors ${theme === 'dark' ? 'hover:bg-white/10 text-white/30' : 'hover:bg-slate-100 text-slate-400'}`}><Eye size={11} /></button>
                                          <button className={`p-1 rounded transition-colors ${theme === 'dark' ? 'hover:bg-white/10 text-white/30' : 'hover:bg-slate-100 text-slate-400'}`}><Download size={11} /></button>
                                        </div>
                                      </motion.div>
                                    ))}
                                  </div>
                                </div>
                              ));
                            })()}
                          </motion.div>
                        ) : (
                          /* Client List */
                          <>
                            <div className="flex items-center justify-between mb-3">
                              <p className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>
                                {clientVault.length} Clients
                              </p>
                            </div>
                            <div className="space-y-2">
                              {clientVault.map((client, i) => (
                                <motion.button key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                                  onClick={() => setSelectedClientName(client.name)}
                                  className={`group w-full text-left flex items-center gap-3 p-2.5 rounded-xl border transition-all hover:scale-[1.01] hover:shadow-[0_0_20px_rgba(6,182,212,0.1)] ${
                                    theme === 'dark' ? 'border-white/10 bg-white/[0.02] hover:border-cyan-500/30 hover:bg-cyan-500/5' : 'border-slate-200 bg-white hover:border-cyan-300 hover:bg-cyan-50/50'
                                  }`}
                                >
                                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ring-2 ring-transparent group-hover:ring-cyan-500/30 transition-all ${theme === 'dark' ? 'bg-white/10 text-white/60' : 'bg-slate-100 text-slate-600'}`}>
                                    {client.name.charAt(0)}{client.name.split(' ')[1]?.charAt(0)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className={`text-xs font-semibold ${theme === 'dark' ? 'text-white/80' : 'text-slate-700'}`}>{client.name}</span>
                                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
                                        client.status === 'Active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                                      }`}>{client.status}</span>
                                    </div>
                                    <span className={`text-[9px] ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>{client.email}</span>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className="text-sm font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">{client.docCount}</p>
                                    <p className={`text-[8px] ${theme === 'dark' ? 'text-white/20' : 'text-slate-400'}`}>docs</p>
                                  </div>
                                  <ChevronRight size={12} className={theme === 'dark' ? 'text-white/20' : 'text-slate-300'} />
                                </motion.button>
                              ))}
                            </div>
                          </>
                        )}
                      </motion.div>
                    )}

                    {/* ── CLIENT DOCUMENTS ── */}
                    {docView === 'documents' && (
                      <motion.div key="dv-docs" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
                        {/* Filter tabs */}
                        <div className="flex gap-1.5 mb-4 overflow-x-auto">
                          {([
                            { key: 'all' as const, label: 'All', count: demoDocuments.length },
                            { key: 'new' as const, label: 'New', count: demoDocuments.filter(d => d.status === 'New').length },
                            { key: 'reviewed' as const, label: 'Reviewed', count: demoDocuments.filter(d => d.status === 'Reviewed').length },
                            { key: 'archived' as const, label: 'Archived', count: demoDocuments.filter(d => d.status === 'Archived').length },
                          ]).map((f) => (
                            <button key={f.key} onClick={() => setDocFilter(f.key)}
                              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all ${
                                docFilter === f.key
                                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                                  : theme === 'dark' ? 'text-white/40 hover:text-white/60 hover:bg-white/5' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {f.label} ({f.count})
                            </button>
                          ))}
                        </div>

                        {/* Document table */}
                        <div className={`rounded-xl border overflow-hidden ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
                          <div className={`grid grid-cols-[1fr_auto_auto] md:grid-cols-[1fr_80px_80px_auto_auto] gap-2 px-3 py-2 text-[8px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'bg-gradient-to-r from-cyan-500/5 to-transparent text-white/30' : 'bg-gradient-to-r from-cyan-50/50 to-slate-50 text-slate-400'}`}>
                            <span>Document</span>
                            <span className="hidden md:block">Client</span>
                            <span className="hidden md:block">Date</span>
                            <span>Status</span>
                            <span>Actions</span>
                          </div>
                          {filteredDocs.map((file, i) => (
                            <motion.div key={`${file.name}-${i}`} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                              className={`grid grid-cols-[1fr_auto_auto] md:grid-cols-[1fr_80px_80px_auto_auto] gap-2 items-center px-3 py-2.5 border-t transition-all ${
                                file.status === 'New'
                                  ? theme === 'dark' ? 'border-l-2 border-l-cyan-500 border-t-white/5 bg-cyan-500/5 shadow-[inset_2px_0_8px_rgba(6,182,212,0.15)]' : 'border-l-2 border-l-cyan-500 border-t-slate-100 bg-cyan-50/50 shadow-[inset_2px_0_8px_rgba(6,182,212,0.1)]'
                                  : theme === 'dark' ? 'border-t-white/5' : 'border-t-slate-100'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText size={13} className="text-cyan-500 shrink-0" />
                                <div className="min-w-0">
                                  <span className={`text-[11px] font-semibold block truncate ${theme === 'dark' ? 'text-white/80' : 'text-slate-700'}`}>{file.name}</span>
                                  <span className={`text-[9px] md:hidden ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>{file.client} · {file.date}</span>
                                </div>
                              </div>
                              <span className={`text-[10px] hidden md:block ${theme === 'dark' ? 'text-white/50' : 'text-slate-600'}`}>{file.client}</span>
                              <span className={`text-[9px] hidden md:block ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>{file.date}</span>
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                                file.status === 'New' ? 'bg-cyan-500/20 text-cyan-400' :
                                file.status === 'Reviewed' ? 'bg-emerald-500/20 text-emerald-400' :
                                theme === 'dark' ? 'bg-white/10 text-white/30' : 'bg-slate-100 text-slate-400'
                              }`}>{file.status}</span>
                              <div className="flex items-center gap-1">
                                <button className={`p-1 rounded transition-colors ${theme === 'dark' ? 'hover:bg-white/10 text-white/30' : 'hover:bg-slate-100 text-slate-400'}`}><Eye size={12} /></button>
                                <button className={`p-1 rounded transition-colors ${theme === 'dark' ? 'hover:bg-white/10 text-white/30' : 'hover:bg-slate-100 text-slate-400'}`}><Download size={12} /></button>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {/* ── SEND REQUEST ── */}
                    {docView === 'send-request' && (
                      <motion.div key="dv-send" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
                        <AnimatePresence mode="wait">
                          {/* Step 1: Select Client */}
                          {sendStep === 'select' && (
                            <motion.div key="send-select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                              <p className={`text-xs font-bold mb-3 ${theme === 'dark' ? 'text-white/50' : 'text-slate-600'}`}>Select a client to request documents from:</p>
                              <div className="space-y-2">
                                {sendClients.map((client, i) => (
                                  <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors ${
                                      client.status === 'Pending Docs'
                                        ? theme === 'dark' ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-cyan-300 bg-cyan-50'
                                        : theme === 'dark' ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-slate-50'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5">
                                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${theme === 'dark' ? 'bg-white/10 text-white/60' : 'bg-slate-200 text-slate-600'}`}>
                                        {client.name.charAt(0)}
                                      </div>
                                      <div>
                                        <span className={`text-xs font-semibold block ${theme === 'dark' ? 'text-white/80' : 'text-slate-700'}`}>{client.name}</span>
                                        <span className={`text-[9px] ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>{client.email}</span>
                                      </div>
                                    </div>
                                    {client.status === 'Pending Docs' || client.status === 'Not Started' ? (
                                      <button onClick={() => { setSendClient(client.name); setSendStep('generated'); }}
                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-600 text-white text-[10px] font-bold hover:bg-cyan-500 transition-all hover:scale-[1.02] active:scale-[0.98]">
                                        <Send size={10} /> Request
                                      </button>
                                    ) : (
                                      <span className={`text-[9px] font-semibold px-2 py-1 rounded-full ${
                                        client.status === 'Complete' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                                      }`}>{client.status}</span>
                                    )}
                                  </motion.div>
                                ))}
                              </div>
                            </motion.div>
                          )}

                          {/* Step 2: Link Generated */}
                          {sendStep === 'generated' && (
                            <motion.div key="send-gen" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                              <div className={`flex items-center gap-2 mb-3 ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                <CheckCircle size={14} />
                                <span className="text-xs font-bold">Secure Link Generated for {sendClient}</span>
                              </div>
                              <div className={`rounded-xl p-3 mb-4 border ring-1 ring-cyan-500/10 shadow-[0_0_15px_rgba(6,182,212,0.1)] ${theme === 'dark' ? 'bg-white/[0.03] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                                <span className={`text-[9px] font-bold block mb-1.5 ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'}`}>SECURE UPLOAD URL</span>
                                <div className="flex items-center gap-2">
                                  <div className={`flex-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-mono ${theme === 'dark' ? 'bg-black/50 text-cyan-400/80' : 'bg-white text-cyan-600 border border-slate-200'}`}>
                                    <Lock size={10} className="shrink-0" />
                                    <span className="truncate">summittax.nexli.net/u/a7f2e9b1-4d8c</span>
                                  </div>
                                  <button className={`p-1.5 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-white/10 text-white/40' : 'hover:bg-slate-100 text-slate-400'}`}>
                                    <Copy size={12} />
                                  </button>
                                </div>
                                <div className="flex items-center gap-3 mt-2">
                                  <div className="flex items-center gap-1">
                                    <Lock size={9} className="text-emerald-500" />
                                    <span className={`text-[8px] font-semibold ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>AES-256 Encrypted</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Clock size={9} className="text-amber-500" />
                                    <span className={`text-[8px] font-semibold ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Expires 7 days</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Users size={9} className="text-violet-500" />
                                    <span className={`text-[8px] font-semibold ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>No Login Required</span>
                                  </div>
                                </div>
                              </div>
                              {/* Portal Experience Selector */}
                              <p className={`text-[10px] font-bold mb-2 ${theme === 'dark' ? 'text-white/50' : 'text-slate-600'}`}>Portal experience for {sendClient}:</p>
                              <div className="grid grid-cols-2 gap-2 mb-4">
                                <button onClick={() => setSendUploadMode('standard')}
                                  className={`p-2.5 rounded-xl border text-left transition-all hover:scale-[1.01] ${
                                    sendUploadMode === 'standard'
                                      ? 'border-cyan-500/50 bg-cyan-500/10 ring-1 ring-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                                      : theme === 'dark' ? 'border-white/10 bg-white/[0.02] hover:border-white/20' : 'border-slate-200 bg-white hover:border-slate-300'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <Upload size={12} className="text-cyan-500" />
                                    <span className={`text-[10px] font-bold ${theme === 'dark' ? 'text-white/80' : 'text-slate-700'}`}>Standard Upload</span>
                                  </div>
                                  <p className={`text-[8px] leading-relaxed ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Drag-and-drop file upload interface</p>
                                </button>
                                <button onClick={() => setSendUploadMode('guided')}
                                  className={`p-2.5 rounded-xl border text-left transition-all hover:scale-[1.01] ${
                                    sendUploadMode === 'guided'
                                      ? 'border-emerald-500/50 bg-emerald-500/10 ring-1 ring-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                                      : theme === 'dark' ? 'border-white/10 bg-white/[0.02] hover:border-white/20' : 'border-slate-200 bg-white hover:border-slate-300'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <Camera size={12} className="text-emerald-500" />
                                    <span className={`text-[10px] font-bold ${theme === 'dark' ? 'text-white/80' : 'text-slate-700'}`}>Guided Camera</span>
                                  </div>
                                  <p className={`text-[8px] leading-relaxed ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Step-by-step photo capture on mobile</p>
                                </button>
                              </div>

                              <p className={`text-[10px] font-bold mb-2 ${theme === 'dark' ? 'text-white/50' : 'text-slate-600'}`}>How should we deliver this link?</p>
                              <div className="flex gap-2">
                                <button onClick={() => { setSendMethod('sms'); setSendStep('delivery'); }} className={`flex-1 flex items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] hover:shadow-[0_0_15px_rgba(6,182,212,0.2)] ${
                                  theme === 'dark' ? 'border-white/10 bg-white/5 text-white/70 hover:border-cyan-500/30' : 'border-slate-200 bg-white text-slate-700 hover:border-cyan-400'
                                }`}>
                                  <Smartphone size={14} className="text-cyan-500" /> SMS
                                </button>
                                <button onClick={() => { setSendMethod('email'); setSendStep('delivery'); }} className={`flex-1 flex items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] hover:shadow-[0_0_15px_rgba(6,182,212,0.2)] ${
                                  theme === 'dark' ? 'border-white/10 bg-white/5 text-white/70 hover:border-cyan-500/30' : 'border-slate-200 bg-white text-slate-700 hover:border-cyan-400'
                                }`}>
                                  <Mail size={14} className="text-cyan-500" /> Email
                                </button>
                              </div>
                            </motion.div>
                          )}

                          {/* Step 3: Delivery Preview */}
                          {sendStep === 'delivery' && (
                            <motion.div key="send-preview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                              <p className={`text-[10px] font-bold uppercase tracking-wider mb-3 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>
                                What {sendClient} will receive:
                              </p>
                              {sendMethod === 'sms' ? (
                                <div className="w-full max-w-[260px] mx-auto rounded-[1.5rem] border border-white/20 bg-black/60 backdrop-blur p-4 space-y-2.5">
                                  <div className="flex justify-between text-white/30 text-[9px] px-1">
                                    <span>Summit Tax Group</span>
                                    <Smartphone size={9} />
                                  </div>
                                  <div className="rounded-2xl bg-blue-500/20 border border-blue-500/15 p-3 space-y-2">
                                    <p className="text-white/70 text-[10px] leading-relaxed">
                                      Hi {sendClient?.split(' ')[0]}, Summit Tax Group needs your 2025 tax documents. Upload them securely — no account needed:
                                    </p>
                                    <div className={`rounded-lg p-2 flex items-center gap-2 ${theme === 'dark' ? 'bg-white/10' : 'bg-white/20'}`}>
                                      <Lock size={10} className="text-cyan-400 shrink-0" />
                                      <div>
                                        <span className="text-white/50 text-[8px] font-bold block">Secure Upload Portal</span>
                                        <span className="text-cyan-400 text-[8px] font-mono">summittax.nexli.net/u/a7f2</span>
                                      </div>
                                    </div>
                                  </div>
                                  <p className="text-white/20 text-[8px] text-center">Just now</p>
                                </div>
                              ) : (
                                <div className={`rounded-xl border overflow-hidden ${theme === 'dark' ? 'border-white/15 bg-white/[0.03]' : 'border-slate-200 bg-white'}`}>
                                  <div className={`px-4 py-2.5 border-b ${theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-slate-100 bg-slate-50'}`}>
                                    <div className="flex items-center gap-2 mb-1">
                                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                                        <Shield size={10} className="text-white" />
                                      </div>
                                      <span className={`text-[11px] font-bold ${theme === 'dark' ? 'text-white/80' : 'text-slate-700'}`}>Summit Tax Group</span>
                                    </div>
                                    <p className={`text-[9px] ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>
                                      To: {sendClient?.split(' ')[0]?.toLowerCase()}.{sendClient?.split(' ')[1]?.charAt(0)?.toLowerCase()}@email.com
                                    </p>
                                    <p className={`text-[10px] font-semibold ${theme === 'dark' ? 'text-white/60' : 'text-slate-600'}`}>
                                      Your Secure Document Upload Link
                                    </p>
                                  </div>
                                  <div className="p-4 space-y-2.5">
                                    <p className={`text-[10px] leading-relaxed ${theme === 'dark' ? 'text-white/50' : 'text-slate-600'}`}>
                                      Hi {sendClient?.split(' ')[0]},<br /><br />
                                      We need your 2025 tax documents to get started. Click the secure link below to upload — no account or login needed. Your files are encrypted with AES-256 encryption.
                                    </p>
                                    <div className="rounded-lg bg-cyan-600 py-2 text-center text-white text-[10px] font-bold">
                                      Upload Documents Securely
                                    </div>
                                    <p className={`text-[8px] ${theme === 'dark' ? 'text-white/20' : 'text-slate-400'}`}>This link expires in 7 days.</p>
                                  </div>
                                </div>
                              )}
                              <button onClick={() => setSendStep('sent')}
                                className="w-full mt-4 flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:from-cyan-500 hover:to-blue-500 transition-all shadow-[0_4px_20px_rgba(6,182,212,0.4)] hover:shadow-[0_4px_30px_rgba(6,182,212,0.6)] hover:scale-[1.02] active:scale-[0.98]">
                                <Send size={12} /> Send to {sendClient}
                              </button>
                            </motion.div>
                          )}

                          {/* Step 4: Sent Confirmation */}
                          {sendStep === 'sent' && (
                            <motion.div key="send-done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="text-center py-6">
                              <div className="relative w-14 h-14 mx-auto mb-4">
                                {/* Outer glow ring */}
                                <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }} transition={{ duration: 2.5, repeat: Infinity }} className="absolute inset-0 rounded-full bg-emerald-500/20" />
                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }} className="relative w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                                  <CheckCircle size={28} className="text-emerald-500" />
                                </motion.div>
                              </div>
                              <p className={`text-base font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                                Link Sent via {sendMethod === 'sms' ? 'SMS' : 'Email'}!
                              </p>
                              <p className={`text-xs mb-4 ${theme === 'dark' ? 'text-white/50' : 'text-slate-500'}`}>
                                {sendClient} will receive a secure upload link — no account or login needed.
                              </p>
                              <button onClick={() => { setSendStep('select'); setSendClient(null); setSendMethod(null); }}
                                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                  theme === 'dark' ? 'bg-white/10 text-white/60 hover:bg-white/15' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}>
                                <RotateCcw size={12} /> Send Another
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )}

                    {/* ── FORMS LIBRARY ── */}
                    {docView === 'forms' && (
                      <motion.div key="dv-forms" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
                        {demoSelectedForm ? (
                          /* Form Detail */
                          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                            <button onClick={() => setDemoSelectedForm(null)} className={`flex items-center gap-1 text-[10px] font-bold mb-3 ${theme === 'dark' ? 'text-white/40 hover:text-white/60' : 'text-slate-400 hover:text-slate-600'}`}>
                              <ChevronRight size={10} className="rotate-180" /> Back to Forms
                            </button>
                            <div className={`rounded-xl border p-4 mb-3 relative overflow-hidden ${theme === 'dark' ? 'bg-gradient-to-r from-cyan-500/10 via-transparent to-blue-500/10 border-cyan-500/20' : 'bg-gradient-to-r from-cyan-50 via-white to-blue-50 border-cyan-200'}`}>
                              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-500 to-blue-500" />
                              <div className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold mb-2 ${theme === 'dark' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-cyan-100 text-cyan-700'}`}>
                                {demoSelectedForm.number}
                              </div>
                              <h4 className={`text-sm font-bold mb-1 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{demoSelectedForm.name}</h4>
                              <p className={`text-[10px] leading-relaxed mb-3 ${theme === 'dark' ? 'text-white/50' : 'text-slate-600'}`}>{demoSelectedForm.description}</p>
                              {demoSelectedForm.state && (
                                <span className={`inline-block px-2 py-0.5 rounded-full text-[8px] font-bold ${theme === 'dark' ? 'bg-violet-500/20 text-violet-400' : 'bg-violet-100 text-violet-600'}`}>
                                  {demoSelectedForm.state}
                                </span>
                              )}
                            </div>
                            <div className="space-y-2">
                              <button className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:from-cyan-500 hover:to-blue-500 transition-all shadow-[0_4px_20px_rgba(6,182,212,0.3)] hover:shadow-[0_4px_25px_rgba(6,182,212,0.5)]">
                                <Send size={12} /> Send to Client for Signature
                              </button>
                              <div className="flex gap-2">
                                <button className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                                  theme === 'dark' ? 'border-white/10 text-white/60 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}>
                                  <Eye size={12} /> Preview
                                </button>
                                <button className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                                  theme === 'dark' ? 'border-white/10 text-white/60 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}>
                                  <Download size={12} /> Download
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        ) : (
                          /* Forms List */
                          <>
                            {/* Scope toggle */}
                            <div className="flex gap-1.5 mb-3">
                              <button onClick={() => { setDemoFormScope('federal'); setDemoFormState('All'); }}
                                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                                  demoFormScope === 'federal' ? 'bg-cyan-600 text-white' : theme === 'dark' ? 'text-white/40 hover:bg-white/5' : 'text-slate-400 hover:bg-slate-50'
                                }`}>
                                Federal (IRS)
                              </button>
                              <button onClick={() => setDemoFormScope('state')}
                                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                                  demoFormScope === 'state' ? 'bg-cyan-600 text-white' : theme === 'dark' ? 'text-white/40 hover:bg-white/5' : 'text-slate-400 hover:bg-slate-50'
                                }`}>
                                State Forms
                              </button>
                              {demoFormScope === 'state' && (
                                <select value={demoFormState} onChange={(e) => setDemoFormState(e.target.value)}
                                  className={`ml-auto px-2 py-1 rounded-lg text-[10px] font-bold border ${
                                    theme === 'dark' ? 'bg-white/5 border-white/10 text-white/60' : 'bg-white border-slate-200 text-slate-600'
                                  }`}>
                                  <option value="All">All States</option>
                                  {allStates.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                              )}
                            </div>

                            {/* Search */}
                            <div className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border mb-3 transition-all focus-within:ring-1 focus-within:ring-cyan-500/30 focus-within:shadow-[0_0_10px_rgba(6,182,212,0.1)] ${theme === 'dark' ? 'bg-white/[0.03] border-white/10' : 'bg-white border-slate-200'}`}>
                              <Search size={12} className={theme === 'dark' ? 'text-white/30' : 'text-slate-400'} />
                              <input
                                type="text"
                                value={demoFormSearch}
                                onChange={(e) => setDemoFormSearch(e.target.value)}
                                placeholder="Search forms..."
                                className={`flex-1 bg-transparent text-[11px] outline-none ${theme === 'dark' ? 'text-white/80 placeholder:text-white/20' : 'text-slate-700 placeholder:text-slate-400'}`}
                              />
                              {demoFormSearch && (
                                <button onClick={() => setDemoFormSearch('')}>
                                  <X size={12} className={theme === 'dark' ? 'text-white/30' : 'text-slate-400'} />
                                </button>
                              )}
                            </div>

                            {/* Results count */}
                            <p className={`text-[9px] font-bold mb-2 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>
                              {filteredForms.length} forms{filteredForms.length === 20 ? '+' : ''} found
                            </p>

                            {/* Form cards */}
                            <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                              {filteredForms.map((form, i) => (
                                <motion.button key={form.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                                  onClick={() => setDemoSelectedForm(form)}
                                  className={`w-full text-left flex items-center gap-2.5 p-2.5 rounded-xl border transition-all hover:scale-[1.01] hover:shadow-[0_0_15px_rgba(6,182,212,0.1)] ${
                                    theme === 'dark' ? 'border-white/10 bg-white/[0.02] hover:border-cyan-500/30 hover:bg-cyan-500/5' : 'border-slate-200 bg-white hover:border-cyan-300 hover:bg-cyan-50/50'
                                  }`}
                                >
                                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${theme === 'dark' ? 'bg-cyan-500/10' : 'bg-cyan-50'}`}>
                                    <span className="text-cyan-500 text-[8px] font-bold leading-tight text-center">{form.number.length > 6 ? form.number.slice(0, 6) : form.number}</span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <span className={`text-[11px] font-semibold block truncate ${theme === 'dark' ? 'text-white/80' : 'text-slate-700'}`}>{form.name}</span>
                                    <span className={`text-[9px] block truncate ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>
                                      {form.description}{form.state ? ` · ${form.state}` : ''}
                                    </span>
                                  </div>
                                  <ChevronRight size={12} className={theme === 'dark' ? 'text-white/20' : 'text-slate-300'} />
                                </motion.button>
                              ))}
                            </div>
                          </>
                        )}
                      </motion.div>
                    )}

                    {/* ── SECURITY ── */}
                    {docView === 'security' && (
                      <motion.div key="dv-security" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
                        {/* Encryption Hero */}
                        <div className="text-center mb-5">
                          <div className="relative w-20 h-20 mx-auto mb-4">
                            {/* Outer expanding ring */}
                            <motion.div animate={{ scale: [1, 1.6, 1], opacity: [0.2, 0, 0.2] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                              className="absolute inset-0 rounded-full border border-cyan-500/30" />
                            {/* Middle expanding ring */}
                            <motion.div animate={{ scale: [1, 1.35, 1], opacity: [0.3, 0, 0.3] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                              className="absolute inset-0 rounded-full border border-cyan-500/20" />
                            {/* Rotating gradient ring */}
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                              className="absolute inset-0 rounded-full"
                              style={{ background: 'conic-gradient(from 0deg, transparent, rgba(6,182,212,0.3), transparent, rgba(59,130,246,0.3), transparent)', mask: 'radial-gradient(farthest-side, transparent calc(100% - 2px), black calc(100% - 2px))', WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 2px), black calc(100% - 2px))' }} />
                            {/* Lock icon */}
                            <div className="absolute inset-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shadow-[0_0_25px_rgba(6,182,212,0.3)]">
                              <Lock size={24} className="text-cyan-500" style={{ filter: 'drop-shadow(0 0 8px rgba(6,182,212,0.5))' }} />
                            </div>
                          </div>
                          <h4 className="text-sm font-bold mb-1 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">AES-256 Quantum-Resistant Encryption</h4>
                          <p className={`text-[10px] ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'}`}>Every document encrypted at rest and in transit — rated quantum-resistant</p>
                        </div>

                        {/* Compliance Badges */}
                        <div className="grid grid-cols-2 gap-2 mb-5">
                          {[
                            { icon: ShieldCheck, title: 'IRS Pub 4557', desc: 'Compliant with IRS data protection standards', color: 'violet', glow: 'hover:shadow-[0_0_20px_rgba(139,92,246,0.15)]', iconGlow: 'shadow-[0_0_8px_rgba(139,92,246,0.3)]' },
                            { icon: Shield, title: 'GLBA/FTC Ready', desc: 'Gramm-Leach-Bliley Act safeguards', color: 'amber', glow: 'hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]', iconGlow: 'shadow-[0_0_8px_rgba(245,158,11,0.3)]' },
                            { icon: FolderLock, title: 'Isolated Storage', desc: 'Per-firm data vault — never commingled', color: 'emerald', glow: 'hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]', iconGlow: 'shadow-[0_0_8px_rgba(16,185,129,0.3)]' },
                            { icon: History, title: 'Full Audit Trail', desc: 'Every action logged and traceable', color: 'blue', glow: 'hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]', iconGlow: 'shadow-[0_0_8px_rgba(59,130,246,0.3)]' },
                            { icon: Clock, title: 'Auto Expiry', desc: 'Links & documents expire automatically', color: 'rose', glow: 'hover:shadow-[0_0_20px_rgba(244,63,94,0.15)]', iconGlow: 'shadow-[0_0_8px_rgba(244,63,94,0.3)]' },
                            { icon: Key, title: 'No Third-Party', desc: 'Your data is never shared externally', color: 'teal', glow: 'hover:shadow-[0_0_20px_rgba(20,184,166,0.15)]', iconGlow: 'shadow-[0_0_8px_rgba(20,184,166,0.3)]' },
                          ].map((badge, i) => {
                            const badgeColors: Record<string, string> = {
                              violet: theme === 'dark' ? 'bg-violet-500/10 text-violet-400' : 'bg-violet-50 text-violet-600',
                              amber: theme === 'dark' ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-600',
                              emerald: theme === 'dark' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600',
                              blue: theme === 'dark' ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600',
                              rose: theme === 'dark' ? 'bg-rose-500/10 text-rose-400' : 'bg-rose-50 text-rose-600',
                              teal: theme === 'dark' ? 'bg-teal-500/10 text-teal-400' : 'bg-teal-50 text-teal-600',
                            };
                            return (
                              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                                className={`rounded-xl border p-2.5 transition-all duration-300 ${badge.glow} ${theme === 'dark' ? 'bg-white/[0.02] border-white/10 hover:border-white/20' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}
                              >
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-1.5 ${badge.iconGlow} ${badgeColors[badge.color]}`}>
                                  <badge.icon size={13} />
                                </div>
                                <p className={`text-[10px] font-bold mb-0.5 ${theme === 'dark' ? 'text-white/80' : 'text-slate-700'}`}>{badge.title}</p>
                                <p className={`text-[8px] leading-relaxed ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>{badge.desc}</p>
                              </motion.div>
                            );
                          })}
                        </div>

                        {/* Document Journey */}
                        <div className={`rounded-xl border p-3 ${theme === 'dark' ? 'bg-white/[0.02] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                          <p className={`text-[9px] font-bold uppercase tracking-wider mb-3 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Document Journey</p>
                          <div className="space-y-2">
                            {[
                              { step: 'Client uploads document', color: 'bg-cyan-500', icon: Upload, glow: 'shadow-[0_0_10px_rgba(6,182,212,0.5)]', lineColor: 'from-cyan-500/50 to-emerald-500/50' },
                              { step: 'Encrypted with AES-256 (quantum-resistant)', color: 'bg-emerald-500', icon: Lock, glow: 'shadow-[0_0_10px_rgba(16,185,129,0.5)]', lineColor: 'from-emerald-500/50 to-violet-500/50' },
                              { step: 'Stored in firm-isolated vault', color: 'bg-violet-500', icon: FolderLock, glow: 'shadow-[0_0_10px_rgba(139,92,246,0.5)]', lineColor: 'from-violet-500/50 to-blue-500/50' },
                              { step: 'CPA notified instantly', color: 'bg-blue-500', icon: Bell, glow: 'shadow-[0_0_10px_rgba(59,130,246,0.5)]', lineColor: 'from-blue-500/50 to-amber-500/50' },
                              { step: 'CPA downloads securely', color: 'bg-amber-500', icon: Download, glow: 'shadow-[0_0_10px_rgba(245,158,11,0.5)]', lineColor: '' },
                            ].map((item, i) => (
                              <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                                className="flex items-center gap-2.5">
                                <div className="flex flex-col items-center">
                                  <div className={`w-6 h-6 rounded-full ${item.color} ${item.glow} flex items-center justify-center`}>
                                    <item.icon size={10} className="text-white" />
                                  </div>
                                  {i < 4 && <div className={`w-[2px] h-3 bg-gradient-to-b ${item.lineColor}`} />}
                                </div>
                                <span className={`text-[10px] font-semibold ${theme === 'dark' ? 'text-white/60' : 'text-slate-600'}`}>{item.step}</span>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}

                  </AnimatePresence>
                </div>
              </div>

              <a href="/document-portal" className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-cyan-400 transition-colors mt-4">
                Explore the full Document Portal page
                <ChevronRight size={12} />
              </a>
            </motion.div>
          )}

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* SMART REVIEWS TAB                                               */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {activeTab === 'smart-reviews' && (
            <motion.div
              key="reviews"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="relative overflow-hidden">
                <AnimatePresence mode="wait">
                  {/* IDLE — Star Selection */}
                  {reviewState === 'idle' && (
                    <motion.div key="idle" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="text-center py-4">
                      <div className="flex items-center justify-center gap-3 mb-5">
                        <svg width="36" height="36" viewBox="0 0 24 24">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        <span className="text-lg font-semibold text-[var(--text-muted)]">Google Reviews</span>
                      </div>
                      <h3 className="text-lg md:text-xl font-bold text-[var(--text-main)] mb-2">How was your experience?</h3>
                      <p className="text-[var(--text-muted)] text-sm mb-6">Click a star to leave your Google review</p>
                      <div className="flex justify-center gap-2 md:gap-3">
                        {[1, 2, 3, 4, 5].map((index) => (
                          <StarIcon key={index} index={index} filled={index <= selectedRating} hovered={index <= hoveredStar} />
                        ))}
                      </div>
                      {hoveredStar > 0 && (
                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-sm text-[var(--text-muted)]">
                          {starLabels[hoveredStar]}
                        </motion.p>
                      )}
                    </motion.div>
                  )}

                  {/* SELECTED — Spinner transition */}
                  {reviewState === 'selected' && (
                    <motion.div key="sel" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="text-center py-8">
                      <div className="flex justify-center gap-1 mb-4">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <svg key={i} width="28" height="28" viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" fill={i <= selectedRating ? '#fbbf24' : 'var(--glass-border)'} />
                          </svg>
                        ))}
                      </div>
                      <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto" />
                    </motion.div>
                  )}

                  {/* POSITIVE (4-5 stars) — Google Redirect */}
                  {reviewState === 'positive' && (
                    <motion.div key="pos" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="text-center py-4">
                      {/* Confetti */}
                      <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        {Array.from({ length: 16 }).map((_, i) => {
                          const angle = (i / 16) * Math.PI * 2;
                          const radius = 60 + Math.random() * 80;
                          const colors = ['#fbbf24', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
                          const shapes = ['rounded-full', 'rounded-sm', 'rounded-full'];
                          return (
                            <motion.div
                              key={`b1-${i}`}
                              className={`absolute w-2.5 h-2.5 ${shapes[i % 3]}`}
                              style={{ background: colors[i % 8], left: '50%', top: '35%', boxShadow: `0 0 6px ${colors[i % 8]}80` }}
                              initial={{ x: 0, y: 0, opacity: 1, scale: 0, rotate: 0 }}
                              animate={{ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, opacity: [0, 1, 1, 0], scale: [0, 1.5, 1, 0.3], rotate: Math.random() * 360 }}
                              transition={{ duration: 1.6, delay: i * 0.03, ease: 'easeOut' }}
                            />
                          );
                        })}
                        {Array.from({ length: 12 }).map((_, i) => {
                          const angle = ((i + 0.5) / 12) * Math.PI * 2;
                          const radius = 30 + Math.random() * 50;
                          const colors = ['#fde68a', '#93c5fd', '#6ee7b7', '#fcd34d', '#c4b5fd', '#f9a8d4'];
                          return (
                            <motion.div
                              key={`b2-${i}`}
                              className="absolute w-1.5 h-1.5 rounded-full"
                              style={{ background: colors[i % 6], left: '50%', top: '35%', boxShadow: `0 0 4px ${colors[i % 6]}` }}
                              initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                              animate={{ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, opacity: [0, 1, 1, 0], scale: [0, 1.8, 0.8, 0] }}
                              transition={{ duration: 1.2, delay: 0.15 + i * 0.04, ease: 'easeOut' }}
                            />
                          );
                        })}
                      </div>

                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }} className="w-14 h-14 mx-auto mb-5 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                        <CheckCircle size={28} className="text-green-500" />
                      </motion.div>
                      <h3 className="text-lg md:text-xl font-bold text-[var(--text-main)] mb-2">Thank you!</h3>
                      <p className="text-[var(--text-muted)] text-sm mb-5">Redirecting you to Google Reviews...</p>
                      <div className="inline-flex items-center gap-3 px-5 py-3 rounded-full bg-white dark:bg-white/10 border border-[var(--glass-border)] shadow-lg">
                        <svg width="20" height="20" viewBox="0 0 24 24">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        <span className="text-sm font-semibold text-gray-700 dark:text-white/80">Google Reviews</span>
                      </div>
                      <p className="mt-5 text-[10px] text-[var(--text-muted)] opacity-60 uppercase tracking-widest font-bold">This is a demo — no actual redirect</p>
                    </motion.div>
                  )}

                  {/* NEGATIVE (1-3 stars) — Feedback Form */}
                  {reviewState === 'negative' && (
                    <motion.div key="neg" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="text-center py-4">
                      <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                        <MessageSquare size={24} className="text-blue-400" />
                      </div>
                      <h3 className="text-lg md:text-xl font-bold text-[var(--text-main)] mb-2">We Value Your Feedback</h3>
                      <p className="text-[var(--text-muted)] text-sm mb-5 max-w-md mx-auto">
                        Your feedback goes directly to the team INTERNALLY — NOT as a public Google review. The customer has no idea it&apos;s being routed internally.
                      </p>
                      <textarea
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        placeholder="What could we do better?"
                        rows={3}
                        className="w-full bg-[var(--glass-border)] border border-[var(--glass-border)] rounded-xl px-4 py-3 text-[var(--text-main)] focus:outline-none focus:border-blue-500 transition-all font-medium resize-none mb-4 text-sm"
                      />
                      <button
                        onClick={handleFeedbackSubmit}
                        disabled={feedbackSubmitting}
                        className={`w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98] ${feedbackSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                      >
                        {feedbackSubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send size={16} />}
                        {feedbackSubmitting ? 'Sending...' : 'Submit Feedback'}
                      </button>
                    </motion.div>
                  )}

                  {/* FEEDBACK SENT — Thank You */}
                  {reviewState === 'feedbackSent' && (
                    <motion.div key="sent" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="text-center py-6">
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }} className="w-14 h-14 mx-auto mb-5 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                        <CheckCircle size={28} className="text-blue-500" />
                      </motion.div>
                      <h3 className="text-lg md:text-xl font-bold text-[var(--text-main)] mb-2">Thank You for Your Feedback</h3>
                      <p className="text-[var(--text-muted)] text-sm">Your response has been sent directly to the team. We appreciate your honesty.</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Reset */}
                {reviewState !== 'idle' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-4 text-center">
                    <button onClick={resetReviewDemo} className="inline-flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-widest hover:text-blue-400 transition-colors">
                      <RotateCcw size={14} />
                      Try Again
                    </button>
                  </motion.div>
                )}
              </div>

              <a href="/smart-reviews" className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-blue-400 transition-colors mt-4">
                Explore the full Smart Reviews page
                <ChevronRight size={12} />
              </a>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default RainmakerDemo;
