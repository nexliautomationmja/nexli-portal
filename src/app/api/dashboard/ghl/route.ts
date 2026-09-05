import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { users, analyticsSnapshots } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  getContacts,
  getPipelines,
  getOpportunities,
  contactsCount,
  type GHLPipeline,
} from "@/lib/ghl-client";

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

  // Fetch fresh data. Contacts are the backbone — if they fail we fall to
  // the catch. Pipelines/opportunities failures must NOT zero out a good
  // contacts result, so they degrade independently.
  try {
    const contactsRes = await getContacts(user.ghlLocationId);

    let pipelines: GHLPipeline[] = [];
    let pipelineValue = 0;
    let pipelinesOk = false;
    try {
      const pipelinesRes = await getPipelines(user.ghlLocationId);
      pipelines = pipelinesRes.pipelines || [];
      if (pipelines.length > 0) {
        const oppRes = await getOpportunities(user.ghlLocationId, pipelines[0].id);
        pipelineValue = (oppRes.opportunities || []).reduce(
          (sum, o) => sum + (o.monetaryValue || 0),
          0
        );
      }
      pipelinesOk = true;
    } catch (pipelineErr) {
      console.error("GHL pipelines/opportunities fetch failed (contacts OK):", pipelineErr);
    }

    const data = {
      leadsCount: contactsCount(contactsRes),
      recentLeads: (contactsRes.contacts || []).slice(0, 5),
      pipelines,
      pipelineValue,
    };

    // Cache only fully-successful results — a degraded (pipelines-failed)
    // response is returned fresh but never pinned for 4h, so recovery from a
    // transient error or a fixed scope is immediate.
    if (pipelinesOk) {
      await db.insert(analyticsSnapshots).values({
        userId,
        source: "gohighlevel",
        periodStart: new Date(),
        periodEnd: new Date(),
        data,
      });
    }

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
