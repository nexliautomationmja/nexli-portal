import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { users, invoices, analyticsSnapshots } from "@/db/schema";
import { and, desc, eq, gte, lte, gt, isNotNull, sql } from "drizzle-orm";
import { getMetaInsights, type MetaPlatformInsights, type MetaPlatformKey } from "@/lib/meta-ads";
import { scanAdLeads } from "@/lib/ad-leads";
import { getBookOfBusiness, adSpendOf } from "@/lib/book-of-business";
import { getNexliAdminId } from "@/lib/foundation-project";
import { DRS_PRICING } from "@/lib/drs-pricing";

/**
 * Admin Overview — Meta ads performance (Facebook vs Instagram).
 *
 * Spend: Meta Marketing API insights, broken down by publisher_platform.
 * Leads / booked calls: the admin's own GoHighLevel contacts in the window,
 * classified by platformOf (utm_source={{site_source_name}} → fb / ig).
 * Business tiles: Nexli's book of business — clients whose start date falls
 * in the window, and the cash they paid in the window (ad-budget
 * pass-through excluded).
 *
 * Whole response cached 10 min per admin + range (analyticsSnapshots,
 * source "ads-overview"); Meta insights have their own 30-min cache.
 * `?refresh=1` bypasses both.
 */

const CACHE_TTL_MS = 10 * 60 * 1000;
const SOURCE = "ads-overview-v2"; // v2: CPC + landing page conversion

type Range = "7" | "30" | "90";

export interface PlatformRow {
  key: MetaPlatformKey | "total";
  label: string;
  spendCents: number;
  leads: number;
  booked: number;
  /** Cost per lead, cents; null when no leads. */
  cplCents: number | null;
  /** Cost per booked call, cents; null when no booked calls. */
  costPerBookedCents: number | null;
  /** Lead → booked, 0–1; null when no leads. */
  bookedRate: number | null;
  /** Leads Meta itself counted (pixel / instant form) — cross-check. */
  metaLeads: number;
  impressions: number;
  linkClicks: number;
  landingPageViews: number;
  /** Cost per link click, cents; null when no link clicks. */
  cpcCents: number | null;
  /** Cost per 1,000 impressions, cents. */
  cpmCents: number | null;
  /** Link clicks ÷ impressions, 0–1. */
  ctr: number | null;
  /** Leads ÷ landing page views, 0–1 (falls back to link clicks when Meta reports no page views). */
  lpConversion: number | null;
  /** Which denominator lpConversion used. */
  lpBasis: "landing_page_views" | "link_clicks" | null;
}

export interface AdsOverviewData {
  configured: boolean;
  range: Range;
  since: string;
  until: string;
  /** Meta API error message (token, permissions…); data below is then partial. */
  metaError: string | null;
  currency: string | null;
  /** GHL problem (no location connected / API failure); leads are then 0. */
  leadsError: string | null;
  platforms: PlatformRow[];
  totals: PlatformRow;
  business: {
    newClients: number;
    bookedCalls: number;
    /** New clients ÷ booked calls, uncapped (UI caps display at 100%). */
    closeRate: number | null;
    cacCents: number | null;
    /** Setup fee ÷ CAC. */
    setupCoverage: number | null;
    cashCollectedCents: number;
    /** Cash collected ÷ spend. */
    cashRoas: number | null;
  };
  /** Meta leads that couldn't be split into Facebook / Instagram (counted in totals). */
  unattributedLeads: number;
  truncated: boolean;
  computedAt: string;
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

const div = (a: number, b: number): number | null => (b > 0 ? a / b : null);

type MetaNumbers = Omit<MetaPlatformInsights, "clicks">;

const ZERO_META: MetaNumbers = { spendCents: 0, impressions: 0, linkClicks: 0, landingPageViews: 0, metaLeads: 0 };

const cents = (v: number | null) => (v === null ? null : Math.round(v));

function row(
  key: PlatformRow["key"],
  label: string,
  m: MetaNumbers,
  leads: number,
  booked: number
): PlatformRow {
  const lpBasis = m.landingPageViews > 0 ? "landing_page_views" : m.linkClicks > 0 ? "link_clicks" : null;
  const lpDenominator = lpBasis === "landing_page_views" ? m.landingPageViews : m.linkClicks;
  return {
    key,
    label,
    spendCents: m.spendCents,
    leads,
    booked,
    cplCents: cents(div(m.spendCents, leads)),
    costPerBookedCents: cents(div(m.spendCents, booked)),
    bookedRate: div(booked, leads),
    metaLeads: m.metaLeads,
    impressions: m.impressions,
    linkClicks: m.linkClicks,
    landingPageViews: m.landingPageViews,
    cpcCents: cents(div(m.spendCents, m.linkClicks)),
    cpmCents: cents(div(m.spendCents * 1000, m.impressions)),
    ctr: div(m.linkClicks, m.impressions),
    lpConversion: lpBasis ? div(leads, lpDenominator) : null,
    lpBasis,
  };
}

/** New clients (start date in window) and the cash they paid in the window. */
async function businessInWindow(
  adminId: string,
  since: Date,
  until: Date
): Promise<{ newClients: number; cashCents: number }> {
  const { clients } = await getBookOfBusiness(adminId);
  const fresh = clients.filter((c) => {
    if (!c.startDate) return false;
    const t = new Date(c.startDate).getTime();
    return t >= since.getTime() && t <= until.getTime();
  });
  if (fresh.length === 0) return { newClients: 0, cashCents: 0 };

  const emails = new Set(fresh.map((c) => c.email.toLowerCase().trim()));
  const paid = await db
    .select({
      email: invoices.clientEmail,
      total: invoices.total,
      amountPaid: invoices.amountPaid,
      metadata: invoices.metadata,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.ownerId, adminId),
        isNotNull(invoices.paidAt),
        gte(invoices.paidAt, since),
        lte(invoices.paidAt, until),
        gt(invoices.amountPaid, 0)
      )
    );

  let cashCents = 0;
  for (const r of paid) {
    if (!emails.has((r.email || "").toLowerCase().trim())) continue;
    const total = r.total || 0;
    const amountPaid = r.amountPaid || 0;
    const ratio = total > 0 ? Math.min(amountPaid / total, 1) : 0;
    // Managed ad budget is pass-through, not cash earned (same split as book of business).
    cashCents += amountPaid - Math.round(adSpendOf(r.metadata, total) * ratio);
  }
  return { newClients: fresh.length, cashCents };
}

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
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  const { since, until } = windowFor(range);

  const base = {
    range,
    since: since.toISOString(),
    until: until.toISOString(),
  };

  const cacheWhere = and(
    eq(analyticsSnapshots.userId, userId),
    eq(analyticsSnapshots.source, SOURCE),
    sql`${analyticsSnapshots.data}->>'range' = ${range}`
  );

  if (!refresh) {
    try {
      const [cached] = await db
        .select({ data: analyticsSnapshots.data, createdAt: analyticsSnapshots.createdAt })
        .from(analyticsSnapshots)
        .where(cacheWhere)
        .orderBy(desc(analyticsSnapshots.createdAt))
        .limit(1);
      if (
        cached &&
        (cached.data as AdsOverviewData).configured &&
        Date.now() - new Date(cached.createdAt).getTime() < CACHE_TTL_MS
      ) {
        return NextResponse.json(cached.data);
      }
    } catch (err) {
      console.error("[ads-overview] cache read failed (continuing):", err);
    }
  }

  const meta = await getMetaInsights({ userId, rangeKey: range, since, until, refresh });
  if (!meta.configured) {
    return NextResponse.json({ ...base, configured: false });
  }

  // ── Leads from GHL ──
  const leadCounts: Record<MetaPlatformKey | "unknown", { leads: number; booked: number }> = {
    facebook: { leads: 0, booked: 0 },
    instagram: { leads: 0, booked: 0 },
    other: { leads: 0, booked: 0 },
    unknown: { leads: 0, booked: 0 },
  };
  let leadsError: string | null = null;
  let truncated = false;

  const [owner] = await db
    .select({ ghlLocationId: users.ghlLocationId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const locationId = owner?.ghlLocationId ?? null;

  if (!locationId) {
    leadsError = "GoHighLevel isn't connected for your account, so leads and booked calls can't be counted.";
  } else {
    try {
      const scan = await scanAdLeads({ ownerId: userId, locationId, since, until });
      truncated = scan.truncated;
      for (const c of scan.contacts) {
        if (!c.platform) continue;
        const bucket = leadCounts[c.platform];
        bucket.leads++;
        if (c.booked) bucket.booked++;
      }
    } catch (err) {
      console.error("[ads-overview] GHL lead scan failed:", err);
      leadsError = "Couldn't load leads from GoHighLevel right now.";
    }
  }

  // ── Business tiles ──
  let newClients = 0;
  let cashCents = 0;
  try {
    const adminId = (await getNexliAdminId()) ?? userId;
    ({ newClients, cashCents } = await businessInWindow(adminId, since, until));
  } catch (err) {
    console.error("[ads-overview] book of business failed:", err);
  }

  const insights = "platforms" in meta ? meta : null;
  const m = (k: MetaPlatformKey): MetaNumbers => insights?.platforms[k] ?? ZERO_META;
  const spend = (k: MetaPlatformKey) => m(k).spendCents;

  const platforms: PlatformRow[] = [
    row("facebook", "Facebook", m("facebook"), leadCounts.facebook.leads, leadCounts.facebook.booked),
    row("instagram", "Instagram", m("instagram"), leadCounts.instagram.leads, leadCounts.instagram.booked),
  ];
  if (spend("other") > 0 || leadCounts.other.leads > 0) {
    platforms.push(row("other", "Other Meta", m("other"), leadCounts.other.leads, leadCounts.other.booked));
  }

  const keys: MetaPlatformKey[] = ["facebook", "instagram", "other"];
  const sum = (f: keyof MetaNumbers) => keys.reduce((t, k) => t + m(k)[f], 0);
  const totalSpend = sum("spendCents");
  const totalLeads = Object.values(leadCounts).reduce((s, b) => s + b.leads, 0);
  const totalBooked = Object.values(leadCounts).reduce((s, b) => s + b.booked, 0);
  const totals = row(
    "total",
    "Total",
    {
      spendCents: totalSpend,
      impressions: sum("impressions"),
      linkClicks: sum("linkClicks"),
      landingPageViews: sum("landingPageViews"),
      metaLeads: sum("metaLeads"),
    },
    totalLeads,
    totalBooked
  );

  const cac = div(totalSpend, newClients);
  const data: AdsOverviewData = {
    ...base,
    configured: true,
    metaError: meta.error ?? null,
    currency: insights?.currency ?? null,
    leadsError,
    platforms,
    totals,
    business: {
      newClients,
      bookedCalls: totalBooked,
      closeRate: div(newClients, totalBooked),
      cacCents: cac === null ? null : Math.round(cac),
      setupCoverage: cac && cac > 0 ? DRS_PRICING.SETUP_FEE_CENTS / cac : null,
      cashCollectedCents: cashCents,
      cashRoas: div(cashCents, totalSpend),
    },
    unattributedLeads: leadCounts.unknown.leads,
    truncated,
    computedAt: new Date().toISOString(),
  };

  // Cache only complete results.
  if (!data.metaError && !data.leadsError) {
    try {
      await db.delete(analyticsSnapshots).where(cacheWhere);
      await db.insert(analyticsSnapshots).values({
        userId,
        source: SOURCE,
        periodStart: since,
        periodEnd: until,
        data,
      });
    } catch (err) {
      console.error("[ads-overview] cache write failed (continuing):", err);
    }
  }

  return NextResponse.json(data);
}
