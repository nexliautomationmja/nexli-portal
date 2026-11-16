import { THRESHOLDS as T } from "@/lib/ads/thresholds";
import { count, decimal, money, pct } from "@/lib/ads/format";
import { addDays } from "@/lib/ads/time";
import type { AdRow, AdsSnapshot } from "@/lib/ads/types";

/**
 * The daily call on every live creative — CUT or KEEP, in plain words with
 * the numbers — and how many new creatives the account needs (pure,
 * client-safe). The page, the creative cards, the morning email and Manus's
 * pack all use this, so they can never disagree. Rules (T = target cost per
 * booked call, L = target cost per lead, 30-day numbers):
 *  - CUT: spent 2T with no booked call · spent 3L with no lead · booked
 *    calls cost 2T+ after 3T spent · almost nobody clicks · worn out and
 *    not earning its keep.
 *  - KEEP: Winner (2+ booked calls at ≤ T) · Working · Testing (with the
 *    spend where it gets decided) · Tiring (still producing, wearing out).
 */

export type KeepTag = "winner" | "working" | "testing" | "tiring";
export type CutKind = "no_booked" | "no_leads" | "expensive" | "no_clicks" | "worn_out";

export interface CreativeCall {
  adId: string;
  name: string;
  adsetId: string;
  campaignId: string;
  call: "cut" | "keep";
  /** What kind of keep (null for a cut). */
  tag: KeepTag | null;
  cutKind: CutKind | null;
  /** One sentence with the numbers. */
  reason: string;
  /** What to do about it. */
  action: string;
  /** Testing: the spend where the next rule decides it, and how far along it is. */
  decideAt: { spendCents: number; days: number | null; progress: number } | null;
  /** A cut that's already off in Meta. */
  done: boolean;
  /** Leads counted from the CRM, or from Meta when the ad can't be credited in the CRM. */
  leadsFrom: "crm" | "meta";
  numbers: {
    spendCents: number;
    leads: number;
    booked: number | null;
    cplCents: number | null;
    cpbCents: number | null;
    ctr7: number | null;
    frequency7: number | null;
  };
}

export interface AdsetNeed {
  adsetId: string;
  name: string;
  live: number;
  keepers: number;
  tiring: number;
  cuts: number;
  add: number;
}

export interface CreativeNeed {
  add: number;
  when: "today" | "this_week" | "none";
  why: string;
  adsets: AdsetNeed[];
}

export interface AdPlan {
  /** The day the plan is for (the day after the last complete day). */
  date: string;
  throughDate: string;
  targets: { cpbCents: number; cpbSource: string; cplCents: number; cplSource: string };
  calls: CreativeCall[];
  counts: { cut: number; cutDone: number; keep: number; winners: number; testing: number; tiring: number; working: number };
  need: CreativeNeed;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** A fatigue reason without the rule numbers in brackets ("Frequency 4.1 in 7 days"). */
const plainReason = (r: string | undefined, fallback: string) => (r ? r.replace(/\s*\([^)]*\)/g, "").replace(/\.$/, "").trim() : fallback);
const times = (x: number) => (Math.abs(x - Math.round(x)) < 0.05 ? `${Math.round(x)}×` : `${decimal(x, 1)}×`);

/** Days to reach `targetCents` at the ad's last-7-day pace (null when it isn't spending). */
function daysTo(ad: AdRow, spentCents: number, targetCents: number): number | null {
  const perDay = (ad.l7?.spendCents ?? 0) / 7;
  if (perDay <= 0) return null;
  return Math.max(1, Math.ceil((targetCents - spentCents) / perDay));
}

/** One live ad's call. */
export function callFor(ad: AdRow, cpbT: number, cplT: number): CreativeCall {
  const m = ad.l30 ?? ad.metrics.cur;
  const spend = m.spendCents;
  // The CRM is the truth for leads and bookings — unless this ad can't be credited there.
  const crm = m.ghlLeads !== null && ad.creative.hasUtmContent !== false;
  const leads = crm ? (m.ghlLeads ?? 0) : m.metaLeads;
  const booked = crm ? (m.booked ?? 0) : null;
  const cpl = leads > 0 ? Math.round(spend / leads) : null;
  const cpb = booked ? Math.round(spend / booked) : null;
  const age = ad.ageDays ?? 99;
  const ctr7 = ad.l7?.ctr ?? null;
  const impr7 = ad.l7?.impressions ?? 0;
  const freq7 = ad.l7?.frequency ?? null;
  const fatigued = ad.fatigue.state === "fatigued" || ad.fatigue.state === "dead";
  const tiring = fatigued || ad.fatigue.state === "watch";
  const metaNote = crm ? "" : " (Meta's count — this ad has no utm_content, so the CRM can't credit it)";
  const base = {
    adId: ad.id,
    name: ad.name,
    adsetId: ad.adsetId,
    campaignId: ad.campaignId,
    done: false,
    leadsFrom: crm ? ("crm" as const) : ("meta" as const),
    numbers: { spendCents: spend, leads, booked, cplCents: cpl, cpbCents: cpb, ctr7, frequency7: freq7 },
  };
  const cut = (cutKind: CutKind, reason: string): CreativeCall => ({ ...base, call: "cut", tag: null, cutKind, reason, action: "Turn it off in Ads Manager.", decideAt: null });
  const keep = (tag: KeepTag, reason: string, action: string, decideAt: CreativeCall["decideAt"] = null): CreativeCall => ({ ...base, call: "keep", tag, cutKind: null, reason, action, decideAt });

  // ── Cut ──
  if (booked === 0 && spend >= T.cutNoBookedSpendX * cpbT && age >= T.cutNoBookedMinDays) {
    return cut(
      "no_booked",
      `Spent ${money(spend)} in 30 days — ${times(spend / cpbT)} your ${money(cpbT)} per booked call — without a single booked call${leads ? ` (${plural(leads, "lead")} that didn't book)` : ""}.`
    );
  }
  if (leads === 0 && spend >= T.cutNoLeadsSpendX * cplT && age >= T.cutNoLeadsMinDays) {
    return cut("no_leads", `Spent ${money(spend)} — ${times(spend / cplT)} what a lead should cost (${money(cplT)}) — with no leads${metaNote}.`);
  }
  if (booked && cpb !== null && cpb >= T.cutExpensiveCpbX * cpbT && spend >= T.cutExpensiveSpendX * cpbT) {
    return cut("expensive", `Booked calls cost ${money(cpb)} each (${plural(booked, "call")} on ${money(spend)}) — over ${times(T.cutExpensiveCpbX)} your ${money(cpbT)} target.`);
  }
  if (!ad.winner && impr7 >= T.deadMinImpressions && ctr7 !== null && ctr7 < T.deadCtr) {
    return cut("no_clicks", `Only ${pct(ctr7)} of people clicked in the last 7 days (${count(impr7)} views) — the hook isn't stopping anyone.`);
  }
  if (fatigued && !ad.winner && (booked === 0 || (cpl !== null && cpl >= T.cutWornCplX * cplT))) {
    const why = plainReason(ad.fatigue.reasons[0], "The audience has seen it too often");
    return cut("worn_out", `Worn out: ${why}${booked === 0 ? ", and it hasn't booked a call" : `, and leads now cost ${money(cpl)}`}.`);
  }

  // ── Keep ──
  if (ad.winner) {
    const line = `${plural(booked ?? 0, "booked call")} at ${money(cpb)} each — under your ${money(cpbT)} target.`;
    if (tiring) {
      return keep("tiring", `${line} But it's wearing out: ${plainReason(ad.fatigue.reasons[0], "frequency is climbing")}.`, "Leave it on — make its replacement now (it's counted in the creatives to add).");
    }
    return keep("winner", line, "Leave it on. Make 2 variations of it.");
  }
  if (booked && cpb !== null) {
    const over = cpb > cpbT;
    const line = `${plural(booked, "booked call")} at ${money(cpb)} each${over ? ` — above your ${money(cpbT)} target` : ""}.`;
    if (tiring) return keep("tiring", `${line} It's starting to wear out: ${plainReason(ad.fatigue.reasons[0], "frequency is climbing")}.`, "Leave it on for now — its replacement is counted in the creatives to add.");
    return keep(
      "working",
      line,
      over ? `Leave it on. It gets cut if booked calls stay over ${money(T.cutExpensiveCpbX * cpbT)} once it has spent ${money(T.cutExpensiveSpendX * cpbT)}.` : "Leave it on."
    );
  }
  if (booked === null && leads > 0) {
    return keep("working", `${plural(leads, "lead")} at ${money(cpl)} each${metaNote}.`, "Leave it on — and add utm_content={{ad.name}} to its URL parameters so booked calls get credited.");
  }
  if (leads > 0) {
    const at = T.cutNoBookedSpendX * cpbT;
    const days = daysTo(ad, spend, at);
    return keep(
      "testing",
      `${plural(leads, "lead")} at ${money(cpl)} each, no booked call yet — ${money(spend)} spent.`,
      `Leave it on. If it hasn't booked a call by ${money(at)} spent${days !== null ? ` (about ${plural(days, "day")} at its pace)` : ""}, it gets cut.`,
      { spendCents: at, days, progress: Math.min(1, spend / at) }
    );
  }
  const at = T.cutNoLeadsSpendX * cplT;
  const days = daysTo(ad, spend, at);
  return keep(
    "testing",
    spend > 0 ? `${money(spend)} spent so far, no leads yet${metaNote}.` : "Just started — nothing spent yet.",
    `Leave it on. If there's still no lead at ${money(at)} spent${days !== null ? ` (about ${plural(days, "day")} at its pace)` : ""}, it gets cut.`,
    { spendCents: at, days, progress: Math.min(1, spend / at) }
  );
}

/**
 * The whole plan. `earlierCuts` = this morning's cuts (id → reason): those
 * that are now off in Meta show as done.
 */
export function decideAds(s: AdsSnapshot, opts: { earlierCuts?: Record<string, string> } = {}): AdPlan {
  const cpbT = s.targetCpb.cents;
  const cplT = s.targetCpl?.cents ?? Math.round(cpbT / 3);
  const live = s.ads.filter((a) => a.effectiveStatus === "ACTIVE");
  const calls = live.map((a) => callFor(a, cpbT, cplT));
  for (const [id, reason] of Object.entries(opts.earlierCuts ?? {})) {
    if (calls.some((c) => c.adId === id)) continue;
    const ad = s.ads.find((a) => a.id === id);
    if (!ad) continue;
    const c = callFor(ad, cpbT, cplT);
    calls.push({ ...c, call: "cut", tag: null, cutKind: c.cutKind ?? "no_booked", reason, action: "Done — it's off.", decideAt: null, done: true });
  }
  const order = (c: CreativeCall) => (c.call === "cut" ? (c.done ? 1 : 0) : c.tag === "winner" ? 2 : c.tag === "tiring" ? 3 : c.tag === "working" ? 4 : 5);
  calls.sort((a, b) => order(a) - order(b) || b.numbers.spendCents - a.numbers.spendCents);

  // ── How many new creatives, per ad set ──
  const setName = new Map(s.adsets.map((a) => [a.id, a.name]));
  // Retargeting audiences are small: 3 live creatives are plenty there.
  const warm = new Set(s.adsets.filter((a) => a.temperature === "warm").map((a) => a.id));
  const bySet = new Map<string, CreativeCall[]>();
  for (const c of calls) if (!c.done) bySet.set(c.adsetId, [...(bySet.get(c.adsetId) ?? []), c]);
  const adsets: AdsetNeed[] = [...bySet.entries()]
    .map(([adsetId, list]) => {
      const keepers = list.filter((c) => c.call === "keep").length;
      const tiringN = list.filter((c) => c.tag === "tiring").length;
      const cuts = list.filter((c) => c.call === "cut").length;
      const ideal = warm.has(adsetId) ? T.minLiveCreatives : T.idealLiveCreatives;
      const add = Math.min(T.maxAddPerAdset, Math.max(0, ideal - keepers) + tiringN);
      return { adsetId, name: setName.get(adsetId) ?? "Ad set", live: list.length, keepers, tiring: tiringN, cuts, add };
    })
    .sort((a, b) => b.add - a.add || b.live - a.live);
  const add = adsets.reduce((t, a) => t + a.add, 0);
  const thin = adsets.filter((a) => a.keepers < T.minLiveCreatives);
  const cutsOpen = calls.filter((c) => c.call === "cut" && !c.done).length;
  const tiringAll = calls.filter((c) => c.tag === "tiring").length;
  const keepersAll = calls.filter((c) => c.call === "keep").length;
  let when: CreativeNeed["when"] = add === 0 ? "none" : thin.length || cutsOpen ? "today" : "this_week";
  let why: string;
  if (!calls.length) {
    when = "none";
    why = "Nothing is running right now.";
  } else if (when === "today") {
    why = thin.length
      ? `${thin.length === 1 ? `"${thin[0].name}" is left with` : `${thin.length} ad sets are left with`} ${thin.length === 1 ? plural(thin[0].keepers, "creative") + " worth keeping" : "fewer than 3 creatives worth keeping"} — Meta needs ${T.minLiveCreatives}–${T.idealLiveCreatives} live to find a winner and spread the spend.`
      : `Cutting ${plural(cutsOpen, "creative")} leaves gaps to fill — keep ${T.idealLiveCreatives} live per ad set so results don't dip.`;
  } else if (when === "this_week") {
    why = tiringAll
      ? `${plural(tiringAll, "creative")} ${tiringAll === 1 ? "is" : "are"} wearing out — have the replacement${tiringAll === 1 ? "" : "s"} live before results drop.`
      : `You have ${plural(keepersAll, "creative")} worth keeping; ${T.idealLiveCreatives} per ad set gives Meta more to work with.`;
  } else {
    why = `${plural(keepersAll, "live creative")}, all worth keeping. Checked again tomorrow morning.`;
  }

  const counts = {
    cut: cutsOpen,
    cutDone: calls.filter((c) => c.call === "cut" && c.done).length,
    keep: keepersAll,
    winners: calls.filter((c) => c.tag === "winner").length,
    testing: calls.filter((c) => c.tag === "testing").length,
    tiring: tiringAll,
    working: calls.filter((c) => c.tag === "working").length,
  };
  return {
    date: addDays(s.range.until, 1),
    throughDate: s.range.until,
    targets: { cpbCents: cpbT, cpbSource: s.targetCpb.source, cplCents: cplT, cplSource: s.targetCpl?.source ?? "default" },
    calls,
    counts,
    need: { add, when, why, adsets },
  };
}
