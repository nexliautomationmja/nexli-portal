import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { users, analyticsSnapshots } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  getContacts,
  getAllCalendarEvents,
  searchConversations,
} from "@/lib/ghl-client";
import {
  computeConversionFunnel,
  computeSpeedToLead,
  emptyMetrics,
} from "@/lib/ghl-computations";
import type { GHLMetricsData } from "@/lib/types/ghl-metrics";

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

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientIdParam = req.nextUrl.searchParams.get("clientId");

  // Admin can view any client; clients can only view their own
  let targetUserId = session.user.id;
  if (clientIdParam && session.user.role === "admin") {
    targetUserId = clientIdParam;
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  if (!user?.ghlLocationId) {
    return NextResponse.json(emptyMetrics());
  }

  const range = req.nextUrl.searchParams.get("range") || "7d";
  const { start, end } = getDateRange(range);

  // Check cache — filtered to a snapshot computed for the SAME range, so
  // toggling 7d/30d/90d each keeps its own cache entry (and the error
  // fallback below can never serve another range's numbers).
  const [cached] = await db
    .select()
    .from(analyticsSnapshots)
    .where(
      and(
        eq(analyticsSnapshots.userId, targetUserId),
        eq(analyticsSnapshots.source, "ghl-metrics"),
        sql`${analyticsSnapshots.data}->>'range' = ${range}`
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

  try {
    // Contacts are required; calendar + conversation failures degrade to
    // empty (their metrics read 0) instead of zeroing everything.
    let partialFailure = false;
    const [contactsRes, calendarEvents, conversationsRes] = await Promise.all([
      getContacts(user.ghlLocationId, 100),
      getAllCalendarEvents(
        user.ghlLocationId,
        start.toISOString(),
        end.toISOString()
      ).catch((err) => {
        console.error("[GHL Metrics] calendar events failed (continuing):", err);
        partialFailure = true;
        return [];
      }),
      searchConversations(user.ghlLocationId, 100).catch((err) => {
        console.error("[GHL Metrics] conversations failed (continuing):", err);
        partialFailure = true;
        return { conversations: [], total: 0 };
      }),
    ]);

    // Filter contacts to the date range
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

    const data: GHLMetricsData = { conversion, speedToLead, range };

    // Cache only fully-successful computes (degraded results are returned
    // fresh, never pinned), and replace this range's old snapshots so the
    // table doesn't grow one row per request.
    if (!partialFailure) {
      await db
        .delete(analyticsSnapshots)
        .where(
          and(
            eq(analyticsSnapshots.userId, targetUserId),
            eq(analyticsSnapshots.source, "ghl-metrics"),
            sql`${analyticsSnapshots.data}->>'range' = ${range}`
          )
        );
      await db.insert(analyticsSnapshots).values({
        userId: targetUserId,
        source: "ghl-metrics",
        periodStart: start,
        periodEnd: end,
        data,
      });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[GHL Metrics] Failed to fetch:", err);
    if (cached) return NextResponse.json(cached.data);
    return NextResponse.json(emptyMetrics());
  }
}
