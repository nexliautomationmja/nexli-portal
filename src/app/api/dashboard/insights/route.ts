import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { users, analyticsSnapshots, dailyStats, pageViews } from "@/db/schema";
import { eq, and, desc, gte, lt, sql } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import {
  getContacts,
  getAllCalendarEvents,
  searchConversations,
  getPipelines,
  getOpportunities,
} from "@/lib/ghl-client";
import {
  computeConversionFunnel,
  computeSpeedToLead,
} from "@/lib/ghl-computations";
import { describeTrend } from "@/lib/describe-trend";
import type { AIInsightsData } from "@/lib/types/ai-insights";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_SOURCE = "ai-insights";

function getDateRange(range: string) {
  const days = range === "30d" ? 30 : range === "90d" ? 90 : 7;
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

function emptyInsights(range: string): AIInsightsData {
  return {
    strengths: [],
    issues: [],
    actionPlan: [],
    generatedAt: new Date().toISOString(),
    range,
  };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const clientIdParam = params.get("clientId");
  const range = params.get("range") || "7d";
  const force = params.get("force") === "true";

  let targetUserId = session.user.id;
  if (clientIdParam && session.user.role === "admin") {
    targetUserId = clientIdParam;
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  if (!user) {
    return NextResponse.json(emptyInsights(range));
  }

  // Check cache
  const [cached] = await db
    .select()
    .from(analyticsSnapshots)
    .where(
      and(
        eq(analyticsSnapshots.userId, targetUserId),
        eq(analyticsSnapshots.source, CACHE_SOURCE)
      )
    )
    .orderBy(desc(analyticsSnapshots.createdAt))
    .limit(1);

  if (
    !force &&
    cached &&
    Date.now() - new Date(cached.createdAt).getTime() < CACHE_TTL_MS
  ) {
    const cachedData = cached.data as AIInsightsData;
    if (cachedData.range === range) {
      return NextResponse.json(cachedData);
    }
  }

  const { start, end } = getDateRange(range);
  const rangeLabel = range === "30d" ? "30 days" : range === "90d" ? "90 days" : "7 days";

  try {
    // ── Collect Analytics Data ──
    const [currentStats] = await db
      .select({
        totalPageViews: sql<number>`coalesce(sum(${dailyStats.pageViewsCount}), 0)::int`,
        totalUniqueVisitors: sql<number>`coalesce(sum(${dailyStats.uniqueVisitorsCount}), 0)::int`,
      })
      .from(dailyStats)
      .where(
        and(
          eq(dailyStats.clientId, targetUserId),
          gte(dailyStats.date, start),
          lt(dailyStats.date, end)
        )
      );

    const dailyData = await db
      .select({
        date: dailyStats.date,
        pageViews: dailyStats.pageViewsCount,
        uniqueVisitors: dailyStats.uniqueVisitorsCount,
        topPages: dailyStats.topPages,
      })
      .from(dailyStats)
      .where(
        and(
          eq(dailyStats.clientId, targetUserId),
          gte(dailyStats.date, start),
          lt(dailyStats.date, end)
        )
      )
      .orderBy(dailyStats.date);

    const devices = await db
      .select({
        deviceType: pageViews.deviceType,
        count: sql<number>`count(*)::int`,
      })
      .from(pageViews)
      .where(
        and(
          eq(pageViews.clientId, targetUserId),
          gte(pageViews.createdAt, start),
          lt(pageViews.createdAt, end)
        )
      )
      .groupBy(pageViews.deviceType);

    // Aggregate top pages
    const pageMap = new Map<string, number>();
    for (const d of dailyData) {
      const pages = d.topPages as { url: string; count: number }[] | null;
      if (!pages) continue;
      for (const p of pages) {
        pageMap.set(p.url, (pageMap.get(p.url) || 0) + p.count);
      }
    }
    const topPages = Array.from(pageMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([url, count]) => ({ url, count }));

    const chartData = dailyData.map((d) => ({
      date: String(d.date),
      pageViews: d.pageViews,
      uniqueVisitors: d.uniqueVisitors,
    }));

    const trend = describeTrend(chartData);

    // ── Collect GHL Data ──
    let conversionBlock = "No GHL data connected";
    let speedBlock = "No GHL data connected";
    let pipelineBlock = "No pipeline data";

    if (user.ghlLocationId) {
      try {
        const [contactsRes, calendarEvents, conversationsRes] = await Promise.all([
          getContacts(user.ghlLocationId, 100),
          getAllCalendarEvents(user.ghlLocationId, start.toISOString(), end.toISOString()),
          searchConversations(user.ghlLocationId, 100),
        ]);

        const periodContacts = (contactsRes.contacts ?? []).filter((c) => {
          const d = new Date(c.dateAdded);
          return d >= start && d <= end;
        });

        const conversion = computeConversionFunnel(
          periodContacts,
          calendarEvents,
          conversationsRes.conversations ?? []
        );

        const speedToLead = await computeSpeedToLead(
          periodContacts,
          conversationsRes.conversations ?? []
        );

        conversionBlock = `- Total New Leads: ${conversion.totalLeads}
- Responded Leads: ${conversion.respondedLeads}
- Booked Consultations: ${conversion.bookedConsultations}
- Lead-to-Consultation Rate: ${conversion.conversionRate}% (benchmark: 30-50%)`;

        speedBlock = `- Average Response Time: ${speedToLead.averageResponseMinutes} minutes
- Median Response Time: ${speedToLead.medianResponseMinutes} minutes
- Under 5 min: ${speedToLead.distribution.under5min}, 5-30 min: ${speedToLead.distribution.from5to30min}, Over 30 min: ${speedToLead.distribution.over30min}
- Performance Rating: ${speedToLead.performanceRating}
- AI Responses: ${speedToLead.aiResponses}, Human Responses: ${speedToLead.humanResponses}`;

        // Pipeline data
        try {
          const pipelines = await getPipelines(user.ghlLocationId);
          let totalValue = 0;
          let pipelineCount = 0;
          for (const p of pipelines.pipelines ?? []) {
            pipelineCount++;
            try {
              const opps = await getOpportunities(p.id);
              for (const o of opps.opportunities ?? []) {
                totalValue += o.monetaryValue ?? 0;
              }
            } catch { /* skip */ }
          }
          pipelineBlock = `- Total Pipeline Value: $${totalValue.toLocaleString()}
- Number of Pipelines: ${pipelineCount}`;
        } catch { /* skip */ }
      } catch { /* GHL fetch failed, use defaults */ }
    }

    // ── Build Prompt ──
    const systemPrompt = `You are a senior digital marketing strategist analyzing a small business client's website and lead management performance. Provide actionable, specific insights. Return your analysis as a JSON object with exactly this structure:
{
  "strengths": [{ "title": "...", "detail": "..." }],
  "issues": [{ "title": "...", "detail": "..." }],
  "actionPlan": [{ "title": "...", "detail": "..." }]
}
Rules:
- Provide 2-4 items per section
- Titles should be concise (under 8 words)
- Details should be 1-2 sentences, specific and actionable
- Reference actual numbers from the data
- For actionPlan, order by expected impact (highest first)
- If a metric is zero or missing, note what needs to be set up
- Return ONLY valid JSON, no markdown or extra text`;

    const userMessage = `Analyze this client's performance for the last ${rangeLabel}:

WEBSITE ANALYTICS:
- Page Views: ${currentStats.totalPageViews}
- Unique Visitors: ${currentStats.totalUniqueVisitors}
- Top Pages: ${JSON.stringify(topPages)}
- Device Split: ${JSON.stringify(devices)}
- Daily Trend: ${trend}

LEAD MANAGEMENT:
${conversionBlock}

SPEED TO LEAD:
${speedBlock}

PIPELINE:
${pipelineBlock}`;

    // ── Call Claude ──
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";

    // Extract JSON (handle potential markdown fences)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text) as {
      strengths: { title: string; detail: string }[];
      issues: { title: string; detail: string }[];
      actionPlan: { title: string; detail: string }[];
    };

    const insightsData: AIInsightsData = {
      ...parsed,
      generatedAt: new Date().toISOString(),
      range,
    };

    // Cache
    await db.insert(analyticsSnapshots).values({
      userId: targetUserId,
      source: CACHE_SOURCE,
      periodStart: start,
      periodEnd: end,
      data: insightsData,
    });

    return NextResponse.json(insightsData);
  } catch {
    if (cached) return NextResponse.json(cached.data);
    return NextResponse.json(emptyInsights(range));
  }
}
