import { DRS_PRICING, PIPELINE, TOTAL_MONTHLY_CENTS } from "@/lib/drs-pricing";
import { buildAdsSnapshot } from "@/lib/ads/snapshot";
import { THRESHOLDS } from "@/lib/ads/thresholds";
import { decimal, money, pct } from "@/lib/ads/format";
import type { AdRow, AdsSnapshot, Business, Compare, Metrics } from "@/lib/ads/types";
import type { AdSettingsRow } from "@/lib/ads/settings";
import type { PackIndex, RefLevel } from "@/lib/ads/parse";
import type { MetricName, WindowName } from "@/lib/ads/schema";

/**
 * The data pack Manus analyzes: one JSON file (snake_case, money in USD with
 * ready-made display strings, rates 0–1, no personal data) built from the
 * 7/30/90-day snapshots, plus the history of earlier analyses and what Marcel
 * did with their steps. Also the index the parser checks Manus's answer
 * against, and the compact "what it looked like then" summary kept per run.
 */

export const PACK_VERSION = "ads-pack-v1";

const usd = (c: number | null | undefined) => (c === null || c === undefined ? null : Math.round(c) / 100);
const r4 = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 10000) / 10000);

export interface MetricsPack {
  spend_usd: number | null;
  impressions: number;
  reach: number | null;
  frequency: number | null;
  link_clicks: number;
  landing_page_views: number;
  meta_leads: number;
  ghl_leads: number | null;
  booked_calls: number | null;
  won: number | null;
  ctr: number | null;
  cpm_usd: number | null;
  cpc_usd: number | null;
  lpv_rate: number | null;
  hook_rate: number | null;
  hold_rate: number | null;
  cost_per_lead_usd: number | null;
  cost_per_booked_call_usd: number | null;
  lead_to_booked_rate: number | null;
  display: Record<string, string>;
}

export function metricsPack(m: Metrics | null | undefined): MetricsPack | null {
  if (!m) return null;
  return {
    spend_usd: usd(m.spendCents),
    impressions: m.impressions,
    reach: m.reach,
    frequency: r4(m.frequency),
    link_clicks: m.linkClicks,
    landing_page_views: m.landingPageViews,
    meta_leads: m.metaLeads,
    ghl_leads: m.ghlLeads,
    booked_calls: m.booked,
    won: m.won,
    ctr: r4(m.ctr),
    cpm_usd: usd(m.cpmCents),
    cpc_usd: usd(m.cpcCents),
    lpv_rate: r4(m.lpvRate),
    hook_rate: r4(m.hookRate),
    hold_rate: r4(m.holdRate),
    cost_per_lead_usd: usd(m.cplCents),
    cost_per_booked_call_usd: usd(m.costPerBookedCents),
    lead_to_booked_rate: r4(m.bookedRate),
    display: {
      spend: money(m.spendCents),
      cost_per_booked_call: money(m.costPerBookedCents),
      cost_per_lead: money(m.cplCents),
      booked_calls: m.booked === null ? "—" : String(m.booked),
      leads: m.ghlLeads === null ? "—" : String(m.ghlLeads),
      link_ctr: pct(m.ctr),
      cpm: money(m.cpmCents),
      cpc: money(m.cpcCents),
      frequency: decimal(m.frequency, 2),
      hook_rate: pct(m.hookRate),
      hold_rate: pct(m.holdRate),
      landing_page_view_rate: pct(m.lpvRate, 0),
      lead_to_booked_rate: pct(m.bookedRate, 0),
    },
  };
}

const changePack = (c: Compare) =>
  Object.fromEntries(
    (["spendCents", "ghlLeads", "booked", "costPerBookedCents", "cplCents", "ctr", "cpmCents", "cpcCents", "frequency", "hookRate", "lpvRate", "bookedRate"] as const).map((k) => [
      k.replace(/Cents$/, "").replace(/([A-Z])/g, "_$1").toLowerCase(),
      r4(c.delta[k]?.rel ?? null),
    ])
  );

const businessPack = (b: Business | null) =>
  b
    ? {
        new_clients: b.newClients,
        cash_collected_usd: usd(b.cashCents),
        cac_usd: usd(b.cacCents),
        close_rate: r4(b.closeRate),
        setup_fee_coverage: r4(b.setupCoverage),
        cash_roas: r4(b.cashRoas),
      }
    : null;

function windowPack(s: AdsSnapshot) {
  return {
    since: s.range.since,
    until: s.range.until,
    prev_since: s.range.prevSince,
    prev_until: s.range.prevUntil,
    totals: metricsPack(s.totals.cur),
    previous: metricsPack(s.totals.prev),
    change: changePack(s.totals),
    platforms: s.platforms.map((p) => ({ platform: p.key, totals: metricsPack(p.m.cur), previous: metricsPack(p.m.prev) })),
    funnel: s.funnel.map((f) => ({ stage: f.key, count: f.cur, previous: f.prev, rate_from_previous_stage: r4(f.rate), previous_rate: r4(f.prevRate), cost_each_usd: usd(f.costPerCents) })),
    business: businessPack(s.business.cur),
    business_previous: businessPack(s.business.prev),
  };
}

const budgetUsd = (daily: number | null, lifetime: number | null) => ({ daily_budget_usd: usd(daily), lifetime_budget_usd: usd(lifetime) });

function adPack(a: AdRow, still: string | null) {
  return {
    id: a.id,
    name: a.name,
    campaign_id: a.campaignId,
    adset_id: a.adsetId,
    status: a.effectiveStatus,
    created: a.createdTime,
    age_days: a.ageDays,
    issues: a.issues,
    media_type: a.creative.mediaType,
    headline: a.creative.headline,
    primary_text: a.creative.primaryText ? a.creative.primaryText.slice(0, 400) : null,
    link: a.creative.linkUrl,
    utm_content_set: a.creative.hasUtmContent,
    rankings: a.rankings,
    video_completion: a.video,
    fatigue: a.fatigue,
    winner: a.winner,
    lead_attribution: a.attribution,
    windows: {
      last_7d: metricsPack(a.l7),
      base_14d: metricsPack(a.base14),
      last_30d: metricsPack(a.l30),
      range_30d: metricsPack(a.metrics.cur),
      prev_30d: metricsPack(a.metrics.prev),
    },
    daily_28d: {
      dates: a.daily.map((d) => d.date),
      ctr: a.daily.map((d) => r4(d.impressions ? d.linkClicks / d.impressions : null)),
      spend_usd: a.daily.map((d) => usd(d.spendCents)),
    },
    still_file: still,
  };
}

export interface PackHistory {
  previous_analyses: { id: string; finished_at: string | null; verdict: string | null; health_score: number | null; headline: string | null }[];
  previous_steps: {
    id: string;
    key: string;
    kind: string;
    title: string;
    priority: string;
    status: string;
    suggested_at: string;
    done_at: string | null;
    note: string | null;
    skipped_reason: string | null;
    marcel_says: string | null;
    verified_in_meta: string | null;
    targets: unknown[];
    metric_then: unknown;
    metric_now: unknown;
  }[];
  changes_detected: string[];
}

export interface Still {
  url: string;
  filename: string;
}

export type DataPack = ReturnType<typeof buildPack>;

export function buildPack(src: { s7: AdsSnapshot; s30: AdsSnapshot; s90: AdsSnapshot | null; settings: AdSettingsRow; history: PackHistory }) {
  const { s7, s30, s90, settings, history } = src;
  // Ads that matter: live ones and anything that spent in the last 30 days (biggest first, max 60).
  const ads = s30.ads
    .filter((a) => a.effectiveStatus === "ACTIVE" || (a.l30?.spendCents ?? 0) > 0)
    .sort((a, b) => (b.l30?.spendCents ?? 0) - (a.l30?.spendCents ?? 0))
    .slice(0, 60);
  const stills: Still[] = ads
    .filter((a) => a.creative.thumbnailUrl)
    .slice(0, 8)
    .map((a, i) => ({ url: a.creative.thumbnailUrl as string, filename: `creative-${i + 1}-${a.id}.jpg` }));
  const stillOf = new Map(stills.map((s) => [s.filename.split("-").slice(2).join("-").replace(/\.jpg$/, ""), s.filename]));

  const notes = [
    ...(s30.ghl.truncated ? ["GoHighLevel scan hit its cap — lead counts for long windows may be low."] : []),
    ...(s30.errors.ghl ? [`GoHighLevel: ${s30.errors.ghl}`] : []),
    ...s30.partial.map((p) => `Partial data: ${p}`),
    ...(s30.ghl.sharedName ? [`${s30.ghl.sharedName} ads share a name with another ad, so their leads are credited to the bigger spender.`] : []),
  ];

  const pack = {
    pack_version: PACK_VERSION,
    generated_at: new Date().toISOString(),
    through_date: s30.range.until,
    timezone: s30.account.timezone,
    currency: s30.account.currency,
    account: {
      id: s30.account.id,
      name: s30.account.name,
      status: s30.account.status.label,
      pixel_last_fired: s30.account.pixel?.lastFiredAt ?? null,
      pixel_stale: s30.account.pixel?.stale ?? null,
    },
    business_model: {
      company: "Nexli — paid-ads client acquisition for CPA firms (the Digital Rainmaker System)",
      ideal_client: "Owners and partners of US CPA / accounting firms who want more high-value clients",
      path: "Meta ad → landing page → GoHighLevel lead → booked strategy call → signed client",
      setup_fee_usd: usd(DRS_PRICING.SETUP_FEE_CENTS),
      monthly_usd: usd(TOTAL_MONTHLY_CENTS),
      average_deal_value_usd: usd(PIPELINE.DEFAULT_DEAL_VALUE_CENTS),
      main_conversion: "booked strategy call",
    },
    goals: {
      target_cost_per_booked_call_usd: usd(s30.targetCpb.cents),
      target_source: s30.targetCpb.source === "settings" ? "set by Marcel" : s30.targetCpb.source === "history" ? "assumed: the account's own recent average (no target set)" : "assumed: starting default (no target, not enough history)",
      target_cost_per_lead_usd: usd(settings.targetCplCents),
      monthly_budget_usd: usd(settings.monthlyBudgetCents),
      max_cac_usd: usd(settings.maxCacCents),
      notes_from_marcel: settings.context || null,
    },
    definitions: {
      leads: "GoHighLevel contacts from Meta (source of truth); meta_leads is Meta's own count, a cross-check only",
      booked_calls: "Those leads who booked a call (GHL tags + the portal's pipeline), counted by when the lead came in",
      ctr: "link clicks ÷ impressions",
      hook_rate: "3-second video plays ÷ impressions",
      hold_rate: "ThruPlays ÷ 3-second plays",
      lpv_rate: "landing page views ÷ link clicks",
      fatigue_windows: "last_7d vs base_14d (the 14 days before it)",
      attribution: "a lead is credited to an ad when its utm_content equals the ad's name or id",
    },
    thresholds: { ...THRESHOLDS, defaultTargetCpbUsd: usd(THRESHOLDS.defaultTargetCpbCents), minSpendUsd: usd(THRESHOLDS.minSpendCents), deadSpendFloorUsd: usd(THRESHOLDS.deadSpendFloorCents) },
    windows: {
      last_7d: windowPack(s7),
      last_30d: windowPack(s30),
      last_90d: s90 ? windowPack(s90) : null,
    },
    today_so_far: s30.today ? { spend_usd: usd(s30.today.spendCents), impressions: s30.today.impressions, link_clicks: s30.today.linkClicks } : null,
    daily: (s90 ?? s30).daily.map((d) => ({
      date: d.date,
      spend_usd: usd(d.cur?.spendCents ?? null),
      impressions: d.cur?.impressions ?? 0,
      link_clicks: d.cur?.linkClicks ?? 0,
      ghl_leads: d.cur?.ghlLeads ?? 0,
      booked: d.cur?.booked ?? 0,
    })),
    weekly_frequency: s30.weekly.map((w) => ({ since: w.since, until: w.until, frequency: r4(w.frequency), reach: w.reach, spend_usd: usd(w.spendCents) })),
    campaigns: s30.campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.effectiveStatus,
      objective: c.objective,
      campaign_budget: c.isCbo,
      ...budgetUsd(c.dailyBudgetCents, c.lifetimeBudgetCents),
      bid_strategy: c.bidStrategy,
      active_adsets: c.activeAdsets,
      windows: { last_30d: metricsPack(c.metrics.cur), prev_30d: metricsPack(c.metrics.prev) },
    })),
    adsets: s30.adsets.map((a) => ({
      id: a.id,
      name: a.name,
      campaign_id: a.campaignId,
      status: a.effectiveStatus,
      ...budgetUsd(a.dailyBudgetCents, a.lifetimeBudgetCents),
      bid_strategy: a.bidStrategy,
      optimization_goal: a.optimizationGoal,
      custom_event: a.customEvent,
      audience: a.audience,
      audience_temperature: a.temperature,
      learning: { status: a.learning.status, conversions: a.learning.conversions, days_since_significant_edit: a.learning.daysSinceEdit },
      optimization_events_last_7d: a.eventsLast7,
      active_ads: a.activeAds,
      windows: { last_30d: metricsPack(a.metrics.cur), prev_30d: metricsPack(a.metrics.prev) },
    })),
    ads: ads.map((a) => adPack(a, stillOf.get(a.id) ?? null)),
    placements_30d: s30.placements.slice(0, 15).map((p) => ({ placement: p.label, spend_usd: usd(p.spendCents), share: r4(p.share), ctr: r4(p.ctr), cpm_usd: usd(p.cpmCents), lpv_rate: r4(p.lpvRate), meta_leads: p.metaLeads })),
    audience_30d: s30.demographics.slice(0, 20).map((p) => ({ segment: p.label, spend_usd: usd(p.spendCents), share: r4(p.share), ctr: r4(p.ctr), meta_leads: p.metaLeads })),
    tracking: s30.tracking.map((t) => ({ check: t.key, severity: t.severity, finding: t.label, detail: t.value, fix: t.fix })),
    signals: s30.signals.map((x) => ({ kind: x.kind, severity: x.severity, title: x.title, detail: x.detail, ref: x.ref })),
    history,
    notes,
  };
  return { pack, stills };
}

// ── Index for checking Manus's answer ────────────────────

const FIELD: Partial<Record<MetricName, keyof MetricsPack>> = {
  spend: "spend_usd",
  cost_per_booked_call: "cost_per_booked_call_usd",
  booked_calls: "booked_calls",
  cost_per_lead: "cost_per_lead_usd",
  leads: "ghl_leads",
  won_clients: "won",
  link_ctr: "ctr",
  cpm: "cpm_usd",
  cpc: "cpc_usd",
  frequency: "frequency",
  hook_rate: "hook_rate",
  hold_rate: "hold_rate",
  landing_page_view_rate: "lpv_rate",
  lead_to_booked_rate: "lead_to_booked_rate",
};

type Pack = DataPack["pack"];

export function packIndex(pack: Pack): PackIndex {
  const byId = {
    campaign: new Map(pack.campaigns.map((c) => [c.id, c])),
    adset: new Map(pack.adsets.map((a) => [a.id, a])),
    ad: new Map(pack.ads.map((a) => [a.id, a])),
  };
  const byName = {
    campaign: new Map(pack.campaigns.map((c) => [c.name.toLowerCase(), c.id])),
    adset: new Map(pack.adsets.map((a) => [a.name.toLowerCase(), a.id])),
    ad: new Map(pack.ads.map((a) => [a.name.toLowerCase(), a.id])),
  };
  const read = (m: MetricsPack | null | undefined, metric: MetricName): number | null => {
    const f = FIELD[metric];
    if (!m || !f) return null;
    const v = m[f];
    return typeof v === "number" ? v : null;
  };
  const accountWindow = (w: WindowName): { m: MetricsPack | null; biz: ReturnType<typeof businessPack> } | null => {
    const W = pack.windows;
    if (w === "last_7d") return { m: W.last_7d.totals, biz: W.last_7d.business };
    if (w === "prev_7d") return { m: W.last_7d.previous, biz: W.last_7d.business_previous };
    if (w === "last_30d") return { m: W.last_30d.totals, biz: W.last_30d.business };
    if (w === "prev_30d") return { m: W.last_30d.previous, biz: W.last_30d.business_previous };
    if (w === "last_90d" && W.last_90d) return { m: W.last_90d.totals, biz: W.last_90d.business };
    if (w === "prev_90d" && W.last_90d) return { m: W.last_90d.previous, biz: W.last_90d.business_previous };
    return null;
  };
  return {
    account: pack.account.id,
    has: (level, id) => level === "account" || Boolean(byId[level as "campaign" | "adset" | "ad"]?.has(id)),
    idByName: (level, name) => (level === "account" ? pack.account.id : (byName[level as "campaign" | "adset" | "ad"]?.get(name.trim().toLowerCase()) ?? null)),
    metric: (level: RefLevel, id, metric, window) => {
      if (level === "account" || level === "business") {
        const w = accountWindow(window);
        if (!w) return null;
        if (metric === "close_rate") return w.biz?.close_rate ?? null;
        if (metric === "cac") return w.biz?.cac_usd ?? null;
        return read(w.m, metric);
      }
      if (!id) return null;
      if (level === "ad") {
        const a = byId.ad.get(id);
        if (!a) return null;
        const map: Partial<Record<WindowName, MetricsPack | null>> = { last_7d: a.windows.last_7d, base_14d: a.windows.base_14d, last_30d: a.windows.last_30d, prev_30d: a.windows.prev_30d };
        return read(map[window], metric);
      }
      if (level === "adset" || level === "campaign") {
        const e = level === "adset" ? byId.adset.get(id) : byId.campaign.get(id);
        if (!e) return null;
        return read(window === "last_30d" ? e.windows.last_30d : window === "prev_30d" ? e.windows.prev_30d : null, metric);
      }
      return null;
    },
  };
}

// ── What it looked like then (kept per analysis; baselines + verification) ──

export interface EntityThen {
  id: string;
  name: string;
  status: string;
  parentId: string | null;
  dailyBudgetCents: number | null;
  lifetimeBudgetCents: number | null;
  createdTime: string | null;
  spend30Cents: number | null;
  booked30: number | null;
  cpb30Cents: number | null;
  ctr7: number | null;
  frequency7: number | null;
  hasUtm: boolean | null;
}

export interface SnapshotSummary {
  throughDate: string;
  totals30: { spendCents: number; booked: number | null; cpbCents: number | null; cplCents: number | null; ctr: number | null; cpmCents: number | null };
  campaigns: EntityThen[];
  adsets: EntityThen[];
  ads: EntityThen[];
}

export function snapshotSummary(s: AdsSnapshot): SnapshotSummary {
  return {
    throughDate: s.range.until,
    totals30: { spendCents: s.totals.cur.spendCents, booked: s.totals.cur.booked, cpbCents: s.totals.cur.costPerBookedCents, cplCents: s.totals.cur.cplCents, ctr: s.totals.cur.ctr, cpmCents: s.totals.cur.cpmCents },
    campaigns: s.campaigns.map((c) => ({ id: c.id, name: c.name, status: c.effectiveStatus, parentId: null, dailyBudgetCents: c.dailyBudgetCents, lifetimeBudgetCents: c.lifetimeBudgetCents, createdTime: c.createdTime, spend30Cents: c.metrics.cur.spendCents, booked30: c.metrics.cur.booked, cpb30Cents: c.metrics.cur.costPerBookedCents, ctr7: null, frequency7: null, hasUtm: null })),
    adsets: s.adsets.map((a) => ({ id: a.id, name: a.name, status: a.effectiveStatus, parentId: a.campaignId, dailyBudgetCents: a.dailyBudgetCents, lifetimeBudgetCents: a.lifetimeBudgetCents, createdTime: a.createdTime, spend30Cents: a.metrics.cur.spendCents, booked30: a.metrics.cur.booked, cpb30Cents: a.metrics.cur.costPerBookedCents, ctr7: null, frequency7: null, hasUtm: null })),
    ads: s.ads.map((a) => ({ id: a.id, name: a.name, status: a.effectiveStatus, parentId: a.adsetId, dailyBudgetCents: null, lifetimeBudgetCents: null, createdTime: a.createdTime, spend30Cents: a.l30?.spendCents ?? null, booked30: a.l30?.booked ?? null, cpb30Cents: a.l30?.costPerBookedCents ?? null, ctr7: a.l7?.ctr ?? null, frequency7: a.l7?.frequency ?? null, hasUtm: a.creative.hasUtmContent })),
  };
}

export const entityIn = (sum: SnapshotSummary | null | undefined, level: string, id: string | null) => {
  if (!sum || !id) return null;
  const list = level === "campaign" ? sum.campaigns : level === "adset" ? sum.adsets : level === "ad" ? sum.ads : null;
  return list?.find((e) => e.id === id) ?? null;
};

/** The three snapshots the pack is built from (30 first: it warms the shared caches). */
export async function gatherSnapshots(ownerId: string, accountId: string, settings: AdSettingsRow) {
  const targets = { cpbCents: settings.targetCpbCents, monthlyBudgetCents: settings.monthlyBudgetCents };
  const r30 = await buildAdsSnapshot({ ownerId, accountId, range: "30", targets, budgetMs: 80_000 });
  if (!r30.configured) return null;
  const [r7, r90] = await Promise.all([
    buildAdsSnapshot({ ownerId, accountId, range: "7", targets, budgetMs: 60_000 }),
    buildAdsSnapshot({ ownerId, accountId, range: "90", targets, budgetMs: 60_000 }),
  ]);
  return {
    s30: r30.snapshot,
    s7: r7.configured ? r7.snapshot : r30.snapshot,
    s90: r90.configured ? r90.snapshot : null,
  };
}
