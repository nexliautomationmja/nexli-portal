import { adsCache } from "@/lib/ads/cache";
import {
  accountStatusOf,
  adsCreds,
  centsOrNull,
  fetchAccount,
  fetchAds,
  fetchAdsets,
  fetchCampaigns,
  fetchPixel,
  insights,
  newBudget,
  pool,
  rawOf,
  videoOf,
  type Budget,
  type Creds,
  type GraphAd,
  type GraphAdset,
  type GraphCampaign,
  type InsightRow,
  type ListResult,
} from "@/lib/ads/graph";
import { bounds, buildAttribution, loadLeads, outcomesOf, type CompactLead } from "@/lib/ads/attribution";
import { businessCounts, toBusiness, type BusinessCounts } from "@/lib/ads/business";
import { addRaw, compare, computeMetrics, div, ZERO_OUTCOMES, ZERO_RAW } from "@/lib/ads/math";
import { buildSignals, classifyFatigue, isWinner, temperatureOf } from "@/lib/ads/signals";
import { THRESHOLDS } from "@/lib/ads/thresholds";
import { addDays, daysBetween, localDate, rangeWindows, safeTz, zonedMidnight, type RangeWindows } from "@/lib/ads/time";
import { adsManagerUrl, eventsManagerUrl } from "@/lib/ads/links";
import { count, money, pct } from "@/lib/ads/format";
import type {
  AccountInfo,
  AdRow,
  AdsetRow,
  AdsRange,
  AdsSnapshot,
  BreakdownRow,
  CampaignRow,
  DailyPoint,
  FunnelStage,
  LearningStatus,
  Metrics,
  Outcomes,
  RawCounts,
  TrackingItem,
  WeeklyPoint,
} from "@/lib/ads/types";

/**
 * Builds the Ads tab's snapshot for one range: Meta (account, structure,
 * insights at every level, breakdowns, daily and weekly series, fatigue
 * windows) joined with GoHighLevel outcomes and the business numbers, plus
 * deterministic fatigue states and signals. Three cached layers keep Meta
 * calls bounded: account info (24 h), structure + fatigue windows (30 min),
 * range insights (30 min) — the last two also expire when the day rolls over.
 */

const ACCOUNT_TTL = 24 * 3600 * 1000;
const LAYER_TTL = 30 * 60 * 1000;

interface AccountLayer {
  id: string;
  name: string | null;
  currency: string;
  timezone: string;
  statusCode: number | null;
  pixel: { id: string; name: string | null; lastFiredAt: string | null } | null;
}

interface BaseLayer {
  until: string;
  campaigns: GraphCampaign[];
  adsets: GraphAdset[];
  ads: GraphAd[];
  accountDaily: InsightRow[];
  weekly: InsightRow[];
  adWindows: InsightRow[];
  adDaily: InsightRow[];
  today: InsightRow | null;
  errors: string[];
}

interface RangeLayer {
  until: string;
  days: number;
  totals: InsightRow[];
  platforms: InsightRow[];
  campaigns: InsightRow[];
  adsets: InsightRow[];
  ads: InsightRow[];
  placements: InsightRow[];
  demographics: InsightRow[];
  errors: string[];
}

export interface SnapshotTargets {
  cpbCents?: number | null;
  monthlyBudgetCents?: number | null;
}

export type SnapshotResult =
  | { configured: false }
  | { configured: true; snapshot: AdsSnapshot; cachedAt: string; stale: boolean };

const rk = (since: string, until: string) => `${since}|${until}`;
const rowKey = (r: InsightRow) => rk(r.date_start ?? "", r.date_stop ?? "");
const note = (label: string, r: ListResult<unknown>, errors: string[]) => {
  if (r.error) errors.push(`${label}: ${r.error}`);
  else if (r.truncated) errors.push(`${label}: only the first pages were read`);
};

async function loadAccount(creds: Creds, ownerId: string, refresh: boolean) {
  return adsCache<AccountLayer | null>({
    userId: ownerId,
    layer: "account",
    key: `v1:${creds.account}`,
    ttlMs: ACCOUNT_TTL,
    refresh,
    isFresh: (v) => Boolean(v),
    load: async () => {
      const budget = newBudget(20_000);
      const [acct, pixel] = await Promise.all([fetchAccount(creds, budget), fetchPixel(creds, budget)]);
      if (!acct.ok) {
        console.error("[ads] account lookup failed:", acct.error);
        return { ok: false, value: null };
      }
      return {
        ok: true,
        value: {
          id: creds.account,
          name: acct.body.name ?? null,
          currency: acct.body.currency ?? "USD",
          timezone: safeTz(acct.body.timezone_name),
          statusCode: typeof acct.body.account_status === "number" ? acct.body.account_status : null,
          pixel: pixel?.id ? { id: pixel.id, name: pixel.name ?? null, lastFiredAt: pixel.last_fired_time ?? null } : null,
        },
      };
    },
  });
}

async function loadBase(creds: Creds, ownerId: string, w: RangeWindows, budget: Budget, refresh: boolean) {
  return adsCache<BaseLayer>({
    userId: ownerId,
    layer: "base",
    key: `v1:${creds.account}`,
    ttlMs: LAYER_TTL,
    refresh,
    isFresh: (v) => v.until === w.until,
    load: async () => {
      const errors: string[] = [];
      const r = (range: [string, string]) => ({ since: range[0], until: range[1] });
      const [campaigns, adsets, ads, accountDaily, weekly, adWindows, today] = await pool<ListResult<unknown>>(
        [
          () => fetchCampaigns(creds, budget),
          () => fetchAdsets(creds, budget),
          () => fetchAds(creds, budget),
          () => insights(creds, budget, { level: "account", range: { since: addDays(w.until, -179), until: w.until }, timeIncrement: 1, fields: "basic", label: "daily spend", maxPages: 2 }),
          () => insights(creds, budget, { level: "account", range: { since: addDays(w.until, -83), until: w.until }, timeIncrement: 7, fields: "basic", label: "weekly frequency", maxPages: 1 }),
          () => insights(creds, budget, { level: "ad", ranges: [r(w.l7), r(w.base14), r(w.l30), r(w.p30)], fields: "video", label: "ad fatigue windows" }),
          () => insights(creds, budget, { level: "account", datePreset: "today", fields: "lean", label: "today so far", maxPages: 1 }),
        ],
        3
      );
      note("Campaigns", campaigns, errors);
      note("Ad sets", adsets, errors);
      note("Ads", ads, errors);
      note("Daily spend", accountDaily, errors);
      note("Weekly frequency", weekly, errors);
      note("Ad fatigue windows", adWindows, errors);

      // Day-by-day for the top ads (sparklines and fatigue trends).
      const l30 = rk(w.l30[0], w.l30[1]);
      const spend = new Map<string, number>();
      for (const row of adWindows.rows as InsightRow[]) {
        if (row.ad_id && rowKey(row) === l30) spend.set(row.ad_id, rawOf(row).spendCents);
      }
      const activeIds = (ads.rows as GraphAd[]).filter((a) => a.effective_status === "ACTIVE").map((a) => a.id);
      const topIds = [...new Set([...[...spend.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id), ...activeIds])].slice(0, 25);
      let adDaily: ListResult<InsightRow> = { rows: [], error: null, truncated: false };
      if (topIds.length) {
        adDaily = await insights(creds, budget, { level: "ad", range: { since: addDays(w.until, -27), until: w.until }, timeIncrement: 1, fields: "lean", adIds: topIds, label: "ad daily", maxPages: 3 });
        note("Ad daily trend", adDaily, errors);
      }
      const value: BaseLayer = {
        until: w.until,
        campaigns: campaigns.rows as GraphCampaign[],
        adsets: adsets.rows as GraphAdset[],
        ads: ads.rows as GraphAd[],
        accountDaily: accountDaily.rows as InsightRow[],
        weekly: weekly.rows as InsightRow[],
        adWindows: adWindows.rows as InsightRow[],
        adDaily: adDaily.rows,
        today: ((today.rows as InsightRow[])[0] ?? null) as InsightRow | null,
        errors,
      };
      return { ok: errors.length === 0, value };
    },
  });
}

async function loadRange(creds: Creds, ownerId: string, w: RangeWindows, budget: Budget, refresh: boolean) {
  return adsCache<RangeLayer>({
    userId: ownerId,
    layer: "range",
    key: `v1:${creds.account}:${w.days}`,
    ttlMs: LAYER_TTL,
    refresh,
    isFresh: (v) => v.until === w.until && v.days === w.days,
    load: async () => {
      const errors: string[] = [];
      const cur = { since: w.since, until: w.until };
      const prev = { since: w.prevSince, until: w.prevUntil };
      const [totals, platforms, campaigns, adsets, ads, placements, demographics] = await pool<ListResult<InsightRow>>(
        [
          () => insights(creds, budget, { level: "account", ranges: [cur, prev], fields: "video", label: "totals" }),
          async () => {
            const both = await insights(creds, budget, { level: "account", ranges: [cur, prev], breakdowns: "publisher_platform", fields: "basic", label: "platforms" });
            if (!both.error) return both;
            const [a, b] = await Promise.all([
              insights(creds, budget, { level: "account", range: cur, breakdowns: "publisher_platform", fields: "basic", label: "platforms (current)" }),
              insights(creds, budget, { level: "account", range: prev, breakdowns: "publisher_platform", fields: "basic", label: "platforms (previous)" }),
            ]);
            const tag = (rows: InsightRow[], r: { since: string; until: string }) => rows.map((x) => ({ ...x, date_start: r.since, date_stop: r.until }));
            return { rows: [...tag(a.rows, cur), ...tag(b.rows, prev)], error: a.error ?? b.error, truncated: a.truncated || b.truncated };
          },
          () => insights(creds, budget, { level: "campaign", ranges: [cur, prev], fields: "basic", label: "campaign insights" }),
          () => insights(creds, budget, { level: "adset", ranges: [cur, prev], fields: "basic", label: "ad set insights" }),
          () => insights(creds, budget, { level: "ad", ranges: [cur, prev], fields: "full", label: "ad insights" }),
          () => insights(creds, budget, { level: "account", range: cur, breakdowns: "publisher_platform,platform_position", fields: "lean", label: "placements" }),
          () => insights(creds, budget, { level: "account", range: cur, breakdowns: "age,gender", fields: "lean", label: "age & gender" }),
        ],
        3
      );
      note("Totals", totals, errors);
      note("Platforms", platforms, errors);
      note("Campaign results", campaigns, errors);
      note("Ad set results", adsets, errors);
      note("Ad results", ads, errors);
      note("Placements", placements, errors);
      note("Age & gender", demographics, errors);
      return {
        ok: errors.length === 0,
        value: {
          until: w.until,
          days: w.days,
          totals: totals.rows,
          platforms: platforms.rows,
          campaigns: campaigns.rows,
          adsets: adsets.rows,
          ads: ads.rows,
          placements: placements.rows,
          demographics: demographics.rows,
          errors,
        },
      };
    },
  });
}

async function loadBusiness(ownerId: string, w: RangeWindows, tz: string, refresh: boolean) {
  return adsCache<{ until: string; cur: BusinessCounts; prev: BusinessCounts } | null>({
    userId: ownerId,
    layer: "business",
    key: `v1:${w.days}`,
    ttlMs: 10 * 60 * 1000,
    refresh,
    isFresh: (v) => Boolean(v && v.until === w.until),
    load: async () => {
      try {
        const [c, p] = await Promise.all([
          businessCounts(ownerId, zonedMidnight(w.since, tz), zonedMidnight(addDays(w.until, 1), tz)),
          businessCounts(ownerId, zonedMidnight(w.prevSince, tz), zonedMidnight(addDays(w.prevUntil, 1), tz)),
        ]);
        return { ok: true, value: { until: w.until, cur: c, prev: p } };
      } catch (err) {
        console.error("[ads] business numbers failed:", err instanceof Error ? err.message : err);
        return { ok: false, value: null };
      }
    },
  });
}

const ZERO_BUSINESS: BusinessCounts = { newClients: 0, cashCents: 0 };

function adCreative(ad: GraphAd | undefined): AdRow["creative"] {
  const c = ad?.creative;
  const t = (c?.object_type ?? "").toUpperCase();
  const mediaType: AdRow["creative"]["mediaType"] = c?.video_id || t === "VIDEO" ? "video" : c?.image_url || t === "PHOTO" || t === "SHARE" ? "image" : c ? "other" : "other";
  const link = c?.link_url || c?.object_url || null;
  const hasUtm = c ? /utm_content=/i.test(c.url_tags ?? "") || /utm_content=/i.test(link ?? "") : null;
  return {
    mediaType,
    thumbnailUrl: c?.thumbnail_url || c?.image_url || null,
    imageUrl: c?.image_url || null,
    headline: c?.title || null,
    primaryText: c?.body || null,
    ctaType: c?.call_to_action_type || null,
    linkUrl: link,
    urlTags: c?.url_tags || null,
    hasUtmContent: hasUtm,
  };
}

/** Optimization events a week for an ad set, from what its ads did in the last 7 days. */
function eventsFor(goal: string | null, raw: RawCounts | null): number | null {
  if (!raw) return null;
  const g = (goal ?? "").toUpperCase();
  if (/OFFSITE_CONVERSIONS|LEAD_GENERATION|QUALITY_LEAD|CONVERSIONS|VALUE/.test(g)) return raw.metaLeads;
  if (g === "LANDING_PAGE_VIEWS") return raw.landingPageViews;
  if (g === "LINK_CLICKS") return raw.linkClicks;
  if (g === "IMPRESSIONS" || g === "REACH") return raw.impressions;
  return null;
}

const learningOf = (s: string | undefined): LearningStatus => (s === "LEARNING" || s === "SUCCESS" || s === "FAIL" ? s : "UNKNOWN");

const PLATFORM_LABEL: Record<string, string> = { facebook: "Facebook", instagram: "Instagram", messenger: "Messenger", audience_network: "Audience Network", threads: "Threads" };
const POSITION_LABEL: Record<string, string> = {
  feed: "Feed",
  facebook_reels: "Reels",
  instagram_reels: "Reels",
  facebook_stories: "Stories",
  instagram_stories: "Stories",
  instagram_explore: "Explore",
  instagram_explore_grid_home: "Explore home",
  marketplace: "Marketplace",
  video_feeds: "Video feeds",
  right_hand_column: "Right column",
  search: "Search",
  an_classic: "Classic",
  rewarded_video: "Rewarded video",
  instream_video: "In-stream video",
  messenger_inbox: "Inbox",
  instagram_profile_feed: "Profile feed",
  profile_feed: "Profile feed",
  facebook_profile_feed: "Profile feed",
};
const titleCase = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function breakdownRows(rows: InsightRow[], kind: "placement" | "demo"): BreakdownRow[] {
  const map = new Map<string, BreakdownRow>();
  for (const r of rows) {
    const raw = rawOf(r);
    let key: string;
    let label: string;
    let group: string;
    if (kind === "placement") {
      const p = (r.publisher_platform ?? "unknown").toLowerCase();
      const pos = (r.platform_position ?? "unknown").toLowerCase();
      key = `${p}:${pos}`;
      group = PLATFORM_LABEL[p] ?? titleCase(p);
      label = `${group} · ${POSITION_LABEL[pos] ?? titleCase(pos)}`;
    } else {
      const age = r.age ?? "unknown";
      const g = (r.gender ?? "unknown").toLowerCase();
      key = `${age}:${g}`;
      group = age;
      label = `${age} · ${g === "male" ? "Men" : g === "female" ? "Women" : "Unknown"}`;
    }
    const prev = map.get(key);
    const spendCents = (prev?.spendCents ?? 0) + raw.spendCents;
    const impressions = (prev?.impressions ?? 0) + raw.impressions;
    const linkClicks = (prev?.linkClicks ?? 0) + raw.linkClicks;
    const landingPageViews = (prev?.landingPageViews ?? 0) + raw.landingPageViews;
    const metaLeads = (prev?.metaLeads ?? 0) + raw.metaLeads;
    map.set(key, { key, label, group, spendCents, impressions, linkClicks, landingPageViews, metaLeads, ctr: null, cpmCents: null, lpvRate: null, share: null });
  }
  const total = [...map.values()].reduce((t, r) => t + r.spendCents, 0);
  return [...map.values()]
    .map((r) => ({
      ...r,
      ctr: div(r.linkClicks, r.impressions),
      cpmCents: r.impressions > 0 ? Math.round((r.spendCents * 1000) / r.impressions) : null,
      lpvRate: div(r.landingPageViews, r.linkClicks),
      share: div(r.spendCents, total),
    }))
    .filter((r) => r.spendCents > 0 || r.impressions > 0)
    .sort((a, b) => b.spendCents - a.spendCents);
}

/** The full snapshot for a range. */
export async function buildAdsSnapshot(opts: {
  ownerId: string;
  accountId?: string | null;
  range: AdsRange;
  refresh?: boolean;
  targets?: SnapshotTargets;
  /** Total time for Meta calls (the route has its own limit). */
  budgetMs?: number;
}): Promise<SnapshotResult> {
  const creds = adsCreds(opts.accountId);
  if (!creds) return { configured: false };
  const refresh = Boolean(opts.refresh);
  const days = Number(opts.range);
  const budget = newBudget(opts.budgetMs ?? 90_000);
  const partial: string[] = [];

  const acct = await loadAccount(creds, opts.ownerId, refresh);
  const account = acct.value;
  const tz = account?.timezone ?? safeTz(null);
  const w = rangeWindows(days, tz);

  const [base, range, leadScan, biz] = await Promise.all([
    loadBase(creds, opts.ownerId, w, budget, refresh),
    loadRange(creds, opts.ownerId, w, budget, refresh),
    loadLeads({ ownerId: opts.ownerId, scanSince: w.scanSince, until: w.until, tz, refresh }),
    loadBusiness(opts.ownerId, w, tz, refresh),
  ]);
  const B = base.value;
  const R = range.value;
  if (base.stale || range.stale) partial.push("Showing the last saved numbers — Meta didn't answer in full just now.");
  for (const e of [...B.errors, ...R.errors]) partial.push(e);
  const metaError = !account && !B.campaigns.length && !R.totals.length ? "Meta didn't answer — check the ads token in Vercel (META_ADS_ACCESS_TOKEN) and try again." : null;

  const leads: CompactLead[] = leadScan.leads;
  const curB = bounds({ since: w.since, until: w.until }, tz);
  const prevB = bounds({ since: w.prevSince, until: w.prevUntil }, tz);
  const l7B = bounds(w.l7, tz);
  const b14B = bounds(w.base14, tz);
  const l30B = bounds(w.l30, tz);
  const ghlOk = leadScan.connected && !leadScan.error;
  const out = (o: Outcomes) => (ghlOk ? o : null);

  // ── Index Meta rows ──
  const curK = rk(w.since, w.until);
  const prevK = rk(w.prevSince, w.prevUntil);
  const l7K = rk(w.l7[0], w.l7[1]);
  const b14K = rk(w.base14[0], w.base14[1]);
  const l30K = rk(w.l30[0], w.l30[1]);
  const byIdWindow = (rows: InsightRow[], idOf: (r: InsightRow) => string | undefined) => {
    const m = new Map<string, InsightRow>();
    for (const r of rows) {
      const id = idOf(r);
      if (id) m.set(`${id}@${rowKey(r)}`, r);
    }
    return (id: string, key: string) => m.get(`${id}@${key}`);
  };
  const adRange = byIdWindow(R.ads, (r) => r.ad_id);
  const adWin = byIdWindow(B.adWindows, (r) => r.ad_id);
  const setRange = byIdWindow(R.adsets, (r) => r.adset_id);
  const campRange = byIdWindow(R.campaigns, (r) => r.campaign_id);

  // ── Entities (listed + anything that spent but is deleted/archived now) ──
  const adEntity = new Map(B.ads.map((a) => [a.id, a]));
  const seenAdIds = new Set<string>(B.ads.map((a) => a.id));
  const insightName = new Map<string, InsightRow>();
  for (const r of [...R.ads, ...B.adWindows]) {
    if (r.ad_id) {
      seenAdIds.add(r.ad_id);
      if (!insightName.has(r.ad_id)) insightName.set(r.ad_id, r);
    }
  }
  const adIds = [...seenAdIds].filter((id) => {
    const e = adEntity.get(id);
    const spent = [curK, prevK, l30K].some((k) => (rawOf(adRange(id, k) ?? adWin(id, k)).spendCents ?? 0) > 0);
    return e?.effective_status === "ACTIVE" || spent;
  });
  const adMeta = (id: string) => {
    const e = adEntity.get(id);
    const r = insightName.get(id);
    return {
      name: e?.name ?? r?.ad_name ?? id,
      adsetId: e?.adset_id ?? r?.adset_id ?? "",
      campaignId: e?.campaign_id ?? r?.campaign_id ?? "",
      effectiveStatus: e?.effective_status ?? "ARCHIVED",
      status: e?.status ?? "ARCHIVED",
    };
  };

  const campaignsList = new Map<string, { id: string; name: string; g?: GraphCampaign }>();
  for (const c of B.campaigns) campaignsList.set(c.id, { id: c.id, name: c.name ?? c.id, g: c });
  for (const r of R.campaigns) if (r.campaign_id && !campaignsList.has(r.campaign_id)) campaignsList.set(r.campaign_id, { id: r.campaign_id, name: r.campaign_name ?? r.campaign_id });

  const attribution = buildAttribution(
    adIds.map((id) => {
      const m = adMeta(id);
      return { id, name: m.name, campaignId: m.campaignId, adsetId: m.adsetId, spendCents: rawOf(adWin(id, l30K) ?? adRange(id, curK)).spendCents };
    }),
    [...campaignsList.values()].map((c) => ({ id: c.id, name: c.name }))
  );

  // ── GHL outcomes per ad / ad set / campaign / platform / day ──
  const adsetOfAd = new Map(adIds.map((id) => [id, adMeta(id).adsetId]));
  type Bucket = Map<string, Outcomes>;
  const tally = (win: [number, number]) => {
    const ad: Bucket = new Map();
    const adset: Bucket = new Map();
    const camp: Bucket = new Map();
    const plat: Bucket = new Map();
    let unattributed = 0;
    let unknownPlatform = 0;
    let total = 0;
    const bump = (m: Bucket, k: string | null | undefined, l: CompactLead) => {
      if (!k) return;
      const o = m.get(k) ?? { ...ZERO_OUTCOMES };
      o.ghlLeads++;
      o.booked += l.b;
      o.won += l.w;
      m.set(k, o);
    };
    for (const l of leads) {
      if (l.d < win[0] || l.d >= win[1]) continue;
      total++;
      const adId = attribution.adOf(l);
      const campId = attribution.campaignOf(l);
      bump(ad, adId, l);
      bump(adset, adId ? adsetOfAd.get(adId) : null, l);
      bump(camp, campId, l);
      bump(plat, l.p, l);
      if (!adId && !campId) unattributed++;
      if (l.p === "u") unknownPlatform++;
    }
    return { ad, adset, camp, plat, unattributed, unknownPlatform, total };
  };
  const tCur = tally(curB);
  const tPrev = tally(prevB);
  const tL7 = tally(l7B);
  const tB14 = tally(b14B);
  const tL30 = tally(l30B);
  const get = (m: Bucket, k: string) => m.get(k) ?? ZERO_OUTCOMES;

  // ── Account totals ──
  const totalsRow = (k: string) => R.totals.find((r) => rowKey(r) === k);
  const curTotals = computeMetrics(rawOf(totalsRow(curK)), out(outcomesOf(leads, curB)));
  const prevTotals = totalsRow(prevK) ? computeMetrics(rawOf(totalsRow(prevK)), out(outcomesOf(leads, prevB))) : null;
  const totals = compare(curTotals, prevTotals);

  // ── Platforms ──
  const platRaw = (key: string, k: string) =>
    R.platforms
      .filter((r) => rowKey(r) === k && ((r.publisher_platform ?? "").toLowerCase() === key || (key === "other" && !["facebook", "instagram"].includes((r.publisher_platform ?? "").toLowerCase()))))
      .reduce((t, r) => addRaw(t, rawOf(r)), { ...ZERO_RAW });
  const P = { facebook: "f", instagram: "i", other: "o" } as const;
  const platforms: AdsSnapshot["platforms"] = (["facebook", "instagram", "other"] as const)
    .map((key) => ({
      key,
      label: key === "facebook" ? "Facebook" : key === "instagram" ? "Instagram" : "Other Meta",
      m: compare(computeMetrics(platRaw(key, curK), out(get(tCur.plat, P[key]))), computeMetrics(platRaw(key, prevK), out(get(tPrev.plat, P[key])))),
    }))
    .filter((p) => p.key !== "other" || p.m.cur.spendCents > 0 || (p.m.cur.ghlLeads ?? 0) > 0);
  if (ghlOk && tCur.unknownPlatform > 0) {
    platforms.push({
      key: "unknown",
      label: "Meta, platform unknown",
      m: compare(computeMetrics({ ...ZERO_RAW }, get(tCur.plat, "u")), computeMetrics({ ...ZERO_RAW }, get(tPrev.plat, "u"))),
    });
  }

  // ── Daily ──
  const dailyRow = new Map<string, InsightRow>();
  for (const r of B.accountDaily) if (r.date_start) dailyRow.set(r.date_start, r);
  const leadsByDay = new Map<string, Outcomes>();
  for (const l of leads) {
    const d = localDate(new Date(l.d), tz);
    const o = leadsByDay.get(d) ?? { ...ZERO_OUTCOMES };
    o.ghlLeads++;
    o.booked += l.b;
    o.won += l.w;
    leadsByDay.set(d, o);
  }
  const point = (date: string): DailyPoint | null => {
    const r = dailyRow.get(date);
    const raw = rawOf(r);
    const o = leadsByDay.get(date);
    if (!r && !o) return null;
    return { date, spendCents: raw.spendCents, impressions: raw.impressions, linkClicks: raw.linkClicks, landingPageViews: raw.landingPageViews, metaLeads: raw.metaLeads, ghlLeads: o?.ghlLeads ?? 0, booked: o?.booked ?? 0 };
  };
  const daily: AdsSnapshot["daily"] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(w.since, i);
    const prevDate = addDays(w.prevSince, i);
    daily.push({ date, prevDate, cur: point(date), prev: point(prevDate) });
  }
  const weekly: WeeklyPoint[] = B.weekly
    .filter((r) => r.date_start && r.date_stop)
    .map((r) => {
      const raw = rawOf(r);
      return { since: r.date_start as string, until: r.date_stop as string, spendCents: raw.spendCents, impressions: raw.impressions, reach: raw.reach, frequency: raw.frequency, linkClicks: raw.linkClicks };
    })
    .sort((a, b) => a.since.localeCompare(b.since));

  // ── Target cost per booked call ──
  let targetCpb: AdsSnapshot["targetCpb"];
  if (opts.targets?.cpbCents && opts.targets.cpbCents > 0) targetCpb = { cents: opts.targets.cpbCents, source: "settings" };
  else {
    const scanB = bounds({ since: w.scanSince, until: w.until }, tz);
    const booked = outcomesOf(leads, scanB).booked;
    let spend = 0;
    for (const [d, r] of dailyRow) if (d >= w.scanSince && d <= w.until) spend += rawOf(r).spendCents;
    targetCpb = ghlOk && booked >= THRESHOLDS.lowVolume.booked && spend > 0 ? { cents: Math.round(spend / booked), source: "history" } : { cents: THRESHOLDS.defaultTargetCpbCents, source: "default" };
  }

  // ── Ad sets ──
  const adsetEntities = new Map(B.adsets.map((a) => [a.id, a]));
  const setIds = new Set<string>([...B.adsets.map((a) => a.id), ...R.adsets.map((r) => r.adset_id).filter((x): x is string => Boolean(x))]);
  const l7RawBySet = new Map<string, RawCounts>();
  for (const id of adIds) {
    const set = adMeta(id).adsetId;
    const r = adWin(id, l7K);
    if (!set || !r) continue;
    l7RawBySet.set(set, addRaw(l7RawBySet.get(set) ?? { ...ZERO_RAW }, rawOf(r)));
  }
  const activeAdsBySet = new Map<string, number>();
  for (const a of B.ads) if (a.effective_status === "ACTIVE" && a.adset_id) activeAdsBySet.set(a.adset_id, (activeAdsBySet.get(a.adset_id) ?? 0) + 1);
  const until = w.until;
  const adsets: AdsetRow[] = [...setIds]
    .map((id) => {
      const g = adsetEntities.get(id);
      const ins = setRange(id, curK) ?? setRange(id, prevK);
      const curM = computeMetrics(rawOf(setRange(id, curK)), out(get(tCur.adset, id)));
      const prevM = setRange(id, prevK) ? computeMetrics(rawOf(setRange(id, prevK)), out(get(tPrev.adset, id))) : null;
      const editTs = g?.learning_stage_info?.last_sig_edit_ts;
      const editDate = editTs ? new Date(editTs * 1000) : null;
      const t = g?.targeting;
      const audienceBits = [
        t?.age_min || t?.age_max ? `Ages ${t?.age_min ?? 18}–${t?.age_max ?? "65+"}` : null,
        t?.genders?.length === 1 ? (t.genders[0] === 1 ? "Men" : "Women") : null,
        t?.geo_locations?.countries?.length ? t.geo_locations.countries.join(", ") : null,
        t?.custom_audiences?.length ? `${t.custom_audiences.length} custom audience${t.custom_audiences.length > 1 ? "s" : ""}` : null,
      ].filter(Boolean);
      const name = g?.name ?? ins?.adset_name ?? id;
      return {
        id,
        name,
        campaignId: g?.campaign_id ?? ins?.campaign_id ?? "",
        status: g?.status ?? "ARCHIVED",
        effectiveStatus: g?.effective_status ?? "ARCHIVED",
        dailyBudgetCents: centsOrNull(g?.daily_budget),
        lifetimeBudgetCents: centsOrNull(g?.lifetime_budget),
        bidStrategy: g?.bid_strategy ?? null,
        optimizationGoal: g?.optimization_goal ?? null,
        customEvent: g?.promoted_object?.custom_event_type ?? null,
        temperature: g ? temperatureOf(name, (t?.custom_audiences ?? []).map((c) => c.name ?? "")) : "unknown",
        audience: audienceBits.length ? audienceBits.join(" · ") : null,
        learning: {
          status: learningOf(g?.learning_stage_info?.status),
          conversions: g?.learning_stage_info?.conversions ?? null,
          lastSigEditAt: editDate ? editDate.toISOString() : null,
          daysSinceEdit: editDate ? Math.max(0, daysBetween(localDate(editDate, tz), addDays(until, 1))) : null,
        },
        eventsLast7: eventsFor(g?.optimization_goal ?? null, l7RawBySet.get(id) ?? null),
        activeAds: activeAdsBySet.get(id) ?? 0,
        createdTime: g?.created_time ?? null,
        metrics: compare(curM, prevM),
        adsManagerUrl: adsManagerUrl(creds.account, "adset", id),
      } satisfies AdsetRow;
    })
    .filter((s) => s.effectiveStatus === "ACTIVE" || s.metrics.cur.spendCents > 0 || (s.metrics.prev?.spendCents ?? 0) > 0)
    .sort((a, b) => b.metrics.cur.spendCents - a.metrics.cur.spendCents);
  const setTemp = new Map(adsets.map((s) => [s.id, s.temperature]));

  // ── Ads ──
  const dailyByAd = new Map<string, AdRow["daily"]>();
  for (const r of B.adDaily) {
    if (!r.ad_id || !r.date_start) continue;
    const raw = rawOf(r);
    const list = dailyByAd.get(r.ad_id) ?? [];
    list.push({ date: r.date_start, spendCents: raw.spendCents, impressions: raw.impressions, linkClicks: raw.linkClicks, videoViews3s: raw.videoViews3s });
    dailyByAd.set(r.ad_id, list);
  }
  const ads: AdRow[] = adIds
    .map((id) => {
      const m = adMeta(id);
      const e = adEntity.get(id);
      const creative = adCreative(e);
      const cur = adRange(id, curK);
      const prev = adRange(id, prevK);
      const curM = computeMetrics(rawOf(cur), out(get(tCur.ad, id)));
      const prevM = prev ? computeMetrics(rawOf(prev), out(get(tPrev.ad, id))) : null;
      const l7 = adWin(id, l7K) ? computeMetrics(rawOf(adWin(id, l7K)), out(get(tL7.ad, id))) : null;
      const b14 = adWin(id, b14K) ? computeMetrics(rawOf(adWin(id, b14K)), out(get(tB14.ad, id))) : null;
      const l30 = adWin(id, l30K) ? computeMetrics(rawOf(adWin(id, l30K)), out(get(tL30.ad, id))) : null;
      const created = e?.created_time ? new Date(e.created_time) : null;
      const ageDays = created && !Number.isNaN(created.getTime()) ? Math.max(0, daysBetween(localDate(created, tz), addDays(until, 1))) : null;
      const isVideo = creative.mediaType === "video" || (l30?.videoViews3s ?? 0) > 0;
      const fatigue = classifyFatigue({
        active: m.effectiveStatus === "ACTIVE",
        ageDays,
        temperature: setTemp.get(m.adsetId) ?? "unknown",
        isVideo,
        l7,
        base14: b14,
        l30,
        targetCpbCents: targetCpb.cents,
      });
      const rank = (v: string | undefined) => (v && v !== "UNKNOWN" ? v : null);
      const rankings = cur && (rank(cur.quality_ranking) || rank(cur.engagement_rate_ranking) || rank(cur.conversion_rate_ranking))
        ? { quality: rank(cur.quality_ranking), engagement: rank(cur.engagement_rate_ranking), conversion: rank(cur.conversion_rate_ranking) }
        : null;
      return {
        id,
        name: m.name,
        adsetId: m.adsetId,
        campaignId: m.campaignId,
        status: m.status,
        effectiveStatus: m.effectiveStatus,
        createdTime: e?.created_time ?? null,
        ageDays,
        issues: (e?.issues_info ?? []).map((i) => i.error_summary || i.error_message || "").filter(Boolean),
        creative: { ...creative, mediaType: isVideo && creative.mediaType === "other" ? "video" : creative.mediaType },
        metrics: compare(curM, prevM),
        l7,
        base14: b14,
        l30,
        rankings,
        video: isVideo ? videoOf(cur) : null,
        daily: (dailyByAd.get(id) ?? []).sort((a, b) => a.date.localeCompare(b.date)),
        fatigue,
        winner: isWinner(l30, targetCpb.cents),
        attribution: !ghlOk ? "none" : attribution.sharedNameAds.has(id) ? "shared_name" : (l30?.ghlLeads ?? curM.ghlLeads ?? 0) > 0 ? "exact" : "none",
        adsManagerUrl: adsManagerUrl(creds.account, "ad", id),
      } satisfies AdRow;
    })
    .sort((a, b) => b.metrics.cur.spendCents - a.metrics.cur.spendCents || (b.l30?.spendCents ?? 0) - (a.l30?.spendCents ?? 0));

  // ── Campaigns ──
  const activeSetsByCamp = new Map<string, number>();
  for (const s of adsets) if (s.effectiveStatus === "ACTIVE") activeSetsByCamp.set(s.campaignId, (activeSetsByCamp.get(s.campaignId) ?? 0) + 1);
  const campaigns: CampaignRow[] = [...campaignsList.values()]
    .map(({ id, name, g }) => {
      const curM = computeMetrics(rawOf(campRange(id, curK)), out(get(tCur.camp, id)));
      const prevM = campRange(id, prevK) ? computeMetrics(rawOf(campRange(id, prevK)), out(get(tPrev.camp, id))) : null;
      const daily = centsOrNull(g?.daily_budget);
      const lifetime = centsOrNull(g?.lifetime_budget);
      return {
        id,
        name,
        status: g?.status ?? "ARCHIVED",
        effectiveStatus: g?.effective_status ?? "ARCHIVED",
        objective: g?.objective ?? null,
        isCbo: Boolean(daily || lifetime),
        dailyBudgetCents: daily,
        lifetimeBudgetCents: lifetime,
        bidStrategy: g?.bid_strategy ?? null,
        createdTime: g?.created_time ?? null,
        activeAdsets: activeSetsByCamp.get(id) ?? 0,
        metrics: compare(curM, prevM),
        adsManagerUrl: adsManagerUrl(creds.account, "campaign", id),
      } satisfies CampaignRow;
    })
    .filter((c) => c.effectiveStatus === "ACTIVE" || c.metrics.cur.spendCents > 0 || (c.metrics.prev?.spendCents ?? 0) > 0)
    .sort((a, b) => b.metrics.cur.spendCents - a.metrics.cur.spendCents);

  // ── Breakdowns ──
  const placements = breakdownRows(R.placements, "placement");
  const demographics = breakdownRows(R.demographics, "demo");

  // ── Funnel ──
  const stage = (key: FunnelStage["key"], label: string, c: Metrics, p: Metrics | null, pick: (m: Metrics) => number | null): Omit<FunnelStage, "rate" | "prevRate"> => {
    const cv = pick(c);
    const pv = p ? pick(p) : null;
    return { key, label, cur: cv, prev: pv, costPerCents: cv ? Math.round(c.spendCents / cv) : null, prevCostPerCents: p && pv ? Math.round(p.spendCents / pv) : null };
  };
  const raw = [
    stage("impressions", "Impressions", curTotals, prevTotals, (m) => m.impressions),
    stage("link_clicks", "Link clicks", curTotals, prevTotals, (m) => m.linkClicks),
    stage("landing_page_views", "Landing page views", curTotals, prevTotals, (m) => m.landingPageViews),
    stage("leads", "Leads", curTotals, prevTotals, (m) => m.ghlLeads),
    stage("booked", "Booked calls", curTotals, prevTotals, (m) => m.booked),
    stage("won", "Clients won", curTotals, prevTotals, (m) => m.won),
  ];
  const funnel: FunnelStage[] = raw.map((s, i) => ({
    ...s,
    rate: i === 0 ? null : div(s.cur, raw[i - 1].cur),
    prevRate: i === 0 ? null : div(s.prev, raw[i - 1].prev),
    costPerCents: s.key === "impressions" ? (curTotals.cpmCents ?? null) : s.costPerCents,
    prevCostPerCents: s.key === "impressions" ? (prevTotals?.cpmCents ?? null) : s.prevCostPerCents,
  }));

  // ── Tracking health ──
  const tracking: TrackingItem[] = [];
  if (!leadScan.connected) {
    tracking.push({ key: "ghl", severity: "critical", label: "GoHighLevel isn't connected", value: "Leads and booked calls can't be counted.", fix: "Connect GoHighLevel in Settings.", link: { href: "/dashboard/settings", label: "Settings" } });
  } else if (leadScan.error) {
    tracking.push({ key: "ghl", severity: "warning", label: "GoHighLevel didn't answer", value: leadScan.error, fix: "Refresh in a minute.", link: null });
  }
  const activeAdsList = ads.filter((a) => a.effectiveStatus === "ACTIVE");
  const known = activeAdsList.filter((a) => a.creative.hasUtmContent !== null);
  const missingUtm = known.filter((a) => a.creative.hasUtmContent === false);
  if (known.length) {
    tracking.push({
      key: "utm",
      severity: missingUtm.length ? "warning" : "ok",
      label: missingUtm.length ? `${missingUtm.length} live ad${missingUtm.length > 1 ? "s" : ""} without utm_content` : "Every live ad carries utm_content",
      value: missingUtm.length ? missingUtm.slice(0, 3).map((a) => a.name).join(" · ") : `${known.length} live ads checked`,
      fix: missingUtm.length ? "In each ad's URL parameters add utm_content={{ad.name}} (the Overview's UTM template) so leads and booked calls credit the right creative." : null,
      link: missingUtm.length === 1 ? { href: missingUtm[0].adsManagerUrl, label: "Open the ad" } : null,
    });
  }
  if (ghlOk && tCur.total >= 5) {
    const share = tCur.unattributed / tCur.total;
    tracking.push({
      key: "unattributed",
      severity: share >= THRESHOLDS.unattributedCritical ? "critical" : share >= THRESHOLDS.unattributedWarn ? "warning" : "ok",
      label: share >= THRESHOLDS.unattributedWarn ? `${pct(share, 0)} of Meta leads aren't matched to an ad` : "Meta leads match their ads",
      value: `${tCur.unattributed} of ${tCur.total} leads in the period`,
      fix: share >= THRESHOLDS.unattributedWarn ? "Their utm_content doesn't equal an ad name or id. Check ad names weren't changed after launch and that the form keeps UTMs." : null,
      link: { href: "/dashboard/client-tracker", label: "Client Tracker" },
    });
    const unknownShare = tCur.unknownPlatform / tCur.total;
    if (unknownShare >= 0.2) {
      tracking.push({ key: "platform", severity: "info", label: `${pct(unknownShare, 0)} of Meta leads have no platform`, value: `${tCur.unknownPlatform} leads`, fix: "Add utm_source={{site_source_name}} to the ads so Facebook and Instagram are told apart.", link: null });
    }
  }
  if (ghlOk && curTotals.metaLeads >= 5 && (curTotals.ghlLeads ?? 0) >= 5) {
    const gap = Math.abs(curTotals.metaLeads - (curTotals.ghlLeads ?? 0)) / Math.max(curTotals.metaLeads, curTotals.ghlLeads ?? 0);
    tracking.push({
      key: "meta_ghl_gap",
      severity: gap >= THRESHOLDS.metaGhlGapWarn ? "warning" : "ok",
      label: gap >= THRESHOLDS.metaGhlGapWarn ? "Meta and GoHighLevel disagree on leads" : "Meta and GoHighLevel agree on leads",
      value: `Meta ${count(curTotals.metaLeads)} · GoHighLevel ${count(curTotals.ghlLeads)}`,
      fix: gap >= THRESHOLDS.metaGhlGapWarn ? "Usually the pixel's Lead event fires on a different page than the GHL form, or fires twice. Check Events Manager." : null,
      link: gap >= THRESHOLDS.metaGhlGapWarn ? { href: eventsManagerUrl(account?.pixel?.id), label: "Events Manager" } : null,
    });
  }
  if (curTotals.linkClicks >= 100 && curTotals.lpvRate !== null) {
    tracking.push({
      key: "lpv",
      severity: curTotals.lpvRate < THRESHOLDS.lpvRateWarn ? "warning" : "ok",
      label: curTotals.lpvRate < THRESHOLDS.lpvRateWarn ? `Only ${pct(curTotals.lpvRate, 0)} of clicks load the landing page` : `${pct(curTotals.lpvRate, 0)} of clicks load the landing page`,
      value: `${count(curTotals.landingPageViews)} page views from ${count(curTotals.linkClicks)} link clicks`,
      fix: curTotals.lpvRate < THRESHOLDS.lpvRateWarn ? "Slow page loads lose people before the pixel fires. Check page speed on a phone." : null,
      link: null,
    });
  }
  if (account?.pixel) {
    const last = account.pixel.lastFiredAt ? new Date(account.pixel.lastFiredAt) : null;
    const hours = last ? (Date.now() - last.getTime()) / 3600000 : null;
    const stale = hours === null || hours > THRESHOLDS.pixelStaleHours;
    tracking.push({
      key: "pixel",
      severity: stale ? "warning" : "ok",
      label: stale ? "The pixel hasn't fired in over a day" : "Pixel is firing",
      value: last ? `Last fired ${last.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz })}` : "Never fired",
      fix: stale ? "Check the pixel is still on the landing page and the domain is verified." : null,
      link: { href: eventsManagerUrl(account.pixel.id), label: "Events Manager" },
    });
  }
  const dupNames = new Map<string, number>();
  for (const a of activeAdsList) dupNames.set(a.name.trim().toLowerCase(), (dupNames.get(a.name.trim().toLowerCase()) ?? 0) + 1);
  const dupCount = [...dupNames.values()].filter((n) => n > 1).length;
  if (dupCount) {
    tracking.push({ key: "dup_names", severity: "warning", label: `${dupCount} ad name${dupCount > 1 ? "s are" : " is"} used by several live ads`, value: "Leads from them can't be told apart.", fix: "Give every ad a unique name, or use utm_content={{ad.id}}.", link: null });
  }
  if (leadScan.truncated) {
    tracking.push({ key: "ghl_cap", severity: "warning", label: "Only the first 3,000 GoHighLevel contacts were read", value: "Lead counts may be low for long ranges.", fix: null, link: null });
  }
  const adSpendSum = ads.reduce((t, a) => t + a.metrics.cur.spendCents, 0);
  const unallocated = curTotals.spendCents - adSpendSum;
  if (curTotals.spendCents > 0 && unallocated / curTotals.spendCents > 0.02 && R.ads.length) {
    tracking.push({ key: "unallocated", severity: "info", label: `${money(unallocated)} of spend isn't on a listed ad`, value: `${pct(unallocated / curTotals.spendCents, 0)} of the period's spend`, fix: "Usually deleted ads or ads beyond the first pages Meta returned.", link: null });
  }

  // ── Month to date (pacing) ──
  const todayLocal = addDays(until, 1);
  const monthStart = `${todayLocal.slice(0, 8)}01`;
  let mtd = 0;
  for (const [d, r] of dailyRow) if (d >= monthStart && d <= until) mtd += rawOf(r).spendCents;
  mtd += rawOf(B.today).spendCents;
  const [y, mo] = todayLocal.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const fraction = Number(todayLocal.slice(8, 10)) / daysInMonth;

  // ── Business ──
  const bz = biz.value;
  const business = {
    cur: toBusiness(bz?.cur ?? ZERO_BUSINESS, curTotals.spendCents, curTotals.booked),
    prev: bz ? toBusiness(bz.prev, prevTotals?.spendCents ?? 0, prevTotals?.booked ?? null) : null,
  };

  const statusInfo = accountStatusOf(account?.statusCode ?? null);
  const accountInfo: AccountInfo = {
    id: creds.account,
    name: account?.name ?? null,
    currency: account?.currency ?? "USD",
    timezone: tz,
    status: { code: account?.statusCode ?? null, label: statusInfo.label, tone: account ? statusInfo.tone : "ok" },
    pixel: account?.pixel
      ? { ...account.pixel, stale: !account.pixel.lastFiredAt || (Date.now() - new Date(account.pixel.lastFiredAt).getTime()) / 3600000 > THRESHOLDS.pixelStaleHours }
      : null,
  };

  const signals = buildSignals({
    totals,
    daily: daily.map((d) => ({ cur: d.cur })),
    campaigns,
    adsets,
    ads,
    funnel,
    tracking,
    targetCpbCents: targetCpb.cents,
    targetSource: targetCpb.source,
    monthlyBudgetCents: opts.targets?.monthlyBudgetCents ?? null,
    monthToDate: { spendCents: mtd, fraction },
    accountStatus: accountInfo.status,
    rangeDays: days,
  });

  const snapshot: AdsSnapshot = {
    version: 1,
    fetchedAt: new Date(Math.min(base.cachedAt.getTime(), range.cachedAt.getTime())).toISOString(),
    partial: [...new Set(partial)].slice(0, 12),
    errors: { meta: metaError, ghl: leadScan.connected ? leadScan.error : null },
    account: accountInfo,
    range: { key: opts.range, days, since: w.since, until: w.until, prevSince: w.prevSince, prevUntil: w.prevUntil },
    fatigueWindow: { l7: w.l7, base14: w.base14 },
    totals,
    today: B.today ? { spendCents: rawOf(B.today).spendCents, impressions: rawOf(B.today).impressions, linkClicks: rawOf(B.today).linkClicks } : null,
    platforms,
    daily,
    weekly,
    campaigns,
    adsets,
    ads,
    placements,
    demographics,
    funnel,
    tracking,
    business,
    signals,
    ghl: {
      connected: leadScan.connected,
      scanned: leadScan.scanned,
      truncated: leadScan.truncated,
      unattributed: tCur.unattributed,
      platformUnknown: tCur.unknownPlatform,
      sharedName: attribution.sharedNameAds.size,
    },
    thresholds: THRESHOLDS,
    targetCpb,
  };
  return { configured: true, snapshot, cachedAt: snapshot.fetchedAt, stale: base.stale || range.stale };
}
