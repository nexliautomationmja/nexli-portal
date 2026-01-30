import { db } from "@/db";
import { pageViews, dailyStats } from "@/db/schema";
import { sql, eq, and, gte, lt, isNotNull } from "drizzle-orm";

export async function aggregateDailyStats(targetDate?: Date) {
  const date = new Date(targetDate || new Date());
  date.setHours(0, 0, 0, 0);
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);

  // Get all clients with page views for this date
  const clientViews = await db
    .select({ clientId: pageViews.clientId })
    .from(pageViews)
    .where(
      and(gte(pageViews.createdAt, date), lt(pageViews.createdAt, nextDay))
    )
    .groupBy(pageViews.clientId);

  for (const { clientId } of clientViews) {
    const dateFilter = and(
      eq(pageViews.clientId, clientId),
      gte(pageViews.createdAt, date),
      lt(pageViews.createdAt, nextDay)
    );

    // Count page views
    const [pvCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(pageViews)
      .where(dateFilter);

    // Count unique visitors (distinct sessionId)
    const [uvCount] = await db
      .select({
        count: sql<number>`count(distinct ${pageViews.sessionId})::int`,
      })
      .from(pageViews)
      .where(dateFilter);

    // Top pages
    const topPagesResult = await db
      .select({
        url: pageViews.pageUrl,
        count: sql<number>`count(*)::int`,
      })
      .from(pageViews)
      .where(dateFilter)
      .groupBy(pageViews.pageUrl)
      .orderBy(sql`count(*) desc`)
      .limit(10);

    // Top referrers
    const topReferrersResult = await db
      .select({
        referrer: pageViews.referrer,
        count: sql<number>`count(*)::int`,
      })
      .from(pageViews)
      .where(and(dateFilter, isNotNull(pageViews.referrer)))
      .groupBy(pageViews.referrer)
      .orderBy(sql`count(*) desc`)
      .limit(10);

    // Upsert daily_stats
    await db
      .insert(dailyStats)
      .values({
        clientId,
        date,
        pageViewsCount: pvCount.count,
        uniqueVisitorsCount: uvCount.count,
        topPages: topPagesResult,
        topReferrers: topReferrersResult,
      })
      .onConflictDoUpdate({
        target: [dailyStats.clientId, dailyStats.date],
        set: {
          pageViewsCount: pvCount.count,
          uniqueVisitorsCount: uvCount.count,
          topPages: topPagesResult,
          topReferrers: topReferrersResult,
        },
      });
  }
}
