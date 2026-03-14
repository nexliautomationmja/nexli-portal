import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { dailyStats, pageViews } from "@/db/schema";
import { eq, and, gte, lt, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const range = params.get("range") || "7d";
  const clientIdParam = params.get("clientId");

  // Admin can view any client; clients can only view their own
  let targetClientId = session.user.id;
  if (clientIdParam && session.user.role === "admin") {
    targetClientId = clientIdParam;
  }

  const now = new Date();
  const { start, end, prevStart, prevEnd } = getDateRange(range, now);

  // Current period
  const [currentStats] = await db
    .select({
      totalPageViews:
        sql<number>`coalesce(sum(${dailyStats.pageViewsCount}), 0)::int`,
      totalUniqueVisitors:
        sql<number>`coalesce(sum(${dailyStats.uniqueVisitorsCount}), 0)::int`,
    })
    .from(dailyStats)
    .where(
      and(
        eq(dailyStats.clientId, targetClientId),
        gte(dailyStats.date, start),
        lt(dailyStats.date, end)
      )
    );

  // Previous period for delta
  const [prevStats] = await db
    .select({
      totalPageViews:
        sql<number>`coalesce(sum(${dailyStats.pageViewsCount}), 0)::int`,
      totalUniqueVisitors:
        sql<number>`coalesce(sum(${dailyStats.uniqueVisitorsCount}), 0)::int`,
    })
    .from(dailyStats)
    .where(
      and(
        eq(dailyStats.clientId, targetClientId),
        gte(dailyStats.date, prevStart),
        lt(dailyStats.date, prevEnd)
      )
    );

  // Daily breakdown for chart
  const dailyData = await db
    .select({
      date: dailyStats.date,
      pageViews: dailyStats.pageViewsCount,
      uniqueVisitors: dailyStats.uniqueVisitorsCount,
      topPages: dailyStats.topPages,
      topReferrers: dailyStats.topReferrers,
    })
    .from(dailyStats)
    .where(
      and(
        eq(dailyStats.clientId, targetClientId),
        gte(dailyStats.date, start),
        lt(dailyStats.date, end)
      )
    )
    .orderBy(dailyStats.date);

  // Device breakdown from raw page_views
  const devices = await db
    .select({
      deviceType: pageViews.deviceType,
      count: sql<number>`count(*)::int`,
    })
    .from(pageViews)
    .where(
      and(
        eq(pageViews.clientId, targetClientId),
        gte(pageViews.createdAt, start),
        lt(pageViews.createdAt, end)
      )
    )
    .groupBy(pageViews.deviceType);

  // Aggregate top pages across all daily entries
  const topPages = aggregateJsonbField<{ url: string; count: number }>(
    dailyData.map((d) => d.topPages as { url: string; count: number }[] | null),
    "url",
    10
  );

  const topReferrers = aggregateJsonbField<{
    referrer: string;
    count: number;
  }>(
    dailyData.map(
      (d) => d.topReferrers as { referrer: string; count: number }[] | null
    ),
    "referrer",
    10
  );

  return NextResponse.json({
    pageViews: currentStats.totalPageViews,
    uniqueVisitors: currentStats.totalUniqueVisitors,
    pageViewsDelta: calcDelta(
      currentStats.totalPageViews,
      prevStats.totalPageViews
    ),
    uniqueVisitorsDelta: calcDelta(
      currentStats.totalUniqueVisitors,
      prevStats.totalUniqueVisitors
    ),
    dailyData: dailyData.map((d) => ({
      date: d.date,
      pageViews: d.pageViews,
      uniqueVisitors: d.uniqueVisitors,
    })),
    topPages,
    topReferrers,
    deviceBreakdown: devices,
  });
}

function getDateRange(range: string, now: Date) {
  const days = range === "30d" ? 30 : range === "90d" ? 90 : 7;
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  const prevEnd = new Date(start);
  const prevStart = new Date(start);
  prevStart.setDate(prevStart.getDate() - days);
  return { start, end, prevStart, prevEnd };
}

function calcDelta(current: number, previous: number) {
  if (previous === 0) return current > 0 ? { value: "+100%", type: "positive" as const } : { value: "0%", type: "neutral" as const };
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct > 0) return { value: `+${pct}%`, type: "positive" as const };
  if (pct < 0) return { value: `${pct}%`, type: "negative" as const };
  return { value: "0%", type: "neutral" as const };
}

function aggregateJsonbField<T extends Record<string, unknown>>(
  arrays: (T[] | null)[],
  keyField: string,
  limit: number
): T[] {
  const map = new Map<string, number>();
  for (const arr of arrays) {
    if (!arr) continue;
    for (const item of arr) {
      const key = String(item[keyField]);
      map.set(key, (map.get(key) || 0) + (item.count as number));
    }
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({ [keyField]: key, count }) as unknown as T);
}
