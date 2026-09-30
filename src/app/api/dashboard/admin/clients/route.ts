import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { users, dailyStats, leadNotifications, firmSites } from "@/db/schema";
import { eq, sql, and, gte, lt } from "drizzle-orm";
import { provisionFirm, type ProvisionInput } from "@/lib/provision-firm";

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
      phone: users.phone,
      tier: users.tier,
      subscriptionStatus: users.subscriptionStatus,
      subscriptionCurrentPeriodEnd: users.subscriptionCurrentPeriodEnd,
      provisionedAt: users.provisionedAt,
      foundationAgreementEngagementId: users.foundationAgreementEngagementId,
      foundationAgreementSentAt: users.foundationAgreementSentAt,
      welcomeEmailSentAt: users.welcomeEmailSentAt,
      siteStatus: firmSites.status,
      siteSlug: firmSites.slug,
      siteDomain: firmSites.domain,
      siteGeneratedBy: firmSites.generatedBy,
    })
    .from(users)
    .leftJoin(firmSites, eq(firmSites.ownerUserId, users.id))
    .where(eq(users.role, "client"));

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

  const result = clients.map(
    ({ siteStatus, siteSlug, siteDomain, siteGeneratedBy, ...c }) => ({
    ...c,
    site:
      siteStatus && siteSlug
        ? {
            status: siteStatus,
            slug: siteSlug,
            domain: siteDomain ?? null,
            generatedBy: siteGeneratedBy ?? null,
          }
        : null,
    active: true,
    pageViews30d: statsMap.get(c.id)?.pageViews || 0,
    uniqueVisitors30d: statsMap.get(c.id)?.uniqueVisitors || 0,
  }));

  return NextResponse.json({
    clients: result,
    totalClients: clients.length,
    totalPageViews: totals.totalPageViews,
    totalUniqueVisitors: totals.totalUniqueVisitors,
    totalLeads: leadTotals.totalLeads,
    avgLeadsPerBusiness,
  });
}

// ── POST: admin "Create firm" ─────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t : undefined;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = str(body.email);
  const firmName = str(body.firmName);
  const tier = body.tier === "drs" ? "drs" : body.tier === "foundation" ? "foundation" : null;

  const details: string[] = [];
  if (!email) details.push("email is required");
  else if (!EMAIL_RE.test(email)) details.push("email is invalid");
  if (!firmName) details.push("firmName is required");
  if (!tier) details.push("tier must be 'drs' or 'foundation'");
  if (details.length > 0) {
    return NextResponse.json(
      { error: "Validation failed", details },
      { status: 400 }
    );
  }

  const input: ProvisionInput = {
    email: email!,
    firstName: str(body.firstName),
    lastName: str(body.lastName),
    firmName: firmName!,
    phone: str(body.phone),
    websiteUrl: str(body.websiteUrl),
    bookingUrl: str(body.bookingUrl),
    tier: tier!,
    stripeCustomerId: str(body.stripeCustomerId),
    stripeSubscriptionId: str(body.stripeSubscriptionId),
    subscriptionStatus: str(body.subscriptionStatus),
    sendAgreement:
      typeof body.sendAgreement === "boolean" ? body.sendAgreement : true,
    sendWelcome: typeof body.sendWelcome === "boolean" ? body.sendWelcome : true,
    source: "admin",
  };

  try {
    const result = await provisionFirm(input);
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (err) {
    console.error("[admin/clients POST] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Provisioning failed" },
      { status: 500 }
    );
  }
}
