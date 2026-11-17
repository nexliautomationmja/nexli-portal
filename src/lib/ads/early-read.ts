import { THRESHOLDS as T } from "@/lib/ads/thresholds";
import { count, money, pct } from "@/lib/ads/format";
import { median, twoPropZ } from "@/lib/ads/math";
import type { AdRow, Metrics } from "@/lib/ads/types";
import type { CreativeCall } from "@/lib/ads/decide";

/**
 * The early read (pure, client-safe): once a new creative has had about
 * 1,500 views, Meta's own numbers already say whether the hook stops people
 * and whether anyone clicks. When either is clearly weaker than on Marcel's
 * producing ads — under 0.6× their median AND significantly lower, not just
 * noise — the creative is suggested as a cut before it spends what the
 * regular rules wait for. Only ever a suggestion on a creative the rules
 * call "testing"; Marcel's own call (Ask chat) still wins over it.
 */

export interface EarlyRead {
  metric: "hook" | "ctr";
  /** The creative's rate (0–1). */
  value: number;
  /** The benchmark median (0–1). */
  benchmark: number;
  benchLabel: "producing" | "account";
  impressions: number;
  z: number;
  /** Spend the regular rule would have waited for, minus what it has spent. */
  saveCents: number;
}

interface RateBench {
  median: number;
  /** Pooled successes / trials across the benchmark ads. */
  x: number;
  n: number;
  ads: number;
}

export interface EarlyBench {
  label: "producing" | "account";
  ids: Set<string>;
  hook: RateBench | null;
  ctr: RateBench | null;
}

/** Leads the way the plan counts them: the CRM, or Meta's count when the ad can't be credited there. */
function leadsOf(ad: AdRow, m: Metrics): { leads: number; booked: number } {
  const crm = m.ghlLeads !== null && ad.creative.hasUtmContent !== false;
  return { leads: crm ? (m.ghlLeads ?? 0) : m.metaLeads, booked: crm ? (m.booked ?? 0) : 0 };
}

function rateBench(rows: { x: number; n: number }[]): RateBench | null {
  const usable = rows.filter((r) => r.n > 0);
  if (usable.length < T.earlyMinBenchAds) return null;
  const med = median(usable.map((r) => r.x / r.n));
  if (med === null || !(med > 0)) return null;
  return { median: med, x: usable.reduce((t, r) => t + r.x, 0), n: usable.reduce((t, r) => t + r.n, 0), ads: usable.length };
}

/**
 * What a working creative looks like in this account (30-day numbers):
 * ads with 3,000+ views that booked a call or brought 2+ leads. Too few of
 * those → every ad with 3,000+ views. Still too few → no early reads.
 */
export function earlyBenchmark(ads: AdRow[]): EarlyBench | null {
  const seen = ads.filter((a) => a.l30 && a.l30.impressions >= T.earlyBenchMinImpressions);
  const producing = seen.filter((a) => {
    const o = leadsOf(a, a.l30 as Metrics);
    return o.booked >= 1 || o.leads >= 2;
  });
  const pick = producing.length >= T.earlyMinBenchAds ? { list: producing, label: "producing" as const } : seen.length >= T.earlyMinBenchAds ? { list: seen, label: "account" as const } : null;
  if (!pick) return null;
  const hook = rateBench(pick.list.filter((a) => (a.l30 as Metrics).videoViews3s > 0).map((a) => ({ x: (a.l30 as Metrics).videoViews3s, n: (a.l30 as Metrics).impressions })));
  const ctr = rateBench(pick.list.map((a) => ({ x: (a.l30 as Metrics).linkClicks, n: (a.l30 as Metrics).impressions })));
  if (!hook && !ctr) return null;
  return { label: pick.label, ids: new Set(pick.list.map((a) => a.id)), hook, ctr };
}

/** Is `x / n` clearly below the benchmark (leaving this ad out of the pooled numbers)? */
function weak(x: number, n: number, b: RateBench, self: { x: number; n: number } | null): { z: number } | null {
  const rate = x / n;
  if (!(rate < T.earlyRatio * b.median)) return null;
  const bx = b.x - (self?.x ?? 0);
  const bn = b.n - (self?.n ?? 0);
  const z = twoPropZ(x, n, bx, bn);
  return z !== null && z <= T.zSignificant ? { z } : null;
}

/**
 * The early read on one creative, given the rules' call. Returns the cut
 * suggestion, or null when the regular call stands.
 */
export function earlyReadFor(ad: AdRow, call: CreativeCall, bench: EarlyBench | null): CreativeCall | null {
  if (!bench || call.call !== "keep" || call.tag !== "testing" || ad.winner) return null;
  if ((ad.ageDays ?? 99) > T.earlyMaxAgeDays) return null;
  const m = ad.l30;
  if (!m || m.impressions < T.earlyMinImpressions) return null;
  if (call.numbers.leads > 0 || (call.numbers.booked ?? 0) > 0) return null;

  const inBench = bench.ids.has(ad.id);
  // No 3-second plays at all means Meta didn't report them — not that nobody watched.
  const hook = m.videoViews3s > 0 ? m.videoViews3s / m.impressions : null;
  const ctr = m.impressions > 0 ? m.linkClicks / m.impressions : null;
  const weakHook = hook !== null && bench.hook ? weak(m.videoViews3s, m.impressions, bench.hook, inBench ? { x: m.videoViews3s, n: m.impressions } : null) : null;
  const weakCtr = ctr !== null && bench.ctr ? weak(m.linkClicks, m.impressions, bench.ctr, inBench ? { x: m.linkClicks, n: m.impressions } : null) : null;

  let picked: { metric: "hook" | "ctr"; value: number; benchmark: number; z: number } | null = null;
  if (weakHook && hook !== null && bench.hook && (ctr === null || !bench.ctr || ctr <= bench.ctr.median)) {
    picked = { metric: "hook", value: hook, benchmark: bench.hook.median, z: weakHook.z };
  } else if (weakCtr && ctr !== null && bench.ctr && (hook === null || !bench.hook || hook <= bench.hook.median)) {
    picked = { metric: "ctr", value: ctr, benchmark: bench.ctr.median, z: weakCtr.z };
  }
  if (!picked) return null;

  const spend = call.numbers.spendCents;
  const saveCents = Math.max(0, (call.decideAt?.spendCents ?? spend) - spend);
  const on = bench.label === "producing" ? "your producing ads" : "your other ads";
  const what =
    picked.metric === "hook"
      ? `weak hook — ${pct(picked.value)} of people watched 3 seconds vs ${pct(picked.benchmark)} on ${on}`
      : `almost nobody clicks — ${pct(picked.value)} clicked vs ${pct(picked.benchmark)} on ${on}`;
  const early: EarlyRead = { ...picked, benchLabel: bench.label, impressions: m.impressions, saveCents };
  return {
    ...call,
    call: "cut",
    tag: null,
    cutKind: "early_read",
    reason: `Early read: ${what} (${count(m.impressions)} views). Cut now${saveCents > 0 ? ` and save up to ${money(saveCents)}` : ""}.`,
    action: "Turn it off in Ads Manager — it's an early read, so it's your call.",
    decideAt: null,
    early,
  };
}
