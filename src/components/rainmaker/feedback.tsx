"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Clock3, FileSearch, Info, Sparkles, X, XCircle } from "lucide-react";
import { CHIP_TONE, DOT_TONE, ICON_TONE, NUM_FONT, SYNE, type Tone } from "./tokens";

// ─── Chips ─────────────────────────────────────────────────

/** Status / label pill. Always says what it means in words (color is a bonus). */
export function Chip({
  tone = "neutral",
  size = "sm",
  dot = false,
  icon,
  className = "",
  children,
}: {
  tone?: Tone;
  size?: "sm" | "xs";
  dot?: boolean;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full border font-semibold ${
        size === "xs" ? "px-1.5 py-px text-[10px]" : "px-2 py-0.5 text-[11px]"
      } ${CHIP_TONE[tone]} ${className}`}
    >
      {dot && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_TONE[tone]}`} aria-hidden="true" />}
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}

/** Says which period a number covers ("Last 7 days", "All time"). */
export function PeriodChip({ children }: { children: React.ReactNode }) {
  return (
    <Chip size="xs" icon={<Clock3 className="h-2.5 w-2.5" aria-hidden="true" />}>
      {children}
    </Chip>
  );
}

export function StatusDot({ tone, className = "" }: { tone: Tone; className?: string }) {
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${DOT_TONE[tone]} ${className}`} aria-hidden="true" />;
}

// ─── Notices ───────────────────────────────────────────────

const NOTICE = {
  info: { cls: "border-cyan-400/25 bg-cyan-500/[0.07] text-cyan-50", icon: Info, iconCls: "text-cyan-300" },
  warn: { cls: "border-amber-400/30 bg-amber-500/[0.08] text-amber-50", icon: AlertTriangle, iconCls: "text-amber-300" },
  error: { cls: "border-rose-500/30 bg-rose-500/10 text-rose-100", icon: XCircle, iconCls: "text-rose-300" },
  success: { cls: "border-emerald-400/30 bg-emerald-500/[0.08] text-emerald-50", icon: CheckCircle2, iconCls: "text-emerald-300" },
} as const;

/** A one-line (or short) message strip. Errors are announced; the rest are polite. */
export function Notice({
  tone = "info",
  title,
  action,
  onClose,
  className = "",
  children,
}: {
  tone?: keyof typeof NOTICE;
  title?: React.ReactNode;
  action?: React.ReactNode;
  onClose?: () => void;
  className?: string;
  children?: React.ReactNode;
}) {
  const n = NOTICE[tone];
  const Ico = n.icon;
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${n.cls} ${className}`}>
      <Ico className={`mt-0.5 h-4 w-4 shrink-0 ${n.iconCls}`} aria-hidden="true" />
      <div className="min-w-0 flex-1 leading-relaxed">
        {title && <div className="font-bold">{title}</div>}
        {children && <div className={title ? "mt-0.5 opacity-90" : ""}>{children}</div>}
        {action && <div className="mt-2 flex flex-wrap items-center gap-2">{action}</div>}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
          className="-mr-2 -mt-1.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full opacity-70 transition hover:bg-white/10 hover:opacity-100"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

// ─── Empty, loading, hints ─────────────────────────────────

/** Nothing here (yet): icon, Syne title, one line of why, and the next step. */
export function EmptyState({
  icon,
  tone = "cyan",
  title,
  body,
  action,
  className = "",
}: {
  icon: React.ReactNode;
  tone?: Tone;
  title: React.ReactNode;
  body?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-10 text-center ${className}`}>
      <span className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${ICON_TONE[tone]}`}>{icon}</span>
      <h3 className="mt-4 text-base font-bold text-white" style={SYNE}>
        {title}
      </h3>
      {body && <div className="mt-1.5 max-w-md text-sm text-neutral-400">{body}</div>}
      {action && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-white/[0.05] motion-reduce:animate-none ${className}`} aria-hidden="true" />;
}

/**
 * "How to read this": extra explanation behind a tap, instead of hover tooltips
 * that phones can't show.
 */
export function InfoDisclosure({ summary, className = "", children }: { summary: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <details className={`group text-xs text-neutral-400 ${className}`}>
      <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1 font-semibold text-cyan-300 hover:underline [&::-webkit-details-marker]:hidden">
        {summary}
        <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="mt-2 space-y-1.5 rounded-xl border border-white/10 bg-black/20 p-3 leading-relaxed">{children}</div>
    </details>
  );
}

// ─── AI at work ────────────────────────────────────────────

/**
 * "Claude is working" — the Ads Command Center look: sparkles tile, title,
 * elapsed m:ss and a Working chip, the current step in shimmer text, then
 * `children` (e.g. cs-sweep placeholders) and a note. `now` freezes the clock
 * (fixtures); otherwise it ticks every second.
 */
export function AiWorking({
  title,
  step,
  startedAt,
  now: fixedNow,
  note,
  children,
}: {
  title: React.ReactNode;
  step?: React.ReactNode;
  startedAt: number;
  now?: number;
  note?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const [tick, setTick] = useState(startedAt);
  useEffect(() => {
    if (fixedNow != null) return;
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [fixedNow]);
  const secs = Math.max(0, Math.floor(((fixedNow ?? tick) - startedAt) / 1000));
  const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  return (
    <div role="status" aria-live="polite" className="overflow-hidden rounded-3xl border border-blue-400/25 bg-gradient-to-br from-blue-600/[0.12] via-[#0b1220] to-violet-600/[0.08]">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/5 px-4 py-3 sm:px-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/20 text-blue-200" style={{ animation: "cs-pulse-ring 2s infinite" }}>
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        </span>
        <h3 className="text-[15px] font-bold text-white" style={SYNE}>
          {title}
        </h3>
        <span className="ml-auto flex items-center gap-2">
          <span className="text-xs text-neutral-400" style={NUM_FONT} aria-label={`${secs} seconds so far`}>
            {clock}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/15 px-2.5 py-0.5 text-[11px] font-bold text-blue-200">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-300" aria-hidden="true" />
            Working
          </span>
        </span>
      </div>
      <div className="space-y-4 px-4 py-4 sm:px-5">
        {step && (
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-3.5 py-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-300">
              <FileSearch className="h-4 w-4" aria-hidden="true" />
            </span>
            <p className="cs-shimmer-text min-w-0 flex-1 truncate text-sm font-semibold">{step}</p>
          </div>
        )}
        {children}
        {note && <p className="text-xs text-neutral-400">{note}</p>}
      </div>
    </div>
  );
}
