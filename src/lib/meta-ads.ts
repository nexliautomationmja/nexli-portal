import { db } from "@/db";
import { analyticsSnapshots } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";

/**
 * Meta Marketing API (read-only) — account-level ad spend split by
 * publisher platform (Facebook / Instagram / other Meta placements).
 *
 * Needs a System User token with `ads_read` (META_ADS_ACCESS_TOKEN) and the
 * ad account id (META_AD_ACCOUNT_ID, with or without the `act_` prefix).
 * This is NOT the Conversions API token (META_CAPI_ACCESS_TOKEN), which can
 * only send events.
 *
 * Never throws: missing env → `{ configured: false }`, Graph API failure →
 * `{ configured: true, error }` with Meta's own message. The token is never
 * logged or returned.
 */

export type MetaPlatformKey = "facebook" | "instagram" | "other";

export interface MetaPlatformInsights {
  spendCents: number;
  impressions: number;
  clicks: number;
  /** Lead actions Meta counted (pixel / instant-form) — cross-check only. */
  metaLeads: number;
}

export type MetaInsightsResult =
  | { configured: false }
  | { configured: true; error: string }
  | {
      configured: true;
      error?: undefined;
      currency: string | null;
      platforms: Record<MetaPlatformKey, MetaPlatformInsights>;
      fetchedAt: string;
    };

const CACHE_TTL_MS = 30 * 60 * 1000;
const SOURCE = "meta-insights";
const MAX_PAGES = 20;
const LEAD_ACTIONS = new Set([
  "lead",
  "offsite_conversion.fb_pixel_lead",
  "onsite_conversion.lead_grouped",
]);

interface GraphAction {
  action_type?: string;
  value?: string;
}

interface GraphInsightRow {
  spend?: string;
  impressions?: string;
  clicks?: string;
  actions?: GraphAction[];
  publisher_platform?: string;
  account_currency?: string;
}

interface GraphError {
  message?: string;
  type?: string;
  code?: number;
}

interface GraphResponse {
  data?: GraphInsightRow[];
  paging?: { next?: string };
  error?: GraphError;
}

function emptyPlatform(): MetaPlatformInsights {
  return { spendCents: 0, impressions: 0, clicks: 0, metaLeads: 0 };
}

function platformKey(raw: string | undefined): MetaPlatformKey {
  const p = (raw || "").toLowerCase();
  if (p === "facebook") return "facebook";
  if (p === "instagram") return "instagram";
  return "other"; // messenger, audience_network, threads, unknown
}

/** "123.45" (account currency) → 12345 cents. */
function toCents(v: string | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function toInt(v: string | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/** Strip any token that might be echoed back in an error string. */
function scrub(message: string, token: string): string {
  return (token ? message.split(token).join("[redacted]") : message).slice(0, 300);
}

export function metaAdsConfigured(): boolean {
  return Boolean(process.env.META_ADS_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID);
}

/** YYYY-MM-DD (UTC) for Graph API time_range. */
export function graphDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface MetaCreds {
  token: string;
  /** Ad account id without the `act_` prefix. */
  account: string;
  version: string;
}

function metaCreds(): MetaCreds | null {
  const token = process.env.META_ADS_ACCESS_TOKEN?.trim() || "";
  const account = (process.env.META_AD_ACCOUNT_ID || "").trim().replace(/^act_/i, "");
  if (!token || !account) return null;
  return { token, account, version: process.env.META_API_VERSION || "v21.0" };
}

/** Ad account id (no `act_` prefix), or null when not configured. */
export function metaAdAccountId(): string | null {
  return metaCreds()?.account ?? null;
}

function graphUrl(creds: MetaCreds, path: string, params: Record<string, string>): string {
  const qs = new URLSearchParams({ ...params, access_token: creds.token });
  return `https://graph.facebook.com/${creds.version}/${path}?${qs}`;
}

type GraphResult<T> = { ok: true; body: T } | { ok: false; error: string };

/**
 * GET a full Graph API URL. Never throws; errors carry Meta's own message
 * with the token scrubbed. `label` only goes into server logs.
 */
async function graphGet<T extends { error?: GraphError }>(
  url: string,
  token: string,
  label: string
): Promise<GraphResult<T>> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    let body: T;
    try {
      body = (await res.json()) as T;
    } catch {
      return { ok: false, error: `Meta API returned HTTP ${res.status}` };
    }
    if (!res.ok || body.error) {
      const msg = body.error?.message || `Meta API returned HTTP ${res.status}`;
      console.error(`[meta-ads] ${label} request failed (HTTP ${res.status}, code ${body.error?.code ?? "?"})`);
      return { ok: false, error: scrub(msg, token) };
    }
    return { ok: true, body };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[meta-ads] ${label} request threw:`, scrub(msg, token));
    return { ok: false, error: scrub(`Could not reach the Meta API: ${msg}`, token) };
  }
}

/**
 * analyticsSnapshots-backed cache for `userId` + `source` + `key`.
 * Fresh hit → cached value. Otherwise `load()`; successes are stored
 * (replacing older rows), failures are never cached and fall back to a
 * stale value when one exists.
 */
async function withSnapshotCache<T>(opts: {
  userId: string;
  source: string;
  key: string;
  ttlMs: number;
  refresh?: boolean;
  periodStart?: Date;
  periodEnd?: Date;
  load: () => Promise<{ ok: true; value: T } | { ok: false; value: T }>;
}): Promise<T> {
  const cacheWhere = and(
    eq(analyticsSnapshots.userId, opts.userId),
    eq(analyticsSnapshots.source, opts.source),
    sql`${analyticsSnapshots.data}->>'rangeKey' = ${opts.key}`
  );

  let cached: { data: unknown; createdAt: Date } | undefined;
  try {
    [cached] = await db
      .select({ data: analyticsSnapshots.data, createdAt: analyticsSnapshots.createdAt })
      .from(analyticsSnapshots)
      .where(cacheWhere)
      .orderBy(desc(analyticsSnapshots.createdAt))
      .limit(1);
  } catch (err) {
    console.error(`[meta-ads] cache read failed (${opts.source}, continuing):`, err);
  }
  const cachedValue = (cached?.data as { result?: T } | undefined)?.result;
  if (
    !opts.refresh &&
    cached &&
    cachedValue !== undefined &&
    Date.now() - new Date(cached.createdAt).getTime() < opts.ttlMs
  ) {
    return cachedValue;
  }

  const live = await opts.load();
  if (live.ok) {
    const now = new Date();
    try {
      await db.delete(analyticsSnapshots).where(cacheWhere);
      await db.insert(analyticsSnapshots).values({
        userId: opts.userId,
        source: opts.source,
        periodStart: opts.periodStart ?? now,
        periodEnd: opts.periodEnd ?? now,
        data: { rangeKey: opts.key, result: live.value },
      });
    } catch (err) {
      console.error(`[meta-ads] cache write failed (${opts.source}, continuing):`, err);
    }
    return live.value;
  }
  return cachedValue !== undefined ? cachedValue : live.value;
}

function leadsOf(actions: GraphAction[] | undefined): number {
  let n = 0;
  for (const a of actions ?? []) {
    if (a.action_type && LEAD_ACTIONS.has(a.action_type)) n += toInt(a.value);
  }
  return n;
}

/** Live Graph API call (no cache). */
export async function fetchMetaInsights(range: {
  since: string;
  until: string;
}): Promise<MetaInsightsResult> {
  const creds = metaCreds();
  if (!creds) return { configured: false };

  let url: string | undefined = graphUrl(creds, `act_${encodeURIComponent(creds.account)}/insights`, {
    level: "account",
    fields: "spend,impressions,clicks,actions,account_currency",
    breakdowns: "publisher_platform",
    time_range: JSON.stringify({ since: range.since, until: range.until }),
    time_increment: "all_days",
    limit: "100",
  });

  const platforms: Record<MetaPlatformKey, MetaPlatformInsights> = {
    facebook: emptyPlatform(),
    instagram: emptyPlatform(),
    other: emptyPlatform(),
  };
  let currency: string | null = null;

  for (let page = 0; url && page < MAX_PAGES; page++) {
    const r: GraphResult<GraphResponse> = await graphGet<GraphResponse>(url, creds.token, "insights");
    if (!r.ok) return { configured: true, error: r.error };
    for (const row of r.body.data ?? []) {
      const p = platforms[platformKey(row.publisher_platform)];
      p.spendCents += toCents(row.spend);
      p.impressions += toInt(row.impressions);
      p.clicks += toInt(row.clicks);
      p.metaLeads += leadsOf(row.actions);
      currency = currency ?? row.account_currency ?? null;
    }
    url = r.body.paging?.next;
  }

  return { configured: true, currency, platforms, fetchedAt: new Date().toISOString() };
}

/**
 * Cached insights for `userId` + `rangeKey` (30 min, analyticsSnapshots,
 * source "meta-insights"). Errors are not cached; a stale snapshot is served
 * if the live call fails.
 */
export async function getMetaInsights(opts: {
  userId: string;
  rangeKey: string;
  since: Date;
  until: Date;
  refresh?: boolean;
}): Promise<MetaInsightsResult> {
  if (!metaAdsConfigured()) return { configured: false };
  return withSnapshotCache<MetaInsightsResult>({
    userId: opts.userId,
    source: SOURCE,
    key: opts.rangeKey,
    ttlMs: CACHE_TTL_MS,
    refresh: opts.refresh,
    periodStart: opts.since,
    periodEnd: opts.until,
    load: async () => {
      const live = await fetchMetaInsights({
        since: graphDate(opts.since),
        until: graphDate(opts.until),
      });
      return { ok: live.configured && !live.error, value: live } as
        | { ok: true; value: MetaInsightsResult }
        | { ok: false; value: MetaInsightsResult };
    },
  });
}

// ─────────────────────────────────────────────────────────────────────
// Top ads by spend + creative metadata + Meta-rendered previews
// ─────────────────────────────────────────────────────────────────────

export type AdMediaType = "video" | "image" | "carousel" | "other";

export interface AdCreativeMeta {
  status: string | null;
  mediaType: AdMediaType;
  thumbnailUrl: string | null;
  /** Instagram permalink, or the Facebook post (`facebook.com/<page>_<post>`). */
  permalinkUrl: string | null;
  instagramPermalinkUrl: string | null;
  facebookPostUrl: string | null;
}

export interface TopAd extends AdCreativeMeta {
  adId: string;
  adName: string;
  campaignName: string | null;
  adsetName: string | null;
  spendCents: number;
  impressions: number;
  clicks: number;
  /** Click-through rate, 0–1 (Meta's `ctr` is a percentage). */
  ctr: number | null;
  /** Lead actions Meta counted for this ad. */
  leads: number;
  cplCents: number | null;
}

export type TopAdsResult =
  | { configured: false }
  | { configured: true; error: string }
  | {
      configured: true;
      error?: undefined;
      accountId: string;
      currency: string | null;
      ads: TopAd[];
      /** Creative lookup problem (ads still listed, without media). */
      creativeError: string | null;
      fetchedAt: string;
    };

interface GraphAdInsightRow extends GraphInsightRow {
  ad_id?: string;
  ad_name?: string;
  adset_name?: string;
  campaign_name?: string;
  ctr?: string;
}

interface GraphAdInsightResponse {
  data?: GraphAdInsightRow[];
  error?: GraphError;
}

interface GraphCreative {
  id?: string;
  thumbnail_url?: string;
  image_url?: string;
  video_id?: string;
  object_type?: string;
  instagram_permalink_url?: string;
  effective_object_story_id?: string;
  object_story_spec?: {
    video_data?: unknown;
    link_data?: { child_attachments?: unknown[] };
  };
  asset_feed_spec?: { videos?: unknown[] };
}

interface GraphAdNode {
  id?: string;
  effective_status?: string;
  creative?: GraphCreative;
}

type GraphIdsResponse = Record<string, GraphAdNode | undefined> & { error?: GraphError };

function mediaTypeOf(c: GraphCreative | undefined): AdMediaType {
  if (!c) return "other";
  if ((c.object_story_spec?.link_data?.child_attachments?.length ?? 0) > 1) return "carousel";
  const t = (c.object_type || "").toUpperCase();
  if (c.video_id || c.object_story_spec?.video_data || t === "VIDEO" || (c.asset_feed_spec?.videos?.length ?? 0) > 0) {
    return "video";
  }
  if (c.image_url || t === "PHOTO" || t === "SHARE" || c.thumbnail_url) return "image";
  return "other";
}

function creativeMetaOf(node: GraphAdNode | undefined): AdCreativeMeta {
  const c = node?.creative;
  const story = c?.effective_object_story_id?.trim();
  const fbPost = story && /^\d+_\d+$/.test(story) ? `https://www.facebook.com/${story}` : null;
  const ig = c?.instagram_permalink_url?.trim() || null;
  return {
    status: node?.effective_status ?? null,
    mediaType: mediaTypeOf(c),
    thumbnailUrl: c?.image_url || c?.thumbnail_url || null,
    permalinkUrl: ig || fbPost,
    instagramPermalinkUrl: ig,
    facebookPostUrl: fbPost,
  };
}

const CREATIVE_FIELDS =
  "effective_status,creative{id,thumbnail_url,image_url,video_id,object_type,instagram_permalink_url,effective_object_story_id,object_story_spec,asset_feed_spec}";

const CREATIVE_FIELDS_LEAN =
  "effective_status,creative{id,thumbnail_url,image_url,video_id,object_type,instagram_permalink_url,effective_object_story_id}";

/** Creative metadata for up to 50 ads in one Graph call (`?ids=`). */
export async function getAdCreativesMeta(
  adIds: string[]
): Promise<{ ok: true; byId: Record<string, AdCreativeMeta> } | { ok: false; error: string }> {
  const creds = metaCreds();
  if (!creds) return { ok: false, error: "Meta ads aren't configured" };
  if (adIds.length === 0) return { ok: true, byId: {} };
  const ids = adIds.slice(0, 50).join(",");
  let r = await graphGet<GraphIdsResponse>(
    graphUrl(creds, "", { ids, fields: CREATIVE_FIELDS }),
    creds.token,
    "ad creatives"
  );
  // Some creative fields aren't readable on every ad type; retry lean.
  if (!r.ok) {
    r = await graphGet<GraphIdsResponse>(
      graphUrl(creds, "", { ids, fields: CREATIVE_FIELDS_LEAN }),
      creds.token,
      "ad creatives (lean)"
    );
  }
  if (!r.ok) return r;
  const byId: Record<string, AdCreativeMeta> = {};
  for (const id of adIds) byId[id] = creativeMetaOf(r.body[id]);
  return { ok: true, byId };
}

/** Creative metadata for one ad. */
export async function getAdCreativeMeta(
  adId: string
): Promise<{ ok: true; meta: AdCreativeMeta } | { ok: false; error: string }> {
  const r = await getAdCreativesMeta([adId]);
  return r.ok ? { ok: true, meta: r.byId[adId] } : r;
}

/** Live: top `limit` ads by spend in the range, with creative metadata. */
export async function fetchTopAds(opts: {
  since: string;
  until: string;
  limit?: number;
}): Promise<TopAdsResult> {
  const creds = metaCreds();
  if (!creds) return { configured: false };
  const limit = Math.max(1, Math.min(opts.limit ?? 3, 25));

  const r = await graphGet<GraphAdInsightResponse>(
    graphUrl(creds, `act_${encodeURIComponent(creds.account)}/insights`, {
      level: "ad",
      fields: "ad_id,ad_name,adset_name,campaign_name,spend,impressions,clicks,ctr,actions,account_currency",
      time_range: JSON.stringify({ since: opts.since, until: opts.until }),
      time_increment: "all_days",
      sort: "spend_descending",
      // A little headroom so zero-spend rows can be dropped.
      limit: String(limit + 5),
    }),
    creds.token,
    "top ads"
  );
  if (!r.ok) return { configured: true, error: r.error };

  let currency: string | null = null;
  const rows = (r.body.data ?? [])
    .filter((row) => row.ad_id && toCents(row.spend) > 0)
    .sort((a, b) => toCents(b.spend) - toCents(a.spend))
    .slice(0, limit);

  const meta = await getAdCreativesMeta(rows.map((row) => row.ad_id as string));
  const blank: AdCreativeMeta = {
    status: null,
    mediaType: "other",
    thumbnailUrl: null,
    permalinkUrl: null,
    instagramPermalinkUrl: null,
    facebookPostUrl: null,
  };

  const ads: TopAd[] = rows.map((row) => {
    currency = currency ?? row.account_currency ?? null;
    const id = row.ad_id as string;
    const spendCents = toCents(row.spend);
    const leads = leadsOf(row.actions);
    const ctrPct = Number(row.ctr);
    return {
      ...(meta.ok ? meta.byId[id] ?? blank : blank),
      adId: id,
      adName: row.ad_name || id,
      campaignName: row.campaign_name || null,
      adsetName: row.adset_name || null,
      spendCents,
      impressions: toInt(row.impressions),
      clicks: toInt(row.clicks),
      ctr: Number.isFinite(ctrPct) && row.ctr !== undefined ? ctrPct / 100 : null,
      leads,
      cplCents: leads > 0 ? Math.round(spendCents / leads) : null,
    };
  });

  return {
    configured: true,
    accountId: creds.account,
    currency,
    ads,
    creativeError: meta.ok ? null : meta.error,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Cached top ads (30 min, analyticsSnapshots source "meta-top-ads", keyed by
 * range). Errors are not cached; stale data is served if Meta fails.
 */
export async function getTopAds(opts: {
  userId: string;
  rangeKey: string;
  since: Date;
  until: Date;
  limit?: number;
  refresh?: boolean;
}): Promise<TopAdsResult> {
  if (!metaAdsConfigured()) return { configured: false };
  const limit = opts.limit ?? 3;
  return withSnapshotCache<TopAdsResult>({
    userId: opts.userId,
    source: "meta-top-ads",
    key: `${opts.rangeKey}:${limit}`,
    ttlMs: CACHE_TTL_MS,
    refresh: opts.refresh,
    periodStart: opts.since,
    periodEnd: opts.until,
    load: async () => {
      const live = await fetchTopAds({
        since: graphDate(opts.since),
        until: graphDate(opts.until),
        limit,
      });
      const ok = live.configured && !live.error && !("creativeError" in live && live.creativeError);
      return { ok, value: live } as { ok: true; value: TopAdsResult } | { ok: false; value: TopAdsResult };
    },
  });
}

export type AdPreviewFormat = "MOBILE_FEED_STANDARD" | "INSTAGRAM_STANDARD" | "INSTAGRAM_REELS";

interface GraphPreviewResponse {
  data?: { body?: string }[];
  error?: GraphError;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** iframe src from a preview body; only https facebook.com hosts are allowed. */
export function previewSrcFromBody(body: string | undefined): string | null {
  if (!body) return null;
  const m = body.match(/\bsrc\s*=\s*"([^"]+)"/i) || body.match(/\bsrc\s*=\s*'([^']+)'/i);
  if (!m) return null;
  try {
    const u = new URL(decodeHtmlEntities(m[1]));
    const host = u.hostname.toLowerCase();
    if (u.protocol !== "https:") return null;
    if (host !== "facebook.com" && !host.endsWith(".facebook.com")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Live: Meta-rendered preview iframe URL for one ad in one format. */
export async function getAdPreview(
  adId: string,
  format: AdPreviewFormat
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const creds = metaCreds();
  if (!creds) return { ok: false, error: "Meta ads aren't configured" };
  const r = await graphGet<GraphPreviewResponse>(
    graphUrl(creds, `${encodeURIComponent(adId)}/previews`, { ad_format: format }),
    creds.token,
    `ad preview (${format})`
  );
  if (!r.ok) return r;
  const url = previewSrcFromBody(r.body.data?.[0]?.body);
  if (url) {
    const u = new URL(url);
    console.info(`[meta-ads] preview ${format} served from ${u.hostname}${u.pathname}`);
  } else {
    console.warn(`[meta-ads] preview ${format}: no usable iframe src in body`);
  }
  return url ? { ok: true, url } : { ok: false, error: `Meta returned no ${format} preview` };
}

export interface ResolvedAdPreview {
  url: string | null;
  /** Format actually rendered. */
  format: AdPreviewFormat | null;
  /** True when the requested platform's format couldn't render. */
  fellBack: boolean;
  error: string | null;
}

const PREVIEW_CHAIN: Record<"facebook" | "instagram", AdPreviewFormat[]> = {
  facebook: ["MOBILE_FEED_STANDARD", "INSTAGRAM_STANDARD", "INSTAGRAM_REELS"],
  instagram: ["INSTAGRAM_STANDARD", "INSTAGRAM_REELS", "MOBILE_FEED_STANDARD"],
};

/**
 * Preview for `platform`, trying its formats in order and falling back to
 * the other platform's. Cached 6 h per ad + platform (the iframe URL carries
 * a short-lived token); failures are not cached.
 */
export async function getResolvedAdPreview(opts: {
  userId: string;
  adId: string;
  platform: "facebook" | "instagram";
  refresh?: boolean;
}): Promise<ResolvedAdPreview> {
  return withSnapshotCache<ResolvedAdPreview>({
    userId: opts.userId,
    source: "meta-ad-preview",
    key: `${opts.adId}:${opts.platform}`,
    ttlMs: 6 * 60 * 60 * 1000,
    refresh: opts.refresh,
    load: async () => {
      const chain = PREVIEW_CHAIN[opts.platform];
      let lastError = "Meta couldn't render a preview";
      for (const format of chain) {
        const r = await getAdPreview(opts.adId, format);
        if (r.ok) {
          const native = opts.platform === "facebook" ? format === "MOBILE_FEED_STANDARD" : format !== "MOBILE_FEED_STANDARD";
          return { ok: true, value: { url: r.url, format, fellBack: !native, error: null } };
        }
        lastError = r.error;
      }
      return { ok: false, value: { url: null, format: null, fellBack: false, error: lastError } };
    },
  });
}
