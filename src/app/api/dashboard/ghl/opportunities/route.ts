import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getOpportunities } from "@/lib/ghl-client";

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

  if (!user?.ghlLocationId) {
    return NextResponse.json({ opportunities: [], total: 0 });
  }

  const pipelineId = req.nextUrl.searchParams.get("pipelineId") || undefined;

  try {
    const data = await getOpportunities(user.ghlLocationId, pipelineId);
    // Search responses carry the count under meta.total.
    return NextResponse.json({
      opportunities: data.opportunities ?? [],
      total: data.meta?.total ?? data.total ?? data.opportunities?.length ?? 0,
    });
  } catch (err) {
    console.error("GHL opportunities fetch failed:", err);
    return NextResponse.json({ opportunities: [], total: 0 });
  }
}
