import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAllCalendarEvents } from "@/lib/ghl-client";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  // `connected` / `error` let the page tell "not connected" from "GHL failed"
  // from "nothing booked"; `events` is always there.
  if (!user?.ghlLocationId) {
    return NextResponse.json({ events: [], connected: false });
  }

  const start = req.nextUrl.searchParams.get("start");
  const end = req.nextUrl.searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json(
      { error: "start and end query params required" },
      { status: 400 }
    );
  }

  try {
    const events = await getAllCalendarEvents(
      user.ghlLocationId,
      start,
      end
    );
    return NextResponse.json({ events, connected: true });
  } catch (err) {
    console.error("GHL calendar fetch failed:", err instanceof Error ? err.message.slice(0, 300) : err);
    return NextResponse.json({ events: [], connected: true, error: "GoHighLevel didn't answer." });
  }
}
