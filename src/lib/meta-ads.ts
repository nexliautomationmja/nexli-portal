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
  error_subcode?: number;
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
      console.error(
        `[meta-ads] ${label} request failed (HTTP ${res.status}, code ${body.error?.code ?? "?"}, subcode ${
          body.error?.error_subcode ?? "-"
        }): ${scrub(msg, token)}`
      );
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
  /** Playable MP4 (Meta CDN, signed) for video ads, when readable. */
  videoUrl: string | null;
  /** Large still: video cover or full-size image. */
  posterUrl: string | null;
  /** Primary text above the media. */
  primaryText: string | null;
  /** Headline in the link bar under the media. */
  headline: string | null;
  /** Button label, e.g. "Learn more". */
  ctaLabel: string | null;
  /** Display domain of the destination, e.g. "nexli.net". */
  linkDomain: string | null;
  pageName: string | null;
  pagePictureUrl: string | null;
}

export const BLANK_CREATIVE_META: AdCreativeMeta = {
  status: null,
  mediaType: "other",
  thumbnailUrl: null,
  permalinkUrl: null,
  instagramPermalinkUrl: null,
  facebookPostUrl: null,
  videoUrl: null,
  posterUrl: null,
  primaryText: null,
  headline: null,
  ctaLabel: null,
  linkDomain: null,
  pageName: null,
  pagePictureUrl: null,
};

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

interface GraphCta {
  type?: string;
  value?: { link?: string };
}

interface GraphCreative {
  id?: string;
  body?: string;
  title?: string;
  call_to_action_type?: string;
  link_url?: string;
  object_url?: string;
  thumbnail_url?: string;
  image_url?: string;
  video_id?: string;
  object_type?: string;
  instagram_permalink_url?: string;
  effective_object_story_id?: string;
  actor_id?: string;
  object_story_spec?: {
    page_id?: string;
    video_data?: { video_id?: string; message?: string; title?: string; image_url?: string; call_to_action?: GraphCta };
    link_data?: {
      message?: string;
      name?: string;
      link?: string;
      picture?: string;
      call_to_action?: GraphCta;
      child_attachments?: { picture?: string; name?: string; link?: string }[];
    };
    photo_data?: { url?: string; caption?: string };
  };
  asset_feed_spec?: {
    videos?: { video_id?: string; thumbnail_url?: string }[];
    images?: { url?: string }[];
    bodies?: { text?: string }[];
    titles?: { text?: string }[];
    link_urls?: { website_url?: string; display_url?: string }[];
    call_to_action_types?: string[];
  };
}

interface GraphAdNode {
  id?: string;
  effective_status?: string;
  creative?: GraphCreative;
  error?: GraphError;
}

interface GraphVideoNode {
  id?: string;
  source?: string;
  picture?: string;
  thumbnails?: { data?: { uri?: string; width?: number; is_preferred?: boolean }[] };
  error?: GraphError;
}

interface GraphPageNode {
  name?: string;
  picture?: { data?: { url?: string } };
  error?: GraphError;
}

const first = <T,>(...vals: (T | null | undefined | "")[]): T | null => {
  for (const v of vals) if (v !== undefined && v !== null && v !== "") return v as T;
  return null;
};

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

function videoIdOf(c: GraphCreative | undefined): string | null {
  return first(c?.video_id, c?.object_story_spec?.video_data?.video_id, c?.asset_feed_spec?.videos?.[0]?.video_id);
}

function pageIdOf(c: GraphCreative | undefined): string | null {
  const story = c?.effective_object_story_id?.split("_")[0];
  return first(c?.object_story_spec?.page_id, c?.actor_id, story && /^\d+$/.test(story) ? story : null);
}

function ctaLabelOf(type: string | null): string | null {
  if (!type || type === "NO_BUTTON") return null;
  const special: Record<string, string> = {
    LEARN_MORE: "Learn more",
    BOOK_TRAVEL: "Book now",
    BOOK_NOW: "Book now",
    SIGN_UP: "Sign up",
    APPLY_NOW: "Apply now",
    CONTACT_US: "Contact us",
    GET_QUOTE: "Get quote",
    GET_OFFER: "Get offer",
    DOWNLOAD: "Download",
    WATCH_MORE: "Watch more",
    SCHEDULE: "Book now",
    MESSAGE_PAGE: "Send message",
    SUBSCRIBE: "Subscribe",
  };
  if (special[type]) return special[type];
  const words = type.toLowerCase().split("_").filter(Boolean).join(" ");
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : null;
}

function domainOf(link: string | null): string | null {
  if (!link) return null;
  try {
    return new URL(link).hostname.replace(/^www\./i, "");
  } catch {
    return null;
  }
}

function creativeMetaOf(node: GraphAdNode | undefined): AdCreativeMeta {
  const c = node?.creative;
  const oss = c?.object_story_spec;
  const afs = c?.asset_feed_spec;
  const story = c?.effective_object_story_id?.trim();
  const fbPost = story && /^\d+_\d+$/.test(story) ? `https://www.facebook.com/${story}` : null;
  const ig = c?.instagram_permalink_url?.trim() || null;
  const cta = oss?.video_data?.call_to_action ?? oss?.link_data?.call_to_action;
  const link = first(
    cta?.value?.link,
    oss?.link_data?.link,
    c?.link_url,
    c?.object_url,
    afs?.link_urls?.[0]?.website_url
  );
  const image = first(
    c?.image_url,
    oss?.video_data?.image_url,
    oss?.link_data?.picture,
    oss?.photo_data?.url,
    oss?.link_data?.child_attachments?.[0]?.picture,
    afs?.videos?.[0]?.thumbnail_url,
    afs?.images?.[0]?.url
  );
  return {
    ...BLANK_CREATIVE_META,
    status: node?.effective_status ?? null,
    mediaType: mediaTypeOf(c),
    thumbnailUrl: first(image, c?.thumbnail_url),
    permalinkUrl: ig || fbPost,
    instagramPermalinkUrl: ig,
    facebookPostUrl: fbPost,
    posterUrl: image,
    primaryText: first(oss?.video_data?.message, oss?.link_data?.message, oss?.photo_data?.caption, c?.body, afs?.bodies?.[0]?.text),
    headline: first(oss?.video_data?.title, oss?.link_data?.name, c?.title, afs?.titles?.[0]?.text),
    ctaLabel: ctaLabelOf(first(cta?.type, c?.call_to_action_type, afs?.call_to_action_types?.[0])),
    linkDomain: first(afs?.link_urls?.[0]?.display_url, domainOf(link)),
  };
}

/**
 * Field sets, richest first. Some creative fields aren't readable on every
 * ad type or token, and one unreadable field fails the whole request, so
 * each ad falls back to a leaner set rather than losing everything.
 */
const CREATIVE_FIELD_TIERS = [
  "effective_status,creative{id,body,title,call_to_action_type,link_url,object_url,thumbnail_url,image_url,video_id,object_type,instagram_permalink_url,effective_object_story_id,actor_id,object_story_spec,asset_feed_spec}",
  "effective_status,creative{id,body,title,thumbnail_url,image_url,video_id,object_type,effective_object_story_id,object_story_spec}",
  "effective_status,creative{id,thumbnail_url,image_url,video_id,effective_object_story_id}",
  "effective_status",
];

async function fetchAdNode(creds: MetaCreds, adId: string): Promise<{ ok: true; node: GraphAdNode } | { ok: false; error: string }> {
  let lastError = "Meta returned no ad details";
  for (let i = 0; i < CREATIVE_FIELD_TIERS.length; i++) {
    const r = await graphGet<GraphAdNode>(
      graphUrl(creds, encodeURIComponent(adId), { fields: CREATIVE_FIELD_TIERS[i] }),
      creds.token,
      `ad ${adId} details (tier ${i + 1})`
    );
    if (r.ok) return { ok: true, node: r.body };
    lastError = r.error;
  }
  return { ok: false, error: lastError };
}

/** Playable source + large cover for a video. Needs access to the video's owner (ad account or Page). */
async function fetchVideo(creds: MetaCreds, videoId: string): Promise<{ source: string | null; poster: string | null }> {
  const pick = (v: GraphVideoNode) => {
    const thumbs = v.thumbnails?.data ?? [];
    const best =
      thumbs.find((t) => t.is_preferred && t.uri) ??
      [...thumbs].sort((a, b) => (b.width ?? 0) - (a.width ?? 0)).find((t) => t.uri);
    return { source: v.source || null, poster: best?.uri || v.picture || null };
  };
  for (const fields of ["source,picture,thumbnails{uri,width,is_preferred}", "source,picture"]) {
    const r = await graphGet<GraphVideoNode>(
      graphUrl(creds, encodeURIComponent(videoId), { fields }),
      creds.token,
      `video ${videoId}`
    );
    if (r.ok && (r.body.source || r.body.picture)) return pick(r.body);
  }
  return { source: null, poster: null };
}

/**
 * Videos the Page owns aren't readable with an ads-only token, but the same
 * files sit in the ad account's video library, which is. Small pages (big
 * ones fail with "reduce the amount of data"), stopping once all are found.
 */
async function scanAccountVideos(
  creds: MetaCreds,
  wanted: string[]
): Promise<Map<string, { source: string | null; poster: string | null }>> {
  const found = new Map<string, { source: string | null; poster: string | null }>();
  const need = new Set(wanted);
  let url: string | null = graphUrl(creds, `act_${encodeURIComponent(creds.account)}/advideos`, {
    fields: "id,source,picture",
    limit: "25",
  });
  for (let page = 0; url && need.size > 0 && page < 12; page++) {
    const r: GraphResult<{ data?: GraphVideoNode[]; paging?: { next?: string }; error?: GraphError }> = await graphGet(
      url,
      creds.token,
      `ad account video library (page ${page + 1})`
    );
    if (!r.ok) break;
    for (const v of r.body.data ?? []) {
      if (v.id && need.has(v.id) && v.source) {
        found.set(v.id, { source: v.source, poster: v.picture || null });
        need.delete(v.id);
      }
    }
    url = r.body.paging?.next ?? null;
  }
  if (need.size > 0) console.warn(`[meta-ads] ${need.size} ad video(s) not found in the ad account library`);
  return found;
}

async function fetchPage(creds: MetaCreds, pageId: string): Promise<{ name: string | null; picture: string | null }> {
  for (const fields of ["name,picture.type(large){url}", "name"]) {
    const r = await graphGet<GraphPageNode>(
      graphUrl(creds, encodeURIComponent(pageId), { fields }),
      creds.token,
      `page ${pageId}`
    );
    if (r.ok) return { name: r.body.name || null, picture: r.body.picture?.data?.url || null };
  }
  return { name: null, picture: null };
}

/**
 * Creative metadata for each ad: status, copy, media (playable video when
 * readable), page identity, post links. One request per ad (plus video and
 * page lookups) so one unreadable ad never blanks the others.
 */
export async function getAdCreativesMeta(
  adIds: string[]
): Promise<{ ok: true; byId: Record<string, AdCreativeMeta>; errors: string[] } | { ok: false; error: string }> {
  const creds = metaCreds();
  if (!creds) return { ok: false, error: "Meta ads aren't configured" };
  const ids = adIds.slice(0, 25);
  if (ids.length === 0) return { ok: true, byId: {}, errors: [] };

  const nodes = await Promise.all(ids.map((id) => fetchAdNode(creds, id)));
  const errors = nodes.flatMap((n) => (n.ok ? [] : [n.error]));
  if (errors.length === ids.length) return { ok: false, error: errors[0] };

  const pageIds = [...new Set(nodes.flatMap((n) => (n.ok ? [pageIdOf(n.node.creative)] : [])).filter(Boolean))] as string[];
  const pages = new Map<string, { name: string | null; picture: string | null }>();
  const [videos] = await Promise.all([
    Promise.all(
      nodes.map((n) => {
        const vid = n.ok ? videoIdOf(n.node.creative) : null;
        return vid ? fetchVideo(creds, vid) : Promise.resolve({ source: null, poster: null });
      })
    ),
    Promise.all(pageIds.map(async (pid) => pages.set(pid, await fetchPage(creds, pid)))),
  ]);

  // Fill in what the direct lookups couldn't read from the ad account library.
  const missing = nodes.flatMap((n, i) => {
    const vid = n.ok ? videoIdOf(n.node.creative) : null;
    return vid && !videos[i].source ? [vid] : [];
  });
  if (missing.length > 0) {
    const lib = await scanAccountVideos(creds, missing);
    nodes.forEach((n, i) => {
      const vid = n.ok ? videoIdOf(n.node.creative) : null;
      const hit = vid ? lib.get(vid) : undefined;
      if (hit) videos[i] = { source: hit.source, poster: videos[i].poster || hit.poster };
    });
  }

  const byId: Record<string, AdCreativeMeta> = {};
  ids.forEach((id, i) => {
    const n = nodes[i];
    if (!n.ok) {
      byId[id] = { ...BLANK_CREATIVE_META };
      return;
    }
    const meta = creativeMetaOf(n.node);
    const v = videos[i];
    const page = pages.get(pageIdOf(n.node.creative) ?? "");
    byId[id] = {
      ...meta,
      videoUrl: v.source,
      posterUrl: first(v.poster, meta.posterUrl),
      thumbnailUrl: first(v.poster, meta.thumbnailUrl),
      pageName: page?.name ?? null,
      pagePictureUrl: page?.picture ?? null,
    };
    if (meta.mediaType === "video" && !v.source) {
      console.warn(`[meta-ads] ad ${id}: video source not readable with this token; card falls back to the Meta preview`);
    }
  });
  return { ok: true, byId, errors };
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
  const blank: AdCreativeMeta = BLANK_CREATIVE_META;

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
    creativeError: meta.ok ? (meta.errors.length ? meta.errors[0] : null) : meta.error,
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
    key: `v2:${opts.rangeKey}:${limit}`,
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
