import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { sql, gte, isNotNull, and, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const days = req.nextUrl.searchParams.get("days");
  const daysNum = days === "all" ? null : Number(days) || 30;

  // Base filter: only leads that came from ads (have utm_source)
  const dateFilter = daysNum
    ? and(
        isNotNull(leads.utmSource),
        gte(leads.createdAt, new Date(Date.now() - daysNum * 86400000))
      )
    : isNotNull(leads.utmSource);

  try {
    // Summary counts
    const summaryRows = await db
      .select({
        totalLeads: sql<number>`count(*)`,
        qualified: sql<number>`count(*) filter (where ${leads.leadScore} = 'qualified')`,
        raw: sql<number>`count(*) filter (where ${leads.leadScore} = 'raw')`,
        disqualified: sql<number>`count(*) filter (where ${leads.leadScore} = 'disqualified')`,
        bookedCalls: sql<number>`count(*) filter (where ${leads.bookedCallAt} is not null)`,
        showedCalls: sql<number>`count(*) filter (where ${leads.showedCallAt} is not null)`,
        opportunities: sql<number>`count(*) filter (where ${leads.opportunityAt} is not null)`,
        purchases: sql<number>`count(*) filter (where ${leads.purchasedAt} is not null)`,
      })
      .from(leads)
      .where(dateFilter);

    const summary = summaryRows[0] || {
      totalLeads: 0,
      qualified: 0,
      raw: 0,
      disqualified: 0,
      bookedCalls: 0,
      showedCalls: 0,
      opportunities: 0,
      purchases: 0,
    };

    // Campaign performance (group by utm_campaign)
    const campaigns = await db
      .select({
        campaign: leads.utmCampaign,
        total: sql<number>`count(*)`,
        qualified: sql<number>`count(*) filter (where ${leads.leadScore} = 'qualified')`,
        booked: sql<number>`count(*) filter (where ${leads.bookedCallAt} is not null)`,
        purchased: sql<number>`count(*) filter (where ${leads.purchasedAt} is not null)`,
      })
      .from(leads)
      .where(and(dateFilter, isNotNull(leads.utmCampaign)))
      .groupBy(leads.utmCampaign)
      .orderBy(sql`count(*) filter (where ${leads.leadScore} = 'qualified') desc`);

    // Creative performance (group by utm_content)
    const creatives = await db
      .select({
        creative: leads.utmContent,
        total: sql<number>`count(*)`,
        qualified: sql<number>`count(*) filter (where ${leads.leadScore} = 'qualified')`,
        booked: sql<number>`count(*) filter (where ${leads.bookedCallAt} is not null)`,
        purchased: sql<number>`count(*) filter (where ${leads.purchasedAt} is not null)`,
      })
      .from(leads)
      .where(and(dateFilter, isNotNull(leads.utmContent)))
      .groupBy(leads.utmContent)
      .orderBy(sql`count(*) filter (where ${leads.leadScore} = 'qualified') desc`);

    // Recent leads
    const recentLeads = await db
      .select({
        id: leads.id,
        firstName: leads.firstName,
        lastName: leads.lastName,
        email: leads.email,
        firmName: leads.firmName,
        leadScore: leads.leadScore,
        formSource: leads.formSource,
        utmCampaign: leads.utmCampaign,
        utmContent: leads.utmContent,
        utmSource: leads.utmSource,
        createdAt: leads.createdAt,
      })
      .from(leads)
      .where(dateFilter)
      .orderBy(desc(leads.createdAt))
      .limit(50);

    return NextResponse.json({
      summary,
      campaigns,
      creatives,
      recentLeads,
    });
  } catch (err) {
    console.error("[ad-analytics] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
