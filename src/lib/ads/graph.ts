import {
  actionCount,
  graphGet,
  graphUrl,
  metaCreds,
  toCents,
  toInt,
  type GraphAction,
  type GraphError,
  type MetaCreds,
} from "@/lib/meta-ads";
import type { RawCounts } from "@/lib/ads/types";

/**
 * Read-only Meta Marketing API calls for the Ads tab (ads_read). Reuses the
 * Overview's request helper (token never logged or returned). Every list is
 * page-capped, calls stop early on a rate limit or when the time budget runs
 * out, and fields some accounts refuse fall back to leaner sets.
 */

export type Creds = MetaCreds;

/** Creds for an ad account (Nexli's by default; client firms' later). */
export function adsCreds(accountId?: string | null): MetaCreds | null {
  const c = metaCreds();
  if (!c) return null;
  return accountId ? { ...c, account: accountId.replace(/^act_/i, "") } : c;
}

const RATE_LIMIT = /request limit|too many calls|rate limit|limit reached|throttl|#17\b|#4\b|#613\b|80004|80000/i;
export const isRateLimited = (e: string | null | undefined) => Boolean(e && RATE_LIMIT.test(e));

export interface Budget {
  deadline: number;
  rateLimited: boolean;
}
export const newBudget = (ms: number): Budget => ({ deadline: Date.now() + ms, rateLimited: false });
export const outOfTime = (b: Budget) => b.rateLimited || Date.now() > b.deadline;

interface Page<T> {
  data?: T[];
  paging?: { next?: string };
  error?: GraphError;
}

export interface ListResult<T> {
  rows: T[];
  error: string | null;
  truncated: boolean;
}

/** GET a list edge, following `paging.next` up to `maxPages`. Never throws. */
export async function graphList<T>(
  creds: Creds,
  path: string,
  params: Record<string, string>,
  label: string,
  budget: Budget,
  maxPages = 3
): Promise<ListResult<T>> {
  let url: string | undefined = graphUrl(creds, path, params);
  const rows: T[] = [];
  for (let page = 0; url && page < maxPages; page++) {
    if (outOfTime(budget)) return { rows, error: budget.rateLimited ? "Meta's rate limit was reached" : "Ran out of time", truncated: true };
    const r: Awaited<ReturnType<typeof graphGet<Page<T>>>> = await graphGet<Page<T>>(url, creds.token, label);
    if (!r.ok) {
      if (isRateLimited(r.error)) budget.rateLimited = true;
      return { rows, error: r.error, truncated: rows.length > 0 };
    }
    rows.push(...(r.body.data ?? []));
    url = r.body.paging?.next;
    if (url && page === maxPages - 1) return { rows, error: null, truncated: true };
  }
  return { rows, error: null, truncated: false };
}

/** Try each parameter set in turn (richest first) until one works. */
export async function graphListTiered<T>(
  creds: Creds,
  path: string,
  tiers: Record<string, string>[],
  label: string,
  budget: Budget,
  maxPages = 3
): Promise<ListResult<T>> {
  let last: ListResult<T> = { rows: [], error: "No request made", truncated: false };
  for (let i = 0; i < tiers.length; i++) {
    last = await graphList<T>(creds, path, tiers[i], `${label} (tier ${i + 1})`, budget, maxPages);
    if (!last.error || last.rows.length > 0 || budget.rateLimited || outOfTime(budget)) return last;
  }
  return last;
}

/** GET one node. Never throws. */
export async function graphNode<T extends { error?: GraphError }>(
  creds: Creds,
  path: string,
  params: Record<string, string>,
  label: string,
  budget: Budget
): Promise<{ ok: true; body: T } | { ok: false; error: string }> {
  if (outOfTime(budget)) return { ok: false, error: budget.rateLimited ? "Meta's rate limit was reached" : "Ran out of time" };
  const r = await graphGet<T>(graphUrl(creds, path, params), creds.token, label);
  if (!r.ok && isRateLimited(r.error)) budget.rateLimited = true;
  return r;
}

/** Run async jobs `n` at a time. */
export async function pool<T>(jobs: (() => Promise<T>)[], n = 3): Promise<T[]> {
  const out: T[] = new Array(jobs.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, jobs.length) }, async () => {
      while (next < jobs.length) {
        const i = next++;
        out[i] = await jobs[i]();
      }
    })
  );
  return out;
}

// ── Shapes ──────────────────────────────────────────────

export interface InsightRow {
  date_start?: string;
  date_stop?: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  frequency?: string;
  inline_link_clicks?: string;
  actions?: GraphAction[];
  video_thruplay_watched_actions?: GraphAction[];
  video_p25_watched_actions?: GraphAction[];
  video_p50_watched_actions?: GraphAction[];
  video_p75_watched_actions?: GraphAction[];
  video_p100_watched_actions?: GraphAction[];
  video_avg_time_watched_actions?: GraphAction[];
  quality_ranking?: string;
  engagement_rate_ranking?: string;
  conversion_rate_ranking?: string;
  publisher_platform?: string;
  platform_position?: string;
  age?: string;
  gender?: string;
}

export interface GraphAccount {
  id?: string;
  name?: string;
  currency?: string;
  timezone_name?: string;
  account_status?: number;
  disable_reason?: number;
  error?: GraphError;
}

export interface GraphPixel {
  id?: string;
  name?: string;
  last_fired_time?: string;
}

export interface GraphCampaign {
  id: string;
  name?: string;
  status?: string;
  effective_status?: string;
  objective?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  bid_strategy?: string;
  created_time?: string;
}

export interface GraphAdset {
  id: string;
  name?: string;
  campaign_id?: string;
  status?: string;
  effective_status?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  bid_strategy?: string;
  optimization_goal?: string;
  promoted_object?: { custom_event_type?: string; pixel_id?: string };
  learning_stage_info?: { status?: string; conversions?: number; last_sig_edit_ts?: number };
  targeting?: {
    age_min?: number;
    age_max?: number;
    genders?: number[];
    geo_locations?: { countries?: string[]; regions?: { name?: string }[]; cities?: { name?: string }[] };
    custom_audiences?: { id?: string; name?: string }[];
    excluded_custom_audiences?: { id?: string; name?: string }[];
    flexible_spec?: unknown[];
    publisher_platforms?: string[];
  };
  created_time?: string;
}

export interface GraphAd {
  id: string;
  name?: string;
  adset_id?: string;
  campaign_id?: string;
  status?: string;
  effective_status?: string;
  created_time?: string;
  issues_info?: { error_message?: string; error_summary?: string }[];
  creative?: {
    id?: string;
    object_type?: string;
    video_id?: string;
    image_url?: string;
    thumbnail_url?: string;
    title?: string;
    body?: string;
    call_to_action_type?: string;
    url_tags?: string;
    link_url?: string;
    object_url?: string;
  };
}

// ── Parsing ─────────────────────────────────────────────

/** Meta's lead count without double counting: "lead" already includes pixel + on-Facebook leads. */
export function metaLeadsOf(actions: GraphAction[] | undefined): number {
  const lead = actionCount(actions, "lead");
  if (lead > 0) return lead;
  return actionCount(actions, "offsite_conversion.fb_pixel_lead") + actionCount(actions, "onsite_conversion.lead_grouped");
}

const sumActions = (a: GraphAction[] | undefined) => (a ?? []).reduce((t, x) => t + toInt(x.value), 0);
const num = (v: string | undefined): number | null => {
  const n = Number(v);
  return v !== undefined && Number.isFinite(n) ? n : null;
};

export function rawOf(row: InsightRow | undefined | null): RawCounts {
  if (!row) {
    return { spendCents: 0, impressions: 0, reach: null, frequency: null, linkClicks: 0, landingPageViews: 0, metaLeads: 0, videoViews3s: 0, thruplays: 0 };
  }
  return {
    spendCents: toCents(row.spend),
    impressions: toInt(row.impressions),
    reach: num(row.reach),
    frequency: num(row.frequency),
    linkClicks: toInt(row.inline_link_clicks),
    landingPageViews: actionCount(row.actions, "landing_page_view"),
    metaLeads: metaLeadsOf(row.actions),
    videoViews3s: actionCount(row.actions, "video_view"),
    thruplays: sumActions(row.video_thruplay_watched_actions),
  };
}

export const videoOf = (row: InsightRow | undefined) =>
  row && (row.video_p25_watched_actions || row.video_thruplay_watched_actions)
    ? {
        p25: sumActions(row.video_p25_watched_actions),
        p50: sumActions(row.video_p50_watched_actions),
        p75: sumActions(row.video_p75_watched_actions),
        p100: sumActions(row.video_p100_watched_actions),
        avgWatchSec: row.video_avg_time_watched_actions?.length ? sumActions(row.video_avg_time_watched_actions) : null,
      }
    : null;

export const centsOrNull = (v: string | undefined) => {
  if (v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null; // Meta budgets are already in the minor unit
};

// ── Field sets ──────────────────────────────────────────

const BASIC = "spend,impressions,reach,frequency,inline_link_clicks,actions";
const VIDEO = "video_thruplay_watched_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions,video_avg_time_watched_actions";
const RANKS = "quality_ranking,engagement_rate_ranking,conversion_rate_ranking";

const STATUS_FILTER: Record<"campaign" | "adset" | "ad", string[]> = {
  campaign: ["ACTIVE", "PAUSED", "DELETED", "ARCHIVED", "IN_PROCESS", "WITH_ISSUES"],
  adset: ["ACTIVE", "PAUSED", "DELETED", "CAMPAIGN_PAUSED", "ARCHIVED", "IN_PROCESS", "WITH_ISSUES"],
  ad: ["ACTIVE", "PAUSED", "DELETED", "PENDING_REVIEW", "DISAPPROVED", "PREAPPROVED", "PENDING_BILLING_INFO", "CAMPAIGN_PAUSED", "ARCHIVED", "ADSET_PAUSED", "IN_PROCESS", "WITH_ISSUES"],
};

const ID_FIELDS = {
  account: "",
  campaign: "campaign_id,campaign_name,",
  adset: "adset_id,adset_name,campaign_id,",
  ad: "ad_id,ad_name,adset_id,campaign_id,",
} as const;

export type Range2 = { since: string; until: string };

/**
 * Insights for a level over one or more windows (`time_ranges` → one row per
 * entity per window, told apart by date_start/date_stop). Deleted and archived
 * ads are included so ad-level spend adds up to the account.
 */
export async function insights(
  creds: Creds,
  budget: Budget,
  opts: {
    level: "account" | "campaign" | "adset" | "ad";
    ranges?: Range2[];
    range?: Range2;
    datePreset?: string;
    timeIncrement?: number;
    breakdowns?: string;
    fields?: "basic" | "video" | "full" | "lean";
    adIds?: string[];
    maxPages?: number;
    label: string;
  }
): Promise<ListResult<InsightRow>> {
  const idf = ID_FIELDS[opts.level];
  const fieldSets =
    opts.fields === "full"
      ? [`${idf}${BASIC},${VIDEO},${RANKS}`, `${idf}${BASIC},${VIDEO}`, `${idf}${BASIC}`]
      : opts.fields === "video"
        ? [`${idf}${BASIC},video_thruplay_watched_actions`, `${idf}${BASIC}`]
        : opts.fields === "lean"
          ? [`${idf}spend,impressions,inline_link_clicks,actions`]
          : [`${idf}${BASIC}`];
  const base: Record<string, string> = {
    level: opts.level,
    use_unified_attribution_setting: "true",
    limit: opts.timeIncrement ? "500" : "200",
  };
  if (opts.ranges) base.time_ranges = JSON.stringify(opts.ranges);
  else if (opts.range) base.time_range = JSON.stringify(opts.range);
  else if (opts.datePreset) base.date_preset = opts.datePreset;
  if (opts.timeIncrement) base.time_increment = String(opts.timeIncrement);
  if (opts.breakdowns) base.breakdowns = opts.breakdowns;

  const filters: Record<string, unknown>[] = [];
  if (opts.adIds?.length) filters.push({ field: "ad.id", operator: "IN", value: opts.adIds });
  const withStatus = opts.level !== "account" && !opts.adIds?.length;
  const tiers: Record<string, string>[] = [];
  for (const fields of fieldSets) {
    if (withStatus) {
      const f = [...filters, { field: `${opts.level}.effective_status`, operator: "IN", value: STATUS_FILTER[opts.level as "campaign" | "adset" | "ad"] }];
      tiers.push({ ...base, fields, filtering: JSON.stringify(f) });
    }
    tiers.push({ ...base, fields, ...(filters.length ? { filtering: JSON.stringify(filters) } : {}) });
  }
  return graphListTiered<InsightRow>(creds, `act_${encodeURIComponent(creds.account)}/insights`, tiers, opts.label, budget, opts.maxPages ?? 5);
}

// ── Structure ───────────────────────────────────────────

export async function fetchAccount(creds: Creds, budget: Budget) {
  return graphNode<GraphAccount>(
    creds,
    `act_${encodeURIComponent(creds.account)}`,
    { fields: "name,currency,timezone_name,account_status,disable_reason" },
    "ad account",
    budget
  );
}

export async function fetchPixel(creds: Creds, budget: Budget): Promise<GraphPixel | null> {
  const r = await graphList<GraphPixel>(creds, `act_${encodeURIComponent(creds.account)}/adspixels`, { fields: "id,name,last_fired_time", limit: "5" }, "pixels", budget, 1);
  return r.rows.find((p) => p.id) ?? null;
}

export const fetchCampaigns = (creds: Creds, budget: Budget) =>
  graphListTiered<GraphCampaign>(
    creds,
    `act_${encodeURIComponent(creds.account)}/campaigns`,
    [
      { fields: "id,name,status,effective_status,objective,daily_budget,lifetime_budget,bid_strategy,created_time", limit: "200" },
      { fields: "id,name,status,effective_status,objective,daily_budget,lifetime_budget", limit: "200" },
    ],
    "campaigns",
    budget,
    3
  );

export const fetchAdsets = (creds: Creds, budget: Budget) =>
  graphListTiered<GraphAdset>(
    creds,
    `act_${encodeURIComponent(creds.account)}/adsets`,
    [
      {
        fields:
          "id,name,campaign_id,status,effective_status,daily_budget,lifetime_budget,bid_strategy,optimization_goal,promoted_object,learning_stage_info,created_time,targeting{age_min,age_max,genders,geo_locations,custom_audiences,excluded_custom_audiences,publisher_platforms}",
        limit: "200",
      },
      { fields: "id,name,campaign_id,status,effective_status,daily_budget,lifetime_budget,bid_strategy,optimization_goal,promoted_object,learning_stage_info,created_time", limit: "200" },
      { fields: "id,name,campaign_id,status,effective_status,daily_budget,lifetime_budget,bid_strategy,optimization_goal,promoted_object,created_time", limit: "200" },
    ],
    "ad sets",
    budget,
    3
  );

export const fetchAds = (creds: Creds, budget: Budget) =>
  graphListTiered<GraphAd>(
    creds,
    `act_${encodeURIComponent(creds.account)}/ads`,
    [
      {
        fields:
          "id,name,adset_id,campaign_id,status,effective_status,created_time,issues_info,creative{id,object_type,video_id,image_url,thumbnail_url,title,body,call_to_action_type,url_tags,link_url,object_url}",
        thumbnail_width: "480",
        thumbnail_height: "480",
        limit: "200",
      },
      { fields: "id,name,adset_id,campaign_id,status,effective_status,created_time,creative{id,object_type,video_id,image_url,thumbnail_url,url_tags}", limit: "200" },
      { fields: "id,name,adset_id,campaign_id,status,effective_status,created_time", limit: "200" },
    ],
    "ads",
    budget,
    3
  );

/** Meta account_status codes. */
export function accountStatusOf(code: number | null | undefined): { label: string; tone: "ok" | "warn" | "bad" } {
  switch (code) {
    case 1:
      return { label: "Active", tone: "ok" };
    case 2:
      return { label: "Disabled", tone: "bad" };
    case 3:
      return { label: "Unsettled (payment due)", tone: "bad" };
    case 7:
      return { label: "Pending risk review", tone: "warn" };
    case 8:
      return { label: "Pending settlement", tone: "warn" };
    case 9:
      return { label: "In grace period", tone: "warn" };
    case 100:
      return { label: "Pending closure", tone: "bad" };
    case 101:
      return { label: "Closed", tone: "bad" };
    default:
      return { label: code ? `Status ${code}` : "Unknown", tone: code ? "warn" : "ok" };
  }
}
