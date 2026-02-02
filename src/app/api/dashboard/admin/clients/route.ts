import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { users, subscriptions, dailyStats, leadNotifications } from "@/db/schema";
import { eq, sql, and, gte, lt } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // All client users
  const clients = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      companyName: users.companyName,
      websiteUrl: users.websiteUrl,
      ghlLocationId: users.ghlLocationId,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.role, "client"));

  // Active subscriptions
  const activeSubs = await db
    .select({
      userId: subscriptions.userId,
      status: subscriptions.status,
    })
    .from(subscriptions)
    .where(eq(subscriptions.status, "active"));

  const activeSubMap = new Set(activeSubs.map((s) => s.userId));

  // Last 30 days page views per client
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const statsRows = await db
    .select({
      clientId: dailyStats.clientId,
      pageViews: sql<number>`coalesce(sum(${dailyStats.pageViewsCount}), 0)::int`,
      uniqueVisitors: sql<number>`coalesce(sum(${dailyStats.uniqueVisitorsCount}), 0)::int`,
    })
    .from(dailyStats)
    .where(
      and(gte(dailyStats.date, thirtyDaysAgo), lt(dailyStats.date, now))
    )
    .groupBy(dailyStats.clientId);

  const statsMap = new Map(
    statsRows.map((s) => [s.clientId, { pageViews: s.pageViews, uniqueVisitors: s.uniqueVisitors }])
  );

  // Totals across all clients
  const [totals] = await db
    .select({
      totalPageViews: sql<number>`coalesce(sum(${dailyStats.pageViewsCount}), 0)::int`,
      totalUniqueVisitors: sql<number>`coalesce(sum(${dailyStats.uniqueVisitorsCount}), 0)::int`,
    })
    .from(dailyStats)
    .where(
      and(gte(dailyStats.date, thirtyDaysAgo), lt(dailyStats.date, now))
    );

  // Total leads across all businesses (last 30 days)
  const [leadTotals] = await db
    .select({
      totalLeads: sql<number>`count(*)::int`,
      businessesWithLeads: sql<number>`count(distinct ${leadNotifications.userId})::int`,
    })
    .from(leadNotifications)
    .where(gte(leadNotifications.createdAt, thirtyDaysAgo));

  // Include admin's business in the count (+1)
  const totalBusinesses = clients.length + 1;
  const avgLeadsPerBusiness =
    totalBusinesses > 0
      ? Math.round((leadTotals.totalLeads / totalBusinesses) * 10) / 10
      : 0;

  const result = clients.map((c) => ({
    ...c,
    active: activeSubMap.has(c.id),
    pageViews30d: statsMap.get(c.id)?.pageViews || 0,
    uniqueVisitors30d: statsMap.get(c.id)?.uniqueVisitors || 0,
  }));

  return NextResponse.json({
    clients: result,
    totalClients: clients.length,
    activeSubscriptions: activeSubs.length,
    totalPageViews: totals.totalPageViews,
    totalUniqueVisitors: totals.totalUniqueVisitors,
    totalLeads: leadTotals.totalLeads,
    avgLeadsPerBusiness,
  });
}
