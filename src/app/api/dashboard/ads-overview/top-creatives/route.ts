import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  getResolvedAdPreview,
  getTopAds,
  type AdMediaType,
  type AdPreviewFormat,
} from "@/lib/meta-ads";
import { scanAdLeads } from "@/lib/ad-leads";

/**
 * Admin Overview — top 3 Meta creatives by spend in the range, each with a
 * Meta-rendered preview iframe (Ad Previews API) and booked calls joined
 * from GoHighLevel by utm_content = ad name (the ads' URL parameters use
 * {{ad.name}}; the ad id is accepted too).
 *
 * Caching: top ads 30 min (meta-top-ads), previews 6 h per ad + platform
 * (meta-ad-preview). The GHL join runs per request. `?refresh=1` bypasses.
 */

type Range = "7" | "30" | "90";
type Platform = "facebook" | "instagram";

export interface TopCreative {
  rank: number;
  adId: string;
  adName: string;
  campaignName: string | null;
  adsetName: string | null;
  /** Meta effective_status, e.g. ACTIVE, PAUSED, CAMPAIGN_PAUSED. */
  status: string | null;
  mediaType: AdMediaType;
  thumbnailUrl: string | null;
  permalinkUrl: string | null;
  adsManagerUrl: string;
  spendCents: number;
  impressions: number;
  /** 0–1. */
  ctr: number | null;
  /** Lead actions Meta counted. */
  leads: number;
  cplCents: number | null;
  /** GHL contacts matched by utm_content; null when none matched. */
  ghlLeads: number | null;
  /** Booked calls among matched GHL contacts; null when none matched. */
  booked: number | null;
  costPerBookedCents: number | null;
  previewUrl: string | null;
  previewFormat: AdPreviewFormat | null;
  /** True when the requested platform couldn't render and another format was used. */
  previewFellBack: boolean;
  previewError: string | null;
}

export interface TopCreativesData {
  configured: boolean;
  range: Range;
  format: Platform;
  currency?: string | null;
  creatives?: TopCreative[];
  /** GHL problem; booked calls are then null. */
  leadsError?: string | null;
  error?: string;
}

function parseRange(v: string | null): Range {
  return v === "7" || v === "90" ? v : "30";
}

function windowFor(range: Range): { since: Date; until: Date } {
  const until = new Date();
  const since = new Date(Date.now() - Number(range) * 86400000);
  since.setHours(0, 0, 0, 0);
  return { since, until };
}

const norm = (s: string | null | undefined) => (s || "").trim().toLowerCase();

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const userId = session.user.id;
  const range = parseRange(req.nextUrl.searchParams.get("range"));
  const format: Platform = req.nextUrl.searchParams.get("format") === "instagram" ? "instagram" : "facebook";
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  const { since, until } = windowFor(range);

  const top = await getTopAds({ userId, rangeKey: range, since, until, limit: 3, refresh });
  if (!top.configured) {
    return NextResponse.json({ configured: false, range, format } satisfies TopCreativesData);
  }
  if (!("ads" in top)) {
    return NextResponse.json({ configured: true, range, format, creatives: [], error: top.error } satisfies TopCreativesData);
  }
  if (top.ads.length === 0) {
    return NextResponse.json({
      configured: true,
      range,
      format,
      currency: top.currency,
      creatives: [],
      leadsError: null,
    } satisfies TopCreativesData);
  }

  // ── Booked calls per creative (GHL, utm_content = ad name or ad id) ──
  const keyToAd = new Map<string, string>();
  for (const ad of top.ads) {
    keyToAd.set(norm(ad.adName), ad.adId);
    keyToAd.set(norm(ad.adId), ad.adId);
  }
  keyToAd.delete("");
  const counts = new Map<string, { leads: number; booked: number }>();
  let leadsError: string | null = null;

  const leadsTask = (async () => {
    const [owner] = await db
      .select({ ghlLocationId: users.ghlLocationId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const locationId = owner?.ghlLocationId ?? null;
    if (!locationId) {
      leadsError = "GoHighLevel isn't connected, so booked calls per creative can't be counted.";
      return;
    }
    try {
      const scan = await scanAdLeads({ ownerId: userId, locationId, since, until });
      for (const c of scan.contacts) {
        const adId = keyToAd.get(norm(c.utm?.content));
        if (!adId) continue;
        const b = counts.get(adId) ?? { leads: 0, booked: 0 };
        b.leads++;
        if (c.booked) b.booked++;
        counts.set(adId, b);
      }
    } catch (err) {
      console.error("[top-creatives] GHL lead scan failed:", err);
      leadsError = "Couldn't load booked calls from GoHighLevel right now.";
    }
  })();

  const previewsTask = Promise.all(
    top.ads.map((ad) => getResolvedAdPreview({ userId, adId: ad.adId, platform: format, refresh }))
  );

  const [, previews] = await Promise.all([leadsTask, previewsTask]);

  const creatives: TopCreative[] = top.ads.map((ad, i) => {
    const c = counts.get(ad.adId);
    const p = previews[i];
    const booked = c ? c.booked : null;
    return {
      rank: i + 1,
      adId: ad.adId,
      adName: ad.adName,
      campaignName: ad.campaignName,
      adsetName: ad.adsetName,
      status: ad.status,
      mediaType: ad.mediaType,
      thumbnailUrl: ad.thumbnailUrl,
      permalinkUrl:
        format === "instagram"
          ? ad.instagramPermalinkUrl || ad.facebookPostUrl
          : ad.facebookPostUrl || ad.instagramPermalinkUrl,
      adsManagerUrl: `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${encodeURIComponent(
        top.accountId
      )}&selected_ad_ids=${encodeURIComponent(ad.adId)}`,
      spendCents: ad.spendCents,
      impressions: ad.impressions,
      ctr: ad.ctr,
      leads: ad.leads,
      cplCents: ad.cplCents,
      ghlLeads: c ? c.leads : null,
      booked,
      costPerBookedCents: booked && booked > 0 ? Math.round(ad.spendCents / booked) : null,
      previewUrl: p.url,
      previewFormat: p.format,
      previewFellBack: p.fellBack,
      previewError: p.error,
    };
  });

  return NextResponse.json({
    configured: true,
    range,
    format,
    currency: top.currency,
    creatives,
    leadsError,
  } satisfies TopCreativesData);
}
