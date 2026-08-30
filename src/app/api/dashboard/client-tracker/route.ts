import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { invoices, engagements, engagementSigners } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

/**
 * Client Tracker — internal book of business, built entirely from Marcel's
 * own signed engagements + paid invoices (no GoHighLevel). A person becomes a
 * "client" once they have a signed engagement AND at least one paid invoice.
 * Reports deals closed (signed engagements), revenue to date (paid), MRR
 * (from active recurring invoices), and outstanding balance.
 */

// Monthly-equivalent revenue for a recurring invoice, in cents.
function monthlyEquivalent(total: number, interval: string | null): number {
  switch (interval) {
    case "weekly":
      return Math.round((total * 52) / 12);
    case "biweekly":
      return Math.round((total * 26) / 12);
    case "monthly":
      return total;
    case "quarterly":
      return Math.round(total / 3);
    case "yearly":
      return Math.round(total / 12);
    default:
      return 0;
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerId = session.user.id;

  // 1. Signed engagements (deals closed) by client email, with the plan from
  //    the most recently signed engagement.
  const signedRows = await db
    .select({
      email: engagementSigners.email,
      name: sql<string>`MAX(${engagementSigners.name})`,
      dealsCount: sql<number>`COUNT(DISTINCT ${engagementSigners.engagementId})::int`,
      firstSignedAt: sql<string | null>`MIN(${engagementSigners.signedAt})`,
      latestPlan: sql<
        string | null
      >`(ARRAY_AGG(${engagements.metadata}->>'billingPlan' ORDER BY ${engagementSigners.signedAt} DESC NULLS LAST))[1]`,
    })
    .from(engagementSigners)
    .innerJoin(engagements, eq(engagementSigners.engagementId, engagements.id))
    .where(
      and(
        eq(engagements.ownerId, ownerId),
        sql`${engagementSigners.order} > 0`, // exclude the sender (order 0)
        eq(engagementSigners.status, "signed")
      )
    )
    .groupBy(engagementSigners.email);

  // 2. Invoice rollup (paid / outstanding) by client email.
  const invoiceAgg = await db
    .select({
      email: invoices.clientEmail,
      name: sql<string>`MAX(${invoices.clientName})`,
      company: sql<string | null>`MAX(${invoices.clientCompany})`,
      totalPaid: sql<number>`COALESCE(SUM(${invoices.amountPaid}), 0)::int`,
      totalOutstanding: sql<number>`COALESCE(SUM(${invoices.balanceDue}), 0)::int`,
      invoiceCount: sql<number>`COUNT(*)::int`,
      lastPaymentAt: sql<string | null>`MAX(${invoices.paidAt})`,
    })
    .from(invoices)
    .where(eq(invoices.ownerId, ownerId))
    .groupBy(invoices.clientEmail);

  // 3. Recurring invoices for MRR (monthly-equivalent of active subscriptions).
  const recurringRows = await db
    .select({
      email: invoices.clientEmail,
      total: invoices.total,
      interval: invoices.recurringInterval,
      status: invoices.status,
      recurringEndDate: invoices.recurringEndDate,
    })
    .from(invoices)
    .where(and(eq(invoices.ownerId, ownerId), eq(invoices.isRecurring, true)));

  const invoiceMap = new Map(invoiceAgg.map((r) => [r.email, r]));

  const now = Date.now();
  const mrrMap = new Map<string, number>();
  for (const r of recurringRows) {
    if (r.status === "canceled" || r.status === "void" || r.status === "draft") continue;
    // Skip subscriptions that have already ended.
    if (r.recurringEndDate && new Date(r.recurringEndDate).getTime() < now) continue;
    mrrMap.set(
      r.email,
      (mrrMap.get(r.email) || 0) + monthlyEquivalent(r.total, r.interval)
    );
  }

  // A client = has a signed engagement AND at least one paid invoice.
  const clients = signedRows
    .map((sg) => {
      const inv = invoiceMap.get(sg.email);
      const totalPaid = inv?.totalPaid || 0;
      const mrr = mrrMap.get(sg.email) || 0;
      return {
        email: sg.email,
        name: inv?.name || sg.name || sg.email.split("@")[0],
        company: inv?.company || null,
        billingPlan: (sg.latestPlan as "monthly" | "annual" | null) || null,
        signedAt: sg.firstSignedAt,
        dealsCount: sg.dealsCount,
        revenue: totalPaid,
        mrr,
        outstanding: inv?.totalOutstanding || 0,
        lastPaymentAt: inv?.lastPaymentAt || null,
        status: mrr > 0 ? "active" : "signed",
      };
    })
    .filter((c) => c.revenue > 0);

  clients.sort((a, b) => b.revenue - a.revenue);

  const kpis = {
    totalClients: clients.length,
    totalDeals: clients.reduce((s, c) => s + c.dealsCount, 0),
    totalRevenue: clients.reduce((s, c) => s + c.revenue, 0),
    totalMrr: clients.reduce((s, c) => s + c.mrr, 0),
    totalOutstanding: clients.reduce((s, c) => s + c.outstanding, 0),
  };

  return NextResponse.json({ kpis, clients });
}
