import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { users, analyticsSnapshots } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  getContacts,
  getCalendarEvents,
  searchConversations,
  getConversationMessages,
  type GHLContact,
  type GHLCalendarEvent,
  type GHLConversation,
} from "@/lib/ghl-client";
import type {
  GHLMetricsData,
  ConversionFunnelData,
  SpeedToLeadData,
} from "@/lib/types/ghl-metrics";

const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

function getDateRange(range: string) {
  const days = range === "30d" ? 30 : range === "90d" ? 90 : 7;
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

function emptySpeedToLead(): SpeedToLeadData {
  return {
    averageResponseMinutes: 0,
    medianResponseMinutes: 0,
    distribution: { under5min: 0, from5to30min: 0, over30min: 0 },
    performanceRating: "green",
    aiResponses: 0,
    humanResponses: 0,
    totalMeasured: 0,
  };
}

function emptyMetrics(): GHLMetricsData {
  return {
    conversion: {
      totalLeads: 0,
      respondedLeads: 0,
      bookedConsultations: 0,
      conversionRate: 0,
      previousConversionRate: null,
      benchmarkLow: 30,
      benchmarkHigh: 50,
    },
    speedToLead: emptySpeedToLead(),
  };
}

function computeConversionFunnel(
  contacts: GHLContact[],
  events: GHLCalendarEvent[],
  conversations: GHLConversation[]
): ConversionFunnelData {
  const totalLeads = contacts.length;

  // "Responded" = contacts that have at least one conversation thread
  const contactIdsWithConversation = new Set(
    conversations.map((c) => c.contactId)
  );
  const respondedLeads = contacts.filter((c) =>
    contactIdsWithConversation.has(c.id)
  ).length;

  // "Booked" = non-cancelled calendar events matched to period contacts
  const contactIdSet = new Set(contacts.map((c) => c.id));
  const bookedEvents = events.filter(
    (e) => contactIdSet.has(e.contactId) && e.status !== "cancelled"
  );
  const bookedConsultations = new Set(
    bookedEvents.map((e) => e.contactId)
  ).size;

  const conversionRate =
    totalLeads > 0
      ? Math.round((bookedConsultations / totalLeads) * 1000) / 10
      : 0;

  return {
    totalLeads,
    respondedLeads,
    bookedConsultations,
    conversionRate,
    previousConversionRate: null,
    benchmarkLow: 30,
    benchmarkHigh: 50,
  };
}

async function computeSpeedToLead(
  contacts: GHLContact[],
  conversations: GHLConversation[]
): Promise<SpeedToLeadData> {
  const contactDates = new Map(
    contacts.map((c) => [c.id, new Date(c.dateAdded)])
  );

  const relevantConvos = conversations.filter((c) =>
    contactDates.has(c.contactId)
  );

  const responseTimes: { minutes: number; isAi: boolean }[] = [];

  // Batch message fetches to avoid overwhelming the API
  const BATCH_SIZE = 10;
  for (let i = 0; i < relevantConvos.length; i += BATCH_SIZE) {
    const batch = relevantConvos.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((convo) =>
        getConversationMessages(convo.id, 20).catch(() => ({
          messages: [],
        }))
      )
    );

    for (let j = 0; j < batch.length; j++) {
      const convo = batch[j];
      const messages = results[j].messages;
      const contactAdded = contactDates.get(convo.contactId);
      if (!contactAdded) continue;

      // Find the first outbound message
      const firstOutbound = messages
        .filter((m) => m.direction === "outbound")
        .sort(
          (a, b) =>
            new Date(a.dateAdded).getTime() - new Date(b.dateAdded).getTime()
        )[0];

      if (firstOutbound) {
        const responseMs =
          new Date(firstOutbound.dateAdded).getTime() -
          contactAdded.getTime();
        const responseMinutes = Math.max(0, responseMs / 60000);
        const isAi = firstOutbound.messageType === "ai";
        responseTimes.push({ minutes: responseMinutes, isAi });
      }
    }
  }

  if (responseTimes.length === 0) {
    return emptySpeedToLead();
  }

  const sorted = responseTimes
    .map((r) => r.minutes)
    .sort((a, b) => a - b);
  const avg = sorted.reduce((s, v) => s + v, 0) / sorted.length;
  const median = sorted[Math.floor(sorted.length / 2)];

  const under5 = responseTimes.filter((r) => r.minutes < 5).length;
  const from5to30 = responseTimes.filter(
    (r) => r.minutes >= 5 && r.minutes < 30
  ).length;
  const over30 = responseTimes.filter((r) => r.minutes >= 30).length;

  const aiCount = responseTimes.filter((r) => r.isAi).length;
  const humanCount = responseTimes.length - aiCount;

  const rating: "green" | "yellow" | "red" =
    avg < 5 ? "green" : avg < 30 ? "yellow" : "red";

  return {
    averageResponseMinutes: Math.round(avg * 10) / 10,
    medianResponseMinutes: Math.round(median * 10) / 10,
    distribution: {
      under5min: under5,
      from5to30min: from5to30,
      over30min: over30,
    },
    performanceRating: rating,
    aiResponses: aiCount,
    humanResponses: humanCount,
    totalMeasured: responseTimes.length,
  };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user?.ghlLocationId) {
    return NextResponse.json(emptyMetrics());
  }

  // Check cache
  const [cached] = await db
    .select()
    .from(analyticsSnapshots)
    .where(
      and(
        eq(analyticsSnapshots.userId, userId),
        eq(analyticsSnapshots.source, "ghl-metrics")
      )
    )
    .orderBy(desc(analyticsSnapshots.createdAt))
    .limit(1);

  if (
    cached &&
    Date.now() - new Date(cached.createdAt).getTime() < CACHE_TTL_MS
  ) {
    return NextResponse.json(cached.data);
  }

  const range = req.nextUrl.searchParams.get("range") || "7d";
  const { start, end } = getDateRange(range);

  try {
    const [contactsRes, calendarRes, conversationsRes] = await Promise.all([
      getContacts(user.ghlLocationId, 100),
      getCalendarEvents(
        user.ghlLocationId,
        start.toISOString(),
        end.toISOString()
      ),
      searchConversations(user.ghlLocationId, 100),
    ]);

    // Filter contacts to the date range
    const periodContacts = (contactsRes.contacts ?? []).filter((c) => {
      const d = new Date(c.dateAdded);
      return d >= start && d <= end;
    });

    const conversion = computeConversionFunnel(
      periodContacts,
      calendarRes.events ?? [],
      conversationsRes.conversations ?? []
    );

    const speedToLead = await computeSpeedToLead(
      periodContacts,
      conversationsRes.conversations ?? []
    );

    const data: GHLMetricsData = { conversion, speedToLead };

    // Cache the result
    await db.insert(analyticsSnapshots).values({
      userId,
      source: "ghl-metrics",
      periodStart: start,
      periodEnd: end,
      data,
    });

    return NextResponse.json(data);
  } catch {
    if (cached) return NextResponse.json(cached.data);
    return NextResponse.json(emptyMetrics());
  }
}
