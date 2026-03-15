import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  invoices,
  engagements,
  engagementSigners,
  portalMessages,
  portalMagicLinks,
} from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = session.user.id;

  // 1. Get client info + invoice stats grouped by email
  const invoiceStats = await db
    .select({
      email: invoices.clientEmail,
      name: sql<string>`MAX(${invoices.clientName})`,
      phone: sql<string | null>`MAX(${invoices.clientPhone})`,
      company: sql<string | null>`MAX(${invoices.clientCompany})`,
      invoiceCount: sql<number>`COUNT(*)::int`,
      totalInvoiced: sql<number>`COALESCE(SUM(${invoices.total}), 0)::int`,
      totalPaid: sql<number>`COALESCE(SUM(${invoices.amountPaid}), 0)::int`,
      totalOutstanding: sql<number>`COALESCE(SUM(${invoices.balanceDue}), 0)::int`,
      lastInvoiceAt: sql<string>`MAX(${invoices.createdAt})`,
      earliestInvoice: sql<string>`MIN(${invoices.createdAt})`,
      lastPaymentAt: sql<string | null>`MAX(${invoices.paidAt})`,
    })
    .from(invoices)
    .where(eq(invoices.ownerId, ownerId))
    .groupBy(invoices.clientEmail);

  // 2. Get engagement stats by signer email
  const engagementStats = await db
    .select({
      email: engagementSigners.email,
      name: sql<string>`MAX(${engagementSigners.name})`,
      engagementCount: sql<number>`COUNT(DISTINCT ${engagementSigners.engagementId})::int`,
      pendingEngagements: sql<number>`COUNT(*) FILTER (WHERE ${engagementSigners.status} IN ('sent', 'viewed'))::int`,
      lastEngagementAt: sql<string>`MAX(${engagementSigners.createdAt})`,
    })
    .from(engagementSigners)
    .innerJoin(engagements, eq(engagementSigners.engagementId, engagements.id))
    .where(
      and(
        eq(engagements.ownerId, ownerId),
        sql`${engagementSigners.order} > 0` // exclude CPA signer (order 0)
      )
    )
    .groupBy(engagementSigners.email);

  // 3. Get unread message counts by client email
  const messageCounts = await db
    .select({
      email: portalMessages.clientEmail,
      unreadCount: sql<number>`COUNT(*) FILTER (WHERE ${portalMessages.senderType} = 'client' AND ${portalMessages.read} = false)::int`,
      lastMessageAt: sql<string>`MAX(${portalMessages.createdAt})`,
    })
    .from(portalMessages)
    .where(eq(portalMessages.ownerId, ownerId))
    .groupBy(portalMessages.clientEmail);

  // 4. Get portal access info (last used magic link per email)
  const portalAccess = await db
    .select({
      email: portalMagicLinks.email,
      lastLogin: sql<string | null>`MAX(${portalMagicLinks.usedAt})`,
      hasAccess: sql<boolean>`BOOL_OR(${portalMagicLinks.usedAt} IS NOT NULL)`,
    })
    .from(portalMagicLinks)
    .groupBy(portalMagicLinks.email);

  // Build lookup maps
  const invoiceMap = new Map(invoiceStats.map((r) => [r.email, r]));
  const engagementMap = new Map(engagementStats.map((r) => [r.email, r]));
  const messageMap = new Map(messageCounts.map((r) => [r.email, r]));
  const portalMap = new Map(portalAccess.map((r) => [r.email, r]));

  // Collect all unique client emails
  const allEmails = new Set<string>();
  invoiceStats.forEach((r) => allEmails.add(r.email));
  engagementStats.forEach((r) => allEmails.add(r.email));
  messageCounts.forEach((r) => allEmails.add(r.email));

  // Build unified client list
  const clients = Array.from(allEmails).map((email) => {
    const inv = invoiceMap.get(email);
    const eng = engagementMap.get(email);
    const msg = messageMap.get(email);
    const portal = portalMap.get(email);

    // Determine most recent activity
    const dates = [
      inv?.lastInvoiceAt,
      inv?.lastPaymentAt,
      eng?.lastEngagementAt,
      msg?.lastMessageAt,
    ].filter(Boolean) as string[];
    const lastActivityAt = dates.length > 0
      ? dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
      : null;

    // Earliest record date
    const createdDates = [
      inv?.earliestInvoice,
      eng?.lastEngagementAt,
    ].filter(Boolean) as string[];
    const createdAt = createdDates.length > 0
      ? createdDates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0]
      : null;

    return {
      email,
      name: inv?.name || eng?.name || email.split("@")[0],
      phone: inv?.phone || null,
      company: inv?.company || null,
      invoiceCount: inv?.invoiceCount || 0,
      totalInvoiced: inv?.totalInvoiced || 0,
      totalPaid: inv?.totalPaid || 0,
      totalOutstanding: inv?.totalOutstanding || 0,
      engagementCount: eng?.engagementCount || 0,
      pendingEngagements: eng?.pendingEngagements || 0,
      unreadMessages: msg?.unreadCount || 0,
      hasPortalAccess: portal?.hasAccess || false,
      lastPortalLogin: portal?.lastLogin || null,
      lastActivityAt,
      createdAt,
    };
  });

  // Sort by last activity (most recent first)
  clients.sort((a, b) => {
    if (!a.lastActivityAt && !b.lastActivityAt) return 0;
    if (!a.lastActivityAt) return 1;
    if (!b.lastActivityAt) return -1;
    return new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime();
  });

  return NextResponse.json({ clients });
}
