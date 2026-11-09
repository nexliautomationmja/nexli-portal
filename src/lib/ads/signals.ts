import { THRESHOLDS as T } from "@/lib/ads/thresholds";
import { div, rel, twoPropZ } from "@/lib/ads/math";
import { change, decimal, money, pct } from "@/lib/ads/format";
import type {
  AdRow,
  AdsetRow,
  CampaignRow,
  Compare,
  DailyPoint,
  FatigueState,
  FunnelStage,
  Metrics,
  Signal,
  TrackingItem,
} from "@/lib/ads/types";

/**
 * Deterministic reads of the account (pure, client-safe): every ad's fatigue
 * state with the reasons in plain words, and the account-level signals the
 * page highlights and Manus starts from. Same numbers in → same flags out.
 */

export interface FatigueInput {
  active: boolean;
  ageDays: number | null;
  temperature: "cold" | "warm" | "unknown";
  isVideo: boolean;
  l7: Metrics | null;
  base14: Metrics | null;
  l30: Metrics | null;
  targetCpbCents: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function classifyFatigue(a: FatigueInput): { state: FatigueState; score: number | null; reasons: string[] } {
  const reasons: string[] = [];
  const l7 = a.l7;
  const base = a.base14;
  const l30 = a.l30;
  const warm = a.temperature === "warm";
  const watchFreq = warm ? T.freqWatch.warm : T.freqWatch.cold;
  const fatigueFreq = warm ? T.freqFatigued.warm : T.freqFatigued.cold;

  if (!a.active && (l7?.impressions ?? 0) === 0) return { state: "inactive", score: null, reasons: ["Not running"] };

  const lifeImpr = l30?.impressions ?? 0;
  const lifeSpend = l30?.spendCents ?? 0;
  if (lifeImpr < T.minImpressions || lifeSpend < T.minSpendCents || (a.ageDays !== null && a.ageDays < T.minActiveDays)) {
    if (lifeImpr < T.minImpressions) reasons.push(`Only ${lifeImpr.toLocaleString("en-US")} impressions so far (needs ${T.minImpressions.toLocaleString("en-US")})`);
    if (lifeSpend < T.minSpendCents) reasons.push(`${money(lifeSpend)} spent so far (needs ${money(T.minSpendCents)})`);
    if (a.ageDays !== null && a.ageDays < T.minActiveDays) reasons.push(`${a.ageDays} day${a.ageDays === 1 ? "" : "s"} old (needs ${T.minActiveDays})`);
    return { state: "too_early", score: null, reasons };
  }

  // Dead: real spend with nothing to show for it, or nobody clicks.
  const deadSpend = Math.max(T.deadSpendMultiple * a.targetCpbCents, T.deadSpendFloorCents);
  if (l30 && lifeSpend >= deadSpend && (l30.ghlLeads ?? 0) === 0 && (l30.booked ?? 0) === 0 && l30.metaLeads === 0 && (a.ageDays ?? 99) >= 7) {
    return { state: "dead", score: 100, reasons: [`${money(lifeSpend)} spent in 30 days with no leads or booked calls`] };
  }
  if (l7 && l7.impressions >= T.deadMinImpressions && (l7.ctr ?? 0) < T.deadCtr) {
    return { state: "dead", score: 100, reasons: [`Link CTR ${pct(l7.ctr)} on ${l7.impressions.toLocaleString("en-US")} impressions in 7 days — almost nobody clicks`] };
  }

  const freq = l7?.frequency ?? null;
  const hasBase = Boolean(base && base.impressions >= T.minImpressions && l7 && l7.impressions > 0);
  if (!hasBase) {
    if (freq !== null && freq >= fatigueFreq) {
      return { state: "watch", score: Math.round(35 * clamp01(freq / fatigueFreq)), reasons: [`Frequency ${decimal(freq, 1)} in 7 days (fatigue line ${fatigueFreq})`, "No earlier baseline to compare CTR against yet"] };
    }
    return { state: "fresh", score: freq !== null ? Math.round(35 * clamp01(freq / fatigueFreq)) : 0, reasons: ["New — no 14-day baseline yet"] };
  }

  const cur = l7 as Metrics;
  const prev = base as Metrics;
  const ctrDrop = rel(cur.ctr, prev.ctr);
  const z = twoPropZ(cur.linkClicks, cur.impressions, prev.linkClicks, prev.impressions);
  const sig = z !== null && z <= T.zSignificant;
  const cpcRise = rel(cur.cpcCents, prev.cpcCents);
  const cpmRise = rel(cur.cpmCents, prev.cpmCents);
  const hookOk = a.isVideo && cur.impressions >= T.hookMinImpressions && prev.impressions >= T.hookMinImpressions;
  const hookDrop = hookOk ? rel(cur.hookRate, prev.hookRate) : null;

  const score = Math.round(
    35 * clamp01((freq ?? 0) / fatigueFreq) +
      35 * clamp01(-(ctrDrop ?? 0) / 0.5) +
      15 * clamp01((cpmRise ?? 0) / 0.6) +
      15 * clamp01(-(hookDrop ?? 0) / 0.5)
  );

  const ctrLine = ctrDrop !== null ? `Link CTR ${change(ctrDrop)} vs the 14 days before (${pct(prev.ctr)} → ${pct(cur.ctr)})${sig ? "" : ", not yet significant"}` : null;
  const freqLine = freq !== null ? `Frequency ${decimal(freq, 1)} in 7 days (${warm ? "warm" : "cold"} audience; watch ${watchFreq}, fatigue ${fatigueFreq})` : null;

  const fatigued =
    (freq !== null && freq >= fatigueFreq && ctrDrop !== null && ctrDrop <= T.ctrDropFatigued && sig) ||
    (ctrDrop !== null && ctrDrop <= T.ctrDropSevere && sig && cpcRise !== null && cpcRise >= T.cpcRiseSevere) ||
    (hookDrop !== null && hookDrop <= T.hookDropFatigued && freq !== null && freq >= watchFreq);
  if (fatigued) {
    if (freqLine) reasons.push(freqLine);
    if (ctrLine) reasons.push(ctrLine);
    if (cpcRise !== null && cpcRise >= T.cpcRiseSevere) reasons.push(`Cost per click ${change(cpcRise)} (${money(prev.cpcCents)} → ${money(cur.cpcCents)})`);
    if (hookDrop !== null && hookDrop <= T.hookDropWatch) reasons.push(`Hook rate ${change(hookDrop)} (${pct(prev.hookRate)} → ${pct(cur.hookRate)})`);
    return { state: "fatigued", score: Math.max(score, 70), reasons };
  }

  const watch =
    (freq !== null && freq >= watchFreq) ||
    (ctrDrop !== null && ctrDrop <= T.ctrDropWatch && sig) ||
    (hookDrop !== null && hookDrop <= T.hookDropWatch) ||
    (cpmRise !== null && cpmRise >= T.cpmRiseWatch && ctrDrop !== null && ctrDrop <= -0.1);
  if (watch) {
    if (freq !== null && freq >= watchFreq && freqLine) reasons.push(freqLine);
    if (ctrDrop !== null && ctrDrop <= -0.1 && ctrLine) reasons.push(ctrLine);
    if (hookDrop !== null && hookDrop <= T.hookDropWatch) reasons.push(`Hook rate ${change(hookDrop)} (${pct(prev.hookRate)} → ${pct(cur.hookRate)})`);
    if (cpmRise !== null && cpmRise >= T.cpmRiseWatch) reasons.push(`CPM ${change(cpmRise)} (${money(prev.cpmCents)} → ${money(cur.cpmCents)})`);
    return { state: "watch", score: Math.max(score, 35), reasons };
  }

  if (ctrLine && ctrDrop !== null && Math.abs(ctrDrop) >= 0.05) reasons.push(ctrLine);
  if (freqLine) reasons.push(freqLine);
  return { state: "healthy", score, reasons: reasons.length ? reasons : ["Holding steady"] };
}

/** Booked at least twice in 30 days at or under the target cost per booked call. */
export const isWinner = (l30: Metrics | null, targetCpbCents: number) =>
  Boolean(l30 && (l30.booked ?? 0) >= 2 && l30.costPerBookedCents !== null && l30.costPerBookedCents <= targetCpbCents);

/** Warm = retargeting-style audiences (custom audiences that aren't lookalikes, or a telling name). A heuristic. */
export function temperatureOf(name: string, customAudienceNames: string[]): "cold" | "warm" | "unknown" {
  if (/retarget|remarket|warm|visitor|engag|website|video view|ig engag|fb engag/i.test(name)) return "warm";
  if (customAudienceNames.some((n) => !/lookalike|\blal\b/i.test(n))) return "warm";
  return "cold";
}

export interface SignalInput {
  totals: Compare;
  daily: { cur: DailyPoint | null }[];
  campaigns: CampaignRow[];
  adsets: AdsetRow[];
  ads: AdRow[];
  funnel: FunnelStage[];
  tracking: TrackingItem[];
  targetCpbCents: number;
  targetSource: "settings" | "history" | "default";
  monthlyBudgetCents?: number | null;
  /** Month-to-date spend and how far through the month we are (0–1). */
  monthToDate?: { spendCents: number; fraction: number } | null;
  accountStatus: { label: string; tone: "ok" | "warn" | "bad" };
  rangeDays: number;
}

export function buildSignals(s: SignalInput): Signal[] {
  const out: Signal[] = [];
  const cur = s.totals.cur;
  const prev = s.totals.prev;

  if (s.accountStatus.tone !== "ok") {
    out.push({ kind: "account_status", severity: "critical", title: `Ad account: ${s.accountStatus.label}`, detail: "Ads can't deliver normally until this is fixed in Meta.", ref: null });
  }

  const withIssues = s.ads.filter((a) => a.issues.length && a.effectiveStatus !== "DELETED" && a.effectiveStatus !== "ARCHIVED");
  if (withIssues.length) {
    out.push({
      kind: "ads_with_issues",
      severity: "warning",
      title: `${withIssues.length} ad${withIssues.length > 1 ? "s have" : " has"} delivery issues`,
      detail: withIssues.slice(0, 3).map((a) => `${a.name}: ${a.issues[0]}`).join(" · "),
      ref: withIssues.length === 1 ? { level: "ad", id: withIssues[0].id, name: withIssues[0].name } : null,
    });
  }

  // Cost per booked call against the target.
  if (cur.costPerBookedCents !== null && (cur.booked ?? 0) >= T.lowVolume.booked) {
    const ratio = cur.costPerBookedCents / s.targetCpbCents;
    const label = s.targetSource === "settings" ? "your target" : s.targetSource === "history" ? "your recent average" : "the starting assumption";
    if (ratio >= T.cpbOverTarget) {
      out.push({ kind: "cpb_vs_target", severity: "warning", title: `Cost per booked call ${money(cur.costPerBookedCents)} — ${Math.round((ratio - 1) * 100)}% above ${label}`, detail: `${money(s.targetCpbCents)} is ${label}. ${cur.booked} booked calls on ${money(cur.spendCents)}.`, ref: null });
    } else if (ratio <= T.cpbUnderTarget) {
      out.push({ kind: "cpb_vs_target", severity: "good", title: `Cost per booked call ${money(cur.costPerBookedCents)} — ${Math.round((1 - ratio) * 100)}% under ${label}`, detail: `${cur.booked} booked calls on ${money(cur.spendCents)}.`, ref: null });
    }
  }

  // Spend with no bookings (the period, ignoring how leads take a few days to book).
  if ((cur.booked ?? 0) === 0 && cur.spendCents >= 2 * s.targetCpbCents && s.rangeDays >= 7) {
    out.push({
      kind: "spend_no_bookings",
      severity: cur.spendCents >= 4 * s.targetCpbCents ? "critical" : "warning",
      title: `${money(cur.spendCents)} spent with no booked calls`,
      detail: `That's ${(cur.spendCents / s.targetCpbCents).toFixed(1)}× the cost a booked call should take. Check tracking first, then the funnel.`,
      ref: null,
    });
  }

  // CPM spike: last 3 days vs the 14 before.
  const days = s.daily.map((d) => d.cur).filter((d): d is DailyPoint => Boolean(d));
  if (days.length >= 10) {
    const last3 = days.slice(-3);
    const before = days.slice(-17, -3);
    const cpm = (arr: DailyPoint[]) => div(arr.reduce((t, d) => t + d.spendCents, 0) * 1000, arr.reduce((t, d) => t + d.impressions, 0));
    const r = rel(cpm(last3), cpm(before));
    if (r !== null && r >= T.accountCpmSpike) {
      out.push({ kind: "cpm_spike", severity: "warning", title: `CPM up ${change(r)} in the last 3 days`, detail: `${money(cpm(before))} → ${money(cpm(last3))} per 1,000 impressions. Often auction pressure (Q4, holidays) or a narrowing audience.`, ref: null });
    }
  }

  // Learning phase.
  const activeSets = s.adsets.filter((a) => a.effectiveStatus === "ACTIVE");
  for (const a of activeSets) {
    if (a.learning.status === "FAIL") {
      out.push({ kind: "learning_limited", severity: "warning", title: `"${a.name}" is learning limited`, detail: `Meta isn't getting enough ${a.customEvent ?? a.optimizationGoal ?? "optimization"} events to exit learning${a.eventsLast7 !== null ? ` (${a.eventsLast7} in the last 7 days; it wants about ${T.learningEventsPerWeek} a week)` : ""}. Consolidating ad sets or optimizing for an earlier event usually helps.`, ref: { level: "adset", id: a.id, name: a.name } });
    } else if (a.learning.daysSinceEdit !== null && a.learning.daysSinceEdit < T.recentEditDays) {
      out.push({ kind: "learning_recent_edit", severity: "info", title: `"${a.name}" was significantly edited ${a.learning.daysSinceEdit === 0 ? "today" : `${a.learning.daysSinceEdit} day${a.learning.daysSinceEdit > 1 ? "s" : ""} ago`}`, detail: "Give it time before judging or changing it again — edits restart learning.", ref: { level: "adset", id: a.id, name: a.name } });
    } else if (a.eventsLast7 !== null && a.eventsLast7 < T.learningEventsPerWeek && a.learning.status !== "SUCCESS") {
      out.push({ kind: "low_event_volume", severity: "info", title: `"${a.name}" gets ${a.eventsLast7} optimization events a week`, detail: `Meta's learning phase wants about ${T.learningEventsPerWeek} a week; results stay noisy below that.`, ref: { level: "adset", id: a.id, name: a.name } });
    }
    if (a.activeAds > 0 && a.activeAds < T.minActiveCreativesPerAdset) {
      out.push({ kind: "creative_thin", severity: "info", title: `"${a.name}" runs only ${a.activeAds} ad${a.activeAds > 1 ? "s" : ""}`, detail: `${T.minActiveCreativesPerAdset}+ live creatives give Meta room to find a winner and soften fatigue.`, ref: { level: "adset", id: a.id, name: a.name } });
    }
  }

  // Creative fatigue.
  const fatigued = s.ads.filter((a) => a.fatigue.state === "fatigued");
  const watching = s.ads.filter((a) => a.fatigue.state === "watch");
  const dead = s.ads.filter((a) => a.fatigue.state === "dead" && a.effectiveStatus === "ACTIVE");
  if (fatigued.length) {
    out.push({ kind: "fatigued_ads", severity: "warning", title: `${fatigued.length} creative${fatigued.length > 1 ? "s are" : " is"} fatigued`, detail: fatigued.slice(0, 4).map((a) => a.name).join(" · "), ref: fatigued.length === 1 ? { level: "ad", id: fatigued[0].id, name: fatigued[0].name } : null });
  }
  if (watching.length) {
    out.push({ kind: "watch_ads", severity: "info", title: `${watching.length} creative${watching.length > 1 ? "s are" : " is"} starting to tire`, detail: watching.slice(0, 4).map((a) => a.name).join(" · "), ref: null });
  }
  if (dead.length) {
    out.push({ kind: "dead_ads", severity: "warning", title: `${dead.length} live creative${dead.length > 1 ? "s aren't" : " isn't"} producing`, detail: dead.slice(0, 4).map((a) => `${a.name} (${a.fatigue.reasons[0] ?? ""})`).join(" · "), ref: dead.length === 1 ? { level: "ad", id: dead[0].id, name: dead[0].name } : null });
  }
  const winners = s.ads.filter((a) => a.winner);
  if (winners.length) {
    out.push({ kind: "winner", severity: "good", title: `${winners.length} winning creative${winners.length > 1 ? "s" : ""}`, detail: winners.slice(0, 4).map((a) => `${a.name} (${money(a.l30?.costPerBookedCents ?? null)} per booked call)`).join(" · "), ref: winners.length === 1 ? { level: "ad", id: winners[0].id, name: winners[0].name } : null });
  }

  // One creative carrying the account.
  const spendAds = s.ads.filter((a) => a.metrics.cur.spendCents > 0);
  const totalAdSpend = spendAds.reduce((t, a) => t + a.metrics.cur.spendCents, 0);
  const top = [...spendAds].sort((a, b) => b.metrics.cur.spendCents - a.metrics.cur.spendCents)[0];
  if (top && spendAds.length >= 2 && totalAdSpend > 0 && top.metrics.cur.spendCents / totalAdSpend >= T.winnerConcentration) {
    out.push({ kind: "winner_concentration", severity: "info", title: `One creative takes ${pct(top.metrics.cur.spendCents / totalAdSpend, 0)} of spend`, detail: `"${top.name}". If it tires, results drop fast — have the next one ready.`, ref: { level: "ad", id: top.id, name: top.name } });
  }

  // Funnel: the stage that got worst vs the previous period.
  if (prev) {
    const worst = s.funnel
      .filter((f) => f.rate !== null && f.prevRate !== null && (f.prev ?? 0) >= 20)
      .map((f) => ({ f, r: rel(f.rate, f.prevRate) }))
      .filter((x): x is { f: FunnelStage; r: number } => x.r !== null && x.r <= -0.2)
      .sort((a, b) => a.r - b.r)[0];
    if (worst) {
      out.push({ kind: "funnel_bottleneck", severity: "warning", title: `${worst.f.label} rate fell ${change(worst.r)}`, detail: `${pct(worst.f.prevRate)} → ${pct(worst.f.rate)} vs the previous ${s.rangeDays} days.`, ref: null });
    }
  }

  // Budget pacing for the month.
  if (s.monthlyBudgetCents && s.monthToDate && s.monthToDate.fraction > 0.1) {
    const expected = s.monthlyBudgetCents * s.monthToDate.fraction;
    const r = rel(s.monthToDate.spendCents, expected);
    if (r !== null && Math.abs(r) > T.pacingTolerance) {
      out.push({ kind: "budget_pacing", severity: r > 0.3 ? "warning" : "info", title: `Month-to-date spend ${r > 0 ? "ahead of" : "behind"} budget by ${change(Math.abs(r)).replace("+", "")}`, detail: `${money(s.monthToDate.spendCents)} spent; on pace would be ${money(expected)} of ${money(s.monthlyBudgetCents)}.`, ref: null });
    }
  }

  // Tracking problems worth shouting about.
  for (const t of s.tracking) {
    if (t.severity === "critical" || t.severity === "warning") {
      out.push({ kind: `tracking_${t.key}`, severity: t.severity, title: t.label, detail: [t.value, t.fix].filter(Boolean).join(" — "), ref: null });
    }
  }

  const order = { critical: 0, warning: 1, info: 2, good: 3 } as const;
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}
