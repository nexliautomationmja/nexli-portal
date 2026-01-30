import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { dailyStats } from "@/db/schema";
import { eq, and, gte, lt, sql } from "drizzle-orm";
import { SectionBadge } from "@/components/ui/section-badge";
import { StatCard } from "@/components/ui/stat-card";
import { compactNumber } from "@/lib/format";
import { OverviewClient } from "./overview-client";

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
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <SectionBadge>Dashboard</SectionBadge>
        <h1
          className="text-3xl md:text-4xl font-bold mt-4"
          style={{ color: "var(--text-main)" }}
        >
          Welcome back, {firstName}
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
          Here&apos;s an overview of your website and automation performance.
        </p>
      </div>

      {/* Analytics Stat Cards (server-rendered) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Page Views"
          value={compactNumber(current.pageViews)}
          delta={pvDelta.value}
          deltaType={pvDelta.type}
        />
        <StatCard
          label="Unique Visitors"
          value={compactNumber(current.uniqueVisitors)}
          delta={uvDelta.value}
          deltaType={uvDelta.type}
        />
      </div>

      {/* Client-rendered: GHL stats + charts + leads */}
      <OverviewClient chartData={chartData} />
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
