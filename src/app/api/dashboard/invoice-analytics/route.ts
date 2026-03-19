import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { eq, sql, and, inArray, isNotNull } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = session.user.id;

  // Revenue stats
  const [collected] = await db
    .select({
      total: sql<number>`coalesce(sum(${invoices.amountPaid}), 0)`,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.ownerId, ownerId),
        inArray(invoices.status, ["paid", "partial"])
      )
    );

  const [outstanding] = await db
    .select({
      total: sql<number>`coalesce(sum(${invoices.balanceDue}), 0)`,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.ownerId, ownerId),
        inArray(invoices.status, ["sent", "viewed", "overdue", "partial"])
      )
    );

  const [overdueResult] = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(invoices)
    .where(
      and(eq(invoices.ownerId, ownerId), eq(invoices.status, "overdue"))
    );

  // Average days to pay (for paid invoices with sentAt and paidAt)
  const [avgDays] = await db
    .select({
      avg: sql<number>`coalesce(avg(extract(epoch from (${invoices.paidAt} - ${invoices.sentAt})) / 86400), 0)`,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.ownerId, ownerId),
        eq(invoices.status, "paid"),
        isNotNull(invoices.sentAt),
        isNotNull(invoices.paidAt)
      )
    );

  // MRR — sum of recurring invoice totals normalized to monthly
  const mrrRows = await db
    .select({
      total: sql<number>`coalesce(sum(${invoices.total}), 0)`,
      interval: invoices.recurringInterval,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.ownerId, ownerId),
        eq(invoices.isRecurring, true),
        inArray(invoices.status, ["paid", "partial", "sent", "viewed"])
      )
    )
    .groupBy(invoices.recurringInterval);

  let mrr = 0;
  for (const row of mrrRows) {
    const total = Number(row.total);
    switch (row.interval) {
      case "weekly": mrr += total * 4.33; break;
      case "biweekly": mrr += total * 2.17; break;
      case "monthly": mrr += total; break;
      case "quarterly": mrr += total / 3; break;
      case "yearly": mrr += total / 12; break;
      default: mrr += total; break; // treat unknown as monthly
    }
  }

  // Active subscriptions count
  const [activeSubs] = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.ownerId, ownerId),
        isNotNull(invoices.stripeSubscriptionId),
        sql`${invoices.subscriptionStatus} = 'active'`
      )
    );

  // Collections rate
  const collectedVal = Number(collected.total);
  const outstandingVal = Number(outstanding.total);
  const totalInvoiced = collectedVal + outstandingVal;
  const collectionsRate = totalInvoiced > 0 ? Math.round((collectedVal / totalInvoiced) * 100) : 0;

  // Monthly revenue chart — last 12 months
  const chartData = await db
    .select({
      month: sql<string>`to_char(${invoices.paidAt}, 'YYYY-MM')`,
      revenue: sql<number>`coalesce(sum(${invoices.amountPaid}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.ownerId, ownerId),
        isNotNull(invoices.paidAt),
        sql`${invoices.paidAt} >= now() - interval '12 months'`
      )
    )
    .groupBy(sql`to_char(${invoices.paidAt}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${invoices.paidAt}, 'YYYY-MM')`);

  // Status breakdown
  const statusBreakdown = await db
    .select({
      status: invoices.status,
      count: sql<number>`count(*)`,
    })
    .from(invoices)
    .where(eq(invoices.ownerId, ownerId))
    .groupBy(invoices.status);

  return NextResponse.json({
    stats: {
      totalCollected: Number(collected.total),
      totalOutstanding: Number(outstanding.total),
      overdueCount: Number(overdueResult.count),
      avgDaysToPay: Math.round(Number(avgDays.avg)),
      mrr: Math.round(mrr),
      collectionsRate,
      activeSubscriptions: Number(activeSubs.count),
    },
    chartData: chartData.map((d) => ({
      month: d.month,
      revenue: Number(d.revenue),
      count: Number(d.count),
    })),
    statusBreakdown: statusBreakdown.map((s) => ({
      status: s.status,
      count: Number(s.count),
    })),
  });
}
