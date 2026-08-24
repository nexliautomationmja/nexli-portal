"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { NexliLogo } from "@/components/ui/nexli-logo";

// ══════════════════════════════════════════════════════════
// Launch Pad — client-facing onboarding page, styled to match
// the Digital Rainmaker page (nexli.net/rainmaker): #020617 bg,
// Syne gradient headlines, color-coded sections (website=blue,
// automations=violet, portal=cyan, reputation=amber), floating
// tinted icon chips, Step timeline, shimmer conic borders.
// ══════════════════════════════════════════════════════════

// ─── Types (mirror serializePublicOnboarding) ──────────────

interface PhaseData {
  id: string;
  title: string;
  description: string;
  emoji: string;
  features?: string[];
  status: "pending" | "in_progress" | "done";
  targetDate: string | null;
  startedAt: string | null;
  completedAt: string | null;
  note: string | null;
}

interface TaskData {
  id: string;
  title: string;
  description: string;
  emoji: string;
  type: "credentials" | "confirm" | "upload";
  optional: boolean;
  status: "todo" | "submitted" | "approved" | "needs_attention";
  submittedAt: string | null;
  adminNote: string | null;
  files?: {
    front: { fileName: string; uploadedAt: string } | null;
    back: { fileName: string; uploadedAt: string } | null;
  };
  submission?: { confirmed?: boolean; notApplicable?: boolean } | null;
}

interface ActivityEntry {
  at: string;
  actor: "agency" | "client" | "system";
  type: string;
  message: string;
}

interface LaunchPadData {
  clientName: string;
  subject: string;
  signedAt: string | null;
  from: { name: string; company: string };
  onboarding: {
    startedAt: string;
    targetLaunchDate: string | null;
    progressPercent: number;
    phases: PhaseData[];
    tasks: TaskData[];
    activity: ActivityEntry[];
  };
}

// ─── Helpers ───────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "";
  // Date-only strings get a fixed time so they don't shift a day in local TZ
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

const REGISTRARS = [
  "GoDaddy",
  "Namecheap",
  "Squarespace / Google Domains",
  "Cloudflare",
  "Wix",
  "Bluehost",
  "HostGator",
  "IONOS",
  "Other",
];

const SYNE = { fontFamily: "var(--font-syne), sans-serif" };

// ─── Color system (literal Tailwind classes per accent) ────

type Accent = "blue" | "violet" | "cyan" | "amber" | "emerald" | "stripe";

const ACCENT = {
  blue: {
    chip: "bg-blue-500/20 border border-blue-500/30",
    chipGlow: "drop-shadow(0 4px 8px rgba(37, 99, 235, 0.3))",
    icon: "text-blue-400",
    headerTile: "bg-blue-500/10 border border-blue-500/20",
    headerIcon: "text-blue-500",
    check: "text-blue-500",
    badgeDone: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
    noteStrip: "bg-blue-500/10 border border-blue-500/20",
    successStrip: "bg-blue-500/10 border border-blue-500/30",
    dotBg: "#3B82F6",
  },
  violet: {
    chip: "bg-violet-500/20 border border-violet-500/30",
    chipGlow: "drop-shadow(0 4px 8px rgba(139, 92, 246, 0.3))",
    icon: "text-violet-400",
    headerTile: "bg-violet-500/10 border border-violet-500/20",
    headerIcon: "text-violet-500",
    check: "text-violet-500",
    badgeDone: "bg-violet-500/20 text-violet-300 border border-violet-500/30",
    noteStrip: "bg-violet-500/10 border border-violet-500/20",
    successStrip: "bg-violet-500/10 border border-violet-500/30",
    dotBg: "#8B5CF6",
  },
  cyan: {
    chip: "bg-cyan-500/20 border border-cyan-500/30",
    chipGlow: "drop-shadow(0 4px 8px rgba(6, 182, 212, 0.3))",
    icon: "text-cyan-400",
    headerTile: "bg-cyan-500/10 border border-cyan-500/20",
    headerIcon: "text-cyan-500",
    check: "text-cyan-500",
    badgeDone: "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30",
    noteStrip: "bg-cyan-500/10 border border-cyan-500/20",
    successStrip: "bg-cyan-500/10 border border-cyan-500/30",
    dotBg: "#06B6D4",
  },
  stripe: {
    // White-outlined tile (per Marcel) with Stripe-blurple accents elsewhere
    chip: "bg-white/10 border border-white/30",
    chipGlow: "drop-shadow(0 4px 8px rgba(255, 255, 255, 0.18))",
    icon: "text-white",
    headerTile: "bg-white/10 border border-white/20",
    headerIcon: "text-white",
    check: "text-[#8f88ff]",
    badgeDone: "bg-[#635BFF]/20 text-[#b5b0ff] border border-[#635BFF]/40",
    noteStrip: "bg-[#635BFF]/10 border border-[#635BFF]/30",
    successStrip: "bg-[#635BFF]/10 border border-[#635BFF]/40",
    dotBg: "#635BFF",
  },
  emerald: {
    chip: "bg-emerald-500/20 border border-emerald-500/30",
    chipGlow: "drop-shadow(0 4px 8px rgba(16, 185, 129, 0.3))",
    icon: "text-emerald-400",
    headerTile: "bg-emerald-500/10 border border-emerald-500/20",
    headerIcon: "text-emerald-500",
    check: "text-emerald-500",
    badgeDone: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
    noteStrip: "bg-emerald-500/10 border border-emerald-500/20",
    successStrip: "bg-emerald-500/10 border border-emerald-500/30",
    dotBg: "#10B981",
  },
  amber: {
    chip: "bg-amber-500/20 border border-amber-500/30",
    chipGlow: "drop-shadow(0 4px 8px rgba(245, 158, 11, 0.3))",
    icon: "text-amber-400",
    headerTile: "bg-yellow-500/10 border border-yellow-500/20",
    headerIcon: "text-yellow-500",
    check: "text-yellow-500",
    badgeDone: "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30",
    noteStrip: "bg-yellow-500/10 border border-yellow-500/20",
    successStrip: "bg-yellow-500/10 border border-yellow-500/30",
    dotBg: "#F59E0B",
  },
} satisfies Record<Accent, Record<string, string>>;

const PHASE_ACCENT: Record<string, Accent> = {
  website: "blue",
  automations: "violet",
  portal: "cyan",
};

const TASK_ACCENT: Record<string, Accent> = {
  stripe_setup: "stripe",
  dns_access: "blue",
  fb_ads_invite: "emerald",
  drivers_license: "amber",
};

const SHIMMER_CONIC =
  "conic-gradient(from 0deg at 50% 50%, #06B6D4, #3B82F6, #8B5CF6, #06B6D4, #3B82F6, #06B6D4)";
const SHIMMER_CONIC_WARM =
  "conic-gradient(from 0deg at 50% 50%, #3B82F6, #8B5CF6, #06B6D4, #F59E0B, #3B82F6)";

// ─── Inline icons (lucide paths, matching the Rainmaker page) ──

function Icon({
  d,
  className,
  size = 24,
  style,
}: {
  d: React.ReactNode;
  className?: string;
  size?: number;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {d}
    </svg>
  );
}

const PATHS = {
  monitor: (
    <>
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
    </>
  ),
  bot: (
    <>
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </>
  ),
  layoutDashboard: (
    <>
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </>
  ),
  circleCheck: (
    <>
      <path d="M21.801 10A10 10 0 1 1 17 3.335" />
      <path d="m9 11 3 3L22 4" />
    </>
  ),
  star: (
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  ),
  idCard: (
    <>
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <path d="M16 10h2" />
      <path d="M16 14h2" />
      <path d="M6.17 15a3 3 0 0 1 5.66 0" />
      <circle cx="9" cy="11" r="2" />
    </>
  ),
  lock: (
    <>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  rocket: (
    <>
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
};

const PHASE_ICON: Record<string, React.ReactNode> = {
  website: PATHS.globe,
  automations: PATHS.bot,
  portal: PATHS.layoutDashboard,
};

const TASK_ICON: Record<string, React.ReactNode> = {
  dns_access: PATHS.globe,
  drivers_license: PATHS.idCard,
};

// ─── Brand logos (fill-based, full color) ──────────────────

function FacebookLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#1877F2"
        d="M24 12.073C24 5.446 18.627.073 12 .073S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.313 0 2.686.235 2.686.235v2.953h-1.514c-1.49 0-1.955.925-1.955 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
      />
      <path
        fill="#FFFFFF"
        d="M16.671 15.542l.532-3.469h-3.328v-2.25c0-.949.465-1.874 1.955-1.874h1.514V4.996s-1.373-.235-2.686-.235c-2.741 0-4.533 1.662-4.533 4.669v2.644H7.078v3.469h3.047v8.385a12.13 12.13 0 0 0 3.75 0v-8.385h2.796z"
      />
    </svg>
  );
}

function StripeLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#635BFF"
        d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305z"
      />
    </svg>
  );
}

function GoogleGLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

// ─── Shimmer-border pill (Rainmaker badge) ─────────────────

function ShimmerPill({
  children,
  conic = SHIMMER_CONIC_WARM,
}: {
  children: React.ReactNode;
  conic?: string;
}) {
  return (
    <div className="relative inline-flex items-center rounded-full overflow-hidden p-[1.5px]">
      <span
        className="absolute inset-[-100%] animate-[shimmer_8s_linear_infinite] opacity-80"
        style={{ background: conic }}
      />
      <span
        className="absolute inset-[-100%] animate-[shimmer_8s_linear_infinite] blur-md opacity-40"
        style={{ background: conic }}
      />
      <span className="relative z-10 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#020617]">
        {children}
      </span>
    </div>
  );
}

// ─── Confetti ──────────────────────────────────────────────

const CONFETTI_COLORS = ["#2563EB", "#06B6D4", "#8B5CF6", "#F59E0B", "#10B981"];

function ConfettiBurst({ burst }: { burst: number }) {
  if (!burst) return null;
  return (
    <div
      key={burst}
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
      aria-hidden="true"
    >
      {Array.from({ length: 36 }).map((_, i) => {
        const left = 10 + Math.random() * 80;
        const size = 6 + Math.random() * 8;
        const delay = Math.random() * 0.25;
        const duration = 1.6 + Math.random() * 1.2;
        const drift = -120 + Math.random() * 240;
        const spin = 360 + Math.random() * 720;
        const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
        return (
          <span
            key={i}
            style={
              {
                position: "absolute",
                top: "-20px",
                left: `${left}%`,
                width: `${size}px`,
                height: `${size * (Math.random() > 0.5 ? 1 : 0.4)}px`,
                background: color,
                borderRadius: Math.random() > 0.6 ? "50%" : "2px",
                animation: `lp-confetti-fall ${duration}s cubic-bezier(0.25, 0.4, 0.45, 1) ${delay}s forwards`,
                "--lp-drift": `${drift}px`,
                "--lp-spin": `${spin}deg`,
                opacity: 0,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

// ─── Progress Ring (kept — with gradient stroke) ───────────

function ProgressRing({ percent }: { percent: number }) {
  const R = 52;
  const C = 2 * Math.PI * R;
  const offset = C - (percent / 100) * C;
  return (
    <div className="relative w-[132px] h-[132px] shrink-0">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <defs>
          <linearGradient id="lp-ring" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="50%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
        </defs>
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="10"
        />
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke="url(#lp-ring)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black text-white" style={{ letterSpacing: "-0.03em" }}>
          {percent}%
        </span>
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-500">
          Complete
        </span>
      </div>
    </div>
  );
}

// ─── Status pills ──────────────────────────────────────────

function PhasePill({ status, accent }: { status: PhaseData["status"]; accent: Accent }) {
  const a = ACCENT[accent];
  if (status === "done") {
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${a.badgeDone}`}>
        Done ✓
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${a.badgeDone}`}>
        <span
          className="w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ background: a.dotBg }}
        />
        In the works
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/5 text-neutral-400 border border-white/10">
      Queued up
    </span>
  );
}

function TaskPill({ task, accent }: { task: TaskData; accent: Accent }) {
  const a = ACCENT[accent];
  if (task.status === "approved") {
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${a.badgeDone}`}>
        Approved ✓
      </span>
    );
  }
  if (task.status === "submitted") {
    if (task.submission?.notApplicable) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/5 text-neutral-400 border border-white/10">
          Skipped
        </span>
      );
    }
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${a.badgeDone}`}>
        Submitted ✓
      </span>
    );
  }
  if (task.status === "needs_attention") {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
        Needs attention
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/10 text-white/70 border border-white/10">
      {task.optional ? "If applicable" : "Action needed"}
    </span>
  );
}

// ─── Main component ────────────────────────────────────────

export function OnboardingClient({ token }: { token: string }) {
  const [data, setData] = useState<LaunchPadData | null>(null);
  const [errorKind, setErrorKind] = useState<"not_found" | "not_started" | "network" | null>(null);
  const [loading, setLoading] = useState(true);
  const [burst, setBurst] = useState(0);
  const celebratedRef = useRef(false);

  const load = useCallback(
    async (showSpinner: boolean) => {
      if (showSpinner) setLoading(true);
      try {
        const res = await fetch(`/api/onboarding/${token}`, { cache: "no-store" });
        if (!res.ok) {
          // A transient failure during a background poll shouldn't wipe an
          // already-loaded page — only surface errors on the initial load.
          if (showSpinner) {
            const body = await res.json().catch(() => ({}));
            setErrorKind(body.error === "not_started" ? "not_started" : "not_found");
          }
          return;
        }
        setData(await res.json());
        setErrorKind(null);
      } catch {
        if (showSpinner) setErrorKind("network");
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    load(true);
    const interval = setInterval(() => {
      if (!document.hidden) load(false);
    }, 45_000);
    return () => clearInterval(interval);
  }, [load]);

  function celebrate() {
    setBurst((b) => b + 1);
  }

  // Big celebration the first time we see 100%
  useEffect(() => {
    if (data?.onboarding.progressPercent === 100 && !celebratedRef.current) {
      celebratedRef.current = true;
      celebrate();
    }
  }, [data?.onboarding.progressPercent]);

  // ─── Loading / error states ───
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020617]">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (errorKind || !data) {
    const notStarted = errorKind === "not_started";
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-[#020617]">
        <NexliLogo size="md" />
        <div className="max-w-md w-full p-8 mt-8 space-y-3 rounded-2xl bg-white/5 border border-white/10">
          <div className="text-4xl">{notStarted ? "🚧" : "🔍"}</div>
          <h1 className="text-lg font-bold text-white">
            {notStarted
              ? "Your Launch Pad isn't live yet"
              : "This link isn't active"}
          </h1>
          <p className="text-sm text-neutral-400">
            {notStarted
              ? "We're getting things ready behind the scenes. Check back soon, or reach out to your Nexli team."
              : "Double-check the link from your email, or contact your Nexli team for a fresh one."}
          </p>
        </div>
      </div>
    );
  }

  const ob = data.onboarding;
  const firstName = (data.clientName || "there").split(" ")[0];
  const tasksDone = ob.tasks.filter(
    (t) => t.status === "submitted" || t.status === "approved"
  ).length;
  const allDone = ob.progressPercent === 100;

  return (
    <div className="min-h-screen relative overflow-x-hidden bg-[#020617] text-white">
      <style>{`
        @keyframes lp-confetti-fall {
          0% { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 1; }
          100% { transform: translate3d(var(--lp-drift), 105vh, 0) rotate(var(--lp-spin)); opacity: 0.9; }
        }
        @keyframes lp-fade-up {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes lp-check-bounce {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.25); opacity: 1; }
          70% { transform: scale(0.9); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes lp-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        .lp-card { animation: lp-fade-up 0.5s ease-out both; }
        .lp-input {
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.5rem;
          padding: 0.75rem 1rem;
          color: #fff;
          font-size: 0.875rem;
          outline: none;
          transition: border-color 0.15s ease;
        }
        .lp-input::placeholder { color: rgba(255, 255, 255, 0.3); }
        .lp-input:focus { border-color: #3B82F6; }
        .lp-input option { background: #020617; color: #fff; }
      `}</style>

      {/* Ambient brand glows */}
      <div
        className="pointer-events-none fixed -top-40 -right-32 w-[560px] h-[560px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(59, 130, 246, 0.10) 0%, transparent 70%)" }}
      />
      <div
        className="pointer-events-none fixed top-1/3 -left-40 w-[480px] h-[480px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(139, 92, 246, 0.08) 0%, transparent 70%)" }}
      />
      <div
        className="pointer-events-none fixed -bottom-32 -right-24 w-[480px] h-[480px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(6, 182, 212, 0.08) 0%, transparent 70%)" }}
      />

      <ConfettiBurst burst={burst} />

      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-10">
        {/* ─── Header ─── */}
        <header className="flex items-center justify-between lp-card">
          <NexliLogo size="md" />
          <ShimmerPill>
            <Icon d={PATHS.rocket} size={14} className="text-blue-400" />
            <span className="text-white text-[10px] md:text-xs font-black tracking-[0.2em] uppercase">
              Launch Pad
            </span>
          </ShimmerPill>
        </header>

        {/* ─── Celebration banner ─── */}
        {allDone && (
          <div className="lp-card relative rounded-2xl overflow-hidden p-[1.5px]">
            <span
              className="absolute inset-[-200%] animate-[shimmer_6s_linear_infinite] opacity-90"
              style={{ background: SHIMMER_CONIC }}
            />
            <div className="relative z-10 rounded-[14px] p-6 text-center bg-gradient-to-br from-slate-950 via-cyan-950/40 to-slate-950">
              <div className="text-3xl mb-1">🎉</div>
              <h2 className="text-xl font-black text-white" style={SYNE}>
                Everything&apos;s done — you&apos;re cleared for launch!
              </h2>
              <p className="text-sm mt-1 text-neutral-300">
                Your Nexli team will be in touch with go-live details.
              </p>
            </div>
          </div>
        )}

        {/* ─── Hero ─── */}
        <section className="lp-card" style={{ animationDelay: "0.05s" }}>
          <div className="flex flex-col sm:flex-row items-center gap-8">
            <div className="flex-1 text-center sm:text-left">
              <h1
                className="text-3xl sm:text-4xl font-extrabold leading-tight tracking-tighter text-white"
                style={SYNE}
              >
                Welcome aboard,{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-violet-500 to-cyan-500">
                  {firstName}.
                </span>
              </h1>
              <p className="text-sm mt-3 leading-relaxed text-neutral-300">
                We&apos;re already building. This page updates in real time, so
                you always know exactly where everything stands — no guessing,
                no waiting on hold.
              </p>
              <p className="text-sm mt-2 leading-relaxed">
                <span className="text-white font-semibold">
                  The faster we get what we need from you, the faster we can
                  build this out for you.
                </span>{" "}
                ⚡
              </p>

              {/* Floating icon chips — website / automations / portal / reviews / ads */}
              <div className="flex flex-wrap gap-3 mt-5 justify-center sm:justify-start">
                {(
                  [
                    ["blue", <Icon key="b" d={PATHS.monitor} size={28} className={ACCENT.blue.icon} />],
                    ["violet", <Icon key="v" d={PATHS.bot} size={28} className={ACCENT.violet.icon} />],
                    ["cyan", <Icon key="c" d={PATHS.layoutDashboard} size={28} className={ACCENT.cyan.icon} />],
                    ["amber", <GoogleGLogo key="g" size={26} />],
                    ["emerald", <FacebookLogo key="f" size={26} />],
                    ["stripe", <StripeLogo key="s" size={26} />],
                  ] as [Accent, React.ReactNode][]
                ).map(([accent, icon], i) => (
                  <div
                    key={accent}
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center ${ACCENT[accent].chip}`}
                    style={{
                      filter: ACCENT[accent].chipGlow,
                      animation: `lp-float 3s ease-in-out ${i * 0.35}s infinite`,
                    }}
                  >
                    {icon}
                  </div>
                ))}
              </div>

              <div className="mt-6 inline-flex flex-col items-center sm:items-start">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
                  Estimated Launch
                </span>
                <span className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-violet-500 to-cyan-500">
                  {ob.targetLaunchDate
                    ? formatDate(ob.targetLaunchDate)
                    : "Being scheduled"}
                </span>
              </div>
            </div>
            <ProgressRing percent={ob.progressPercent} />
          </div>
        </section>

        {/* ─── Build phases — Step timeline ─── */}
        <section className="lp-card" style={{ animationDelay: "0.1s" }}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-white" style={SYNE}>
              What we&apos;re building for you
            </h2>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
              {ob.phases.filter((p) => p.status === "done").length} of{" "}
              {ob.phases.length} done
            </span>
          </div>

          <div className="relative">
            {/* Vertical timeline line */}
            <div
              className="absolute left-[19px] top-3 bottom-3 w-[2px]"
              style={{
                background:
                  "linear-gradient(to bottom, transparent 0%, #334155 12%, #334155 88%, transparent 100%)",
              }}
            />

            <div className="space-y-10">
              {ob.phases.map((phase, i) => {
                const accent = PHASE_ACCENT[phase.id] || "blue";
                const isCenterpiece = phase.id === "portal";
                return (
                  <div key={phase.id} className="relative flex gap-4 sm:gap-6">
                    {/* Timeline dot */}
                    <div className="relative z-10 shrink-0">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-black border border-white/10">
                        {phase.status === "done" ? (
                          <div
                            className="h-5 w-5 rounded-full flex items-center justify-center bg-gradient-to-r from-blue-500 to-cyan-500"
                            style={{ animation: "lp-check-bounce 0.5s ease-out" }}
                          >
                            <Icon d={PATHS.check} size={12} className="text-white" />
                          </div>
                        ) : (
                          <div
                            className={`h-4 w-4 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 border border-blue-600 ${
                              phase.status === "in_progress" ? "animate-pulse" : "opacity-60"
                            }`}
                          />
                        )}
                      </div>
                    </div>

                    {/* Step content */}
                    <div className="flex-1 min-w-0">
                      <h3
                        className="text-xl font-bold text-neutral-500 mb-3"
                        style={SYNE}
                      >
                        Step {i + 1}
                      </h3>

                      {isCenterpiece ? (
                        <CenterpiecePhaseCard phase={phase} />
                      ) : (
                        <PhaseCard phase={phase} accent={accent} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── Client tasks ─── */}
        <section className="lp-card" style={{ animationDelay: "0.15s" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl sm:text-2xl font-bold text-white" style={SYNE}>
              What we need from you
            </h2>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              {tasksDone} of {ob.tasks.length} done
            </span>
          </div>
          <div className="space-y-4">
            {ob.tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                token={token}
                onSubmitted={() => {
                  celebrate();
                  load(false);
                }}
              />
            ))}
          </div>
        </section>

        {/* ─── Mission log ─── */}
        <section
          className="lp-card rounded-2xl p-6 sm:p-8 bg-white/5 border border-white/10"
          style={{ animationDelay: "0.2s" }}
        >
          <h2 className="text-lg font-bold text-white mb-4" style={SYNE}>
            Mission log 📡
          </h2>
          {ob.activity.length === 0 ? (
            <p className="text-sm text-neutral-400">
              Updates from your build will appear here.
            </p>
          ) : (
            <div className="space-y-3">
              {[...ob.activity].reverse().map((entry, i) => (
                <div key={`${entry.at}-${i}`} className="flex gap-3 items-start">
                  <div
                    className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                    style={{
                      background:
                        entry.actor === "client"
                          ? "#06B6D4"
                          : entry.actor === "agency"
                          ? "#3B82F6"
                          : "#8B5CF6",
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug text-neutral-300">
                      {entry.message}
                    </p>
                    <span className="text-[11px] text-neutral-500">
                      {timeAgo(entry.at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ─── Footer ─── */}
        <footer className="text-center pb-6 space-y-2">
          <p className="text-[11px] text-neutral-500">
            Questions? Your Nexli team is one message away.
          </p>
          <p className="text-[10px] text-neutral-600">
            {data.from.company || data.from.name} • Powered by the Digital
            Rainmaker System
          </p>
        </footer>
      </div>
    </div>
  );
}

// ─── Phase cards ───────────────────────────────────────────

function PhaseMeta({ phase, accent }: { phase: PhaseData; accent: Accent }) {
  const a = ACCENT[accent];
  return (
    <>
      {phase.targetDate && phase.status !== "done" && (
        <span className="text-[11px] font-semibold text-neutral-500">
          ETA {formatDate(phase.targetDate)}
        </span>
      )}
      {phase.completedAt && phase.status === "done" && (
        <span className="text-[11px] font-semibold text-neutral-500">
          Finished {formatDate(phase.completedAt)}
        </span>
      )}
      {phase.note && (
        <div className={`w-full mt-3 px-3 py-2 rounded-lg text-xs text-neutral-200 ${a.noteStrip}`}>
          <span className="font-bold text-white">Latest: </span>
          {phase.note}
        </div>
      )}
    </>
  );
}

function FeatureGrid({ features, accent }: { features: string[]; accent: Accent }) {
  const a = ACCENT[accent];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-4">
      {features.map((f) => (
        <div key={f} className="flex items-start gap-2 text-sm">
          <Icon d={PATHS.circleCheck} size={16} className={`${a.check} shrink-0 mt-0.5`} />
          <span className="text-neutral-300 text-[13px]">{f}</span>
        </div>
      ))}
    </div>
  );
}

function PhaseCard({ phase, accent }: { phase: PhaseData; accent: Accent }) {
  const a = ACCENT[accent];
  return (
    <div className="rounded-2xl p-5 sm:p-6 bg-white/5 border border-white/10">
      <div className="flex items-center gap-3 flex-wrap">
        <div className={`p-2 rounded-xl ${a.headerTile}`}>
          <Icon d={PHASE_ICON[phase.id] || PATHS.globe} size={24} className={a.headerIcon} />
        </div>
        <h4 className="text-lg sm:text-xl font-bold text-white flex-1 min-w-0">
          {phase.title}
        </h4>
        <PhasePill status={phase.status} accent={accent} />
      </div>
      <p className="text-sm leading-relaxed text-neutral-300 mt-3">
        {phase.description}
      </p>
      <div className="flex flex-wrap items-center gap-2 mt-2">
        <PhaseMeta phase={phase} accent={accent} />
      </div>
      {phase.features && <FeatureGrid features={phase.features} accent={accent} />}

      {/* Reputation management — the amber "secret weapon" callout */}
      {phase.id === "automations" && (
        <div className="mt-5 rounded-2xl p-4 sm:p-5 border-2 border-dashed border-yellow-500/30 bg-yellow-500/5">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/20 shrink-0">
              <GoogleGLogo size={20} />
            </div>
            <div>
              <p className="font-bold mb-1 text-yellow-400">
                Reputation Management — Your Secret Weapon
              </p>
              <p className="text-sm text-neutral-300">
                Automatic review requests route your happiest customers straight
                to Google. Most local businesses have 4 to 12 reviews sitting
                there — the ones dominating search have 80 or more. We build
                that engine for you.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// The portal build-out gets the Rainmaker "Centerpiece" treatment:
// shimmer conic border, cyan-tinted gradient interior, glowing icon.
function CenterpiecePhaseCard({ phase }: { phase: PhaseData }) {
  return (
    <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden p-[1.5px]">
      <span
        className="absolute inset-[-200%] animate-[shimmer_6s_linear_infinite] opacity-90"
        style={{ background: SHIMMER_CONIC }}
      />
      <span
        className="absolute inset-[-200%] animate-[shimmer_6s_linear_infinite] blur-xl opacity-30"
        style={{ background: SHIMMER_CONIC }}
      />
      <div className="relative z-10 rounded-[14px] sm:rounded-[22px] p-5 sm:p-7 bg-gradient-to-br from-slate-950 via-cyan-950/40 to-slate-950">
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/10 blur-[80px] rounded-full pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative shrink-0">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center bg-cyan-500/20 border border-cyan-500/30"
                style={{ filter: "drop-shadow(0 0 20px rgba(6, 182, 212, 0.3))" }}
              >
                <Icon d={PATHS.layoutDashboard} size={26} className="text-cyan-500" />
              </div>
              <span
                className="absolute inset-0 rounded-xl animate-ping opacity-20 bg-cyan-500"
                style={{ animationDuration: "3s" }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black tracking-[0.15em] uppercase text-cyan-300">
                <Icon d={PATHS.star} size={11} className="text-cyan-400" style={{ fill: "currentColor" }} />
                The Centerpiece
              </span>
              <h4 className="text-lg sm:text-xl font-black tracking-tight text-white">
                {phase.title}
              </h4>
            </div>
            <PhasePill status={phase.status} accent="cyan" />
          </div>

          <p className="text-sm leading-relaxed text-neutral-300 mt-3">
            {phase.description}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <PhaseMeta phase={phase} accent="cyan" />
          </div>

          {phase.features && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mt-4">
              {phase.features.map((f) => (
                <div
                  key={f}
                  className="rounded-xl p-3 border bg-white/5 border-white/10 hover:bg-cyan-500/10 hover:border-cyan-500/30 transition-all duration-300"
                >
                  <Icon d={PATHS.circleCheck} size={16} className="text-cyan-500 mb-1.5" />
                  <p className="text-[11px] sm:text-xs font-semibold text-white/80 leading-snug">
                    {f}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Task cards ────────────────────────────────────────────

function TaskCard({
  task,
  token,
  onSubmitted,
}: {
  task: TaskData;
  token: string;
  onSubmitted: () => void;
}) {
  const accent = TASK_ACCENT[task.id] || "blue";
  const a = ACCENT[accent];
  return (
    <div className="rounded-2xl p-5 sm:p-6 bg-white/5 border border-white/10">
      <div className="flex items-start gap-3">
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${a.chip}`}
          style={{ filter: a.chipGlow, animation: "lp-float 3.5s ease-in-out infinite" }}
        >
          {task.id === "fb_ads_invite" ? (
            <FacebookLogo size={24} />
          ) : task.id === "stripe_setup" ? (
            <StripeLogo size={24} />
          ) : (
            <Icon d={TASK_ICON[task.id] || PATHS.globe} size={24} className={a.icon} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm sm:text-base font-bold text-white">{task.title}</h3>
            <TaskPill task={task} accent={accent} />
          </div>
          <p className="text-xs sm:text-[13px] mt-1 leading-relaxed text-neutral-400">
            {task.description}
          </p>
          {task.adminNote && task.status === "needs_attention" && (
            <div className="mt-2 px-3 py-2 rounded-lg text-xs text-neutral-200 bg-yellow-500/10 border border-yellow-500/25">
              <span className="font-bold text-yellow-400">From your Nexli team: </span>
              {task.adminNote}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4">
        {task.type === "credentials" &&
          (task.id === "stripe_setup" ? (
            <StripeSetup task={task} token={token} onSubmitted={onSubmitted} accent={accent} />
          ) : (
            <DnsForm task={task} token={token} onSubmitted={onSubmitted} accent={accent} />
          ))}
        {task.type === "confirm" && (
          <FbConfirm task={task} token={token} onSubmitted={onSubmitted} accent={accent} />
        )}
        {task.type === "upload" && (
          <LicenseUpload task={task} token={token} onSubmitted={onSubmitted} accent={accent} />
        )}
      </div>
    </div>
  );
}

function SubmittedNote({
  children,
  accent,
}: {
  children: React.ReactNode;
  accent: Accent;
}) {
  const a = ACCENT[accent];
  return (
    <div className={`flex items-center gap-2 px-4 py-3 rounded-xl ${a.successStrip}`}>
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-gradient-to-br from-blue-500 to-cyan-500"
        style={{ animation: "lp-check-bounce 0.5s ease-out" }}
      >
        <Icon d={PATHS.check} size={14} className="text-white" />
      </div>
      <span className="text-xs font-semibold text-white">{children}</span>
    </div>
  );
}

const CTA_CLASSES =
  "flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-full text-sm font-bold hover:bg-blue-500 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-blue-600/20 disabled:opacity-50 disabled:hover:scale-100";

// ── DNS / registrar credentials form ──

function DnsForm({
  task,
  token,
  onSubmitted,
  accent,
}: {
  task: TaskData;
  token: string;
  onSubmitted: () => void;
  accent: Accent;
}) {
  const [registrar, setRegistrar] = useState("");
  const [loginUrl, setLoginUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [notes, setNotes] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Local flag so the just-typed values vanish immediately on success
  const [justSent, setJustSent] = useState(false);

  const done =
    justSent || task.status === "submitted" || task.status === "approved";

  if (done) {
    return (
      <SubmittedNote accent={accent}>
        Got it — we&apos;ll take it from here. Your login details are locked away
        and only visible to your Nexli team.
      </SubmittedNote>
    );
  }

  async function handleSubmit() {
    if (!registrar || !username.trim() || !password) {
      setError("Registrar, username, and password are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/onboarding/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: "dns_access",
          submission: { registrar, loginUrl, username, password, notes },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Something went wrong. Please try again.");
        return;
      }
      setJustSent(true);
      setPassword("");
      onSubmitted();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const labelCls =
    "block text-[10px] font-black uppercase tracking-[0.2em] mb-1.5 text-neutral-500";

  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Where&apos;s your domain? *</label>
          <select
            value={registrar}
            onChange={(e) => setRegistrar(e.target.value)}
            className="lp-input"
          >
            <option value="">Select registrar…</option>
            {REGISTRARS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Login URL (optional)</label>
          <input
            type="url"
            value={loginUrl}
            onChange={(e) => setLoginUrl(e.target.value)}
            placeholder="https://…"
            className="lp-input"
          />
        </div>
        <div>
          <label className={labelCls}>Username / Email *</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="you@business.com"
            className="lp-input"
            autoComplete="off"
          />
        </div>
        <div>
          <label className={labelCls}>Password *</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="lp-input pr-16"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-wider text-neutral-500 hover:text-neutral-300"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>
      </div>
      <div>
        <label className={labelCls}>Anything else we should know?</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="2FA codes go to my cell, the account is under my partner's name, etc."
          className="lp-input resize-none"
        />
      </div>

      {error && <p className="text-xs font-semibold text-rose-400">{error}</p>}

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <button onClick={handleSubmit} disabled={submitting} className={CTA_CLASSES}>
          {submitting ? "Sending securely…" : "Send access securely →"}
        </button>
        <div className="flex items-center gap-1.5">
          <Icon d={PATHS.lock} size={14} className="text-emerald-400 shrink-0" />
          <span className="text-[11px] text-neutral-500">
            Sent over an encrypted connection — visible only to your Nexli team
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Stripe account setup (guided + confirm) ──

const STRIPE_GROUND_RULES = [
  "Legal business name & address",
  "EIN (or SSN for sole proprietors)",
  "Business bank account & routing number for payouts",
  "Government-issued ID for identity verification",
];

function StripeSetup({
  task,
  token,
  onSubmitted,
  accent,
}: {
  task: TaskData;
  token: string;
  onSubmitted: () => void;
  accent: Accent;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notes, setNotes] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Local flag so the just-typed login vanishes immediately on success
  const [justSent, setJustSent] = useState(false);

  const done =
    justSent || task.status === "submitted" || task.status === "approved";

  if (done) {
    return (
      <SubmittedNote accent={accent}>
        Stripe is live — your payment rails are connected. Your login is locked
        away and only visible to your Nexli team. 🎉
      </SubmittedNote>
    );
  }

  async function handleSubmit() {
    if (!email.trim() || !password) {
      setError("Your Stripe login email and password are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/onboarding/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: "stripe_setup",
          submission: { email, password, notes },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Something went wrong. Please try again.");
        return;
      }
      setJustSent(true);
      setPassword("");
      onSubmitted();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const a = ACCENT[accent];
  const labelCls =
    "block text-[10px] font-black uppercase tracking-[0.2em] mb-1.5 text-neutral-500";

  return (
    <div className="space-y-4">
      {/* Ground rules — have these ready */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 mb-2">
          Have these ready
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {STRIPE_GROUND_RULES.map((rule) => (
            <div key={rule} className="flex items-start gap-2 text-sm">
              <Icon
                d={PATHS.circleCheck}
                size={16}
                className={`${a.check} shrink-0 mt-0.5`}
              />
              <span className="text-neutral-300 text-[13px]">{rule}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-neutral-500 mt-2">
          Stripe verifies your identity (KYC) — answer their prompts exactly as
          your business is registered.
        </p>
      </div>

      {/* Steps */}
      <ol className="text-xs sm:text-[13px] space-y-1.5 pl-4 list-decimal leading-relaxed text-neutral-400">
        <li>
          <span className="font-semibold text-white">Create your account</span>{" "}
          at stripe.com — or sign in if your business already has one
        </li>
        <li>
          Complete the <span className="font-semibold text-white">business profile</span>{" "}
          with the info above
        </li>
        <li>
          Finish Stripe&apos;s{" "}
          <span className="font-semibold text-white">identity (KYC) verification</span>
        </li>
        <li>
          Come back and{" "}
          <span className="font-semibold text-white">share your login below</span>{" "}
          — already have a Stripe account? Just drop the login now
        </li>
      </ol>

      {/* The frame: why this matters */}
      <div className="rounded-xl px-4 py-3 bg-white/5 border border-white/15">
        <p className="text-xs text-neutral-300">
          <span className="font-bold text-white">Heads up: </span>
          no Stripe account = no way for us to collect payments for you. This
          one unlocks everything else.
        </p>
      </div>

      {/* Stripe login handoff */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Stripe login email *</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@business.com"
            className="lp-input"
            autoComplete="off"
          />
        </div>
        <div>
          <label className={labelCls}>Stripe password *</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="lp-input pr-16"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-wider text-neutral-500 hover:text-neutral-300"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>
      </div>
      <div>
        <label className={labelCls}>Anything else we should know?</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="2FA codes go to my cell, account is under my partner's email, etc."
          className="lp-input resize-none"
        />
      </div>

      {error && <p className="text-xs font-semibold text-rose-400">{error}</p>}

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex flex-wrap gap-3">
          <a
            href="https://dashboard.stripe.com/register"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 bg-[#635BFF] text-white px-6 py-3 rounded-full text-sm font-bold no-underline hover:bg-[#7a73ff] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-[#635BFF]/25"
          >
            Open Stripe →
          </a>
          <button onClick={handleSubmit} disabled={submitting} className={CTA_CLASSES}>
            {submitting ? "Sending securely…" : "Send my Stripe login securely →"}
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <Icon d={PATHS.lock} size={14} className="text-emerald-400 shrink-0" />
          <span className="text-[11px] text-neutral-500">
            Encrypted — visible only to your Nexli team
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Facebook Ads invite confirm ──

function FbConfirm({
  task,
  token,
  onSubmitted,
  accent,
}: {
  task: TaskData;
  token: string;
  onSubmitted: () => void;
  accent: Accent;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localResult, setLocalResult] = useState<"confirmed" | "skipped" | null>(null);

  const skipped =
    localResult === "skipped" || Boolean(task.submission?.notApplicable);
  const done =
    localResult !== null ||
    task.status === "submitted" ||
    task.status === "approved";

  if (done) {
    return skipped ? (
      <SubmittedNote accent={accent}>
        No problem — we&apos;ve marked this one as not applicable.
      </SubmittedNote>
    ) : (
      <SubmittedNote accent={accent}>
        Invite received on our end soon — we&apos;ll confirm once we&apos;re connected!
      </SubmittedNote>
    );
  }

  async function submit(notApplicable: boolean) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/onboarding/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: "fb_ads_invite",
          submission: notApplicable ? { notApplicable: true } : { confirmed: true },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Something went wrong. Please try again.");
        return;
      }
      setLocalResult(notApplicable ? "skipped" : "confirmed");
      onSubmitted();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <ol className="text-xs sm:text-[13px] space-y-1.5 pl-4 list-decimal leading-relaxed text-neutral-400">
        <li>
          Open{" "}
          <span className="font-semibold text-white">
            Meta Business Settings → Partners
          </span>
        </li>
        <li>
          Click{" "}
          <span className="font-semibold text-white">
            Add → Give a partner access to your assets
          </span>
        </li>
        <li>
          Enter our Business ID (from your welcome email) and grant access to
          your ad account
        </li>
      </ol>

      {error && <p className="text-xs font-semibold text-rose-400">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => submit(false)}
          disabled={submitting}
          className={CTA_CLASSES}
        >
          I sent the invite ✓
        </button>
        <button
          onClick={() => submit(true)}
          disabled={submitting}
          className="px-5 py-3 rounded-full text-sm font-semibold text-neutral-400 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white transition-all active:scale-[0.98] disabled:opacity-50"
        >
          I don&apos;t run Facebook Ads
        </button>
      </div>
    </div>
  );
}

// ── Driver's license upload ──

function LicenseUpload({
  task,
  token,
  onSubmitted,
  accent,
}: {
  task: TaskData;
  token: string;
  onSubmitted: () => void;
  accent: Accent;
}) {
  const done = task.status === "submitted" || task.status === "approved";

  if (done) {
    return (
      <SubmittedNote accent={accent}>
        Both sides received — we&apos;re getting your business number verified. 🎉
      </SubmittedNote>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <LicenseSideDropzone
        side="front"
        existing={task.files?.front ?? null}
        token={token}
        onSubmitted={onSubmitted}
      />
      <LicenseSideDropzone
        side="back"
        existing={task.files?.back ?? null}
        token={token}
        onSubmitted={onSubmitted}
      />
    </div>
  );
}

function LicenseSideDropzone({
  side,
  existing,
  token,
  onSubmitted,
}: {
  side: "front" | "back";
  existing: { fileName: string; uploadedAt: string } | null;
  token: string;
  onSubmitted: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localFileName, setLocalFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadedName = localFileName || existing?.fileName || null;

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("side", side);
      formData.append("file", file);
      const res = await fetch(`/api/onboarding/${token}/upload`, {
        method: "POST",
        body: formData,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Upload failed. Please try again.");
        return;
      }
      setLocalFileName(file.name);
      onSubmitted();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={`w-full rounded-xl p-4 text-center transition-all active:scale-[0.99] disabled:opacity-60 ${
          uploadedName
            ? "bg-amber-500/10 border border-amber-500/30"
            : "bg-white/5 border-2 border-dashed border-white/15 hover:border-amber-500/40"
        }`}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2 py-1">
            <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-semibold text-neutral-400">Uploading…</span>
          </div>
        ) : uploadedName ? (
          <div className="flex flex-col items-center gap-1 py-1">
            <Icon d={PATHS.circleCheck} size={20} className="text-amber-400" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">
              {side} uploaded
            </span>
            <span className="text-xs font-semibold text-white truncate max-w-full">
              {uploadedName}
            </span>
            <span className="text-[10px] text-neutral-500">Tap to replace</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 py-2">
            <div className="p-2 rounded-lg bg-amber-500/20">
              <Icon d={PATHS.idCard} size={20} className="text-amber-400" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">
              License {side}
            </span>
            <span className="text-[11px] text-neutral-500">
              Tap to snap a photo or choose a file
            </span>
          </div>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {error && (
        <p className="text-xs font-semibold mt-1.5 text-rose-400">{error}</p>
      )}
    </div>
  );
}
