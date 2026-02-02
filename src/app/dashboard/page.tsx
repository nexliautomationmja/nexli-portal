import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { dailyStats } from "@/db/schema";
import { eq, and, gte, lt, sql } from "drizzle-orm";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const firstName = session.user.name?.split(" ")[0] || "there";
  const userId = session.user.id!;

  // Date ranges: current 7d and previous 7d
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const start = new Date(now);
  start.setDate(start.getDate() - 7);
  start.setHours(0, 0, 0, 0);

  const prevEnd = new Date(start);
  const prevStart = new Date(start);
  prevStart.setDate(prevStart.getDate() - 7);

  // Current period totals
  const [current] = await db
    .select({
      pageViews: sql<number>`coalesce(sum(${dailyStats.pageViewsCount}), 0)::int`,
      uniqueVisitors: sql<number>`coalesce(sum(${dailyStats.uniqueVisitorsCount}), 0)::int`,
    })
    .from(dailyStats)
    .where(
      and(
        eq(dailyStats.clientId, userId),
        gte(dailyStats.date, start),
        lt(dailyStats.date, end)
      )
    );

  // Previous period totals for deltas
  const [prev] = await db
    .select({
      pageViews: sql<number>`coalesce(sum(${dailyStats.pageViewsCount}), 0)::int`,
      uniqueVisitors: sql<number>`coalesce(sum(${dailyStats.uniqueVisitorsCount}), 0)::int`,
    })
    .from(dailyStats)
    .where(
      and(
        eq(dailyStats.clientId, userId),
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
    })
    .from(dailyStats)
    .where(
      and(
        eq(dailyStats.clientId, userId),
        gte(dailyStats.date, start),
        lt(dailyStats.date, end)
      )
    )
    .orderBy(dailyStats.date);

  const pvDelta = calcDelta(current.pageViews, prev.pageViews);
  const uvDelta = calcDelta(current.uniqueVisitors, prev.uniqueVisitors);

  const chartData = dailyData.map((d) => ({
    date: d.date.toISOString(),
    pageViews: d.pageViews,
    uniqueVisitors: d.uniqueVisitors,
  }));

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Compact greeting */}
      <div>
        <h1
          className="text-2xl md:text-3xl font-bold"
          style={{ color: "var(--text-main)" }}
        >
          Welcome back, {firstName}
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          Your website and automation overview.
        </p>
      </div>

      <DashboardClient
        pageViews={current.pageViews}
        uniqueVisitors={current.uniqueVisitors}
        pvDelta={pvDelta}
        uvDelta={uvDelta}
        chartData={chartData}
        isAdmin={session.user.role === "admin"}
      />
    </div>
  );
}

function calcDelta(current: number, previous: number) {
  if (previous === 0)
    return current > 0
      ? { value: "+100%", type: "positive" as const }
      : { value: "0%", type: "neutral" as const };
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct > 0) return { value: `+${pct}%`, type: "positive" as const };
  if (pct < 0) return { value: `${pct}%`, type: "negative" as const };
  return { value: "0%", type: "neutral" as const };
}
