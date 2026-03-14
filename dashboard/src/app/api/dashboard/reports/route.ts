import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { dailyStats } from "@/db/schema";
import { eq, and, gte, lt, sql } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get last 12 months of aggregated data
  const now = new Date();
  const months: {
    label: string;
    pageViews: number;
    uniqueVisitors: number;
    start: string;
    end: string;
  }[] = [];

  for (let i = 0; i < 12; i++) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

    const [stats] = await db
      .select({
        pageViews: sql<number>`coalesce(sum(${dailyStats.pageViewsCount}), 0)::int`,
        uniqueVisitors: sql<number>`coalesce(sum(${dailyStats.uniqueVisitorsCount}), 0)::int`,
      })
      .from(dailyStats)
      .where(
        and(
          eq(dailyStats.clientId, session.user.id),
          gte(dailyStats.date, monthStart),
          lt(dailyStats.date, monthEnd)
        )
      );

    months.push({
      label: monthStart.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
      pageViews: stats.pageViews,
      uniqueVisitors: stats.uniqueVisitors,
      start: monthStart.toISOString(),
      end: monthEnd.toISOString(),
    });
  }

  return NextResponse.json({ months });
}
