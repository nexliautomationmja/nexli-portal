import type { FatigueState, Severity } from "@/lib/ads/types";

/**
 * Chart colors for the Ads tab — validated with the dataviz validator against
 * the canvas's effective card surface (#0c1020, dark):
 *  - series (Facebook / Instagram / Other; or leads / booked): passes every
 *    check all-pairs (CVD ΔE ≥ 9.4, normal-vision ≥ 20.9, contrast ≥ 3:1).
 *  - ramp (heat table): one-hue ordinal ramp, monotone, visible gaps, light
 *    end 2.33:1 vs the surface.
 * Status colors are reserved for state (fatigue, signals) and always ship with
 * an icon + label.
 */
export const VIZ = {
  surface: "#0c1020",
  /** This period (series slot 1). */
  current: "#3987e5",
  /** The period before (de-emphasis). */
  previous: "#64748b",
  series: ["#3987e5", "#d95926", "#199e70"] as const,
  grid: "rgba(255,255,255,0.06)",
  axis: "rgba(255,255,255,0.14)",
  tick: "#94a3b8",
  ink: "#f8fafc",
  inkMuted: "#94a3b8",
  status: { good: "#0ca30c", warning: "#fab219", serious: "#ec835a", critical: "#d03b3b" },
  /** Low → high on the dark surface. */
  ramp: ["#184f95", "#256abf", "#3987e5", "#6da7ec", "#9ec5f4"] as const,
} as const;

/** Readable ink on a ramp cell (white on the dark steps, near-black on the light ones). */
export const inkOn = (hex: string) => (hex === "#6da7ec" || hex === "#9ec5f4" ? "#0b0b0b" : "#ffffff");

export const PLATFORM_COLOR: Record<string, string> = {
  facebook: VIZ.series[0],
  instagram: VIZ.series[1],
  other: VIZ.series[2],
  unknown: VIZ.previous,
};

export const FATIGUE: Record<FatigueState, { label: string; color: string; tone: "good" | "warning" | "serious" | "critical" | "neutral"; blurb: string }> = {
  too_early: { label: "Too early", color: VIZ.inkMuted, tone: "neutral", blurb: "Not enough data to judge yet" },
  fresh: { label: "Fresh", color: VIZ.status.good, tone: "good", blurb: "New, no baseline yet" },
  healthy: { label: "Healthy", color: VIZ.status.good, tone: "good", blurb: "Holding up" },
  watch: { label: "Watch", color: VIZ.status.warning, tone: "warning", blurb: "Starting to tire" },
  fatigued: { label: "Fatigued", color: VIZ.status.serious, tone: "serious", blurb: "Audience is tired of it" },
  dead: { label: "Not producing", color: VIZ.status.critical, tone: "critical", blurb: "Spending without results" },
  inactive: { label: "Not running", color: VIZ.previous, tone: "neutral", blurb: "Paused or off" },
};

export const SEVERITY: Record<Severity | "ok", { color: string; label: string }> = {
  ok: { color: VIZ.status.good, label: "OK" },
  good: { color: VIZ.status.good, label: "Good" },
  info: { color: "#67e8f9", label: "Note" },
  warning: { color: VIZ.status.warning, label: "Warning" },
  critical: { color: VIZ.status.critical, label: "Critical" },
};
