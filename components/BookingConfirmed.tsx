'use client';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle, ChevronDown, Play, Send, Calendar,
  HelpCircle, Mail, Loader2, Volume2, Pause,
  Mic, Square, Type, AudioLines, ArrowRight,
  Sparkles, Video, ClipboardCheck, MessageSquare
} from 'lucide-react';
import Image from 'next/image';
import { useTheme } from './ThemeProvider';
import RainmakerDemo from './RainmakerDemo';

// ---------------------------------------------------------------------------
// Step Badge — matches section badge pattern from AI Automations
// ---------------------------------------------------------------------------
const StepBadge = ({ number, label }: { number: number; label: string }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    whileInView={{ opacity: 1, scale: 1 }}
    viewport={{ once: true }}
    className="flex items-center gap-3 mb-6 md:mb-8"
  >
    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-green-600 flex items-center justify-center text-white font-black text-sm md:text-base shadow-lg shadow-green-600/20">
      {number}
    </div>
    <span className="text-green-400 text-[10px] md:text-xs font-black tracking-[0.2em] uppercase">{label}</span>
  </motion.div>
);


// ---------------------------------------------------------------------------
// Voice Message Bubble — iMessage-style audio message
// ---------------------------------------------------------------------------
const VoiceMessageBubble: React.FC<{
  audioUrl: string;
  duration: number;
  align: 'left' | 'right';
  label?: string;
  audioRef?: React.RefObject<HTMLAudioElement | null>;
  isPlayingExternal?: boolean;
  onTogglePlay?: () => void;
}> = ({ audioUrl, duration, align, label, audioRef: externalAudioRef, isPlayingExternal, onTogglePlay }) => {
  const [internalPlaying, setInternalPlaying] = useState(false);
  const internalAudioRef = useRef<HTMLAudioElement | null>(null);

  const aRef = externalAudioRef || internalAudioRef;
  const playing = isPlayingExternal !== undefined ? isPlayingExternal : internalPlaying;

  const handleToggle = () => {
    if (onTogglePlay) {
      onTogglePlay();
      return;
    }
    if (!aRef.current) return;
    if (playing) {
      aRef.current.pause();
      setInternalPlaying(false);
    } else {
      aRef.current.play();
      setInternalPlaying(true);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isRight = align === 'right';

  return (
    <div className={`flex ${isRight ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`${
          isRight
            ? 'bg-green-600 rounded-2xl rounded-br-md shadow-lg shadow-green-600/20'
            : 'bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-2xl rounded-bl-md'
        } px-4 py-3 max-w-[85%]`}
      >
        {label && (
          <p className={`text-[10px] font-bold mb-1.5 ${isRight ? 'text-white/60' : 'text-[var(--text-muted)]'}`}>{label}</p>
        )}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleToggle}
            className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
              isRight
                ? 'bg-white/20 hover:bg-white/30'
                : 'bg-green-500/20 hover:bg-green-500/30'
            }`}
          >
            {playing ? (
              <Pause size={16} className={isRight ? 'text-white' : 'text-green-400'} />
            ) : (
              <Play size={16} className={`${isRight ? 'text-white' : 'text-green-400'} ml-0.5`} />
            )}
          </button>

          {/* Waveform bars */}
          <div className="flex items-center gap-[2px] h-8 flex-1">
            {Array.from({ length: 24 }).map((_, i) => {
              const h = 20 + Math.sin(i * 0.7) * 35 + Math.sin(i * 1.4) * 20 + Math.cos(i * 0.5) * 10;
              return (
                <div
                  key={i}
                  className={`w-[3px] rounded-full transition-all duration-200 ${
                    playing
                      ? isRight ? 'bg-white/90' : 'bg-green-400/90'
                      : isRight ? 'bg-white/40' : 'bg-green-400/40'
                  }`}
                  style={{
                    height: `${Math.max(15, h)}%`,
                    animationDelay: playing ? `${i * 50}ms` : undefined,
                  }}
                />
              );
            })}
          </div>

          <span className={`text-xs font-bold ml-1 flex-shrink-0 ${isRight ? 'text-white/70' : 'text-[var(--text-muted)]'}`}>
            {formatTime(duration)}
          </span>
        </div>
      </div>
      {!externalAudioRef && (
        <audio
          ref={internalAudioRef}
          src={audioUrl}
          onEnded={() => setInternalPlaying(false)}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Voice Recorder — records audio + hidden transcript, shows as voice message
// ---------------------------------------------------------------------------
interface VoiceRecorderProps {
  onTranscriptChange: (val: string) => void;
  onAudioReady: (url: string, duration: number) => void;
}

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onTranscriptChange, onAudioReady }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<any>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingDurationRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // MediaRecorder for actual audio capture
      const mediaRecorder = new MediaRecorder(stream);
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        onAudioReady(url, recordingDurationRef.current);
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();

      // SpeechRecognition in parallel for hidden transcript (sent to API)
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        let finalTranscript = '';
        recognition.onresult = (event: any) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              finalTranscript += (finalTranscript ? ' ' : '') + event.results[i][0].transcript;
            } else {
              interim += event.results[i][0].transcript;
            }
          }
          onTranscriptChange(finalTranscript + (interim ? ' ' + interim : ''));
        };
        recognition.onerror = () => {};
        recognitionRef.current = recognition;
        recognition.start();
      }

      setIsRecording(true);
      setAudioUrl(null);
      recordingDurationRef.current = 0;
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        recordingDurationRef.current += 1;
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch {
      alert('Could not access microphone. Please check your browser permissions.');
    }
  }, [onTranscriptChange, onAudioReady]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
    if (recognitionRef.current) recognitionRef.current.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
  }, []);

  const reRecord = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setRecordingTime(0);
    onTranscriptChange('');
    onAudioReady('', 0);
  }, [audioUrl, onTranscriptChange, onAudioReady]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) recognitionRef.current.abort();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-green-500/5 border border-green-500/10 p-3 md:p-5">
        <div className="flex items-start gap-2.5 mb-3">
          <Mic size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-[var(--text-main)] mb-0.5">Record your answers</p>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Hit record and answer all three questions in one go. Speak naturally.
            </p>
          </div>
        </div>

        <div className="bg-[var(--glass-border)] rounded-lg p-3 mb-4">
          <p className="text-[10px] font-black text-[var(--text-muted)] opacity-50 uppercase tracking-[0.2em] mb-2">Questions to answer</p>
          <ol className="space-y-1.5 text-sm text-[var(--text-main)] list-decimal list-inside leading-relaxed">
            <li>What&apos;s your biggest operational challenge right now?</li>
            <li>What outcome would make this investment a no-brainer for you?</li>
            <li>What have you tried before to fix this, and why didn&apos;t it work?</li>
          </ol>
        </div>

        {!audioUrl ? (
          <div className="flex flex-col items-center gap-2">
            {!isRecording ? (
              <button
                type="button"
                onClick={startRecording}
                className="group relative w-20 h-20 md:w-24 md:h-24 rounded-full bg-red-500/10 border-2 border-red-500/30 hover:border-red-500/50 hover:bg-red-500/20 transition-all flex items-center justify-center shadow-xl shadow-red-500/10 hover:shadow-red-500/20"
              >
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-red-500 group-hover:bg-red-400 transition-colors flex items-center justify-center shadow-lg">
                  <Mic size={24} className="text-white" />
                </div>
              </button>
            ) : (
              <button
                type="button"
                onClick={stopRecording}
                className="relative w-20 h-20 md:w-24 md:h-24 rounded-full bg-red-500/20 border-2 border-red-500/40 transition-all flex items-center justify-center"
              >
                <span className="absolute inset-0 rounded-full animate-ping bg-red-500/20" />
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-red-500 flex items-center justify-center shadow-lg">
                  <Square size={20} className="text-white fill-white" />
                </div>
              </button>
            )}
            <span className="text-xs font-bold text-[var(--text-muted)]">
              {isRecording ? `Recording... ${formatTime(recordingTime)}` : 'Tap to record'}
            </span>
          </div>
        ) : (
          <div className="space-y-3">
            <VoiceMessageBubble audioUrl={audioUrl} duration={recordingTime} align="right" />
            <button
              type="button"
              onClick={reRecord}
              className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors mx-auto"
            >
              <Mic size={12} />
              Record again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// FAQ Questions — Pre-recorded Justine voice answers
// ---------------------------------------------------------------------------
const faqItems = [
  { question: 'How secure is the document portal? What about compliance?', audio: '/audio/faq/faq-security.mp3' },
  { question: 'What happens to my data? Do I actually own it?', audio: '/audio/faq/faq-data-ownership.mp3' },
  { question: 'I already have a website. Why do I need a new one?', audio: '/audio/faq/faq-website.mp3' },
  { question: 'I don\'t have time for a big project right now.', audio: '/audio/faq/faq-time.mp3' },
  { question: 'How is this different from other marketing agencies?', audio: '/audio/faq/faq-different.mp3' },
  { question: 'My clients are used to how we do things — won\'t this disrupt everything?', audio: '/audio/faq/faq-disruption.mp3' },
];


// ---------------------------------------------------------------------------
// GHL Webhook — send intel form answers to GoHighLevel CRM
// ---------------------------------------------------------------------------
const GHL_BOOKING_INTEL_WEBHOOK_URL = 'https://services.leadconnectorhq.com/hooks/yamjttuJWWdstfF9N0zu/webhook-trigger/d8e921e0-2890-4259-8fcb-9e5f339a1c95';

async function sendBookingIntelToGHL(data: {
  email: string;
  name: string;
  challenge: string;
  outcome: string;
  priorAttempts: string;
  inputMode: 'text' | 'voice';
  justineResponse: string;
}) {
  try {
    await fetch(GHL_BOOKING_INTEL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'booking-intel-form',
        email: data.email,
        name: data.name,
        biggest_challenge: data.challenge,
        ideal_outcome: data.outcome,
        prior_attempts: data.priorAttempts,
        justine_response: data.justineResponse,
        input_mode: data.inputMode,
        submitted_at: new Date().toISOString(),
      }),
    });
  } catch {
    // Silently fail — don't block the user experience
  }
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
const BookingConfirmed: React.FC = () => {
  const { theme } = useTheme();
  const searchParams = useSearchParams();
  const prospectEmail = searchParams.get('email') || '';
  const prospectName = searchParams.get('name') || '';

  // Input mode toggle
  const [inputMode, setInputMode] = useState<'text' | 'voice'>('text');
  const [voiceTranscript, setVoiceTranscript] = useState('');

  // Intel form state
  const [intelForm, setIntelForm] = useState({
    challenge: '',
    outcome: '',
    priorAttempts: '',
  });
  const [intelSubmitted, setIntelSubmitted] = useState(false);
  const [intelLoading, setIntelLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState('');
  const [aiError, setAiError] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Email capture state (shown after AI response)
  const [prospectEmailInput, setProspectEmailInput] = useState('');
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [emailSending, setEmailSending] = useState(false);

  // User voice message state (for iMessage thread after submission)
  const [userAudioUrl, setUserAudioUrl] = useState<string | null>(null);
  const [userAudioDuration, setUserAudioDuration] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);

  // FAQ state
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);
  const [faqPlaying, setFaqPlaying] = useState<number | null>(null);
  const [faqTranscriptOpen, setFaqTranscriptOpen] = useState<number | null>(null);
  const faqAudioRef = useRef<HTMLAudioElement | null>(null);

  const handleFaqPlay = (index: number) => {
    // If already playing this one, pause
    if (faqPlaying === index && faqAudioRef.current) {
      faqAudioRef.current.pause();
      setFaqPlaying(null);
      return;
    }

    // Stop any other playing audio
    if (faqAudioRef.current) {
      faqAudioRef.current.pause();
      setFaqPlaying(null);
    }

    // Play pre-recorded audio
    const audio = new Audio(faqItems[index].audio);
    faqAudioRef.current = audio;
    audio.onended = () => setFaqPlaying(null);
    audio.play();
    setFaqPlaying(index);
  };

  const handleIntelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAiError('');
    setIntelLoading(true);

    // Voice mode: show the chat thread immediately (like sending an iMessage)
    if (inputMode === 'voice') {
      setIntelSubmitted(true);
    }

    const payload = inputMode === 'voice'
      ? { challenge: voiceTranscript || '(Voice message sent)', outcome: '(included in voice response)', priorAttempts: '(included in voice response)' }
      : intelForm;

    try {
      const response = await fetch('/api/booking-intel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Failed to get response');

      const data = await response.json();
      setAiResponse(data.message);
      if (data.audioUrl) setAudioUrl(data.audioUrl);
      setIntelSubmitted(true);
    } catch {
      setAiError('Your responses have been saved and Justine will review them before your call.');
      setIntelSubmitted(true);
    } finally {
      setIntelLoading(false);
    }
  };

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prospectEmailInput) return;
    setEmailSending(true);

    const payload = inputMode === 'voice'
      ? { challenge: voiceTranscript || '(Voice message sent)', outcome: '(included in voice response)', priorAttempts: '(included in voice response)' }
      : intelForm;

    await sendBookingIntelToGHL({
      email: prospectEmailInput,
      name: prospectName || prospectEmail || '',
      challenge: payload.challenge,
      outcome: payload.outcome,
      priorAttempts: payload.priorAttempts,
      inputMode,
      justineResponse: aiResponse || '',
    });

    setEmailSending(false);
    setEmailSubmitted(true);
  };

  const isFormValid = inputMode === 'voice'
    ? !!userAudioUrl
    : intelForm.challenge && intelForm.outcome && intelForm.priorAttempts;

  const inputClass = 'w-full bg-[var(--glass-border)] border border-[var(--glass-border)] rounded-xl md:rounded-xl px-3 md:px-4 py-2 md:py-3 text-[var(--text-main)] focus:outline-none focus:border-green-500 transition-all font-medium text-sm placeholder:text-[var(--text-muted)] placeholder:opacity-40';
  const labelClass = 'text-[8px] md:text-[10px] font-black text-[var(--text-muted)] opacity-50 uppercase tracking-[0.2em] ml-2 mb-1.5 block';

  const heroIcons = [CheckCircle, Video, ClipboardCheck, MessageSquare, Calendar];

  return (
    <div className="min-h-screen bg-[var(--bg-main)] transition-colors duration-300 pt-32 pb-20">
      <div className="max-w-7xl mx-auto px-6">

        {/* ── SECTION 1: Hero — two-column layout matching AI Automations ── */}
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
                  background: 'conic-gradient(from 0deg at 50% 50%, #22C55E, #10B981, #059669, #34D399, #22C55E)',
                }}
              />
              <span
                className="absolute inset-[-100%] animate-[shimmer_8s_linear_infinite] blur-md opacity-40"
                style={{
                  background: 'conic-gradient(from 0deg at 50% 50%, #22C55E, #10B981, #059669, #34D399, #22C55E)',
                }}
              />
              <span className="relative z-10 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--bg-main)]">
                <CheckCircle size={14} className="text-green-400" />
                <span className="text-[var(--text-main)] text-[10px] md:text-xs font-black tracking-[0.2em] uppercase">Booking Confirmed</span>
              </span>
            </div>

            <h1
              className="text-[26px] sm:text-4xl md:text-6xl font-black text-[var(--text-main)] mb-6 leading-tight tracking-tighter"
              style={{ fontFamily: "'Syne', sans-serif" }}
            >
              Your Strategy Session{' '}
              <br className="hidden md:block" />
              <span className="text-green-500">Is Confirmed.</span>
            </h1>

            {/* Mobile floating icons */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, ease: 'circOut' }}
              className="flex lg:hidden items-center justify-center my-8 relative"
            >
              <div className="absolute inset-0 bg-green-500/10 blur-[80px] rounded-full" />
              <div className="relative z-10 flex flex-col items-center gap-3">
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
                >
                  <Sparkles size={48} className="text-green-400" style={{ filter: 'drop-shadow(0 0 20px rgba(34, 197, 94, 0.4))' }} />
                </motion.div>
                <div className="flex gap-3" style={{ perspective: '600px' }}>
                  {heroIcons.map((Icon, i) => (
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
                      <div className="w-10 h-10 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center" style={{ filter: 'drop-shadow(0 4px 8px rgba(34, 197, 94, 0.3))' }}>
                        <Icon size={20} className="text-green-400" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>

            <p className="text-sm sm:text-lg md:text-xl text-[var(--text-muted)] mb-8 max-w-xl leading-relaxed">
              Before your call, complete the steps below so we can prepare a custom strategy tailored to your firm. This takes about 5 minutes and makes all the difference.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-5">
              <button
                onClick={() => document.getElementById('step-1')?.scrollIntoView({ behavior: 'smooth' })}
                className="flex items-center justify-center gap-2 bg-green-600 text-white px-6 md:px-8 py-3 md:py-4 rounded-full text-sm font-bold hover:bg-green-500 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-green-600/20 group"
              >
                Get Started
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
            <div className="absolute inset-0 bg-green-500/10 blur-[100px] rounded-full" />
            <div className="relative z-10 flex flex-col items-center gap-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="flex items-center gap-3"
              >
                <Sparkles size={48} className="text-green-400" />
                <span className="text-3xl font-bold text-[var(--text-main)]">You&apos;re All Set</span>
              </motion.div>
              <div className="flex gap-3" style={{ perspective: '600px' }}>
                {heroIcons.map((Icon, i) => (
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
                      className="w-14 h-14 rounded-2xl bg-green-500/20 border border-green-500/30 flex items-center justify-center"
                      style={{ filter: 'drop-shadow(0 4px 8px rgba(34, 197, 94, 0.3))' }}
                    >
                      <Icon size={28} className="text-green-400" />
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── STEP 1: Welcome Video ── */}
        <motion.section
          id="step-1"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: 'circOut' }}
          className="mb-14"
        >
          <StepBadge number={1} label="Watch the Welcome Video" />

          <div className={`relative max-w-3xl mx-auto rounded-[1.5rem] md:rounded-[2.5rem] border border-[var(--glass-border)] shadow-2xl overflow-hidden transition-colors duration-500 ${theme === 'dark' ? 'bg-[#050505]' : 'bg-white'}`}>
            <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-full h-[200px] blur-[100px] pointer-events-none transition-opacity duration-500 ${theme === 'dark' ? 'bg-green-500/5 opacity-100' : 'bg-green-500/10 opacity-50'}`} />

            <div className="relative z-10 p-4 md:p-8">
              <video
                className="w-full rounded-xl md:rounded-2xl"
                controls
                playsInline
                preload="metadata"
                poster=""
              >
                <source src="/justine-welcome.mp4" type="video/mp4" />
                Your browser does not support the video tag.
              </video>

              <p className="mt-5 text-sm md:text-base text-[var(--text-muted)] leading-relaxed text-center max-w-xl mx-auto">
                A quick welcome from our team. We&apos;ll walk you through what to expect on your strategy session and how to get the most out of it.
              </p>
            </div>
          </div>
        </motion.section>

        {/* ── INTEL FORM + AI RESPONSE ── */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: 'circOut' }}
          className="mb-14"
        >
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 mb-4 md:mb-6 px-3 py-1 md:px-4 md:py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
              <img src="/justine-headshot.png" alt="Justine" className="w-5 h-5 rounded-full object-cover border border-green-500/30" />
              <span className="text-green-400 text-[9px] md:text-xs font-black tracking-[0.2em] uppercase">Powered by Justine, COO</span>
            </div>
            <h2 className="text-2xl md:text-5xl font-bold text-[var(--text-main)] mb-4 md:mb-6">
              Help Us Prepare <span className="text-green-500">Your Custom Strategy</span>
            </h2>
            <p className="text-[var(--text-muted)] max-w-2xl mx-auto text-sm md:text-lg">
              Answer three quick questions so our COO, Justine, can analyze your firm&apos;s needs and prepare strategic insights before the call.
            </p>
          </div>

          <div className={`relative max-w-3xl mx-auto rounded-[1.5rem] md:rounded-[2.5rem] border border-[var(--glass-border)] shadow-2xl overflow-hidden transition-colors duration-500 ${theme === 'dark' ? 'bg-[#050505]' : 'bg-white'}`}>
            <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-full h-[200px] blur-[100px] pointer-events-none transition-opacity duration-500 ${theme === 'dark' ? 'bg-green-500/5 opacity-100' : 'bg-green-500/10 opacity-50'}`} />

            <div className="relative z-10 p-4 md:p-8">
              <AnimatePresence mode="wait">
                {!intelSubmitted ? (
                  <motion.form
                    key="form"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                    onSubmit={handleIntelSubmit}
                    className="space-y-4 md:space-y-5"
                  >
                    {/* Input mode toggle */}
                    <div className="flex items-center justify-center gap-2 p-1.5 rounded-xl bg-[var(--glass-border)] w-fit mx-auto">
                      <button
                        type="button"
                        onClick={() => setInputMode('text')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs md:text-sm font-bold transition-all ${
                          inputMode === 'text'
                            ? 'bg-green-600 text-white shadow-lg shadow-green-600/20'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                        }`}
                      >
                        <Type size={14} />
                        Type Answers
                      </button>
                      <button
                        type="button"
                        onClick={() => setInputMode('voice')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs md:text-sm font-bold transition-all ${
                          inputMode === 'voice'
                            ? 'bg-green-600 text-white shadow-lg shadow-green-600/20'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                        }`}
                      >
                        <AudioLines size={14} />
                        Record Voice
                      </button>
                    </div>

                    {inputMode === 'text' ? (
                      <>
                        <div>
                          <label className={labelClass}>Question 1</label>
                          <textarea
                            rows={2}
                            placeholder="What's your biggest operational challenge right now?"
                            value={intelForm.challenge}
                            onChange={(e) => setIntelForm(prev => ({ ...prev, challenge: e.target.value }))}
                            className={`${inputClass} resize-none`}
                            required
                          />
                        </div>

                        <div>
                          <label className={labelClass}>Question 2</label>
                          <textarea
                            rows={2}
                            placeholder="What outcome would make this investment a no-brainer for you?"
                            value={intelForm.outcome}
                            onChange={(e) => setIntelForm(prev => ({ ...prev, outcome: e.target.value }))}
                            className={`${inputClass} resize-none`}
                            required
                          />
                        </div>

                        <div>
                          <label className={labelClass}>Question 3</label>
                          <textarea
                            rows={2}
                            placeholder="What have you tried before to fix this, and why didn't it work?"
                            value={intelForm.priorAttempts}
                            onChange={(e) => setIntelForm(prev => ({ ...prev, priorAttempts: e.target.value }))}
                            className={`${inputClass} resize-none`}
                            required
                          />
                        </div>
                      </>
                    ) : (
                      <VoiceRecorder
                        onTranscriptChange={setVoiceTranscript}
                        onAudioReady={(url, dur) => { setUserAudioUrl(url); setUserAudioDuration(dur); }}
                      />
                    )}

                    <button
                      type="submit"
                      disabled={intelLoading || !isFormValid}
                      className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 md:py-3.5 rounded-xl text-sm font-bold hover:bg-green-500 hover:scale-[1.01] active:scale-[0.99] transition-all shadow-xl shadow-green-600/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                      {intelLoading ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          Justine is analyzing your responses...
                        </>
                      ) : (
                        <>
                          <Send size={16} />
                          Submit to Justine
                        </>
                      )}
                    </button>
                  </motion.form>
                ) : inputMode === 'voice' ? (
                  /* ── Voice Mode: iMessage-like thread ── */
                  <motion.div
                    key="voice-thread"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                    className="space-y-4"
                  >
                    {/* User's sent voice message (right-aligned, green) */}
                    {userAudioUrl && (
                      <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: 0.1 }}
                      >
                        <VoiceMessageBubble
                          audioUrl={userAudioUrl}
                          duration={userAudioDuration}
                          align="right"
                          label="Your message"
                        />
                        <p className="text-[10px] text-[var(--text-muted)] text-right mt-1.5 mr-2">Delivered</p>
                      </motion.div>
                    )}

                    {/* Justine's response or typing indicator */}
                    {intelLoading ? (
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: 0.4 }}
                        className="flex items-start gap-3"
                      >
                        <Image src="/justine-headshot.png" alt="Justine" width={36} height={36} className="w-9 h-9 rounded-full object-cover border border-green-500/30 flex-shrink-0" />
                        <div>
                          <p className="text-[10px] font-bold text-[var(--text-muted)] mb-1.5 ml-1">Justine</p>
                          <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-2xl rounded-bl-md px-5 py-4">
                            <div className="flex items-center gap-2">
                              <div className="flex gap-1.5">
                                <span className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                              </div>
                              <span className="text-xs text-[var(--text-muted)] ml-2">Justine is listening...</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ) : aiResponse ? (
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: 0.1 }}
                        className="flex items-start gap-3"
                      >
                        <Image src="/justine-headshot.png" alt="Justine" width={36} height={36} className="w-9 h-9 rounded-full object-cover border border-green-500/30 flex-shrink-0" />
                        <div className="flex-1 min-w-0 space-y-3">
                          <p className="text-[10px] font-bold text-[var(--text-muted)] ml-1">Justine</p>

                          {/* Justine's voice message */}
                          {audioUrl && (
                            <>
                              <VoiceMessageBubble
                                audioUrl={audioUrl}
                                duration={0}
                                align="left"
                                audioRef={audioRef}
                                isPlayingExternal={isPlaying}
                                onTogglePlay={toggleAudio}
                              />
                              <audio
                                ref={audioRef}
                                src={audioUrl}
                                onEnded={() => setIsPlaying(false)}
                              />
                            </>
                          )}

                          {/* Read transcript toggle */}
                          <button
                            type="button"
                            onClick={() => setShowTranscript(!showTranscript)}
                            className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-green-400 transition-colors ml-1"
                          >
                            <ChevronDown size={14} className={`transition-transform duration-300 ${showTranscript ? 'rotate-180' : ''}`} />
                            {showTranscript ? 'Hide transcript' : 'Read transcript'}
                          </button>

                          <AnimatePresence>
                            {showTranscript && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.3 }}
                                className="overflow-hidden"
                              >
                                <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-2xl rounded-bl-md p-4 md:p-6">
                                  {aiResponse.split('\n\n').map((paragraph, i) => (
                                    <p key={i} className="text-sm md:text-base text-[var(--text-main)] leading-relaxed mb-3 last:mb-0">
                                      {paragraph}
                                    </p>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    ) : aiError ? (
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: 0.2 }}
                        className="flex items-start gap-3"
                      >
                        <Image src="/justine-headshot.png" alt="Justine" width={36} height={36} className="w-9 h-9 rounded-full object-cover border border-green-500/30 flex-shrink-0" />
                        <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-2xl rounded-bl-md px-5 py-4">
                          <p className="text-sm text-[var(--text-main)] leading-relaxed">{aiError}</p>
                        </div>
                      </motion.div>
                    ) : null}
                  </motion.div>
                ) : (
                  /* ── Text Mode: existing response card ── */
                  <motion.div
                    key="response"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                  >
                    {aiResponse ? (
                      <div>
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-3">
                            <Image src="/justine-headshot.png" alt="Justine" width={48} height={48} className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover border border-green-500/30" />
                            <div>
                              <p className="text-sm md:text-base font-bold text-[var(--text-main)]">Justine</p>
                              <p className="text-[10px] md:text-xs text-[var(--text-muted)]">COO, Nexli Automation</p>
                            </div>
                          </div>

                          {audioUrl && (
                            <button
                              onClick={toggleAudio}
                              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-all text-xs md:text-sm font-bold"
                            >
                              {isPlaying ? <Pause size={16} /> : <Volume2 size={16} />}
                              {isPlaying ? 'Pause' : 'Listen to Justine'}
                            </button>
                          )}
                        </div>

                        {audioUrl && (
                          <audio
                            ref={audioRef}
                            src={audioUrl}
                            onEnded={() => setIsPlaying(false)}
                          />
                        )}

                        <div className="rounded-xl md:rounded-2xl bg-green-500/5 border border-green-500/10 p-5 md:p-8">
                          {aiResponse.split('\n\n').map((paragraph, i) => (
                            <p key={i} className="text-sm md:text-base text-[var(--text-main)] leading-relaxed mb-4 last:mb-0">
                              {paragraph}
                            </p>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <CheckCircle size={32} className="text-green-500 mx-auto mb-4" />
                        <p className="text-sm md:text-base text-[var(--text-main)] font-bold mb-2">Responses Received</p>
                        <p className="text-sm text-[var(--text-muted)] leading-relaxed max-w-md mx-auto">{aiError}</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Email capture — shown after AI response */}
              <AnimatePresence>
                {intelSubmitted && !emailSubmitted && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.5, delay: 0.8 }}
                    className="mt-6"
                  >
                    <div className={`rounded-xl md:rounded-2xl p-5 md:p-6 border ${theme === 'dark' ? 'bg-white/[0.02] border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex items-center gap-2 mb-3">
                        <Mail size={16} className="text-green-500" />
                        <p className="text-sm md:text-base font-bold text-[var(--text-main)]">
                          Want a copy of your answers &amp; Justine&apos;s response?
                        </p>
                      </div>
                      <p className="text-xs md:text-sm text-[var(--text-muted)] mb-4 leading-relaxed">
                        Enter your email and we&apos;ll send you everything so you have it before your call.
                      </p>
                      <form onSubmit={handleEmailSubmit} className="flex gap-2">
                        <input
                          type="email"
                          required
                          placeholder="your@email.com"
                          value={prospectEmailInput}
                          onChange={(e) => setProspectEmailInput(e.target.value)}
                          className={`flex-1 px-4 py-2.5 rounded-xl text-sm border bg-transparent outline-none transition-all focus:border-green-500/50 focus:ring-1 focus:ring-green-500/20 ${theme === 'dark' ? 'border-white/10 text-white placeholder:text-white/30' : 'border-slate-300 text-slate-900 placeholder:text-slate-400'}`}
                        />
                        <button
                          type="submit"
                          disabled={emailSending}
                          className="px-5 py-2.5 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-500 transition-all disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                        >
                          {emailSending ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Send size={14} />
                          )}
                          Send
                        </button>
                      </form>
                    </div>
                  </motion.div>
                )}

                {emailSubmitted && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4 }}
                    className="mt-6"
                  >
                    <div className={`rounded-xl md:rounded-2xl p-5 md:p-6 border text-center ${theme === 'dark' ? 'bg-green-500/5 border-green-500/20' : 'bg-green-50 border-green-200'}`}>
                      <CheckCircle size={24} className="text-green-500 mx-auto mb-2" />
                      <p className="text-sm font-bold text-[var(--text-main)]">You&apos;re all set!</p>
                      <p className="text-xs text-[var(--text-muted)] mt-1">Check your inbox — we&apos;ll send a copy before your call.</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.section>

        {/* ── STEP 2: Digital Rainmaker System Breakdown Video + Interactive Demo ── */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: 'circOut' }}
          className="mb-14"
        >
          <StepBadge number={2} label="See the Digital Rainmaker System" />

          {/* Demo Breakdown Video */}
          <div className={`relative max-w-3xl mx-auto rounded-[1.5rem] md:rounded-[2.5rem] border border-[var(--glass-border)] shadow-2xl overflow-hidden transition-colors duration-500 mb-10 ${theme === 'dark' ? 'bg-[#050505]' : 'bg-white'}`}>
            <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-full h-[200px] blur-[100px] pointer-events-none transition-opacity duration-500 ${theme === 'dark' ? 'bg-green-500/5 opacity-100' : 'bg-green-500/10 opacity-50'}`} />

            <div className="relative z-10 p-4 md:p-8">
              <video
                className="w-full rounded-xl md:rounded-2xl"
                controls
                playsInline
                preload="metadata"
              >
                <source src="/rainmaker-demo.mp4" type="video/mp4" />
                Your browser does not support the video tag.
              </video>

              <p className="mt-5 text-sm md:text-base text-[var(--text-muted)] leading-relaxed text-center max-w-xl mx-auto">
                Watch Marcel break down the Digital Rainmaker System — how the website, AI automation, and review engine work together to transform your firm&apos;s inbound pipeline.
              </p>
            </div>
          </div>

          {/* Interactive Demo Tool */}
          <div className="max-w-3xl mx-auto">
            <RainmakerDemo />
          </div>
        </motion.section>

        {/* ── FAQ: Justine Voice Responses ── */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: 'circOut' }}
          className="mb-24"
        >
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 mb-4 md:mb-6 px-3 py-1 md:px-4 md:py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
              <HelpCircle size={14} className="text-green-400" />
              <span className="text-green-400 text-[9px] md:text-xs font-black tracking-[0.2em] uppercase">Ask Justine</span>
            </div>
            <h2 className="text-2xl md:text-5xl font-bold text-[var(--text-main)] mb-4">
              Questions Before <span className="text-green-500">Your Call?</span>
            </h2>
            <p className="text-[var(--text-muted)] max-w-2xl mx-auto text-sm md:text-lg">
              Tap any question to hear Justine answer it personally — in her own voice.
            </p>
          </div>

          <div className="max-w-3xl mx-auto space-y-3">
            {faqItems.map((item, i) => (
              <div
                key={i}
                className={`rounded-2xl border transition-all ${expandedFaq === i ? (theme === 'dark' ? 'border-green-500/30 bg-green-500/5' : 'border-green-500/30 bg-green-50/50') : 'border-[var(--glass-border)] bg-[var(--glass-bg)]'}`}
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
                      <div className="px-5 md:px-6 pb-5 md:pb-6">
                        <div className="flex items-start gap-3">
                          <Image src="/justine-headshot.png" alt="Justine" width={36} height={36} className="w-8 h-8 md:w-9 md:h-9 rounded-full object-cover border border-green-500/30 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0 space-y-2">
                            <p className="text-[10px] font-bold ml-1 text-[var(--text-muted)]">Justine, COO</p>
                            <div className={`rounded-2xl rounded-bl-md px-4 py-3 ${theme === 'dark' ? 'bg-white/[0.04] border border-white/10' : 'bg-slate-50 border border-slate-200'}`}>
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => handleFaqPlay(i)}
                                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors bg-green-500/20 hover:bg-green-500/30"
                                >
                                  {faqPlaying === i ? (
                                    <Pause size={16} className="text-green-400" />
                                  ) : (
                                    <Play size={16} className="text-green-400 ml-0.5" />
                                  )}
                                </button>

                                {/* Waveform bars */}
                                <div className="flex items-center gap-[2px] h-8 flex-1 min-w-0">
                                  {Array.from({ length: 48 }).map((_, barIdx) => {
                                    const h = 20 + Math.sin(barIdx * 0.7) * 35 + Math.sin(barIdx * 1.4) * 20 + Math.cos(barIdx * 0.5) * 10;
                                    return (
                                      <div
                                        key={barIdx}
                                        className={`flex-1 min-w-[2px] rounded-full transition-all duration-200 ${
                                          faqPlaying === i ? 'bg-green-400/90' : 'bg-green-400/40'
                                        }`}
                                        style={{ height: `${Math.max(15, h)}%` }}
                                      />
                                    );
                                  })}
                                </div>
                              </div>
                            </div>

                            {/* Transcript toggle */}
                            <button
                              type="button"
                              onClick={() => setFaqTranscriptOpen(faqTranscriptOpen === i ? null : i)}
                              className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-green-400 transition-colors ml-1"
                            >
                              <ChevronDown size={14} className={`transition-transform duration-300 ${faqTranscriptOpen === i ? 'rotate-180' : ''}`} />
                              {faqTranscriptOpen === i ? 'Hide transcript' : 'Read transcript'}
                            </button>

                            <AnimatePresence>
                              {faqTranscriptOpen === i && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.3 }}
                                  className="overflow-hidden"
                                >
                                  <div className={`rounded-2xl rounded-bl-md p-4 ${theme === 'dark' ? 'bg-white/[0.04] border border-white/10' : 'bg-slate-50 border border-slate-200'}`}>
                                    <p className="text-sm text-[var(--text-muted)] leading-relaxed italic">
                                      Transcript will be available after playback.
                                    </p>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── Final CTA — matching other pages ── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <div className="max-w-4xl mx-auto p-6 md:p-20 rounded-[1.5rem] md:rounded-[3rem] border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-t from-green-500/10 to-transparent pointer-events-none" />
            <div className="relative z-10">
              <h2 className="text-xl md:text-5xl font-bold text-[var(--text-main)] mb-4 md:mb-8 tracking-tight leading-tight">
                We Look Forward to <br className="hidden md:block" /><span className="text-green-500">Speaking With You.</span>
              </h2>
              <p className="text-sm md:text-xl text-[var(--text-muted)] mb-6 md:mb-8 max-w-2xl mx-auto leading-relaxed font-medium">
                If you have any questions before your call, don&apos;t hesitate to reach out.
              </p>
              <a
                href="mailto:mail@nexli.net"
                className="inline-flex items-center gap-2 md:gap-3 bg-green-600 text-white px-6 md:px-10 py-3 md:py-5 rounded-full text-sm md:text-lg font-bold hover:bg-green-500 hover:scale-105 transition-all shadow-xl shadow-green-600/25 active:scale-95"
              >
                <Mail size={16} className="md:w-5 md:h-5" />
                mail@nexli.net
              </a>
            </div>
          </div>
        </motion.section>

      </div>
    </div>
  );
};

export default BookingConfirmed;
