import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  users,
  invoices,
  engagements,
  engagementSigners,
  leadNotifications,
  dailyStats,
  pageViews,
  portalSessions,
} from "@/db/schema";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getBookOfBusiness } from "@/lib/book-of-business";

/**
 * Drill-down into a connected client's dashboard: THEIR book of business
 * (revenue they collect from their own clients), their leads, their website
 * traffic, and a merged recent-activity feed. Admin only — this reads
 * another tenant's data.
 */

interface ActivityItem {
  at: string;
  type: "payment" | "invoice" | "engagement" | "lead" | "portal_login";
  message: string;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { clientId } = await params;

  const [client] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      companyName: users.companyName,
      websiteUrl: users.websiteUrl,
      lastLoginAt: users.lastLoginAt,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, clientId))
    .limit(1);
  if (!client || client.role !== "client") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [book, collectedRow, myBook, recentLeads, leadCountRow, trafficRows, recentLogins] =
    await Promise.all([
      // Their book of business (signed-and-paid clients)
      getBookOfBusiness(client.id),
      // Raw total collected — same definition as the tracker's "Their revenue"
      // column, so the two screens always agree.
      db
        .select({ total: sql<number>`COALESCE(SUM(${invoices.amountPaid}), 0)::int` })
        .from(invoices)
        .where(eq(invoices.ownerId, client.id)),
      // What they pay us (our book, filtered to their email below)
      getBookOfBusiness(session.user.id),
      // Their recent leads
      db
        .select({
          leadName: leadNotifications.leadName,
          leadEmail: leadNotifications.leadEmail,
          source: leadNotifications.source,
          createdAt: leadNotifications.createdAt,
        })
        .from(leadNotifications)
        .where(eq(leadNotifications.userId, client.id))
        .orderBy(desc(leadNotifications.createdAt))
        .limit(10),
      db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(leadNotifications)
        .where(
          and(
            eq(leadNotifications.userId, client.id),
            gte(leadNotifications.createdAt, since30d)
          )
        ),
      // Their website traffic, last 30 days
      db
        .select({
          date: dailyStats.date,
          pageViews: dailyStats.pageViewsCount,
          uniqueVisitors: dailyStats.uniqueVisitorsCount,
        })
        .from(dailyStats)
        .where(and(eq(dailyStats.clientId, client.id), gte(dailyStats.date, since30d)))
        .orderBy(dailyStats.date),
      // Their clients logging into their portal
      db
        .select({
          email: portalSessions.email,
          clientName: portalSessions.clientName,
          createdAt: portalSessions.createdAt,
        })
        .from(portalSessions)
        .where(eq(portalSessions.ownerId, client.id))
        .orderBy(desc(portalSessions.createdAt))
        .limit(10),
    ]);

  // Activity feed sources from their tenant
  const [recentInvoices, recentSigned] = await Promise.all([
    db
      .select({
        clientName: invoices.clientName,
        total: invoices.total,
        amountPaid: invoices.amountPaid,
        status: invoices.status,
        paidAt: invoices.paidAt,
        createdAt: invoices.createdAt,
      })
      .from(invoices)
      .where(eq(invoices.ownerId, client.id))
      .orderBy(desc(invoices.createdAt))
      .limit(15),
    db
      .select({
        name: engagementSigners.name,
        signedAt: engagementSigners.signedAt,
        subject: engagements.subject,
      })
      .from(engagementSigners)
      .innerJoin(engagements, eq(engagementSigners.engagementId, engagements.id))
      .where(
        and(
          eq(engagements.ownerId, client.id),
          sql`${engagementSigners.order} > 0`,
          eq(engagementSigners.status, "signed")
        )
      )
      .orderBy(desc(engagementSigners.signedAt))
      .limit(10),
  ]);

  const money = (cents: number) =>
    `$${Math.round(cents / 100).toLocaleString("en-US")}`;

  const activity: ActivityItem[] = [];
  for (const inv of recentInvoices) {
    if (inv.paidAt) {
      activity.push({
        at: new Date(inv.paidAt).toISOString(),
        type: "payment",
        message: `${inv.clientName} paid ${money(inv.amountPaid || inv.total)}`,
      });
    } else {
      activity.push({
        at: new Date(inv.createdAt).toISOString(),
        type: "invoice",
        message: `Invoice for ${money(inv.total)} sent to ${inv.clientName} (${inv.status})`,
      });
    }
  }
  for (const s of recentSigned) {
    if (!s.signedAt) continue;
    activity.push({
      at: new Date(s.signedAt).toISOString(),
      type: "engagement",
      message: `${s.name} signed "${s.subject}"`,
    });
  }
  for (const l of recentLeads) {
    activity.push({
      at: new Date(l.createdAt).toISOString(),
      type: "lead",
      message: `New lead: ${l.leadName || l.leadEmail || "Unknown"}${l.source ? ` via ${l.source}` : ""}`,
    });
  }
  for (const p of recentLogins) {
    activity.push({
      at: new Date(p.createdAt).toISOString(),
      type: "portal_login",
      message: `${p.clientName || p.email} logged into their client portal`,
    });
  }
  activity.sort((a, b) => b.at.localeCompare(a.at));

  // dailyStats is rolled up by the nightly cron, so today's row is stale (or
  // missing) all day. Count today's raw page views live and use them when
  // they beat the aggregated row, so a freshly installed snippet shows up
  // immediately instead of after midnight.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const [liveToday] = await db
    .select({
      views: sql<number>`COUNT(*)::int`,
      uniques: sql<number>`COUNT(DISTINCT ${pageViews.sessionId})::int`,
    })
    .from(pageViews)
    .where(
      and(eq(pageViews.clientId, client.id), gte(pageViews.createdAt, startOfToday))
    );

  const daily = trafficRows.map((r) => ({
    date: new Date(r.date).toISOString(),
    pageViews: r.pageViews,
    uniqueVisitors: r.uniqueVisitors,
  }));
  if (liveToday && liveToday.views > 0) {
    const todayIdx = daily.findIndex(
      (d) => new Date(d.date).getTime() >= startOfToday.getTime()
    );
    if (todayIdx === -1) {
      daily.push({
        date: startOfToday.toISOString(),
        pageViews: liveToday.views,
        uniqueVisitors: liveToday.uniques,
      });
    } else {
      // Take the larger of live vs aggregated per metric — the cron row for
      // today is stale, but never report fewer than it already shows.
      daily[todayIdx] = {
        date: daily[todayIdx].date,
        pageViews: Math.max(liveToday.views, daily[todayIdx].pageViews),
        uniqueVisitors: Math.max(liveToday.uniques, daily[todayIdx].uniqueVisitors),
      };
    }
  }

  const clientEmailLc = client.email.toLowerCase();
  const myRow =
    myBook.clients.find((c) => c.email.toLowerCase() === clientEmailLc) || null;

  return NextResponse.json({
    client: {
      id: client.id,
      email: client.email,
      name: client.name,
      company: client.companyName,
      websiteUrl: client.websiteUrl,
      lastLoginAt: client.lastLoginAt,
    },
    theirBook: {
      kpis: { ...book.kpis, totalRevenue: collectedRow[0]?.total || 0 },
      topClients: book.clients.slice(0, 8),
    },
    leads30d: leadCountRow[0]?.count || 0,
    traffic: {
      pageViews30d: daily.reduce((s, r) => s + r.pageViews, 0),
      uniqueVisitors30d: daily.reduce((s, r) => s + r.uniqueVisitors, 0),
      daily,
    },
    youCollect: myRow
      ? { revenue: myRow.revenue, mrr: myRow.mrr, outstanding: myRow.outstanding }
      : null,
    activity: activity.slice(0, 20),
  });
}

// PATCH — client setup: website URL and/or a new portal password. Admin only.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { clientId } = await params;

  const [target] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, clientId))
    .limit(1);
  if (!target || target.role !== "client") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const updates: { websiteUrl?: string | null; hashedPassword?: string } = {};

  if ("websiteUrl" in body) {
    if (body.websiteUrl === null || body.websiteUrl === "") {
      updates.websiteUrl = null;
    } else if (typeof body.websiteUrl === "string") {
      let url = body.websiteUrl.trim().slice(0, 500);
      if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
      updates.websiteUrl = url;
    } else {
      return NextResponse.json({ error: "Invalid website URL." }, { status: 400 });
    }
  }

  if ("newPassword" in body) {
    const pw = body.newPassword;
    if (typeof pw !== "string" || pw.length < 8 || pw.length > 200) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }
    updates.hashedPassword = await bcrypt.hash(pw, 12);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const [updated] = await db
    .update(users)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(users.id, clientId))
    .returning({ websiteUrl: users.websiteUrl });

  return NextResponse.json({ ok: true, websiteUrl: updated.websiteUrl });
}
