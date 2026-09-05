import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { users, analyticsSnapshots } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getContacts, contactsCount } from "@/lib/ghl-client";

const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Get user's GHL location ID
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user?.ghlLocationId) {
    return NextResponse.json({
      leadsCount: 0,
      recentLeads: [],
      pipelines: [],
      pipelineValue: 0,
    });
  }

  // Check cache
  const [cached] = await db
    .select()
    .from(analyticsSnapshots)
    .where(
      and(
        eq(analyticsSnapshots.userId, userId),
        eq(analyticsSnapshots.source, "gohighlevel")
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

  // Fetch fresh data. Contacts only — pipeline value now comes from the
  // internal pipeline (/api/dashboard/pipeline), so the GHL opportunities
  // calls were dropped; the response keeps the old shape for compatibility.
  try {
    const contactsRes = await getContacts(user.ghlLocationId);

    const data = {
      leadsCount: contactsCount(contactsRes),
      recentLeads: (contactsRes.contacts || []).slice(0, 5),
      pipelines: [],
      pipelineValue: 0,
    };

    // Replace the previous snapshot so the table doesn't grow per request.
    await db
      .delete(analyticsSnapshots)
      .where(
        and(
          eq(analyticsSnapshots.userId, userId),
          eq(analyticsSnapshots.source, "gohighlevel")
        )
      );
    await db.insert(analyticsSnapshots).values({
      userId,
      source: "gohighlevel",
      periodStart: new Date(),
      periodEnd: new Date(),
      data,
    });

    return NextResponse.json(data);
  } catch (err) {
    console.error("GHL fetch failed (check GHL_API_KEY / location id):", err);
    // Return cached data if available, even if stale
    if (cached) return NextResponse.json(cached.data);
    return NextResponse.json({
      leadsCount: 0,
      recentLeads: [],
      pipelines: [],
      pipelineValue: 0,
    });
  }
}
