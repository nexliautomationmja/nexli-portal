import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { users, calendarConnections } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAllCalendarEvents } from "@/lib/ghl-client";
import {
  getValidGoogleToken,
  getGoogleCalendarEvents,
} from "@/lib/google-calendar";
import { getValidCalcomToken, getCalcomBookings } from "@/lib/calcom";

interface UnifiedEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  status: string;
  source: "ghl" | "google" | "calcom";
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = req.nextUrl.searchParams.get("start");
  const end = req.nextUrl.searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json(
      { error: "start and end query params required" },
      { status: 400 }
    );
  }

  const userId = session.user.id;

  // Fetch user and calendar connections in parallel
  const [[user], calConns] = await Promise.all([
    db
      .select({ ghlLocationId: users.ghlLocationId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
    db
      .select()
      .from(calendarConnections)
      .where(eq(calendarConnections.userId, userId)),
  ]);

  const hasGhl = !!user?.ghlLocationId;
  const googleConn = calConns.find((c) => c.provider === "google");
  const calcomConn = calConns.find((c) => c.provider === "calcom");

  // Fetch events from all sources in parallel
  const results = await Promise.allSettled([
    // GHL events
    hasGhl
      ? getAllCalendarEvents(user.ghlLocationId!, start, end).then((events) =>
          events.map(
            (e: { id: string; title?: string; startTime: string; endTime: string; status: string }) => ({
              id: `ghl_${e.id}`,
              title: e.title || "GHL Event",
              startTime: e.startTime,
              endTime: e.endTime,
              status: e.status === "cancelled" ? "cancelled" : "confirmed",
              source: "ghl" as const,
            })
          )
        )
      : Promise.resolve([]),

    // Google Calendar events
    googleConn
      ? getValidGoogleToken(userId).then((token) =>
          token ? getGoogleCalendarEvents(token, start, end) : []
        )
      : Promise.resolve([]),

    // Cal.com bookings
    calcomConn
      ? getValidCalcomToken(userId).then((token) =>
          token ? getCalcomBookings(token, start, end) : []
        )
      : Promise.resolve([]),
  ]);

  // Collect all events, silently skip failed sources
  const allEvents: UnifiedEvent[] = [];
  const sources: string[] = [];

  if (results[0].status === "fulfilled") {
    allEvents.push(...results[0].value);
    if (hasGhl) sources.push("ghl");
  }
  if (results[1].status === "fulfilled") {
    allEvents.push(...results[1].value);
    if (googleConn) sources.push("google");
  }
  if (results[2].status === "fulfilled") {
    allEvents.push(...results[2].value);
    if (calcomConn) sources.push("calcom");
  }

  // Sort by start time
  allEvents.sort(
    (a, b) =>
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  return NextResponse.json({ events: allEvents, sources });
}
