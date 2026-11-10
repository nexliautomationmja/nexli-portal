// ─── Rainmaker design tokens ───────────────────────────────
// The one design language of the Digital Rainmaker System dashboard pages
// (Ads Command Center, Creative Studio, Engagements, Client Tracker, Overview).
//
// Rules of thumb:
// - Syne (SYNE) only on word headings. Figures use Plus Jakarta Sans:
//   BIG_NUM for standalone numbers, NUM_FONT for columns and meta lines.
// - Hues mean things: blue = primary/selected, cyan = links/focus/eyebrows,
//   violet = AI/Manus/enterprise, green = good/paid, amber = needs attention,
//   red = error/overdue, lime = Meta.
// - No meaning lives only in a `title` tooltip (phones can't hover).
// - A gradient marks the selected value; solid blue marks "you are here".

import type { CSSProperties } from "react";
import { NUM_FONT } from "@/components/engagement-launch-pad/styles";

export { NUM_FONT };
export { SYNE, SHIMMER_CONIC, SHIMMER_CONIC_WARM, CTA_CLASSES, SECONDARY_BTN, labelCls, ACCENT, type Accent } from "@/components/launch-pad/primitives";

/** Big standalone numbers: proportional figures (tabular only in columns). */
export const BIG_NUM: CSSProperties = { ...NUM_FONT, fontVariantNumeric: "lining-nums proportional-nums" };

/**
 * Inline variables of the dark canvas. Theme-following pieces rendered inside it
 * (and portaled sheets, which also get these) then read dark values whatever
 * the dashboard theme is.
 */
export const CANVAS_VARS = {
  "--text-main": "#f8fafc",
  "--text-muted": "#94a3b8",
  "--card-border": "rgba(255,255,255,0.1)",
  "--glass-border": "rgba(255,255,255,0.1)",
  "--input-bg": "rgba(255,255,255,0.05)",
  "--card-bg": "#0b1220",
  "--nav-bg": "#0b1220",
  "--glass-bg": "rgba(255,255,255,0.04)",
  "--bg-main": "#020617",
  colorScheme: "dark",
} as CSSProperties;

/** Small uppercase kicker above a heading (the color comes from the tone). */
export const EYEBROW = "text-[11px] font-black uppercase tracking-[0.2em]";

/** Keyboard focus ring for custom controls. */
export const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60";

export type Tone = "neutral" | "blue" | "cyan" | "violet" | "green" | "amber" | "red" | "lime";

/** Chip recipe per tone: 15% fill, 30% border, -300 text. */
export const CHIP_TONE: Record<Tone, string> = {
  neutral: "border-white/10 bg-white/5 text-neutral-300",
  blue: "border-blue-500/30 bg-blue-500/15 text-blue-300",
  cyan: "border-cyan-500/30 bg-cyan-500/15 text-cyan-300",
  violet: "border-violet-500/30 bg-violet-500/15 text-violet-300",
  green: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
  amber: "border-amber-500/30 bg-amber-500/15 text-amber-300",
  red: "border-rose-500/30 bg-rose-500/15 text-rose-300",
  lime: "border-lime-400/30 bg-lime-400/10 text-lime-300",
};

/** Text color per tone (figures, short status words). */
export const TEXT_TONE: Record<Tone, string> = {
  neutral: "text-white",
  blue: "text-blue-300",
  cyan: "text-cyan-300",
  violet: "text-violet-300",
  green: "text-emerald-300",
  amber: "text-amber-300",
  red: "text-rose-300",
  lime: "text-lime-300",
};

/** Solid dot per tone. */
export const DOT_TONE: Record<Tone, string> = {
  neutral: "bg-neutral-500",
  blue: "bg-blue-400",
  cyan: "bg-cyan-400",
  violet: "bg-violet-400",
  green: "bg-emerald-400",
  amber: "bg-amber-400",
  red: "bg-rose-400",
  lime: "bg-lime-400",
};

/** Icon tile per tone (list rows, empty states). */
export const ICON_TONE: Record<Tone, string> = {
  neutral: "bg-white/5 text-neutral-300 border-white/10",
  blue: "bg-blue-500/15 text-blue-300 border-blue-500/25",
  cyan: "bg-cyan-500/15 text-cyan-300 border-cyan-500/25",
  violet: "bg-violet-500/15 text-violet-300 border-violet-500/25",
  green: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  amber: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  red: "bg-rose-500/15 text-rose-300 border-rose-500/25",
  lime: "bg-lime-400/10 text-lime-300 border-lime-400/25",
};
