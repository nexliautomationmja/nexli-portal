"use client";

import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import type { ParsedEvidence } from "@/lib/ads/parse";
import { Ico } from "@/components/ads/parts";
import { VIZ } from "@/components/ads/viz";

export const VERDICT: Record<string, { label: string; cls: string }> = {
  too_early: { label: "Too early to call", cls: "border-white/15 bg-white/5 text-neutral-200" },
  hold_steady: { label: "Hold steady", cls: "border-emerald-400/30 bg-emerald-500/15 text-emerald-200" },
  optimize: { label: "Optimize", cls: "border-blue-400/30 bg-blue-500/15 text-blue-200" },
  refresh_creatives: { label: "Refresh creatives", cls: "border-amber-400/30 bg-amber-500/15 text-amber-200" },
  fix_tracking: { label: "Fix tracking first", cls: "border-rose-400/30 bg-rose-500/15 text-rose-200" },
  scale: { label: "Scale", cls: "border-emerald-400/30 bg-emerald-500/15 text-emerald-200" },
  rethink: { label: "Rethink", cls: "border-rose-400/30 bg-rose-500/15 text-rose-200" },
};

export function VerdictPill({ verdict }: { verdict: string | null }) {
  const v = VERDICT[verdict ?? ""] ?? { label: verdict ?? "—", cls: "border-white/15 bg-white/5 text-neutral-200" };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider ${v.cls}`}>{v.label}</span>;
}

export function scoreBand(score: number | null): { label: string; color: string; icon: React.ReactNode } {
  if (score === null) return { label: "No score", color: VIZ.previous, icon: <path d="M12 8v4M12 16h.01" /> };
  if (score >= 75) return { label: "Healthy", color: VIZ.status.good, icon: <path d="M20 6 9 17l-5-5" /> };
  if (score >= 50) return { label: "Needs work", color: VIZ.status.warning, icon: <path d="M12 9v4M12 17h.01" /> };
  return { label: "At risk", color: VIZ.status.critical, icon: <path d="m15 9-6 6M9 9l6 6" /> };
}

/** Health score: a meter ring whose color carries the band, with an icon + label (never color alone). */
export function ScoreRing({ score, size = 116 }: { score: number | null; size?: number }) {
  const R = 46;
  const C = 2 * Math.PI * R;
  const v = score === null ? 0 : Math.max(0, Math.min(100, score));
  const band = scoreBand(score);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="meter" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={`Health ${v} of 100, ${band.label}`}>
      <svg viewBox="0 0 110 110" className="h-full w-full -rotate-90">
        <circle cx="55" cy="55" r={R} fill="none" stroke={`${band.color}2e`} strokeWidth="9" />
        <circle
          cx="55"
          cy="55"
          r={R}
          fill="none"
          stroke={band.color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C - (v / 100) * C}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black leading-none text-white" style={{ ...NUM_FONT, fontVariantNumeric: "lining-nums proportional-nums" }}>
          {score ?? "—"}
        </span>
        <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: band.color }}>
          <Ico d={band.icon} size={10} />
          {band.label}
        </span>
      </div>
    </div>
  );
}

export function EvidenceChips({ items, onJump }: { items: ParsedEvidence[]; onJump?: (e: ParsedEvidence) => void }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((e, i) => {
        const clickable = Boolean(onJump && e.refId && e.refLevel === "ad");
        const Tag = clickable ? "button" : "span";
        return (
          <Tag
            key={i}
            type={clickable ? "button" : undefined}
            onClick={clickable ? () => onJump?.(e) : undefined}
            className={`inline-flex max-w-full items-center gap-1 rounded-lg border px-2 py-1 text-[11px] ${
              e.mismatch ? "border-amber-400/40 bg-amber-500/10 text-amber-100" : "border-white/10 bg-white/[0.05] text-neutral-300"
            } ${clickable ? "hover:border-cyan-400/40 hover:text-white" : ""}`}
            title={e.mismatch ? "This number doesn't match the data Manus was given — double-check it" : undefined}
            style={NUM_FONT}
          >
            {e.mismatch && <Ico d={<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3ZM12 9v4M12 17h.01" />} size={11} />}
            <span className="truncate text-neutral-400">{e.label}</span>
            <b className="shrink-0 text-white">{e.display}</b>
            {e.baselineDisplay && <span className="shrink-0 text-neutral-500">was {e.baselineDisplay}</span>}
          </Tag>
        );
      })}
    </div>
  );
}

export const KIND: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  refresh_creatives: { label: "Refresh creatives", color: "#d8b4fe", icon: <path d="M3 5h18v14H3zM3 15l5-5 4 4 3-3 6 6" /> },
  pause: { label: "Pause", color: "#fda4af", icon: <path d="M10 15V9m4 6V9M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" /> },
  scale_budget: { label: "Scale budget", color: "#86efac", icon: <path d="m22 7-8.5 8.5-5-5L2 17M16 7h6v6" /> },
  reduce_budget: { label: "Reduce budget", color: "#fdba74", icon: <path d="m22 17-8.5-8.5-5 5L2 7M16 17h6v-6" /> },
  reallocate_budget: { label: "Move budget", color: "#93c5fd", icon: <path d="M8 3 4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4" /> },
  wait_and_watch: { label: "Wait & watch", color: "#cbd5e1", icon: <path d="M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" /> },
  launch_test: { label: "Launch a test", color: "#67e8f9", icon: <path d="M10 2v7.31M14 9.3V2M8.5 2h7M14 9.3a6.5 6.5 0 1 1-4 0M5.52 16h12.96" /> },
  consolidate: { label: "Consolidate", color: "#93c5fd", icon: <path d="M4 12h16M12 4v16" /> },
  fix_tracking: { label: "Fix tracking", color: "#fda4af", icon: <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM12 6v6l3 3" /> },
  landing_page: { label: "Landing page", color: "#a5b4fc", icon: <path d="M3 4h18v16H3zM3 9h18" /> },
  audience: { label: "Audience", color: "#f9a8d4", icon: <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /> },
  placements: { label: "Placements", color: "#a5b4fc", icon: <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" /> },
  bid_strategy: { label: "Bid strategy", color: "#fcd34d", icon: <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /> },
  optimization_event: { label: "Optimization event", color: "#67e8f9", icon: <path d="M12 2 2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5" /> },
  copy_or_offer: { label: "Copy / offer", color: "#d8b4fe", icon: <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /> },
  other: { label: "Step", color: "#cbd5e1", icon: <path d="M5 12h14M12 5l7 7-7 7" /> },
};

export function KindChip({ kind }: { kind: string }) {
  const k = KIND[kind] ?? KIND.other;
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10" style={{ background: `${k.color}1a`, color: k.color }} title={k.label}>
      <Ico d={k.icon} size={16} />
    </span>
  );
}

export const PRIORITY: Record<string, { label: string; cls: string }> = {
  now: { label: "Do now", cls: "border-rose-400/30 bg-rose-500/15 text-rose-200" },
  this_week: { label: "This week", cls: "border-amber-400/30 bg-amber-500/15 text-amber-200" },
  next_week: { label: "Next week", cls: "border-blue-400/30 bg-blue-500/15 text-blue-200" },
  later: { label: "Later", cls: "border-white/15 bg-white/5 text-neutral-300" },
};

export const when = (iso: string | null | undefined, tz?: string) =>
  iso ? new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", ...(tz ? { timeZone: tz } : {}) }) : "—";
export const day = (iso: string | null | undefined, tz?: string) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", ...(tz ? { timeZone: tz } : {}) }) : "—";
