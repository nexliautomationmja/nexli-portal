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

interface GraphResponse {
  data?: GraphInsightRow[];
  paging?: { next?: string };
  error?: { message?: string; type?: string; code?: number };
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

/** Live Graph API call (no cache). */
export async function fetchMetaInsights(range: {
  since: string;
  until: string;
}): Promise<MetaInsightsResult> {
  const token = process.env.META_ADS_ACCESS_TOKEN?.trim() || "";
  const account = (process.env.META_AD_ACCOUNT_ID || "").trim().replace(/^act_/i, "");
  if (!token || !account) return { configured: false };

  const version = process.env.META_API_VERSION || "v21.0";
  const params = new URLSearchParams({
    access_token: token,
    level: "account",
    fields: "spend,impressions,clicks,actions,account_currency",
    breakdowns: "publisher_platform",
    time_range: JSON.stringify({ since: range.since, until: range.until }),
    time_increment: "all_days",
    limit: "100",
  });
  let url: string | undefined =
    `https://graph.facebook.com/${version}/act_${encodeURIComponent(account)}/insights?${params}`;

  const platforms: Record<MetaPlatformKey, MetaPlatformInsights> = {
    facebook: emptyPlatform(),
    instagram: emptyPlatform(),
    other: emptyPlatform(),
  };
  let currency: string | null = null;

  try {
    for (let page = 0; url && page < MAX_PAGES; page++) {
      const res: Response = await fetch(url, { cache: "no-store" });
      let body: GraphResponse;
      try {
        body = (await res.json()) as GraphResponse;
      } catch {
        return { configured: true, error: `Meta API returned HTTP ${res.status}` };
      }
      if (!res.ok || body.error) {
        const msg = body.error?.message || `Meta API returned HTTP ${res.status}`;
        console.error(`[meta-ads] insights request failed (HTTP ${res.status}, code ${body.error?.code ?? "?"})`);
        return { configured: true, error: scrub(msg, token) };
      }
      for (const row of body.data ?? []) {
        const p = platforms[platformKey(row.publisher_platform)];
        p.spendCents += toCents(row.spend);
        p.impressions += toInt(row.impressions);
        p.clicks += toInt(row.clicks);
        for (const a of row.actions ?? []) {
          if (a.action_type && LEAD_ACTIONS.has(a.action_type)) p.metaLeads += toInt(a.value);
        }
        currency = currency ?? row.account_currency ?? null;
      }
      url = body.paging?.next;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[meta-ads] insights request threw:", scrub(msg, token));
    return { configured: true, error: scrub(`Could not reach the Meta API: ${msg}`, token) };
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

  const cacheWhere = and(
    eq(analyticsSnapshots.userId, opts.userId),
    eq(analyticsSnapshots.source, SOURCE),
    sql`${analyticsSnapshots.data}->>'rangeKey' = ${opts.rangeKey}`
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
    console.error("[meta-ads] cache read failed (continuing):", err);
  }
  const cachedResult = (cached?.data as { result?: MetaInsightsResult } | undefined)?.result;
  if (
    !opts.refresh &&
    cached &&
    cachedResult &&
    Date.now() - new Date(cached.createdAt).getTime() < CACHE_TTL_MS
  ) {
    return cachedResult;
  }

  const live = await fetchMetaInsights({
    since: graphDate(opts.since),
    until: graphDate(opts.until),
  });

  if (live.configured && !live.error) {
    try {
      await db.delete(analyticsSnapshots).where(cacheWhere);
      await db.insert(analyticsSnapshots).values({
        userId: opts.userId,
        source: SOURCE,
        periodStart: opts.since,
        periodEnd: opts.until,
        data: { rangeKey: opts.rangeKey, result: live },
      });
    } catch (err) {
      console.error("[meta-ads] cache write failed (continuing):", err);
    }
    return live;
  }

  if (live.configured && live.error && cachedResult) return cachedResult;
  return live;
}
