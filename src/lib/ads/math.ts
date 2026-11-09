import type { Compare, Delta, MetricKey, Metrics, Outcomes, RawCounts } from "@/lib/ads/types";
import { THRESHOLDS } from "@/lib/ads/thresholds";

/** Pure number helpers for the Ads tab (client-safe). */

export const div = (a: number | null | undefined, b: number | null | undefined): number | null =>
  a === null || a === undefined || b === null || b === undefined || !(b > 0) ? null : a / b;

export const roundCents = (v: number | null): number | null => (v === null || !Number.isFinite(v) ? null : Math.round(v));

/** (cur − prev) ÷ prev; null when there's no base. */
export const rel = (cur: number | null | undefined, prev: number | null | undefined): number | null =>
  cur === null || cur === undefined || prev === null || prev === undefined || !(prev > 0) ? null : (cur - prev) / prev;

export function median(values: number[]): number | null {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/**
 * One-sided two-proportion z for "rate 1 is lower than rate 2"
 * (x successes out of n). Negative = rate 1 lower. null when either side has
 * no trials or the pooled rate is degenerate.
 */
export function twoPropZ(x1: number, n1: number, x2: number, n2: number): number | null {
  if (!(n1 > 0) || !(n2 > 0)) return null;
  const p1 = x1 / n1;
  const p2 = x2 / n2;
  const p = (x1 + x2) / (n1 + n2);
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  if (!(se > 0)) return null;
  return (p1 - p2) / se;
}

export const ZERO_RAW: RawCounts = {
  spendCents: 0,
  impressions: 0,
  reach: null,
  frequency: null,
  linkClicks: 0,
  landingPageViews: 0,
  metaLeads: 0,
  videoViews3s: 0,
  thruplays: 0,
};

/** Add raw counts (reach/frequency can't be summed — they're dropped). */
export function addRaw(a: RawCounts, b: RawCounts): RawCounts {
  return {
    spendCents: a.spendCents + b.spendCents,
    impressions: a.impressions + b.impressions,
    reach: null,
    frequency: null,
    linkClicks: a.linkClicks + b.linkClicks,
    landingPageViews: a.landingPageViews + b.landingPageViews,
    metaLeads: a.metaLeads + b.metaLeads,
    videoViews3s: a.videoViews3s + b.videoViews3s,
    thruplays: a.thruplays + b.thruplays,
  };
}

/** Meta counts + GHL outcomes → every rate the page shows. */
export function computeMetrics(raw: RawCounts, out: Outcomes | null): Metrics {
  const ghlLeads = out ? out.ghlLeads : null;
  const booked = out ? out.booked : null;
  return {
    ...raw,
    ghlLeads,
    booked,
    won: out ? out.won : null,
    ctr: div(raw.linkClicks, raw.impressions),
    cpmCents: roundCents(div(raw.spendCents * 1000, raw.impressions)),
    cpcCents: roundCents(div(raw.spendCents, raw.linkClicks)),
    lpvRate: div(raw.landingPageViews, raw.linkClicks),
    hookRate: raw.videoViews3s > 0 ? div(raw.videoViews3s, raw.impressions) : null,
    holdRate: div(raw.thruplays, raw.videoViews3s),
    cplCents: roundCents(div(raw.spendCents, ghlLeads)),
    costPerBookedCents: roundCents(div(raw.spendCents, booked)),
    bookedRate: div(booked, ghlLeads),
  };
}

/** Which way is good for each metric (null = neutral, e.g. spend). */
export const POLARITY: Partial<Record<MetricKey, 1 | -1>> = {
  impressions: 1,
  linkClicks: 1,
  landingPageViews: 1,
  metaLeads: 1,
  ghlLeads: 1,
  booked: 1,
  won: 1,
  ctr: 1,
  lpvRate: 1,
  hookRate: 1,
  holdRate: 1,
  bookedRate: 1,
  cpmCents: -1,
  cpcCents: -1,
  cplCents: -1,
  costPerBookedCents: -1,
  frequency: -1,
};

const DELTA_KEYS: MetricKey[] = [
  "spendCents",
  "impressions",
  "reach",
  "frequency",
  "linkClicks",
  "landingPageViews",
  "metaLeads",
  "ghlLeads",
  "booked",
  "won",
  "ctr",
  "cpmCents",
  "cpcCents",
  "lpvRate",
  "hookRate",
  "holdRate",
  "cplCents",
  "costPerBookedCents",
  "bookedRate",
];

/** Is this metric's comparison built on too little data to trust? */
function lowVolumeFor(key: MetricKey, cur: Metrics, prev: Metrics): boolean {
  const lv = THRESHOLDS.lowVolume;
  if (key === "booked" || key === "costPerBookedCents" || key === "won") return (cur.booked ?? 0) < lv.booked && (prev.booked ?? 0) < lv.booked;
  if (key === "ghlLeads" || key === "cplCents" || key === "bookedRate") return (cur.ghlLeads ?? 0) < lv.leads && (prev.ghlLeads ?? 0) < lv.leads;
  return cur.impressions < lv.impressions || prev.impressions < lv.impressions;
}

export function compare(cur: Metrics, prev: Metrics | null): Compare {
  const delta: Compare["delta"] = {};
  if (prev) {
    for (const key of DELTA_KEYS) {
      const c = cur[key] as number | null;
      const p = prev[key] as number | null;
      const r = rel(c, p);
      const pol = POLARITY[key];
      let significant: boolean | null = null;
      if (key === "ctr") {
        const z = twoPropZ(cur.linkClicks, cur.impressions, prev.linkClicks, prev.impressions);
        significant = z === null ? null : Math.abs(z) >= Math.abs(THRESHOLDS.zSignificant);
      }
      delta[key] = {
        rel: r,
        better: r === null || r === 0 || !pol ? null : r * pol > 0,
        lowVolume: lowVolumeFor(key, cur, prev),
        significant,
      } satisfies Delta;
    }
  }
  return { cur, prev, delta };
}

/** Sum outcomes. */
export const addOutcomes = (a: Outcomes, b: Outcomes): Outcomes => ({
  ghlLeads: a.ghlLeads + b.ghlLeads,
  booked: a.booked + b.booked,
  won: a.won + b.won,
});

export const ZERO_OUTCOMES: Outcomes = { ghlLeads: 0, booked: 0, won: 0 };
