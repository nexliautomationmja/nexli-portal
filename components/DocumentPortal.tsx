'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Shield,
    ArrowRight,
    Upload,
    FileText,
    Lock,
    CheckCircle,
    Eye,
    Download,
    Bell,
    Clock,
    Users,
    AlertTriangle,
    BarChart3,
    Zap,
    RotateCcw,
    FolderLock,
    ShieldCheck,
    Server,
    Key,
    FileCheck,
    History,
    Send,
    MousePointerClick,
    Link2,
    Smartphone,
    Copy,
    Mail,
    Camera,
    Search,
    ChevronRight,
    ChevronDown,
    X,
    Printer,
    Save,
    PenLine,
} from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { useBooking } from './QualificationProvider';
import { allForms, formCategories, allStates, getFormFields, type TaxForm, type FormCategory } from '../data/taxForms';
import FormPreview from './FormPreview';

type DemoView = 'generate' | 'deliver' | 'client' | 'admin';
type UploadState = 'idle' | 'dragging' | 'uploading' | 'success';

interface UploadedFile {
    id: string;
    name: string;
    type: string;
    size: string;
    client: string;
    date: string;
    status: 'New' | 'Reviewed' | 'Archived';
}

let fileIdCounter = 0;

const DocumentPortal: React.FC = () => {
    const { theme } = useTheme();
    const { openBooking } = useBooking();

    // Demo state
    const [demoView, setDemoView] = useState<DemoView>('generate');
    const [uploadState, setUploadState] = useState<UploadState>('idle');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadingFileName, setUploadingFileName] = useState('');
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const [newUploadAlert, setNewUploadAlert] = useState(false);
    const [activeStatIndex, setActiveStatIndex] = useState(0);
    const [statProgress, setStatProgress] = useState(0);
    const [expandedStep, setExpandedStep] = useState<number>(0);
    const [linkGenerated, setLinkGenerated] = useState(false);
    const [linkSent, setLinkSent] = useState(false);
    const [deliveryMethod, setDeliveryMethod] = useState<'sms' | 'email' | null>(null);
    const [uploadMode, setUploadMode] = useState<'standard' | 'guided'>('standard');
    const [capturedDocs, setCapturedDocs] = useState<string[]>([]);
    const [capturingDoc, setCapturingDoc] = useState<string | null>(null);
    const [captureStep, setCaptureStep] = useState<'camera' | 'scanning' | 'detected' | null>(null);

    // Forms browser state
    const [adminTab, setAdminTab] = useState<'documents' | 'forms'>('documents');
    const [formSearch, setFormSearch] = useState('');
    const [formScope, setFormScope] = useState<'federal' | 'state'>('federal');
    const [formCategory, setFormCategory] = useState<FormCategory | 'All'>('All');
    const [formState, setFormState] = useState<string>('All');
    const [selectedForm, setSelectedForm] = useState<TaxForm | null>(null);
    const [formData, setFormData] = useState<Record<string, string>>({});
    const [formView, setFormView] = useState<'edit' | 'preview'>('edit');
    const formPreviewRef = useRef<HTMLDivElement>(null);

    // Print/Download: open form in a new window with Tailwind styles and trigger browser print
    const handlePrintOrDownload = useCallback(() => {
        if (!formPreviewRef.current || !selectedForm) return;
        const html = formPreviewRef.current.innerHTML;
        const printWindow = window.open('', '_blank', 'width=900,height=1100');
        if (!printWindow) return;
        // Grab all stylesheets from the current page
        const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
            .map(el => el.outerHTML).join('\n');
        printWindow.document.write(`<!DOCTYPE html><html><head><title>Form ${selectedForm.number} — ${selectedForm.name}</title>${styles}<style>
            @media print { body { margin: 0; padding: 0; } @page { size: letter; margin: 0.5in; } }
            body { font-family: 'Courier New', 'Liberation Mono', monospace; background: white; color: #1e293b; padding: 0; margin: 0; }
            .print-wrapper { max-width: 850px; margin: 0 auto; padding: 24px; }
        </style></head><body><div class="print-wrapper">${html}</div></body></html>`);
        printWindow.document.close();
        // Wait for styles to load then trigger print
        setTimeout(() => { printWindow.focus(); printWindow.print(); }, 400);
    }, [selectedForm]);

    // Simulated upload handler
    const handleFileUpload = (fileName: string, fileType: string) => {
        if (uploadState === 'uploading') return;
        setUploadingFileName(fileName);
        setUploadState('uploading');
        setUploadProgress(0);

        const interval = setInterval(() => {
            setUploadProgress((prev) => {
                if (prev >= 100) {
                    clearInterval(interval);
                    setUploadState('success');
                    setNewUploadAlert(true);
                    setUploadedFiles((files) => [
                        {
                            id: `file-${Date.now()}-${++fileIdCounter}`,
                            name: fileName,
                            type: fileType,
                            size: `${(Math.random() * 2 + 0.5).toFixed(1)} MB`,
                            client: 'Sarah M.',
                            date: 'Just now',
                            status: 'New',
                        },
                        ...files,
                    ]);
                    return 100;
                }
                return prev + 4;
            });
        }, 50);
    };

    const resetUpload = () => {
        setUploadState('idle');
        setUploadProgress(0);
        setUploadingFileName('');
    };

    // Guided capture documents
    const guidedDocuments = [
        { id: 'w2', label: 'W-2', description: 'Wage & Tax Statement from employer' },
        { id: '1099-int', label: '1099-INT', description: 'Interest Income from bank' },
        { id: 'bank', label: 'Bank Statements', description: 'Jan – Dec 2025' },
        { id: '1098', label: '1098 Mortgage', description: 'Mortgage Interest Statement' },
    ];

    // Camera capture handler
    const handleCaptureDoc = (docId: string, docLabel: string) => {
        if (capturingDoc) return;
        setCapturingDoc(docId);
        setCaptureStep('camera');

        setTimeout(() => {
            setCaptureStep('scanning');
        }, 1200);

        setTimeout(() => {
            setCaptureStep('detected');
        }, 2600);

        setTimeout(() => {
            setCapturedDocs(prev => [...prev, docId]);
            setCapturingDoc(null);
            setCaptureStep(null);
            setNewUploadAlert(true);
            setUploadedFiles(files => [{
                id: `file-${Date.now()}-${++fileIdCounter}`,
                name: `${docLabel}_2025.pdf`,
                type: 'PDF',
                size: `${(Math.random() * 2 + 0.5).toFixed(1)} MB`,
                client: 'Sarah M.',
                date: 'Just now',
                status: 'New',
            }, ...files]);
        }, 3500);
    };

    // Link generation handlers
    const handleGenerateLink = () => {
        setLinkGenerated(true);
    };

    const handleSendLink = (method: 'sms' | 'email') => {
        setDeliveryMethod(method);
        setTimeout(() => {
            setLinkSent(true);
        }, 800);
    };

    // Reset state when re-entering generate view
    useEffect(() => {
        if (demoView === 'generate') {
            setLinkGenerated(false);
            setLinkSent(false);
            setDeliveryMethod(null);
            setUploadMode('standard');
            setCapturedDocs([]);
            setCapturingDoc(null);
            setCaptureStep(null);
        }
    }, [demoView]);

    // Clear alert when switching to admin view
    useEffect(() => {
        if (demoView === 'admin') {
            const timer = setTimeout(() => setNewUploadAlert(false), 1000);
            return () => clearTimeout(timer);
        }
    }, [demoView]);

    // Problem stats data
    const problemStats = [
        {
            id: 'email-risk',
            icon: <AlertTriangle className="w-5 h-5 md:w-6 md:h-6" />,
            stat: 'The Risk',
            label: 'Email Attachments',
            title: '91% of Cyberattacks Start With Email',
            description: "Every W-2, 1099, and bank statement your clients email you is a data breach waiting to happen. Email was never designed for secure document transfer.",
            benefits: [
                'Unencrypted attachments in transit',
                'Documents lost in overflowing inboxes',
                'No audit trail of who accessed what',
                'Violates IRS Pub 4557 guidance',
            ],
        },
        {
            id: 'third-party',
            icon: <Server className="w-5 h-5 md:w-6 md:h-6" />,
            stat: 'The Breach',
            label: 'Third-Party Portals',
            title: 'Shared Portals Expose All Clients at Once',
            description: "Third-party document platforms commingle your clients' data with thousands of other firms. One breach affects everyone. Your clients deserve isolated, firm-specific storage.",
            benefits: [
                'Data commingled across firms',
                'Single point of failure for all clients',
                'You don\'t control the encryption keys',
                'Brand dilution — not your portal',
            ],
        },
        {
            id: 'friction',
            icon: <Users className="w-5 h-5 md:w-6 md:h-6" />,
            stat: 'The Friction',
            label: 'Client Experience',
            title: '67% of Clients Delay Sending Documents',
            description: "The harder you make it to submit documents, the longer tax season drags on. Clients don't want to create accounts, download apps, or figure out unfamiliar portals.",
            benefits: [
                'Clients must create separate accounts',
                'Unfamiliar interfaces cause confusion',
                'Multiple login credentials to manage',
                'Support calls instead of submissions',
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
            const displayArea = document.getElementById('doc-stat-display-area');
            if (displayArea) {
                displayArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    };

    // How it works data
    const expandedStepCards = [
        { step: '01', title: 'Send Secure Link', description: 'CPA sends a branded, secure upload link to the client via email or SMS. No account creation needed — zero friction.', bg: 'from-cyan-950 via-cyan-900 to-blue-900' },
        { step: '02', title: 'Client Uploads', description: "Client uploads documents through your firm's branded portal. Drag-and-drop, mobile-friendly, instant confirmation.", bg: 'from-blue-950 via-blue-900 to-indigo-900' },
        { step: '03', title: 'Encrypted & Stored', description: "Files encrypted with AES-256 (quantum-resistant) at rest and TLS in transit. Stored in your firm's isolated vault — never commingled with other firms.", bg: 'from-emerald-950 via-green-900 to-teal-900' },
        { step: '04', title: 'CPA Notified', description: 'Instant notification when documents arrive. Download securely from your dashboard with a full audit trail.', bg: 'from-amber-950 via-orange-900 to-red-900' },
    ];
    const StepIcons = [Send, Upload, Lock, Bell];

    // Pre-seeded dashboard data
    const preSeededFiles: UploadedFile[] = [
        { id: 'pre-1', name: '1099-INT_Fidelity.pdf', type: 'PDF', size: '1.2 MB', client: 'James K.', date: 'Feb 15, 2026', status: 'Reviewed' },
        { id: 'pre-2', name: 'Bank_Statement_Jan.pdf', type: 'PDF', size: '2.4 MB', client: 'Lisa P.', date: 'Feb 14, 2026', status: 'Reviewed' },
        { id: 'pre-3', name: 'W-2_Employer.pdf', type: 'PDF', size: '0.8 MB', client: 'Robert T.', date: 'Feb 13, 2026', status: 'Archived' },
        { id: 'pre-4', name: 'Mortgage_1098.pdf', type: 'PDF', size: '1.1 MB', client: 'Maria C.', date: 'Feb 12, 2026', status: 'Archived' },
    ];

    const allDashboardFiles = [...uploadedFiles, ...preSeededFiles];

    // Security features
    const securityFeatures = [
        { icon: <Lock size={16} className="text-cyan-400 md:w-[22px] md:h-[22px]" />, title: 'AES-256 Quantum-Resistant Encryption', description: 'Every document encrypted with AES-256 — rated quantum-resistant, meaning your data stays secure even against future quantum computing threats.', iconDark: 'bg-cyan-500/10 border-cyan-500/20', iconLight: 'bg-cyan-50 border-cyan-200' },
        { icon: <ShieldCheck size={16} className="text-blue-400 md:w-[22px] md:h-[22px]" />, title: 'TLS Encryption in Transit', description: 'All uploads protected with the same encryption used by major banks.', iconDark: 'bg-blue-500/10 border-blue-500/20', iconLight: 'bg-blue-50 border-blue-200' },
        { icon: <FolderLock size={16} className="text-emerald-400 md:w-[22px] md:h-[22px]" />, title: 'Per-Firm Isolated Storage', description: "Your clients' documents are never commingled with other firms.", iconDark: 'bg-emerald-500/10 border-emerald-500/20', iconLight: 'bg-emerald-50 border-emerald-200' },
        { icon: <FileCheck size={16} className="text-violet-400 md:w-[22px] md:h-[22px]" />, title: 'IRS Pub 4557 Compliant', description: 'Meets IRS data security requirements for tax professionals.', iconDark: 'bg-violet-500/10 border-violet-500/20', iconLight: 'bg-violet-50 border-violet-200' },
        { icon: <Shield size={16} className="text-amber-400 md:w-[22px] md:h-[22px]" />, title: 'GLBA/FTC Safeguards Ready', description: 'Designed to meet Gramm-Leach-Bliley Act safeguard requirements.', iconDark: 'bg-amber-500/10 border-amber-500/20', iconLight: 'bg-amber-50 border-amber-200' },
        { icon: <Clock size={16} className="text-rose-400 md:w-[22px] md:h-[22px]" />, title: 'Automatic Document Expiry', description: 'Documents auto-expire after configurable retention periods.', iconDark: 'bg-rose-500/10 border-rose-500/20', iconLight: 'bg-rose-50 border-rose-200' },
        { icon: <History size={16} className="text-indigo-400 md:w-[22px] md:h-[22px]" />, title: 'Full Audit Trail', description: 'Every upload, download, and access is logged and timestamped.', iconDark: 'bg-indigo-500/10 border-indigo-500/20', iconLight: 'bg-indigo-50 border-indigo-200' },
        { icon: <Key size={16} className="text-teal-400 md:w-[22px] md:h-[22px]" />, title: 'No Third-Party Data Sharing', description: 'Your data stays in your vault. We never share or commingle.', iconDark: 'bg-teal-500/10 border-teal-500/20', iconLight: 'bg-teal-50 border-teal-200' },
    ];

    // Forms browser filtering
    const filteredForms = allForms.filter(f => {
        const matchesSearch = formSearch === '' ||
            f.number.toLowerCase().includes(formSearch.toLowerCase()) ||
            f.name.toLowerCase().includes(formSearch.toLowerCase()) ||
            f.description.toLowerCase().includes(formSearch.toLowerCase());
        const isStateForm = f.category === 'State Forms';
        // Federal/State scope filter
        if (formScope === 'federal' && isStateForm) return false;
        if (formScope === 'state' && !isStateForm) return false;
        // Category filter (skip "State Forms" category when in state scope since everything is state)
        const matchesCategory = formCategory === 'All' || f.category === formCategory;
        // State dropdown filter
        const matchesState = formState === 'All' || f.state === formState;
        return matchesSearch && matchesCategory && matchesState;
    });
    // Categories relevant to current scope
    const visibleCategories = formScope === 'state'
        ? ['State Forms'] as const
        : formCategories.filter(c => c !== 'State Forms');

    const handleSelectForm = (form: TaxForm) => {
        setSelectedForm(form);
        setFormData({});
        setFormView('edit');
    };

    const handleFormFieldChange = (fieldId: string, value: string) => {
        setFormData(prev => ({ ...prev, [fieldId]: value }));
    };

    // File type pills for the client upload demo
    const fileTypes = [
        { name: 'W-2_2025.pdf', label: 'W-2', icon: '📄' },
        { name: '1099-INT_Chase.pdf', label: '1099-INT', icon: '📄' },
        { name: '1099-DIV_Vanguard.pdf', label: '1099-DIV', icon: '📄' },
        { name: 'Bank_Statement_Dec.pdf', label: 'Bank Statement', icon: '🏦' },
        { name: 'Mortgage_1098_2025.pdf', label: '1098 Mortgage', icon: '🏠' },
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
                        {/* Section badge pill */}
                        <div className="relative inline-flex items-center mb-6 rounded-full overflow-hidden p-[1.5px]">
                            <span
                                className="absolute inset-[-100%] animate-[shimmer_8s_linear_infinite] opacity-80"
                                style={{
                                    background: 'conic-gradient(from 0deg at 50% 50%, #06B6D4, #10B981, #06B6D4)'
                                }}
                            />
                            <span
                                className="absolute inset-[-100%] animate-[shimmer_8s_linear_infinite] blur-md opacity-40"
                                style={{
                                    background: 'conic-gradient(from 0deg at 50% 50%, #06B6D4, #10B981, #06B6D4)'
                                }}
                            />
                            <span className="relative z-10 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--bg-main)]">
                                <Shield size={14} className="text-cyan-500" />
                                <span className="text-[var(--text-main)] text-[10px] md:text-xs font-black tracking-[0.2em] uppercase">Secure Documents</span>
                            </span>
                        </div>

                        <h1 className="text-[26px] sm:text-4xl md:text-6xl font-black text-[var(--text-main)] mb-6 leading-tight tracking-tighter" style={{ fontFamily: "'Syne', sans-serif" }}>
                            Stop Emailing Tax Documents.{' '}
                            <br className="hidden md:block" />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-emerald-500">
                                Start Collecting Securely.
                            </span>
                        </h1>

                        {/* Mobile-only: animated visual between headline and paragraph */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 1, ease: "circOut" }}
                            className="flex lg:hidden items-center justify-center my-8 relative"
                        >
                            <div className="absolute inset-0 bg-cyan-500/10 blur-[80px] rounded-full" />
                            <div className="relative z-10 flex flex-col items-center gap-3">
                                <motion.div
                                    initial={{ opacity: 0, scale: 0 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                                >
                                    <Shield size={48} className="text-cyan-500" style={{ filter: 'drop-shadow(0 0 20px rgba(6, 182, 212, 0.4))' }} />
                                </motion.div>
                                <div className="flex gap-3" style={{ perspective: '600px' }}>
                                    {[FileText, Lock, FolderLock, ShieldCheck].map((Icon, i) => (
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
                                                opacity: { delay: 0.4 + i * 0.15, duration: 0.6 },
                                                y: { delay: 0.8 + i * 0.15, duration: 3 + i * 0.4, repeat: Infinity, ease: "easeInOut" },
                                                rotateX: { delay: 0.8 + i * 0.15, duration: 3.5 + i * 0.3, repeat: Infinity, ease: "easeInOut" },
                                                rotateY: { delay: 0.8 + i * 0.15, duration: 4 + i * 0.5, repeat: Infinity, ease: "easeInOut" },
                                            }}
                                            style={{ transformStyle: 'preserve-3d' }}
                                        >
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-slate-100 border border-slate-200'}`}>
                                                <Icon size={20} className="text-cyan-500" style={{ filter: 'drop-shadow(0 2px 4px rgba(6, 182, 212, 0.3))' }} />
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>

                        <p className="text-sm sm:text-lg md:text-xl text-[var(--text-muted)] mb-8 max-w-xl leading-relaxed">
                            Your clients shouldn't trust a third-party app with their W-2s, 1099s, and financial statements. Collect documents through your firm's own branded portal with bank-level encryption. No third-party breach risk. No extra logins for your clients.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-5">
                            <button
                                onClick={() => document.getElementById('document-portal-demo')?.scrollIntoView({ behavior: 'smooth' })}
                                className="flex items-center justify-center gap-2 bg-cyan-600 text-white px-6 md:px-8 py-3 md:py-4 rounded-full text-sm font-bold hover:bg-cyan-500 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-cyan-600/20 group"
                            >
                                Try the Demo
                                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                            <button
                                onClick={openBooking}
                                className="flex items-center justify-center gap-2 px-6 md:px-8 py-3 md:py-4 rounded-full text-sm font-bold text-[var(--text-main)] border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-md hover:border-cyan-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
                            >
                                Book Now
                            </button>
                        </div>
                    </motion.div>

                    {/* Right side: floating document/shield visual */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 1, ease: "circOut" }}
                        className="relative hidden lg:flex items-center justify-center"
                    >
                        <div className="absolute inset-0 bg-cyan-500/10 blur-[100px] rounded-full" />
                        <div className="relative z-10 flex flex-col items-center gap-6">
                            {/* Large shield */}
                            <motion.div
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                            >
                                <Shield size={80} className="text-cyan-500" style={{ filter: 'drop-shadow(0 0 30px rgba(6, 182, 212, 0.4))' }} />
                            </motion.div>
                            {/* Floating document icons */}
                            <div className="flex gap-4" style={{ perspective: '600px' }}>
                                {[FileText, Lock, FolderLock, ShieldCheck, FileCheck].map((Icon, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{
                                            opacity: 1,
                                            y: [0, -8, 0],
                                            rotateX: [0, 5, 0],
                                            rotateY: [0, i % 2 === 0 ? 8 : -8, 0],
                                            rotateZ: [0, i % 2 === 0 ? 2 : -2, 0],
                                        }}
                                        transition={{
                                            opacity: { delay: 0.5 + i * 0.15, duration: 0.6 },
                                            y: { delay: 1 + i * 0.15, duration: 3 + i * 0.4, repeat: Infinity, ease: "easeInOut" },
                                            rotateX: { delay: 1 + i * 0.15, duration: 3.5 + i * 0.3, repeat: Infinity, ease: "easeInOut" },
                                            rotateY: { delay: 1 + i * 0.15, duration: 4 + i * 0.5, repeat: Infinity, ease: "easeInOut" },
                                            rotateZ: { delay: 1 + i * 0.15, duration: 5 + i * 0.4, repeat: Infinity, ease: "easeInOut" },
                                        }}
                                        style={{ transformStyle: 'preserve-3d' }}
                                    >
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-slate-100 border border-slate-200'}`}>
                                            <Icon size={24} className="text-cyan-500" style={{ filter: 'drop-shadow(0 2px 6px rgba(6, 182, 212, 0.3))' }} />
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
                        <div className="inline-flex items-center gap-2 mb-4 md:mb-6 px-3 py-1 md:px-4 md:py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20">
                            <BarChart3 size={14} className="text-cyan-400" />
                            <span className="text-cyan-400 text-[9px] md:text-xs font-black tracking-[0.2em] uppercase">The Problem</span>
                        </div>
                        <h2 className="text-2xl md:text-5xl font-bold text-[var(--text-main)] mb-4 md:mb-6">
                            Document Collection Is <span className="text-cyan-500">Broken</span>
                        </h2>
                        <p className="text-[var(--text-muted)] max-w-2xl mx-auto text-sm md:text-lg">
                            CPA firms handle some of the most sensitive financial data in existence. Yet most still rely on email and third-party portals that put client data at risk.
                        </p>
                    </div>

                    <div className="max-w-6xl mx-auto">
                        <div className={`relative rounded-[1.5rem] md:rounded-[3rem] border border-[var(--glass-border)] shadow-2xl overflow-hidden flex flex-col md:min-h-[600px] transition-colors duration-500 ${theme === 'dark' ? 'bg-[#050505]' : 'bg-white'}`}>

                            {/* Glowing Atmosphere */}
                            <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-full h-[300px] blur-[120px] pointer-events-none transition-opacity duration-500 ${theme === 'dark' ? 'bg-cyan-500/5 opacity-100' : 'bg-cyan-500/10 opacity-50'}`} />

                            {/* Display Area */}
                            <div id="doc-stat-display-area" className="flex-grow grid lg:grid-cols-2 gap-5 md:gap-12 p-5 md:p-16 items-center">

                                {/* Left Side: Content */}
                                <div className="relative z-10 order-2 lg:order-1">
                                    <AnimatePresence mode="wait">
                                        <motion.div
                                            key={activeStatIndex}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -20 }}
                                            transition={{ duration: 0.4 }}
                                        >
                                            <div className="mb-4 md:mb-6 flex items-center gap-2 md:gap-3 text-cyan-500">
                                                <div className="p-1.5 md:p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
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
                                                        <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5 md:w-4 md:h-4" />
                                                        <span className="text-[var(--text-main)] opacity-90">{benefit}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    </AnimatePresence>
                                </div>

                                {/* Right Side: Animated Scene */}
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
                                            {/* Scene 1: Email with exposed documents */}
                                            {activeStatIndex === 0 && (
                                                <div className="flex flex-col items-center gap-4 p-6">
                                                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }} className="relative">
                                                        <div className="w-[200px] rounded-xl border border-white/15 bg-white/5 backdrop-blur p-4">
                                                            <div className="flex items-center gap-2 mb-3">
                                                                <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                                                                    <AlertTriangle size={14} className="text-red-400" />
                                                                </div>
                                                                <div>
                                                                    <span className="text-white/60 text-[10px] font-semibold block">Inbox</span>
                                                                    <span className="text-white/30 text-[8px]">3 attachments</span>
                                                                </div>
                                                            </div>
                                                            {['W-2_2025.pdf', '1099_Chase.pdf', 'SSN_Copy.jpg'].map((file, i) => (
                                                                <motion.div
                                                                    key={i}
                                                                    initial={{ x: -20, opacity: 0 }}
                                                                    animate={{ x: 0, opacity: 1 }}
                                                                    transition={{ delay: 0.4 + i * 0.15 }}
                                                                    className="flex items-center gap-2 py-1.5 border-b border-white/5 last:border-0"
                                                                >
                                                                    <FileText size={10} className="text-red-400/60" />
                                                                    <span className="text-white/40 text-[9px]">{file}</span>
                                                                </motion.div>
                                                            ))}
                                                        </div>
                                                        <motion.div
                                                            initial={{ scale: 0 }}
                                                            animate={{ scale: 1 }}
                                                            transition={{ delay: 0.8, type: "spring" }}
                                                            className="absolute -top-2 -right-2 px-2 py-1 bg-red-500 rounded-full flex items-center gap-1 shadow-lg shadow-red-500/30"
                                                        >
                                                            <AlertTriangle size={10} className="text-white" />
                                                            <span className="text-white text-[8px] font-bold">UNENCRYPTED</span>
                                                        </motion.div>
                                                    </motion.div>
                                                </div>
                                            )}

                                            {/* Scene 2: Third-party breach */}
                                            {activeStatIndex === 1 && (
                                                <div className="flex flex-col items-center gap-4 p-6">
                                                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }}>
                                                        <Server size={40} className="text-red-400/80" />
                                                    </motion.div>
                                                    <div className="flex gap-2">
                                                        {['Firm A', 'Firm B', 'Firm C', 'Your Firm'].map((firm, i) => (
                                                            <motion.div
                                                                key={i}
                                                                initial={{ opacity: 0, y: 10 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                transition={{ delay: 0.4 + i * 0.1 }}
                                                                className={`px-2 py-1 rounded-lg text-[8px] font-bold ${i === 3 ? 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-400' : 'bg-white/5 border border-white/10 text-white/40'}`}
                                                            >
                                                                {firm}
                                                            </motion.div>
                                                        ))}
                                                    </div>
                                                    <motion.div
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        transition={{ delay: 0.9 }}
                                                        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/20 border border-red-500/30"
                                                    >
                                                        <AlertTriangle size={12} className="text-red-400" />
                                                        <span className="text-red-400 text-[9px] font-bold">1 Breach = All Firms Exposed</span>
                                                    </motion.div>
                                                </div>
                                            )}

                                            {/* Scene 3: Friction / confusing signup */}
                                            {activeStatIndex === 2 && (
                                                <div className="flex flex-col items-center gap-3 p-6">
                                                    <div className="w-[180px] rounded-xl border border-white/15 bg-white/5 backdrop-blur p-3.5">
                                                        <p className="text-white/50 text-[9px] font-semibold mb-2 text-center">Create Account</p>
                                                        {['Full Name', 'Email Address', 'Create Password', 'Confirm Password', 'Phone Number'].map((field, i) => (
                                                            <motion.div
                                                                key={i}
                                                                initial={{ width: 0 }}
                                                                animate={{ width: '100%' }}
                                                                transition={{ delay: 0.3 + i * 0.1, duration: 0.4 }}
                                                                className="mb-1.5"
                                                            >
                                                                <span className="text-white/20 text-[7px]">{field}</span>
                                                                <div className="h-2.5 rounded bg-white/10 w-full" />
                                                            </motion.div>
                                                        ))}
                                                        <motion.div
                                                            initial={{ opacity: 0 }}
                                                            animate={{ opacity: 1 }}
                                                            transition={{ delay: 0.9 }}
                                                            className="w-full py-1.5 rounded-lg bg-white/10 flex items-center justify-center mt-2"
                                                        >
                                                            <span className="text-white/30 text-[8px] font-bold">Step 1 of 3...</span>
                                                        </motion.div>
                                                    </div>
                                                    <motion.div
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        transition={{ delay: 1.1 }}
                                                        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/30"
                                                    >
                                                        <Users size={12} className="text-amber-400" />
                                                        <span className="text-amber-400 text-[9px] font-bold">Client gives up here</span>
                                                    </motion.div>
                                                </div>
                                            )}
                                        </motion.div>
                                    </AnimatePresence>
                                </div>
                            </div>

                            {/* Tab bar with progress */}
                            <div className="relative z-10 flex overflow-x-auto border-t border-[var(--glass-border)] smart-reviews-tabs">
                                {problemStats.map((stat, i) => (
                                    <button
                                        key={stat.id}
                                        onClick={() => handleStatTabClick(i)}
                                        className={`flex-1 min-w-0 relative flex items-center gap-1.5 md:gap-3 px-2 md:px-8 py-3 md:py-6 text-left transition-colors ${activeStatIndex === i ? '' : 'opacity-50 hover:opacity-75'}`}
                                    >
                                        <div className={`w-7 h-7 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center shrink-0 ${activeStatIndex === i ? 'bg-cyan-500/20 text-cyan-400' : `text-[var(--text-muted)] ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-100'}`}`}>
                                            {stat.icon}
                                        </div>
                                        <div>
                                            <span className="text-[var(--text-muted)] text-[8px] md:text-[10px] font-bold tracking-widest uppercase block">{stat.stat}</span>
                                            <span className={`text-[10px] md:text-sm font-bold ${activeStatIndex === i ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)]'}`}>{stat.label}</span>
                                        </div>
                                        {/* Progress bar */}
                                        {activeStatIndex === i && (
                                            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--glass-border)]">
                                                <div className="h-full bg-cyan-500 transition-all duration-100 ease-linear" style={{ width: `${statProgress}%` }} />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </motion.section>

                {/* ── SECTION 3: Interactive Demo ── */}
                <motion.section
                    id="document-portal-demo"
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, ease: "circOut" }}
                    className="mb-24"
                >
                    <div className="text-center mb-12">
                        <div className="inline-flex items-center gap-2 mb-4 md:mb-6 px-3 py-1 md:px-4 md:py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20">
                            <MousePointerClick size={14} className="text-cyan-400" />
                            <span className="text-cyan-400 text-[9px] md:text-xs font-black tracking-[0.2em] uppercase">Interactive Demo</span>
                        </div>
                        <h2 className="text-2xl md:text-5xl font-bold text-[var(--text-main)] mb-4 md:mb-6">
                            See the Full <span className="text-cyan-500">Journey</span>
                        </h2>
                        <p className="text-[var(--text-muted)] max-w-2xl mx-auto text-sm md:text-lg">
                            Walk through the entire flow — from generating a secure link, to the client receiving it and uploading documents. No logins. No accounts. Just a link.
                        </p>
                    </div>

                    {/* 4-step flow indicator */}
                    <div className="flex justify-center mb-8">
                        <div className={`inline-flex items-center p-1.5 rounded-2xl border ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                            {([
                                { view: 'generate' as DemoView, label: 'Generate Link', Icon: Link2 },
                                { view: 'deliver' as DemoView, label: 'Client Gets Link', Icon: Smartphone },
                                { view: 'client' as DemoView, label: 'Upload Docs', Icon: Upload },
                                { view: 'admin' as DemoView, label: 'CPA Dashboard', Icon: Eye },
                            ]).map((s, i, arr) => {
                                const allSteps: DemoView[] = ['generate', 'deliver', 'client', 'admin'];
                                const currentIdx = allSteps.indexOf(demoView);
                                const isActive = demoView === s.view;
                                const isPast = currentIdx > i;
                                return (
                                    <React.Fragment key={s.view}>
                                        <button
                                            onClick={() => setDemoView(s.view)}
                                            className={`relative flex flex-col items-center gap-1 px-2 md:px-4 py-2 rounded-xl transition-all ${isActive ? 'bg-cyan-500/10' : ''}`}
                                        >
                                            <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all ${
                                                isActive ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/20' :
                                                isPast ? 'bg-emerald-500/20 text-emerald-400' :
                                                theme === 'dark' ? 'bg-white/10 text-white/40' : 'bg-slate-100 text-slate-400'
                                            }`}>
                                                {isPast ? <CheckCircle size={14} /> : <s.Icon size={14} />}
                                            </div>
                                            <span className={`text-[7px] md:text-[10px] font-bold whitespace-nowrap ${
                                                isActive ? 'text-cyan-500' :
                                                isPast ? 'text-emerald-500/70' :
                                                'text-[var(--text-muted)]'
                                            }`}>{s.label}</span>
                                            {s.view === 'admin' && newUploadAlert && demoView !== 'admin' && (
                                                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                                            )}
                                        </button>
                                        {i < arr.length - 1 && (
                                            <div className={`w-3 md:w-6 h-[2px] rounded-full -mt-3 ${
                                                isPast ? 'bg-emerald-500/40' :
                                                theme === 'dark' ? 'bg-white/10' : 'bg-slate-200'
                                            }`} />
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>

                    {/* Demo container */}
                    <div className="max-w-4xl mx-auto">
                        <div className={`p-6 md:p-10 rounded-[1.5rem] md:rounded-[3rem] border border-[var(--glass-border)] relative overflow-hidden ${theme === 'dark' ? 'bg-[#050505]' : 'bg-white'}`}>

                            {/* Glowing Atmosphere */}
                            <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-full h-[200px] blur-[120px] pointer-events-none ${theme === 'dark' ? 'bg-cyan-500/5' : 'bg-cyan-500/10'}`} />

                            <AnimatePresence mode="wait">
                                {demoView === 'generate' ? (
                                    <motion.div
                                        key="generate"
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        transition={{ duration: 0.4 }}
                                        className="relative z-10"
                                    >
                                        {/* CPA Dashboard header */}
                                        <div className={`flex items-center gap-3 mb-6 pb-4 border-b ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                                                <Shield size={18} className="text-white" />
                                            </div>
                                            <div>
                                                <span className={`text-sm md:text-base font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Document Requests</span>
                                                <span className={`text-[10px] md:text-xs block ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'}`}>Summit Tax Group — CPA Dashboard</span>
                                            </div>
                                        </div>

                                        {!linkGenerated ? (
                                            <>
                                                <p className={`text-sm mb-4 ${theme === 'dark' ? 'text-white/60' : 'text-slate-600'}`}>
                                                    Select a client to request documents from:
                                                </p>
                                                <div className="space-y-2">
                                                    {[
                                                        { name: 'Sarah M.', email: 'sarah.m@email.com', status: 'Pending Docs' },
                                                        { name: 'James K.', email: 'james.k@email.com', status: 'Complete' },
                                                        { name: 'Lisa P.', email: 'lisa.p@email.com', status: 'In Progress' },
                                                    ].map((client, i) => (
                                                        <div
                                                            key={i}
                                                            className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                                                                i === 0
                                                                    ? theme === 'dark' ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-cyan-500/30 bg-cyan-50'
                                                                    : theme === 'dark' ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-slate-50'
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                                                    theme === 'dark' ? 'bg-white/10 text-white/60' : 'bg-slate-200 text-slate-600'
                                                                }`}>
                                                                    {client.name.charAt(0)}
                                                                </div>
                                                                <div>
                                                                    <span className={`text-sm font-semibold block ${theme === 'dark' ? 'text-white/80' : 'text-slate-700'}`}>{client.name}</span>
                                                                    <span className={`text-[10px] ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>{client.email}</span>
                                                                </div>
                                                            </div>
                                                            {i === 0 ? (
                                                                <button
                                                                    onClick={handleGenerateLink}
                                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 text-white text-xs font-bold hover:bg-cyan-500 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                                                >
                                                                    <Send size={12} />
                                                                    Request Docs
                                                                </button>
                                                            ) : (
                                                                <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${
                                                                    client.status === 'Complete' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                                                                }`}>{client.status}</span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        ) : !linkSent ? (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                            >
                                                <div className={`flex items-center gap-2 mb-4 ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                                    <CheckCircle size={16} />
                                                    <span className="text-sm font-bold">Secure Link Generated for Sarah M.</span>
                                                </div>

                                                {/* Generated link display */}
                                                <div className={`rounded-xl p-4 mb-5 border ${theme === 'dark' ? 'bg-white/[0.03] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                                                    <span className={`text-[10px] font-bold block mb-2 ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'}`}>SECURE UPLOAD URL</span>
                                                    <div className="flex items-center gap-2">
                                                        <div className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono ${theme === 'dark' ? 'bg-black/50 text-cyan-400/80' : 'bg-white text-cyan-600 border border-slate-200'}`}>
                                                            <Lock size={12} className="shrink-0" />
                                                            <span className="truncate">summittax.nexli.net/u/a7f2e9b1-4d8c</span>
                                                        </div>
                                                        <button className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-white/10 text-white/40' : 'hover:bg-slate-100 text-slate-400'}`}>
                                                            <Copy size={14} />
                                                        </button>
                                                    </div>
                                                    <div className="flex items-center gap-4 mt-3">
                                                        <div className="flex items-center gap-1.5">
                                                            <Lock size={10} className="text-emerald-500" />
                                                            <span className={`text-[9px] font-semibold ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>AES-256 Encrypted</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <Clock size={10} className="text-amber-500" />
                                                            <span className={`text-[9px] font-semibold ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Expires in 7 days</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Upload mode selection */}
                                                <p className={`text-xs font-bold mb-3 ${theme === 'dark' ? 'text-white/50' : 'text-slate-600'}`}>
                                                    Choose portal experience for this client:
                                                </p>
                                                <div className="grid grid-cols-2 gap-3 mb-5">
                                                    <button
                                                        onClick={() => setUploadMode('standard')}
                                                        className={`p-3 rounded-xl border text-left transition-all hover:scale-[1.01] ${
                                                            uploadMode === 'standard'
                                                                ? 'border-cyan-500/50 bg-cyan-500/10 ring-1 ring-cyan-500/30'
                                                                : theme === 'dark' ? 'border-white/10 bg-white/[0.02] hover:border-white/20' : 'border-slate-200 bg-white hover:border-slate-300'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <Upload size={14} className="text-cyan-500" />
                                                            <span className={`text-xs font-bold ${theme === 'dark' ? 'text-white/80' : 'text-slate-700'}`}>Standard Upload</span>
                                                        </div>
                                                        <p className={`text-[9px] leading-relaxed ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>
                                                            Drag-and-drop files. For tech-savvy clients with digital docs ready.
                                                        </p>
                                                    </button>
                                                    <button
                                                        onClick={() => setUploadMode('guided')}
                                                        className={`p-3 rounded-xl border text-left transition-all hover:scale-[1.01] ${
                                                            uploadMode === 'guided'
                                                                ? 'border-cyan-500/50 bg-cyan-500/10 ring-1 ring-cyan-500/30'
                                                                : theme === 'dark' ? 'border-white/10 bg-white/[0.02] hover:border-white/20' : 'border-slate-200 bg-white hover:border-slate-300'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <Camera size={14} className="text-emerald-500" />
                                                            <span className={`text-xs font-bold ${theme === 'dark' ? 'text-white/80' : 'text-slate-700'}`}>Guided Camera</span>
                                                        </div>
                                                        <p className={`text-[9px] leading-relaxed ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>
                                                            Step-by-step photo capture. For clients who prefer snapping paper docs.
                                                        </p>
                                                    </button>
                                                </div>

                                                {/* Delivery method selection */}
                                                <p className={`text-xs font-bold mb-3 ${theme === 'dark' ? 'text-white/50' : 'text-slate-600'}`}>
                                                    How should we deliver this link to Sarah?
                                                </p>
                                                <div className="flex gap-3">
                                                    <button
                                                        onClick={() => handleSendLink('sms')}
                                                        className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98] ${
                                                            theme === 'dark' ? 'border-white/10 bg-white/5 text-white/70 hover:border-cyan-500/30 hover:bg-cyan-500/5' : 'border-slate-200 bg-white text-slate-700 hover:border-cyan-500/40'
                                                        }`}
                                                    >
                                                        <Smartphone size={16} className="text-cyan-500" />
                                                        SMS
                                                    </button>
                                                    <button
                                                        onClick={() => handleSendLink('email')}
                                                        className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98] ${
                                                            theme === 'dark' ? 'border-white/10 bg-white/5 text-white/70 hover:border-cyan-500/30 hover:bg-cyan-500/5' : 'border-slate-200 bg-white text-slate-700 hover:border-cyan-500/40'
                                                        }`}
                                                    >
                                                        <Mail size={16} className="text-cyan-500" />
                                                        Email
                                                    </button>
                                                </div>
                                            </motion.div>
                                        ) : (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className="text-center py-6"
                                            >
                                                <motion.div
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    transition={{ type: "spring", stiffness: 200 }}
                                                    className="w-16 h-16 rounded-full mx-auto mb-4 bg-emerald-500/20 flex items-center justify-center"
                                                >
                                                    <CheckCircle size={32} className="text-emerald-500" />
                                                </motion.div>
                                                <p className={`text-lg font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                                                    Link Sent via {deliveryMethod === 'sms' ? 'SMS' : 'Email'}!
                                                </p>
                                                <p className={`text-sm mb-6 ${theme === 'dark' ? 'text-white/50' : 'text-slate-500'}`}>
                                                    Sarah M. will receive a secure upload link — no account or login needed.
                                                </p>
                                                <button
                                                    onClick={() => setDemoView('deliver')}
                                                    className="inline-flex items-center gap-2 text-cyan-500 font-bold text-sm hover:text-cyan-400 transition-colors"
                                                >
                                                    See What Sarah Receives
                                                    <ArrowRight size={16} />
                                                </button>
                                            </motion.div>
                                        )}
                                    </motion.div>

                                ) : demoView === 'deliver' ? (
                                    <motion.div
                                        key="deliver"
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        transition={{ duration: 0.4 }}
                                        className="relative z-10"
                                    >
                                        <div className="flex flex-col items-center">
                                            <p className={`text-sm font-bold mb-6 ${theme === 'dark' ? 'text-white/60' : 'text-slate-600'}`}>
                                                {deliveryMethod === 'email' ? 'Sarah checks her inbox:' : 'Sarah receives this on her phone:'}
                                            </p>

                                            {/* Phone mockup */}
                                            <div className="relative">
                                                <div className={`w-[280px] rounded-[2.5rem] border-2 p-3 shadow-2xl ${theme === 'dark' ? 'border-white/20 bg-slate-900' : 'border-slate-300 bg-white'}`}>
                                                    {/* Dynamic Island / Notch */}
                                                    <div className={`w-24 h-5 mx-auto rounded-full mb-6 ${theme === 'dark' ? 'bg-black' : 'bg-slate-900'}`} />

                                                    {/* Contact header */}
                                                    <div className="text-center mb-4 px-2">
                                                        <div className={`w-10 h-10 rounded-full mx-auto mb-1 flex items-center justify-center ${theme === 'dark' ? 'bg-cyan-500/20' : 'bg-cyan-50'}`}>
                                                            <Shield size={16} className="text-cyan-500" />
                                                        </div>
                                                        <span className={`text-xs font-bold ${theme === 'dark' ? 'text-white/60' : 'text-slate-600'}`}>Summit Tax Group</span>
                                                        <span className={`text-[9px] block ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>
                                                            {deliveryMethod === 'email' ? 'noreply@summittax.com' : '+1 (555) 012-3456'}
                                                        </span>
                                                    </div>

                                                    {/* Message content */}
                                                    <div className="px-2 space-y-3">
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                                            transition={{ delay: 0.3 }}
                                                            className={`rounded-2xl rounded-tl-sm p-3.5 max-w-[90%] ${theme === 'dark' ? 'bg-white/10' : 'bg-[#007AFF] text-white'}`}
                                                        >
                                                            <p className={`text-[12px] leading-relaxed mb-2.5 ${theme === 'dark' ? 'text-white/80' : 'text-white'}`}>
                                                                Hi Sarah, Summit Tax Group needs your 2025 tax documents. Upload them securely — no account needed:
                                                            </p>

                                                            {/* Link preview card */}
                                                            <motion.div
                                                                initial={{ opacity: 0, y: 5 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                transition={{ delay: 0.6 }}
                                                                className={`rounded-xl p-2.5 ${theme === 'dark' ? 'bg-cyan-500/15 border border-cyan-500/20' : 'bg-white/20 border border-white/30'}`}
                                                            >
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <Lock size={10} className={theme === 'dark' ? 'text-cyan-400' : 'text-white'} />
                                                                    <span className={`text-[10px] font-bold ${theme === 'dark' ? 'text-cyan-400' : 'text-white'}`}>Secure Upload Portal</span>
                                                                </div>
                                                                <p className={`text-[9px] font-mono ${theme === 'dark' ? 'text-cyan-400/60' : 'text-white/80'}`}>
                                                                    summittax.nexli.net/u/a7f2e9b1
                                                                </p>
                                                            </motion.div>
                                                        </motion.div>

                                                        {/* Timestamp */}
                                                        <motion.div
                                                            initial={{ opacity: 0 }}
                                                            animate={{ opacity: 1 }}
                                                            transition={{ delay: 0.8 }}
                                                            className="text-center"
                                                        >
                                                            <span className={`text-[10px] ${theme === 'dark' ? 'text-white/20' : 'text-slate-400'}`}>Just now</span>
                                                        </motion.div>
                                                    </div>

                                                    {/* Home indicator */}
                                                    <div className="h-8 flex items-end justify-center pb-1">
                                                        <div className={`w-28 h-1 rounded-full ${theme === 'dark' ? 'bg-white/20' : 'bg-slate-300'}`} />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* CTA to continue */}
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 1 }}
                                                className="mt-6 text-center"
                                            >
                                                <p className={`text-xs mb-3 ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'}`}>
                                                    Sarah taps the link — no login, no password, no app to download.
                                                </p>
                                                <button
                                                    onClick={() => setDemoView('client')}
                                                    className="inline-flex items-center gap-2 bg-cyan-600 text-white px-5 py-2.5 rounded-full text-sm font-bold hover:bg-cyan-500 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-cyan-500/20"
                                                >
                                                    See Upload Experience
                                                    <ArrowRight size={14} />
                                                </button>
                                            </motion.div>
                                        </div>
                                    </motion.div>

                                ) : demoView === 'client' ? (
                                    <motion.div
                                        key="client"
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        transition={{ duration: 0.4 }}
                                        className="relative z-10"
                                    >
                                        {/* Mock firm header */}
                                        <div className={`flex items-center gap-3 mb-6 pb-4 border-b ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                                                <Shield size={18} className="text-white" />
                                            </div>
                                            <div>
                                                <span className={`text-sm md:text-base font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Summit Tax Group</span>
                                                <span className={`text-[10px] md:text-xs block ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'}`}>Secure Document Portal</span>
                                            </div>
                                            <div className="ml-auto flex items-center gap-1.5">
                                                <Lock size={12} className="text-emerald-500" />
                                                <span className="text-emerald-500 text-[10px] font-bold">Encrypted</span>
                                            </div>
                                        </div>

                                        {uploadMode === 'guided' ? (
                                            <>
                                                {/* Guided mode welcome */}
                                                <p className={`text-sm md:text-base mb-6 ${theme === 'dark' ? 'text-white/70' : 'text-slate-600'}`}>
                                                    Welcome, <span className="font-bold">Sarah</span>. Your CPA needs these documents — just tap each one to take a photo:
                                                </p>

                                                {/* Progress indicator */}
                                                <div className={`flex items-center gap-3 mb-6 p-3 rounded-xl border ${theme === 'dark' ? 'bg-white/[0.03] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                                                    <div className={`text-lg font-black ${capturedDocs.length === guidedDocuments.length ? 'text-emerald-500' : 'text-cyan-500'}`}>
                                                        {capturedDocs.length}/{guidedDocuments.length}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className={`h-2 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-200'}`}>
                                                            <motion.div
                                                                className={`h-full rounded-full ${capturedDocs.length === guidedDocuments.length ? 'bg-emerald-500' : 'bg-gradient-to-r from-cyan-500 to-emerald-500'}`}
                                                                animate={{ width: `${(capturedDocs.length / guidedDocuments.length) * 100}%` }}
                                                                transition={{ duration: 0.5 }}
                                                            />
                                                        </div>
                                                    </div>
                                                    <span className={`text-[10px] font-bold ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'}`}>
                                                        {capturedDocs.length === guidedDocuments.length ? 'All done!' : 'Documents captured'}
                                                    </span>
                                                </div>

                                                {/* Document checklist */}
                                                {capturedDocs.length < guidedDocuments.length ? (
                                                    <div className="space-y-2 relative">
                                                        {guidedDocuments.map((doc) => {
                                                            const isCaptured = capturedDocs.includes(doc.id);
                                                            const isCapturing = capturingDoc === doc.id;
                                                            return (
                                                                <motion.button
                                                                    key={doc.id}
                                                                    onClick={() => !isCaptured && !isCapturing && handleCaptureDoc(doc.id, doc.label)}
                                                                    disabled={isCaptured || !!capturingDoc}
                                                                    className={`w-full flex items-center gap-3 p-3 md:p-4 rounded-xl border text-left transition-all ${
                                                                        isCaptured
                                                                            ? theme === 'dark' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-emerald-500/30 bg-emerald-50'
                                                                            : isCapturing
                                                                            ? theme === 'dark' ? 'border-cyan-500/50 bg-cyan-500/10 ring-1 ring-cyan-500/30' : 'border-cyan-500/50 bg-cyan-50 ring-1 ring-cyan-500/30'
                                                                            : theme === 'dark' ? 'border-white/10 bg-white/[0.02] hover:border-cyan-500/30 hover:bg-cyan-500/5' : 'border-slate-200 bg-white hover:border-cyan-500/30 hover:bg-cyan-50'
                                                                    } ${capturingDoc && !isCapturing ? 'opacity-40 pointer-events-none' : ''}`}
                                                                    layout
                                                                >
                                                                    {/* Status icon */}
                                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                                                        isCaptured ? 'bg-emerald-500/20' :
                                                                        isCapturing ? 'bg-cyan-500/20' :
                                                                        theme === 'dark' ? 'bg-white/5' : 'bg-slate-100'
                                                                    }`}>
                                                                        {isCaptured ? (
                                                                            <CheckCircle size={18} className="text-emerald-500" />
                                                                        ) : isCapturing ? (
                                                                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                                                                                <Camera size={18} className="text-cyan-500" />
                                                                            </motion.div>
                                                                        ) : (
                                                                            <Camera size={18} className={theme === 'dark' ? 'text-white/30' : 'text-slate-400'} />
                                                                        )}
                                                                    </div>
                                                                    {/* Doc info */}
                                                                    <div className="flex-1 min-w-0">
                                                                        <span className={`text-sm font-bold block ${
                                                                            isCaptured ? 'text-emerald-500' :
                                                                            isCapturing ? 'text-cyan-500' :
                                                                            theme === 'dark' ? 'text-white/80' : 'text-slate-700'
                                                                        }`}>{doc.label}</span>
                                                                        <span className={`text-[10px] md:text-xs ${
                                                                            isCaptured ? 'text-emerald-500/50' :
                                                                            theme === 'dark' ? 'text-white/30' : 'text-slate-400'
                                                                        }`}>
                                                                            {isCaptured ? 'Captured & encrypted' : isCapturing ? 'Scanning...' : doc.description}
                                                                        </span>
                                                                    </div>
                                                                    {/* Action hint */}
                                                                    {!isCaptured && !isCapturing && (
                                                                        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold ${
                                                                            theme === 'dark' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-cyan-50 text-cyan-600'
                                                                        }`}>
                                                                            <Camera size={10} />
                                                                            Tap
                                                                        </div>
                                                                    )}
                                                                </motion.button>
                                                            );
                                                        })}

                                                        {/* Camera viewfinder overlay */}
                                                        <AnimatePresence>
                                                            {capturingDoc && (
                                                                <motion.div
                                                                    initial={{ opacity: 0 }}
                                                                    animate={{ opacity: 1 }}
                                                                    exit={{ opacity: 0 }}
                                                                    className="absolute inset-0 -m-6 md:-m-10 bg-black/95 rounded-[1.5rem] md:rounded-[3rem] z-20 flex flex-col items-center justify-center"
                                                                >
                                                                    {captureStep === 'camera' && (
                                                                        <motion.div
                                                                            initial={{ scale: 0.8, opacity: 0 }}
                                                                            animate={{ scale: 1, opacity: 1 }}
                                                                            className="flex flex-col items-center gap-4"
                                                                        >
                                                                            {/* Viewfinder frame */}
                                                                            <div className="relative w-[200px] h-[260px] border-2 border-white/20 rounded-xl">
                                                                                {/* Corner brackets */}
                                                                                <div className="absolute -top-[2px] -left-[2px] w-6 h-6 border-t-2 border-l-2 border-cyan-400 rounded-tl-lg" />
                                                                                <div className="absolute -top-[2px] -right-[2px] w-6 h-6 border-t-2 border-r-2 border-cyan-400 rounded-tr-lg" />
                                                                                <div className="absolute -bottom-[2px] -left-[2px] w-6 h-6 border-b-2 border-l-2 border-cyan-400 rounded-bl-lg" />
                                                                                <div className="absolute -bottom-[2px] -right-[2px] w-6 h-6 border-b-2 border-r-2 border-cyan-400 rounded-br-lg" />
                                                                                {/* Mock document in frame */}
                                                                                <div className="absolute inset-4 rounded-lg bg-white/5 border border-white/10 flex flex-col items-center justify-center gap-2">
                                                                                    <FileText size={32} className="text-white/20" />
                                                                                    <span className="text-white/30 text-[10px] font-bold">{guidedDocuments.find(d => d.id === capturingDoc)?.label}</span>
                                                                                </div>
                                                                            </div>
                                                                            <motion.p
                                                                                animate={{ opacity: [0.4, 1, 0.4] }}
                                                                                transition={{ duration: 1.5, repeat: Infinity }}
                                                                                className="text-white/60 text-sm font-semibold"
                                                                            >
                                                                                Point camera at document...
                                                                            </motion.p>
                                                                        </motion.div>
                                                                    )}

                                                                    {captureStep === 'scanning' && (
                                                                        <motion.div
                                                                            initial={{ opacity: 0 }}
                                                                            animate={{ opacity: 1 }}
                                                                            className="flex flex-col items-center gap-4"
                                                                        >
                                                                            <div className="relative w-[200px] h-[260px] border-2 border-cyan-500/40 rounded-xl overflow-hidden">
                                                                                {/* Document captured image */}
                                                                                <div className="absolute inset-2 rounded-lg bg-white/10 flex flex-col items-center justify-center gap-2">
                                                                                    <FileText size={32} className="text-white/30" />
                                                                                    <span className="text-white/40 text-[10px] font-bold">{guidedDocuments.find(d => d.id === capturingDoc)?.label}</span>
                                                                                </div>
                                                                                {/* Scanning line */}
                                                                                <motion.div
                                                                                    className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent"
                                                                                    initial={{ top: 0 }}
                                                                                    animate={{ top: ['0%', '100%', '0%'] }}
                                                                                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                                                                                />
                                                                            </div>
                                                                            <div className="flex items-center gap-2">
                                                                                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                                                                                    <Zap size={14} className="text-cyan-400" />
                                                                                </motion.div>
                                                                                <span className="text-cyan-400 text-sm font-bold">AI scanning document...</span>
                                                                            </div>
                                                                        </motion.div>
                                                                    )}

                                                                    {captureStep === 'detected' && (
                                                                        <motion.div
                                                                            initial={{ scale: 0.8, opacity: 0 }}
                                                                            animate={{ scale: 1, opacity: 1 }}
                                                                            className="flex flex-col items-center gap-4"
                                                                        >
                                                                            <motion.div
                                                                                initial={{ scale: 0 }}
                                                                                animate={{ scale: 1 }}
                                                                                transition={{ type: "spring", stiffness: 200 }}
                                                                                className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center"
                                                                            >
                                                                                <CheckCircle size={40} className="text-emerald-500" />
                                                                            </motion.div>
                                                                            <div className="text-center">
                                                                                <p className="text-white text-lg font-bold mb-1">
                                                                                    {guidedDocuments.find(d => d.id === capturingDoc)?.label} Detected!
                                                                                </p>
                                                                                <p className="text-emerald-400 text-xs font-semibold">
                                                                                    Encrypted & uploaded securely
                                                                                </p>
                                                                            </div>
                                                                        </motion.div>
                                                                    )}
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>
                                                ) : (
                                                    /* All documents captured - success */
                                                    <motion.div
                                                        initial={{ opacity: 0, scale: 0.95 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        className="text-center py-6"
                                                    >
                                                        <motion.div
                                                            initial={{ scale: 0 }}
                                                            animate={{ scale: 1 }}
                                                            transition={{ type: "spring", stiffness: 200 }}
                                                            className="w-16 h-16 rounded-full mx-auto mb-4 bg-emerald-500/20 flex items-center justify-center"
                                                        >
                                                            <CheckCircle size={32} className="text-emerald-500" />
                                                        </motion.div>
                                                        <p className={`text-lg font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                                                            All Documents Received!
                                                        </p>
                                                        <p className={`text-sm mb-1 ${theme === 'dark' ? 'text-white/60' : 'text-slate-600'}`}>
                                                            {guidedDocuments.length} documents captured, encrypted & delivered
                                                        </p>
                                                        <p className={`text-xs mb-6 ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'}`}>
                                                            Your CPA has been notified. You're all set for tax season.
                                                        </p>
                                                        <button
                                                            onClick={() => setDemoView('admin')}
                                                            className="inline-flex items-center gap-2 text-emerald-500 font-bold text-xs uppercase tracking-widest hover:text-emerald-400 transition-colors"
                                                        >
                                                            <Eye size={14} />
                                                            View CPA Dashboard
                                                        </button>
                                                    </motion.div>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                {/* Standard mode welcome */}
                                                <p className={`text-sm md:text-base mb-6 ${theme === 'dark' ? 'text-white/70' : 'text-slate-600'}`}>
                                                    Welcome, <span className="font-bold">Sarah</span>. Upload your tax documents securely below.
                                                </p>

                                                {/* Upload area */}
                                                {uploadState === 'idle' && (
                                                    <div>
                                                        {/* Drag and drop zone */}
                                                        <div
                                                            className={`rounded-2xl border-2 border-dashed p-8 md:p-12 text-center mb-6 transition-colors ${theme === 'dark'
                                                                ? 'border-white/10 bg-white/[0.02] hover:border-cyan-500/30 hover:bg-cyan-500/[0.03]'
                                                                : 'border-slate-200 bg-slate-50 hover:border-cyan-500/40 hover:bg-cyan-50'
                                                                }`}
                                                        >
                                                            <Upload size={32} className={`mx-auto mb-3 ${theme === 'dark' ? 'text-white/20' : 'text-slate-300'}`} />
                                                            <p className={`text-sm font-semibold mb-1 ${theme === 'dark' ? 'text-white/50' : 'text-slate-500'}`}>
                                                                Drag and drop files here
                                                            </p>
                                                            <p className={`text-xs ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>
                                                                PDF, JPG, PNG, XLSX up to 25MB
                                                            </p>
                                                        </div>

                                                        {/* File type pills */}
                                                        <p className={`text-xs font-bold mb-3 ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'}`}>
                                                            Or click a document type to simulate upload:
                                                        </p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {fileTypes.map((file) => (
                                                                <button
                                                                    key={file.name}
                                                                    onClick={() => handleFileUpload(file.name, 'PDF')}
                                                                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] ${theme === 'dark'
                                                                        ? 'bg-white/5 border border-white/10 text-white/70 hover:border-cyan-500/30 hover:bg-cyan-500/5'
                                                                        : 'bg-slate-50 border border-slate-200 text-slate-600 hover:border-cyan-500/40 hover:bg-cyan-50'
                                                                        }`}
                                                                >
                                                                    <FileText size={14} className="text-cyan-500" />
                                                                    {file.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Uploading state */}
                                                {uploadState === 'uploading' && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        className="text-center py-8"
                                                    >
                                                        <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center ${theme === 'dark' ? 'bg-cyan-500/10' : 'bg-cyan-50'}`}>
                                                            <motion.div
                                                                animate={{ rotate: 360 }}
                                                                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                                            >
                                                                <Upload size={24} className="text-cyan-500" />
                                                            </motion.div>
                                                        </div>
                                                        <p className={`text-sm font-semibold mb-2 ${theme === 'dark' ? 'text-white/70' : 'text-slate-700'}`}>
                                                            Encrypting & uploading...
                                                        </p>
                                                        <p className={`text-xs mb-4 ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'}`}>
                                                            {uploadingFileName}
                                                        </p>
                                                        <div className={`w-full max-w-xs mx-auto h-2 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-200'}`}>
                                                            <motion.div
                                                                className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full"
                                                                style={{ width: `${uploadProgress}%` }}
                                                            />
                                                        </div>
                                                        <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>
                                                            {uploadProgress}%
                                                        </p>
                                                    </motion.div>
                                                )}

                                                {/* Success state */}
                                                {uploadState === 'success' && (
                                                    <motion.div
                                                        initial={{ opacity: 0, scale: 0.95 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        className="text-center py-8"
                                                    >
                                                        <motion.div
                                                            initial={{ scale: 0 }}
                                                            animate={{ scale: 1 }}
                                                            transition={{ type: "spring", stiffness: 200 }}
                                                            className="w-16 h-16 rounded-full mx-auto mb-4 bg-emerald-500/20 flex items-center justify-center"
                                                        >
                                                            <CheckCircle size={32} className="text-emerald-500" />
                                                        </motion.div>
                                                        <p className={`text-lg font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                                                            Document Received!
                                                        </p>
                                                        <p className={`text-sm mb-1 ${theme === 'dark' ? 'text-white/60' : 'text-slate-600'}`}>
                                                            {uploadingFileName}
                                                        </p>
                                                        <p className={`text-xs mb-6 ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'}`}>
                                                            Your CPA has been notified and can access this document securely.
                                                        </p>
                                                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                                                            <button
                                                                onClick={resetUpload}
                                                                className="inline-flex items-center gap-2 text-cyan-500 font-bold text-xs uppercase tracking-widest hover:text-cyan-400 transition-colors"
                                                            >
                                                                <RotateCcw size={14} />
                                                                Upload Another
                                                            </button>
                                                            <button
                                                                onClick={() => setDemoView('admin')}
                                                                className="inline-flex items-center gap-2 text-emerald-500 font-bold text-xs uppercase tracking-widest hover:text-emerald-400 transition-colors"
                                                            >
                                                                <Eye size={14} />
                                                                View CPA Dashboard
                                                            </button>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </>
                                        )}
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="admin"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        transition={{ duration: 0.4 }}
                                        className="relative z-10"
                                    >
                                        {/* Admin header */}
                                        <div className={`flex items-center justify-between mb-6 pb-4 border-b ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                                                    <Shield size={18} className="text-white" />
                                                </div>
                                                <div>
                                                    <span className={`text-sm md:text-base font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Document Dashboard</span>
                                                    <span className={`text-[10px] md:text-xs block ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'}`}>Summit Tax Group</span>
                                                </div>
                                            </div>
                                            <div className="relative">
                                                <Bell size={20} className={theme === 'dark' ? 'text-white/40' : 'text-slate-400'} />
                                                {newUploadAlert && (
                                                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                                                )}
                                            </div>
                                        </div>

                                        {/* Tab bar: Documents | Forms Library */}
                                        <div className={`flex gap-1 mb-6 p-1 rounded-xl ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-100'}`}>
                                            {(['documents', 'forms'] as const).map(tab => (
                                                <button
                                                    key={tab}
                                                    onClick={() => { setAdminTab(tab); setSelectedForm(null); }}
                                                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                                                        adminTab === tab
                                                            ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/20'
                                                            : theme === 'dark' ? 'text-white/40 hover:text-white/60' : 'text-slate-500 hover:text-slate-700'
                                                    }`}
                                                >
                                                    {tab === 'documents' ? <><FileText size={12} /> Documents</> : <><PenLine size={12} /> Forms Library</>}
                                                    {tab === 'forms' && <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${adminTab === 'forms' ? 'bg-white/20' : theme === 'dark' ? 'bg-white/10' : 'bg-slate-200'}`}>{allForms.length}</span>}
                                                </button>
                                            ))}
                                        </div>

                                        {adminTab === 'documents' ? (
                                        <>
                                        {/* Stats row */}
                                        <div className="grid grid-cols-3 gap-3 mb-6">
                                            {[
                                                { label: 'Total Uploads', value: 24 + uploadedFiles.length, color: 'cyan' },
                                                { label: 'Pending Review', value: 3 + uploadedFiles.filter(f => f.status === 'New').length, color: 'amber' },
                                                { label: 'This Month', value: 12 + uploadedFiles.length, color: 'emerald' },
                                            ].map((stat, i) => (
                                                <div
                                                    key={i}
                                                    className={`rounded-xl p-3 md:p-4 border ${theme === 'dark'
                                                        ? 'bg-white/[0.03] border-white/10'
                                                        : 'bg-slate-50 border-slate-200'
                                                        }`}
                                                >
                                                    <span className={`text-xl md:text-2xl font-black text-${stat.color}-500`}>{stat.value}</span>
                                                    <span className={`text-[9px] md:text-xs block font-semibold ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'}`}>{stat.label}</span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* File table */}
                                        <div className={`rounded-xl border overflow-hidden ${theme === 'dark' ? 'border-white/10' : 'border-slate-200'}`}>
                                            {/* Table header */}
                                            <div className={`grid grid-cols-12 gap-2 px-4 py-2.5 text-[9px] md:text-xs font-bold tracking-wider uppercase ${theme === 'dark' ? 'bg-white/5 text-white/40' : 'bg-slate-50 text-slate-500'}`}>
                                                <span className="col-span-3">Client</span>
                                                <span className="col-span-4">Document</span>
                                                <span className="col-span-2 hidden sm:block">Date</span>
                                                <span className="col-span-2 sm:col-span-1">Status</span>
                                                <span className="col-span-2 text-right">Actions</span>
                                            </div>
                                            {/* Table rows */}
                                            {allDashboardFiles.slice(0, 5).map((file, i) => (
                                                <motion.div
                                                    key={file.id}
                                                    initial={file.date === 'Just now' ? { opacity: 0, x: -10, backgroundColor: 'rgba(6, 182, 212, 0.1)' } : {}}
                                                    animate={{ opacity: 1, x: 0, backgroundColor: 'transparent' }}
                                                    transition={{ duration: 0.5 }}
                                                    className={`grid grid-cols-12 gap-2 px-4 py-3 items-center text-xs md:text-sm border-t ${file.date === 'Just now' ? (theme === 'dark' ? 'border-l-2 border-l-cyan-500 border-t-white/5' : 'border-l-2 border-l-cyan-500 border-t-slate-100') : (theme === 'dark' ? 'border-t-white/5' : 'border-t-slate-100')}`}
                                                >
                                                    <span className={`col-span-3 font-semibold truncate ${theme === 'dark' ? 'text-white/70' : 'text-slate-700'}`}>{file.client}</span>
                                                    <span className={`col-span-4 truncate flex items-center gap-1.5 ${theme === 'dark' ? 'text-white/50' : 'text-slate-600'}`}>
                                                        <FileText size={12} className="text-cyan-500 shrink-0" />
                                                        {file.name}
                                                    </span>
                                                    <span className={`col-span-2 hidden sm:block ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>{file.date}</span>
                                                    <span className="col-span-2 sm:col-span-1">
                                                        <span className={`px-1.5 py-0.5 rounded-full text-[8px] md:text-[10px] font-bold ${file.status === 'New' ? 'bg-cyan-500/20 text-cyan-400' :
                                                                file.status === 'Reviewed' ? 'bg-emerald-500/20 text-emerald-400' :
                                                                    'bg-white/10 text-white/40'
                                                            }`}>
                                                            {file.status}
                                                        </span>
                                                    </span>
                                                    <div className="col-span-2 flex items-center justify-end gap-2">
                                                        <button className={`p-1.5 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-white/10 text-white/30 hover:text-white/60' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'}`}>
                                                            <Eye size={14} />
                                                        </button>
                                                        <button className={`p-1.5 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-white/10 text-white/30 hover:text-white/60' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'}`}>
                                                            <Download size={14} />
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>

                                        {/* Audit log */}
                                        <div className="mt-6">
                                            <p className={`text-xs font-bold mb-3 ${theme === 'dark' ? 'text-white/40' : 'text-slate-500'}`}>
                                                Recent Activity
                                            </p>
                                            <div className="space-y-2">
                                                {[
                                                    ...(uploadedFiles.length > 0 ? [
                                                        { text: `Sarah M. uploaded ${uploadedFiles[0].name}`, time: 'Just now', type: 'upload' as const },
                                                        { text: `Document encrypted with AES-256`, time: 'Just now', type: 'system' as const },
                                                        { text: `CPA notified via email`, time: 'Just now', type: 'notify' as const },
                                                    ] : []),
                                                    { text: 'James K. uploaded 1099-INT_Fidelity.pdf', time: '1h ago', type: 'upload' as const },
                                                    { text: 'Lisa P. uploaded Bank_Statement_Jan.pdf', time: '2h ago', type: 'upload' as const },
                                                ].slice(0, 4).map((entry, i) => (
                                                    <motion.div
                                                        key={i}
                                                        initial={entry.time === 'Just now' ? { opacity: 0, x: -10 } : {}}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: i * 0.1 }}
                                                        className={`flex items-center gap-2 text-[10px] md:text-xs ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}
                                                    >
                                                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${entry.type === 'upload' ? 'bg-cyan-500' :
                                                                entry.type === 'system' ? 'bg-emerald-500' : 'bg-blue-500'
                                                            }`} />
                                                        <span className="flex-1">{entry.text}</span>
                                                        <span className={theme === 'dark' ? 'text-white/20' : 'text-slate-300'}>{entry.time}</span>
                                                    </motion.div>
                                                ))}
                                            </div>
                                        </div>
                                        </>
                                        ) : selectedForm && formView === 'preview' ? (
                                        /* ── Form Preview View — IRS-Authentic Templates (always light) ── */
                                        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} key="form-preview" className="bg-white rounded-2xl p-5 -mx-2 border border-slate-200">
                                            {/* Back to edit */}
                                            <button
                                                onClick={() => setFormView('edit')}
                                                className="flex items-center gap-1.5 text-xs font-bold mb-4 transition-colors text-slate-400 hover:text-slate-600"
                                            >
                                                <ChevronRight size={14} className="rotate-180" />
                                                Back to Edit
                                            </button>

                                            {/* Polished IRS-authentic form preview */}
                                            <div ref={formPreviewRef} className="max-h-[520px] overflow-y-auto rounded-xl" style={{ scrollbarWidth: 'thin' }}>
                                                <FormPreview form={selectedForm} data={formData} />
                                            </div>

                                            {/* Action bar below preview */}
                                            <div className="mt-4 flex items-center gap-2">
                                                <button
                                                    onClick={() => setFormView('edit')}
                                                    className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all hover:scale-[1.01]"
                                                >
                                                    <PenLine size={12} />
                                                    Edit
                                                </button>
                                                <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-cyan-600 text-white text-xs font-bold hover:bg-cyan-500 transition-all hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-cyan-500/20">
                                                    <Send size={12} />
                                                    Send to Client for Signature
                                                </button>
                                                <button
                                                    onClick={handlePrintOrDownload}
                                                    className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all hover:scale-[1.01]"
                                                >
                                                    <Printer size={12} />
                                                </button>
                                                <button
                                                    onClick={handlePrintOrDownload}
                                                    className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all hover:scale-[1.01]"
                                                >
                                                    <Download size={12} />
                                                </button>
                                            </div>
                                        </motion.div>

                                        ) : selectedForm ? (
                                        /* ── Form Detail / Fill View (always light) ── */
                                        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} key="form-edit" className="bg-white rounded-2xl p-5 -mx-2 border border-slate-200">
                                            {/* Back button + form header */}
                                            <button
                                                onClick={() => setSelectedForm(null)}
                                                className="flex items-center gap-1.5 text-xs font-bold mb-4 transition-colors text-slate-400 hover:text-slate-600"
                                            >
                                                <ChevronRight size={14} className="rotate-180" />
                                                Back to Forms
                                            </button>

                                            <div className="rounded-xl border p-4 mb-4 bg-cyan-50 border-cyan-200">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <span className="text-cyan-600 text-xs font-black tracking-wider">{selectedForm.number}</span>
                                                        <h4 className="text-sm font-bold leading-tight mt-0.5 text-slate-900">{selectedForm.name}</h4>
                                                        <p className="text-[10px] mt-1 text-slate-500">{selectedForm.description}</p>
                                                        {selectedForm.state && <span className="inline-block mt-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-600">{selectedForm.state}</span>}
                                                    </div>
                                                    <div className="flex gap-1.5 shrink-0">
                                                        <button className="p-2 rounded-lg transition-colors bg-white hover:bg-slate-50 text-slate-500" title="Print">
                                                            <Printer size={14} />
                                                        </button>
                                                        <button className="p-2 rounded-lg transition-colors bg-white hover:bg-slate-50 text-slate-500" title="Save">
                                                            <Save size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Fillable form fields */}
                                            <div className="max-h-[320px] overflow-y-auto pr-1 space-y-4" style={{ scrollbarWidth: 'thin' }}>
                                                {(() => {
                                                    const fields = getFormFields(selectedForm);
                                                    const sections = [...new Set(fields.map(f => f.section))];
                                                    return sections.map(section => (
                                                        <div key={section}>
                                                            <p className="text-[9px] font-black tracking-[0.15em] uppercase mb-2 text-cyan-600">{section}</p>
                                                            <div className="space-y-2">
                                                                {fields.filter(f => f.section === section).map(field => (
                                                                    <div key={field.id}>
                                                                        <label className="text-[10px] font-semibold block mb-1 text-slate-600">{field.label}</label>
                                                                        {field.type === 'select' ? (
                                                                            <select
                                                                                value={formData[field.id] || ''}
                                                                                onChange={e => handleFormFieldChange(field.id, e.target.value)}
                                                                                className="w-full text-xs px-3 py-2 rounded-lg border outline-none transition-colors bg-white border-slate-200 text-slate-700 focus:border-cyan-500"
                                                                            >
                                                                                <option value="">Select...</option>
                                                                                {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                                            </select>
                                                                        ) : (
                                                                            <input
                                                                                type="text"
                                                                                value={formData[field.id] || ''}
                                                                                onChange={e => handleFormFieldChange(field.id, e.target.value)}
                                                                                placeholder={field.placeholder}
                                                                                className="w-full text-xs px-3 py-2 rounded-lg border outline-none transition-colors bg-white border-slate-200 text-slate-700 placeholder-slate-300 focus:border-cyan-500"
                                                                            />
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ));
                                                })()}
                                            </div>

                                            {/* Submit bar */}
                                            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center gap-2">
                                                <button
                                                    onClick={() => setFormView('preview')}
                                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-cyan-600 text-white text-xs font-bold hover:bg-cyan-500 transition-all hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-cyan-500/20"
                                                >
                                                    <Eye size={12} />
                                                    Preview Form
                                                </button>
                                                <button className="py-2.5 px-4 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all hover:scale-[1.01]">
                                                    <Download size={12} />
                                                </button>
                                            </div>
                                        </motion.div>
                                        ) : (
                                        /* ── Forms Library Browser with Sidebar Filters ── */
                                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                            {/* Search bar */}
                                            <div className="relative mb-4">
                                                <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`} />
                                                <input
                                                    type="text"
                                                    value={formSearch}
                                                    onChange={e => setFormSearch(e.target.value)}
                                                    placeholder="Search forms by number or name..."
                                                    className={`w-full text-xs pl-9 pr-8 py-2.5 rounded-xl border outline-none transition-colors ${
                                                        theme === 'dark'
                                                            ? 'bg-white/5 border-white/10 text-white/70 placeholder-white/20 focus:border-cyan-500/50'
                                                            : 'bg-white border-slate-200 text-slate-700 placeholder-slate-400 focus:border-cyan-500'
                                                    }`}
                                                />
                                                {formSearch && (
                                                    <button onClick={() => setFormSearch('')} className={`absolute right-3 top-1/2 -translate-y-1/2 ${theme === 'dark' ? 'text-white/30 hover:text-white/60' : 'text-slate-400 hover:text-slate-600'}`}>
                                                        <X size={14} />
                                                    </button>
                                                )}
                                            </div>

                                            {/* Sidebar + Results layout */}
                                            <div className="flex gap-3">
                                                {/* ── Left Sidebar Filters ── */}
                                                <div className={`w-[140px] shrink-0 rounded-xl border p-3 space-y-4 ${
                                                    theme === 'dark' ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-slate-50'
                                                }`}>
                                                    {/* Federal / State toggle */}
                                                    <div>
                                                        <p className={`text-[9px] font-black uppercase tracking-wider mb-2 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Scope</p>
                                                        <div className="space-y-1">
                                                            {(['federal', 'state'] as const).map(scope => (
                                                                <button
                                                                    key={scope}
                                                                    onClick={() => { setFormScope(scope); setFormCategory('All'); setFormState('All'); }}
                                                                    className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                                                                        formScope === scope
                                                                            ? 'bg-cyan-600 text-white'
                                                                            : theme === 'dark' ? 'text-white/50 hover:bg-white/5' : 'text-slate-600 hover:bg-slate-100'
                                                                    }`}
                                                                >
                                                                    <span className={`w-2 h-2 rounded-full shrink-0 ${formScope === scope ? 'bg-white' : theme === 'dark' ? 'bg-white/20' : 'bg-slate-300'}`} />
                                                                    {scope === 'federal' ? 'Federal (IRS)' : 'State Forms'}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* State dropdown (only when state scope) */}
                                                    {formScope === 'state' && (
                                                        <div>
                                                            <p className={`text-[9px] font-black uppercase tracking-wider mb-2 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>State</p>
                                                            <select
                                                                value={formState}
                                                                onChange={e => setFormState(e.target.value)}
                                                                className={`w-full text-[10px] px-2 py-1.5 rounded-lg border outline-none ${
                                                                    theme === 'dark'
                                                                        ? 'bg-white/5 border-white/10 text-white/70'
                                                                        : 'bg-white border-slate-200 text-slate-700'
                                                                }`}
                                                            >
                                                                <option value="All">All States</option>
                                                                {allStates.map(st => <option key={st} value={st}>{st}</option>)}
                                                            </select>
                                                        </div>
                                                    )}

                                                    {/* Category filters (only for federal scope) */}
                                                    {formScope === 'federal' && (
                                                        <div>
                                                            <p className={`text-[9px] font-black uppercase tracking-wider mb-2 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>Category</p>
                                                            <div className="space-y-0.5 max-h-[200px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                                                                <button
                                                                    onClick={() => setFormCategory('All')}
                                                                    className={`w-full text-left px-2 py-1 rounded-md text-[9px] font-bold transition-all ${
                                                                        formCategory === 'All'
                                                                            ? theme === 'dark' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-cyan-50 text-cyan-700'
                                                                            : theme === 'dark' ? 'text-white/40 hover:text-white/60 hover:bg-white/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                                                                    }`}
                                                                >All Categories</button>
                                                                {visibleCategories.map(cat => (
                                                                    <button
                                                                        key={cat}
                                                                        onClick={() => setFormCategory(cat)}
                                                                        className={`w-full text-left px-2 py-1 rounded-md text-[9px] font-bold transition-all truncate ${
                                                                            formCategory === cat
                                                                                ? theme === 'dark' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-cyan-50 text-cyan-700'
                                                                                : theme === 'dark' ? 'text-white/40 hover:text-white/60 hover:bg-white/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                                                                        }`}
                                                                    >{cat}</button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* ── Right: Form Results ── */}
                                                <div className="flex-1 min-w-0">
                                                    {/* Results count */}
                                                    <p className={`text-[9px] font-bold mb-2 ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>
                                                        {filteredForms.length} form{filteredForms.length !== 1 ? 's' : ''} found
                                                    </p>

                                                    {/* Form cards list */}
                                                    <div className="max-h-[320px] overflow-y-auto space-y-1.5 pr-1" style={{ scrollbarWidth: 'thin' }}>
                                                        {filteredForms.slice(0, 50).map(form => (
                                                            <button
                                                                key={form.id}
                                                                onClick={() => handleSelectForm(form)}
                                                                className={`w-full text-left flex items-center gap-3 p-2.5 rounded-xl border transition-all hover:scale-[1.005] ${
                                                                    theme === 'dark'
                                                                        ? 'border-white/5 bg-white/[0.02] hover:border-cyan-500/30 hover:bg-cyan-500/5'
                                                                        : 'border-slate-100 bg-white hover:border-cyan-500/30 hover:bg-cyan-50'
                                                                }`}
                                                            >
                                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                                                                    theme === 'dark' ? 'bg-cyan-500/10' : 'bg-cyan-50'
                                                                }`}>
                                                                    <span className="text-cyan-500 text-[8px] font-black leading-tight text-center">{form.number.length > 8 ? form.number.substring(0, 8) : form.number}</span>
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <span className={`text-[11px] font-bold block truncate ${theme === 'dark' ? 'text-white/80' : 'text-slate-700'}`}>{form.name}</span>
                                                                    <span className={`text-[9px] block truncate ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>
                                                                        {form.state ? `${form.state} · ` : ''}{form.description}
                                                                    </span>
                                                                </div>
                                                                <ChevronRight size={14} className={theme === 'dark' ? 'text-white/20 shrink-0' : 'text-slate-300 shrink-0'} />
                                                            </button>
                                                        ))}
                                                        {filteredForms.length > 50 && (
                                                            <p className={`text-center text-[9px] py-2 ${theme === 'dark' ? 'text-white/20' : 'text-slate-400'}`}>
                                                                Showing 50 of {filteredForms.length} — refine your search to see more
                                                            </p>
                                                        )}
                                                        {filteredForms.length === 0 && (
                                                            <div className="text-center py-8">
                                                                <Search size={24} className={theme === 'dark' ? 'text-white/10 mx-auto mb-2' : 'text-slate-200 mx-auto mb-2'} />
                                                                <p className={`text-xs ${theme === 'dark' ? 'text-white/30' : 'text-slate-400'}`}>No forms match your search</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
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
                        <div className="inline-flex items-center gap-2 mb-4 md:mb-6 px-3 py-1 md:px-4 md:py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20">
                            <Zap size={14} className="text-cyan-400" />
                            <span className="text-cyan-400 text-[9px] md:text-xs font-black tracking-[0.2em] uppercase">How It Works</span>
                        </div>
                        <h2 className="text-2xl md:text-5xl font-bold text-[var(--text-main)] mb-4">
                            Four Steps to <span className="text-cyan-500">Secure Collection</span>
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
                                                {/* Step 1: Phone with secure link */}
                                                {i === 0 && (
                                                    <div className="relative">
                                                        <div className="w-[150px] h-[250px] rounded-[26px] border-2 border-white/20 bg-black/50 backdrop-blur p-3.5 relative">
                                                            <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-12 h-1.5 rounded-full bg-white/15" />
                                                            <div className="mt-6 space-y-2.5">
                                                                <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="rounded-xl bg-cyan-500/20 border border-cyan-500/30 p-2.5">
                                                                    <div className="flex items-center gap-1.5 mb-1">
                                                                        <Send size={10} className="text-cyan-400" />
                                                                        <span className="text-white/70 text-[9px] font-semibold">SMS</span>
                                                                    </div>
                                                                    <p className="text-white/40 text-[8px] leading-relaxed">Hi Sarah, please upload your tax docs here: summittax.com/upload</p>
                                                                </motion.div>
                                                                <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.5 }} className="rounded-xl bg-blue-500/20 border border-blue-500/30 p-2.5">
                                                                    <div className="flex items-center gap-1.5 mb-1">
                                                                        <Lock size={10} className="text-blue-400" />
                                                                        <span className="text-white/70 text-[9px] font-semibold">Secure Link</span>
                                                                    </div>
                                                                    <p className="text-white/40 text-[8px] leading-relaxed">No account needed. Just click and upload.</p>
                                                                </motion.div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Step 2: Browser with upload */}
                                                {i === 1 && (
                                                    <div className="relative">
                                                        <div className="w-[220px] rounded-xl border border-white/20 bg-black/50 backdrop-blur overflow-hidden">
                                                            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/10">
                                                                <div className="w-2 h-2 rounded-full bg-red-400/60" />
                                                                <div className="w-2 h-2 rounded-full bg-yellow-400/60" />
                                                                <div className="w-2 h-2 rounded-full bg-green-400/60" />
                                                                <div className="flex-1 mx-2 h-5 rounded-md bg-white/10 flex items-center px-2">
                                                                    <span className="text-white/30 text-[8px]">summittax.com/upload</span>
                                                                </div>
                                                            </div>
                                                            <div className="p-5 text-center">
                                                                <p className="text-white/60 text-[10px] mb-3 font-semibold">Drop files here</p>
                                                                <motion.div
                                                                    initial={{ opacity: 0 }}
                                                                    animate={{ opacity: 1 }}
                                                                    transition={{ delay: 0.3 }}
                                                                    className="border-2 border-dashed border-cyan-500/30 rounded-xl p-4 bg-cyan-500/5"
                                                                >
                                                                    <Upload size={20} className="text-cyan-400/60 mx-auto mb-2" />
                                                                    <p className="text-white/30 text-[8px]">W-2, 1099, Bank Statements</p>
                                                                </motion.div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Step 3: Lock with encryption */}
                                                {i === 2 && (
                                                    <div className="flex flex-col items-center gap-4">
                                                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }} className="relative">
                                                            <Lock size={52} className="text-emerald-400/80" />
                                                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5, type: "spring" }} className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30">
                                                                <CheckCircle size={12} className="text-white" />
                                                            </motion.div>
                                                        </motion.div>
                                                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 border border-emerald-500/30">
                                                            <span className="text-emerald-400 text-[11px] font-bold">AES-256 Encrypted</span>
                                                        </motion.div>
                                                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                                                            <FolderLock size={12} className="text-cyan-400" />
                                                            <span className="text-white/40 text-[9px] font-bold">Isolated Vault</span>
                                                        </motion.div>
                                                    </div>
                                                )}

                                                {/* Step 4: Notification bell */}
                                                {i === 3 && (
                                                    <div className="flex flex-col items-center gap-4">
                                                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.2 }} className="relative">
                                                            <Bell size={52} className="text-amber-400/80" />
                                                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5, type: "spring" }} className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-500/30">
                                                                <span className="text-white text-[10px] font-black">1</span>
                                                            </motion.div>
                                                        </motion.div>
                                                        <div className="w-[180px] rounded-xl border border-white/15 bg-white/5 backdrop-blur p-3.5">
                                                            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }} className="flex items-center gap-2 mb-2">
                                                                <div className="w-2 h-2 rounded-full bg-cyan-500" />
                                                                <span className="text-white/50 text-[9px]">Sarah M. uploaded W-2</span>
                                                            </motion.div>
                                                            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8 }} className="flex items-center gap-2 mb-2">
                                                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                                                <span className="text-white/50 text-[9px]">Encrypted & stored</span>
                                                            </motion.div>
                                                            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 1 }} className="w-full py-2 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center gap-1.5 mt-2">
                                                                <Download size={10} className="text-cyan-400" />
                                                                <span className="text-cyan-400 text-[9px] font-bold">Download Securely</span>
                                                            </motion.div>
                                                        </div>
                                                    </div>
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/* Bottom gradient */}
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

                                    {/* Expanded: Full content */}
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

                    {/* Mobile: Accordion */}
                    <p className="md:hidden text-center text-[var(--text-main)] text-sm mb-4 font-bold tracking-wide">Tap to expand</p>
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

                {/* ── SECTION 5: Security Features ── */}
                <motion.section
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    className="mb-24"
                >
                    <div className="text-center mb-12">
                        <h2 className="text-2xl md:text-5xl font-bold text-[var(--text-main)] mb-4">
                            Bank-Grade <span className="text-cyan-500">Security</span>
                        </h2>
                        <p className="text-[var(--text-muted)] max-w-2xl mx-auto text-sm md:text-lg">
                            Built to meet the strictest compliance requirements in financial services.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-5 max-w-6xl mx-auto">
                        {securityFeatures.map((item, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.1 + i * 0.05 }}
                                className={`p-3 md:p-6 rounded-xl md:rounded-3xl border backdrop-blur-xl transition-all hover:scale-[1.02] ${theme === 'dark' ? 'bg-white/[0.03] border-white/10 hover:border-white/20' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                            >
                                <div className={`w-8 h-8 md:w-12 md:h-12 mb-2 md:mb-4 rounded-lg md:rounded-xl flex items-center justify-center border ${theme === 'dark' ? item.iconDark : item.iconLight}`}>
                                    {item.icon}
                                </div>
                                <h3 className="text-[11px] md:text-base font-bold text-[var(--text-main)] mb-1 md:mb-2 leading-tight">{item.title}</h3>
                                <p className="text-[var(--text-muted)] text-[9px] md:text-xs leading-relaxed hidden sm:block">{item.description}</p>
                            </motion.div>
                        ))}
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
                        <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/10 to-transparent pointer-events-none" />
                        <div className="relative z-10">
                            <h2 className="text-xl md:text-5xl font-bold text-[var(--text-main)] mb-4 md:mb-8 tracking-tight leading-tight">
                                Add the Document Vault to Your <br className="hidden md:block" /><span className="text-cyan-500">Digital Rainmaker System</span>
                            </h2>
                            <p className="text-sm md:text-xl text-[var(--text-muted)] mb-6 md:mb-12 max-w-2xl mx-auto leading-relaxed font-medium">
                                Stop relying on email and third-party portals. Give your clients a secure, branded experience that builds trust and protects their most sensitive financial data.
                            </p>
                            <button
                                onClick={openBooking}
                                className="inline-flex items-center gap-2 md:gap-3 bg-cyan-600 text-white px-6 md:px-10 py-3 md:py-5 rounded-full text-sm md:text-lg font-bold hover:bg-cyan-500 hover:scale-105 transition-all shadow-xl shadow-cyan-600/25 active:scale-95 group"
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

export default DocumentPortal;
