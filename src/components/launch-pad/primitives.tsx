// ─── Launch Pad visual primitives ──────────────────────────
// Shared by the client Launch Pad (onboarding) and the pulse-check survey.
// Styled to match the Digital Rainmaker page (nexli.net/rainmaker):
// #020617 bg, Syne gradient headlines, color-coded accents, floating
// tinted icon chips, shimmer conic borders.

import { NexliLogo } from "@/components/ui/nexli-logo";
import { Icon, PATHS } from "./icons";

export const SYNE = { fontFamily: "var(--font-syne), sans-serif" };

// ─── Color system (literal Tailwind classes per accent) ────

export type Accent = "blue" | "violet" | "cyan" | "amber" | "emerald" | "stripe";

export const ACCENT = {
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

export const SHIMMER_CONIC =
  "conic-gradient(from 0deg at 50% 50%, #06B6D4, #3B82F6, #8B5CF6, #06B6D4, #3B82F6, #06B6D4)";
export const SHIMMER_CONIC_WARM =
  "conic-gradient(from 0deg at 50% 50%, #3B82F6, #8B5CF6, #06B6D4, #F59E0B, #3B82F6)";

// ─── Shimmer-border pill (Rainmaker badge) ─────────────────
// Local variant: takes a `conic` prop and uses the page's #020617 interior
// (not the one in @/components/ui/shimmer-pill).

export function ShimmerPill({
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

// ─── Buttons / labels ──────────────────────────────────────

export const CTA_CLASSES =
  "flex items-center justify-center gap-2 min-h-11 bg-blue-600 text-white px-6 py-3 rounded-full text-sm font-bold hover:bg-blue-500 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-blue-600/20 disabled:opacity-50 disabled:hover:scale-100";

export const SECONDARY_BTN =
  "min-h-11 px-5 py-3 rounded-full text-sm font-semibold text-neutral-400 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white transition-all active:scale-[0.98] disabled:opacity-50";

export const labelCls =
  "block text-[10px] font-black uppercase tracking-[0.2em] mb-1.5 text-neutral-500";

// ─── Progress Ring (gradient stroke) ───────────────────────

export function ProgressRing({ percent }: { percent: number }) {
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

// ─── Submitted strip (bouncing gradient check) ─────────────

export function SubmittedNote({
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

// ─── Card ──────────────────────────────────────────────────

export function LpCard({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`${className ? `${className} ` : ""}rounded-2xl p-5 sm:p-6 bg-white/5 border border-white/10`}
      style={style}
    >
      {children}
    </div>
  );
}

// ─── Floating tinted icon chip ─────────────────────────────

export function IconChip({
  accent,
  children,
  float = true,
  delay,
}: {
  accent: Accent;
  children: React.ReactNode;
  float?: boolean;
  /** Optional animation-delay (e.g. "0.35s") to stagger several chips. */
  delay?: string;
}) {
  const a = ACCENT[accent];
  return (
    <div
      className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${a.chip}`}
      style={{
        filter: a.chipGlow,
        animation: float
          ? delay
            ? `lp-float 3.5s ease-in-out ${delay} infinite`
            : "lp-float 3.5s ease-in-out infinite"
          : undefined,
      }}
    >
      {children}
    </div>
  );
}

// ─── Status pill ───────────────────────────────────────────

export type PillTone = "done" | "neutral" | "warn" | "info";

const PILL_TONE: Record<Exclude<PillTone, "done">, string> = {
  neutral: "bg-white/5 text-neutral-400 border border-white/10",
  warn: "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30",
  info: "bg-white/10 text-white/70 border border-white/10",
};

export function Pill({
  tone,
  accent = "blue",
  children,
}: {
  tone: PillTone;
  accent?: Accent;
  children: React.ReactNode;
}) {
  const cls = tone === "done" ? ACCENT[accent].badgeDone : PILL_TONE[tone];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${cls}`}>
      {children}
    </span>
  );
}

// ─── Spinner ───────────────────────────────────────────────

export function LpSpinner({ fullScreen = false }: { fullScreen?: boolean }) {
  const spinner = (
    <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
  );
  if (fullScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020617]">
        {spinner}
      </div>
    );
  }
  return <div className="flex items-center justify-center py-16">{spinner}</div>;
}

// ─── Full-page message (error / empty state) ───────────────

export function LpMessage({
  emoji,
  title,
  body,
}: {
  emoji: string;
  title: string;
  body: string;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-[#020617]">
      <NexliLogo size="md" />
      <div className="max-w-md w-full p-8 mt-8 space-y-3 rounded-2xl bg-white/5 border border-white/10">
        <div className="text-4xl">{emoji}</div>
        <h1 className="text-lg font-bold text-white">{title}</h1>
        <p className="text-sm text-neutral-400">{body}</p>
      </div>
    </div>
  );
}

// ─── Shimmer-border card (celebration banner) ──────────────

export function ShimmerCard({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`${className ? `${className} ` : ""}relative rounded-2xl overflow-hidden p-[1.5px]`}
      style={style}
    >
      <span
        className="absolute inset-[-200%] animate-[shimmer_6s_linear_infinite] opacity-90"
        style={{ background: SHIMMER_CONIC }}
      />
      <div className="relative z-10 rounded-[14px] p-6 text-center bg-gradient-to-br from-slate-950 via-cyan-950/40 to-slate-950">
        {children}
      </div>
    </div>
  );
}
