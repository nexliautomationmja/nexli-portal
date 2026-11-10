"use client";

import { NUM_FONT } from "@/components/engagement-launch-pad/styles";
import { change } from "@/lib/ads/format";
import type { Delta, FatigueState, Severity } from "@/lib/ads/types";
import { FATIGUE, SEVERITY, VIZ } from "@/components/ads/viz";

// Shared look now lives in the Rainmaker kit; re-exported so Ads imports keep working.
export { BIG_NUM, SectionHead, Skeleton, Surface as Glass } from "@/components/rainmaker";

const ARROW_UP = <path d="m5 12 7-7 7 7M12 19V5" />;
const ARROW_DOWN = <path d="M12 5v14M19 12l-7 7-7-7" />;

export function Ico({ d, size = 14, className, color }: { d: React.ReactNode; size?: number; className?: string; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? "currentColor"} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {d}
    </svg>
  );
}

/** ▲/▼ + % change; green when it moved the good way, rose when not, grey when neutral or too little data. */
export function DeltaChip({ delta, vs, size = "sm" }: { delta: Delta | undefined; vs?: string; size?: "sm" | "xs" }) {
  if (!delta || delta.rel === null) return <span className="text-[11px] text-neutral-500">{vs ? `no ${vs} to compare` : "—"}</span>;
  const tone = delta.lowVolume || delta.better === null ? "neutral" : delta.better ? "good" : "bad";
  const cls =
    tone === "good" ? "bg-emerald-500/10 text-emerald-300 ring-emerald-400/20" : tone === "bad" ? "bg-rose-500/10 text-rose-300 ring-rose-400/20" : "bg-white/5 text-neutral-400 ring-white/10";
  const up = delta.rel > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-bold ring-1 ${cls} ${size === "xs" ? "text-[10px]" : "text-[11px]"}`}
      style={NUM_FONT}
      title={delta.lowVolume ? "Low volume — not enough data on both sides to trust this move" : vs ? `vs ${vs}` : undefined}
    >
      {delta.rel !== 0 && <Ico d={up ? ARROW_UP : ARROW_DOWN} size={size === "xs" ? 9 : 10} />}
      {change(delta.rel)}
      {delta.lowVolume && <span className="font-semibold opacity-70">· low vol.</span>}
    </span>
  );
}

/** Tiny trend line (de-emphasis track, accent line, end dot). */
export function Sparkline({ values, color = VIZ.current, height = 28, className = "" }: { values: (number | null)[]; color?: string; height?: number; className?: string }) {
  const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null && Number.isFinite(p.v));
  if (pts.length < 2) return <div style={{ height }} className={className} />;
  const w = 100;
  const min = Math.min(...pts.map((p) => p.v));
  const max = Math.max(...pts.map((p) => p.v));
  const span = max - min || 1;
  const n = Math.max(1, values.length - 1);
  const x = (i: number) => (i / n) * w;
  const y = (v: number) => height - 3 - ((v - min) / span) * (height - 6);
  const d = pts.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(2)},${y(p.v).toFixed(2)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className={`w-full overflow-visible ${className}`} style={{ height }} aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last.i)} cy={y(last.v)} r={2.6} fill={color} stroke={VIZ.surface} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

const STATE_ICON: Record<FatigueState, React.ReactNode> = {
  too_early: <path d="M5 22h14M5 2h14M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2" />,
  fresh: <path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1" />,
  healthy: <path d="M20 6 9 17l-5-5" />,
  watch: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  fatigued: (
    <>
      <rect x="2" y="7" width="16" height="10" rx="2" />
      <path d="M22 11v2M6 11v2" />
    </>
  ),
  dead: <path d="M18 6 6 18M6 6l12 12" />,
  inactive: <path d="M10 15V9m4 6V9M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" />,
};

export function StateBadge({ state, small }: { state: FatigueState; small?: boolean }) {
  const f = FATIGUE[state];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-bold ${small ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]"}`}
      style={{ color: f.tone === "neutral" ? "#cbd5e1" : f.color, borderColor: `${f.color}55`, background: `${f.color}1a` }}
    >
      <Ico d={STATE_ICON[state]} size={small ? 10 : 11} />
      {f.label}
    </span>
  );
}

const SEV_ICON: Record<Severity | "ok", React.ReactNode> = {
  ok: <path d="M20 6 9 17l-5-5" />,
  good: <path d="m22 7-8.5 8.5-5-5L2 17M16 7h6v6" />,
  info: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </>
  ),
  warning: <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3ZM12 9v4M12 17h.01" />,
  critical: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6M9 9l6 6" />
    </>
  ),
};

export function SeverityIcon({ severity, size = 15 }: { severity: Severity | "ok"; size?: number }) {
  const s = SEVERITY[severity];
  return (
    <span className="flex shrink-0 items-center justify-center rounded-lg" style={{ width: size + 13, height: size + 13, background: `${s.color}1f`, color: s.color }} aria-label={s.label}>
      <Ico d={SEV_ICON[severity]} size={size} />
    </span>
  );
}

/** Ratio against a limit: same-hue track, colored fill. */
export function Meter({ value, color = VIZ.current, label }: { value: number | null; color?: string; label?: string }) {
  const v = value === null ? 0 : Math.max(0, Math.min(1, value));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: `${color}2e` }} role="meter" aria-valuenow={Math.round(v * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(v > 0 ? 3 : 0, v * 100)}%`, background: color }} />
    </div>
  );
}

export const ExternalIcon = () => <Ico d={<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />} size={11} />;

export function AdsManagerLink({ href, label = "Open in Ads Manager", className = "" }: { href: string; label?: string; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-cyan-300 hover:text-cyan-200 hover:underline ${className}`}>
      {label} <ExternalIcon />
    </a>
  );
}
